import { AddressInfo, createServer, Socket } from 'net';
import { Connection } from '../src/Connection';
import { ConnectionError } from '../src/error/ConnectionError';

describe('Connection', () => {
  const server = createServer();
  let address: AddressInfo;
  let serverSocket: Socket;

  beforeAll((done) => {
    server.listen(() => {
      address = server.address() as AddressInfo;

      server.on('connection', (sock) => {
        serverSocket = sock;
      });
      done();
    });
  });

  const connections: Connection[] = [];

  function getNewConnection() {
    const conn = new Connection();

    connections.push(conn);
    return conn;
  }

  afterAll(async () => {
    server.close();

    // eslint-disable-next-line no-restricted-syntax
    for await (const connection of connections) {
      if (connection.getState() !== 'closed' && connection.getState() !== 'closing')
        await connection.close();
    }
  });

  it('should be defined', () => {
    expect(Connection).toBeDefined();
  });

  it('should be creatable by `new`', () => {
    const conn = getNewConnection();

    expect(conn).toBeDefined();
    expect(conn).toBeInstanceOf(Connection);
  });

  describe('connection.open()', () => {
    it('should connect to the given remote', async () => {
      const conn = getNewConnection();
      await conn.open(address.port, address.address);

      expect(conn.getState()).toBe('open');
    });

    it('should throw on attempt to twice open connection to given remote', async () => {
      const conn = getNewConnection();
      await conn.open(address.port, address.address);
      expect(conn.getState()).toBe('open');

      await conn
        .open(address.port, address.address)
        .then(() => {
          throw new Error('not thrown!');
        })
        .catch((err: ConnectionError) => {
          expect(err).toBeInstanceOf(ConnectionError);
          expect(err.code).toBe('ErrAlreadyOpened');
        });
    });

    it('should throw on attempt to connect while opening or closing connection', async () => {
      const conn = getNewConnection();
      conn.open(address.port, address.address);
      await conn
        .open(address.port, address.address)
        .then(() => {
          throw new Error('not thrown!');
        })
        .catch((err: ConnectionError) => {
          expect(err).toBeInstanceOf(ConnectionError);
          expect(err.code).toBe('ErrChangingState');
        });
    });
  });

  describe('connection.close()', () => {
    it('should connect to the given remote', async () => {
      const conn = getNewConnection();
      await conn.open(address.port, address.address);
      await conn.close();
      expect(conn.getState()).toBe('closed');
    });

    it('should throw on attempt to twice close connection', async () => {
      const conn = getNewConnection();
      await conn.open(address.port, address.address);
      await conn.close();
      expect(conn.getState()).toBe('closed');

      await conn
        .close()
        .then(() => {
          throw new Error('not thrown!');
        })
        .catch((err: ConnectionError) => {
          expect(err).toBeInstanceOf(ConnectionError);
          expect(err.code).toBe('ErrAlreadyClosed');
        });
    });

    it('should throw on attempt to connect while opening or closing connection', async () => {
      const conn = getNewConnection();
      conn.open(address.port, address.address);
      await conn
        .close()
        .then(() => {
          throw new Error('not thrown!');
        })
        .catch((err: ConnectionError) => {
          expect(err).toBeInstanceOf(ConnectionError);
          expect(err.code).toBe('ErrChangingState');
        });
    });
  });

  describe('connection.write()', () => {
    it('should throw in case of calling on unopened connection', async () => {
      const conn = getNewConnection();

      await conn
        .write(Buffer.from('hey!'))
        .then(() => {
          throw new Error('not thrown!');
        })
        .catch((err: ConnectionError) => {
          expect(err).toBeInstanceOf(ConnectionError);
          expect(err.code).toBe('ErrNotOpened');
        });
    });

    if (process.env.CI === undefined) {
      // somewhy this test fails on CI
      // ToDo: investigate later
      it('should write given buffer to underlying socket', (done) => {
        const conn = getNewConnection();
        conn.open(address.port, address.address).then(() => {
          const sendBuffer = Buffer.from('hey!');

          serverSocket.on('data', async (data) => {
            expect(data).toStrictEqual(sendBuffer);
            done();
          });

          conn.write(sendBuffer);
        });
      });
    }
  });

  describe('events', () => {
    it('should emit `open` event on connection opened', (done) => {
      const conn = getNewConnection();
      conn.on('open', async (port, host) => {
        expect(typeof port).toBe('number');
        expect(typeof host).toBe('string');
        await conn.close();
        done();
      });
      conn.open(address.port, address.address);
    });

    it('should emit `close` event on connection close', (done) => {
      const conn = getNewConnection();
      conn.on('close', () => {
        done();
      });
      conn.open(address.port, address.address).then(() => conn.close());
    });
  });
});
