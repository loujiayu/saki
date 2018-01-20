const rollup = require('rollup');
const fs = require('fs-extra');
const path = require('path');
const uglify = require('uglify-es');
const ts = require('typescript');

const configs = require('./config').getAllBuilds();

fs.removeSync('dist');

function typeScriptBuild() {
  const tsConfig = path.resolve('tsconfig.json');
  const json = ts.parseConfigFileTextToJson(tsConfig, ts.sys.readFile(tsConfig), true);

  const { options } = ts.parseJsonConfigFileContent(json.config, ts.sys, path.dirname(tsConfig));

  options.importHelpers = true;
  options.noEmitHelpers = true;

  const client = path.resolve('src', 'index.ts');
  
  const host = ts.createCompilerHost(options, true);
  const prog = ts.createProgram([client], options, host);
  const result = prog.emit();

  if (result.emitSkipped) {
    const message = result.diagnostics.map(diagnostic => {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      return `${diagnostic.file.fileName} (${line + 1},${character + 1}) : ${diagnostic.messageText}`;
    }).join('\n');
    throw new Error(`Failed to compile typescript:\n\n${message}`);
  }
}

function rollupBuild(config) {
  const { file } = config.output;
  const minified = /min\.js$/.test(file);
  return rollup.rollup(config)
    .then(bundle => bundle.generate(config.output))
    .then(({ code }) => {
      if (minified) {
        const minifiedCode = uglify.minify(code);
        return write(file, minifiedCode.code);
      } else {
        return write(file, code);
      }
    });
}

function rollupWatch(config) {
  
}

function write(dest, code) {
  return new Promise((resolve, reject) => {
    fs.writeFile(dest, code, err => {
      if (err) return reject(err);
    });
  });
}

function generateBundles() {
  const promises = configs.map(config => rollupBuild(config));
  return Promise.all(promises);
}

function build() {
  typeScriptBuild();
  return generateBundles();
}

build().catch(e => {
  console.error(e);
  process.exit(1);
});