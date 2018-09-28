import * as r from 'rethinkdb';
import * as fbs from '../msg_generated';
import { decodeToJSObj } from '../utils/utils';

export async function update(base: fbs.Base, collections, send, errorHandle, dbConnection) {
  try {
    const msg = new fbs.Update();
    base.msg(msg);
    const collection = msg.collection();
    const selector = JSON.parse(msg.selector()!);
    const data = decodeToJSObj(msg);

    const conn = dbConnection.connection();
    const table = collections.get(collection).table;
    let query;
    if (typeof selector === 'string') {
      query = table.get(selector);
    } else {
      query = table.filter(selector);
    }

    const result: r.WriteResult = await query.update(data).run(conn);
    const { first_error, ...other } = result;
    const res: Object[] = [];

    if (first_error) {
      throw new Error((first_error as any));
    } else {
      res.push(other);
    }

    send({
      done: true,
      data: res
    })
  } catch (e) {
    errorHandle(e.message)
  }
}