import * as r from 'rethinkdb';
import { makeQuery } from './makeQuery';
import * as fbs from '../msg_generated';

export async function watch(base: fbs.Base, collections, send, errorHandle, dbConnection) {
  try {
    const msg = new fbs.Query();
    base.msg(msg);
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
      send({data: [item]})
    }).then(() => {
      send({done: true});
    })
    return () => {
      if (res) {
        res.close();
      }
    }
  } catch (e) {
    return errorHandle(e.message)
  }
}