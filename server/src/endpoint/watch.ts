import * as r from 'rethinkdb';
import { makeQuery } from './makeQuery';

export async function watch(rawRequest, collections, send, errorHandle, dbConnection) {
  try {
    const { collection } = rawRequest;
    const conn = dbConnection.connection();
    const res: r.Cursor = await (makeQuery(rawRequest, collections) as any).changes({
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
      send({state: 'complete'});
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