import { makeQuery } from './makeQuery';
import * as fbs from '../msg_generated';

export async function query(base: fbs.Base, collections, send, errorHandle, dbConnection) {
  try {
    const msg = new fbs.Query();
    base.msg(msg);
    const conn = dbConnection.connection();
    const result = await makeQuery(msg, collections).run(conn);
    if (result !== null) {
      if (result.constructor.name === 'Cursor') {
        await result.eachAsync(item => {
          send({data: item});
        })
        send({done: true});
      } else {
        send({ data: result, done: true });
      }
    } else {
      send({ done: true});
    }
  } catch (e) {
    errorHandle(e.message);
  }
}
