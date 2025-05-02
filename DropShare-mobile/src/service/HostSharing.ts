// // implemented chunk storage but lacks
// import {
//   calculateDynamicChunkDivision,
//   checkTransferLimits,
// } from "../utils/NetworkUtils";
// import RNFS from "react-native-fs";
// import { Buffer } from "buffer";
// import { Logger } from "../utils/Logger";
// import { DropShareError, ERROR_CODES } from "../utils/Error";
// import TCPSocket from "react-native-tcp-socket";
// import { ChunkStorage } from "./ChunkStorage";
// import CryptoJS from "crypto-js";

// // Interfaces
// interface FileHeader {
//   protocolVersion: string;
//   name: string;
//   size: number;
//   sender: string;
//   fileId: string;
//   totalChunks: number;
//   chunkSize: number;
// }

// interface HostReceiveProps {
//   socket: TCPSocket.Socket;
//   data: string | Buffer;
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
//   setMessages: React.Dispatch<React.SetStateAction<string[]>>;
//   connectedSockets: TCPSocket.Socket[];
//   setTransferProgress?: React.Dispatch<
//     React.SetStateAction<TransferProgress[]>
//   >;
// }

// const fileTransfers = new Map<string, FileTransfer>();
// let buffer = Buffer.alloc(0);
// let receivingFile = false;
// let fileId = "";
// let lastLoggedChunkIndex: number | null = null;

// const MAX_RETRIES = 3;
// const ACK_TIMEOUT = 60000; // 60s for slower networks
// const PROTOCOL_VERSION = "1.0";
// const MAX_CONCURRENT_CHUNKS = 5;
// const MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10 MB

// export const HostSharing = () => {
//   async function sendFile(
//     socket: TCPSocket.Socket,
//     fileName: string,
//     filePath: string,
//     deviceName: string,
//     fileId: string,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     const chunkStorage = ChunkStorage.getInstance();
//     let transfer: FileTransfer = {
//       fileId,
//       fileName,
//       fileSize: 0,
//       deviceName,
//       senderIp: socket.localAddress || "unknown",
//       chunks: [],
//       receivedBytes: 0,
//       startTime: Date.now(),
//       totalChunks: 0,
//       chunkSize: 0,
//       totalSize: 0,
//       chunkHashes: [],
//       aesKey: undefined,
//       iv: undefined,
//       status: "Sending",
//       progress: 0,
//       lastChunkIndex: -1,
//       completedChunks: new Set(),
//       availableChunks: [], // Initialize to fix usage with global FileTransfer
//     };
//     fileTransfers.set(fileId, transfer);

//     // Map to track pending acknowledgment promises
//     const pendingAcks = new Map<
//       string,
//       { resolve: () => void; reject: (error: Error) => void }
//     >();
//     // Buffer for incoming data
//     let dataBuffer = Buffer.alloc(0);

//     // Persistent data listener
//     const onData = (data: string | Buffer) => {
//       const dataBufferInput =
//         typeof data === "string" ? Buffer.from(data) : data;
//       dataBuffer = Buffer.concat([dataBuffer, dataBufferInput]);
//       while (dataBuffer.length > 0) {
//         const messageEnd = dataBuffer.indexOf(Buffer.from("\n"));
//         if (messageEnd === -1) break; // Wait for complete message
//         const message = dataBuffer.slice(0, messageEnd).toString();
//         dataBuffer = dataBuffer.slice(messageEnd + 1);

//         Logger.info(`Received message: ${message}`);
//         if (message.startsWith(`ACK_RESET:${fileId}`)) {
//           const key = `RESET:${fileId}`;
//           const { resolve } = pendingAcks.get(key) || {};
//           if (resolve) {
//             resolve();
//             pendingAcks.delete(key);
//           }
//         } else if (message.startsWith(`ACK_FILE:${fileId}`)) {
//           const key = `FILE:${fileId}`;
//           const { resolve } = pendingAcks.get(key) || {};
//           if (resolve) {
//             const parts = message.split(":");
//             const availableChunks = parts[2] ? JSON.parse(parts[2]) : [];
//             transfer.availableChunks = availableChunks; // Store for filtering
//             resolve();
//             pendingAcks.delete(key);
//           }
//         } else if (message.startsWith(`ACK_CHUNK:${fileId}:`)) {
//           const [, , , chunkIndex] = message.split(":");
//           const key = `CHUNK:${fileId}:${chunkIndex}`;
//           const { resolve } = pendingAcks.get(key) || {};
//           if (resolve) {
//             resolve();
//             pendingAcks.delete(key);
//           }
//         } else if (message.startsWith(`ACK_COMPLETE:${fileId}`)) {
//           const key = `COMPLETE:${fileId}`;
//           const { resolve } = pendingAcks.get(key) || {};
//           if (resolve) {
//             resolve();
//             pendingAcks.delete(key);
//           }
//         } else if (message.startsWith("ERROR:")) {
//           const [, code, ...msgParts] = message.split(":");
//           const errorMsg = msgParts.join(":");
//           const error = new DropShareError(code, `Receiver error: ${errorMsg}`);
//           const key = pendingAcks.keys().next().value; // Reject the oldest pending promise
//           if (key) {
//             const { reject } = pendingAcks.get(key) || {};
//             if (reject) {
//               reject(error);
//               pendingAcks.delete(key);
//             }
//           }
//         }
//       }
//     };

//     socket.on("data", onData);

//     try {
//       const stat = await RNFS.stat(filePath);
//       const fileSize = stat.size;
//       const { chunkSize, numChunks: totalChunks } =
//         calculateDynamicChunkDivision(fileSize);

//       transfer = {
//         ...transfer,
//         fileSize,
//         totalChunks,
//         chunkSize,
//         totalSize: fileSize,
//         chunks: new Array(totalChunks).fill(undefined),
//         chunkHashes: new Array(totalChunks).fill(""),
//       };
//       fileTransfers.set(fileId, transfer);

//       let retries = 0;
//       while (retries < MAX_RETRIES) {
//         try {
//           if (retries > 0) {
//             await new Promise<void>((resolve, reject) => {
//               const timeout = setTimeout(() => {
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.NETWORK_ERROR,
//                     `Timeout waiting for ACK_RESET (attempt ${retries + 1})`
//                   )
//                 );
//               }, ACK_TIMEOUT);
//               pendingAcks.set(`RESET:${fileId}`, { resolve, reject });
//               socket.write(Buffer.from(`RESET:${fileId}\n`));
//               Logger.info(`Sent RESET for ${fileId}`);
//             });
//           }

//           let availableChunks: number[] = [];
//           await new Promise<void>((resolve, reject) => {
//             const timeout = setTimeout(() => {
//               reject(
//                 new DropShareError(
//                   ERROR_CODES.NETWORK_ERROR,
//                   `Timeout waiting for ACK_FILE (attempt ${retries + 1})`
//                 )
//               );
//             }, ACK_TIMEOUT);
//             pendingAcks.set(`FILE:${fileId}`, { resolve, reject });
//             const header: FileHeader = {
//               protocolVersion: PROTOCOL_VERSION,
//               name: fileName,
//               size: fileSize,
//               sender: deviceName,
//               fileId,
//               totalChunks,
//               chunkSize,
//             };
//             socket.write(Buffer.from(`FILE:${JSON.stringify(header)}\n\n`));
//             Logger.info(`Sent header for ${fileId}: ${JSON.stringify(header)}`);
//           });

//           const pendingChunks = Array.from(
//             { length: totalChunks },
//             (_, i) => i
//           ).filter((i) => !availableChunks.includes(i));
//           let sentBytes = availableChunks.reduce(
//             (sum, i) => sum + Math.min(chunkSize, fileSize - i * chunkSize),
//             0
//           );

//           const sendChunk = async (chunkIndex: number): Promise<void> => {
//             const start = chunkIndex * chunkSize;
//             const actualChunkSize = Math.min(chunkSize, fileSize - start);
//             const chunk = await RNFS.read(
//               filePath,
//               actualChunkSize,
//               start,
//               "base64"
//             );
//             const chunkBuffer = Buffer.from(chunk, "base64");
//             const chunkHash = CryptoJS.SHA256(
//               CryptoJS.enc.Base64.parse(chunk)
//             ).toString(CryptoJS.enc.Hex);
//             transfer.chunkHashes[chunkIndex] = chunkHash;
//             fileTransfers.set(fileId, transfer);

//             await new Promise<void>((resolve, reject) => {
//               const timeout = setTimeout(() => {
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.NETWORK_ERROR,
//                     `Timeout waiting for ACK_CHUNK:${chunkIndex} (attempt ${
//                       retries + 1
//                     })`
//                   )
//                 );
//               }, ACK_TIMEOUT);
//               pendingAcks.set(`CHUNK:${fileId}:${chunkIndex}`, {
//                 resolve,
//                 reject,
//               });
//               const chunkHeader = Buffer.from(
//                 `CHUNK:${JSON.stringify({
//                   fileId,
//                   chunkIndex,
//                   chunkSize: actualChunkSize,
//                   chunkHash,
//                 })}\n\n`
//               );
//               socket.write(Buffer.concat([chunkHeader, Buffer.from(chunk)]));
//               Logger.info(
//                 `Sent chunk ${
//                   chunkIndex + 1
//                 }/${totalChunks} for ${fileId} (${actualChunkSize} bytes, hash: ${chunkHash})`
//               );
//             });

//             sentBytes += chunk.length; // Use base64-encoded size
//             const percentage = (sentBytes / ((fileSize * 4) / 3)) * 100; // Adjust for base64
//             const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
//             const speed = (sentBytes / elapsedTime / 1024 / 1024).toFixed(2);

//             transfer.receivedBytes = sentBytes;
//             transfer.progress = percentage;
//             transfer.lastChunkIndex = chunkIndex;
//             transfer.completedChunks.add(chunkIndex);
//             fileTransfers.set(fileId, transfer);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== fileId),
//               {
//                 fileId,
//                 fileName,
//                 progress: `${(sentBytes / (1024 * 1024)).toFixed(2)}/${(
//                   (fileSize * 4) /
//                   3 /
//                   (1024 * 1024)
//                 ).toFixed(2)} MB`,
//                 speed: `${speed} MB/s`,
//                 percentage,
//               },
//             ]);
//           };

//           const queue = pendingChunks.slice();
//           const activePromises: Promise<void>[] = [];
//           while (queue.length > 0 || activePromises.length > 0) {
//             while (
//               queue.length > 0 &&
//               activePromises.length < MAX_CONCURRENT_CHUNKS
//             ) {
//               const chunkIndex = queue.shift()!;
//               activePromises.push(sendChunk(chunkIndex));
//             }
//             try {
//               await Promise.race(activePromises);
//             } catch (error) {
//               Logger.warn(`Chunk send failed: ${error}`);
//             }
//             activePromises.splice(
//               0,
//               activePromises.length,
//               ...activePromises.filter((p) => p !== Promise.resolve())
//             );
//           }
//           await Promise.all(activePromises);

//           await new Promise<void>((resolve, reject) => {
//             const timeout = setTimeout(() => {
//               reject(
//                 new DropShareError(
//                   ERROR_CODES.NETWORK_ERROR,
//                   `Timeout waiting for ACK_COMPLETE (attempt ${retries + 1})`
//                 )
//               );
//             }, ACK_TIMEOUT);
//             pendingAcks.set(`COMPLETE:${fileId}`, { resolve, reject });
//           });

//           transfer.status = "Completed";
//           transfer.endTime = Date.now();
//           transfer.progress = 100;
//           fileTransfers.set(fileId, transfer);
//           const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
//           const speed = (
//             (fileSize * 4) /
//             3 /
//             elapsedTime /
//             1024 /
//             1024
//           ).toFixed(2);
//           setTransferProgress?.((prev) => [
//             ...prev.filter((p) => p.fileId !== fileId),
//             {
//               fileId,
//               fileName,
//               progress: `${((fileSize * 4) / 3 / (1024 * 1024)).toFixed(2)}/${(
//                 (fileSize * 4) /
//                 3 /
//                 (1024 * 1024)
//               ).toFixed(2)} MB`,
//               speed: `${speed} MB/s`,
//               percentage: 100,
//             },
//           ]);
//           break;
//         } catch (error) {
//           retries++;
//           if (retries === MAX_RETRIES) {
//             throw error;
//           }
//           Logger.warn(`Retrying file send for ${fileId} after error: ${error}`);
//           await new Promise((resolve) => setTimeout(resolve, 2000));
//         }
//       }
//     } catch (error) {
//       const err = DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         `Transfer failed: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`
//       );
//       transfer.status = "Failed";
//       transfer.error = err.message;
//       fileTransfers.set(fileId, transfer);
//       setTransferProgress?.((prev) => [
//         ...prev.filter((p) => p.fileId !== fileId),
//         {
//           fileId,
//           fileName,
//           progress: `${(transfer.receivedBytes / (1024 * 1024)).toFixed(2)}/${(
//             (transfer.totalSize * 4) /
//             3 /
//             (1024 * 1024)
//           ).toFixed(2)} MB`,
//           speed: "0 MB/s",
//           percentage: transfer.progress,
//           error: err.message,
//         },
//       ]);
//       Logger.error(`Error in file transfer for ${fileName}`, error);
//       throw err;
//     } finally {
//       socket.removeListener("data", onData);
//       if (transfer.status === "Completed" || transfer.status === "Failed") {
//         await chunkStorage.clearChunks(fileId);
//         fileTransfers.delete(fileId);
//       }
//     }
//   }

//   async function receiveFileInHost({
//     data,
//     setMessages,
//     setReceivedFiles,
//     socket,
//     connectedSockets,
//     setTransferProgress,
//   }: HostReceiveProps): Promise<void> {
//     const chunkStorage = ChunkStorage.getInstance();
//     try {
//       if (buffer.length > MAX_BUFFER_SIZE) {
//         Logger.error("Buffer size exceeded, clearing buffer");
//         buffer = Buffer.alloc(0);
//         throw new DropShareError(
//           ERROR_CODES.NETWORK_ERROR,
//           "Buffer size exceeded"
//         );
//       }
//       buffer = Buffer.concat([
//         buffer,
//         typeof data === "string" ? Buffer.from(data) : data,
//       ]);
//       Logger.info(
//         `Received ${data.length} bytes, buffer now ${buffer.length} bytes`
//       );

//       while (buffer.length > 0) {
//         const dataStr = buffer.toString();

//         if (dataStr.startsWith("RESET:")) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) {
//             Logger.info(
//               `Incomplete RESET from ${
//                 socket.remoteAddress ?? "unknown"
//               }, waiting...`
//             );
//             return;
//           }
//           const resetFileId = dataStr.slice(6, messageEnd);
//           Logger.info(`Received RESET for fileId ${resetFileId}`);
//           if (resetFileId === fileId || !fileId) {
//             receivingFile = false;
//             fileTransfers.delete(resetFileId);
//             await chunkStorage.clearChunks(resetFileId);
//             fileId = "";
//           }
//           socket.write(Buffer.from(`ACK_RESET:${resetFileId}\n`));
//           buffer = buffer.slice(messageEnd + 1);
//           continue;
//         }

//         if (receivingFile) {
//           if (dataStr.startsWith("CHUNK:")) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(`Incomplete CHUNK header from client, waiting...`);
//               return;
//             }
//             const headerStr = buffer.slice(6, headerEnd).toString();
//             let chunkData: {
//               fileId: string;
//               chunkIndex: number;
//               chunkSize: number;
//               chunkHash: string;
//             };
//             try {
//               chunkData = JSON.parse(headerStr);
//             } catch (error) {
//               Logger.error(
//                 `Failed to parse CHUNK header for fileId ${fileId}: ${headerStr}`,
//                 error
//               );
//               buffer = Buffer.alloc(0); // Reset buffer on parse error
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 "Invalid chunk header"
//               );
//             }

//             const transfer = fileTransfers.get(chunkData.fileId);
//             if (
//               transfer &&
//               transfer.completedChunks.has(chunkData.chunkIndex)
//             ) {
//               socket.write(
//                 Buffer.from(
//                   `ACK_CHUNK:${chunkData.fileId}:${chunkData.chunkIndex}\n`
//                 )
//               );
//               Logger.info(
//                 `Received duplicate chunk ${chunkData.chunkIndex} for ${chunkData.fileId}, sent ACK`
//               );
//               const chunkSize = chunkData.chunkSize;
//               const chunkStart = headerEnd + 2;
//               const expectedBase64Length = Math.ceil((chunkSize * 4) / 3);
//               const chunkEnd = chunkStart + expectedBase64Length;
//               buffer = buffer.slice(chunkEnd);
//               continue;
//             }

//             const chunkSize = chunkData.chunkSize;
//             const chunkStart = headerEnd + 2;
//             const expectedBase64Length = Math.ceil((chunkSize * 4) / 3);
//             const minBase64Length = expectedBase64Length - 2;
//             const maxBase64Length = expectedBase64Length + 2;
//             const chunkEnd = chunkStart + expectedBase64Length;

//             if (buffer.length < chunkEnd) {
//               if (lastLoggedChunkIndex !== chunkData.chunkIndex) {
//                 Logger.info(
//                   `Waiting for base64 chunk data for ${
//                     chunkData.fileId
//                   } (chunkIndex: ${
//                     chunkData.chunkIndex
//                   }, expected ${expectedBase64Length} bytes, received ${
//                     buffer.length - chunkStart
//                   } bytes)`
//                 );
//                 lastLoggedChunkIndex = chunkData.chunkIndex;
//               }
//               return;
//             }

//             let base64Chunk = buffer.slice(chunkStart, chunkEnd).toString();
//             const actualBase64Length = base64Chunk.length;

//             if (
//               actualBase64Length < minBase64Length ||
//               actualBase64Length > maxBase64Length
//             ) {
//               Logger.error(
//                 `Base64 length mismatch for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}): expected ${expectedBase64Length} (±2), received ${actualBase64Length}`
//               );
//               buffer = Buffer.alloc(0); // Reset buffer on error
//               throw new DropShareError(
//                 ERROR_CODES.CORRUPTED_CHUNK,
//                 `Base64 length mismatch: expected ${expectedBase64Length} (±2), received ${actualBase64Length}`
//               );
//             }

//             let chunk: Buffer;
//             try {
//               chunk = Buffer.from(base64Chunk, "base64");
//               if (
//                 chunk.length !== chunkSize &&
//                 chunk.length !== chunkSize - 1 &&
//                 chunk.length !== chunkSize - 2
//               ) {
//                 Logger.error(
//                   `Chunk size mismatch for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}): expected ${chunkSize}, received ${chunk.length}`
//                 );
//                 buffer = Buffer.alloc(0); // Reset buffer on error
//                 throw new DropShareError(
//                   ERROR_CODES.CORRUPTED_CHUNK,
//                   `Chunk size mismatch: expected ${chunkSize}, received ${chunk.length}`
//                 );
//               }
//               const receivedHash = CryptoJS.SHA256(
//                 CryptoJS.enc.Base64.parse(base64Chunk)
//               ).toString(CryptoJS.enc.Hex);
//               if (receivedHash !== chunkData.chunkHash) {
//                 Logger.error(
//                   `Hash mismatch for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}): expected ${chunkData.chunkHash}, received ${receivedHash}`
//                 );
//                 buffer = Buffer.alloc(0); // Reset buffer on error
//                 throw new DropShareError(
//                   ERROR_CODES.CORRUPTED_CHUNK,
//                   `Hash mismatch for chunk ${chunkData.chunkIndex}`
//                 );
//               }
//               Logger.info(
//                 `Verified hash for chunk ${chunkData.chunkIndex} of ${chunkData.fileId}: ${chunkData.chunkHash}`
//               );
//             } catch (error) {
//               Logger.error(
//                 `Failed to decode or verify base64 chunk for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex})`,
//                 error
//               );
//               buffer = Buffer.alloc(0); // Reset buffer on error
//               throw new DropShareError(
//                 ERROR_CODES.CORRUPTED_CHUNK,
//                 "Invalid base64 chunk data or hash"
//               );
//             }

//             Logger.info(
//               `Processed chunk ${chunkData.chunkIndex + 1}/${
//                 fileTransfers.get(chunkData.fileId)?.totalChunks
//               } for ${
//                 chunkData.fileId
//               } (${chunkSize} bytes, base64 length: ${actualBase64Length}, decoded length: ${
//                 chunk.length
//               }, hash: ${chunkData.chunkHash})`
//             );
//             lastLoggedChunkIndex = null;

//             await chunkStorage.storeChunk(
//               chunkData.fileId,
//               chunkData.chunkIndex,
//               chunkSize,
//               base64Chunk
//             );

//             if (transfer) {
//               transfer.chunks[chunkData.chunkIndex] = chunk;
//               transfer.receivedBytes += chunk.length;
//               transfer.progress =
//                 (transfer.receivedBytes / transfer.totalSize) * 100;
//               transfer.lastChunkIndex = chunkData.chunkIndex;
//               transfer.completedChunks.add(chunkData.chunkIndex);
//               transfer.chunkHashes[chunkData.chunkIndex] = chunkData.chunkHash;
//               fileTransfers.set(chunkData.fileId, transfer);

//               const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
//               const speed = (
//                 transfer.receivedBytes /
//                 elapsedTime /
//                 1024 /
//                 1024
//               ).toFixed(2);

//               setTransferProgress?.((prev) => [
//                 ...prev.filter((p) => p.fileId !== chunkData.fileId),
//                 {
//                   fileId: chunkData.fileId,
//                   fileName: transfer.fileName,
//                   progress: `${(transfer.receivedBytes / (1024 * 1024)).toFixed(
//                     2
//                   )}/${(transfer.totalSize / (1024 * 1024)).toFixed(2)} MB`,
//                   speed: `${speed} MB/s`,
//                   percentage: transfer.progress,
//                 },
//               ]);

//               socket.write(
//                 Buffer.from(
//                   `ACK_CHUNK:${chunkData.fileId}:${chunkData.chunkIndex}\n`
//                 )
//               );
//               Logger.info(
//                 `Sent ACK_CHUNK for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex})`
//               );
//               buffer = buffer.slice(chunkEnd);
//               Logger.info(`Buffer sliced, remaining: ${buffer.length} bytes`);

//               if (transfer.completedChunks.size === transfer.totalChunks) {
//                 const finalPath = await chunkStorage.assembleFile(
//                   chunkData.fileId,
//                   transfer.totalChunks,
//                   transfer.fileName
//                 );
//                 setReceivedFiles((prev) => [...prev, finalPath]);
//                 Logger.info(
//                   `Received and saved file: ${finalPath} from ${transfer.deviceName}`
//                 );
//                 transfer.status = "Completed";
//                 transfer.endTime = Date.now();
//                 socket.write(Buffer.from(`ACK_COMPLETE:${chunkData.fileId}\n`));
//                 fileTransfers.delete(chunkData.fileId);
//                 receivingFile = false;
//                 fileId = "";
//               }
//             }
//           } else if (dataStr.startsWith("FILE:") && fileId) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(
//                 `Incomplete retransmission FILE header from ${
//                   socket.remoteAddress ?? "unknown"
//                 }, waiting...`
//               );
//               return;
//             }
//             const headerStr = buffer.slice(5, headerEnd).toString();
//             let headerData: FileHeader;
//             try {
//               headerData = JSON.parse(headerStr);
//             } catch (error) {
//               Logger.error(
//                 `Failed to parse retransmission FILE header: ${headerStr}`,
//                 error
//               );
//               buffer = Buffer.alloc(0); // Reset buffer on error
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 "Invalid file header"
//               );
//             }

//             if (headerData.fileId === fileId) {
//               Logger.info(
//                 `Detected retransmission for fileId ${fileId}, resetting state`
//               );
//               receivingFile = false;
//               fileTransfers.delete(fileId);
//               await chunkStorage.clearChunks(fileId);
//               await initializeFileTransfer(
//                 headerData,
//                 socket,
//                 setTransferProgress
//               );
//               const availableChunks = await chunkStorage.getAvailableChunks(
//                 fileId
//               );
//               socket.write(
//                 Buffer.from(
//                   `ACK_FILE:${fileId}:${JSON.stringify(availableChunks)}\n`
//                 )
//               );
//               buffer = buffer.slice(headerEnd + 2);
//               receivingFile = true;
//             } else {
//               Logger.warn(
//                 `Unexpected FILE header for different fileId ${headerData.fileId} while processing ${fileId}`
//               );
//               buffer = Buffer.alloc(0); // Reset buffer on unexpected data
//               return;
//             }
//           } else {
//             Logger.warn(
//               `Unexpected data while receiving file for ${fileId}: ${dataStr.slice(
//                 0,
//                 50
//               )}...`
//             );
//             buffer = Buffer.alloc(0); // Reset buffer on unexpected data
//             return;
//           }
//         } else {
//           if (dataStr.startsWith("FILE:")) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(
//                 `Incomplete FILE header from ${
//                   socket.remoteAddress ?? "unknown"
//                 }, waiting...`
//               );
//               return;
//             }
//             const headerStr = buffer.slice(5, headerEnd).toString();
//             let headerData: FileHeader;
//             try {
//               headerData = JSON.parse(headerStr);
//             } catch (error) {
//               Logger.error(`Failed to parse FILE header: ${headerStr}`, error);
//               buffer = Buffer.alloc(0); // Reset buffer on error
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 "Invalid file header"
//               );
//             }

//             await initializeFileTransfer(
//               headerData,
//               socket,
//               setTransferProgress
//             );
//             const availableChunks = await chunkStorage.getAvailableChunks(
//               headerData.fileId
//             );
//             socket.write(
//               Buffer.from(
//                 `ACK_FILE:${headerData.fileId}:${JSON.stringify(
//                   availableChunks
//                 )}\n`
//               )
//             );
//             buffer = buffer.slice(headerEnd + 2);
//             receivingFile = true;
//           } else if (dataStr.startsWith("MSG:")) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(
//                 `Incomplete MSG from ${
//                   socket.remoteAddress ?? "unknown"
//                 }, waiting...`
//               );
//               return;
//             }
//             const message = buffer.slice(4, messageEnd).toString();
//             setMessages((prev) => [
//               ...prev,
//               `${socket.remoteAddress ?? "unknown"}: ${message}`,
//             ]);
//             connectedSockets
//               .filter((s) => s !== socket)
//               .forEach((s) => {
//                 s.write(Buffer.from(`MSG:${message}\n`));
//                 Logger.info(`Forwarded MSG to ${s.remoteAddress ?? "unknown"}`);
//               });
//             buffer = buffer.slice(messageEnd + 1);
//           } else if (
//             dataStr.startsWith("ACK_FILE:") ||
//             dataStr.startsWith("ACK_COMPLETE:") ||
//             dataStr.startsWith("ACK_CHUNK:")
//           ) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(
//                 `Incomplete ${dataStr.slice(0, 10)} from ${
//                   socket.remoteAddress ?? "unknown"
//                 }, waiting...`
//               );
//               return;
//             }
//             Logger.info(`Processed ${dataStr.slice(0, messageEnd)}`);
//             buffer = buffer.slice(messageEnd + 1);
//           } else {
//             Logger.warn(
//               `Invalid data from ${
//                 socket.remoteAddress ?? "unknown"
//               }: ${dataStr.slice(0, 50)}...`
//             );
//             socket.write(
//               Buffer.from(
//                 `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
//               )
//             );
//             buffer = Buffer.alloc(0); // Reset buffer on invalid data
//           }
//         }
//       }
//     } catch (error) {
//       Logger.error(
//         `Error processing data from ${socket.remoteAddress ?? "unknown"}`,
//         error
//       );
//       const err = DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         "Data processing failed"
//       );
//       socket.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
//       buffer = Buffer.alloc(0); // Reset buffer on error
//       receivingFile = false;
//       fileTransfers.delete(fileId);
//       await chunkStorage.clearChunks(fileId);
//       fileId = "";
//       lastLoggedChunkIndex = null;
//       setTransferProgress?.((prev) => [
//         ...prev.filter((p) => p.fileId !== fileId),
//         {
//           fileId,
//           fileName: fileTransfers.get(fileId)?.fileName || "unknown",
//           progress: "0/0 MB",
//           speed: "0 MB/s",
//           percentage: 0,
//           error: err.message,
//         },
//       ]);
//     }
//   }

//   async function sendHostFile(
//     server: TCPSocket.Server | null,
//     filePath: string,
//     username: string,
//     connectedSockets: TCPSocket.Socket[],
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     if (!server || connectedSockets.length === 0) {
//       Logger.toast("No connected clients to send file", "error");
//       throw new DropShareError(
//         ERROR_CODES.NETWORK_ERROR,
//         "No connected clients"
//       );
//     }

//     const fileName = filePath.split("/").pop() ?? "unknown";
//     const fileId = `${Date.now()}-${fileName}`;

//     try {
//       await Promise.all(
//         connectedSockets.map((socket) =>
//           sendFile(
//             socket,
//             fileName,
//             filePath,
//             username,
//             fileId,
//             setTransferProgress
//           )
//         )
//       );
//       Logger.info(`Sent file: ${fileName} from ${username} to all clients`);
//       Logger.toast(`Sent file ${fileName}`, "info");
//     } catch (error) {
//       Logger.error(`Failed to send file ${fileName}`, error);
//       throw error;
//     }
//   }

//   async function sendFilesInHost(
//     server: TCPSocket.Server | null,
//     files: { filePath: string }[],
//     username: string,
//     connectedSockets: TCPSocket.Socket[],
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     if (!server || connectedSockets.length === 0) {
//       Logger.toast("No connected clients to send files", "error");
//       throw new DropShareError(
//         ERROR_CODES.NETWORK_ERROR,
//         "No connected clients"
//       );
//     }

//     for (const { filePath } of files) {
//       await sendHostFile(
//         server,
//         filePath,
//         username,
//         connectedSockets,
//         setTransferProgress
//       );
//       Logger.info(`Sent file: ${filePath.split("/").pop()} from ${username}`);
//     }
//   }

//   function sendMessageInHost(
//     message: string,
//     username: string,
//     connectedSockets: TCPSocket.Socket[]
//   ): void {
//     if (connectedSockets.length === 0) {
//       Logger.toast("No connected clients to send message", "error");
//       return;
//     }

//     connectedSockets.forEach((socket) => {
//       socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
//       Logger.info(
//         `Sent MSG to ${socket.remoteAddress ?? "unknown"}: ${message}`
//       );
//     });
//   }

//   async function initializeFileTransfer(
//     headerData: FileHeader,
//     socket: TCPSocket.Socket,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     const chunkStorage = ChunkStorage.getInstance();
//     if (headerData.protocolVersion !== PROTOCOL_VERSION) {
//       Logger.error(
//         `Protocol version mismatch for ${headerData.fileId}: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
//       );
//       socket.write(
//         Buffer.from(
//           `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
//         )
//       );
//       buffer = Buffer.alloc(0); // Reset buffer on error
//       throw new DropShareError(
//         ERROR_CODES.INVALID_HEADER,
//         `Protocol version mismatch: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
//       );
//     }

//     fileId = headerData.fileId;
//     const fileName = headerData.name;
//     const fileSize = headerData.size;
//     const deviceName = headerData.sender || "Unknown";
//     const totalChunks = headerData.totalChunks;
//     const chunkSize = headerData.chunkSize;

//     if (!fileName || !fileSize || !fileId || !totalChunks || !chunkSize) {
//       socket.write(
//         Buffer.from(
//           `ERROR:${ERROR_CODES.INVALID_HEADER}:Missing file name, size, ID, total chunks, or chunk size\n`
//         )
//       );
//       buffer = Buffer.alloc(0); // Reset buffer on error
//       throw new DropShareError(
//         ERROR_CODES.INVALID_HEADER,
//         "Missing file name, size, ID, total chunks, or chunk size"
//       );
//     }

//     const { chunkSize: calculatedChunkSize } =
//       calculateDynamicChunkDivision(fileSize);
//     if (chunkSize !== calculatedChunkSize) {
//       Logger.error(
//         `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${chunkSize}`
//       );
//       socket.write(
//         Buffer.from(`ERROR:${ERROR_CODES.INVALID_HEADER}:Chunk size mismatch\n`)
//       );
//       buffer = Buffer.alloc(0); // Reset buffer on error
//       throw new DropShareError(
//         ERROR_CODES.INVALID_HEADER,
//         `Chunk size mismatch: expected ${calculatedChunkSize}, received ${chunkSize}`
//       );
//     }

//     if (!checkTransferLimits(fileSize, fileTransfers)) {
//       socket.write(
//         Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
//       );
//       Logger.toast(`Transfer limit exceeded for ${fileName}`, "error");
//       buffer = Buffer.alloc(0); // Reset buffer on error
//       throw new DropShareError(
//         ERROR_CODES.TRANSFER_LIMIT_EXCEEDED,
//         `Transfer limit exceeded for ${fileName}`
//       );
//     }

//     const availableChunks = await chunkStorage.getAvailableChunks(fileId);
//     const transfer: FileTransfer = {
//       fileId,
//       fileName,
//       fileSize,
//       deviceName,
//       senderIp: socket.remoteAddress || "unknown",
//       chunks: new Array(totalChunks).fill(undefined),
//       receivedBytes: availableChunks.reduce(
//         (sum, i) => sum + Math.min(chunkSize, fileSize - i * chunkSize),
//         0
//       ),
//       startTime: Date.now(),
//       totalChunks,
//       chunkSize,
//       totalSize: fileSize,
//       chunkHashes: new Array(totalChunks).fill(""),
//       aesKey: undefined,
//       iv: undefined,
//       status: "Receiving",
//       progress: (availableChunks.length / totalChunks) * 100,
//       lastChunkIndex: -1,
//       completedChunks: new Set(availableChunks),
//       availableChunks,
//     };
//     fileTransfers.set(fileId, transfer);
//   }

//   return {
//     sendFilesInHost,
//     sendMessageInHost,
//     receiveFileInHost,
//   };
// };

// import {
//   calculateDynamicChunkDivision,
//   checkTransferLimits,
// } from "../utils/NetworkUtils";
// import RNFS from "react-native-fs";
// import { Buffer } from "buffer";
// import { Logger } from "../utils/Logger";
// import { DropShareError, ERROR_CODES } from "../utils/Error";
// import TCPSocket from "react-native-tcp-socket";
// import { ChunkStorage } from "./ChunkStorage";
// import CryptoJS from "crypto-js";

// interface FileHeader {
//   protocolVersion: string;
//   name: string;
//   size: number;
//   sender: string;
//   fileId: string;
//   totalChunks: number;
//   chunkSize: number;
// }

// interface HostReceiveProps {
//   socket: TCPSocket.Socket;
//   data: string | Buffer;
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
//   connectedSockets: TCPSocket.Socket[];
//   setMessages: React.Dispatch<React.SetStateAction<string[]>>;
//   setTransferProgress?: React.Dispatch<
//     React.SetStateAction<TransferProgress[]>
//   >;
//   setTransferStatus?: (message: string) => void;
// }

// interface TransferProgress {
//   fileId: string;
//   fileName: string;
//   progress: string;
//   speed: string;
//   percentage: number;
//   error?: string;
// }

// interface FileTransfer {
//   fileId: string;
//   fileName: string;
//   fileSize: number;
//   deviceName: string;
//   senderIp: string;
//   chunks: (Buffer | undefined)[];
//   receivedBytes: number;
//   startTime: number;
//   totalChunks: number;
//   chunkSize: number;
//   totalSize: number;
//   chunkHashes: string[];
//   aesKey?: string;
//   iv?: string;
//   status: "Sending" | "Receiving" | "Completed" | "Failed";
//   progress: number;
//   lastChunkIndex: number;
//   completedChunks: Set<number>;
//   error?: string;
//   endTime?: number;
// }

// const fileTransfers = new Map<string, FileTransfer>();
// let buffer = Buffer.alloc(0);
// let receivingFile = false;
// let fileId = "";
// let lastLoggedChunkIndex: number | null = null;

// const MAX_RETRIES = 3;
// const ACK_TIMEOUT = 60000;
// const PROTOCOL_VERSION = "1.0";
// const MAX_CONCURRENT_CHUNKS = 5;
// const MAX_BUFFER_SIZE = 10 * 1024 * 1024;

// export const HostSharing = () => {
//   function generateFileId(fileName: string, fileSize: number): string {
//     return CryptoJS.SHA256(`${fileName}:${fileSize}`).toString(
//       CryptoJS.enc.Hex
//     );
//   }

//   async function sendFile(
//     socket: TCPSocket.Socket,
//     fileName: string,
//     filePath: string,
//     username: string,
//     fileId: string,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >,
//     setTransferStatus?: (message: string) => void
//   ): Promise<void> {
//     const chunkStorage = ChunkStorage.getInstance();
//     setTransferStatus?.(`Recollecting previous transfer data for ${fileName}`);

//     let transfer: FileTransfer = {
//       fileId,
//       fileName,
//       fileSize: 0,
//       deviceName: username,
//       senderIp: socket.localAddress || "unknown",
//       chunks: [],
//       receivedBytes: 0,
//       startTime: Date.now(),
//       totalChunks: 0,
//       chunkSize: 0,
//       totalSize: 0,
//       chunkHashes: [],
//       status: "Sending",
//       progress: 0,
//       lastChunkIndex: -1,
//       completedChunks: new Set(),
//     };

//     try {
//       await chunkStorage.ensureInitialized();
//       const stat = await RNFS.stat(filePath);
//       const fileSize = stat.size;
//       const { chunkSize, numChunks: totalChunks } =
//         calculateDynamicChunkDivision(fileSize);

//       transfer = {
//         ...transfer,
//         fileSize,
//         chunks: new Array(totalChunks).fill(undefined),
//         totalChunks,
//         chunkSize,
//         totalSize: fileSize,
//         chunkHashes: new Array(totalChunks).fill(""),
//       };
//       fileTransfers.set(fileId, transfer);

//       let retries = 0;
//       while (retries < MAX_RETRIES) {
//         try {
//           if (retries > 0) {
//             setTransferStatus?.(
//               `Retrying transfer for ${fileName} (attempt ${retries + 1})`
//             );
//             await new Promise<void>((resolve, reject) => {
//               const timeout = setTimeout(() => {
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.NETWORK_ERROR,
//                     `Timeout waiting for ACK_RESET (attempt ${retries + 1})`
//                   )
//                 );
//               }, ACK_TIMEOUT);
//               socket.once("data", (data) => {
//                 clearTimeout(timeout);
//                 const message = data.toString();
//                 Logger.info(`Received for ACK_RESET: ${message}`);
//                 if (message.startsWith(`ACK_RESET:${fileId}`)) {
//                   resolve();
//                 } else {
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.INVALID_HEADER,
//                       `Invalid ACK_RESET response: ${message}`
//                     )
//                   );
//                 }
//               });
//               socket.write(Buffer.from(`RESET:${fileId}\n`));
//               Logger.info(`Sent RESET for ${fileId}`);
//             });
//           }

//           let availableChunks: number[] = [];
//           await new Promise<void>((resolve, reject) => {
//             const timeout = setTimeout(() => {
//               reject(
//                 new DropShareError(
//                   ERROR_CODES.NETWORK_ERROR,
//                   `Timeout waiting for ACK_FILE (attempt ${retries + 1})`
//                 )
//               );
//             }, ACK_TIMEOUT);
//             socket.once("data", (data) => {
//               clearTimeout(timeout);
//               const message = data.toString();
//               Logger.info(`Received for ACK_FILE: ${message}`);
//               if (message.startsWith(`ACK_FILE:${fileId}:`)) {
//                 availableChunks = JSON.parse(message.split(":")[2]) || [];
//                 resolve();
//               } else if (message.startsWith(`ACK_FILE:${fileId}`)) {
//                 resolve();
//               } else {
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.INVALID_HEADER,
//                     `Invalid ACK_FILE response: ${message}`
//                   )
//                 );
//               }
//             });
//             const header: FileHeader = {
//               protocolVersion: PROTOCOL_VERSION,
//               name: fileName,
//               size: fileSize,
//               sender: username,
//               fileId,
//               totalChunks,
//               chunkSize,
//             };
//             socket.write(Buffer.from(`FILE:${JSON.stringify(header)}\n\n`));
//             Logger.info(`Sent header for ${fileId}: ${JSON.stringify(header)}`);
//           });

//           const sentChunks = await chunkStorage.getSentChunks(fileId);
//           const pendingChunks = Array.from(
//             { length: totalChunks },
//             (_, i) => i
//           ).filter(
//             (i) => !availableChunks.includes(i) && !sentChunks.includes(i)
//           );
//           let sentBytes = availableChunks.reduce(
//             (sum, i) => sum + Math.min(chunkSize, fileSize - i * chunkSize),
//             0
//           );

//           setTransferStatus?.(
//             `Starting transfer for ${fileName} from chunk ${
//               pendingChunks[0] || 0
//             }`
//           );

//           const sendChunk = async (chunkIndex: number): Promise<void> => {
//             const start = chunkIndex * chunkSize;
//             const actualChunkSize = Math.min(chunkSize, fileSize - start);
//             const chunk = await RNFS.read(
//               filePath,
//               actualChunkSize,
//               start,
//               "base64"
//             );
//             const chunkBuffer = Buffer.from(chunk, "base64");
//             const chunkHash = CryptoJS.SHA256(
//               CryptoJS.enc.Base64.parse(chunk)
//             ).toString(CryptoJS.enc.Hex);
//             transfer.chunkHashes[chunkIndex] = chunkHash;
//             fileTransfers.set(fileId, transfer);

//             await chunkStorage.storeChunk(
//               fileId,
//               chunkIndex,
//               actualChunkSize,
//               chunk,
//               false
//             );

//             await new Promise<void>((resolve, reject) => {
//               const timeout = setTimeout(() => {
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.NETWORK_ERROR,
//                     `Timeout waiting for ACK_CHUNK:${chunkIndex} (attempt ${
//                       retries + 1
//                     })`
//                   )
//                 );
//               }, ACK_TIMEOUT);
//               socket.once("data", (data) => {
//                 clearTimeout(timeout);
//                 const message = data.toString();
//                 Logger.info(`Received for ACK_CHUNK:${chunkIndex}: ${message}`);
//                 if (message.startsWith(`ACK_CHUNK:${fileId}:${chunkIndex}`)) {
//                   resolve();
//                 } else if (message.startsWith("ERROR:")) {
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.NETWORK_ERROR,
//                       `Receiver error: ${message}`
//                     )
//                   );
//                 } else {
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.INVALID_HEADER,
//                       `Invalid ACK_CHUNK response: ${message}`
//                     )
//                   );
//                 }
//               });
//               const chunkHeader = Buffer.from(
//                 `CHUNK:${JSON.stringify({
//                   fileId,
//                   chunkIndex,
//                   chunkSize: actualChunkSize,
//                   chunkHash,
//                 })}\n\n`
//               );
//               socket.write(Buffer.concat([chunkHeader, Buffer.from(chunk)]));
//               Logger.info(
//                 `Sent chunk ${chunkIndex}/${totalChunks} for ${fileId} (${actualChunkSize} bytes, hash: ${chunkHash})`
//               );
//             });

//             await chunkStorage.markChunkAsSent(fileId, chunkIndex);

//             sentBytes += actualChunkSize;
//             const percentage = (sentBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
//             const speed = (sentBytes / elapsedTime / 1024 / 1024).toFixed(2);

//             transfer.receivedBytes = sentBytes;
//             transfer.progress = percentage;
//             transfer.lastChunkIndex = chunkIndex;
//             transfer.completedChunks.add(chunkIndex);
//             fileTransfers.set(fileId, transfer);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== fileId),
//               {
//                 fileId,
//                 fileName,
//                 progress: `${(sentBytes / (1024 * 1024)).toFixed(2)}/${(
//                   fileSize /
//                   (1024 * 1024)
//                 ).toFixed(2)} MB`,
//                 speed: `${speed} MB/s`,
//                 percentage,
//               },
//             ]);
//             setTransferStatus?.(
//               `Progress for ${fileName}: ${percentage.toFixed(2)}%`
//             );
//           };

//           const windowSize = MAX_CONCURRENT_CHUNKS;
//           let windowStart = 0;
//           const activePromises: Map<number, Promise<void>> = new Map();

//           while (windowStart < pendingChunks.length) {
//             while (
//               activePromises.size < windowSize &&
//               windowStart < pendingChunks.length
//             ) {
//               const chunkIndex = pendingChunks[windowStart];
//               activePromises.set(chunkIndex, sendChunk(chunkIndex));
//               windowStart++;
//             }

//             const completedPromise = await Promise.race(
//               Array.from(activePromises.values())
//             );
//             activePromises.forEach((promise, chunkIndex) => {
//               if (promise === completedPromise) {
//                 activePromises.delete(chunkIndex);
//               }
//             });
//           }

//           await Promise.all(activePromises.values());

//           await new Promise<void>((resolve, reject) => {
//             const timeout = setTimeout(() => {
//               reject(
//                 new DropShareError(
//                   ERROR_CODES.NETWORK_ERROR,
//                   `Timeout waiting for ACK_COMPLETE (attempt ${retries + 1})`
//                 )
//               );
//             }, ACK_TIMEOUT);
//             socket.once("data", (data) => {
//               clearTimeout(timeout);
//               const message = data.toString();
//               Logger.info(`Received for ACK_COMPLETE: ${message}`);
//               if (message.startsWith(`ACK_COMPLETE:${fileId}`)) {
//                 transfer.status = "Completed";
//                 transfer.endTime = Date.now();
//                 transfer.progress = 100;
//                 fileTransfers.set(fileId, transfer);
//                 setTransferProgress?.((prev) => [
//                   ...prev.filter((p) => p.fileId !== fileId),
//                   {
//                     fileId,
//                     fileName,
//                     progress: `${(fileSize / (1024 * 1024)).toFixed(2)}/${(
//                       fileSize /
//                       (1024 * 1024)
//                     ).toFixed(2)} MB`,
//                     speed: `${(
//                       fileSize /
//                       ((Date.now() - transfer.startTime) / 1000 || 1) /
//                       1024 /
//                       1024
//                     ).toFixed(2)} MB/s`,
//                     percentage: 100,
//                   },
//                 ]);
//                 setTransferStatus?.(`Completed transfer for ${fileName}`);
//                 resolve();
//               } else if (message.startsWith("ERROR:")) {
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.NETWORK_ERROR,
//                     `Receiver error: ${message}`
//                   )
//                 );
//               } else {
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.NETWORK_ERROR,
//                     `Invalid ACK_COMPLETE response: ${message}`
//                   )
//                 );
//               }
//             });
//           });
//           break;
//         } catch (error) {
//           retries++;
//           if (retries === MAX_RETRIES) {
//             throw error;
//           }
//           Logger.warn(`Retrying file send for ${fileId} after error: ${error}`);
//           await new Promise((resolve) => setTimeout(resolve, 2000));
//         }
//       }
//     } catch (error) {
//       const err = DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         `Transfer failed: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`
//       );
//       transfer.status = "Failed";
//       transfer.error = err.message;
//       fileTransfers.set(fileId, transfer);
//       setTransferProgress?.((prev) => [
//         ...prev.filter((p) => p.fileId !== fileId),
//         {
//           fileId,
//           fileName,
//           progress: `${(transfer.receivedBytes / (1024 * 1024)).toFixed(2)}/${(
//             transfer.totalSize /
//             (1024 * 1024)
//           ).toFixed(2)} MB`,
//           speed: "0 MB/s",
//           percentage: transfer.progress,
//           error: err.message,
//         },
//       ]);
//       setTransferStatus?.(`Transfer failed for ${fileName}: ${err.message}`);
//       Logger.error(`Failed to send file ${fileName}`, error);
//       throw err;
//     } finally {
//       if (transfer.status === "Completed" || transfer.status === "Failed") {
//         await chunkStorage
//           .clearChunks(fileId)
//           .catch((e) => Logger.error("Failed to clear chunks", e));
//         fileTransfers.delete(fileId);
//       }
//     }
//   }

//   async function sendHostFile(
//     socket: TCPSocket.Socket,
//     filePath: string,
//     username: string,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >,
//     setTransferStatus?: (message: string) => void
//   ): Promise<void> {
//     const fileName = filePath.split("/").pop() ?? "unknown";
//     const stat = await RNFS.stat(filePath);
//     const fileId = generateFileId(fileName, stat.size);
//     await sendFile(
//       socket,
//       fileName,
//       filePath,
//       username,
//       fileId,
//       setTransferProgress,
//       setTransferStatus
//     );
//   }

//   async function sendFilesInHost(
//     server: TCPSocket.Server | null,
//     files: { filePath: string }[],
//     username: string,
//     connectedSockets: TCPSocket.Socket[],
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >,
//     setTransferStatus?: (message: string) => void
//   ): Promise<void> {
//     if (!server) {
//       Logger.toast("No active server to send files", "error");
//       throw new DropShareError(ERROR_CODES.NETWORK_ERROR, "No active server");
//     }
//     if (connectedSockets.length === 0) {
//       Logger.toast("No connected clients to send files", "error");
//       throw new DropShareError(
//         ERROR_CODES.NETWORK_ERROR,
//         "No connected clients"
//       );
//     }

//     for (const clientSocket of connectedSockets) {
//       for (const { filePath } of files) {
//         await sendHostFile(
//           clientSocket,
//           filePath,
//           username,
//           setTransferProgress,
//           setTransferStatus
//         );
//         Logger.info(
//           `Sent file: ${filePath} to client ${clientSocket.remoteAddress}`
//         );
//       }
//     }
//   }

//   function sendMessageInHost(
//     message: string,
//     username: string,
//     connectedSockets: TCPSocket.Socket[]
//   ): void {
//     for (const socket of connectedSockets) {
//       socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
//       Logger.info(`Sent MSG: ${message} to ${socket.remoteAddress}`);
//     }
//   }

//   async function receiveFileInHost({
//     socket,
//     data,
//     setMessages,
//     setReceivedFiles,
//     setTransferProgress,
//     setTransferStatus,
//     connectedSockets,
//   }: HostReceiveProps): Promise<void> {
//     const chunkStorage = ChunkStorage.getInstance();
//     try {
//       await chunkStorage.ensureInitialized();

//       if (buffer.length > MAX_BUFFER_SIZE) {
//         Logger.error("Buffer size exceeded, clearing buffer");
//         buffer = Buffer.alloc(0);
//         throw new DropShareError(
//           ERROR_CODES.NETWORK_ERROR,
//           "Buffer size exceeded"
//         );
//       }
//       buffer = Buffer.concat([
//         buffer,
//         typeof data === "string" ? Buffer.from(data) : data,
//       ]);
//       Logger.info(
//         `Received ${data.length} bytes from ${socket.remoteAddress}, buffer now ${buffer.length} bytes`
//       );

//       while (buffer.length > 0) {
//         const dataStr = buffer.toString();

//         if (dataStr.startsWith("RESET:")) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) {
//             Logger.info(`Incomplete RESET from client, waiting...`);
//             return;
//           }
//           const resetFileId = dataStr.slice(6, messageEnd);
//           Logger.info(`Received RESET for fileId ${resetFileId}`);
//           if (resetFileId === fileId || !fileId) {
//             receivingFile = false;
//             fileTransfers.delete(resetFileId);
//             await chunkStorage.clearChunks(resetFileId);
//             fileId = "";
//             setTransferStatus?.(`Reset transfer for fileId ${resetFileId}`);
//           }
//           socket.write(Buffer.from(`ACK_RESET:${resetFileId}\n`));
//           buffer = buffer.slice(messageEnd + 1);
//           continue;
//         }

//         if (receivingFile) {
//           if (dataStr.startsWith("CHUNK:")) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(`Incomplete CHUNK header from client, waiting...`);
//               return;
//             }
//             const headerStr = buffer.slice(6, headerEnd).toString();
//             let chunkData: {
//               fileId: string;
//               chunkIndex: number;
//               chunkSize: number;
//               chunkHash: string;
//             };
//             try {
//               chunkData = JSON.parse(headerStr);
//             } catch (error) {
//               Logger.error(
//                 `Failed to parse CHUNK header for fileId ${fileId}: ${headerStr}`,
//                 error
//               );
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 "Invalid chunk header"
//               );
//             }

//             const chunkSize = chunkData.chunkSize;
//             const chunkStart = headerEnd + 2;
//             const expectedBase64Length = Math.ceil((chunkSize * 4) / 3);
//             const minBase64Length = expectedBase64Length - 2;
//             const maxBase64Length = expectedBase64Length + 2;
//             const chunkEnd = chunkStart + expectedBase64Length;

//             if (buffer.length < chunkEnd) {
//               if (lastLoggedChunkIndex !== chunkData.chunkIndex) {
//                 Logger.info(
//                   `Waiting for base64 chunk data for ${
//                     chunkData.fileId
//                   } (chunkIndex: ${
//                     chunkData.chunkIndex
//                   }, expected ${expectedBase64Length} bytes, received ${
//                     buffer.length - chunkStart
//                   } bytes)`
//                 );
//                 lastLoggedChunkIndex = chunkData.chunkIndex;
//               }
//               return;
//             }

//             let base64Chunk = buffer.slice(chunkStart, chunkEnd).toString();
//             const actualBase64Length = base64Chunk.length;

//             if (
//               actualBase64Length < minBase64Length ||
//               actualBase64Length > maxBase64Length
//             ) {
//               Logger.error(
//                 `Base64 length mismatch for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}): expected ${expectedBase64Length} (±2), received ${actualBase64Length}`
//               );
//               throw new DropShareError(
//                 ERROR_CODES.CORRUPTED_CHUNK,
//                 `Base64 length mismatch: expected ${expectedBase64Length} (±2), received ${actualBase64Length}`
//               );
//             }

//             let chunk: Buffer;
//             try {
//               chunk = Buffer.from(base64Chunk, "base64");
//               if (
//                 chunk.length !== chunkSize &&
//                 chunk.length !== chunkSize - 1 &&
//                 chunk.length !== chunkSize - 2
//               ) {
//                 Logger.error(
//                   `Chunk size mismatch for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}): expected ${chunkSize}, received ${chunk.length}`
//                 );
//                 throw new DropShareError(
//                   ERROR_CODES.CORRUPTED_CHUNK,
//                   `Chunk size mismatch: expected ${chunkSize}, received ${chunk.length}`
//                 );
//               }
//               const receivedHash = CryptoJS.SHA256(
//                 CryptoJS.enc.Base64.parse(base64Chunk)
//               ).toString(CryptoJS.enc.Hex);
//               if (receivedHash !== chunkData.chunkHash) {
//                 Logger.error(
//                   `Hash mismatch for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}): expected ${chunkData.chunkHash}, received ${receivedHash}`
//                 );
//                 throw new DropShareError(
//                   ERROR_CODES.CORRUPTED_CHUNK,
//                   `Hash mismatch for chunk ${chunkData.chunkIndex}`
//                 );
//               }
//               Logger.info(
//                 `Verified hash for chunk ${chunkData.chunkIndex} of ${chunkData.fileId}: ${chunkData.chunkHash}`
//               );
//             } catch (error) {
//               Logger.error(
//                 `Failed to decode or verify base64 chunk for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex})`,
//                 error
//               );
//               throw new DropShareError(
//                 ERROR_CODES.CORRUPTED_CHUNK,
//                 "Invalid base64 chunk data or hash"
//               );
//             }

//             Logger.info(
//               `Processed chunk ${chunkData.chunkIndex}/${
//                 fileTransfers.get(chunkData.fileId)?.totalChunks
//               } for ${
//                 chunkData.fileId
//               } (chunkSize: ${chunkSize}, base64 length: ${actualBase64Length}, decoded length: ${
//                 chunk.length
//               }, hash: ${chunkData.chunkHash})`
//             );
//             lastLoggedChunkIndex = null;

//             await chunkStorage.storeChunk(
//               chunkData.fileId,
//               chunkData.chunkIndex,
//               chunkSize,
//               base64Chunk
//             );

//             const transfer = fileTransfers.get(chunkData.fileId);
//             if (transfer) {
//               transfer.chunks[chunkData.chunkIndex] = chunk;
//               transfer.receivedBytes += chunk.length;
//               transfer.progress =
//                 (transfer.receivedBytes / transfer.totalSize) * 100;
//               transfer.lastChunkIndex = chunkData.chunkIndex;
//               transfer.completedChunks.add(chunkData.chunkIndex);
//               transfer.chunkHashes[chunkData.chunkIndex] = chunkData.chunkHash;
//               fileTransfers.set(chunkData.fileId, transfer);

//               const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
//               const speed = (
//                 transfer.receivedBytes /
//                 elapsedTime /
//                 1024 /
//                 1024
//               ).toFixed(2);

//               setTransferProgress?.((prev) => [
//                 ...prev.filter((p) => p.fileId !== chunkData.fileId),
//                 {
//                   fileId: chunkData.fileId,
//                   fileName: transfer.fileName,
//                   progress: `${(transfer.receivedBytes / (1024 * 1024)).toFixed(
//                     2
//                   )}/${(transfer.totalSize / (1024 * 1024)).toFixed(2)} MB`,
//                   speed: `${speed} MB/s`,
//                   percentage: transfer.progress,
//                 },
//               ]);
//               setTransferStatus?.(
//                 `Progress for ${transfer.fileName}: ${transfer.progress.toFixed(
//                   2
//                 )}%`
//               );

//               socket.write(
//                 Buffer.from(
//                   `ACK_CHUNK:${chunkData.fileId}:${chunkData.chunkIndex}\n`
//                 )
//               );
//               Logger.info(
//                 `Sent ACK_CHUNK for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex})`
//               );
//               buffer = buffer.slice(chunkEnd);
//               Logger.info(`Buffer sliced, remaining: ${buffer.length} bytes`);

//               if (transfer.completedChunks.size === transfer.totalChunks) {
//                 const finalPath = await chunkStorage.assembleFile(
//                   chunkData.fileId,
//                   transfer.totalChunks,
//                   transfer.fileName
//                 );
//                 setReceivedFiles((prev) => [...prev, finalPath]);
//                 Logger.info(
//                   `Received and saved file: ${finalPath} from ${transfer.deviceName}`
//                 );
//                 transfer.status = "Completed";
//                 transfer.endTime = Date.now();
//                 socket.write(Buffer.from(`ACK_COMPLETE:${chunkData.fileId}\n`));
//                 fileTransfers.delete(chunkData.fileId);
//                 receivingFile = false;
//                 fileId = "";
//                 setTransferStatus?.(`Received ${transfer.fileName}`);
//               }
//             }
//           } else if (dataStr.startsWith("FILE:") && fileId) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(
//                 `Incomplete retransmission FILE header from client, waiting...`
//               );
//               return;
//             }
//             const headerStr = buffer.slice(5, headerEnd).toString();
//             let headerData: FileHeader;
//             try {
//               headerData = JSON.parse(headerStr);
//             } catch (error) {
//               Logger.error(
//                 `Failed to parse retransmission FILE header: ${headerStr}`,
//                 error
//               );
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 "Invalid file header"
//               );
//             }

//             if (headerData.fileId === fileId) {
//               Logger.info(
//                 `Detected retransmission for fileId ${fileId}, resetting state`
//               );
//               receivingFile = false;
//               fileTransfers.delete(fileId);
//               await chunkStorage.clearChunks(fileId);
//               await initializeFileTransfer(
//                 headerData,
//                 socket,
//                 setTransferProgress,
//                 setTransferStatus
//               );
//               const availableChunks = await chunkStorage.getAvailableChunks(
//                 fileId
//               );
//               socket.write(
//                 Buffer.from(
//                   `ACK_FILE:${fileId}:${JSON.stringify(availableChunks)}\n`
//                 )
//               );
//               buffer = buffer.slice(headerEnd + 2);
//               receivingFile = true;
//             } else {
//               Logger.warn(
//                 `Unexpected FILE header for different fileId ${headerData.fileId} while processing ${fileId}`
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }
//           } else {
//             Logger.warn(
//               `Unexpected data while receiving file for ${fileId}: ${dataStr.slice(
//                 0,
//                 50
//               )}...`
//             );
//             buffer = Buffer.alloc(0);
//             return;
//           }
//         } else {
//           if (dataStr.startsWith("FILE:")) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(`Incomplete FILE header from client, waiting...`);
//               return;
//             }
//             const headerStr = buffer.slice(5, headerEnd).toString();
//             let headerData: FileHeader;
//             try {
//               headerData = JSON.parse(headerStr);
//             } catch (error) {
//               Logger.error(`Failed to parse FILE header: ${headerStr}`, error);
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 "Invalid file header"
//               );
//             }

//             await initializeFileTransfer(
//               headerData,
//               socket,
//               setTransferProgress,
//               setTransferStatus
//             );
//             const availableChunks = await chunkStorage.getAvailableChunks(
//               headerData.fileId
//             );
//             socket.write(
//               Buffer.from(
//                 `ACK_FILE:${headerData.fileId}:${JSON.stringify(
//                   availableChunks
//                 )}\n`
//               )
//             );
//             buffer = buffer.slice(headerEnd + 2);
//             receivingFile = true;
//             setTransferStatus?.(`Started receiving ${headerData.name}`);
//           } else if (dataStr.startsWith("MSG:")) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(`Incomplete MSG from client, waiting...`);
//               return;
//             }
//             const message = buffer.slice(4, messageEnd).toString();
//             setMessages((prev) => [
//               ...prev,
//               `Client (${socket.remoteAddress}): ${message}`,
//             ]);
//             buffer = buffer.slice(messageEnd + 1);
//           } else if (
//             dataStr.startsWith("ACK_FILE:") ||
//             dataStr.startsWith("ACK_COMPLETE:") ||
//             dataStr.startsWith("ACK_CHUNK:")
//           ) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(
//                 `Incomplete ${dataStr.slice(0, 10)} from client, waiting...`
//               );
//               return;
//             }
//             Logger.info(`Processed ${dataStr.slice(0, messageEnd)}`);
//             buffer = buffer.slice(messageEnd + 1);
//           } else {
//             Logger.warn(`Invalid data from client: ${dataStr.slice(0, 50)}...`);
//             socket.write(
//               Buffer.from(
//                 `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
//               )
//             );
//             buffer = Buffer.alloc(0);
//           }
//         }
//       }
//     } catch (error) {
//       Logger.error(`Error processing data from client`, error);
//       const err = DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         "Data processing failed"
//       );
//       socket.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
//       buffer = Buffer.alloc(0);
//       receivingFile = false;
//       fileTransfers.delete(fileId);
//       await chunkStorage
//         .clearChunks(fileId)
//         .catch((e) => Logger.error("Failed to clear chunks", e));
//       fileId = "";
//       lastLoggedChunkIndex = null;
//       setTransferProgress?.((prev) => [
//         ...prev.filter((p) => p.fileId !== fileId),
//         {
//           fileId,
//           fileName: fileTransfers.get(fileId)?.fileName || "unknown",
//           progress: "0/0 MB",
//           speed: "0 MB/s",
//           percentage: 0,
//           error: err.message,
//         },
//       ]);
//       setTransferStatus?.(`Error receiving file: ${err.message}`);
//     }
//   }

//   async function initializeFileTransfer(
//     headerData: FileHeader,
//     socket: TCPSocket.Socket,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >,
//     setTransferStatus?: (message: string) => void
//   ): Promise<void> {
//     const chunkStorage = ChunkStorage.getInstance();
//     await chunkStorage.ensureInitialized();

//     if (headerData.protocolVersion !== PROTOCOL_VERSION) {
//       Logger.error(
//         `Protocol version mismatch for ${headerData.fileId}: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
//       );
//       socket.write(
//         Buffer.from(
//           `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
//         )
//       );
//       buffer = Buffer.alloc(0);
//       throw new DropShareError(
//         ERROR_CODES.INVALID_HEADER,
//         `Protocol version mismatch: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
//       );
//     }

//     fileId = headerData.fileId;
//     const fileName = headerData.name;
//     const fileSize = headerData.size;
//     const deviceName = headerData.sender || "Unknown";
//     const totalChunks = headerData.totalChunks;
//     const chunkSize = headerData.chunkSize;

//     if (!fileName || !fileSize || !fileId || !totalChunks || !chunkSize) {
//       throw new DropShareError(
//         ERROR_CODES.INVALID_HEADER,
//         "Missing file name, size, ID, total chunks, or chunk size"
//       );
//     }

//     const { chunkSize: calculatedChunkSize } =
//       calculateDynamicChunkDivision(fileSize);
//     if (chunkSize !== calculatedChunkSize) {
//       Logger.error(
//         `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${chunkSize}`
//       );
//       throw new DropShareError(
//         ERROR_CODES.INVALID_HEADER,
//         `Chunk size mismatch: expected ${calculatedChunkSize}, received ${chunkSize}`
//       );
//     }

//     if (!checkTransferLimits(fileSize, fileTransfers)) {
//       socket.write(
//         Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
//       );
//       Logger.toast(`Transfer limit exceeded for ${fileName}`, "error");
//       buffer = Buffer.alloc(0);
//       throw new DropShareError(
//         ERROR_CODES.TRANSFER_LIMIT_EXCEEDED,
//         `Transfer limit exceeded for ${fileName}`
//       );
//     }

//     const availableChunks = await chunkStorage.getAvailableChunks(fileId);
//     const transfer: FileTransfer = {
//       fileId,
//       fileName,
//       fileSize,
//       deviceName,
//       senderIp: socket.remoteAddress || "unknown",
//       chunks: new Array(totalChunks).fill(undefined),
//       receivedBytes: availableChunks.reduce(
//         (sum, i) => sum + Math.min(chunkSize, fileSize - i * chunkSize),
//         0
//       ),
//       startTime: Date.now(),
//       totalChunks,
//       chunkSize,
//       totalSize: fileSize,
//       chunkHashes: new Array(totalChunks).fill(""),
//       aesKey: undefined,
//       iv: undefined,
//       status: "Receiving",
//       progress: (availableChunks.length / totalChunks) * 100,
//       lastChunkIndex: -1,
//       completedChunks: new Set(availableChunks),
//     };
//     fileTransfers.set(fileId, transfer);
//     setTransferStatus?.(`Recollecting previous transfer data for ${fileName}`);
//   }

//   return {
//     sendFilesInHost,
//     sendMessageInHost,
//     receiveFileInHost,
//   };
// };

import {
  calculateDynamicChunkDivision,
  checkTransferLimits,
} from "../utils/NetworkUtils";
import RNFS from "react-native-fs";
import { Buffer } from "buffer";
import { Logger } from "../utils/Logger";
import { DropShareError, ERROR_CODES } from "../utils/Error";
import TCPSocket from "react-native-tcp-socket";
import { ChunkStorage } from "./ChunkStorage";
import CryptoJS from "crypto-js";

// Interfaces
interface FileHeader {
  protocolVersion: string;
  name: string;
  size: number;
  sender: string;
  fileId: string;
  totalChunks: number;
  chunkSize: number;
}

interface HostReceiveProps {
  socket: TCPSocket.Socket;
  data: string | Buffer;
  setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
  setMessages: React.Dispatch<React.SetStateAction<string[]>>;
  connectedSockets: TCPSocket.Socket[];
  setTransferProgress?: React.Dispatch<
    React.SetStateAction<TransferProgress[]>
  >;
}

interface TransferProgress {
  fileId: string;
  fileName: string;
  progress: string;
  speed: string;
  percentage: number;
  status: string;
  error?: string;
}

let fileTransfers = new Map<string, FileTransfer>();
let buffer = Buffer.alloc(0);
let receivingFile = false;
let fileId = "";
let lastLoggedChunkIndex: number | null = null;

const MAX_RETRIES = 3;
const ACK_TIMEOUT = 60000; // 60s for slower networks
const PROTOCOL_VERSION = "1.0";
const MAX_CONCURRENT_CHUNKS = 5;
const MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10 MB

export const HostSharing = () => {
  async function sendFile(
    socket: TCPSocket.Socket,
    fileName: string,
    filePath: string,
    deviceName: string,
    fileId: string,
    setTransferProgress?: React.Dispatch<
      React.SetStateAction<TransferProgress[]>
    >
  ): Promise<void> {
    const chunkStorage = ChunkStorage.getInstance();
    let transfer: FileTransfer = {
      fileId,
      fileName,
      fileSize: 0,
      deviceName,
      senderIp: socket.localAddress || "unknown",
      chunks: [],
      receivedBytes: 0,
      startTime: Date.now(),
      totalChunks: 0,
      chunkSize: 0,
      totalSize: 0,
      chunkHashes: [],
      aesKey: undefined,
      iv: undefined,
      status: "Sending",
      progress: 0,
      lastChunkIndex: -1,
      completedChunks: new Set(),
    };
    fileTransfers.set(fileId, transfer);

    setTransferProgress?.((prev) => [
      ...prev.filter((p) => p.fileId !== fileId),
      {
        fileId,
        fileName,
        progress: "0/0 MB",
        speed: "0 MB/s",
        percentage: 0,
        status: "Recollecting previous transfer data",
      },
    ]);

    try {
      const stat = await RNFS.stat(filePath);
      const fileSize = stat.size;
      const { chunkSize, numChunks: totalChunks } =
        calculateDynamicChunkDivision(fileSize);

      transfer = {
        ...transfer,
        fileSize,
        totalChunks,
        chunkSize,
        totalSize: fileSize,
        chunks: new Array(totalChunks).fill(undefined),
        chunkHashes: new Array(totalChunks).fill(""),
      };
      fileTransfers.set(fileId, transfer);

      let retries = 0;
      while (retries < MAX_RETRIES) {
        try {
          if (retries > 0) {
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(
                  new DropShareError(
                    ERROR_CODES.NETWORK_ERROR,
                    `Timeout waiting for ACK_RESET (attempt ${retries + 1})`
                  )
                );
              }, ACK_TIMEOUT);
              socket.once("data", (data) => {
                clearTimeout(timeout);
                const message = data.toString();
                Logger.info(`Received for ACK_RESET: ${message}`);
                if (message.startsWith(`ACK_RESET:${fileId}`)) {
                  resolve();
                } else {
                  reject(
                    new DropShareError(
                      ERROR_CODES.INVALID_HEADER,
                      `Invalid ACK_RESET response: ${message}`
                    )
                  );
                }
              });
              socket.write(Buffer.from(`RESET:${fileId}\n`));
              Logger.info(`Sent RESET for ${fileId}`);
            });
          }

          let availableChunks: number[] = [];
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(
                new DropShareError(
                  ERROR_CODES.NETWORK_ERROR,
                  `Timeout waiting for ACK_FILE (attempt ${retries + 1})`
                )
              );
            }, ACK_TIMEOUT);
            socket.once("data", (data) => {
              clearTimeout(timeout);
              const message = data.toString();
              Logger.info(`Received for ACK_FILE: ${message}`);
              if (message.startsWith(`ACK_FILE:${fileId}:`)) {
                availableChunks = JSON.parse(message.split(":")[2]) || [];
                resolve();
              } else if (message.startsWith(`ACK_FILE:${fileId}`)) {
                resolve();
              } else {
                reject(
                  new DropShareError(
                    ERROR_CODES.INVALID_HEADER,
                    `Invalid ACK_FILE response: ${message}`
                  )
                );
              }
            });
            const header: FileHeader = {
              protocolVersion: PROTOCOL_VERSION,
              name: fileName,
              size: fileSize,
              sender: deviceName,
              fileId,
              totalChunks,
              chunkSize,
            };
            socket.write(Buffer.from(`FILE:${JSON.stringify(header)}\n\n`));
            Logger.info(`Sent header for ${fileId}: ${JSON.stringify(header)}`);
          });

          const pendingChunks = Array.from(
            { length: totalChunks },
            (_, i) => i
          ).filter((i) => !availableChunks.includes(i));
          let sentBytes = availableChunks.reduce(
            (sum, i) => sum + Math.min(chunkSize, fileSize - i * chunkSize),
            0
          );

          setTransferProgress?.((prev) => [
            ...prev.filter((p) => p.fileId !== fileId),
            {
              fileId,
              fileName,
              progress: `${(sentBytes / (1024 * 1024)).toFixed(2)}/${(
                fileSize /
                (1024 * 1024)
              ).toFixed(2)} MB`,
              speed: "0 MB/s",
              percentage: (sentBytes / fileSize) * 100,
              status: "Starting transfer",
            },
          ]);

          const sendChunk = async (chunkIndex: number): Promise<void> => {
            const start = chunkIndex * chunkSize;
            const actualChunkSize = Math.min(chunkSize, fileSize - start);
            const chunk = await RNFS.read(
              filePath,
              actualChunkSize,
              start,
              "base64"
            );
            const chunkBuffer = Buffer.from(chunk, "base64");
            const chunkHash = CryptoJS.SHA256(
              CryptoJS.enc.Base64.parse(chunk)
            ).toString(CryptoJS.enc.Hex);
            transfer.chunkHashes[chunkIndex] = chunkHash;
            fileTransfers.set(fileId, transfer);

            await chunkStorage.storeChunk(
              fileId,
              chunkIndex,
              actualChunkSize,
              chunk
            );

            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(
                  new DropShareError(
                    ERROR_CODES.NETWORK_ERROR,
                    `Timeout waiting for ACK_CHUNK:${chunkIndex} (attempt ${
                      retries + 1
                    })`
                  )
                );
              }, ACK_TIMEOUT);
              socket.once("data", (data) => {
                clearTimeout(timeout);
                const message = data.toString();
                Logger.info(`Received for ACK_CHUNK:${chunkIndex}: ${message}`);
                if (message.startsWith(`ACK_CHUNK:${fileId}:${chunkIndex}`)) {
                  resolve();
                } else if (message.startsWith("ERROR:")) {
                  reject(
                    new DropShareError(
                      ERROR_CODES.NETWORK_ERROR,
                      `Receiver error: ${message}`
                    )
                  );
                } else {
                  reject(
                    new DropShareError(
                      ERROR_CODES.INVALID_HEADER,
                      `Invalid ACK_CHUNK response: ${message}`
                    )
                  );
                }
              });
              const chunkHeader = Buffer.from(
                `CHUNK:${JSON.stringify({
                  fileId,
                  chunkIndex,
                  chunkSize: actualChunkSize,
                  chunkHash,
                })}\n\n`
              );
              socket.write(Buffer.concat([chunkHeader, Buffer.from(chunk)]));
              Logger.info(
                `Sent chunk ${chunkIndex}/${totalChunks} for ${fileId} (${actualChunkSize} bytes, hash: ${chunkHash})`
              );
            });

            sentBytes += actualChunkSize;
            const percentage = (sentBytes / fileSize) * 100;
            const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
            const speed = (sentBytes / elapsedTime / 1024 / 1024).toFixed(2);

            transfer.receivedBytes = sentBytes;
            transfer.progress = percentage;
            transfer.lastChunkIndex = chunkIndex;
            transfer.completedChunks.add(chunkIndex);
            fileTransfers.set(fileId, transfer);

            setTransferProgress?.((prev) => [
              ...prev.filter((p) => p.fileId !== fileId),
              {
                fileId,
                fileName,
                progress: `${(sentBytes / (1024 * 1024)).toFixed(2)}/${(
                  fileSize /
                  (1024 * 1024)
                ).toFixed(2)} MB`,
                speed: `${speed} MB/s`,
                percentage,
                status: "Transferring",
              },
            ]);
          };

          const queue = pendingChunks.slice();
          const activePromises: Promise<void>[] = [];
          while (queue.length > 0 || activePromises.length > 0) {
            while (
              queue.length > 0 &&
              activePromises.length < MAX_CONCURRENT_CHUNKS
            ) {
              const chunkIndex = queue.shift()!;
              activePromises.push(sendChunk(chunkIndex));
            }
            try {
              await Promise.race(activePromises);
            } catch (error) {
              Logger.warn(`Chunk send failed: ${error}`);
            }
            activePromises.splice(
              0,
              activePromises.length,
              ...activePromises.filter((p) => p !== Promise.resolve())
            );
          }
          await Promise.all(activePromises);

          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(
                new DropShareError(
                  ERROR_CODES.NETWORK_ERROR,
                  `Timeout waiting for ACK_COMPLETE (attempt ${retries + 1})`
                )
              );
            }, ACK_TIMEOUT);
            socket.once("data", (data) => {
              clearTimeout(timeout);
              const message = data.toString();
              Logger.info(`Received for ACK_COMPLETE: ${message}`);
              if (message.startsWith(`ACK_COMPLETE:${fileId}`)) {
                transfer.status = "Completed";
                transfer.endTime = Date.now();
                transfer.progress = 100;
                fileTransfers.set(fileId, transfer);
                const elapsedTime =
                  (Date.now() - transfer.startTime) / 1000 || 1;
                const speed = (fileSize / elapsedTime / 1024 / 1024).toFixed(2);
                setTransferProgress?.((prev) => [
                  ...prev.filter((p) => p.fileId !== fileId),
                  {
                    fileId,
                    fileName,
                    progress: `${(fileSize / (1024 * 1024)).toFixed(2)}/${(
                      fileSize /
                      (1024 * 1024)
                    ).toFixed(2)} MB`,
                    speed: `${speed} MB/s`,
                    percentage: 100,
                    status: "Sent",
                  },
                ]);
                resolve();
              } else if (message.startsWith("ERROR:")) {
                reject(
                  new DropShareError(
                    ERROR_CODES.NETWORK_ERROR,
                    `Receiver error: ${message}`
                  )
                );
              } else {
                reject(
                  new DropShareError(
                    ERROR_CODES.NETWORK_ERROR,
                    `Invalid ACK_COMPLETE response: ${message}`
                  )
                );
              }
            });
          });
          break;
        } catch (error) {
          retries++;
          if (retries === MAX_RETRIES) {
            throw error;
          }
          Logger.warn(`Retrying file send for ${fileId} after error: ${error}`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    } catch (error) {
      const err = DropShareError.from(
        error,
        ERROR_CODES.NETWORK_ERROR,
        `Transfer failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      transfer.status = "Failed";
      transfer.error = err.message;
      fileTransfers.set(fileId, transfer);
      setTransferProgress?.((prev) => [
        ...prev.filter((p) => p.fileId !== fileId),
        {
          fileId,
          fileName,
          progress: `${(transfer.receivedBytes / (1024 * 1024)).toFixed(2)}/${(
            transfer.totalSize /
            (1024 * 1024)
          ).toFixed(2)} MB`,
          speed: "0 MB/s",
          percentage: transfer.progress,
          status: "Failed",
          error: err.message,
        },
      ]);
      Logger.error(`Error in file transfer for ${fileName}`, error);
      throw err;
    } finally {
      if (transfer.status === "Completed" || transfer.status === "Failed") {
        await chunkStorage.clearChunks(fileId);
        fileTransfers.delete(fileId);
      }
    }
  }

  async function receiveFileInHost({
    data,
    setMessages,
    setReceivedFiles,
    socket,
    connectedSockets,
    setTransferProgress,
  }: HostReceiveProps): Promise<void> {
    const chunkStorage = ChunkStorage.getInstance();
    try {
      if (buffer.length > MAX_BUFFER_SIZE) {
        Logger.error("Buffer size exceeded, clearing buffer");
        buffer = Buffer.alloc(0);
        throw new DropShareError(
          ERROR_CODES.NETWORK_ERROR,
          "Buffer size exceeded"
        );
      }
      buffer = Buffer.concat([
        buffer,
        typeof data === "string" ? Buffer.from(data) : data,
      ]);
      Logger.info(
        `Received ${data.length} bytes, buffer now ${buffer.length} bytes`
      );

      while (buffer.length > 0) {
        const dataStr = buffer.toString();

        if (dataStr.startsWith("RESET:")) {
          const messageEnd = buffer.indexOf(Buffer.from("\n"));
          if (messageEnd === -1) {
            Logger.info(
              `Incomplete RESET from ${
                socket.remoteAddress ?? "unknown"
              }, waiting...`
            );
            return;
          }
          const resetFileId = dataStr.slice(6, messageEnd);
          Logger.info(`Received RESET for fileId ${resetFileId}`);
          if (resetFileId === fileId || !fileId) {
            receivingFile = false;
            fileTransfers.delete(resetFileId);
            await chunkStorage.clearChunks(resetFileId);
            fileId = "";
          }
          socket.write(Buffer.from(`ACK_RESET:${resetFileId}\n`));
          buffer = buffer.slice(messageEnd + 1);
          continue;
        }

        if (receivingFile) {
          if (dataStr.startsWith("CHUNK:")) {
            const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
            if (headerEnd === -1) {
              Logger.info(`Incomplete CHUNK header from client, waiting...`);
              return;
            }
            const headerStr = buffer.slice(6, headerEnd).toString();
            let chunkData: {
              fileId: string;
              chunkIndex: number;
              chunkSize: number;
              chunkHash: string;
            };
            try {
              chunkData = JSON.parse(headerStr);
            } catch (error) {
              Logger.error(
                `Failed to parse CHUNK header for fileId ${fileId}: ${headerStr}`,
                error
              );
              throw new DropShareError(
                ERROR_CODES.INVALID_HEADER,
                "Invalid chunk header"
              );
            }

            const chunkSize = chunkData.chunkSize;
            const chunkStart = headerEnd + 2;
            const expectedBase64Length = Math.ceil((chunkSize * 4) / 3);
            const minBase64Length = expectedBase64Length - 2;
            const maxBase64Length = expectedBase64Length + 2;
            const chunkEnd = chunkStart + expectedBase64Length;

            if (buffer.length < chunkEnd) {
              if (lastLoggedChunkIndex !== chunkData.chunkIndex) {
                Logger.info(
                  `Waiting for base64 chunk data for ${
                    chunkData.fileId
                  } (chunkIndex: ${
                    chunkData.chunkIndex
                  }, expected ${expectedBase64Length} bytes, received ${
                    buffer.length - chunkStart
                  } bytes)`
                );
                lastLoggedChunkIndex = chunkData.chunkIndex;
              }
              return;
            }

            let base64Chunk = buffer.slice(chunkStart, chunkEnd).toString();
            const actualBase64Length = base64Chunk.length;

            if (
              actualBase64Length < minBase64Length ||
              actualBase64Length > maxBase64Length
            ) {
              Logger.error(
                `Base64 length mismatch for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}): expected ${expectedBase64Length} (±2), received ${actualBase64Length}`
              );
              throw new DropShareError(
                ERROR_CODES.CORRUPTED_CHUNK,
                `Base64 length mismatch: expected ${expectedBase64Length} (±2), received ${actualBase64Length}`
              );
            }

            let chunk: Buffer;
            try {
              chunk = Buffer.from(base64Chunk, "base64");
              if (
                chunk.length !== chunkSize &&
                chunk.length !== chunkSize - 1 &&
                chunk.length !== chunkSize - 2
              ) {
                Logger.error(
                  `Chunk size mismatch for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}): expected ${chunkSize}, received ${chunk.length}`
                );
                throw new DropShareError(
                  ERROR_CODES.CORRUPTED_CHUNK,
                  `Chunk size mismatch: expected ${chunkSize}, received ${chunk.length}`
                );
              }
              const receivedHash = CryptoJS.SHA256(
                CryptoJS.enc.Base64.parse(base64Chunk)
              ).toString(CryptoJS.enc.Hex);
              if (receivedHash !== chunkData.chunkHash) {
                Logger.error(
                  `Hash mismatch for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}): expected ${chunkData.chunkHash}, received ${receivedHash}`
                );
                throw new DropShareError(
                  ERROR_CODES.CORRUPTED_CHUNK,
                  `Hash mismatch for chunk ${chunkData.chunkIndex}`
                );
              }
              Logger.info(
                `Verified hash for chunk ${chunkData.chunkIndex} of ${chunkData.fileId}: ${chunkData.chunkHash}`
              );
            } catch (error) {
              Logger.error(
                `Failed to decode or verify base64 chunk for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex})`,
                error
              );
              throw new DropShareError(
                ERROR_CODES.CORRUPTED_CHUNK,
                "Invalid base64 chunk data or hash"
              );
            }

            Logger.info(
              `Processed chunk ${chunkData.chunkIndex}/${
                fileTransfers.get(chunkData.fileId)?.totalChunks
              } for ${
                chunkData.fileId
              } (${chunkSize} bytes, base64 length: ${actualBase64Length}, decoded length: ${
                chunk.length
              }, hash: ${chunkData.chunkHash})`
            );
            lastLoggedChunkIndex = null;

            await chunkStorage.storeChunk(
              chunkData.fileId,
              chunkData.chunkIndex,
              chunkSize,
              base64Chunk
            );

            const transfer = fileTransfers.get(chunkData.fileId);
            if (transfer) {
              transfer.chunks[chunkData.chunkIndex] = chunk;
              transfer.receivedBytes += chunk.length;
              transfer.progress =
                (transfer.receivedBytes / transfer.totalSize) * 100;
              transfer.lastChunkIndex = chunkData.chunkIndex;
              transfer.completedChunks.add(chunkData.chunkIndex);
              transfer.chunkHashes[chunkData.chunkIndex] = chunkData.chunkHash;
              fileTransfers.set(chunkData.fileId, transfer);

              const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
              const speed = (
                transfer.receivedBytes /
                elapsedTime /
                1024 /
                1024
              ).toFixed(2);

              setTransferProgress?.((prev) => [
                ...prev.filter((p) => p.fileId !== chunkData.fileId),
                {
                  fileId: chunkData.fileId,
                  fileName: transfer.fileName,
                  progress: `${(transfer.receivedBytes / (1024 * 1024)).toFixed(
                    2
                  )}/${(transfer.totalSize / (1024 * 1024)).toFixed(2)} MB`,
                  speed: `${speed} MB/s`,
                  percentage: transfer.progress,
                  status: "Receiving",
                },
              ]);

              socket.write(
                Buffer.from(
                  `ACK_CHUNK:${chunkData.fileId}:${chunkData.chunkIndex}\n`
                )
              );
              Logger.info(
                `Sent ACK_CHUNK for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex})`
              );
              buffer = buffer.slice(chunkEnd);
              Logger.info(`Buffer sliced, remaining: ${buffer.length} bytes`);

              if (transfer.completedChunks.size === transfer.totalChunks) {
                const finalPath = await chunkStorage.assembleFile(
                  chunkData.fileId,
                  transfer.totalChunks,
                  transfer.fileName
                );
                setReceivedFiles((prev) => [...prev, finalPath]);
                Logger.info(
                  `Received and saved file: ${finalPath} from ${transfer.deviceName}`
                );
                transfer.status = "Completed";
                transfer.endTime = Date.now();
                socket.write(Buffer.from(`ACK_COMPLETE:${chunkData.fileId}\n`));
                fileTransfers.delete(chunkData.fileId);
                receivingFile = false;
                fileId = "";
                setTransferProgress?.((prev) => [
                  ...prev.filter((p) => p.fileId !== chunkData.fileId),
                  {
                    fileId: chunkData.fileId,
                    fileName: transfer.fileName,
                    progress: `${(transfer.totalSize / (1024 * 1024)).toFixed(
                      2
                    )}/${(transfer.totalSize / (1024 * 1024)).toFixed(2)} MB`,
                    speed: `${speed} MB/s`,
                    percentage: 100,
                    status: "Received",
                  },
                ]);
              }
            }
          } else if (dataStr.startsWith("FILE:") && fileId) {
            const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
            if (headerEnd === -1) {
              Logger.info(
                `Incomplete retransmission FILE header from ${
                  socket.remoteAddress ?? "unknown"
                }, waiting...`
              );
              return;
            }
            const headerStr = buffer.slice(5, headerEnd).toString();
            let headerData: FileHeader;
            try {
              headerData = JSON.parse(headerStr);
            } catch (error) {
              Logger.error(
                `Failed to parse retransmission FILE header: ${headerStr}`,
                error
              );
              throw new DropShareError(
                ERROR_CODES.INVALID_HEADER,
                "Invalid file header"
              );
            }

            if (headerData.fileId === fileId) {
              Logger.info(
                `Detected retransmission for fileId ${fileId}, resetting state`
              );
              receivingFile = false;
              fileTransfers.delete(fileId);
              await chunkStorage.clearChunks(fileId);
              await initializeFileTransfer(
                headerData,
                socket,
                setTransferProgress
              );
              const availableChunks = await chunkStorage.getAvailableChunks(
                fileId
              );
              socket.write(
                Buffer.from(
                  `ACK_FILE:${fileId}:${JSON.stringify(availableChunks)}\n`
                )
              );
              buffer = buffer.slice(headerEnd + 2);
              receivingFile = true;
            } else {
              Logger.warn(
                `Unexpected FILE header for different fileId ${headerData.fileId} while processing ${fileId}`
              );
              buffer = Buffer.alloc(0);
              return;
            }
          } else {
            Logger.warn(
              `Unexpected data while receiving file for ${fileId}: ${dataStr.slice(
                0,
                50
              )}...`
            );
            buffer = Buffer.alloc(0);
            return;
          }
        } else {
          if (dataStr.startsWith("FILE:")) {
            const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
            if (headerEnd === -1) {
              Logger.info(
                `Incomplete FILE header from ${
                  socket.remoteAddress ?? "unknown"
                }, waiting...`
              );
              return;
            }
            const headerStr = buffer.slice(5, headerEnd).toString();
            let headerData: FileHeader;
            try {
              headerData = JSON.parse(headerStr);
            } catch (error) {
              Logger.error(`Failed to parse FILE header: ${headerStr}`, error);
              throw new DropShareError(
                ERROR_CODES.INVALID_HEADER,
                "Invalid file header"
              );
            }

            await initializeFileTransfer(
              headerData,
              socket,
              setTransferProgress
            );
            const availableChunks = await chunkStorage.getAvailableChunks(
              headerData.fileId
            );
            socket.write(
              Buffer.from(
                `ACK_FILE:${headerData.fileId}:${JSON.stringify(
                  availableChunks
                )}\n`
              )
            );
            buffer = buffer.slice(headerEnd + 2);
            receivingFile = true;
            setTransferProgress?.((prev) => [
              ...prev.filter((p) => p.fileId !== headerData.fileId),
              {
                fileId: headerData.fileId,
                fileName: headerData.name,
                progress: "0/0 MB",
                speed: "0 MB/s",
                percentage: 0,
                status: "Recollecting previous transfer data",
              },
            ]);
          } else if (dataStr.startsWith("MSG:")) {
            const messageEnd = buffer.indexOf(Buffer.from("\n"));
            if (messageEnd === -1) {
              Logger.info(
                `Incomplete MSG from ${
                  socket.remoteAddress ?? "unknown"
                }, waiting...`
              );
              return;
            }
            const message = buffer.slice(4, messageEnd).toString();
            setMessages((prev) => [
              ...prev,
              `${socket.remoteAddress ?? "unknown"}: ${message}`,
            ]);
            connectedSockets
              .filter((s) => s !== socket)
              .forEach((s) => {
                s.write(Buffer.from(`MSG:${message}\n`));
                Logger.info(`Forwarded MSG to ${s.remoteAddress ?? "unknown"}`);
              });
            buffer = buffer.slice(messageEnd + 1);
          } else if (
            dataStr.startsWith("ACK_FILE:") ||
            dataStr.startsWith("ACK_COMPLETE:") ||
            dataStr.startsWith("ACK_CHUNK:")
          ) {
            const messageEnd = buffer.indexOf(Buffer.from("\n"));
            if (messageEnd === -1) {
              Logger.info(
                `Incomplete ${dataStr.slice(0, 10)} from ${
                  socket.remoteAddress ?? "unknown"
                }, waiting...`
              );
              return;
            }
            Logger.info(`Processed ${dataStr.slice(0, messageEnd)}`);
            buffer = buffer.slice(messageEnd + 1);
          } else {
            Logger.warn(
              `Invalid data from ${
                socket.remoteAddress ?? "unknown"
              }: ${dataStr.slice(0, 50)}...`
            );
            socket.write(
              Buffer.from(
                `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
              )
            );
            buffer = Buffer.alloc(0);
          }
        }
      }
    } catch (error) {
      Logger.error(
        `Error processing data from ${socket.remoteAddress ?? "unknown"}`,
        error
      );
      const err = DropShareError.from(
        error,
        ERROR_CODES.NETWORK_ERROR,
        "Data processing failed"
      );
      socket.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
      buffer = Buffer.alloc(0);
      receivingFile = false;
      fileTransfers.delete(fileId);
      await chunkStorage.clearChunks(fileId);
      fileId = "";
      lastLoggedChunkIndex = null;
      setTransferProgress?.((prev) => [
        ...prev.filter((p) => p.fileId !== fileId),
        {
          fileId,
          fileName: fileTransfers.get(fileId)?.fileName || "unknown",
          progress: "0/0 MB",
          speed: "0 MB/s",
          percentage: 0,
          status: "Failed",
          error: err.message,
        },
      ]);
    }
  }

  async function sendHostFile(
    server: TCPSocket.Server | null,
    filePath: string,
    username: string,
    connectedSockets: TCPSocket.Socket[],
    setTransferProgress?: React.Dispatch<
      React.SetStateAction<TransferProgress[]>
    >
  ): Promise<void> {
    if (!server || connectedSockets.length === 0) {
      Logger.toast("No connected clients to send file", "error");
      throw new DropShareError(
        ERROR_CODES.NETWORK_ERROR,
        "No connected clients"
      );
    }

    const fileName = filePath.split("/").pop() ?? "unknown";
    const fileId = `${username}_${fileName}`; // Consistent fileId for resumption

    try {
      await Promise.all(
        connectedSockets.map((socket) =>
          sendFile(
            socket,
            fileName,
            filePath,
            username,
            fileId,
            setTransferProgress
          )
        )
      );
      Logger.info(`Sent file: ${fileName} from ${username} to all clients`);
      Logger.toast(`Sent file ${fileName}`, "info");
    } catch (error) {
      Logger.error(`Failed to send file ${fileName}`, error);
      throw error;
    }
  }

  async function sendFilesInHost(
    server: TCPSocket.Server | null,
    files: { filePath: string }[],
    username: string,
    connectedSockets: TCPSocket.Socket[],
    setTransferProgress?: React.Dispatch<
      React.SetStateAction<TransferProgress[]>
    >
  ): Promise<void> {
    if (!server || connectedSockets.length === 0) {
      Logger.toast("No connected clients to send files", "error");
      throw new DropShareError(
        ERROR_CODES.NETWORK_ERROR,
        "No connected clients"
      );
    }

    for (const { filePath } of files) {
      await sendHostFile(
        server,
        filePath,
        username,
        connectedSockets,
        setTransferProgress
      );
      Logger.info(`Sent file: ${filePath.split("/").pop()} from ${username}`);
    }
  }

  function sendMessageInHost(
    message: string,
    username: string,
    connectedSockets: TCPSocket.Socket[]
  ): void {
    if (connectedSockets.length === 0) {
      Logger.toast("No connected clients to send message", "error");
      return;
    }

    connectedSockets.forEach((socket) => {
      socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
      Logger.info(
        `Sent MSG to ${socket.remoteAddress ?? "unknown"}: ${message}`
      );
    });
  }

  async function initializeFileTransfer(
    headerData: FileHeader,
    socket: TCPSocket.Socket,
    setTransferProgress?: React.Dispatch<
      React.SetStateAction<TransferProgress[]>
    >
  ): Promise<void> {
    const chunkStorage = ChunkStorage.getInstance();
    if (headerData.protocolVersion !== PROTOCOL_VERSION) {
      Logger.error(
        `Protocol version mismatch for ${headerData.fileId}: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
      );
      socket.write(
        Buffer.from(
          `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
        )
      );
      buffer = Buffer.alloc(0);
      throw new DropShareError(
        ERROR_CODES.INVALID_HEADER,
        `Protocol version mismatch: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
      );
    }

    fileId = headerData.fileId;
    const fileName = headerData.name;
    const fileSize = headerData.size;
    const deviceName = headerData.sender || "Unknown";
    const totalChunks = headerData.totalChunks;
    const chunkSize = headerData.chunkSize;

    if (!fileName || !fileSize || !fileId || !totalChunks || !chunkSize) {
      throw new DropShareError(
        ERROR_CODES.INVALID_HEADER,
        "Missing file name, size, ID, total chunks, or chunk size"
      );
    }

    const { chunkSize: calculatedChunkSize } =
      calculateDynamicChunkDivision(fileSize);
    if (chunkSize !== calculatedChunkSize) {
      Logger.error(
        `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${chunkSize}`
      );
      throw new DropShareError(
        ERROR_CODES.INVALID_HEADER,
        `Chunk size mismatch: expected ${calculatedChunkSize}, received ${chunkSize}`
      );
    }

    if (!checkTransferLimits(fileSize, fileTransfers)) {
      socket.write(
        Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
      );
      Logger.toast(`Transfer limit exceeded for ${fileName}`, "error");
      buffer = Buffer.alloc(0);
      throw new DropShareError(
        ERROR_CODES.TRANSFER_LIMIT_EXCEEDED,
        `Transfer limit exceeded for ${fileName}`
      );
    }

    const availableChunks = await chunkStorage.getAvailableChunks(fileId);
    const transfer: FileTransfer = {
      fileId,
      fileName,
      fileSize,
      deviceName,
      senderIp: socket.remoteAddress || "unknown",
      chunks: new Array(totalChunks).fill(undefined),
      receivedBytes: availableChunks.reduce(
        (sum, i) => sum + Math.min(chunkSize, fileSize - i * chunkSize),
        0
      ),
      startTime: Date.now(),
      totalChunks,
      chunkSize,
      totalSize: fileSize,
      chunkHashes: new Array(totalChunks).fill(""),
      aesKey: undefined,
      iv: undefined,
      status: "Receiving",
      progress: (availableChunks.length / totalChunks) * 100,
      lastChunkIndex: -1,
      completedChunks: new Set(availableChunks),
    };
    fileTransfers.set(fileId, transfer);
  }

  return {
    sendFilesInHost,
    sendMessageInHost,
    receiveFileInHost,
  };
};
