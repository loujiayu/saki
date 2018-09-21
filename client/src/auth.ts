import root from './utils/root';
import { Saki_JWT, Saki_USER } from './utils/utils';

export class Storage {
  setItem(user, token) {
    root.localStorage.setItem(Saki_USER, user);
    root.localStorage.setItem(Saki_JWT, token);
  }
  getItem(key) {
    return root.localStorage.getItem(key);
  }
  removeItem(key) {
    return root.localStorage.removeItem(key);
  }
  clear() {
    root.localStorage.removeItem(Saki_JWT);
    root.localStorage.removeItem(Saki_USER);
  }
}

export class Account {
  storage: Storage;
  authType: string;
  userInfo: Object | null;

  constructor() {
    this.storage = new Storage();
  }

  set(user: string, token: string) {
    this.storage.setItem(user, token);
  }

  get(key: string) {
    return this.storage.getItem(key);
  }

  clear(): void {
    this.storage.clear();
    this.authType = 'null';
    this.userInfo = null;
  }

  setUp(authType, userInfo?: Object): void {
    this.authType = authType;
    if (userInfo) {
      this.userInfo = userInfo;
    }
  }

  createUser(userInfo) {
    this.userInfo = userInfo;
    return { method: 'signup', userInfo: this.userInfo };
  }

  handshake() {
    if (this.authType === 'unauthenticated') {
      return { method: this.authType };
    } else if (this.authType === 'login') {
      return { method: this.authType, userInfo: this.userInfo };
    } else if (this.authType === 'signup') {
      return { method: this.authType, userInfo: this.userInfo };
    } else if (this.authType === 'token') {
      const token = this.get(Saki_JWT);
      if (typeof token === 'string') {
        return { method: this.authType, token };
      } else {
        throw new Error('invalid token');
      }
    } else {
      return { method: this.authType };
    }
  }
}