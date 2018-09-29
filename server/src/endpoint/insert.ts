import * as r from 'rethinkdb';
import * as fbs from '../msg_generated';
import { decodeToJSObj } from '../utils/utils';
import Request from '../request';

export async function insert(request: Request) {
  try {
    const msg = new fbs.Insert();
    request.reqBase.msg(msg);
    const collection = msg.collection();
    request.collection = collection!;
    
    const valid = request.client.validate(request.reqBase, collection!);
    if (!valid)
      return request.sendError(`insert in table ${collection} is not allowed`);

    const {dbConnection, collections} = request.client.server;
    const data = decodeToJSObj(msg);

    let options = msg.options();
    options = options && JSON.parse(options);

    const conn = dbConnection.connection();
    const result: r.WriteResult =
      await collections.get(collection!)!.table.insert(data, (options || {} as any)).run(conn);

    const { first_error, generated_keys, ...other } = result;
    const res: Object[] = [];
    if (generated_keys) {
      other['id'] = generated_keys;
    }
    if (first_error) {
      throw new Error((first_error as any));
    } else {
      res.push(other);
    }
    request.sendData({
      done: true,
      data: res
    });
  } catch (e) {
    request.sendError(e.message);
  }

}