import * as websocket from 'ws';
import { JsonWebTokenError } from 'jsonwebtoken';
import { flatbuffers } from 'flatbuffers';
import * as fbs from './msg_generated';

import Server from './server';
import Request, { IRequest } from './request';
import Auth from './auth';
import logger from './logger';
import { query, insert, remove, update, upsert, replace, watch } from './endpoint';

export interface IRule {
  update: Function;
  remove: Function;
  insert: Function;
  fetch: Function;
}

export default class Client {
  server: Server;
  auth: Auth;
  rules: { [key: string]: IRule };
  requests: Map<number, Request>;

  constructor(private socket: websocket, server) {
    logger.log('Client connection established.');
    this.server = server;
    this.auth = server.auth;
    this.rules = server.rules;

    this.requests = new Map();
    
    this.socket.on('close', () => {
      logger.log('Client connection terminated.');
      this.requests.forEach(request => request.close());
      this.requests.clear();
      this.server.clients.delete(this);
    });
    this.socket.on('error', (code, msg) => {
      logger.error(`Received error from client: ${msg} (${code})`);
    });

    this.handleRequestWrapper = this.handleRequestWrapper.bind(this);
    this.createHandshakeHandler();
  }

  createHandshakeHandler() {
    this.socket.removeListener('message', this.handleRequestWrapper);

    this.socket.once(
      'message',
      data => this.errorWrapSocket(() => this.handleHandshake(data))
    );
  }

  parseRequest(data: string): IRequest {
    if (typeof data === 'string') {
      return JSON.parse(data);
    } else {
      return data;
    }
  }

  sendResponse(data: Uint8Array) {
    if (!this.isOpen()) return;
    try {
      this.socket.send(data);
    } catch (e) {
      logger.error(e);
    }
  }

  sendAuthError(requestId: number, error: string) {
    const builder = new flatbuffers.Builder();
    const error_ = builder.createString(error)
    fbs.AuthRes.startAuthRes(builder);
    fbs.AuthRes.addError(builder, error_);
    const msg = fbs.AuthRes.endAuthRes(builder);
    fbs.Base.startBase(builder);
    fbs.Base.addMsg(builder, msg);
    fbs.Base.addMsgType(builder, fbs.Any.AuthRes);
    fbs.Base.addRequestId(builder, requestId);
    builder.finish(fbs.Base.endBase(builder));
    
    this.sendResponse(builder.asUint8Array());
  }

  sendError(requestId: number, error: string) {
    const builder = new flatbuffers.Builder();
    const error_ = builder.createString(error)
    fbs.Response.startResponse(builder);
    fbs.Response.addError(builder, error_);
    const msg = fbs.Response.endResponse(builder);
    fbs.Base.startBase(builder);
    fbs.Base.addMsg(builder, msg);
    fbs.Base.addMsgType(builder, fbs.Any.Response);
    fbs.Base.addRequestId(builder, requestId);
    builder.finish(fbs.Base.endBase(builder));
    
    this.sendResponse(builder.asUint8Array());
  }

  handleHandshake(data) {
    const u8 = new Uint8Array(data);
    const bb = new flatbuffers.ByteBuffer(u8);
    const reqBase = fbs.Base.getRootAsBase(bb);

    const msg = new fbs.Auth();
    reqBase.msg(msg);
    
    this.auth.handshake(msg).then(res => {
      const builder = new flatbuffers.Builder();
      const error = res.error && builder.createString(res.error);
      const token = res.token && builder.createString(res.token);
      const user = res.user && builder.createString(res.user);

      fbs.AuthRes.startAuthRes(builder);
      if (res.error) {
        fbs.AuthRes.addError(builder, error);
        this.createHandshakeHandler();
      } else {
        if (token) {
          fbs.AuthRes.addToken(builder, token);
        }
        if (user) {
          fbs.AuthRes.addUsername(builder, user);
        }
        this.socket.on('message', this.handleRequestWrapper);
      }
      const msg = fbs.AuthRes.endAuthRes(builder);
      fbs.Base.startBase(builder);
      fbs.Base.addMsg(builder, msg);
      fbs.Base.addMsgType(builder, fbs.Any.AuthRes);
      fbs.Base.addRequestId(builder, reqBase.requestId());
      builder.finish(fbs.Base.endBase(builder));
      this.sendResponse(builder.asUint8Array());
    }).catch((err: JsonWebTokenError) => {
      console.log(err);
      this.sendAuthError(reqBase.requestId(), err.message);
      this.createHandshakeHandler();
    });
  }

  handleRequestWrapper(msg) {
    this.errorWrapSocket(() => this.handleRequest(msg));
  }

  getRequestHandler(key): Function {
    switch (key) {
      case fbs.Any.Query:
        return query;
      default:
        return () => {};
    }
  }

  errorWrapSocket(cb) {
    try {
      cb();
    } catch (err) {
      logger.error(`Unhandled error in request: ${err.stack}`);
    }
  }

  validate(operation: string, collection: string, rawRequest: IRequest): boolean {
    const rule = this.rules[collection];
    if (!rule) return false;
    if (!rawRequest.options) return false;

    const { user, options: { selector, data } } = rawRequest;
    switch (operation) {
      case 'update':
      case 'upsert':
        return rule.update(user, selector, data);
      case 'insert':
      case 'replace':
        return rule.insert(user, data);
      case 'query':
      case 'watch':
        return rule.fetch(user, selector);
      case 'remove':
        return rule.remove(user, selector);
      default:
        return false;
    }
  }

  handleRequest(data) {
    const u8 = new Uint8Array(data);
    const bb = new flatbuffers.ByteBuffer(u8);
    const reqBase = fbs.Base.getRootAsBase(bb);
    // logger.log(`Received request from client: ${JSON.stringify(data)}}`);
    // const rawRequest: IRequest = this.parseRequest(data);
    // if (rawRequest.type === 'unsubscribe') {
    //   this.removeRequest(rawRequest.requestId);
    //   return;
    // } else if (rawRequest.type === 'keepalive') {
    //   // this.sendResponse(rawRequest.requestId, { type: 'keepalive' });
    //   return;
    // } else if (rawRequest.type === 'logout') {
    //   this.createHandshakeHandler();
    //   this.removeRequest(rawRequest.requestId);
    //   // this.sendResponse(rawRequest.requestId, { type: 'logout', state: 'complete' });
    //   return;
    // }
    // if (!rawRequest.options) {
    //   this.sendError(rawRequest.requestId, 'unvalid request');
    //   return;
    // }

    const endpoint = this.getRequestHandler(reqBase.msgType());
    // if (!endpoint) {
    //   this.sendError(rawRequest.requestId, 'unknown endpoint');
    //   return;
    // }
    // const collection = rawRequest.options.collection;
    // if (!this.validate(endpoint.name, collection, rawRequest)) {
    //   this.sendError(rawRequest.requestId, `${endpoint.name} in table ${collection} is not allowed`);
    //   return;
    // }
    const request: Request = new Request(reqBase, endpoint, this, reqBase.requestId());
    this.requests.set(reqBase.requestId(), request);
    return request.run();
  }

  isOpen() {
    return this.socket.readyState === websocket.OPEN;
  }

  removeRequest(id: number) {
    const request = this.requests.get(id);
    this.requests.delete(id);
    if (request) {
      request.close();
    }
  }

  close(info) {
    if (this.isOpen()) {
      logger.log('Closing client connection with message:' + info);
      const closeMsg = (info.error && info.error.substr(0, 64)) || 'Unspecified reason.';
      this.socket.close(closeMsg);
    }
  }
}