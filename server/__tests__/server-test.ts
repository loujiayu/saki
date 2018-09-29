import * as http from 'http';
import * as r from 'rethinkdb';
import * as websocket from 'ws';
import { TextEncoder } from "text-encoding";
import { flatbuffers } from 'flatbuffers';

import * as fbs from '../src/msg_generated';
import Client from '../src/client';
import { cleanCache, getCache } from '../src/services/cache';
import { compoundIndexGenerator } from '../src/utils/utils';

const SakiServer = require('../src/saki');

const db = {
  name: 'saki',
  port: 28015,
  host: '127.0.0.1'
};
let conn;
let server;
let client;
const rethinkTestTable = r.table('test');

function createDataVector(
  buffer,
  builder: flatbuffers.Builder,
  doc: Object | Array<Object>,
): flatbuffers.Offset {
  const encoder = new TextEncoder();
  return buffer.createDataVector(builder, encoder.encode(JSON.stringify(doc)));
}

function createInsertBuffer(doc, options?) {
  const builder = new flatbuffers.Builder();
  const docOffset = createDataVector(fbs.Insert, builder, doc);
  const collection_ = builder.createString('test');
  let options_;
  if (options) {
    options_ = builder.createString(JSON.stringify(options));
  }
  fbs.Insert.startInsert(builder);
  fbs.Insert.addData(builder, docOffset);
  fbs.Insert.addCollection(builder, collection_);
  if (options) {
    fbs.Insert.addOptions(builder, options_);
  }
  const msg = fbs.Insert.endInsert(builder);

  fbs.Base.startBase(builder);
  fbs.Base.addMsg(builder, msg);
  fbs.Base.addMsgType(builder, fbs.Any.Insert);
  builder.finish(fbs.Base.endBase(builder));
  return builder.asUint8Array();
}

function createQueryBuffer(selector?, limit?, collection?) {
  const builder = new flatbuffers.Builder();
  const collection_ = builder.createString(collection || 'test');
  let selector_;
  if (selector) {
    selector_ = builder.createString(JSON.stringify(selector));
  }
  fbs.Query.startQuery(builder);
  fbs.Query.addCollection(builder, collection_);
  if (limit) {
    fbs.Query.addLimit(builder, limit);
  }
  if (selector) {
    fbs.Query.addSelector(builder, selector_)
  }
  const msg = fbs.Query.endQuery(builder);
  fbs.Base.startBase(builder);
  fbs.Base.addMsg(builder, msg);
  fbs.Base.addMsgType(builder, fbs.Any.Query);
  builder.finish(fbs.Base.endBase(builder));
  return builder.asUint8Array();
}

function createRemoveBuffer(selector) {
  const builder = new flatbuffers.Builder();
  const collection_ = builder.createString('test');
  let selector_;
  if (selector) {
    selector_ = builder.createString(JSON.stringify(selector));
  }
  fbs.Remove.startRemove(builder);
  fbs.Remove.addCollection(builder, collection_);
  if (selector) {
    fbs.Remove.addSelector(builder, selector_)
  }
  const msg = fbs.Remove.endRemove(builder);
  fbs.Base.startBase(builder);
  fbs.Base.addMsg(builder, msg);
  fbs.Base.addMsgType(builder, fbs.Any.Remove);
  builder.finish(fbs.Base.endBase(builder));
  return builder.asUint8Array();
}

function createUpdateBuffer(selector, doc) {
  const builder = new flatbuffers.Builder();
  const collection_ = builder.createString('test');
  const docOffset = createDataVector(fbs.Update, builder, doc);
  const selector_ = builder.createString(JSON.stringify(selector));
  fbs.Update.startUpdate(builder);
  fbs.Update.addCollection(builder, collection_);
  fbs.Update.addData(builder, docOffset);
  fbs.Update.addSelector(builder, selector_);
  const msg = fbs.Update.endUpdate(builder);

  fbs.Base.startBase(builder);
  fbs.Base.addMsg(builder, msg);
  fbs.Base.addMsgType(builder, fbs.Any.Update);
  builder.finish(fbs.Base.endBase(builder));
  return builder.asUint8Array();
}

function createUpsertBuffer(doc, selector) {
  const builder = new flatbuffers.Builder();
  const docOffset = createDataVector(fbs.Upsert, builder, doc);
  const collection_ = builder.createString('test');
  const selector_ = builder.createString(JSON.stringify(selector));
  fbs.Upsert.startUpsert(builder);
  fbs.Upsert.addCollection(builder, collection_);
  fbs.Upsert.addData(builder, docOffset);
  fbs.Upsert.addSelector(builder, selector_);
  const msg = fbs.Upsert.endUpsert(builder);

  fbs.Base.startBase(builder);
  fbs.Base.addMsg(builder, msg);
  fbs.Base.addMsgType(builder, fbs.Any.Upsert);
  builder.finish(fbs.Base.endBase(builder));
  return builder.asUint8Array();
}

function createReplaceBuffer(doc) {
  const builder = new flatbuffers.Builder();
  const docOffset = createDataVector(fbs.Replace, builder, doc);
  const collection_ = builder.createString('test');
  fbs.Replace.startReplace(builder);
  fbs.Replace.addCollection(builder, collection_);
  fbs.Replace.addData(builder, docOffset);
  const msg = fbs.Replace.endReplace(builder);

  fbs.Base.startBase(builder);
  fbs.Base.addMsg(builder, msg);
  fbs.Base.addMsgType(builder, fbs.Any.Replace);
  builder.finish(fbs.Base.endBase(builder));
  return builder.asUint8Array();
}

beforeAll(() => {
  return SakiServer.createServer(http.createServer().listen(8013), {
    projectName: db.name,
    rdbPort: db.port,
    rdbHost: db.host,
    rules: ['test']
  }).then(s => {
    client = new Client(new websocket(null), s);
    server = s;
    conn = s.dbConnection.connection();
    return rethinkTestTable.delete().run(conn);
  }).catch(e => console.log('connecting error occur', e));
});

afterAll(() => {
  return rethinkTestTable.indexList().run(conn).then(indexArray => {
    return Promise.all(indexArray.map(index => rethinkTestTable.indexDrop(index).run(conn)));
  }).then(() => {
    return rethinkTestTable.delete().run(conn)
      .then(() => {
        server.close();
      });
  });
});

describe('invalid client request', () => {
  let mockSendResponse;
  let mockSendError;
  beforeEach(() => {
    mockSendResponse = jest.fn((id, data) => { });
    mockSendError = jest.fn((id, error) => { });
    client.__proto__.sendResponse = mockSendResponse;
    client.__proto__.sendError = mockSendError;
  });

  test('handle request unsubscribe', () => {
    const builder = new flatbuffers.Builder();
    fbs.Base.startBase(builder);
    fbs.Base.addMsgType(builder, fbs.Any.Unsubscribe);
    builder.finish(fbs.Base.endBase(builder));

    client.handleRequest(builder.asUint8Array());
    expect(mockSendResponse).toHaveBeenCalledTimes(0);
  });

  test('handle request unknown endpoint', () => {
    const builder = new flatbuffers.Builder();
    fbs.Base.startBase(builder);
    builder.finish(fbs.Base.endBase(builder));

    client.handleRequest(builder.asUint8Array());
    expect(mockSendError).toBeCalledWith(0, 'unknown endpoint');
  });
});

describe('insert', () => {
  let testID = 'insert-test-id';
  let mockSendResponse;
  let mockSendError;
  beforeEach(() => {
    mockSendResponse = jest.fn((id, data) => { });
    mockSendError = jest.fn((id, error) => { });
    client.__proto__.sendResponse = mockSendResponse;
    client.__proto__.sendError = mockSendError;
  });
  afterEach(() => {
    return (rethinkTestTable.get(testID) as any).delete().run(conn);
  });
  test('insert one', async () => {
    await client.handleRequest(createInsertBuffer({ id: testID, name: 'john' }))
    expect(mockSendResponse).toHaveBeenCalledTimes(1);
  });
  test('duplicate primary key', async () => {
    await client.handleRequest(createInsertBuffer({ id: testID }));
    await client.handleRequest(createInsertBuffer({ id: testID }));
    expect(mockSendError).toHaveBeenCalledTimes(1);
  });
  test('insert optinos', async () => {
    await client.handleRequest(createInsertBuffer({ id: testID, name: 'john' }));
    await client.handleRequest(createInsertBuffer({ id: testID, name: 'andi' }, { conflict: 'replace' }));
    expect(mockSendResponse).toHaveBeenCalledTimes(2);
  });
});

describe('read', () => {
  let testID = 'read-test-id';
  let mockSendResponse;
  let mockSendError;
  beforeEach(() => {
    mockSendResponse = jest.fn((id, data) => { });
    mockSendError = jest.fn((id, error) => { });
    client.__proto__.sendResponse = mockSendResponse;
    client.__proto__.sendError = mockSendError;
    server.useCache = false;
    return rethinkTestTable.insert({
      id: testID,
      name: 'john'
    }).run(conn);
  });
  afterEach(() => {
    server.useCache = true;
    return (rethinkTestTable.get(testID) as any).delete().run(conn);
  });
  test('find', async () => {
    await client.handleRequest(createQueryBuffer(testID));
    expect(mockSendResponse).toHaveBeenCalledTimes(1);
  });
  test('find with filter', async () => {
    await client.handleRequest(createQueryBuffer({ name: 'john' }));
    expect(mockSendResponse).toHaveBeenCalledTimes(2);
  });
  test('query with wrong id', async () => {
    await client.handleRequest(createQueryBuffer('wrong-id'));
    expect(mockSendResponse).toHaveBeenCalledTimes(1);
  });
});

describe('transformations', () => {
  let testID = 'transform-test-id';
  let mockSendResponse;
  let mockSendError;
  beforeEach(() => {
    mockSendResponse = jest.fn((id, data) => { });
    mockSendError = jest.fn((id, error) => { });
    client.__proto__.sendResponse = mockSendResponse;
    client.__proto__.sendError = mockSendError;
    server.useCache = false;
    return rethinkTestTable.insert([{
      name: 'john',
      age: 25
    }, {
      name: 'bob',
      age: 29
    }, {
      name: 'sam',
      age: 20
    }]).run(conn);
  });
  afterEach(() => {
    server.useCache = true;
    return (rethinkTestTable.get(testID) as any).delete().run(conn);
  });
  test('limit', async () => {
    await client.handleRequest(createQueryBuffer(null, 2));
    expect(mockSendResponse.mock.calls).toHaveLength(3);
  });
});

describe('remove', () => {
  let testID = 'remove-test-id';
  let mockSendResponse;
  let mockSendError;
  beforeEach(() => {
    mockSendResponse = jest.fn((id, data) => { });
    mockSendError = jest.fn((id, error) => { });
    client.__proto__.sendResponse = mockSendResponse;
    client.__proto__.sendError = mockSendError;
    return rethinkTestTable.insert({
      id: testID,
      name: 'john-remove'
    }).run(conn);
  });
  afterEach(() => {
    return (rethinkTestTable.get(testID) as any).delete().run(conn);
  });
  test('remove by id', async () => {
    await client.handleRequest(createRemoveBuffer(testID));
    expect(mockSendResponse).toHaveBeenCalledTimes(1);
  });
  test('remove by filter', async () => {
    await client.handleRequest(createRemoveBuffer({ name: 'john-remove' }));
    expect(mockSendResponse).toHaveBeenCalledTimes(1);
  });
});

describe('update', () => {
  let testID = 'update-test-id';
  let mockSendResponse;
  let mockSendError;
  beforeEach(() => {
    mockSendResponse = jest.fn((id, data) => { });
    mockSendError = jest.fn((id, error) => { });
    client.__proto__.sendResponse = mockSendResponse;
    client.__proto__.sendError = mockSendError;
    return rethinkTestTable.insert({
      id: testID,
      class: { name: 'john', age: 27 }
    }).run(conn);
  });
  afterEach(() => {
    return (rethinkTestTable.get(testID) as any).delete().run(conn);
  });
  test('update with id', async () => {
    await client.handleRequest(createUpdateBuffer(testID, { class: { name: 'esan' } }));
    expect(mockSendResponse).toHaveBeenCalledTimes(1);
  });
  test('update with filter', async () => {
    await client.handleRequest(createUpdateBuffer({ class: { name: 'john' } }, { class: { name: 'esan' } }));
    expect(mockSendResponse).toHaveBeenCalledTimes(1);
  });
});

describe('upsert', () => {
  let testID = 'upsert-test-id';
  let testID2 = 'upsert-test-id2';
  let mockSendResponse;
  let mockSendError;
  beforeEach(() => {
    mockSendResponse = jest.fn((id, data) => { });
    mockSendError = jest.fn((id, error) => { });
    client.__proto__.sendResponse = mockSendResponse;
    client.__proto__.sendError = mockSendError;
    return rethinkTestTable.insert([{
      id: testID,
      name: 'john-update'
    }, {
      id: testID2,
      name: 'jame'
    }]).run(conn);
  });
  afterEach(() => {
    return (rethinkTestTable.get(testID) as any).delete().run(conn)
      .then(() => (rethinkTestTable.get(testID2) as any).delete());
  });
  test('upsert without id error', async () => {
    await client.handleRequest(createUpsertBuffer({name: 'pappm'}, testID + 'errorid'));
    expect(mockSendError).toHaveBeenCalledTimes(1);
  });
  test('update matching doc', async () => {
    await client.handleRequest(createUpsertBuffer({ name: 'tom', age: 20 }, { name: 'john-update' }));
    expect(mockSendResponse).toHaveBeenCalledTimes(1);
  });
});

describe('replace', () => {
  let testID = 'replace-test-id';
  let mockSendResponse;
  let mockSendError;
  beforeEach(() => {
    mockSendResponse = jest.fn((id, data) => { });
    mockSendError = jest.fn((id, error) => { });
    client.__proto__.sendResponse = mockSendResponse;
    client.__proto__.sendError = mockSendError;
    return rethinkTestTable.insert({
      id: testID,
      class: { name: 'john', age: 27 }
    }).run(conn);
  });
  afterEach(() => {
    return (rethinkTestTable.get(testID) as any).delete().run(conn);
  });
  test('replace', async () => {
    await client.handleRequest(createReplaceBuffer({ id: testID, class: { name: 'bob' } }));
    expect(mockSendResponse).toHaveBeenCalledTimes(1);
  });
});

describe('cache', () => {
  let testID = 'cache-test-id';
  let mockSendResponse;
  let mockSendError;

  beforeEach(async () => {
    mockSendResponse = jest.fn((id, data) => { });
    mockSendError = jest.fn((id, error) => { });
    client.__proto__.sendResponse = mockSendResponse;
    client.__proto__.sendError = mockSendError;
    cleanCache('test-null');
    await rethinkTestTable.insert({
      id: testID,
      name: 'john'
    }).run(conn);
  })

  afterEach(() => {
    return (rethinkTestTable.get(testID) as any).delete().run(conn);
  });

  test('remove cache after updating', async () => {
    // const options = { collection: 'test', selector: testID }
    await client.handleRequest(createQueryBuffer(testID));
    const cacheHashKey = 'test-null';
    const cacheKey = `test-${JSON.stringify(testID)}`;
    let cacheValue = await getCache(cacheHashKey, cacheKey);

    expect(cacheValue).toEqual({ id: 'cache-test-id', name: 'john' });

    await client.handleRequest(createUpdateBuffer(testID, { name: 'nane' }));
    cacheValue = await getCache(cacheHashKey, cacheKey);
    expect(cacheValue).toBeNull();
  })
})

describe('validate err', () => {
  let testTableName = 'unvalidTable';
  let mockSendError;
  beforeEach(() => {
    mockSendError = jest.fn((id, error) => { });
    client.__proto__.sendError = mockSendError;
    server.useCache = false;
  });
  afterEach(() => {
    server.useCache = true;
  })
  test('validate', async () => {
    await client.handleRequest(createQueryBuffer(null, null, testTableName));
    expect(mockSendError).toHaveBeenCalledTimes(1);
  });
});

describe('compound index', () => {
  const changedIndex = ['index1', 'index2'];
  beforeEach(async () => {
    await server.changeRules({
      test: {
        indexes: [changedIndex],
        update: () => true,
        insert: () => true,
        remove: () => true,
        fetch: () => true
      }
    });
  });

  test('compound index in db', done => {
    rethinkTestTable.indexList().run(conn, (err, arr) => {
      expect(arr).toEqual(
        expect.arrayContaining([compoundIndexGenerator(changedIndex)]));
      done();
    });
  });
});
