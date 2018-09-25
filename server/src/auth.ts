import * as bluebird from 'bluebird';
import * as jsonwebtoken from 'jsonwebtoken';
import * as r from 'rethinkdb';
import Server from './server';
import * as fbs from './msg_generated';
import { hashPassword, verifyPassword} from './utils/password';
import {invariant} from './utils/utils';

const jwt: any = bluebird.promisifyAll(jsonwebtoken);

export interface IUserInfo {
  username: string;
  password: string;
}

export class JWT {
  duration: string;
  algorithm: string = 'HS512';
  secret: Buffer;
  constructor(options) {
    this.duration = options.duration || '1d';
    if (options.token_secret != null)
      this.secret = new Buffer(options.token_secret, 'base64');
  }

  sign(payload) {
    const token = jwt.sign(
      payload,
      this.secret,
      {algorithm: this.algorithm, expiresIn: this.duration}
    );
    return {token, payload};
  }

  verify(token) {
    return jwt.verifyAsync(token, this.secret, {algorithm: [this.algorithm]})
      .then(payload => ({token, payload}));
  }
}

export default class Auth {
  _jwt: JWT;
  constructor(private server: Server, user_options) {
    this._jwt = new JWT(user_options);
  }

  handshake(auth: fbs.Auth): Promise<any> {
    switch(auth.type()) {
      case fbs.AuthType.login:
        return r.table(this.server.dbConnection.userTableName)
          .get(auth.username()!)
          .run(this.server.dbConnection.connection())
          .then((result: IUserInfo) => {
            console.log(result);
            if (!result) {
              return { error: 'Authentication failed. User not found.' };
            }
            if (verifyPassword(auth.password()!, result.password)) {
              return { ...this._jwt.sign({id: result.password}), user: auth.username()};
            } else {
              return { error: 'Authentication failed. Wrong password.'};
            }
          });
      case fbs.AuthType.token:
        return this._jwt.verify(auth.token());
      case fbs.AuthType.signup:
        const password = hashPassword(auth.password()!);
        return r.table(this.server.dbConnection.userTableName)
          .insert({password, id: auth.username()}, { conflict: 'error' })
          .run(this.server.dbConnection.connection())
          .then(({ first_error }) => {
            if (first_error) {
              return { error: first_error };
            } else {
              return { ...this._jwt.sign({id: password}), user: auth.username() };
            }
          });
      case fbs.AuthType.unauthenticated:
        return Promise.resolve({});
      default:
        return Promise.reject({message: `Unknown handshake method "${auth.username()}"`});
    }
  }
}