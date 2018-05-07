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

describe('auth', () => {
  afterEach(done => {
    sk.logout().subscribe(() => {
      done();
    });
  });
  test('unauthenticated', done => {
    sk.connect('unauthenticated').subscribe(resp => {
      expect(resp).toEqual({method: 'unauthenticated', requestId: 0});
      done();
    });
    // sk.wsSubject.handshake.subscribe({
    //   next: resp => {
        
    //   }
    // });
  });
  // test('server ready', done => {
  //   sk.connect('unauthenticated');
  //   sk.isReady(status => {
  //     expect(status).toBe('ready');
  //     done();
  //   });
  // });
  // test('sign up', done => {
  //   sk.signup({username: 'name', password: 'password'}).subscribe({
  //     next: val => {
  //       expect(val).toMatchObject({
  //         token: true,
  //         user: true
  //       });
  //       done();
  //     }
  //   });
  // });
});

