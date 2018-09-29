import Client from './client';
import * as fbs from './msg_generated';
import { flatbuffers } from 'flatbuffers';
import { TextEncoder } from "text-encoding";
import { cleanCache, setCache, getCache } from './services/cache';

export default class Request {
  dispose;
  tmpResultMap: Array<any>;
  collection: string;
  user: string | null;
  cacheHashKey: string;
  cacheKey: string;

  constructor(
    public reqBase: fbs.Base,
    private endpoint: Function,
    public client: Client,
    private id: number
  ) {
    this.tmpResultMap = [];
    this.user = this.reqBase.user();
  }

  sendError(error) {
    this.client.sendError(this.id, error);
  }

  sendData(resp) {
    this.setOrCleanCache(resp);

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
  }

  sendCacheData(data) {
    this.sendData({data, done: true});
  }

  async setOrCleanCache(resp) {
    try {
      const {done, data} = resp;
      if (this.client.server.useCache) {
        if (this.reqBase.msgType() === fbs.Any.Query) {
          if (done) {
            console.log(`set cache ${this.cacheHashKey} ${this.cacheKey}: ${data}`);
            await setCache(this.cacheHashKey, this.cacheKey, data || this.tmpResultMap);
          } else {
            this.tmpResultMap = [...this.tmpResultMap, data];
          }
        } else {
          console.log('clean cache...');
          if (!this.cacheHashKey) {
            this.cacheHashKey = `${this.collection}-${this.reqBase.user()}`
          }
          cleanCache(this.cacheHashKey);
        }
      }
    } catch (error) {
      console.log(error);
    }
  }

  async cache() {
    try {
      if (this.reqBase.msgType() === fbs.Any.Query) {
        const msg = new fbs.Query();
        this.reqBase.msg(msg);
        const collection = msg.collection();
        const user = this.reqBase.user();
        const selector = msg.selector();
        this.cacheHashKey = `${collection}-${user}`;
        this.cacheKey = `${collection}-${selector}`;
        
        console.log(`get cache ${this.cacheHashKey} ${this.cacheKey}`);
        const cacheValue = await getCache(this.cacheHashKey, this.cacheKey);
        console.log(`cache value: ${cacheValue}`);
        if (cacheValue) {
          return cacheValue;
        } else {
          this.tmpResultMap = [];
        }
      }
      return null;
    } catch (error) {
      console.log(error);
    }
  }

  async run() {
    try {
      if (this.client.server.useCache) {
        const cacheValue = await this.cache();
        if (cacheValue) {
          this.sendCacheData(cacheValue);
          return;
        }
      }
      this.dispose = await this.endpoint(this);
      // this.dispose = await this.endpoint(
      //   this.reqBase,
      //   this.client.server.collections,
      //   res => this.sendData(res),
      //   (error: string) => this.client.sendError(this.id, error),
      //   this.client.server.dbConnection,
      //   (base, collection) => this.client.validate(base, collection)
      // );
      return this.dispose;
    } catch (e) {
      this.sendError(e.message);
    }
  }

  close() {
    if (this.dispose) this.dispose();
  }
}