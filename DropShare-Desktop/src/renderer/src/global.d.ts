import { ElectronAPI } from "@electron-toolkit/preload";

declare global {
  interface Window {
    electron: ElectronAPI & {
      handleMinimize: () => void;
      handleMaximize: () => void;
      handleClose: () => void;
      openFilePicker: () => Promise<string>;
      invoke: (channel: string, data?: any) => Promise<any>;
      getDrives: () => Promise<DriveInfo[]>;
      getFoundDevices: () => Promise<Device[]>;
      getFiles: (drive: string) => Promise<string[]>;
      startDiscovery: (username: string) => Promise<string>;
      // onDeviceFound: (callback: (device: Device) => void) => void;
      sendFile: (filePath: string, device: Device) => Promise<void>;
      selectFile: () => Promise<FileInfo | null>;
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
    address: string;
    name: string;
    lastSeen?: number
  }
  interface FileInfo {
    name: string;
    path: string;
  }
}

// declare module "node-mtp" {
//   export interface MTPDevice {
//     name: string;
//     id: string;
//   }

//   export interface MTPFile {
//     name: string;
//     size: number;
//     path: string;
//   }

//   export function connect(): boolean;
//   export function disconnect(): void;
//   export function getDevices(): MTPDevice[];
//   export function getFiles(deviceId: string): MTPFile[];
// }

export {};
