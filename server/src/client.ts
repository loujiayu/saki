import * as websocket from 'ws';
import { JsonWebTokenError } from 'jsonwebtoken';
import { flatbuffers } from 'flatbuffers';
import * as fbs from './msg_generated';

import Server from './server';
import Request, { IRequest } from './request';
import Auth from './auth';
import logger from './logger';

export interface IRule {
  update: Function;
  remove: Function;
  insert: Function;
  fetch: Function;
}

export default class Client {
  server: Server;
  requestHandlers: Map<string, Function>;
  auth: Auth;
  rules: { [key: string]: IRule };
  requests: Map<number, Request>;

  constructor(private socket: websocket, server) {
    logger.log('Client connection established.');
    this.server = server;
    this.auth = server.auth;
    this.rules = server.rules;
    this.requestHandlers = server.requestHandlers;

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

  sendResponse(requestId, data) {
    if (!this.isOpen()) return;
    
    data.requestId = requestId;
    logger.log(`Sending response: ${JSON.stringify(data)}`);
    try {
      this.socket.send(JSON.stringify(data));
    } catch (e) {
      logger.error(e);
    }
  }

  sendError(requestId: number, error: string) {
    this.sendResponse(requestId, { error });
  }

  handleHandshake(data) {
    const u8 = new Uint8Array(data);
    const bb = new flatbuffers.ByteBuffer(u8);
    const res = fbs.Base.getRootAsBase(bb);
    console.log(res.authType() === fbs.AuthType.unauthenticated);

    console.log(data);
    // const request: IRequest = this.parseRequest(data);
    // logger.log(`Received handshake: ${JSON.stringify(request)}`);
    // this.auth.handshake(request).then(res => {
    //   let info;
    //   if (res.error) {
    //     info = { method: request.method, error: res.error };
    //     this.createHandshakeHandler();
    //   } else {
    //     info = { token: res.token, user: res.user, method: request.method };
    //     this.socket.on('message', this.handleRequestWrapper);
    //   }
    //   this.sendResponse(request.requestId, info);
    // }).catch((err: JsonWebTokenError) => {
    //   this.sendResponse(request.requestId, { error: err.message });
    //   this.createHandshakeHandler();
    // });
  }

  handleRequestWrapper(msg) {
    this.errorWrapSocket(() => this.handleRequest(msg));
  }

  getRequestHandler(request): Function {
    return this.requestHandlers.get(request.type) as Function;
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
    logger.log(`Received request from client: ${JSON.stringify(data)}}`);
    const rawRequest: IRequest = this.parseRequest(data);
    if (rawRequest.type === 'unsubscribe') {
      this.removeRequest(rawRequest.requestId);
      return;
    } else if (rawRequest.type === 'keepalive') {
      this.sendResponse(rawRequest.requestId, { type: 'keepalive' });
      return;
    } else if (rawRequest.type === 'logout') {
      this.createHandshakeHandler();
      this.removeRequest(rawRequest.requestId);
      this.sendResponse(rawRequest.requestId, { type: 'logout', state: 'complete' });
      return;
    }
    if (!rawRequest.options) {
      this.sendError(rawRequest.requestId, 'unvalid request');
      return;
    }

    const endpoint = this.getRequestHandler(rawRequest);
    if (!endpoint) {
      this.sendError(rawRequest.requestId, 'unknown endpoint');
      return;
    }
    const collection = rawRequest.options.collection;
    if (!this.validate(endpoint.name, collection, rawRequest)) {
      this.sendError(rawRequest.requestId, `${endpoint.name} in table ${collection} is not allowed`);
      return;
    }
    const request: Request = new Request(rawRequest, endpoint, this, rawRequest.requestId);
    this.requests.set(rawRequest.requestId, request);
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