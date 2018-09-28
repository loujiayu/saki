import * as r from 'rethinkdb';
import * as fbs from '../msg_generated';
import { decodeToJSObj } from '../utils/utils';

export async function replace(
  base: fbs.Base,
  collections,
  send,
  errorHandle,
  dbConnection,
  validate
) {
  try {
    const msg = new fbs.Insert();
    base.msg(msg);
    const collection = msg.collection();
    console.log(collection);
    const valid = validate(base, collection);
    if (!valid)
      return errorHandle(`replace in table ${collection} is not allowed`);

    const data = decodeToJSObj(msg);

    const conn = dbConnection.connection();
    const result: r.WriteResult =
      await (collections.get(collection).table.get(data.id) as any).replace(data).run(conn);

    const {first_error, ...other} = result;
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