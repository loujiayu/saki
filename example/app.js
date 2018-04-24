const http = require('http');
const fs = require('fs');
const url = require('url');
const path = require('path');

const {Server: SakiServer} = require('../server/lib/Saki');
const db = require('./db');

// process.on('uncaughtException', (err) => {
//   console.log(err);
//   console.log(err.stack);
// })

const server = http.createServer((req, res) => {
  const html = fs.readFileSync('./index.html', 'utf8');
  const client = fs.readFileSync('../client/dist/client.js');
  const sourcemap = fs.readFileSync('../client/dist/client.js.map');

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

server.on('error', error => {
  console.log(error);
})

const Saki = new SakiServer(server, {
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