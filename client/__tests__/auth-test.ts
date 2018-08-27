import * as http from 'http';
import Saki from '../src/index';

const SakiServer = require('../../server/src/saki');

(global as any).WebSocket = require('ws');

const db = {
  name: 'saki',
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

describe.skip('login', () => {
  test('login with wrong id', done => {
    sk.login({username: 'name', password: 'wrong'}).subscribe({
      error: error => {
        expect(error).toBe('Authentication failed. User not found.');
        done();
      }
    });
  });
});

describe.skip('sign up', () => {
  test('', done => {
    sk.signup({username: 'name', password: 'password'}).subscribe({
      next: val => {
        expect(val).toHaveProperty('token');
        done();
      }
    });
  });
});
