import { Subscription, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { flatbuffers } from 'flatbuffers';

import { Collection } from './collection';
import { Account } from './auth';
import { SakiSocket } from './socket';
import { errorHandle } from './collection';
import * as fbs from './msg_generated';

const defaultHost = typeof window !== 'undefined' && window.location &&
  `${window.location.host}` || 'localhost:8000';
const defaultSecure = typeof window !== 'undefined' && window.location &&
  window.location.protocol === 'https:' || false;

export default class Saki {
  wsSubject: SakiSocket<any>;
  websocketURL: string;
  account: Account;
  authType: string;

  constructor({
    host = defaultHost,
    secure = defaultSecure,
    path = 'saki',
    WebSocketCtor = WebSocket
  } = {}) {
    this.websocketURL = `ws${secure ? 's' : ''}:\/\/${host}\/${path}`;
    this.account = new Account();
    this.wsSubject = new SakiSocket(
      this.websocketURL,
      this.account.handshake.bind(this.account),
      this.account
    );
    this.handshake();
  }

  handshake() {
    this.wsSubject.handshake.subscribe({
      next: resp => {
        if (resp.token && resp.user) {
          this.account.set(resp.user, resp.token);
        }
      },
      error: () => {
        this.logout();
      }
    });
  }

  connect(authType): Subject<any> {
    this.account.setUp(authType);
    const builder = new flatbuffers.Builder();
    fbs.Base.startBase(builder);
    return this.wsSubject.sendHandshake(builder);
  }

  // login(userInfo): Subject<any> {
  //   this.account.setUp('login', userInfo);
  //   return this.wsSubject.sendHandshake();
  // }

  logout() {
    const handler = errorHandle.call(this.wsSubject, 'logout', {});
    handler.subscribe({
      error: () => {
        this.wsSubject.removeHandshake();
      },
      complete: () => {
        this.account.clear();
        this.wsSubject.removeHandshake();
        // reverse handshake for login again
        this.wsSubject.handshake.isStopped = false;
        this.handshake();
      }
    });
    return handler;
  }

  signup(userInfo) {
    this.account.setUp('signup', userInfo);
    // return this.wsSubject.sendHandshake();
  }

  isReady(cb: (value: any) => void): Subscription {
    return this.wsSubject.status.pipe(
      filter(status => status === 'ready')
    ).subscribe(cb);
  }

  collection(name): Collection {
    return new Collection(this.wsSubject.sendRequest.bind(this.wsSubject), name);
  }
}