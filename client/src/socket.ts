import { WebSocketSubject, WebSocketSubjectConfig } from 'rxjs/webSocket';
import {
  BehaviorSubject,
  Observable,
  Subject,
  Observer,
  Subscription,
  timer,
} from 'rxjs';
import { flatbuffers } from 'flatbuffers';
import * as fbs from './msg_generated';
import {map, publish, ignoreElements, concat, concatMap, share, takeWhile, filter, mergeMap} from 'rxjs/operators';

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
        return e.data;
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
      const authOffset = this._handshakeMaker(builder);
      fbs.Base.startBase(builder);
      fbs.Base.addMsg(builder, authOffset);
      fbs.Base.addMsgType(builder, fbs.Any.Auth);

      this.handshakeSub = this.requestObservable(builder)
        .subscribe({
          next: (m: fbs.AuthRes) => {
            if (m.error()) {
              this.handshake.error(m.error());
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
      // this.handshakeSub.add((this.keepalive as any).connect());
    }
    return this.handshake;
  }

  sendRequest(builder: flatbuffers.Builder): Observable<any> {
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
    return Observable.create((observer: Observer<any>) => {
      
      fbs.Base.addRequestId(builder, this.requestCounter++);
      if (this.account.get(Saki_USER)) {
        fbs.Base.addUser(builder, builder.createString(this.account.get(Saki_USER)));
      }
      builder.finish(fbs.Base.endBase(builder));

      this.send(builder.asUint8Array());

      const buf = builder.dataBuffer();
      const base = fbs.Base.getRootAsBase(buf);

      const subscription = this.socket.pipe(
        mergeMap(
          resp => new Promise((resolve, reject) => {
            const fileReader = new FileReader();
            fileReader.onload = (event: ProgressEvent) => {
              const ab = (event as any).target.result;
              const u8 = new Uint8Array(ab);
              const bb = new flatbuffers.ByteBuffer(u8);
              const resBase = fbs.Base.getRootAsBase(bb);
              resolve(resBase);
            }
            fileReader.readAsArrayBuffer(resp);
          }),
        ),
        filter((resp: fbs.Base) => resp.requestId() === base.requestId())
      ).subscribe(
        (resp: fbs.Base) => {
          let result;
          if (resp.msgType() === fbs.Any.AuthRes) {
            result = new fbs.AuthRes();
            resp.msg(result);
          }
          observer.next(result);
        },
        err => {
          observer.error(err);
        }
      );
      return () => {
        if (!base.msgType()) {
          // this.send({requestId: request.requestId, type: 'unsubscribe'});
        }
        subscription.unsubscribe();
      };
    });
  }
}