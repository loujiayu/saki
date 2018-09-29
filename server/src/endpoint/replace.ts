import * as r from 'rethinkdb';
import * as fbs from '../msg_generated';
import { decodeToJSObj } from '../utils/utils';
import Request from '../request';

export async function replace(request: Request) {
  try {
    const msg = new fbs.Insert();
    request.reqBase.msg(msg);
    const collection = msg.collection();
    request.collection = collection!;

    const valid = request.client.validate(request.reqBase, collection!);
    if (!valid)
      return request.sendError(`replace in table ${collection} is not allowed`);

    const {dbConnection, collections} = request.client.server;
    const data = decodeToJSObj(msg);

    const conn = dbConnection.connection();
    const result: r.WriteResult =
      await (collections.get(collection!)!.table.get(data.id) as any).replace(data).run(conn);

    const {first_error, ...other} = result;
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