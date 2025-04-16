import { contextBridge, ipcRenderer } from "electron";
import net from "net";
import { Buffer } from "buffer";

// Define the Electron API interface matching NetworkProvider.tsx expectations
interface ElectronAPI {
  // Window controls
  handleMinimize: () => void;
  handleMaximize: () => void;
  handleClose: () => void;
  // File system
  getDrives: () => Promise<string[]>;
  getFiles: (drive: string) => Promise<any[]>;
  selectFile: () => Promise<{ filePath: string; fileData: Buffer } | null>;
  // Network operations (Host)
  startHostServer: (
    username: string,
    setDevices: (devices: Device[]) => void,
    setSocket: (socket: net.Server | null) => void,
    setMessages: React.Dispatch<React.SetStateAction<string[]>>,
    setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
    setTransferProgress?: (progress: {
      [fileId: string]: { progress: string; speed: string; percentage: number };
    }) => void,
  ) => Promise<void>;
  sendHostMessage: (message: string, username: string) => Promise<void>;
  sendHostFile: (
    filePath: string,
    fileData: Buffer,
    username: string,
    setTransferProgress?: (progress: {
      [fileId: string]: { progress: string; speed: string; percentage: number };
    }) => void,
  ) => Promise<void>;
  stopHosting: () => void;
  // Network operations (Client)
  startClientDiscovery: (
    username: string,
    setDevices: (devices: Device[]) => void,
  ) => Promise<() => void>;
  connectToHost: (
    ip: string,
    username: string,
    hostPublicKey: string,
    setConnected: (connected: boolean) => void,
    setSocket: (socket: net.Socket | null) => void,
    setMessages: React.Dispatch<React.SetStateAction<string[]>>,
    setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
    setTransferProgress?: (progress: {
      [fileId: string]: { progress: string; speed: string; percentage: number };
    }) => void,
  ) => Promise<void>;
  sendMessage: (
    socket: net.Socket | null,
    message: string,
    username: string,
    hostPublicKey: string,
  ) => Promise<void>;
  sendFile: (
    socket: net.Socket | null,
    filePath: string,
    fileData: Buffer,
    username: string,
    hostPublicKey: string,
    setTransferProgress?: (progress: {
      [fileId: string]: { progress: string; speed: string; percentage: number };
    }) => void,
  ) => Promise<void>;
  disconnectClient: () => void;
  // Chunk storage operations
  initializeChunkStorage: () => Promise<void>;
  generateFileId: (
    senderIp: string,
    fileName: string,
    timestamp: number,
  ) => Promise<string>;
  saveChunk: (
    fileId: string,
    chunkIndex: number,
    chunkData: Buffer,
  ) => Promise<void>;
  getChunk: (fileId: string, chunkIndex: number) => Promise<Buffer | null>;
  saveTransferRecord: (
    fileId: string,
    fileName: string,
    totalSize: number,
    chunkSize: number,
    totalChunks: number,
    senderIp: string,
  ) => Promise<void>;
  updateLastChunkIndex: (
    fileId: string,
    lastChunkIndex: number,
    status: "in_progress" | "completed" | "interrupted",
  ) => Promise<void>;
  getTransferRecord: (fileId: string) => Promise<any>;
  deleteTransfer: (fileId: string) => Promise<void>;
  assembleFile: (fileId: string, fileName: string) => Promise<string>;
  // Event listeners
  on: (channel: string, listener: (...args: any[]) => void) => void;
}

const api: ElectronAPI = {
  handleMinimize: () => ipcRenderer.send("minimize"),
  handleMaximize: () => ipcRenderer.send("maximize"),
  handleClose: () => ipcRenderer.send("close"),
  getDrives: () => ipcRenderer.invoke("get-drives"),
  getFiles: (drive: string) => ipcRenderer.invoke("get-files", drive),
  selectFile: () => ipcRenderer.invoke("select-file"),
  startHostServer: (
    username,
    setDevices,
    setSocket,
    setMessages,
    setReceivedFiles,
    setTransferProgress,
  ) =>
    ipcRenderer.invoke(
      "start-hosting",
      username,
      setDevices,
      setSocket,
      setMessages,
      setReceivedFiles,
      setTransferProgress,
    ),
  sendHostMessage: (message, username) =>
    ipcRenderer.invoke("send-host-message", message, username),
  sendHostFile: (filePath, fileData, username, setTransferProgress) =>
    ipcRenderer.invoke(
      "send-host-file",
      filePath,
      fileData,
      username,
      setTransferProgress,
    ),
  stopHosting: () => ipcRenderer.send("stop-hosting"),
  startClientDiscovery: (username, setDevices) =>
    ipcRenderer.invoke("start-client-discovery", username, setDevices),
  connectToHost: (
    ip,
    username,
    hostPublicKey,
    setConnected,
    setSocket,
    setMessages,
    setReceivedFiles,
    setTransferProgress,
  ) =>
    ipcRenderer.invoke(
      "connect-to-host",
      ip,
      username,
      hostPublicKey,
      setConnected,
      setSocket,
      setMessages,
      setReceivedFiles,
      setTransferProgress,
    ),
  sendMessage: (socket, message, username, hostPublicKey) =>
    ipcRenderer.invoke(
      "send-message",
      socket,
      message,
      username,
      hostPublicKey,
    ),
  sendFile: (
    socket,
    filePath,
    fileData,
    username,
    hostPublicKey,
    setTransferProgress,
  ) =>
    ipcRenderer.invoke(
      "send-file",
      socket,
      filePath,
      fileData,
      username,
      hostPublicKey,
      setTransferProgress,
    ),
  disconnectClient: () => ipcRenderer.send("disconnect-client"),
  // Chunk storage operations
  initializeChunkStorage: () => ipcRenderer.invoke("initialize-chunk-storage"),
  generateFileId: (senderIp, fileName, timestamp) =>
    ipcRenderer.invoke("generate-file-id", senderIp, fileName, timestamp),
  saveChunk: (fileId, chunkIndex, chunkData) =>
    ipcRenderer.invoke("save-chunk", fileId, chunkIndex, chunkData),
  getChunk: (fileId, chunkIndex) =>
    ipcRenderer.invoke("get-chunk", fileId, chunkIndex),
  saveTransferRecord: (
    fileId,
    fileName,
    totalSize,
    chunkSize,
    totalChunks,
    senderIp,
  ) =>
    ipcRenderer.invoke(
      "save-transfer-record",
      fileId,
      fileName,
      totalSize,
      chunkSize,
      totalChunks,
      senderIp,
    ),
  updateLastChunkIndex: (fileId, lastChunkIndex, status) =>
    ipcRenderer.invoke(
      "update-last-chunk-index",
      fileId,
      lastChunkIndex,
      status,
    ),
  getTransferRecord: (fileId) =>
    ipcRenderer.invoke("get-transfer-record", fileId),
  deleteTransfer: (fileId) => ipcRenderer.invoke("delete-transfer", fileId),
  assembleFile: (fileId, fileName) =>
    ipcRenderer.invoke("assemble-file", fileId, fileName),
  on: (channel, listener) => ipcRenderer.on(channel, listener),
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", api);
  } catch (error) {
    console.error("Error exposing API:", error);
  }
} else {
  (window as any).electron = api;
}
