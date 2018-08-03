import * as r from 'rethinkdb';
import { compoundIndexGenerator, arraysEqual } from '../utils/utils';

function find(query, selector, indexes) {
  if (typeof selector === 'string') {
    return query.get(selector);
  } else if (typeof selector === 'object') {
    // const keys = Object.keys(selector);
    // const useIndex = indexes.some(index => {
    //   if (Array.isArray(index)) {
    //     return arraysEqual(index.sort(), keys.sort());
    //   }
    //   return false;
    // });
    // // console.log(useIndex);
    // if (useIndex) {
    //   return query.getAll(keys, {index: compoundIndexGenerator(keys)});
    // }

    return query.filter(selector);
  } else {
    return query;
  }
}

export function makeQuery(rawRequest, collections): r.Operation<any> {
  const {
    collection,
    selector,
    limit
  } = rawRequest;
  let query = collections.get(collection).table;
  if (selector) {
    query = find(query, selector, collections.get(collection).indexes);
  }
  if (limit) {
    query = query.limit(limit);
  }
  return query;
}
