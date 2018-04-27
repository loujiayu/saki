const http = require('http');
const fs = require('fs');
const url = require('url');
const path = require('path');

const SakiServer = require('../lib/saki');
const db = require('./db');

const server = http.createServer((req, res) => {
  const html = fs.readFileSync('./index.html', 'utf8');
  const client = fs.readFileSync('../../client/dist/client.js');
  const sourcemap = fs.readFileSync('../../client/dist/client.js.map');

  const parsedUrl = url.parse(req.url);
  let pathname = `.${parsedUrl.pathname}`;

  const mime = {
    './': {type: 'text/html', content: html},
    '.js': {type: 'text/javascript', content: client},
    '.map': {type: 'text/plain', content: sourcemap}
  }
  const ext = path.parse(pathname).ext;
  const {type, content} = mime[ext] || mime['./'];
  res.setHeader('Content-type', type);
  res.end(content);
}).listen(8100);

SakiServer.createServer(server, {
  projectName: db.name,
  rdbPort: db.port,
  rdbHost: db.host,
  rules: {
    'test': {
      update: () => true,
      insert: () => true,
      remove: () => true,
      fetch: () => true
    },
    "projects": {
      update: () => true,
      insert: () => true,
      remove: () => true,
      fetch: () => true
    }
  }
});