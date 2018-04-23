import * as r from 'rethinkdb';

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
    this.readyPromise = this.connect();
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
      await (r.dbList() as any)
        .contains(this.db)
        .do(exist => {
          return r.branch(
            exist,
            r.expr(null),
            r.dbCreate(this.db) as any
          )
        })
        .run(this._conn);
      await (r.db(this.db).tableList() as any)
        .contains(this.userTableName)
        .do(exist => {
          return r.branch(
            exist,
            r.expr(null),
            r.db(this.db).tableCreate(this.userTableName, { primary_key: 'username' }) as any
          )
        })
        .run(this._conn);
      return this._conn;
    } catch (error) {
      console.error(error);
    }
  }

  close() {
    this.readyPromise.then(conn => conn.close());
  }

  connection() {
    return this._conn;
  }
}

