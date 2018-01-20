import * as r from 'rethinkdb';

export async function replace({collection, data}, collections, send, errorHandle, dbConnection) {
  try {
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
      state: 'complete',
      data: res
    })
  } catch (e) {
    errorHandle(e.message)
  }
}