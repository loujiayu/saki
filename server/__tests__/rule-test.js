const path = require('path');
const root = path.resolve(__dirname, '..');
const { parseRules } = require(path.resolve(root, 'lib/utils/utils'));

describe('rules', () => {
  test('throws when argument is undefined', () => {
    expect(() => parseRules()).toThrow();
  });
  
  test('throws when argument is number', () => {
    expect(() => parseRules(1)).toThrow();
  });
  
  test('throws when rule is not object', () => {
    expect(() => parseRules({
      test: { update: [] }
    })).toThrow();
  });
  
  test('alow all operation by defaut', () => {
    let rules = parseRules(['test']).test;
    expect(rules.update()).toBeTruthy();
    expect(rules.remove()).toBeTruthy();
    expect(rules.insert()).toBeTruthy();
    expect(rules.fetch()).toBeTruthy();
  
    rules = parseRules({
      test: {update: () => false}
    }).test;
    expect(rules.update()).not.toBeTruthy();
    expect(rules.remove()).toBeTruthy();
  });
})

