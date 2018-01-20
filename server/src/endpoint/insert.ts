import * as r from 'rethinkdb';

export async function insert({collection, data, options}, collections, send, errorHandle, dbConnection) {
  try {
    const conn = dbConnection.connection();
    const result: r.WriteResult =
      await collections.get(collection).table.insert(data, options || {}).run(conn)
  
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
      state: 'complete',
      data: res
    })
  } catch (e) {
    errorHandle(e.message)
  }
  
}