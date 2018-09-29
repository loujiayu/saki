import * as r from 'rethinkdb';
import * as fbs from '../msg_generated';
import Request from '../request';

export async function remove(request: Request) {
  try {
    const msg = new fbs.Remove();
    request.reqBase.msg(msg);
    const collection = msg.collection();
    request.collection = collection!;

    const valid = request.client.validate(request.reqBase, collection!);
    if (!valid)
      return request.sendError(`remove in table ${collection} is not allowed`);

    let selector = msg.selector();
    if (selector) {
      selector = JSON.parse(selector);
    }

    const {dbConnection, collections} = request.client.server;
    const conn = dbConnection.connection();
    const table = collections.get(collection!)!.table;
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

    request.sendData({
      done: true,
      data
    })
  } catch (e) {
    request.sendError(e.message)
  }
}