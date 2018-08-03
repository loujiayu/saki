import * as r from 'rethinkdb';
import Server, { IRule } from './server';

export default class Collection {
  table: r.Table;
  indexes: Array<string | Array<string>> | undefined;

  constructor(db: string, name: string, rule: IRule) {
    this.table = r.db(db).table(name);
    this.indexes = rule.indexes;
  }
}