// import { Buffer } from "buffer";

// declare module "*.png" {
//   const value: any;
//   export default value;
// }

// declare global {
//   interface TransferProgress {
//     fileId: string;
//     fileName: string;
//     progress: string;
//     speed: string;
//     percentage: number;
//     error?: string;
//   }
//   interface FileTransfer {
//     fileId: string;
//     fileName: string;
//     fileSize: number;
//     deviceName: string;
//     senderIp: string;
//     chunks: (Buffer | undefined)[];
//     receivedBytes: number;
//     startTime: number;
//     totalChunks: number;
//     chunkSize: number;
//     totalSize: number;
//     chunkHashes: string[];
//     aesKey?: string;
//     iv?: string;
//     status: "Sending" | "Receiving" | "Completed" | "Failed";
//     progress: number;
//     lastChunkIndex: number;
//     completedChunks: Set<number>;
//     error?: string;
//     endTime?: number;
//   }
//   interface UdpSocket {
//     bind(port: number): void;
//     on(event: "listening", listener: () => void): void;
//     on(event: "error", listener: (err: Error) => void): void;
//     on(
//       event: "message",
//       listener: (msg: Buffer, rinfo: { address: string; port: number }) => void
//     ): void;
//     setBroadcast(flag: boolean): void;
//     send(
//       buffer: Buffer,
//       offset?: number,
//       length?: number,
//       port?: number,
//       address?: string,
//       callback?: (error?: Error | undefined) => void
//     ): void;
//     close(): void;
//   }
//   interface Device {
//     ip: string;
//     name: string;
//     role: "Client" | "Host";
//   }
// }

import { Permission } from "react-native";

import { Buffer } from "buffer";

declare module "*.png" {
  const value: any;
  export default value;
}

declare global {
  interface TransferProgress {
    fileId: string;
    fileName: string;
    transferredBytes: number;
    fileSize: number;
    speed: string;
    status: "Sending" | "Receiving" | "Completed" | "Failed";
    error?: string;
  }

  interface FileTransfer {
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
    aesKey?: string;
    iv?: string;
    lastChunkIndex: number;
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
  }
}
