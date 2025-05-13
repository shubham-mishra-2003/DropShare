import { Buffer } from "buffer";

declare module "*.png" {
  const value: any;
  export default value;
}

declare global {
  interface message {
    ip: string;
    name: string;
    message: string;
  }

  // interface TransferProgress {
  //   fileId: string;
  //   fileName: string;
  //   transferredBytes: number;
  //   fileSize: number;
  //   speed: number;
  //   status:
  //     | "Sending"
  //     | "Receiving"
  //     | "Completed"
  //     | "Failed"
  //     | "Encrypting"
  //     | "Decrypting";
  //   error?: string;
  // }

  // interface FileTransfer {
  //   fileId: string;
  //   fileName: string;
  //   fileSize: number;
  //   deviceName: string;
  //   senderIp: string;
  //   chunks: Buffer[];
  //   receivedBytes: number;
  //   startTime: number;
  //   totalChunks: number;
  //   chunkSize: number;
  //   totalSize: number;
  //   chunkHashes: string[];
  //   status:
  //     | "Sending"
  //     | "Receiving"
  //     | "Completed"
  //     | "Failed"
  //     | "Encrypting"
  //     | "Decrypting";
  //   progress: number;
  //   endTime?: number;
  //   error?: string;
  //   aesKey?: string;
  //   iv?: string;
  //   lastChunkIndex: number;
  //   speedWindow: { bytes: number; timestamp: number }[];
  // }

  interface TransferProgress {
    fileId: string;
    fileName: string;
    transferredBytes: number;
    fileSize: number;
    speed: number;
    status:
      | "Sending"
      | "Receiving"
      | "Completed"
      | "Failed"
      | "Encrypting"
      | "Decrypting"
      | "Paused";
    error?: string;
    isPaused: boolean;
  }

  interface FileTransfer {
    fileId: string;
    fileName: string;
    fileSize: number;
    deviceName: string;
    senderIp: string;
    chunks: Buffer[];
    receivedBytes: number;
    startTime: number;
    totalChunks: number;
    chunkSize: number;
    totalSize: number;
    chunkHashes: string[];
    status:
      | "Sending"
      | "Receiving"
      | "Completed"
      | "Failed"
      | "Encrypting"
      | "Decrypting"
      | "Paused";
    progress: number;
    endTime?: number;
    error?: string;
    aesKey?: string;
    iv?: string;
    lastChunkIndex: number;
    speedWindow: { bytes: number; timestamp: number }[];
    isPaused: boolean;
    pauseResolve?: () => void;
  }

  interface UdpSocket {
    bind(port: number): void;
    on(event: "listening", listener: () => void): void;
    on(event: "error", listener: (err: Error) => void): void;
    on(
      event: "message",
      listener: (msg: Buffer, rinfo: { address: string; port: number }) => void
    ): void;
    setBroadcast(flag: boolean): void;
    send(
      buffer: Buffer,
      offset?: number,
      length?: number,
      port?: number,
      address?: string,
      callback?: (error?: Error | undefined) => void
    ): void;
    close(): void;
  }
  interface Device {
    ip: string;
    name: string;
    role: "Client" | "Host";
    publicKey?: string;
  }
}
