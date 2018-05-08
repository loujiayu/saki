import { Observable, Subscription, Subject } from 'rxjs';

import { Collection } from './collection';
import { Account } from './auth';
import { SakiSocket } from './socket';
import { Saki_JWT, Saki_USER } from './utils/utils';
import { errorHandle } from './collection';

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
    return this.wsSubject.sendHandshake();
  }

  login(userInfo): Subject<any> {
    this.account.setUp('login', userInfo);
    return this.wsSubject.sendHandshake();
  }

  logout() {
    const handler = errorHandle.call(this.wsSubject, 'logout', {});
    handler.subscribe({
      complete: () => {
        this.wsSubject.removeHandshake();
      }
    });
    return handler;
  }

  signup(userInfo) {
    this.account.setUp('signup', userInfo);
    return this.wsSubject.sendHandshake();
  }

  isReady(cb: (value: any) => void): Subscription {
    return this.wsSubject.status.filter(status => status === 'ready').subscribe(cb);
  }

  collection(name): Collection {
    return new Collection(this.wsSubject.sendRequest.bind(this.wsSubject), name);
  }
}