import root from './utils/root';
import { Saki_JWT, Saki_USER } from './utils/utils';
import * as fbs from './msg_generated';

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

  handshake(builder: flatbuffers.Builder) {
    fbs.Auth.startAuth(builder);
    if (this.authType === 'unauthenticated') {
      fbs.Auth.addType(builder, fbs.AuthType.unauthenticated);
      // return { method: this.authType };
    }
    return fbs.Auth.endAuth(builder);
    // fbs.Base.addMsg(builder, fbs.Auth.endAuth(builder));
    // fbs.Base.addMsgType(builder, fbs.Any.Auth);
    // todo user login
    // else if (this.authType === 'login') {
    //   fbs.Base.addAuthType(builder, fbs.AuthType.login);
    //   // fbs.Base.addAuthUser(builder, builder.createString(builder, this.userInfo.username))
    //   return { method: this.authType, userInfo: this.userInfo };
    // } else if (this.authType === 'signup') {
    //   return { method: this.authType, userInfo: this.userInfo };
    // } else if (this.authType === 'token') {
    //   const token = this.get(Saki_JWT);
    //   if (typeof token === 'string') {
    //     return { method: this.authType, token };
    //   } else {
    //     throw new Error('invalid token');
    //   }
    // } else {
    //   return { method: this.authType };
    // }
  }
}