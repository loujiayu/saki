import * as websocket from 'ws';
import * as url from 'url';
import * as http from 'http';

import Request from './request';
import Auth from './auth';
import Client from './client';
import Collection from './collection';
import * as fbs from './msg_generated';

import ReqlConnection from './reql_connection';
import { invariant, parseRules } from './utils/utils';
import { ensureTable, ensureIndex } from './utils/rethinkdbExtra';
import config from './config';
import logger from './logger';

export interface IRule {
  update: Function;
  remove: Function;
  insert: Function;
  fetch: Function;
  indexes?: Array<string | Array<string>>;
}

export default class Server {
  path: string;
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
  useCache: Boolean;

  constructor(httpServer, user_opts) {
    this.opts = Object.assign({}, user_opts, config);
    this.path = this.opts.path;
    this.httpServer = httpServer;
    this.wsServers = [];
    this.collections = new Map();
    this.requests = new Map();
    this.rules = parseRules(this.opts.rules);
    this.clients = new Set();
    this.dbConnection = new ReqlConnection(this, this.opts);
    this.auth = new Auth(this, this.opts);

    this.useCache = true;
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
        const rule = this.rules[collection];
        this.collections.set(collection, new Collection(this.opts.projectName, collection, rule));
        await this.createIndex(rule, collection, conn);
      }
    } catch (error) {
      console.log(error);
    }
    this.addHttpListener();
    this.addWebsocket();
  }

  async createIndex(rule, collection, conn) {
    try {
      await ensureTable(this.dbConnection.db, collection, conn);
      if (rule.indexes) {
        await Promise.all(
          rule.indexes.map(idx => ensureIndex(this.dbConnection.db, collection, idx, conn))
        );
      }
  } catch (error) {
      logger.error(error);
    }
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

  close() {
    this.wss.close();
    this.dbConnection.close();
    this.httpServer.close();
  }

  // just for test
  async changeRules(rules: { [key: string]: IRule }) {
    try {
      this.rules = rules;
      const conn = await this.dbConnection.connection();
      for (const collection in this.rules) {
        const rule = this.rules[collection];
        await this.createIndex(rule, collection, conn);
      }
    } catch (error) {
      logger.error(error);
    }
  }
}
