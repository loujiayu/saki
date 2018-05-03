import * as r from 'rethinkdb';
import Server from './server';

export default class Collection {
  table: r.Table;
  
  constructor(private db: string, private name: string, private server: Server) {
    this.table = r.db(db).table(name);
  }
}