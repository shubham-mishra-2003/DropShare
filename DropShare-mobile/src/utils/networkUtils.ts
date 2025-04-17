// import { NetworkInfo } from "react-native-network-info";

// export const getLocalIPAddress = async (): Promise<string> => {
//   try {
//     const localIP = await NetworkInfo.getIPV4Address();
//     return localIP || "0.0.0.0";
//   } catch (error) {
//     console.error("Error getting local IP:", error);
//     return "0.0.0.0";
//   }
// };

// function setLastBlockTo255(ip: string): string {
//   const parts = ip.split(".").map(Number);
//   if (
//     parts.length !== 4 ||
//     parts.some((part) => isNaN(part) || part < 0 || part > 255)
//   ) {
//     throw new Error("Invalid IP address format");
//   }
//   parts[3] = 255;
//   return parts.join(".");
// }

// export async function getBroadcastIPAddress(): Promise<string> {
//   try {
//     const localIP = await getLocalIPAddress();
//     return setLastBlockTo255(localIP);
//   } catch (error) {
//     console.error("Error getting broadcast address:", error);
//     throw error;
//   }
// }

// export const MAX_CONCURRENT_FILES = 15;
// export const MAX_TOTAL_SIZE = 5 * 1024 * 1024 * 1024; // 5GB

// export const calculateChunkSize = (fileSize: number): number => {
//   // Define bounds for chunk size
//   const MIN_CHUNK_SIZE = 1 * 1024 * 1024; // 1MB minimum
//   const MAX_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB maximum
//   const IDEAL_CHUNKS = 10; // Ideal number of chunks for smaller files

//   if (fileSize <= MIN_CHUNK_SIZE * IDEAL_CHUNKS) {
//     const chunkSize = Math.ceil(fileSize / IDEAL_CHUNKS);
//     return Math.max(chunkSize, 1024); // At least 1KB for tiny files
//   }

//   let chunkSize = MIN_CHUNK_SIZE;
//   const estimatedChunks = Math.ceil(fileSize / MAX_CHUNK_SIZE);
//   if (estimatedChunks > IDEAL_CHUNKS) {
//     chunkSize = Math.min(MAX_CHUNK_SIZE, Math.ceil(fileSize / estimatedChunks));
//   }

//   console.log("Chunk size: ", chunkSize);
//   console.log("Estimated no. of chunks: ", estimatedChunks);
//   return chunkSize;
// };

// import { NetworkInfo } from "react-native-network-info";
// import { Logger } from "./Logger";

// export const MAX_CONCURRENT_FILES = 15;
// export const MAX_TOTAL_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
// export const MAX_CONCURRENT_INCOMING = 3; // Limit simultaneous incoming transfers
// export const QUEUE_RETRY_DELAY = 10_000; // 10s retry for queued clients

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
//   const parts = ip.split(".").map(Number);
//   if (
//     parts.length !== 4 ||
//     parts.some((part) => isNaN(part) || part < 0 || part > 255)
//   ) {
//     throw new Error("Invalid IP address format");
//   }
//   parts[3] = 255;
//   return parts.join(".");
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

// export const calculateChunkSize = (fileSize: number): number => {
//   if (fileSize <= 1024 * 1024) {
//     Logger.info(`File size ${fileSize} bytes: Using 16KB chunks`);
//     return 16 * 1024; // <1MB: 16KB chunks
//   }
//   if (fileSize <= 10 * 1024 * 1024) {
//     Logger.info(`File size ${fileSize} bytes: Using 64KB chunks`);
//     return 64 * 1024; // 1MB–10MB: 64KB chunks
//   }
//   if (fileSize <= 100 * 1024 * 1024) {
//     Logger.info(`File size ${fileSize} bytes: Using 1MB chunks`);
//     return 1024 * 1024; // 10MB–100MB: 1MB chunks
//   }
//   Logger.info(`File size ${fileSize} bytes: Using 4MB chunks`);
//   return 4 * 1024 * 1024; // >100MB (up to 5GB): 4MB chunks
// };

// export const checkTransferLimits = (
//   newFileSize: number,
//   currentFiles: Map<string, FileTransfer>
// ): boolean => {
//   if (newFileSize > MAX_TOTAL_SIZE) {
//     Logger.toast("File size exceeds 5GB limit", "error");
//     return false;
//   }

//   const totalSize =
//     Array.from(currentFiles.values()).reduce(
//       (sum, file) => sum + file.totalSize,
//       0
//     ) + newFileSize;
//   if (totalSize > MAX_TOTAL_SIZE) {
//     Logger.toast("Total transfer size exceeds 5GB limit", "error");
//     return false;
//   }

//   if (currentFiles.size >= MAX_CONCURRENT_FILES) {
//     Logger.toast("Maximum 15 concurrent files exceeded", "error");
//     return false;
//   }

//   return true;
// };

// export const checkIncomingLimits = (
//   currentFiles: Map<string, FileTransfer>
// ): boolean => {
//   const activeTransfers = Array.from(currentFiles.values()).filter(
//     (file) => file.receivedBytes < file.totalSize
//   ).length;
//   if (activeTransfers >= MAX_CONCURRENT_INCOMING) {
//     Logger.toast("Too many incoming transfers, please wait", "warn");
//     return false;
//   }
//   return true;
// };

import { NetworkInfo } from "react-native-network-info";
import { Logger } from "./Logger";

export const MAX_CONCURRENT_FILES = 15;
export const MAX_TOTAL_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
export const MAX_CONCURRENT_INCOMING = 3;
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

export const calculateDynamicChunkDivision = (fileSize: number): ChunkDivisionResult => {
  const MIN_CHUNK_SIZE = 1024; // 1KB
  const MAX_CHUNK_SIZE = 64 * 1024; // 64KB

  let chunkSize: number;
  let numChunks: number;

  if (fileSize <= MIN_CHUNK_SIZE) {
    // Handle very small files
    chunkSize = fileSize;
    numChunks = 1;
  } else {
    // Calculate initial number of chunks using max chunk size
    numChunks = Math.ceil(fileSize / MAX_CHUNK_SIZE);

    // Calculate chunk size to distribute file size evenly
    chunkSize = Math.ceil(fileSize / numChunks);

    // Ensure chunk size stays within bounds
    if (chunkSize < MIN_CHUNK_SIZE) {
      chunkSize = MIN_CHUNK_SIZE;
      numChunks = Math.ceil(fileSize / chunkSize);
    } else if (chunkSize > MAX_CHUNK_SIZE) {
      chunkSize = MAX_CHUNK_SIZE;
      numChunks = Math.ceil(fileSize / chunkSize);
    }

    // Handle uneven division by adjusting last chunk
    // This ensures chunks are as equal as
    const remainder = fileSize % chunkSize;
    if (remainder > 0 && remainder < MIN_CHUNK_SIZE) {
      // Redistribute by slightly reducing chunk size to make chunks more even
      numChunks++;
      chunkSize = Math.ceil(fileSize / numChunks);
    }
  }
  return { chunkSize, numChunks };
}

export const checkTransferLimits = (
  newFileSize: number,
  currentFiles: Map<string, FileTransfer>
): boolean => {
  if (newFileSize > MAX_TOTAL_SIZE) {
    Logger.toast("File size exceeds 5GB limit", "error");
    Logger.info(
      `Transfer limit check failed: File size ${newFileSize} > ${MAX_TOTAL_SIZE}`
    );
    return false;
  }

  const totalSize =
    Array.from(currentFiles.values()).reduce(
      (sum, file) => sum + file.totalSize,
      0
    ) + newFileSize;
  if (totalSize > MAX_TOTAL_SIZE) {
    Logger.toast("Total transfer size exceeds 5GB limit", "error");
    Logger.info(
      `Transfer limit check failed: Total size ${totalSize} > ${MAX_TOTAL_SIZE}`
    );
    return false;
  }

  if (currentFiles.size >= MAX_CONCURRENT_FILES) {
    Logger.toast("Maximum 15 concurrent files exceeded", "error");
    Logger.info(
      `Transfer limit check failed: ${currentFiles.size} >= ${MAX_CONCURRENT_FILES}`
    );
    return false;
  }

  Logger.info(`Transfer limit check passed for file size ${newFileSize}`);
  return true;
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
