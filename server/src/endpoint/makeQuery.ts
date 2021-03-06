import * as r from 'rethinkdb';
import { compoundIndexGenerator, arraysEqual } from '../utils/utils';
import * as fbs from '../msg_generated';

function find(query, selector, indexes) {
  if (typeof selector === 'string') {
    return query.get(selector);
  } else if (typeof selector === 'object') {
    if (indexes) {
      const keys = Object.keys(selector);
      let values;
      const useIndex = indexes.some(index => {
        if (Array.isArray(index)) {
          const flag: boolean = arraysEqual(index.sort(), keys.sort());
          if (flag) {
            values = index.map(i => selector[i]);
          }
          return flag;
        }
        return false;
      });
      if (useIndex) {
        return query.getAll(values, {index: compoundIndexGenerator(keys)});
      }
    }

    return query.filter(selector);
  } else {
    return query;
  }
}

export function makeQuery(msg: fbs.Query, collections): r.Operation<any> {
  const collection = msg.collection();
  const single = msg.single();
  const limit = single ? 1 : msg.limit();
  let selector = msg.selector();
  if (selector) {
    selector = JSON.parse(selector);
  }

  let query = collections.get(collection).table;
  if (selector) {
    query = find(query, selector, collections.get(collection).indexes);
  }
  if (limit) {
    query = query.limit(limit);
  }
  return query;
}
