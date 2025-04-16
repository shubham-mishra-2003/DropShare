import { networkInterfaces } from "os";
import { Logger } from "./Logger";

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

export const MAX_CONCURRENT_FILES = 15;
export const MAX_TOTAL_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
export const MAX_CONCURRENT_INCOMING = 3; // Limit simultaneous incoming transfers
export const QUEUE_RETRY_DELAY = 10_000; // 10s retry for queued clients

export function getLocalIPAddress(): Promise<string> {
  return new Promise((resolve, reject) => {
    const interfaces = networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const nets = interfaces[name] || [];
      for (const iface of nets) {
        if (iface.family === "IPv4" && !iface.internal) {
          resolve(iface.address);
          return;
        }
      }
    }
    reject(new Error("No local IPv4 address found"));
  });
}

export function setLastBlockTo255(ip: string): string {
  const parts = ip.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => isNaN(part) || part < 0 || part > 255)
  ) {
    throw new Error("Invalid IP address format");
  }
  parts[3] = 255;
  return parts.join(".");
}

export async function getBroadcastIPAddress(): Promise<string> {
  try {
    const localIP = await getLocalIPAddress();
    return setLastBlockTo255(localIP);
  } catch (error) {
    console.error("Error getting broadcast address:", error);
    throw error;
  }
}

export const calculateChunkSize = (fileSize: number): number => {
  if (fileSize <= 1024 * 1024) {
    Logger.info(`File size ${fileSize} bytes: Using 16KB chunks`);
    return 16 * 1024; // <1MB: 16KB chunks
  }
  if (fileSize <= 10 * 1024 * 1024) {
    Logger.info(`File size ${fileSize} bytes: Using 64KB chunks`);
    return 64 * 1024; // 1MB–10MB: 64KB chunks
  }
  if (fileSize <= 100 * 1024 * 1024) {
    Logger.info(`File size ${fileSize} bytes: Using 1MB chunks`);
    return 1024 * 1024; // 10MB–100MB: 1MB chunks
  }
  Logger.info(`File size ${fileSize} bytes: Using 4MB chunks`);
  return 4 * 1024 * 1024; // >100MB (up to 5GB): 4MB chunks
};

export const checkTransferLimits = (
  newFileSize: number,
  currentFiles: Map<string, FileTransfer>,
): boolean => {
  if (newFileSize > MAX_TOTAL_SIZE) {
    Logger.toast("File size exceeds 5GB limit", "error");
    return false;
  }

  const totalSize =
    Array.from(currentFiles.values()).reduce(
      (sum, file) => sum + file.totalSize,
      0,
    ) + newFileSize;
  if (totalSize > MAX_TOTAL_SIZE) {
    Logger.toast("Total transfer size exceeds 5GB limit", "error");
    return false;
  }

  if (currentFiles.size >= MAX_CONCURRENT_FILES) {
    Logger.toast("Maximum 15 concurrent files exceeded", "error");
    return false;
  }

  return true;
};

export const checkIncomingLimits = (
  currentFiles: Map<string, FileTransfer>,
): boolean => {
  const activeTransfers = Array.from(currentFiles.values()).filter(
    (file) => file.receivedBytes < file.totalSize,
  ).length;
  if (activeTransfers >= MAX_CONCURRENT_INCOMING) {
    Logger.toast("Too many incoming transfers, please wait", "warn");
    return false;
  }
  return true;
};
