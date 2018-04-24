import * as r from 'rethinkdb';

export async function remove({ collection, selector }, collections, send, errorHandle, dbConnection) {
  try {
    const conn = dbConnection.connection();
    const table = collections.get(collection).table;
    let result: r.WriteResult;
    if (typeof selector === 'string') {
      result = await (table.get(selector) as any).delete().run(conn);
    } else if (typeof selector === 'object') {
      result = await table.filter(selector).delete().run(conn);
    } else {
      result = await table.delete().run(conn);
    }

    const { first_error, ...other } = result;
    const data: Object[] = [];

    if (first_error) {
      data.push({ error: first_error })
    } else {
      data.push(other);
    }

    send({
      state: 'complete',
      data
    })
  } catch (e) {
    errorHandle(e.message)
  }
}