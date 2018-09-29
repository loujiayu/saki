import * as r from 'rethinkdb';
import { makeQuery } from './makeQuery';
import * as fbs from '../msg_generated';
import Request from '../request';

export async function watch(request: Request) {
  try {
    const msg = new fbs.Query();
    request.reqBase.msg(msg);
    const collection = msg.collection();
    request.collection = collection!;

    const valid = request.client.validate(request.reqBase, collection!);

    if (!valid)
      return request.sendError(`watch in table ${collection} is not allowed`);

    const {dbConnection, collections} = request.client.server;
    const conn = dbConnection.connection();
    const res: r.Cursor = await (makeQuery(msg, collections) as any).changes({
      includeInitial: true,
      includeStates: false,
      squash: false,
      changefeedQueueSize: 100000,
      includeOffsets: false,
      includeTypes: true
    }).run(conn);
    (res as any).eachAsync(item => {
      request.sendData({data: [item]})
    })
    return () => {
      if (res) {
        res.close();
      }
    }
  } catch (e) {
    return request.sendError(e.message)
  }
}