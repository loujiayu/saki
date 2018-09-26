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
import {TextDecoder} from 'text-encoding';
import * as fbs from './msg_generated';
import {map, publish, ignoreElements, concat, concatMap, share, takeWhile, filter, mergeMap} from 'rxjs/operators';

import { Account } from './auth';
import { Saki_USER } from './utils/utils';

const STATUS_UNCONNECTED = 'unconnected';
const STATUS_READY = 'ready';

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

  sendHandshake(): Subject<any> {
    if (!this.handshakeSub) {
      const builder = new flatbuffers.Builder();
      const authOffset = this._handshakeMaker(builder);
      const user = this.account.get(Saki_USER) &&
        builder.createString(this.account.get(Saki_USER));
      fbs.Base.startBase(builder);
      fbs.Base.addMsg(builder, authOffset);
      fbs.Base.addMsgType(builder, fbs.Any.Auth);
      if (user) {
        fbs.Base.addUser(builder, user);
      }

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
    return this.sendHandshake().pipe(
      ignoreElements(),
      concat(this.requestObservable(builder)),
      concatMap((resp: fbs.QueryRes) => {
        if (resp.error()) {
          throw new Error(resp.error()!);
        }
        const decoder = new TextDecoder('utf-8');
        const ab = decoder.decode(resp.dataArray()!);
        const result = JSON.parse(ab);
        if (Array.isArray(result)) {
          return result;
        } else {
          return [JSON.parse(ab)];
        }
      }),
      share(),
    );
  }

  requestObservable(builder: flatbuffers.Builder): Observable<any> {
    return Observable.create((observer: Observer<any>) => {
      fbs.Base.addRequestId(builder, this.requestCounter++);
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
            observer.next(result);
          } else if (resp.msgType() === fbs.Any.QueryRes) {
            result = new fbs.QueryRes();
            resp.msg(result);
            if (result.done()) {
              if (result.dataArray()) {
                observer.next(result);
              }
              observer.complete();
            } else {
              observer.next(result);
            }
          }
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