import * as path from 'path';
import * as http from 'http';

import Saki from '../src/index';

const SakiServer = require('../../server/src/saki');

(global as any).WebSocket = require('ws');

const db = {
  name: 'newa',
  port: 28015,
  host: '127.0.0.1'
};
let server;
const sk = new Saki();

beforeAll(() => {
  return SakiServer.createServer(http.createServer().listen(8000), {
    projectName: db.name,
    rdbPort: db.port,
    rdbHost: db.host,
    rules: ['test']
  }).then(s => {
    server = s;
  });
});

afterAll(() => {
  server.close();
});

describe('unauthenticated', () => {
  beforeEach(() => {
    sk.connect('unauthenticated');
  });
  test('unauthenticated', done => {
    sk.wsSubject.handshake.subscribe({
      next: resp => {
        expect(resp).toEqual({method: 'unauthenticated', requestId: 0});
        done();
      }
    });
  });
  test('server ready', done => {
    sk.isReady(status => {
      expect(status).toBe('ready');
      done();
    });
  });
});
