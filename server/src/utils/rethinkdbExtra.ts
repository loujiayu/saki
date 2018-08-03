import * as r from 'rethinkdb';

import { compoundIndexGenerator } from './utils';

export async function ensureDB(db, conn) {
  await (r.dbList() as any)
    .contains(db)
    .do(exist => {
      return r.branch(
        exist,
        r.expr(null),
        r.dbCreate(db) as any
      );
    })
    .run(conn);
}

export async function ensureTable(db, table, conn, options: Object = {}) {
  await (r.db(db).tableList() as any)
    .contains(table)
    .do(exist => {
      return r.branch(
        exist,
        r.expr(null),
        r.db(db).tableCreate(table, options) as any
      );
    })
    .run(conn);
}

export async function ensureIndex(db, table, index, conn) {
  let indexToBeCreate = index;
  let indexFunction;
  if (Array.isArray(indexToBeCreate)) {
    indexFunction = (row) => {
      return index.map(i => row(i));
    };
    indexToBeCreate = compoundIndexGenerator(indexToBeCreate);
  }

  await (r.db(db).table(table).indexList() as any)
    .contains(indexToBeCreate)
    .do(exist => {
      return r.branch(
        exist,
        r.expr(null),
        r.db(db).table(table).indexCreate(
          indexToBeCreate,
          indexFunction
        ) as any
      );
    })
    .run(conn);
}