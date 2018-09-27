import * as r from 'rethinkdb';
import * as fbs from '../msg_generated';
import {TextDecoder} from 'text-encoding';

export async function insert(base: fbs.Base, collections, send, errorHandle, dbConnection) {
  try {
    const msg = new fbs.Insert();
    base.msg(msg);
    const collection = msg.collection();

    const decoder = new TextDecoder('utf-8');
    const ab = decoder.decode(msg.dataArray()!);
    const data = JSON.parse(ab);

    let options = msg.options();
    options = options && JSON.parse(options);
  
    const conn = dbConnection.connection();
    const result: r.WriteResult =
      await collections.get(collection).table.insert(data, options || {}).run(conn);
  
    const {first_error, generated_keys, ...other} = result;
    const res: Object[] = [];
    if (generated_keys) {
      other['id'] = generated_keys;
    }
    if (first_error) {
      throw new Error((first_error as any));
    } else {
      res.push(other);
    }
    send({
      done: true,
      data: res
    });
  } catch (e) {
    errorHandle(e.message);
  }
  
}