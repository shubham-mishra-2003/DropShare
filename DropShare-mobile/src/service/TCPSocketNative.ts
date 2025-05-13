import { NativeModules, NativeEventEmitter, Platform } from "react-native";
import { Buffer } from "buffer";
import EventEmitter from "eventemitter3";

const { TCPSocket } = NativeModules;

if (!TCPSocket) {
  throw new Error("TCPSocket native module is not available");
}

type SocketOptions = {
  host?: string;
  port?: number;
  localAddress?: string;
  localPort?: number;
  reuseAddress?: boolean;
  timeout?: number;
  keepAlive?: boolean;
  noDelay?: boolean;
};

type ServerOptions = {
  port: number;
  host?: string;
  reuseAddress?: boolean;
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
  private initialized: Promise<void>;

  // Properties to mimic react-native-tcp-socket
  public localAddress: string | null = null;
  public localPort: number | null = null;
  public remoteAddress: string | null = null;
  public remotePort: number | null = null;
  public remoteFamily: "IPv4" | "IPv6" | null = null;

  constructor() {
    super();
    this.eventEmitter = new NativeEventEmitter(); // Changed to use default DeviceEventEmitter
    this.initialized = this.initializeSocket();
  }

  private async initializeSocket() {
    try {
      this.socketId = await TCPSocket.createSocket();
      await this.setBufferSize(64 * 1024); // Set default buffer size to 64KB
      this.setupEventListeners();
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
        (params: { id: string; data: number[] }) => {
          if (params.id === this.socketId && !this.paused) {
            const buffer = Buffer.from(params.data);
            this.emit("data", buffer);
          }
        }
      ),
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

  async setBufferSize(size: number): Promise<void> {
    if (this.destroyed || !this.socketId) {
      throw new Error("Socket is closed or not initialized");
    }
    return TCPSocket.setBufferSize(size);
  }

  async connect(options: SocketOptions): Promise<this> {
    await this.initialized; // Wait for socket initialization
    if (!this.socketId) {
      this.emit("error", new Error("Socket not initialized"));
      return this;
    }

    const connectOptions = {
      host: options.host || "127.0.0.1",
      port: options.port || 0,
      localAddress: options.localAddress,
      localPort: options.localPort || 0,
    };

    try {
      await TCPSocket.socketConnect(this.socketId, connectOptions);
      // Apply configuration options if provided
      const configOptions: SocketOptions = {};
      if (options.timeout !== undefined)
        configOptions.timeout = options.timeout;
      if (options.keepAlive !== undefined)
        configOptions.keepAlive = options.keepAlive;
      if (options.noDelay !== undefined)
        configOptions.noDelay = options.noDelay;

      if (Object.keys(configOptions).length > 0) {
        await TCPSocket.configureSocket(this.socketId, configOptions);
      }
    } catch (error) {
      this.emit("error", error);
    }

    return this;
  }

  write(data: Buffer | string): boolean {
    if (this.destroyed || !this.socketId) {
      this.emit("error", new Error("Socket is closed or not initialized"));
      return false;
    }

    const byteArray = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const intArray = Array.from(byteArray);

    TCPSocket.socketWrite(this.socketId, intArray).catch((error: any) => {
      this.emit("error", error);
    });

    return true;
  }

  async end(): Promise<this> {
    if (this.destroyed || !this.socketId) return this;

    try {
      await TCPSocket.socketEnd(this.socketId);
    } catch (error) {
      this.emit("error", error);
    }

    return this;
  }

  async destroy(): Promise<this> {
    if (this.destroyed || !this.socketId) return this;

    try {
      await TCPSocket.socketDestroy(this.socketId);
      this.destroyed = true;
      this.socketId = null;
    } catch (error) {
      this.emit("error", error);
    }

    return this;
  }

  async pause(): Promise<this> {
    if (this.destroyed || !this.socketId) return this;

    try {
      await TCPSocket.socketPause(this.socketId);
      this.paused = true;
    } catch (error) {
      this.emit("error", error);
    }

    return this;
  }

  async resume(): Promise<this> {
    if (this.destroyed || !this.socketId) return this;

    try {
      await TCPSocket.socketResume(this.socketId);
      this.paused = false;
    } catch (error) {
      this.emit("error", error);
    }

    return this;
  }

  async setTimeout(timeout: number): Promise<this> {
    if (this.destroyed || !this.socketId) return this;

    try {
      await TCPSocket.configureSocket(this.socketId, { timeout });
    } catch (error) {
      this.emit("error", error);
    }

    return this;
  }

  async setKeepAlive(enable: boolean): Promise<this> {
    if (this.destroyed || !this.socketId) return this;

    try {
      await TCPSocket.configureSocket(this.socketId, { keepAlive: enable });
    } catch (error) {
      this.emit("error", error);
    }

    return this;
  }

  async setNoDelay(noDelay: boolean): Promise<this> {
    if (this.destroyed || !this.socketId) return this;

    try {
      await TCPSocket.configureSocket(this.socketId, { noDelay });
    } catch (error) {
      this.emit("error", error);
    }

    return this;
  }
}

export class Server extends EventEmitter {
  private serverId: string | null = null;
  private eventEmitter: NativeEventEmitter;
  private closed: boolean = false;
  private connections: Map<string, Socket> = new Map();
  private initialized: Promise<void>;

  constructor() {
    super();
    this.eventEmitter = new NativeEventEmitter(); // Changed to use default DeviceEventEmitter
    this.initialized = this.initializeServer();
  }

  private async initializeServer() {
    try {
      this.serverId = await TCPSocket.createServer();
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
            // @ts-ignore: Private access to set socketId
            clientSocket.socketId = params.info.id;
            // @ts-ignore: Private access to set properties
            clientSocket.localAddress = params.info.connection.localAddress;
            // @ts-ignore
            clientSocket.localPort = params.info.connection.localPort;
            // @ts-ignore
            clientSocket.remoteAddress = params.info.connection.remoteAddress;
            // @ts-ignore
            clientSocket.remotePort = params.info.connection.remotePort;
            // @ts-ignore
            clientSocket.remoteFamily = params.info.connection.remoteFamily;

            this.connections.set(params.info.id, clientSocket);
            this.emit("connection", clientSocket);

            clientSocket.on("close", () => {
              this.connections.delete(params.info.id);
            });
          }
        }
      ),
      this.eventEmitter.addListener("close", (params: { id: string }) => {
        if (params.id === this.serverId) {
          this.closed = true;
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

  async listen(options: ServerOptions, callback?: () => void): Promise<this> {
    await this.initialized; // Wait for server initialization
    if (!this.serverId) {
      this.emit("error", new Error("Server not initialized"));
      return this;
    }

    const listenOptions = {
      port: options.port || 0,
      host: options.host || "0.0.0.0",
      reuseAddress:
        options.reuseAddress !== undefined ? options.reuseAddress : true,
    };

    try {
      await TCPSocket.serverListen(this.serverId, listenOptions);
      if (callback) callback();
    } catch (error) {
      this.emit("error", error);
    }

    return this;
  }

  async close(callback?: () => void): Promise<this> {
    if (this.closed || !this.serverId) {
      if (callback) callback();
      return this;
    }

    try {
      await TCPSocket.serverClose(this.serverId);
      this.closed = true;
      this.serverId = null;
      this.connections.forEach((socket) => socket.destroy());
      this.connections.clear();
      if (callback) callback();
    } catch (error) {
      this.emit("error", error);
    }

    return this;
  }

  getConnections(callback: (error: Error | null, count: number) => void): void {
    callback(null, this.connections.size);
  }
}

export default {
  Socket,
  Server,
  createSocket: () => new Socket(),
  createServer: () => new Server(),
};
