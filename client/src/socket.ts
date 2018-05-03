import { WebSocketSubject, WebSocketSubjectConfig } from 'rxjs/observable/dom/WebSocketSubject';
import { BehaviorSubject, Observable, Subject, Observer, Subscription, ConnectableObservable } from 'rxjs';
import { Account } from './auth';
import { Saki_USER } from './utils/utils';

import 'rxjs/add/operator/share';
import 'rxjs/add/operator/concat';
import 'rxjs/add/operator/ignoreElements';
import 'rxjs/add/operator/concatMap';
import 'rxjs/add/operator/takeWhile';
import 'rxjs/add/operator/map';

const STATUS_UNCONNECTED = 'unconnected';
const STATUS_READY = 'ready';

interface Response {
  data: any[];
  state?: string;
  error?: any;
}

export class SakiSocket<T> extends Subject<T> {
  socket: WebSocketSubject<any>;
  wsSubjectConfig: WebSocketSubjectConfig;
  handshakeSub: Subscription | null;
  status: BehaviorSubject<string>;
  requestCounter: number;
  handshake: Subject<any>;
  account: Account;
  keepalive: ConnectableObservable<any>;

  constructor(url, private _handshakeMaker, account, keepalive = 60) {
    super();
    this.wsSubjectConfig = {
      url,
      closeObserver: {
        next: () => {
          if (this.handshakeSub) {
            this.handshakeSub.unsubscribe();
            this.handshakeSub = null;
          }
        }
      }
    };

    this.keepalive = Observable
      .timer(1000 * keepalive, 1000 * keepalive)
      .map(() => this.requestObservable({type: 'keepalive'}).subscribe())
      .publish();

    this.account = account;
    this.requestCounter = 0;
    this.handshake = new Subject<T>();
    this.handshakeSub = null;
    this.status = new BehaviorSubject(STATUS_UNCONNECTED);
    this.socket = new WebSocketSubject(this.wsSubjectConfig);
  }

  serializer(data: any): string {
    return JSON.stringify(data);
  }

  getRequest(data) {
    return Object.assign({}, data, {
      requestId: this.requestCounter++,
    });
  }

  send(data: any): void {
    this.socket.next(this.serializer(data));
  }

  handshakeWithPassword(data) {
    if (this.handshakeSub) {
      this.handshakeSub = this.requestObservable(data)
        .subscribe({
          next: m => {
            if (m.error) {
              this.handshake.next(m.error);
            } else {
              this.handshake.next(m);
              this.handshake.complete();
            }
          }
        });
    }
  }

  sendHandshake(): Subject<any> {
    if (!this.handshakeSub) {
      this.handshakeSub = this.requestObservable(this._handshakeMaker())
        .subscribe({
          next: m => {
            if (m.error) {
              this.handshake.error(m.error);
            } else {
              this.status.next(STATUS_READY);
              this.handshake.next(m);
              this.handshake.complete();
            }
          },
          error: err => {
            console.log(err);
          }}
        );
      this.handshakeSub.add(this.keepalive.connect()); 
    }
    return this.handshake;
  }

  removeHandshake() {
    return this.sendHandshake()
      .ignoreElements()
      .concat(this.requestObservable({type: 'logout'}));
  }

  sendRequest(type, options): Observable<any> {
    return this.sendHandshake()
      .ignoreElements()
      .concat(this.requestObservable({
        type,
        options,
        internal: {user: this.account.get(Saki_USER)}
      }))
      .concatMap((resp: Response) => {
        if (resp.error) {
          throw new Error(resp.error);
        }
        const data = resp.data || [];
        if (resp.state) {
          data.push({
            type: 'state',
            state: resp.state,
          });
        }
        return data;
      })
      .share()
      .takeWhile(resp => {
        return resp.state !== 'complete';
      });
  }

  requestObservable(data: any): Observable<any> {
    const request = this.getRequest(data);
    return Observable.create((observer: Observer<any>) => {
      this.send(request);
      const subscription = this.socket
        .filter(resp => resp.requestId === request.requestId)
        .subscribe(
          (resp: Response) => {
            observer.next(resp);
          },
          err => {
            observer.error(err);
          }
        );
      return () => {
        this.send({requestId: request.requestId, type: 'unsubscribe'});
        subscription.unsubscribe();
      };
    });
  }
}