import { NetworkInfo } from "react-native-network-info";
import { Logger } from "./Logger";

export const MAX_CONCURRENT_FILES = 15;
export const MAX_TOTAL_SIZE = 1 * 1024 * 1024 * 1024; // 1GB
export const MAX_CONCURRENT_INCOMING = 2; // Reduced from 3
export const QUEUE_RETRY_DELAY = 10_000;

export const getLocalIPAddress = async (): Promise<string> => {
  try {
    const localIP = await NetworkInfo.getIPV4Address();
    const ip = localIP || "0.0.0.0";
    Logger.info(`Local IP: ${ip}`);
    return ip;
  } catch (error) {
    Logger.error("Error getting local IP", error);
    return "0.0.0.0";
  }
};

function setLastBlockTo255(ip: string): string {
  try {
    const parts = ip.split(".").map(Number);
    if (
      parts.length !== 4 ||
      parts.some((part) => isNaN(part) || part < 0 || part > 255)
    ) {
      throw new Error("Invalid IP address format");
    }
    parts[3] = 255;
    const broadcastIP = parts.join(".");
    Logger.info(`Computed broadcast IP: ${broadcastIP}`);
    return broadcastIP;
  } catch (error) {
    Logger.error(`Invalid IP format: ${ip}`, error);
    throw error;
  }
}

export async function getBroadcastIPAddress(): Promise<string> {
  try {
    const localIP = await getLocalIPAddress();
    const broadcastIP = setLastBlockTo255(localIP);
    Logger.info(`Broadcast IP: ${broadcastIP}`);
    return broadcastIP;
  } catch (error) {
    Logger.error("Error getting broadcast address", error);
    throw error;
  }
}

interface ChunkDivisionResult {
  chunkSize: number;
  numChunks: number;
}

export const calculateDynamicChunkDivision = (
  fileSize: number
): ChunkDivisionResult => {
  const MIN_CHUNK_SIZE = 1024; // 1KB
  const MAX_CHUNK_SIZE = 64 * 1024; // 64KB
  let chunkSize: number;
  let numChunks: number;
  if (fileSize <= MIN_CHUNK_SIZE) {
    chunkSize = fileSize;
    numChunks = 1;
  } else {
    numChunks = Math.ceil(fileSize / MAX_CHUNK_SIZE);
    chunkSize = Math.ceil(fileSize / numChunks);
    if (chunkSize < MIN_CHUNK_SIZE) {
      chunkSize = MIN_CHUNK_SIZE;
      numChunks = Math.ceil(fileSize / chunkSize);
    } else if (chunkSize > MAX_CHUNK_SIZE) {
      chunkSize = MAX_CHUNK_SIZE;
      numChunks = Math.ceil(fileSize / chunkSize);
    }
    const remainder = fileSize % chunkSize;
    if (remainder > 0 && remainder < MIN_CHUNK_SIZE) {
      numChunks++;
      chunkSize = Math.ceil(fileSize / numChunks);
    }
  }
  return { chunkSize, numChunks };
};

export const checkTransferLimits = (
  fileSize: number,
  fileTransfers: Map<string, FileTransfer>
): boolean => {
  const MAX_CONCURRENT_TRANSFERS = 5;
  const MAX_TOTAL_SIZE = 10 * 1024 * 1024 * 1024; // 10GB

  let totalSize = fileSize;
  for (const transfer of fileTransfers.values()) {
    totalSize += transfer.totalSize;
  }

  return (
    fileTransfers.size < MAX_CONCURRENT_TRANSFERS && totalSize <= MAX_TOTAL_SIZE
  );
};

export const checkIncomingLimits = (
  currentFiles: Map<string, FileTransfer>
): boolean => {
  const activeTransfers = Array.from(currentFiles.values()).filter(
    (file) => file.receivedBytes < file.totalSize
  ).length;
  if (activeTransfers >= MAX_CONCURRENT_INCOMING) {
    Logger.toast("Too many incoming transfers, please wait", "warn");
    Logger.info(
      `Incoming limit check failed: ${activeTransfers} >= ${MAX_CONCURRENT_INCOMING}`
    );
    return false;
  }
  Logger.info(
    `Incoming limit check passed: ${activeTransfers} active transfers`
  );
  return true;
};

// import { NetworkInfo } from "react-native-network-info";
// import { Logger } from "./Logger";

// export const MAX_CONCURRENT_FILES = 15;
// export const MAX_TOTAL_SIZE = 1 * 1024 * 1024 * 1024; // 1GB
// export const MAX_CONCURRENT_INCOMING = 2; // Reduced from 3
// export const QUEUE_RETRY_DELAY = 10_000;

// export const getLocalIPAddress = async (): Promise<string> => {
//   try {
//     const localIP = await NetworkInfo.getIPV4Address();
//     const ip = localIP || "0.0.0.0";
//     Logger.info(`Local IP: ${ip}`);
//     return ip;
//   } catch (error) {
//     Logger.error("Error getting local IP", error);
//     return "0.0.0.0";
//   }
// };

// function setLastBlockTo255(ip: string): string {
//   try {
//     const parts = ip.split(".").map(Number);
//     if (
//       parts.length !== 4 ||
//       parts.some((part) => isNaN(part) || part < 0 || part > 255)
//     ) {
//       throw new Error("Invalid IP address format");
//     }
//     parts[3] = 255;
//     const broadcastIP = parts.join(".");
//     Logger.info(`Computed broadcast IP: ${broadcastIP}`);
//     return broadcastIP;
//   } catch (error) {
//     Logger.error(`Invalid IP format: ${ip}`, error);
//     throw error;
//   }
// }

// export async function getBroadcastIPAddress(): Promise<string> {
//   try {
//     const localIP = await getLocalIPAddress();
//     const broadcastIP = setLastBlockTo255(localIP);
//     Logger.info(`Broadcast IP: ${broadcastIP}`);
//     return broadcastIP;
//   } catch (error) {
//     Logger.error("Error getting broadcast address", error);
//     throw error;
//   }
// }

// interface ChunkDivisionResult {
//   chunkSize: number;
//   numChunks: number;
// }

// export const calculateDynamicChunkDivision = (
//   fileSize: number
// ): ChunkDivisionResult => {
//   const MIN_CHUNK_SIZE = 64 * 1024; // 64KB
//   const MAX_CHUNK_SIZE = 1 * 1024 * 1024; // 1MB
//   let chunkSize: number;
//   let numChunks: number;

//   if (fileSize <= MIN_CHUNK_SIZE) {
//     chunkSize = fileSize;
//     numChunks = 1;
//   } else {
//     // Target ~1000 chunks for large files, adjust for smaller files
//     numChunks = Math.ceil(fileSize / MAX_CHUNK_SIZE);
//     chunkSize = Math.ceil(fileSize / numChunks);
//     if (chunkSize < MIN_CHUNK_SIZE) {
//       chunkSize = MIN_CHUNK_SIZE;
//       numChunks = Math.ceil(fileSize / chunkSize);
//     } else if (chunkSize > MAX_CHUNK_SIZE) {
//       chunkSize = MAX_CHUNK_SIZE;
//       numChunks = Math.ceil(fileSize / chunkSize);
//     }
//     // Ensure last chunk isn't too small
//     const remainder = fileSize % chunkSize;
//     if (remainder > 0 && remainder < MIN_CHUNK_SIZE) {
//       numChunks++;
//       chunkSize = Math.ceil(fileSize / numChunks);
//     }
//   }

//   Logger.info(
//     `Chunk division: fileSize=${fileSize}, chunkSize=${chunkSize}, numChunks=${numChunks}`
//   );
//   return { chunkSize, numChunks };
// };

// export const checkTransferLimits = (
//   fileSize: number,
//   fileTransfers: Map<string, FileTransfer>
// ): boolean => {
//   const MAX_CONCURRENT_TRANSFERS = 5;
//   const MAX_TOTAL_SIZE = 10 * 1024 * 1024 * 1024; // 10GB

//   let totalSize = fileSize;
//   for (const transfer of fileTransfers.values()) {
//     totalSize += transfer.totalSize;
//   }

//   return (
//     fileTransfers.size < MAX_CONCURRENT_TRANSFERS && totalSize <= MAX_TOTAL_SIZE
//   );
// };

// export const checkIncomingLimits = (
//   currentFiles: Map<string, FileTransfer>
// ): boolean => {
//   const activeTransfers = Array.from(currentFiles.values()).filter(
//     (file) => file.receivedBytes < file.totalSize
//   ).length;
//   if (activeTransfers >= MAX_CONCURRENT_INCOMING) {
//     Logger.toast("Too many incoming transfers, please wait", "warn");
//     Logger.info(
//       `Incoming limit check failed: ${activeTransfers} >= ${MAX_CONCURRENT_INCOMING}`
//     );
//     return false;
//   }
//   Logger.info(
//     `Incoming limit check passed: ${activeTransfers} active transfers`
//   );
//   return true;
// };
