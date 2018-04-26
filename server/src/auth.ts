import * as bluebird from 'bluebird';
import * as jsonwebtoken from 'jsonwebtoken';
import * as r from 'rethinkdb';
import Server from './server';
import { hashPassword, verifyPassword} from './utils/password';

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

  handshake(request): Promise<any> {
    switch(request.method) {
      case 'login':
        return r.table(this.server.dbConnection.userTableName)
          .get(request.userInfo.username)
          .run(this.server.dbConnection.connection())
          .then((result: IUserInfo) => {
            if (!result) {
              return { error: 'Authentication failed. User not found.' };
            }
            if (verifyPassword(request.userInfo.password, result.password)) {
              return { ...this._jwt.sign({id: result.password}), user: request.userInfo.username};
            } else {
              return { error: 'Authentication failed. Wrong password.'};
            }
          })
      case 'token':
        return this._jwt.verify(request.token);
      case 'signup':
        const row = request.userInfo;
        row.password = hashPassword(row.password);
        return r.table(this.server.dbConnection.userTableName)
          .insert(row, { conflict: 'error' })
          .run(this.server.dbConnection.connection())
          .then(({ first_error }) => {
            if (first_error) {
              return { error: first_error }
            } else {
              return { ...this._jwt.sign({id: row.password}), user: row.username };
            }
          });
      case 'unauthenticated':
        return Promise.resolve({});
      default:
        throw new Error(`Unknown handshake method "${request.method}"`);
    }
  }
}