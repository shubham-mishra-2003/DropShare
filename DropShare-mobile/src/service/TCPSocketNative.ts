import { NativeModules, NativeEventEmitter } from "react-native";
import { Buffer } from "buffer";
import EventEmitter from "eventemitter3";

const { DropShareTCPSocket } = NativeModules;

if (!DropShareTCPSocket) {
  throw new Error("DropShareTCPSocket native module is not available");
}

type BufferEncoding =
  | "ascii"
  | "utf8"
  | "utf-8"
  | "utf16le"
  | "ucs2"
  | "ucs-2"
  | "base64"
  | "latin1"
  | "binary"
  | "hex";

type SocketOptions = {
  host?: string;
  port?: number;
  localAddress?: string;
  localPort?: number;
  reuseAddress?: boolean;
  timeout?: number;
  keepAlive?: boolean;
  noDelay?: boolean;
  initialDelay?: number;
};

type ServerOptions = {
  port?: number;
  host?: string;
  reuseAddress?: boolean;
  noDelay?: boolean;
  keepAlive?: boolean;
  keepAliveInitialDelay?: number;
};

type ConnectionInfo = {
  localAddress: string;
  localPort: number;
  remoteAddress: string;
  remotePort: number;
  remoteFamily: "IPv4" | "IPv6";
};

export class Socket extends EventEmitter {
  private socketId: string | null = null;
  private eventEmitter: NativeEventEmitter;
  private destroyed: boolean = false;
  private paused: boolean = false;
  private connecting: boolean = false;
  private pending: boolean = true;
  private encoding: BufferEncoding | null = null;
  private writeBufferSize: number = 0;
  public bytesRead: number = 0;
  public bytesWritten: number = 0;
  private msgId: number = 0;
  private initialized: Promise<void>;
  public readableHighWaterMark: number = 512 * 1024;
  public writableHighWaterMark: number = 512 * 1024;
  public writableNeedDrain: boolean = false;
  public localAddress: string | null = null;
  public localPort: number | null = null;
  public remoteAddress: string | null = null;
  public remotePort: number | null = null;
  public remoteFamily: "IPv4" | "IPv6" | null = null;

  constructor() {
    super();
    this.eventEmitter = new NativeEventEmitter(DropShareTCPSocket);
    this.initialized = this.initializeSocket();
  }

  private async initializeSocket() {
    try {
      this.socketId = await new Promise((resolve, reject) => {
        DropShareTCPSocket.createSocket((error: any, socketId: string) => {
          if (error) reject(error);
          else resolve(socketId);
        });
      });
      await this.setBufferSize(512 * 1024);
      this.setupEventListeners();
      this.pending = false;
    } catch (error) {
      this.emit("error", error);
      throw error;
    }
  }

  private setupEventListeners() {
    if (!this.socketId) return;

    const subscriptions = [
      this.eventEmitter.addListener(
        "connect",
        (params: { id: string; connection: ConnectionInfo }) => {
          if (params.id === this.socketId) {
            this.connecting = false;
            this.localAddress = params.connection.localAddress;
            this.localPort = params.connection.localPort;
            this.remoteAddress = params.connection.remoteAddress;
            this.remotePort = params.connection.remotePort;
            this.remoteFamily = params.connection.remoteFamily;
            this.emit("connect");
          }
        }
      ),
      this.eventEmitter.addListener(
        "data",
        (params: { id: string; data: string }) => {
          if (params.id === this.socketId && !this.paused) {
            const bufferData = Buffer.from(params.data, "base64");
            this.bytesRead += bufferData.length;
            const finalData = this.encoding
              ? bufferData.toString(this.encoding)
              : bufferData;
            this.emit("data", finalData);
          }
        }
      ),
      this.eventEmitter.addListener(
        "written",
        (params: { id: string; msgId: number }) => {
          if (params.id === this.socketId) {
            this.writeBufferSize -= this.writableHighWaterMark;
            if (this.writableNeedDrain && this.writeBufferSize <= 0) {
              this.writableNeedDrain = false;
              this.emit("drain");
            }
          }
        }
      ),
      this.eventEmitter.addListener("drain", (params: { id: string }) => {
        if (params.id === this.socketId) {
          this.writableNeedDrain = false;
          this.emit("drain");
        }
      }),
      this.eventEmitter.addListener(
        "close",
        (params: { id: string; hadError: boolean }) => {
          if (params.id === this.socketId) {
            this.destroyed = true;
            this.emit("close", params.hadError);
            this.removeAllListeners();
          }
        }
      ),
      this.eventEmitter.addListener(
        "error",
        (params: { id: string; error: string }) => {
          if (params.id === this.socketId) {
            const error = new Error(params.error);
            this.emit("error", error);
          }
        }
      ),
    ];

    this.once("close", () => {
      subscriptions.forEach((sub) => sub.remove());
    });
  }

  get readyState(): string {
    if (this.destroyed) return "closed";
    if (this.connecting) return "opening";
    return "open";
  }

  async setBufferSize(size: number): Promise<void> {
    if (this.destroyed || !this.socketId) {
      throw new Error("Socket is closed or not initialized");
    }
    return new Promise((resolve, reject) => {
      DropShareTCPSocket.setBufferSize(size, (error: any, result: string) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  connect(options: SocketOptions, callback?: () => void): this {
    this.initialized
      .then(() => {
        if (!this.socketId) {
          this.emit("error", new Error("Socket not initialized"));
          return;
        }
        this.connecting = true;
        this.pending = true;
        const connectOptions = {
          host: options.host || "127.0.0.1",
          port: options.port || 0,
          localAddress: options.localAddress,
          localPort: options.localPort || 0,
          reuseAddress: options.reuseAddress,
        };
        DropShareTCPSocket.connect(
          this.socketId,
          connectOptions.host,
          connectOptions.port,
          connectOptions,
          (error: any, result: string) => {
            if (error) {
              this.emit("error", error);
            } else {
              this.pending = false;
              if (callback) callback();
              const configOptions: SocketOptions = {};
              if (options.timeout !== undefined)
                configOptions.timeout = options.timeout;
              if (options.keepAlive !== undefined)
                configOptions.keepAlive = options.keepAlive;
              if (options.noDelay !== undefined)
                configOptions.noDelay = options.noDelay;
              if (options.initialDelay !== undefined)
                configOptions.initialDelay = options.initialDelay;
              if (Object.keys(configOptions).length > 0) {
                DropShareTCPSocket.configureSocket(
                  this.socketId,
                  configOptions,
                  (err: any) => {
                    if (err) this.emit("error", err);
                  }
                );
              }
            }
          }
        );
      })
      .catch((error) => {
        this.emit("error", error);
      });
    if (callback) this.once("connect", callback);
    return this;
  }

  write(
    data: Buffer | string,
    encoding?: BufferEncoding,
    callback?: (err?: Error) => void
  ): boolean {
    if (this.destroyed || !this.socketId) {
      const error = new Error("Socket is closed or not initialized");
      if (callback) callback(error);
      this.emit("error", error);
      return false;
    }

    const buffer =
      typeof data === "string" ? Buffer.from(data, encoding) : data;
    this.bytesWritten += buffer.length;
    this.writeBufferSize += buffer.length;
    const base64Data = buffer.toString("base64");
    const currentMsgId = this.msgId++;
    DropShareTCPSocket.write(
      this.socketId,
      base64Data,
      currentMsgId,
      (error: any, result: string) => {
        if (error) {
          if (callback) callback(error);
          this.emit("error", error);
        } else {
          if (callback) callback();
        }
      }
    );
    const ok = this.writeBufferSize < this.writableHighWaterMark;
    if (!ok) this.writableNeedDrain = true;
    return ok;
  }

  setEncoding(encoding: BufferEncoding): this {
    this.encoding = encoding;
    return this;
  }

  address(): { port: number; family: string; address: string } | {} {
    if (!this.localAddress) return {};
    return {
      port: this.localPort || 0,
      family: this.remoteFamily || "IPv4",
      address: this.localAddress,
    };
  }

  end(data?: Buffer | string, encoding?: BufferEncoding): this {
    if (this.destroyed || !this.socketId) return this;

    if (data) {
      this.write(data, encoding, () => {
        DropShareTCPSocket.end(this.socketId, (error: any) => {
          if (error) this.emit("error", error);
        });
      });
      return this;
    }

    DropShareTCPSocket.end(this.socketId, (error: any) => {
      if (error) this.emit("error", error);
    });
    return this;
  }

  destroy(): this {
    if (this.destroyed || !this.socketId) return this;

    DropShareTCPSocket.destroy(this.socketId, (error: any) => {
      if (error) this.emit("error", error);
      else {
        this.destroyed = true;
        this.socketId = null;
      }
    });
    return this;
  }

  pause(): this {
    if (this.destroyed || !this.socketId) return this;

    DropShareTCPSocket.pause(this.socketId, (error: any) => {
      if (error) this.emit("error", error);
      else {
        this.paused = true;
        this.emit("pause");
      }
    });
    return this;
  }

  resume(): this {
    if (this.destroyed || !this.socketId) return this;

    DropShareTCPSocket.resume(this.socketId, (error: any) => {
      if (error) this.emit("error", error);
      else {
        this.paused = false;
        this.emit("resume");
      }
    });
    return this;
  }

  setTimeout(timeout: number, callback?: () => void): this {
    if (this.destroyed || !this.socketId) return this;

    DropShareTCPSocket.configureSocket(
      this.socketId,
      { timeout },
      (error: any) => {
        if (error) this.emit("error", error);
        else if (callback) this.once("timeout", callback);
      }
    );
    return this;
  }

  setKeepAlive(enable: boolean, initialDelay: number = 0): this {
    if (this.destroyed || !this.socketId) return this;

    DropShareTCPSocket.setKeepAlive(
      this.socketId,
      enable,
      initialDelay,
      (error: any) => {
        if (error) this.emit("error", error);
      }
    );
    return this;
  }

  setNoDelay(noDelay: boolean): this {
    if (this.destroyed || !this.socketId) return this;

    DropShareTCPSocket.setNoDelay(this.socketId, noDelay, (error: any) => {
      if (error) this.emit("error", error);
    });
    return this;
  }

  ref(): this {
    console.warn(
      "react-native-tcp-socket: Socket.ref() method will have no effect."
    );
    return this;
  }

  unref(): this {
    console.warn(
      "react-native-tcp-socket: Socket.unref() method will have no effect."
    );
    return this;
  }
}

export class Server extends EventEmitter {
  private serverId: string | null = null;
  private eventEmitter: NativeEventEmitter;
  private closed: boolean = false;
  private listening: boolean = false;
  private connections: Map<string, Socket> = new Map();
  private initialized: Promise<void>;
  private serverOptions: ServerOptions = {};

  constructor(
    options?: ServerOptions | ((socket: Socket) => void),
    connectionCallback?: (socket: Socket) => void
  ) {
    super();
    this.eventEmitter = new NativeEventEmitter(DropShareTCPSocket);
    if (typeof options === "function") {
      this.on("connection", options);
    } else if (options) {
      this.serverOptions = options;
      if (connectionCallback) this.on("connection", connectionCallback);
    }
    this.initialized = this.initializeServer();
  }

  private async initializeServer() {
    try {
      this.serverId = await new Promise((resolve, reject) => {
        DropShareTCPSocket.createServer(
          null,
          (error: any, serverId: string) => {
            if (error) reject(error);
            else resolve(serverId);
          }
        );
      });
      this.setupEventListeners();
    } catch (error) {
      this.emit("error", error);
      throw error;
    }
  }

  private setupEventListeners() {
    if (!this.serverId) return;

    const subscriptions = [
      this.eventEmitter.addListener(
        "listening",
        (params: { id: string; connection: ConnectionInfo }) => {
          if (params.id === this.serverId) {
            this.listening = true;
            this.emit("listening");
          }
        }
      ),
      this.eventEmitter.addListener(
        "connection",
        (params: {
          id: string;
          info: { id: string; connection: ConnectionInfo };
        }) => {
          if (params.id === this.serverId) {
            const clientSocket = new Socket();
            // @ts-ignore
            clientSocket.socketId = params.info.id;
            // @ts-ignore
            clientSocket.localAddress = params.info.connection.localAddress;
            // @ts-ignore
            clientSocket.localPort = params.info.connection.localPort;
            // @ts-ignore
            clientSocket.remoteAddress = params.info.connection.remoteAddress;
            // @ts-ignore
            clientSocket.remotePort = params.info.connection.remotePort;
            // @ts-ignore
            clientSocket.remoteFamily = params.info.connection.remoteFamily;

            if (this.serverOptions.noDelay !== undefined) {
              clientSocket.setNoDelay(this.serverOptions.noDelay);
            }
            if (this.serverOptions.keepAlive !== undefined) {
              clientSocket.setKeepAlive(
                this.serverOptions.keepAlive,
                this.serverOptions.keepAliveInitialDelay || 0
              );
            }

            this.connections.set(params.info.id, clientSocket);
            this.emit("connection", clientSocket);

            clientSocket.on("close", () => {
              this.connections.delete(params.info.id);
              if (!this.listening && this.connections.size === 0) {
                this.emit("close");
              }
            });
          }
        }
      ),
      this.eventEmitter.addListener("close", (params: { id: string }) => {
        if (params.id === this.serverId) {
          this.closed = true;
          this.listening = false;
          this.emit("close");
          this.removeAllListeners();
        }
      }),
      this.eventEmitter.addListener(
        "error",
        (params: { id: string; error: string }) => {
          if (params.id === this.serverId) {
            const error = new Error(params.error);
            this.emit("error", error);
          }
        }
      ),
    ];

    this.once("close", () => {
      subscriptions.forEach((sub) => sub.remove());
    });
  }

  listen(
    options: ServerOptions | number,
    callbackOrHost?: string | (() => void),
    callback?: () => void
  ): this {
    this.initialized
      .then(() => {
        if (!this.serverId) {
          this.emit("error", new Error("Server not initialized"));
          return;
        }
        if (this.listening) {
          this.emit("error", new Error("ERR_SERVER_ALREADY_LISTEN"));
          return;
        }

        let listenOptions: ServerOptions;
        let cb: (() => void) | undefined;

        if (typeof options === "number") {
          listenOptions = { port: options, host: "0.0.0.0" };
          if (typeof callbackOrHost === "string") {
            listenOptions.host = callbackOrHost;
            cb = callback;
          } else if (typeof callbackOrHost === "function") {
            cb = callbackOrHost;
          }
        } else {
          listenOptions = {
            port: options.port || 0,
            host: options.host || "0.0.0.0",
            reuseAddress:
              options.reuseAddress !== undefined ? options.reuseAddress : true,
          };
          if (typeof callbackOrHost === "function") {
            cb = callbackOrHost;
          }
        }

        DropShareTCPSocket.serverListen(
          this.serverId,
          listenOptions,
          (error: any, result: string) => {
            if (error) {
              this.emit("error", error);
            } else if (cb) {
              this.once("listening", cb);
            }
          }
        );
      })
      .catch((error) => {
        this.emit("error", error);
      });
    return this;
  }

  close(callback?: (err?: Error) => void): this {
    if (this.closed || !this.serverId) {
      if (callback) callback();
      return this;
    }

    DropShareTCPSocket.serverClose(
      this.serverId,
      (error: any, result: string) => {
        if (error) {
          if (callback) callback(error);
          this.emit("error", error);
        } else {
          this.closed = true;
          this.listening = false;
          this.serverId = null;
          this.connections.forEach((socket) => socket.destroy());
          this.connections.clear();
          if (callback) callback();
        }
      }
    );
    return this;
  }

  getConnections(callback: (error: Error | null, count: number) => void): void {
    callback(null, this.connections.size);
  }

  address(): { port: number; family: string; address: string } | null {
    return null;
  }

  ref(): this {
    console.warn(
      "react-native-tcp-socket: Server.ref() method will have no effect."
    );
    return this;
  }

  unref(): this {
    console.warn(
      "react-native-tcp-socket: Server.unref() method will have no effect."
    );
    return this;
  }
}

export default {
  Socket,
  Server,
  createSocket: () => new Socket(),
  createServer: (
    options?: ServerOptions | ((socket: Socket) => void),
    callback?: (socket: Socket) => void
  ) => new Server(options, callback),
};
