import * as http from 'http';
import * as path from 'path';
import * as r from 'rethinkdb';
import * as websocket from 'ws';

import Client from '../src/client';
import { compoundIndexGenerator } from '../src/utils/utils';

const SakiServer = require('../src/saki');

const db = {
  name: 'newa',
  port: 28015,
  host: '127.0.0.1'
};
let conn;
let server;
let client;
const rethinkTestTable = r.table('test');

beforeAll(() => {
  return SakiServer.createServer(http.createServer().listen(8000), {
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
  const mockRequest = {
    internal: { user: 'john' },
    options: { selector: 'selector' }
  };
  let mockSendResponse;
  let mockSendError;
  beforeEach(() => {
    mockSendResponse = jest.fn((id, data) => { });
    mockSendError = jest.fn((id, error) => { });
    client.__proto__.sendResponse = mockSendResponse;
    client.__proto__.sendError = mockSendError;
  });

  test('rule', () => {
    expect(client.validate('update', 'test', mockRequest)).toBe(true);
  });

  test('handle request unsubscribe', () => {
    client.handleRequest({ type: 'unsubscribe' });
    expect(mockSendResponse).toHaveBeenCalledTimes(0);
  });

  test('handle request unvalid request', () => {
    client.handleRequest({ requestId: 0 });
    expect(mockSendError).toBeCalledWith(0, 'unvalid request');
  });

  test('handle request unknown endpoint', () => {
    client.handleRequest(Object.assign({}, { requestId: 0, type: 'unknown' }, mockRequest));
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
  test('insert one', done => {
    client.handleRequest({
      type: 'insert',
      internal: { user: null },
      options: { collection: 'test', data: { id: testID, name: 'john' } }
    }).then(() => {
      expect(mockSendResponse.mock.calls[0][1].data[0].inserted).toBe(1);
      done();
    });
  });
  test('duplicate primary key', done => {
    client.handleRequest({
      type: 'insert',
      internal: { user: null },
      options: { collection: 'test', data: { id: testID } }
    }).then(() => {
      return client.handleRequest({
        type: 'insert',
        internal: { user: null },
        options: { collection: 'test', data: { id: testID } }
      });
    }).then(() => {
      expect(mockSendError).toHaveBeenCalledTimes(1);
      done();
    });
  });
  test('insert optinos', done => {
    client.handleRequest({
      type: 'insert',
      internal: { user: null },
      options: { collection: 'test', data: { id: testID, name: 'john' } }
    }).then(() => {
      return client.handleRequest({
        type: 'insert',
        internal: { user: null },
        options: { collection: 'test', data: { id: testID, name: 'andi' }, options: { conflict: 'replace' } }
      });
    }).then(() => {
      expect(mockSendResponse.mock.calls[1][1].data[0].replaced).toBe(1);
      done();
    });
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
    return rethinkTestTable.insert({
      id: testID,
      name: 'john'
    }).run(conn);
  });
  afterEach(() => {
    return (rethinkTestTable.get(testID) as any).delete().run(conn);
  });
  test('find', done => {
    client.handleRequest({
      type: 'query',
      internal: { user: null },
      options: { collection: 'test', selector: testID }
    }).then(() => {
      expect(mockSendResponse.mock.calls[0][1].data[0].id).toBe(testID);
      done();
    });
  });
  test('find with filter', done => {
    client.handleRequest({
      type: 'query',
      internal: { user: null },
      options: { collection: 'test', selector: { name: 'john' } }
    }).then(() => {
      expect(mockSendResponse.mock.calls[0][1].data[0].id).toBe(testID);
      done();
    });
  });
  test('query with wrong id', done => {
    client.handleRequest({
      type: 'query',
      internal: { user: null },
      options: { collection: 'test', selector: 'wrong-id' }
    }).then(() => {
      expect(mockSendResponse.mock.calls[0][1].data).toHaveLength(0);
      done();
    });
  });
  test('query', done => {
    client.handleRequest({
      type: 'query',
      internal: { user: null },
      options: { collection: 'test' }
    }).then(() => {
      expect(mockSendResponse.mock.calls[0][1].data[0].id).toBe(testID);
      done();
    });
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
    return (rethinkTestTable.get(testID) as any).delete().run(conn);
  });
  test('limit', done => {
    client.handleRequest({
      type: 'query',
      internal: { user: null },
      options: { collection: 'test', limit: 2 }
    }).then(() => {
      expect(mockSendResponse.mock.calls).toHaveLength(3);
      done();
    });
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
  test('remove by id', done => {
    client.handleRequest({
      type: 'remove',
      internal: { user: null },
      options: { collection: 'test', selector: testID }
    }).then(() => {
      expect(mockSendResponse.mock.calls[0][1].data[0].deleted).toBe(1);
      done();
    });
  });
  test('remove by filter', done => {
    client.handleRequest({
      type: 'remove',
      internal: { user: null },
      options: { collection: 'test', selector: { name: 'john-remove' } }
    }).then(() => {
      expect(mockSendResponse.mock.calls[0][1].data[0].deleted).toBe(1);
      done();
    });
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
  test('update with id', done => {
    client.handleRequest({
      type: 'update',
      internal: { user: null },
      options: { collection: 'test', selector: testID, data: { class: { name: 'esan' } } }
    }).then(() => {
      expect(mockSendResponse.mock.calls[0][1].data[0].replaced).toBe(1);
      done();
    });
  });
  test('update with filter', done => {
    client.handleRequest({
      type: 'update',
      internal: { user: null },
      options: { collection: 'test', selector: { class: { name: 'john' } }, data: { class: { name: 'esan' } } }
    }).then(() => {
      expect(mockSendResponse.mock.calls[0][1].data[0].replaced).toBe(1);
      done();
    });
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
  test('upsert without id error', done => {
    client.handleRequest({
      type: 'upsert',
      internal: { user: null },
      options: { collection: 'test', selector: testID + 'errorid', data: { name: 'pappm' } }
    }).then(() => {
      expect(mockSendError).toHaveBeenCalledTimes(1);
      done();
    });
  });
  test('update matching doc', done => {
    client.handleRequest({
      type: 'upsert',
      internal: { user: null },
      options: { collection: 'test', selector: { name: 'john-update' }, data: { name: 'tom', age: 20 } }
    }).then(() => {
      expect(mockSendResponse.mock.calls[0][1].data[0].replaced).toBe(1);
      done();
    });
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
  test('replace', done => {
    client.handleRequest({
      type: 'replace',
      internal: { user: null },
      options: { collection: 'test', data: { id: testID, class: { name: 'bob' } } }
    }).then(() => {
      expect(mockSendResponse.mock.calls[0][1].data[0].replaced).toBe(1);
      done();
    });
  });
});

describe('validate err', () => {
  let testTableName = 'unvalidTable';
  let mockSendError;
  beforeEach(() => {
    mockSendError = jest.fn((id, error) => { });
    client.__proto__.sendError = mockSendError;
  });
  test('validate', () => {
    client.handleRequest({
      type: 'query',
      internal: { user: null },
      options: { collection: testTableName }
    });
    expect(mockSendError).toHaveBeenCalledTimes(1);
  });
});

describe('compound index', () => {
  const changedIndex = ['index1', 'index2'];
  beforeEach(() => {
    return server.changeRules({
      test: {
        indexes: [changedIndex],
        update: () => true,
        insert: () => true,
        remove: () => true,
        fetch: () => true
      }
    });
  });
  beforeAll(() => {
    return server.changeRules({
      test: { 
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
