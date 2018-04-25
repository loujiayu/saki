import * as r from 'rethinkdb';
import { ensureDB, ensureTable } from './utils/rethinkdbExtra';

export default class ReqlConnection {
  rdbConfig;
  retryDelay: number = 1000;
  readyPromise: Promise<any>;
  _conn;
  reconnectTimer;
  db: string;
  userTableName: string;

  constructor({
    rdbHost = 'localhost',
    rdbPort = 28015,
    projectName
  }) {
    this.rdbConfig = {
      host: rdbHost,
      port: rdbPort,
      db: projectName,
    };
    this.db = projectName;
    this.userTableName = 'users';
  }

  reconnect() {
    if (this._conn) {
      this._conn.removeAllListeners();
      this._conn.close();
    }
    this._conn = null;
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(this.connect(), this.retryDelay);
    }
  }

  async connect() {
    this.reconnectTimer = null;
    try {
      this._conn = await r.connect(this.rdbConfig);
      this._conn.on('error', error => {
        console.error(`error in rethinkdb ${error}`);
        this.reconnect();
      });
      await ensureDB(this.db, this._conn);
      await ensureTable(this.db, this.userTableName, this._conn, { primary_key: 'username' });
      return this._conn;
    } catch (error) {
      console.error(error);
      this.reconnect();
    }
  }

  close() {
    if (this._conn) {
      this._conn.close();
    }
  }

  connection() {
    return this._conn;
  }
}

