import { makeQuery } from './makeQuery';

export async function query(rawRequest, collections, send, errorHandle, dbConnection) {
  try {
    const conn = dbConnection.connection();
    const result = await makeQuery(rawRequest, collections).run(conn);
    if (result !== null) {
      if (result.constructor.name === 'Cursor') {
        await result.eachAsync(item => {
          send({data: [item]});
        })
        send({state: 'complete'});
      } else if (result.constructor.name === 'Array') {
        send({ data: result, state: 'complete' });
      } else {
        send({ data: [result], state: 'complete' });
      }
    } else {
      send({ data: [], state: 'complete'});
    }
  } catch (e) {
    errorHandle(e.message);
  }
}
