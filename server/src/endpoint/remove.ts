import * as r from 'rethinkdb';
import * as fbs from '../msg_generated';

export async function remove(base: fbs.Base, collections, send, errorHandle, dbConnection) {
  try {
    const msg = new fbs.Remove();
    base.msg(msg);
    const collection = msg.collection();

    let selector = msg.selector();
    if (selector) {
      selector = JSON.parse(selector);
    }

    const conn = dbConnection.connection();
    const table = collections.get(collection).table;
    let result: r.WriteResult;
    if (typeof selector === 'string') {
      result = await (table.get(selector) as any).delete().run(conn);
    } else if (selector !== null && typeof selector === 'object') {
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
      done: true,
      data
    })
  } catch (e) {
    errorHandle(e.message)
  }
}