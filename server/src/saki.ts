const SakiServer = require('./server');

module.exports = SakiServer.default ? SakiServer.default : SakiServer;