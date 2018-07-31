module.exports = {
  setupFiles: [require.resolve('./setupEnvironment.js')],
  setupTestFrameworkScriptFile: require.resolve('./setup.js'),
  testRegex: '/__tests__/[^/]*(\\.ts)$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    "^.+\\.ts$": "ts-jest"
  },
  rootDir: process.cwd()
};
