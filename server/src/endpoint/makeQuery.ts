import * as r from 'rethinkdb';

function find(query, selector) {
  if (typeof selector === 'string') {
    return query.get(selector);
  } else if (typeof selector === 'object') {
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
    query = find(query, selector);
  }
  if (limit) {
    query = query.limit(limit);
  }
  return query;
}
