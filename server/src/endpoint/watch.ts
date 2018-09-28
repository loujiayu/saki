import * as r from 'rethinkdb';
import { makeQuery } from './makeQuery';
import * as fbs from '../msg_generated';

export async function watch(
  base: fbs.Base,
  collections,
  send,
  errorHandle,
  dbConnection,
  validate
) {
  try {
    const msg = new fbs.Query();
    base.msg(msg);
    const collection = msg.collection();
    const valid = validate(base, collection);

    if (!valid)
      return errorHandle(`watch in table ${collection} is not allowed`);

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