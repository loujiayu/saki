import * as r from 'rethinkdb';
import * as websocket from 'ws';
import * as url from 'url';
import { JsonWebTokenError } from 'jsonwebtoken';

import Request, { IRequest } from './request';
import Auth from './auth';
import Collection from './collection';
import ReqlConnection from './reql_connection';
import { invariant, parseRules } from './utils/utils';
import { ensureTable } from './utils/rethinkdbExtra';
import { query, insert, remove, update, upsert, replace, watch } from './endpoint';
import config from './config';

const endpoints = {
  query,
  insert,
  update,
  remove,
  replace,
  upsert,
  watch
};

export interface IRule {
  update: Function
  remove: Function
  insert: Function
  fetch: Function
}

export default class Server {
  path: string;
  requestHandlers: Map<string, Function>;
  auth: Auth;
  opts;
  dbConnection: ReqlConnection;
  httpServer: any;
  wsServers: any;
  socket;
  collections: Map<string, Collection>;
  requests: Map<number, Request>;
  rules: { [key: string]: IRule }

  constructor(httpServer, user_opts) {
    this.opts = Object.assign({}, user_opts, config);
    this.path = this.opts.path;
    this.requestHandlers = new Map();
    this.httpServer = httpServer;
    this.wsServers = [];
    this.collections = new Map();
    this.requests = new Map();
    this.rules = parseRules(this.opts.rules);

    this.dbConnection = new ReqlConnection(this.opts);
    this.auth = new Auth(this, this.opts);
  }

  static async createServer(httpServer, opts) {
    const server = new Server(httpServer, opts);
    await server.connect();
    return server;
  }

  async connect() {
    try {
      const conn = await this.dbConnection.connect();
      for (const collection in this.rules) {
        this.collections.set(collection, new Collection(this.opts.projectName, collection, this));
        await ensureTable(this.dbConnection.db, collection, conn);
      }
    } catch (error) {
      console.error(error);
    }
    for (const key in endpoints) {
      this.addRequestHandler(key, endpoints[key]);
    }
    if (this.httpServer) {
      this.addHttpListener();
      this.addWebsocket();
    }
  }

  addHttpListener() {
    const extant_listeners = this.httpServer.listeners('request').slice(0);
    this.httpServer.on('request', (req, res) => {
      const req_path = url.parse(req.url).pathname;
    })
  }

  addWebsocket() {
    const ws_options = { path: this.path };
    const ws_server = new websocket.Server(Object.assign({ server: this.httpServer }, this.ws_options))
      .on('error', error => console.error(`Websocket server error: ${error}`))
      .on('connection', socket => {
        this.socket = socket;
        this.socket.on('error', (code, msg) => {
          console.log(`Received error from client: ${msg} (${code})`)
        })
        this.socket.once('message', data => this.errorWrapSocket(() => this.handleHandshake(data)))
      });
    this.wsServers.push(ws_server);
  }

  getRequestHandler(request): Function {
    return this.requestHandlers.get(request.type) as Function;
  }
  addRequestHandler(request_name, endpoint) {
    this.requestHandlers.set(request_name, endpoint);
  }

  errorWrapSocket(cb) {
    try {
      cb();
    } catch (err) {
      console.error(`Unhandled error in request: ${err.stack}`);
    }
  }
  parseRequest(data: string): IRequest {
    if (typeof data === 'string') {
      return JSON.parse(data);
    } else {
      return data;
    }
  }
  validate(operation: string, collection: string, rawRequest: IRequest): boolean {
    const rule = this.rules[collection];
    if (!rule) return false;
    if (!rawRequest.internal || !rawRequest.options) return false;

    const { internal: { user }, options: { selector, data } } = rawRequest;
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
  changeRules(rules) {
    this.rules = rules;
  }
  handleHandshake(data) {
    console.log(data);
    const request: IRequest = this.parseRequest(data);
    this.auth.handshake(request).then(res => {
      let info;
      if (res.error) {
        info = { method: request.method, error: res.error };
        this.socket.once('message', msg => this.errorWrapSocket(() => this.handleHandshake(msg)))
      } else {
        info = { token: res.token, user: res.user, method: request.method };
        this.socket.on('message', msg => {
          this.errorWrapSocket(() => this.handleRequest(msg));
        });
      }
      this.sendResponse(request.requestId, info);
    }).catch((err: JsonWebTokenError) => {
      this.sendResponse(request.requestId, { error: err.message });
    });
  }

  sendResponse(requestId, data) {
    data.requestId = requestId;
    try {
      this.socket.send(JSON.stringify(data));
    } catch (e) {
      console.log(e, data);
    }
  }

  sendError(requestId: number, error: string) {
    this.sendResponse(requestId, { error })
  }

  handleRequest(data): Promise<any> {
    console.log(data);
    const rawRequest: IRequest = this.parseRequest(data);
    if (rawRequest.type === 'unsubscribe') {
      this.removeRequest(rawRequest.requestId);
      return Promise.resolve();
    } else if (rawRequest.type === 'keepalive') {
      this.sendResponse(rawRequest.requestId, { type: 'keepalive' });
      return Promise.resolve();
    }
    if (!rawRequest.internal || !rawRequest.options) {
      this.sendError(rawRequest.requestId, 'unvalid request');
      return Promise.resolve();
    }

    const endpoint = this.getRequestHandler(rawRequest);
    if (!endpoint) {
      this.sendError(rawRequest.requestId, 'unknown endpoint');
      return Promise.resolve();
    }
    const collection = rawRequest.options.collection;
    if (!this.validate(endpoint.name, collection, rawRequest)) {
      this.sendError(rawRequest.requestId, `${endpoint.name} in table ${collection} is not allowed`);
      return Promise.resolve();
    }
    const request: Request = new Request(rawRequest, endpoint, this, rawRequest.requestId);
    this.requests.set(rawRequest.requestId, request);
    return request.run();
  }

  removeRequest(id: number) {
    const request = this.requests.get(id);
    this.requests.delete(id);
    if (request) {
      request.close();
    }
  }

  close() {
    this.wsServers.forEach(ws => {
      ws.close()
    })

    this.dbConnection.close();

    if (this.httpServer) {
      this.httpServer.close()
    }
  }
}
