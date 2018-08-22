import Client from './client';
import { cleanCache, setCache, getCache, mockCache } from './services/cache';

export interface IInternalRequest {
  user: string;
}

export interface IRequest {
  type?: string;
  options: IRequestData;
  internal: IInternalRequest;
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
  user: string | undefined;
  cacheKey: string;

  constructor(
    private rawRequest: IRequest,
    private endpoint: Function,
    private client: Client,
    private id: number
  ) {
    this.tmpResultMap = [];

    this.collection = this.rawRequest.options.collection;
    this.user = this.rawRequest.internal.user;
    this.cacheKey = `${this.collection}-${this.user}`;
    this.handleInternalData();
  }

  handleInternalData() {
    const { user } = this.rawRequest.internal;
    if (!user) return;

    switch (this.endpoint.name) {
      case 'replace':
      case 'insert':
        internalField('data', this.rawRequest.options, user);
        break;
      default:
        break;
    }
  }

  sendData(data) {
    if (this.client.server.useCache) {
      if (this.rawRequest.type === 'query') {
        if (data.state === 'complete') {
          setCache(this.cacheKey, data.data || this.tmpResultMap);
        } else {
          this.tmpResultMap = [...this.tmpResultMap, data.data]
        }
      } else {
        cleanCache(this.cacheKey);
      }
    }
    this.client.sendResponse(this.id, data);
  }

  sendCacheData(data) {
    this.client.sendResponse(this.id, {state: 'complete', data});
  }

  cache() {
    if (this.rawRequest.type === 'query') {
      const cacheValue = getCache(this.cacheKey);
      if (cacheValue) {
        return cacheValue;
      } else {
        this.tmpResultMap = [];
      }
    }
    return null;
  }

  async run() {
    try {
      if (this.client.server.useCache) {
        const cacheValue = this.cache();
        if (cacheValue) {
          this.sendCacheData(cacheValue);
          return;
        }
      }
      this.dispose = await this.endpoint(
        this.rawRequest.options,
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