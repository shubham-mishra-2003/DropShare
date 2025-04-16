import { ElectronAPI } from "@electron-toolkit/preload";
import { Buffer } from "buffer";

declare global {
  interface Window {
    electron: ElectronAPI & {
      // Window controls
      handleMinimize: () => void;
      handleMaximize: () => void;
      handleClose: () => void;
      // File system
      getDrives: () => Promise<DriveInfo[]>;
      getFiles: (drive: string) => Promise<string[]>;
      selectFile: () => Promise<{ filePath: string; fileData: Buffer } | null>;
      // Network operations (Host)
      startHostServer: (
        username: string,
        setDevices: (devices: Device[]) => void,
        setSocket: (socket: any) => void,
        setMessages: (messages: string[]) => void,
        setReceivedFiles: (files: string[]) => void,
        setTransferProgress?: (progress: TransferProgress) => void,
      ) => Promise<void>;
      sendHostMessage: (
        socket: any,
        message: string,
        username: string,
      ) => Promise<void>;
      sendHostFile: (
        socket: any,
        filePath: string,
        fileData: Buffer,
        username: string,
        setTransferProgress?: (progress: {
          progress: string;
          speed: string;
        }) => void,
      ) => Promise<void>;
      // Network operations (Client)
      startClientDiscovery: (
        username: string,
        setDevices: (devices: Device[]) => void,
      ) => () => void;
      connectToHost: (
        ip: string,
        username: string,
        hostPublicKey: string,
        setConnected: (connected: boolean) => void,
        setSocket: (socket: any) => void,
        setMessages: (messages: string[]) => void,
        setReceivedFiles: (files: string[]) => void,
        setTransferProgress?: (progress: {
          progress: string;
          speed: string;
        }) => void,
      ) => Promise<void>;
      sendMessage: (
        socket: any,
        message: string,
        username: string,
        hostPublicKey: string,
      ) => Promise<void>;
      sendFile: (
        socket: any,
        filePath: string,
        fileData: Buffer,
        username: string,
        hostPublicKey: string,
        setTransferProgress?: (progress: {
          progress: string;
          speed: string;
        }) => void,
      ) => Promise<void>;
      // Event listeners
      on: (channel: string, listener: (...args: any[]) => void) => void;
      stopHosting: () => void;
      disconnectClient: () => void;
    };
    api: unknown;
  }

  interface DriveInfo {
    drive: string;
    total: number;
    free: number;
    name: string;
  }

  interface FileNode {
    name: string;
    path: string;
    type: "file" | "directory";
    children?: FileNode[];
  }

  interface Device {
    ip: string;
    name: string;
    role: "Host" | "Client";
  }

  interface FileInfo {
    name: string;
    path: string;
  }
  interface TransferProgress {
    fileId: string;
    fileName: string;
    progress: string;
    speed: string;
    percentage: number;
    error?: string;
  }
  interface FileTransfer {
    fileId: string;
    fileName: string;
    fileSize: number;
    deviceName: string;
    chunks: (Buffer | undefined)[];
    receivedBytes: number;
    startTime: number;
    totalChunks: number;
    chunkSize: number;
    totalSize: number;
    aesKey?: string;
    iv?: string;
    chunkHashes: string[];
  }
  interface UdpSocket {
    bind(port: number): void;
    on(event: "listening", listener: () => void): void;
    on(event: "error", listener: (err: Error) => void): void;
    on(
      event: "message",
      listener: (msg: Buffer, rinfo: { address: string; port: number }) => void,
    ): void;
    setBroadcast(flag: boolean): void;
    send(
      buffer: Buffer,
      offset?: number,
      length?: number,
      port?: number,
      address?: string,
      callback?: (error?: Error | undefined) => void,
    ): void;
    close(): void;
  }
  interface Device {
    ip: string;
    name: string;
    role: "Client" | "Host";
  }
}

export {};

export interface FileTransfer {
  fileId: string;
  fileName: string;
  fileSize: number;
  deviceName: string;
  senderIp: string;
  chunks: (Buffer | undefined)[];
  receivedBytes: number;
  startTime: number;
  totalChunks: number;
  chunkSize: number;
  totalSize: number;
  chunkHashes: string[];
  status: "Sending" | "Receiving" | "Completed" | "Failed";
  progress: number;
  endTime?: number;
  error?: string;
}

export interface TransferProgress {
  fileId: string;
  fileName: string;
  progress: string;
  speed: string;
  percentage: number;
}
