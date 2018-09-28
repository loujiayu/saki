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
  return this.sendRequest(builder);
  // const handler = Observable.create(subscriber => {
  //   observable.subscribe(
  //     resp => {
  //       if (resp.error()) {
  //         subscriber.error(new Error(resp.error()));
  //       } else {
  //         subscriber.next(resp);
  //       }
  //     },
  //     err => {
  //       subscriber.error(err);
  //     },
  //     resp => subscriber.complete(resp)
  //   );
  // });
  // const sub = handler.subscribe({
  //   error: () => {}
  // });

  // return handler;
}

function createDataVector(
  buffer,
  builder: flatbuffers.Builder,
  doc: Object | Array<Object>,
): flatbuffers.Offset {
  const encoder = new TextEncoder();
  return buffer.createDataVector(builder, encoder.encode(JSON.stringify(doc)));
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
    const docOffset = createDataVector(fbs.Insert, builder, doc);
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

  upsert(selector: Object, doc: Object) {
    invariant(
      selector &&
      (selector.constructor.name === 'Object' || typeof selector === 'string'),
      `upsert selector must be Object or String, got: ${selector}`
    );
    invariant(
      doc && doc.constructor.name === 'Object',
      `upsert arguments must be Object, got: ${doc}`
    );
    const builder = new flatbuffers.Builder();
    const docOffset = createDataVector(fbs.Upsert, builder, doc);
    const collection_ = builder.createString(this.collection);
    const selector_ = builder.createString(JSON.stringify(selector));
    fbs.Upsert.startUpsert(builder);
    fbs.Upsert.addCollection(builder, collection_);
    fbs.Upsert.addData(builder, docOffset);
    fbs.Upsert.addSelector(builder, selector_);
    const msg = fbs.Upsert.endUpsert(builder);

    fbs.Base.startBase(builder);
    fbs.Base.addMsg(builder, msg);
    fbs.Base.addMsgType(builder, fbs.Any.Upsert);

    return errorHandle.call(this, builder);
  }

  replace(doc: Object) {
    invariant(
      doc && doc.constructor.name === 'Object',
      `replaced arguments must be Object, got: ${doc}`
    );
    invariant(
      doc.hasOwnProperty('id'),
      `replaced arguments must have primary key id, got: ${doc}`
    );
    const builder = new flatbuffers.Builder();
    const docOffset = createDataVector(fbs.Replace, builder, doc);
    const collection_ = builder.createString(this.collection);
    fbs.Replace.startReplace(builder);
    fbs.Replace.addCollection(builder, collection_);
    fbs.Replace.addData(builder, docOffset);
    const msg = fbs.Replace.endReplace(builder);

    fbs.Base.startBase(builder);
    fbs.Base.addMsg(builder, msg);
    fbs.Base.addMsgType(builder, fbs.Any.Replace);

    return errorHandle.call(this, builder);
  }

  update(selector: Object, doc: Object): Observable<any> {
    invariant(
      selector &&
      (selector.constructor.name === 'Object' || typeof selector === 'string'),
      `upsert selector must be Object or String, got: ${selector}`
    );
    invariant(
      doc && doc.constructor.name === 'Object',
      `upsert arguments must be Object, got: ${doc}`
    );

    const builder = new flatbuffers.Builder();
    const docOffset = createDataVector(fbs.Update, builder, doc);
    const collection_ = builder.createString(this.collection);
    const selector_ = builder.createString(JSON.stringify(selector));
    fbs.Update.startUpdate(builder);
    fbs.Update.addCollection(builder, collection_);
    fbs.Update.addData(builder, docOffset);
    fbs.Update.addSelector(builder, selector_);
    const msg = fbs.Update.endUpdate(builder);

    fbs.Base.startBase(builder);
    fbs.Base.addMsg(builder, msg);
    fbs.Base.addMsgType(builder, fbs.Any.Update);

    return errorHandle.call(this, builder);
  }

  remove(selector: string | Object | null): Observable<any> {
    let selector_;
    const builder = new flatbuffers.Builder();
    if (selector) {
      selector_ = builder.createString(JSON.stringify(selector));
    }
    const collection_ = builder.createString(this.collection);

    fbs.Remove.startRemove(builder);
    fbs.Remove.addCollection(builder, collection_);
    if (selector) {
      fbs.Remove.addSelector(builder, selector_);
    }
    const msg = fbs.Remove.endRemove(builder);
    fbs.Base.startBase(builder);
    fbs.Base.addMsg(builder, msg);
    fbs.Base.addMsgType(builder, fbs.Any.Remove);

    return errorHandle.call(this, builder);
  }

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

  watch() {
    const builder = new flatbuffers.Builder();
    const collection_ = builder.createString(this.collection);
    fbs.Watch.startWatch(builder);
    fbs.Watch.addCollection(builder, collection_);
    const msg = fbs.Watch.endWatch(builder);

    fbs.Base.startBase(builder);
    fbs.Base.addMsg(builder, msg);
    fbs.Base.addMsgType(builder, fbs.Any.Watch);

    return this.sendRequest(builder);
  }

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