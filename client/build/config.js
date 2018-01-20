const path = require('path');
const commonjs = require('rollup-plugin-commonjs');
const filesize = require('rollup-plugin-filesize');
const replace = require('rollup-plugin-replace');
const node = require('rollup-plugin-node-resolve');

const builds = {
  'web-dev': {
    entry: path.resolve('lib', 'index.js'),
    dest: path.resolve('dist', 'client.js'),
    format: 'umd',
    env: 'development'
  }
};

function getConfig(name) {
  const opts = builds[name];

  const config = {
    input: opts.entry,
    plugins: [
      filesize(),
      node(),
      commonjs({include: 'node_modules/**'})
    ].concat(opts.plugins || []),
    output: {
      file: opts.dest,
      format: opts.format,
      sourcemap: true,
      name: 'Saki'
    }
  };

  if (opts.env) {
    config.plugins.push(replace({
      'process.env.NODE_ENV': JSON.stringify(opts.env)
    }));
  }

  return config;
}

if (process.env.TARGET) {
  module.exports = getConfig(process.env.TARGET);
} else {
  module.exports.getBuild = getConfig;
  module.exports.getAllBuilds = () => Object.keys(builds).map(getConfig);
}
