import * as r from 'rethinkdb';
import * as fbs from '../msg_generated';
import { decodeToJSObj } from '../utils/utils';
import Request from '../request';

export async function update(request: Request) {
  try {
    const msg = new fbs.Update();
    request.reqBase.msg(msg);
    const collection = msg.collection();
    request.collection = collection!;
    
    const valid = request.client.validate(request.reqBase, collection!);
    if (!valid)
      return request.sendError(`update in table ${collection} is not allowed`);

    const {dbConnection, collections} = request.client.server;

    const selector = JSON.parse(msg.selector()!);
    const data = decodeToJSObj(msg);

    const conn = dbConnection.connection();
    const table = collections.get(collection!)!.table;
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

    request.sendData({
      done: true,
      data: res
    })
  } catch (e) {
    request.sendError(e.message)
  }
}