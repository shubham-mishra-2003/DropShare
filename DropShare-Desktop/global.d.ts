import { ElectronAPI } from "@electron-toolkit/preload";

declare global {
  interface Window {
    electron: ElectronAPI & {
      getDrives: () => Promise<DriveInfo[]>;
      getFiles: (drive: string) => Promise<string[]>;
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
