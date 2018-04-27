module.exports = {
  testRegex: '/__tests__/[^/]*(\\.ts)$',
  transform: {
    "^.+\\.ts$": "ts-jest"
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  rootDir: process.cwd()
};
