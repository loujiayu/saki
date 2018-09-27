import { Observable } from 'rxjs';
import { toArray } from 'rxjs/operators';
import { TextEncoder } from "text-encoding";
import { flatbuffers } from 'flatbuffers';
import * as fbs from './msg_generated';
import { invariant } from './utils/utils';

export interface IQuery {
  selector?: Object | string;
  single?: boolean;
  limit?: number;
}

export function errorHandle(builder: flatbuffers.Builder): Observable<any> {
  const observable = this.sendRequest(builder);
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
  
  constructor(private sendRequest, private collection: string, private options: IQuery = {}) {}

  insert(
    doc: Object | Array<Object>,
    options?: Object,
  ): Observable<any> {
    invariant(
      doc && (doc.constructor.name === 'Object' || Array.isArray(doc)),
      `insert arguments must be Object or Array, got: ${doc}`
    );

    const builder = new flatbuffers.Builder();
    const encoder = new TextEncoder();
    const docOffset = fbs.Insert.createDataVector(builder, encoder.encode(JSON.stringify(doc)))
    const collection_ = builder.createString(this.collection);
    let options_;
    if (options) {
      options_ = builder.createString(JSON.stringify(options));
    }
    fbs.Insert.startInsert(builder);
    fbs.Insert.addData(builder, docOffset);
    fbs.Insert.addCollection(builder, collection_);
    if (options) {
      fbs.Insert.addOptions(builder, options_);
    }
    const msg = fbs.Insert.endInsert(builder);

    fbs.Base.startBase(builder);
    fbs.Base.addMsg(builder, msg);
    fbs.Base.addMsgType(builder, fbs.Any.Insert);

    return errorHandle.call(this, builder);
  }

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
    const {limit, selector, single = false} = this.options;
    const builder = new flatbuffers.Builder();
    const collection_ = builder.createString(this.collection);

    let selector_;
    if (selector) {
      selector_ = builder.createString(JSON.stringify(selector));
    }
    fbs.Query.startQuery(builder);
    fbs.Query.addCollection(builder, collection_);
    fbs.Query.addSingle(builder, single);
    if (limit) {
      fbs.Query.addLimit(builder, limit);
    }
    if (selector) {
      fbs.Query.addSelector(builder, selector_)
    }
    const msg = fbs.Query.endQuery(builder);

    fbs.Base.startBase(builder);
    fbs.Base.addMsg(builder, msg);
    fbs.Base.addMsgType(builder, fbs.Any.Query);

    return this.sendRequest(builder);
  }

  // watch() {
  //   const raw = this.sendRequest('watch', this.query);
  //   return raw;
  // }

  find(selector: string | Object): Collection {
    return new Collection(this.sendRequest, this.collection, {...this.options, selector});
  }

  findOne(selector: string | Object): Collection {
    return new Collection(this.sendRequest, this.collection, {...this.options, selector, single: true});
  }

  limit(count: number): Collection {
    return new Collection(this.sendRequest, this.collection, {...this.options, limit: count});
  }
}