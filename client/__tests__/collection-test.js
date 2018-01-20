const path = require('path');
const http = require('http');

global.WebSocket = require('ws');

const root = path.resolve(__dirname, '../..');
const Saki = require(path.resolve(root, 'client/dist/client'));
const SakiServer = require(path.resolve(root, 'server/lib/saki')).Server;
const db = {
  name: 'newa',
  port: 28015,
  host: '127.0.0.1'
};
const sk = new Saki();
const server = new SakiServer(http.createServer().listen(8000), {
  projectName: db.name,
  rdbPort: db.port,
  rdbHost: db.host,
  rules: {
    'test': {
      update: () => true,
      insert: () => true,
      remove: () => true,
      fetch: () => true
    }
  }
});

beforeAll(() => {
  sk.connect('unauthenticated');
});

afterAll(() => {
  server.close();
});

describe('unauthenticated', () => {
  test('unauthenticated', done => {
    sk.wsSubject.handshake.subscribe({
      next: resp => {
        expect(resp).toEqual({method: 'unauthenticated', requestId: 0});
        done();
      }
    });
  });
});

describe('server status', () => {
  test('server ready', done => {
    sk.isReady(status => {
      expect(status).toBe('ready');
      done();
    });
  });
});
