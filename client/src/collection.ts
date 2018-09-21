import { Observable } from 'rxjs';
import { toArray } from 'rxjs/operators';
import { flatbuffers } from 'flatbuffers';
import * as fbs from './msg_generated';
import { invariant } from './utils/utils';

export interface IQuery {
  collection: string;
  selector?: Object | string;
  single?: boolean;
  limit?: number;
}

export function errorHandle(name: string, req: Object): Observable<any> {
  const observable = this.sendRequest(name, req);
  const handler = Observable.create(subscriber => {
    observable.subscribe(
      resp => {
        if (resp.error) {
          subscriber.error(new Error(resp.error));
        } else {
          subscriber.next(resp);
        }
      },
      err => {
        subscriber.error(err);
      },
      resp => subscriber.complete(resp)
    );
  });
  const sub = handler.subscribe({
    error: () => {}
  });

  return handler;
}

export class Collection {
  builder: flatbuffers.Builder;
  query: IQuery;
  
  constructor(private sendRequest, private collection: string) {
    this.builder = new flatbuffers.Builder();
    // fbs.Query.addCollection(this.builder, this.builder.createString(collection));
    // if (typeof collectionOrSelector === 'string')
    //   this.query = {collection: collectionOrSelector};
    // else {
    //   this.query = collectionOrSelector;
    // }
  }

  // insert(
  //   doc: Object,
  //   options?: Object,
  // ): Observable<any> {
  //   invariant(
  //     doc && doc.constructor.name === 'Object',
  //     `insert arguments must be Object, got: ${doc}`
  //   );

  //   const req = Object.assign({}, this.query, { data: doc });
  //   if (options) {
  //     req['options'] = options;
  //   }
  //   return errorHandle.call(this, 'insert', req);
  // }

  // upsert(selector: Object, doc: Object) {
  //   invariant(
  //     selector &&
  //     (selector.constructor.name === 'Object' || typeof selector === 'string'),
  //     `upsert selector must be Object or String, got: ${selector}`
  //   );
  //   invariant(
  //     doc && doc.constructor.name === 'Object',
  //     `upsert arguments must be Object, got: ${doc}`
  //   );
  //   const req = Object.assign({}, this.query, { selector, data: doc });
  //   return errorHandle.call(this, 'upsert', req);
  // }

  // replace(doc: Object) {
  //   invariant(
  //     doc && doc.constructor.name === 'Object',
  //     `replaced arguments must be Object, got: ${doc}`
  //   );
  //   invariant(
  //     doc.hasOwnProperty('id'),
  //     `replaced arguments must have primary key id, got: ${doc}`
  //   );
  //   const req = Object.assign({}, this.query, {data: doc});
  //   return errorHandle.call(this, 'replace', req);
  // }

  // update(selector: Object, doc: Object): Observable<any> {
  //   invariant(
  //     selector &&
  //     (selector.constructor.name === 'Object' || typeof selector === 'string'),
  //     `upsert selector must be Object or String, got: ${selector}`
  //   );
  //   invariant(
  //     doc && doc.constructor.name === 'Object',
  //     `upsert arguments must be Object, got: ${doc}`
  //   );
    
  //   const req = Object.assign({}, this.query, { selector, data: doc });
  //   return errorHandle.call(this, 'update', req);
  // }

  // remove(selector: string | Object | null): Observable<any> {
  //   const req = Object.assign({}, this.query);
  //   if (selector) {
  //     req['selector'] = selector;
  //   }
  //   return errorHandle.call(this, 'remove', req);
  // }

  fetch() {
    fbs.Query.startQuery(this.builder);
    fbs.Query.addCollection(this.builder, this.builder.createString(this.collection));
    const msg = fbs.Query.endQuery(this.builder);

    fbs.Base.startBase(this.builder);
    fbs.Base.addMsg(this.builder, msg);
    fbs.Base.addMsgType(this.builder, fbs.Any.Query);
    // this.builder.finish(fbs.Base.endBase(this.builder));

    const raw = this.sendRequest(this.builder);
    return raw.pipe(toArray);
    // if (this.query.single) {
    //   return raw;
    // } else {
    //   return raw.pipe(toArray());
    // }
  }

  // watch() {
  //   const raw = this.sendRequest('watch', this.query);
  //   return raw;
  // }

  // find(selector: string | Object): Collection {
  //   return new Collection(this.sendRequest, {...this.query, selector});
  // }

  // findOne(selector: string | Object): Collection {
  //   return new Collection(this.sendRequest, {...this.query, selector, single: true});
  // }

  // limit(count: number): Collection {
  //   return new Collection(this.sendRequest, {...this.query, limit: count});
  // }
}