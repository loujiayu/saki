import { Observable, Subscription } from 'rxjs';

import { Collection } from './collection';
import { Account } from './auth';
import { SakiSocket } from './socket';
import { Saki_JWT, Saki_USER } from './utils/utils';

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
        } else if (resp.error) {
          this.logout();
        }
      }
    });
  }
 
  connect(authType) {
    this.account.setUp(authType);
    this.wsSubject.connect();
  }

  login(userInfo) {
    this.account.setUp('login', userInfo);
    this.wsSubject.connect();
  }

  logout() {
    this.account.clear();
    if (this.wsSubject.handshakeSub) {
      this.wsSubject.handshakeSub.unsubscribe();
      this.wsSubject.handshakeSub = null;
    }
  }

  signup(userInfo) {
    return this.wsSubject.handshakeWithPassword({ method: 'signup', userInfo: userInfo });
  }

  isReady(cb: (value: any) => void): Subscription {
    return this.wsSubject.status.filter(status => status === 'ready').subscribe(cb);
  }

  collection(name): Collection {
    return new Collection(this.wsSubject.sendRequest.bind(this.wsSubject), name);
  }
}