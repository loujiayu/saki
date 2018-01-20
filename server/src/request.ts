import { Server } from './server';

export interface IInternalRequest {
  user: string;
}

export interface IRequest {
  type?: string;
  options?: IRequestData;
  internal?: IInternalRequest,
  requestId: number,
  method?: string
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
  constructor(
    private rawRequest: IRequest,
    private endpoint: Function,
    private server: Server,
    private id: number
  ) {
    this.handleInternalData();
  }

  handleInternalData() {
    if (!this.rawRequest.internal || !this.rawRequest.internal.user) return;

    const { user } = this.rawRequest.internal;
    switch (this.endpoint.name) {
      case 'replace':
      case 'insert':
        internalField('data', this.rawRequest.options, user);
        break;
      default:
        break;
    }
  }

  async run() {
    try {
      this.dispose = await this.endpoint(
        this.rawRequest.options,
        this.server.collections,
        res => this.server.sendResponse(this.id, res),
        (error: string) => this.server.sendError(this.id, error),
        this.server.dbConnection
      );
      return this.dispose;
    } catch (e) {
      this.server.sendError(this.id, e.message)
    }
  }

  close() {
    if (this.dispose) this.dispose();
  }
}