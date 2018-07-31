import * as websocket from 'ws';
import * as url from 'url';
import * as http from 'http';

import Request, { IRequest } from './request';
import Auth from './auth';
import Client from './client';
import Collection from './collection';
import ReqlConnection from './reql_connection';
import { invariant, parseRules } from './utils/utils';
import { ensureTable } from './utils/rethinkdbExtra';
import { query, insert, remove, update, upsert, replace, watch } from './endpoint';
import config from './config';
import logger from './logger';

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
  update: Function;
  remove: Function;
  insert: Function;
  fetch: Function;
}

export default class Server {
  path: string;
  requestHandlers: Map<string, Function>;
  auth: Auth;
  opts;
  dbConnection: ReqlConnection;
  httpServer: http.Server;
  wsServers: any;
  collections: Map<string, Collection>;
  requests: Map<number, Request>;
  rules: { [key: string]: IRule };
  wss: websocket.Server;
  clients: Set<Client>;

  constructor(httpServer, user_opts) {
    this.opts = Object.assign({}, user_opts, config);
    this.path = this.opts.path;
    this.requestHandlers = new Map();
    this.httpServer = httpServer;
    this.wsServers = [];
    this.collections = new Map();
    this.requests = new Map();
    this.rules = parseRules(this.opts.rules);
    this.clients = new Set();
    this.dbConnection = new ReqlConnection(this, this.opts);
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
      logger.error(error);
    }
    for (const key in endpoints) {
      this.addRequestHandler(key, endpoints[key]);
    }
    this.addHttpListener();
    this.addWebsocket();
  }

  addHttpListener() {
    const extant_listeners = this.httpServer.listeners('request').slice(0);
    this.httpServer.on('request', (req, res) => {
      const req_path = url.parse(req.url).pathname;
    });
  }

  addWebsocket() {
    this.wss = new websocket.Server(Object.assign({ server: this.httpServer }, { path: this.path }))
      .on('error', error => logger.error(`Websocket server error: ${error}`))
      .on('connection', socket => {
        this.clients.add(new Client(socket, this));
      });
  }

  addRequestHandler(request_name, endpoint) {
    this.requestHandlers.set(request_name, endpoint);
  }

  close() {
    this.wss.close();
    this.dbConnection.close();
    this.httpServer.close();
  }
}
