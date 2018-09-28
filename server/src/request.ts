import Client from './client';
import * as fbs from './msg_generated';
import { flatbuffers } from 'flatbuffers';
import { TextEncoder } from "text-encoding";
import { cleanCache, setCache, getCache } from './services/cache';

export interface IRequest {
  type?: string;
  options: IRequestData;
  user: string;
  requestId: number;
  method?: string;
}

export interface IRequestData {
  collection: string;
  data?: Object;
  selector?: Object | string;
  options?: Object;
}

function internalField(field, data, value) {
  if (data[field] && typeof data[field] === 'object') {
    data[field]['_user'] = value;
  }
}

export default class Request {
  dispose;
  tmpResultMap: Array<any>;
  collection: string;
  user: string | null;
  // cacheKey: string;

  constructor(
    private reqBase: fbs.Base,
    private endpoint: Function,
    private client: Client,
    private id: number
  ) {
    this.tmpResultMap = [];

    // this.collection = this.reqBase.options.collection;
    this.user = this.reqBase.user();
    // this.cacheKey = `${this.collection}-${this.user}`;
    // this.handleInternalData();
  }

  // handleInternalData() {
  //   const { user } = this.rawRequest;
  //   if (!user) return;

  //   switch (this.endpoint.name) {
  //     case 'replace':
  //     case 'insert':
  //       internalField('data', this.rawRequest.options, user);
  //       break;
  //     default:
  //       break;
  //   }
  // }

  async sendData(resp) {
    try {
      const {done, data} = resp;
      const builder = new flatbuffers.Builder();

      const encoder = new TextEncoder();
      const d = encoder.encode(JSON.stringify(data || []));
      const dataOffset = fbs.Response.createDataVector(builder, d);

      fbs.Response.startResponse(builder);
      fbs.Response.addData(builder, dataOffset);
      fbs.Response.addDone(builder, done);
      const msg = fbs.Response.endResponse(builder);
      fbs.Base.startBase(builder);
      fbs.Base.addMsg(builder, msg);
      fbs.Base.addMsgType(builder, fbs.Any.Response);
      fbs.Base.addRequestId(builder, this.id);
      builder.finish(fbs.Base.endBase(builder));
      this.client.sendResponse(builder.asUint8Array());
      // if (this.client.server.useCache) {
      //   if (this.rawRequest.type === 'query') {
      //     if (data.state === 'complete') {
      //       await setCache(this.cacheKey, this.rawRequest.options ,data.data || this.tmpResultMap);
      //     } else {
      //       this.tmpResultMap = [...this.tmpResultMap, data.data]
      //     }
      //   } else {
      //     cleanCache(this.cacheKey);
      //   }
      // }
      // this.client.sendResponse(this.id, data);
    } catch (error) {
      console.log(error);
    }
  }

  sendCacheData(data) {
    // this.client.sendResponse(this.id, {state: 'complete', data});
  }

  // async cache() {
  //   try {
  //     if (this.rawRequest.type === 'query') {
  //       const cacheValue = await getCache(this.cacheKey, this.rawRequest.options);
  //       if (cacheValue) {
  //         return cacheValue;
  //       } else {
  //         this.tmpResultMap = [];
  //       }
  //     }
  //     return null;
  //   } catch (error) {
  //     console.log(error);
  //   }
  // }

  async run() {
    try {
      // if (this.client.server.useCache) {
      //   const cacheValue = await this.cache();
      //   if (cacheValue) {
      //     this.sendCacheData(cacheValue);
      //     return;
      //   }
      // }
      this.dispose = await this.endpoint(
        this.reqBase,
        this.client.server.collections,
        res => this.sendData(res),
        (error: string) => this.client.sendError(this.id, error),
        this.client.server.dbConnection
      );
      return this.dispose;
    } catch (e) {
      this.client.sendError(this.id, e.message);
    }
  }

  close() {
    if (this.dispose) this.dispose();
  }
}