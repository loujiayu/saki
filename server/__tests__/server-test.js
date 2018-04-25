const http = require('http');
const path = require('path');
const r = require('rethinkdb');
const root = path.resolve(__dirname, '../..');
const SakiServer = require(path.resolve(root, 'server/lib/Saki'));

const db = {
  name: 'newa',
  port: 28015,
  host: '127.0.0.1'
};
let conn;

let server;
const rethinkTestTable = r.table('test');

beforeAll(() => {
  return SakiServer.createServer(http.createServer().listen(8000), {
    projectName: db.name,
    rdbPort: db.port,
    rdbHost: db.host,
    rules: ['test']
  }).then(s => {
    server = s;
    conn = s.dbConnection.connection();
    return rethinkTestTable.delete().run(conn);
  }).catch(e => console.log('connecting error occur', e));
});

afterAll(() => {
  return rethinkTestTable.delete().run(conn)
    .then(() => {
      server.close();
    });
});

describe('invalid server request', () => {
  const mockRequest = {
    internal: { user: 'john' },
    options: { selector: 'selector' }
  };
  let mockSendResponse;
  let mockSendError;
  beforeEach(() => {
    mockSendResponse = jest.fn((id, data) => { });
    mockSendError = jest.fn((id, error) => { });
    server.__proto__.sendResponse = mockSendResponse;
    server.__proto__.sendError = mockSendError;
  });

  test('rule', () => {
    expect(server.validate('update', 'test', mockRequest)).toBe(true);
  });

  test('handle request unsubscribe', () => {
    server.handleRequest({ type: 'unsubscribe' });
    expect(mockSendResponse).toHaveBeenCalledTimes(0);
  });

  test('handle request unvalid request', () => {
    server.handleRequest({ requestId: 0 });
    expect(mockSendError).toBeCalledWith(0, 'unvalid request');
  });

  test('handle request unknown endpoint', () => {
    server.handleRequest(Object.assign({}, { requestId: 0, type: 'unknown' }, mockRequest));
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
    server.__proto__.sendResponse = mockSendResponse;
    server.__proto__.sendError = mockSendError;
  });
  afterEach(() => {
    return rethinkTestTable.get(testID).delete().run(conn);
  });
  test('insert one', done => {
    server.handleRequest({
      type: 'insert',
      internal: { user: null },
      options: { collection: 'test', data: { id: testID, name: 'john' } }
    }).then(() => {
      expect(mockSendResponse.mock.calls[0][1].data[0].inserted).toBe(1);
      done();
    });
  });
  test('duplicate primary key', done => {
    server.handleRequest({
      type: 'insert',
      internal: { user: null },
      options: { collection: 'test', data: { id: testID } }
    }).then(() => {
      return server.handleRequest({
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
    server.handleRequest({
      type: 'insert',
      internal: { user: null },
      options: { collection: 'test', data: { id: testID, name: 'john' } }
    }).then(() => {
      return server.handleRequest({
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
    server.__proto__.sendResponse = mockSendResponse;
    server.__proto__.sendError = mockSendError;
    return rethinkTestTable.insert({
      id: testID,
      name: 'john'
    }).run(conn);
  });
  afterEach(() => {
    return rethinkTestTable.get(testID).delete().run(conn);
  });
  test('find', done => {
    server.handleRequest({
      type: 'query',
      internal: { user: null },
      options: { collection: 'test', selector: testID }
    }).then(() => {
      expect(mockSendResponse.mock.calls[0][1].data[0].id).toBe(testID);
      done();
    });
  });
  test('find with filter', done => {
    server.handleRequest({
      type: 'query',
      internal: { user: null },
      options: { collection: 'test', selector: { name: 'john' } }
    }).then(() => {
      expect(mockSendResponse.mock.calls[0][1].data[0].id).toBe(testID);
      done();
    });
  });
  test('query with wrong id', done => {
    server.handleRequest({
      type: 'query',
      internal: { user: null },
      options: { collection: 'test', selector: 'wrong-id' }
    }).then(() => {
      expect(mockSendResponse.mock.calls[0][1].data).toHaveLength(0);
      done();
    });
  });
  test('query', done => {
    server.handleRequest({
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
    server.__proto__.sendResponse = mockSendResponse;
    server.__proto__.sendError = mockSendError;
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
    return rethinkTestTable.get(testID).delete().run(conn);
  });
  test('limit', done => {
    server.handleRequest({
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
    server.__proto__.sendResponse = mockSendResponse;
    server.__proto__.sendError = mockSendError;
    return rethinkTestTable.insert({
      id: testID,
      name: 'john-remove'
    }).run(conn);
  });
  afterEach(() => {
    return rethinkTestTable.get(testID).delete().run(conn);
  });
  test('remove by id', done => {
    server.handleRequest({
      type: 'remove',
      internal: { user: null },
      options: { collection: 'test', selector: testID }
    }).then(() => {
      expect(mockSendResponse.mock.calls[0][1].data[0].deleted).toBe(1);
      done();
    });
  });
  test('remove by filter', done => {
    server.handleRequest({
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
    server.__proto__.sendResponse = mockSendResponse;
    server.__proto__.sendError = mockSendError;
    return rethinkTestTable.insert({
      id: testID,
      class: { name: 'john', age: 27 }
    }).run(conn);
  });
  afterEach(() => {
    return rethinkTestTable.get(testID).delete().run(conn);
  });
  test('update with id', done => {
    server.handleRequest({
      type: 'update',
      internal: { user: null },
      options: { collection: 'test', selector: testID, data: { class: { name: 'esan' } } }
    }).then(() => {
      expect(mockSendResponse.mock.calls[0][1].data[0].replaced).toBe(1);
      done();
    });
  });
  test('update with filter', done => {
    server.handleRequest({
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
    server.__proto__.sendResponse = mockSendResponse;
    server.__proto__.sendError = mockSendError;
    return rethinkTestTable.insert([{
      id: testID,
      name: 'john-update'
    }, {
      id: testID2,
      name: 'jame'
    }]).run(conn);
  });
  afterEach(() => {
    return rethinkTestTable.get([testID, testID2]).delete().run(conn);
  });
  test('upsert without id error', done => {
    server.handleRequest({
      type: 'upsert',
      internal: { user: null },
      options: { collection: 'test', selector: testID + 'errorid', data: { name: 'pappm' } }
    }).then(() => {
      expect(mockSendError).toHaveBeenCalledTimes(1);
      done();
    });
  });
  test('update matching doc', done => {
    server.handleRequest({
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
    server.__proto__.sendResponse = mockSendResponse;
    server.__proto__.sendError = mockSendError;
    return rethinkTestTable.insert({
      id: testID,
      class: { name: 'john', age: 27 }
    }).run(conn);
  });
  afterEach(() => {
    return rethinkTestTable.get(testID).delete().run(conn);
  });
  test('replace', done => {
    server.handleRequest({
      type: 'replace',
      internal: { user: null },
      options: { collection: 'test', data: { id: testID, class: { name: 'bob' } } }
    }).then(() => {
      expect(mockSendResponse.mock.calls[0][1].data[0].replaced).toBe(1);
      done();
    });
  });
});