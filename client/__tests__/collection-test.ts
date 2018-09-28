import * as http from 'http';

import Saki from '../src/index';
import * as fbs from '../src/msg_generated';

const SakiServer = require('../../server/src/saki');

(global as any).WebSocket = require('ws');

const db = {
  name: 'saki',
  port: 28015,
  host: '127.0.0.1'
};
let server;
const sk = new Saki();

beforeAll(async () => {
  server = await SakiServer.createServer(http.createServer().listen(8000), {
    projectName: db.name,
    rdbPort: db.port,
    rdbHost: db.host,
    rules: ['test']
  })
});

afterAll(() => {
  server.close();
});

describe('auth', () => {
  // afterEach(done => {
  //   sk.logout().subscribe({complete: () => done()});
  // });
  test('unauthenticated', done => {
    sk.connect('unauthenticated').subscribe((resp: fbs.AuthRes) => {
      expect(resp instanceof fbs.AuthRes).toBeTruthy();
      done();
    });
  });
});

