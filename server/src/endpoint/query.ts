import { makeQuery } from './makeQuery';
import * as fbs from '../msg_generated';
import Request from '../request';

export async function query(request: Request) {
  try {
    const msg = new fbs.Query();
    request.reqBase.msg(msg);
    const collection = msg.collection();
    request.collection = collection!;

    const valid = request.client.validate(request.reqBase, collection!);
    if (!valid)
      return request.sendError(`query in table ${collection} is not allowed`);

    const {dbConnection, collections} = request.client.server;

    const conn = dbConnection.connection();
    const result = await makeQuery(msg, collections).run(conn);
    if (result !== null) {
      if (result.constructor.name === 'Cursor') {
        await result.eachAsync(item => {
          request.sendData({data: item});
        })
        request.sendData({done: true});
      } else {
        request.sendData({ data: result, done: true });
      }
    } else {
      request.sendData({ done: true});
    }
  } catch (e) {
    request.sendError(e.message);
  }
}
