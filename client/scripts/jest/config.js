module.exports = {
  setupFiles: [require.resolve('./setupEnvironment.js')],
  testRegex: '/__tests__/[^/]*(\\.js)$',
  rootDir: process.cwd()
};
