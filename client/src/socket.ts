import { WebSocketSubject, WebSocketSubjectConfig } from 'rxjs/webSocket';
import {
  BehaviorSubject,
  Observable,
  Subject,
  Observer,
  Subscription,
  timer
} from 'rxjs';
import * as fbs from './msg_generated';
import {map, publish, ignoreElements, concat, concatMap, share, takeWhile, filter} from 'rxjs/operators';

import { Account } from './auth';
import { Saki_USER } from './utils/utils';

const STATUS_UNCONNECTED = 'unconnected';
const STATUS_READY = 'ready';

interface Response {
  data: any[];
  state?: string;
  error?: any;
}

export class SakiSocket<T> extends Subject<T> {
  socket: WebSocketSubject<any>;
  wsSubjectConfig: WebSocketSubjectConfig<any>;
  handshakeSub: Subscription | null;
  status: BehaviorSubject<string>;
  requestCounter: number;
  handshake: Subject<any>;
  account: Account;
  keepalive: Observable<any>;

  constructor(url, private _handshakeMaker, account, keepalive = 60) {
    super();
    this.wsSubjectConfig = {
      url,
      serializer: value => {
        return value;
      },
      deserializer: e => {
        return JSON.parse(e.data)
      },
      closeObserver: {
        next: () => {
          this.removeHandshake();
        }
      }
    };

    // this.keepalive = timer(1000 * keepalive, 1000 * keepalive)
    //   .pipe(
    //     map(() => this.requestObservable({type: 'keepalive'})),
    //     publish()
    //   );
    // this.keepalive.subscribe();

    this.account = account;
    this.requestCounter = 0;
    this.handshake = new Subject<T>();
    this.handshakeSub = null;
    this.status = new BehaviorSubject(STATUS_UNCONNECTED);
    this.socket = new WebSocketSubject(this.wsSubjectConfig);
  }

  getRequest(builder: flatbuffers.Builder) {
    fbs.Base.addRequestId(builder, this.requestCounter++);
  }

  removeHandshake() {
    if (this.handshakeSub) {
      this.handshakeSub.unsubscribe();
      this.handshakeSub = null;
    }
  }

  send(data: any): void {
    this.socket.next(data);
  }

  sendHandshake(builder: flatbuffers.Builder): Subject<any> {
    if (!this.handshakeSub) {
      this._handshakeMaker(builder)
      this.handshakeSub = this.requestObservable(builder)
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
      this.handshakeSub.add((this.keepalive as any).connect());
    }
    return this.handshake;
  }

  sendRequest(builder: flatbuffers.Builder): Observable<any> {
    fbs.Base.addUser(builder, builder.createString(this.account.get(Saki_USER)));
    return this.sendHandshake(builder).pipe(
      ignoreElements(),
      concat(this.requestObservable(builder)),
      concatMap((resp: Response) => {
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
      }),
      share(),
      takeWhile(resp => resp.state !== 'complete')
    );
  }

  requestObservable(builder: flatbuffers.Builder): Observable<any> {
    this.getRequest(builder);
    return Observable.create((observer: Observer<any>) => {
      builder.finish(fbs.Base.endBase(builder));

      this.send(builder.asUint8Array());

      const buf = builder.dataBuffer();
      const base = fbs.Base.getRootAsBase(buf);

      const subscription = this.socket.pipe(
        filter(resp => resp.requestId === base.requestId())
      ).subscribe(
        (resp: Response) => {
          observer.next(resp);
        },
        err => {
          observer.error(err);
        }
      );
      return () => {
        if (!base.authType) {
          // this.send({requestId: request.requestId, type: 'unsubscribe'});
        }
        subscription.unsubscribe();
      };
    });
  }
}