beforeAll(() => {
  global.sk.connect('unauthenticated');
});

afterAll(() => {
  global.server.close();
});

describe('unauthenticated', () => {
  test('unauthenticated', done => {
    global.sk.wsSubject.handshake.subscribe({
      next: resp => {
        expect(resp).toEqual({method: 'unauthenticated', requestId: 0});
        done();
      }
    });
    global.sk.connect('unauthenticated');
  });
});

describe('server status', () => {
  test('server ready', done => {
    global.sk.isReady(status => {
      expect(status).toBe('ready');
      done();
    });
  });
});
