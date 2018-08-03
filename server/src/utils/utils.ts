import { IRule } from '../server';

export const indexSeparator = '_saki_index_separator_';

export function invariant(check: boolean, message: string) {
  if (!check)
      throw new Error(message);
}

export function arraysEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length != b.length) return false;

  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function parseRules(
  rules: { [key: string]: IRule } | Array<string>
): { [key: string]: IRule } {
  invariant(
    !!rules,
    `rules must be defined, got: ${rules}`
  );
  const operations = {
    update: () => true,
    insert: () => true,
    remove: () => true,
    fetch: () => true
  };
  if (Array.isArray(rules)) {
    return rules.reduce((result, value) => {
      result[value] = operations;
      return result;
    }, {});
  }
  invariant(
    rules.constructor.name === 'Object',
    `rules must be Object, got: ${rules}`
  );
  for (const rule in rules) {
    if (rules.hasOwnProperty(rule)) {
      invariant(
        rules[rule].constructor.name === 'Object',
        `rule must be object, got: ${rules[rule]}`
      );
      for (const op in operations) {
        if (rules[rule][op]) {
          invariant(
            typeof rules[rule][op] === 'function',
            `${op} must be function, got: ${rules[rule][op]}`
          );
        }
      }
      rules[rule] = Object.assign({}, operations, rules[rule]);
    }
  }
  return rules;
}

export function compoundIndexGenerator(indexArray: Array<string>): string {
  if (indexArray.length === 1) {
    return indexArray[0];
  }
  return indexArray.join(indexSeparator);
}