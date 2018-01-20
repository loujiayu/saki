const path = require('path');
const http = require('http');
const r = require('rethinkdb');

const root = path.resolve(__dirname, '../..');
global.WebSocket = require('ws');

global.db = {
  name: 'newa',
  port: 28015,
  host: '127.0.0.1'
};
const testTable = 'test';

const Sake = require(path.resolve(root, 'client/dist/client'));
const SakeServer = require(path.resolve(root, 'server/lib/sake')).Server;

global.sk = new Sake();
global.server = new SakeServer(http.createServer().listen(8000), {
  projectName: global.db.name,
  rdbPort: global.db.port,
  rdbHost: global.db.host,
  rules: {
    'test': {
      update: () => true,
      insert: () => true,
      remove: () => true,
      fetch: () => true
    }
  }
});

global.rethinkTestTable = r.table(testTable);
global.testCollection = global.sk.collection(testTable);

class localStorageMock {
  constructor() {
    this.store = {};
  }
  setItem(key, value) {
    this.store[key] = value;
  }
  getItem(key) {
    return this.store[key] || null;
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}
global.localStorage = new localStorageMock();