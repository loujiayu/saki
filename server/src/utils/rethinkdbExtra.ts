import * as r from 'rethinkdb';

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