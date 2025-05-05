// import {
//   calculateDynamicChunkDivision,
//   checkTransferLimits,
// } from "../utils/NetworkUtils";
// import RNFS from "react-native-fs";
// import { Buffer } from "buffer";
// import { Logger } from "../utils/Logger";
// import { DropShareError, ERROR_CODES } from "../utils/Error";
// import TCPSocket from "react-native-tcp-socket";
// import { SAVE_PATH, TEMP_CHUNKS_PATH } from "../utils/FileSystemUtil";

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

// interface ReceiveProps {
//   socket: TCPSocket.Socket;
//   data: string | Buffer;
//   ip?: string; // Only for client role
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
//   setMessages: React.Dispatch<React.SetStateAction<string[]>>;
//   connectedSockets?: TCPSocket.Socket[]; // Only for host role
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
// const ACK_TIMEOUT = 15000;
// const PROTOCOL_VERSION = "1.0";
// const SPEED_WINDOW_DURATION = 1000; // 1 second window for speed calculation

// export const Sharing = (role: "host" | "client") => {
//   // Helper function to update transfer speed
//   function updateTransferSpeed(
//     transfer: FileTransfer,
//     bytes: number,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ) {
//     const currentTime = Date.now();
//     // Add new bytes to speed window
//     transfer.speedWindow = transfer.speedWindow || [];
//     transfer.speedWindow.push({ bytes, timestamp: currentTime });

//     // Filter out entries older than SPEED_WINDOW_DURATION
//     transfer.speedWindow = transfer.speedWindow.filter(
//       (entry) => currentTime - entry.timestamp <= SPEED_WINDOW_DURATION
//     );

//     // Calculate speed (bytes per second)
//     const totalBytesInWindow = transfer.speedWindow.reduce(
//       (sum, entry) => sum + entry.bytes,
//       0
//     );
//     const speed = totalBytesInWindow; // Bytes per second (over 1-second window)

//     setTransferProgress?.((prev) => {
//       const updated = prev.filter((p) => p.fileId !== transfer.fileId);
//       return [
//         ...updated,
//         {
//           fileId: transfer.fileId,
//           fileName: transfer.fileName,
//           transferredBytes: transfer.receivedBytes,
//           fileSize: transfer.totalSize,
//           speed,
//           status: transfer.status,
//           error: transfer.error,
//         },
//       ];
//     });
//   }

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
//       speedWindow: [],
//     };
//     fileTransfers.set(fileId, transfer);

//     try {
//       const stat = await RNFS.stat(filePath);
//       const fileSize = stat.size;
//       const { chunkSize, numChunks: totalChunks } =
//         calculateDynamicChunkDivision(fileSize);

//       // Update FileTransfer with actual values
//       transfer = {
//         ...transfer,
//         fileSize,
//         totalChunks,
//         chunkSize,
//         totalSize: fileSize,
//         chunks: new Array(totalChunks).fill(undefined),
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
//               const resetBuffer = Buffer.from(`RESET:${fileId}\n`);
//               socket.write(resetBuffer);
//               updateTransferSpeed(
//                 transfer,
//                 resetBuffer.length,
//                 setTransferProgress
//               );
//               Logger.info(`Sent RESET for ${fileId}`);
//             });
//           }

//           // Send file header
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
//               if (message.startsWith(`ACK_FILE:${fileId}`)) {
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
//               sender: deviceName,
//               fileId,
//               totalChunks,
//               chunkSize,
//             };
//             const headerBuffer = Buffer.from(
//               `FILE:${JSON.stringify(header)}\n\n`
//             );
//             socket.write(headerBuffer);
//             updateTransferSpeed(
//               transfer,
//               headerBuffer.length,
//               setTransferProgress
//             );
//             Logger.info(`Sent header for ${fileId}: ${JSON.stringify(header)}`);
//           });

//           let sentBytes = 0;
//           for (let i = 0; i < totalChunks; i++) {
//             const start = i * chunkSize;
//             const actualChunkSize = Math.min(chunkSize, fileSize - start);
//             // Read chunk as base64
//             const base64Chunk = await RNFS.read(
//               filePath,
//               actualChunkSize,
//               start,
//               "base64"
//             );
//             // Convert base64 to binary for transmission
//             const chunk = Buffer.from(base64Chunk, "base64");

//             // Send chunk
//             const chunkHeader = Buffer.from(
//               `CHUNK:${JSON.stringify({
//                 fileId,
//                 chunkIndex: i,
//                 chunkSize: actualChunkSize,
//               })}\n\n`
//             );
//             const chunkBuffer = Buffer.concat([chunkHeader, chunk]);
//             socket.write(chunkBuffer);
//             updateTransferSpeed(
//               transfer,
//               chunkBuffer.length,
//               setTransferProgress
//             );
//             Logger.info(
//               `Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
//             );

//             // Update progress
//             sentBytes += actualChunkSize;
//             const percentage = (sentBytes / fileSize) * 100;

//             transfer.receivedBytes = sentBytes;
//             transfer.progress = percentage;
//             transfer.lastChunkIndex = i;
//             fileTransfers.set(fileId, transfer);

//             // Wait for ACK
//             await new Promise<void>((resolve, reject) => {
//               const timeout = setTimeout(() => {
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.NETWORK_ERROR,
//                     `Timeout waiting for ACK_CHUNK:${i} (attempt ${
//                       retries + 1
//                     })`
//                   )
//                 );
//               }, ACK_TIMEOUT);
//               socket.once("data", (data) => {
//                 clearTimeout(timeout);
//                 const message = data.toString();
//                 Logger.info(`Received for ACK_CHUNK:${i}: ${message}`);
//                 if (message.startsWith(`ACK_CHUNK:${fileId}:${i}`)) {
//                   updateTransferSpeed(
//                     transfer,
//                     Buffer.from(message).length,
//                     setTransferProgress
//                   );
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
//             });
//           }

//           // Wait for final ACK
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
//                 updateTransferSpeed(
//                   transfer,
//                   Buffer.from(message).length,
//                   setTransferProgress
//                 );
//                 const elapsedTime =
//                   (Date.now() - transfer.startTime) / 1000 || 1;
//                 const finalSpeed = fileSize / elapsedTime;
//                 setTransferProgress?.((prev) => {
//                   const updated = prev.filter((p) => p.fileId !== fileId);
//                   return [
//                     ...updated,
//                     {
//                       fileId,
//                       fileName,
//                       transferredBytes: fileSize,
//                       fileSize,
//                       speed: finalSpeed,
//                       status: "Completed",
//                     },
//                   ];
//                 });
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
//       setTransferProgress?.((prev) => {
//         const updated = prev.filter((p) => p.fileId !== fileId);
//         return [
//           ...updated,
//           {
//             fileId,
//             fileName,
//             transferredBytes: transfer.receivedBytes,
//             fileSize: transfer.totalSize,
//             speed: 0,
//             status: "Failed",
//             error: err.message,
//           },
//         ];
//       });
//       Logger.error(`Error in file transfer for ${fileName}`, error);
//       throw err;
//     } finally {
//       if (transfer.status === "Completed" || transfer.status === "Failed") {
//         fileTransfers.delete(fileId);
//       }
//     }
//   }

//   async function sendFiles(
//     socket: TCPSocket.Socket | TCPSocket.Socket[] | null,
//     files: { filePath: string }[],
//     username: string,
//     connectedSockets: TCPSocket.Socket[],
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     if (!socket) {
//       Logger.toast("No active socket to send files", "error");
//       throw new DropShareError(ERROR_CODES.NETWORK_ERROR, "No active socket");
//     }

//     if (role === "host" && (!Array.isArray(socket) || socket.length === 0)) {
//       Logger.toast("No connected clients to send files", "error");
//       throw new DropShareError(
//         ERROR_CODES.NETWORK_ERROR,
//         "No connected clients"
//       );
//     }

//     for (const { filePath } of files) {
//       const fileName = filePath.split("/").pop() ?? "unknown";
//       const fileId = `${username}_${fileName}_${Date.now()}`;

//       if (role === "host" && Array.isArray(socket)) {
//         try {
//           await Promise.all(
//             socket.map((s) =>
//               sendFile(
//                 s,
//                 fileName,
//                 filePath,
//                 username,
//                 fileId,
//                 setTransferProgress
//               )
//             )
//           );
//           Logger.info(`Sent file: ${fileName} from ${username} to all clients`);
//           Logger.toast(`Sent file ${fileName}`, "info");
//         } catch (error) {
//           Logger.error(`Failed to send file ${fileName}`, error);
//           throw error;
//         }
//       } else if (role === "client" && !Array.isArray(socket)) {
//         await sendFile(
//           socket,
//           fileName,
//           filePath,
//           username,
//           fileId,
//           setTransferProgress
//         );
//         Logger.info(`Sent file: ${fileName} from ${username} to host`);
//         Logger.toast(`Sent file ${fileName}`, "info");
//       }
//     }
//   }

//   function sendMessage(
//     socket: TCPSocket.Socket | TCPSocket.Socket[] | null,
//     message: string,
//     username: string,
//     connectedSockets: TCPSocket.Socket[]
//   ): void {
//     if (!socket) {
//       Logger.toast("No active socket to send message", "error");
//       return;
//     }

//     if (role === "host" && Array.isArray(socket)) {
//       if (socket.length === 0) {
//         Logger.toast("No connected clients to send message", "error");
//         return;
//       }
//       socket.forEach((s) => {
//         s.write(Buffer.from(`MSG:${username}: ${message}\n`));
//         Logger.info(`Sent MSG to ${s.remoteAddress ?? "unknown"}: ${message}`);
//       });
//     } else if (role === "client" && !Array.isArray(socket)) {
//       socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
//       Logger.info(`Sent MSG to host: ${message}`);
//     }
//   }

//   async function receiveFile({
//     socket,
//     data,
//     ip,
//     setMessages,
//     setReceivedFiles,
//     connectedSockets,
//     setTransferProgress,
//   }: ReceiveProps): Promise<void> {
//     const source =
//       role === "host" ? socket.remoteAddress ?? "unknown" : ip ?? "host";
//     try {
//       const dataBytes =
//         typeof data === "string" ? Buffer.from(data).length : data.length;
//       buffer = Buffer.concat([
//         buffer,
//         typeof data === "string" ? Buffer.from(data) : data,
//       ]);

//       // Update speed for incoming bytes
//       if (receivingFile) {
//         const transfer = fileTransfers.get(fileId);
//         if (transfer) {
//           updateTransferSpeed(transfer, dataBytes, setTransferProgress);
//         }
//       }

//       while (buffer.length > 0) {
//         const dataStr = buffer.toString();

//         if (dataStr.startsWith("RESET:")) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) {
//             Logger.info(`Incomplete RESET from ${source}, waiting...`);
//             return;
//           }
//           const resetFileId = dataStr.slice(6, messageEnd);
//           Logger.info(`Received RESET for fileId ${resetFileId}`);
//           if (resetFileId === fileId || !fileId) {
//             receivingFile = false;
//             fileTransfers.delete(resetFileId);
//             const tempPath = `${TEMP_CHUNKS_PATH}/${resetFileId}`;
//             if (await RNFS.exists(tempPath)) {
//               await RNFS.unlink(tempPath).catch((err) =>
//                 Logger.error(`Failed to delete temp file ${tempPath}`, err)
//               );
//             }
//             fileId = "";
//           }
//           const ackBuffer = Buffer.from(`ACK_RESET:${resetFileId}\n`);
//           socket.write(ackBuffer);
//           const transfer = fileTransfers.get(resetFileId);
//           if (transfer) {
//             updateTransferSpeed(
//               transfer,
//               ackBuffer.length,
//               setTransferProgress
//             );
//           }
//           buffer = buffer.slice(messageEnd + 1);
//           continue;
//         }

//         if (receivingFile) {
//           if (dataStr.startsWith("CHUNK:")) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(`Incomplete CHUNK header from ${source}, waiting...`);
//               return;
//             }
//             const headerStr = buffer.slice(6, headerEnd).toString();
//             let chunkData: {
//               fileId: string;
//               chunkIndex: number;
//               chunkSize: number;
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
//             const chunkEnd = chunkStart + chunkSize;

//             if (buffer.length < chunkEnd) {
//               if (lastLoggedChunkIndex !== chunkData.chunkIndex) {
//                 Logger.info(
//                   `Waiting for chunk data for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}, expected ${chunkSize} bytes)`
//                 );
//                 lastLoggedChunkIndex = chunkData.chunkIndex;
//               }
//               return;
//             }

//             const chunk = buffer.slice(chunkStart, chunkEnd);

//             if (chunk.length !== chunkSize) {
//               Logger.error(
//                 `Chunk size mismatch for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}): expected ${chunkSize}, received ${chunk.length}`
//               );
//               throw new DropShareError(
//                 ERROR_CODES.CORRUPTED_CHUNK,
//                 `Chunk size mismatch: expected ${chunkSize}, received ${chunk.length}`
//               );
//             }

//             Logger.info(
//               `Processed chunk ${chunkData.chunkIndex} for ${chunkData.fileId}`
//             );
//             lastLoggedChunkIndex = null;

//             const tempPath = `${TEMP_CHUNKS_PATH}/${chunkData.fileId}`;
//             if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
//               await RNFS.mkdir(TEMP_CHUNKS_PATH);
//             }

//             // Convert binary chunk to base64 for RNFS
//             const base64Chunk = chunk.toString("base64");
//             await RNFS.appendFile(tempPath, base64Chunk, "base64");

//             const transfer = fileTransfers.get(chunkData.fileId);
//             if (transfer) {
//               transfer.chunks[chunkData.chunkIndex] = chunk;
//               transfer.receivedBytes += chunkSize;
//               transfer.progress =
//                 (transfer.receivedBytes / transfer.totalSize) * 100;
//               transfer.lastChunkIndex = chunkData.chunkIndex;
//               fileTransfers.set(chunkData.fileId, transfer);

//               const ackBuffer = Buffer.from(
//                 `ACK_CHUNK:${chunkData.fileId}:${chunkData.chunkIndex}\n`
//               );
//               socket.write(ackBuffer);
//               updateTransferSpeed(
//                 transfer,
//                 ackBuffer.length,
//                 setTransferProgress
//               );
//               buffer = buffer.slice(chunkEnd);

//               if (transfer.receivedBytes === transfer.totalSize) {
//                 if (!(await RNFS.exists(SAVE_PATH))) {
//                   await RNFS.mkdir(SAVE_PATH);
//                   Logger.info(`Created directory ${SAVE_PATH}`);
//                 }

//                 const sanitizedFileName = transfer.fileName.replace(
//                   /[^a-zA-Z0-9.-]/g,
//                   "_"
//                 );
//                 const finalPath = `${SAVE_PATH}/${sanitizedFileName}`;
//                 try {
//                   // Move file (already in base64, RNFS handles it correctly)
//                   await RNFS.moveFile(tempPath, finalPath);
//                   setReceivedFiles((prev) => [...prev, finalPath]);
//                   Logger.info(
//                     `Received and saved file: ${finalPath} from ${transfer.deviceName}`
//                   );
//                   transfer.status = "Completed";
//                   transfer.endTime = Date.now();
//                   const ackCompleteBuffer = Buffer.from(
//                     `ACK_COMPLETE:${chunkData.fileId}\n`
//                   );
//                   socket.write(ackCompleteBuffer);
//                   updateTransferSpeed(
//                     transfer,
//                     ackCompleteBuffer.length,
//                     setTransferProgress
//                   );

//                   setTransferProgress?.((prev) => {
//                     const updated = prev.filter(
//                       (p) => p.fileId !== chunkData.fileId
//                     );
//                     return [
//                       ...updated,
//                       {
//                         fileId: chunkData.fileId,
//                         fileName: transfer.fileName,
//                         transferredBytes: transfer.receivedBytes,
//                         fileSize: transfer.totalSize,
//                         speed:
//                           transfer.receivedBytes /
//                           ((Date.now() - transfer.startTime) / 1000 || 1),
//                         status: "Completed",
//                       },
//                     ];
//                   });
//                 } catch (error) {
//                   Logger.error(`Failed to move file to ${finalPath}`, error);
//                   throw new DropShareError(
//                     ERROR_CODES.DATABASE_WRITE_ERROR,
//                     `Failed to save file: ${
//                       error instanceof Error ? error.message : "Unknown error"
//                     }`
//                   );
//                 } finally {
//                   if (await RNFS.exists(tempPath)) {
//                     await RNFS.unlink(tempPath).catch((err) =>
//                       Logger.error(
//                         `Failed to delete temp file ${tempPath}`,
//                         err
//                       )
//                     );
//                   }
//                   fileTransfers.delete(chunkData.fileId);
//                   receivingFile = false;
//                   fileId = "";
//                 }
//               }
//             }
//           } else if (dataStr.startsWith("FILE:") && fileId) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(
//                 `Incomplete retransmission FILE header from ${source}, waiting...`
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
//               const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
//               if (await RNFS.exists(tempPath)) {
//                 await RNFS.unlink(tempPath).catch((err) =>
//                   Logger.error(`Failed to delete temp file ${tempPath}`, err)
//                 );
//               }
//               await initializeFileTransfer(
//                 headerData,
//                 socket,
//                 setTransferProgress
//               );
//               const ackBuffer = Buffer.from(`ACK_FILE:${fileId}\n`);
//               socket.write(ackBuffer);
//               const transfer = fileTransfers.get(fileId);
//               if (transfer) {
//                 updateTransferSpeed(
//                   transfer,
//                   ackBuffer.length,
//                   setTransferProgress
//                 );
//               }
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
//               Logger.info(`Incomplete FILE header from ${source}, waiting...`);
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
//               setTransferProgress
//             );
//             const ackBuffer = Buffer.from(`ACK_FILE:${headerData.fileId}\n`);
//             socket.write(ackBuffer);
//             const transfer = fileTransfers.get(headerData.fileId);
//             if (transfer) {
//               updateTransferSpeed(
//                 transfer,
//                 ackBuffer.length,
//                 setTransferProgress
//               );
//             }
//             buffer = buffer.slice(headerEnd + 2);
//             receivingFile = true;
//           } else if (dataStr.startsWith("MSG:")) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(`Incomplete MSG from ${source}, waiting...`);
//               return;
//             }
//             const message = buffer.slice(4, messageEnd).toString();
//             setMessages((prev) => [
//               ...prev,
//               `${role === "host" ? source : "Host"}: ${message}`,
//             ]);
//             if (role === "host" && connectedSockets) {
//               connectedSockets
//                 .filter((s) => s !== socket)
//                 .forEach((s) => {
//                   s.write(Buffer.from(`MSG:${message}\n`));
//                   Logger.info(
//                     `Forwarded MSG to ${s.remoteAddress ?? "unknown"}`
//                   );
//                 });
//             }
//             buffer = buffer.slice(messageEnd + 1);
//           } else if (
//             dataStr.startsWith("ACK_FILE:") ||
//             dataStr.startsWith("ACK_COMPLETE:") ||
//             dataStr.startsWith("ACK_CHUNK:")
//           ) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(
//                 `Incomplete ${dataStr.slice(0, 10)} from ${source}, waiting...`
//               );
//               return;
//             }
//             Logger.info(`Processed ${dataStr.slice(0, messageEnd)}`);
//             buffer = buffer.slice(messageEnd + 1);
//           } else {
//             Logger.warn(
//               `Invalid data from ${source}: ${dataStr.slice(0, 50)}...`
//             );
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
//       Logger.error(`Error processing data from ${source}`, error);
//       const err = DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         "Data processing failed"
//       );
//       socket.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
//       buffer = Buffer.alloc(0);
//       receivingFile = false;
//       fileTransfers.delete(fileId);
//       const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
//       if (await RNFS.exists(tempPath)) {
//         await RNFS.unlink(tempPath).catch((err) =>
//           Logger.error(`Failed to delete temp file ${tempPath}`, err)
//         );
//       }
//       fileId = "";
//       setTransferProgress?.((prev) => {
//         const updated = prev.filter((p) => p.fileId !== fileId);
//         return [
//           ...updated,
//           {
//             fileId,
//             fileName: fileTransfers.get(fileId)?.fileName || "unknown",
//             transferredBytes: 0,
//             fileSize: 0,
//             speed: 0,
//             status: "Failed",
//             error: err.message,
//           },
//         ];
//       });
//     }
//   }

//   async function initializeFileTransfer(
//     headerData: FileHeader,
//     socket: TCPSocket.Socket,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     if (headerData.protocolVersion !== PROTOCOL_VERSION) {
//       Logger.error(
//         `Protocol version mismatch for ${headerData.fileId}: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
//       );
//       socket.write(
//         Buffer.from(
//           `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
//         )
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

//     const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
//     if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
//       await RNFS.mkdir(TEMP_CHUNKS_PATH);
//     }
//     await RNFS.writeFile(tempPath, "", "base64");

//     const transfer: FileTransfer = {
//       fileId,
//       fileName,
//       fileSize,
//       deviceName,
//       senderIp: socket.remoteAddress || "unknown",
//       chunks: new Array(totalChunks).fill(undefined),
//       receivedBytes: 0,
//       startTime: Date.now(),
//       totalChunks,
//       chunkSize,
//       totalSize: fileSize,
//       chunkHashes: [],
//       aesKey: undefined,
//       iv: undefined,
//       status: "Receiving",
//       progress: 0,
//       lastChunkIndex: -1,
//       speedWindow: [],
//     };
//     fileTransfers.set(fileId, transfer);

//     setTransferProgress?.((prev) => {
//       const updated = prev.filter((p) => p.fileId !== fileId);
//       return [
//         ...updated,
//         {
//           fileId,
//           fileName,
//           transferredBytes: 0,
//           fileSize,
//           speed: 0,
//           status: "Receiving",
//         },
//       ];
//     });
//   }

//   return {
//     sendFiles,
//     sendMessage,
//     receiveFile,
//   };
// };

// // message improvement

// import {
//   calculateDynamicChunkDivision,
//   checkTransferLimits,
// } from "../utils/NetworkUtils";
// import RNFS from "react-native-fs";
// import { Buffer } from "buffer";
// import { Logger } from "../utils/Logger";
// import { DropShareError, ERROR_CODES } from "../utils/Error";
// import TCPSocket from "react-native-tcp-socket";
// import { SAVE_PATH, TEMP_CHUNKS_PATH } from "../utils/FileSystemUtil";

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

// interface ReceiveProps {
//   socket: TCPSocket.Socket;
//   data: string | Buffer;
//   ip?: string; // Only for client role
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
//   setMessages: React.Dispatch<React.SetStateAction<message[]>>;
//   connectedSockets?: TCPSocket.Socket[]; // Only for host role
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
// const ACK_TIMEOUT = 15000;
// const PROTOCOL_VERSION = "1.0";
// const SPEED_WINDOW_DURATION = 1000; // 1 second window for speed calculation

// export const Sharing = (role: "host" | "client") => {
//   // Helper function to update transfer speed
//   function updateTransferSpeed(
//     transfer: FileTransfer,
//     bytes: number,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ) {
//     const currentTime = Date.now();
//     // Add new bytes to speed window
//     transfer.speedWindow = transfer.speedWindow || [];
//     transfer.speedWindow.push({ bytes, timestamp: currentTime });

//     // Filter out entries older than SPEED_WINDOW_DURATION
//     transfer.speedWindow = transfer.speedWindow.filter(
//       (entry) => currentTime - entry.timestamp <= SPEED_WINDOW_DURATION
//     );

//     // Calculate speed (bytes per second)
//     const totalBytesInWindow = transfer.speedWindow.reduce(
//       (sum, entry) => sum + entry.bytes,
//       0
//     );
//     const speed = totalBytesInWindow; // Bytes per second (over 1-second window)

//     setTransferProgress?.((prev) => {
//       const updated = prev.filter((p) => p.fileId !== transfer.fileId);
//       return [
//         ...updated,
//         {
//           fileId: transfer.fileId,
//           fileName: transfer.fileName,
//           transferredBytes: transfer.receivedBytes,
//           fileSize: transfer.totalSize,
//           speed,
//           status: transfer.status,
//           error: transfer.error,
//         },
//       ];
//     });
//   }

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
//       speedWindow: [],
//     };
//     fileTransfers.set(fileId, transfer);

//     try {
//       const stat = await RNFS.stat(filePath);
//       const fileSize = stat.size;
//       const { chunkSize, numChunks: totalChunks } =
//         calculateDynamicChunkDivision(fileSize);

//       // Update FileTransfer with actual values
//       transfer = {
//         ...transfer,
//         fileSize,
//         totalChunks,
//         chunkSize,
//         totalSize: fileSize,
//         chunks: new Array(totalChunks).fill(undefined),
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
//               const resetBuffer = Buffer.from(`RESET:${fileId}\n`);
//               socket.write(resetBuffer);
//               updateTransferSpeed(
//                 transfer,
//                 resetBuffer.length,
//                 setTransferProgress
//               );
//               Logger.info(`Sent RESET for ${fileId}`);
//             });
//           }

//           // Send file header
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
//               if (message.startsWith(`ACK_FILE:${fileId}`)) {
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
//               sender: deviceName,
//               fileId,
//               totalChunks,
//               chunkSize,
//             };
//             const headerBuffer = Buffer.from(
//               `FILE:${JSON.stringify(header)}\n\n`
//             );
//             socket.write(headerBuffer);
//             updateTransferSpeed(
//               transfer,
//               headerBuffer.length,
//               setTransferProgress
//             );
//             Logger.info(`Sent header for ${fileId}: ${JSON.stringify(header)}`);
//           });

//           let sentBytes = 0;
//           for (let i = 0; i < totalChunks; i++) {
//             const start = i * chunkSize;
//             const actualChunkSize = Math.min(chunkSize, fileSize - start);
//             // Read chunk as base64
//             const base64Chunk = await RNFS.read(
//               filePath,
//               actualChunkSize,
//               start,
//               "base64"
//             );
//             // Convert base64 to binary for transmission
//             const chunk = Buffer.from(base64Chunk, "base64");

//             // Send chunk
//             const chunkHeader = Buffer.from(
//               `CHUNK:${JSON.stringify({
//                 fileId,
//                 chunkIndex: i,
//                 chunkSize: actualChunkSize,
//               })}\n\n`
//             );
//             const chunkBuffer = Buffer.concat([chunkHeader, chunk]);
//             socket.write(chunkBuffer);
//             updateTransferSpeed(
//               transfer,
//               chunkBuffer.length,
//               setTransferProgress
//             );
//             Logger.info(
//               `Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
//             );

//             // Update progress
//             sentBytes += actualChunkSize;
//             const percentage = (sentBytes / fileSize) * 100;

//             transfer.receivedBytes = sentBytes;
//             transfer.progress = percentage;
//             transfer.lastChunkIndex = i;
//             fileTransfers.set(fileId, transfer);

//             // Wait for ACK
//             await new Promise<void>((resolve, reject) => {
//               const timeout = setTimeout(() => {
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.NETWORK_ERROR,
//                     `Timeout waiting for ACK_CHUNK:${i} (attempt ${
//                       retries + 1
//                     })`
//                   )
//                 );
//               }, ACK_TIMEOUT);
//               socket.once("data", (data) => {
//                 clearTimeout(timeout);
//                 const message = data.toString();
//                 Logger.info(`Received for ACK_CHUNK:${i}: ${message}`);
//                 if (message.startsWith(`ACK_CHUNK:${fileId}:${i}`)) {
//                   updateTransferSpeed(
//                     transfer,
//                     Buffer.from(message).length,
//                     setTransferProgress
//                   );
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
//             });
//           }

//           // Wait for final ACK
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
//                 updateTransferSpeed(
//                   transfer,
//                   Buffer.from(message).length,
//                   setTransferProgress
//                 );
//                 const elapsedTime =
//                   (Date.now() - transfer.startTime) / 1000 || 1;
//                 const finalSpeed = fileSize / elapsedTime;
//                 setTransferProgress?.((prev) => {
//                   const updated = prev.filter((p) => p.fileId !== fileId);
//                   return [
//                     ...updated,
//                     {
//                       fileId,
//                       fileName,
//                       transferredBytes: fileSize,
//                       fileSize,
//                       speed: finalSpeed,
//                       status: "Completed",
//                     },
//                   ];
//                 });
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
//       setTransferProgress?.((prev) => {
//         const updated = prev.filter((p) => p.fileId !== fileId);
//         return [
//           ...updated,
//           {
//             fileId,
//             fileName,
//             transferredBytes: transfer.receivedBytes,
//             fileSize: transfer.totalSize,
//             speed: 0,
//             status: "Failed",
//             error: err.message,
//           },
//         ];
//       });
//       Logger.error(`Error in file transfer for ${fileName}`, error);
//       throw err;
//     } finally {
//       if (transfer.status === "Completed" || transfer.status === "Failed") {
//         fileTransfers.delete(fileId);
//       }
//     }
//   }

//   async function sendFiles(
//     socket: TCPSocket.Socket | TCPSocket.Socket[] | null,
//     files: { filePath: string }[],
//     username: string,
//     connectedSockets: TCPSocket.Socket[],
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     if (!socket) {
//       Logger.toast("No active socket to send files", "error");
//       throw new DropShareError(ERROR_CODES.NETWORK_ERROR, "No active socket");
//     }

//     if (role === "host" && (!Array.isArray(socket) || socket.length === 0)) {
//       Logger.toast("No connected clients to send files", "error");
//       throw new DropShareError(
//         ERROR_CODES.NETWORK_ERROR,
//         "No connected clients"
//       );
//     }

//     for (const { filePath } of files) {
//       const fileName = filePath.split("/").pop() ?? "unknown";
//       const fileId = `${username}_${fileName}_${Date.now()}`;

//       if (role === "host" && Array.isArray(socket)) {
//         try {
//           await Promise.all(
//             socket.map((s) =>
//               sendFile(
//                 s,
//                 fileName,
//                 filePath,
//                 username,
//                 fileId,
//                 setTransferProgress
//               )
//             )
//           );
//           Logger.info(`Sent file: ${fileName} from ${username} to all clients`);
//           Logger.toast(`Sent file ${fileName}`, "info");
//         } catch (error) {
//           Logger.error(`Failed to send file ${fileName}`, error);
//           throw error;
//         }
//       } else if (role === "client" && !Array.isArray(socket)) {
//         await sendFile(
//           socket,
//           fileName,
//           filePath,
//           username,
//           fileId,
//           setTransferProgress
//         );
//         Logger.info(`Sent file: ${fileName} from ${username} to host`);
//         Logger.toast(`Sent file ${fileName}`, "info");
//       }
//     }
//   }

//   function sendMessage(
//     socket: TCPSocket.Socket | TCPSocket.Socket[] | null,
//     messages: string,
//     username: string,
//     connectedSockets: TCPSocket.Socket[],
//     senderIP: string
//   ): void {
//     if (!socket) {
//       Logger.toast("No active socket to send message", "error");
//       return;
//     }

//     const message: message = {
//       ip: senderIP,
//       message: messages,
//       name: username,
//     };

//     const messageBuffer = Buffer.from(`MSG:${JSON.stringify(message)}\n\n`);

//     if (role === "host" && Array.isArray(socket)) {
//       if (socket.length === 0) {
//         Logger.toast("No connected clients to send message", "error");
//         return;
//       }
//       socket.forEach((s) => {
//         s.write(messageBuffer);
//         Logger.info(`Sent MSG to ${s.remoteAddress ?? "unknown"}: ${message}`);
//       });
//     } else if (role === "client" && !Array.isArray(socket)) {
//       socket.write(Buffer.from(messageBuffer));
//       Logger.info(`Sent MSG to host: ${message}`);
//     }
//   }

//   async function receiveFile({
//     socket,
//     data,
//     ip,
//     setMessages,
//     setReceivedFiles,
//     connectedSockets,
//     setTransferProgress,
//   }: ReceiveProps): Promise<void> {
//     const source =
//       role === "host" ? socket.remoteAddress ?? "unknown" : ip ?? "host";
//     try {
//       const dataBytes =
//         typeof data === "string" ? Buffer.from(data).length : data.length;
//       buffer = Buffer.concat([
//         buffer,
//         typeof data === "string" ? Buffer.from(data) : data,
//       ]);

//       // Update speed for incoming bytes
//       if (receivingFile) {
//         const transfer = fileTransfers.get(fileId);
//         if (transfer) {
//           updateTransferSpeed(transfer, dataBytes, setTransferProgress);
//         }
//       }

//       while (buffer.length > 0) {
//         const dataStr = buffer.toString();

//         if (dataStr.startsWith("RESET:")) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) {
//             Logger.info(`Incomplete RESET from ${source}, waiting...`);
//             return;
//           }
//           const resetFileId = dataStr.slice(6, messageEnd);
//           Logger.info(`Received RESET for fileId ${resetFileId}`);
//           if (resetFileId === fileId || !fileId) {
//             receivingFile = false;
//             fileTransfers.delete(resetFileId);
//             const tempPath = `${TEMP_CHUNKS_PATH}/${resetFileId}`;
//             if (await RNFS.exists(tempPath)) {
//               await RNFS.unlink(tempPath).catch((err) =>
//                 Logger.error(`Failed to delete temp file ${tempPath}`, err)
//               );
//             }
//             fileId = "";
//           }
//           const ackBuffer = Buffer.from(`ACK_RESET:${resetFileId}\n`);
//           socket.write(ackBuffer);
//           const transfer = fileTransfers.get(resetFileId);
//           if (transfer) {
//             updateTransferSpeed(
//               transfer,
//               ackBuffer.length,
//               setTransferProgress
//             );
//           }
//           buffer = buffer.slice(messageEnd + 1);
//           continue;
//         }

//         if (receivingFile) {
//           if (dataStr.startsWith("CHUNK:")) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(`Incomplete CHUNK header from ${source}, waiting...`);
//               return;
//             }
//             const headerStr = buffer.slice(6, headerEnd).toString();
//             let chunkData: {
//               fileId: string;
//               chunkIndex: number;
//               chunkSize: number;
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
//             const chunkEnd = chunkStart + chunkSize;

//             if (buffer.length < chunkEnd) {
//               if (lastLoggedChunkIndex !== chunkData.chunkIndex) {
//                 Logger.info(
//                   `Waiting for chunk data for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}, expected ${chunkSize} bytes)`
//                 );
//                 lastLoggedChunkIndex = chunkData.chunkIndex;
//               }
//               return;
//             }

//             const chunk = buffer.slice(chunkStart, chunkEnd);

//             if (chunk.length !== chunkSize) {
//               Logger.error(
//                 `Chunk size mismatch for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}): expected ${chunkSize}, received ${chunk.length}`
//               );
//               throw new DropShareError(
//                 ERROR_CODES.CORRUPTED_CHUNK,
//                 `Chunk size mismatch: expected ${chunkSize}, received ${chunk.length}`
//               );
//             }

//             Logger.info(
//               `Processed chunk ${chunkData.chunkIndex} for ${chunkData.fileId}`
//             );
//             lastLoggedChunkIndex = null;

//             const tempPath = `${TEMP_CHUNKS_PATH}/${chunkData.fileId}`;
//             if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
//               await RNFS.mkdir(TEMP_CHUNKS_PATH);
//             }

//             // Convert binary chunk to base64 for RNFS
//             const base64Chunk = chunk.toString("base64");
//             await RNFS.appendFile(tempPath, base64Chunk, "base64");

//             const transfer = fileTransfers.get(chunkData.fileId);
//             if (transfer) {
//               transfer.chunks[chunkData.chunkIndex] = chunk;
//               transfer.receivedBytes += chunkSize;
//               transfer.progress =
//                 (transfer.receivedBytes / transfer.totalSize) * 100;
//               transfer.lastChunkIndex = chunkData.chunkIndex;
//               fileTransfers.set(chunkData.fileId, transfer);

//               const ackBuffer = Buffer.from(
//                 `ACK_CHUNK:${chunkData.fileId}:${chunkData.chunkIndex}\n`
//               );
//               socket.write(ackBuffer);
//               updateTransferSpeed(
//                 transfer,
//                 ackBuffer.length,
//                 setTransferProgress
//               );
//               buffer = buffer.slice(chunkEnd);

//               if (transfer.receivedBytes === transfer.totalSize) {
//                 if (!(await RNFS.exists(SAVE_PATH))) {
//                   await RNFS.mkdir(SAVE_PATH);
//                   Logger.info(`Created directory ${SAVE_PATH}`);
//                 }

//                 const sanitizedFileName = transfer.fileName.replace(
//                   /[^a-zA-Z0-9.-]/g,
//                   "_"
//                 );
//                 const finalPath = `${SAVE_PATH}/${sanitizedFileName}`;
//                 try {
//                   // Move file (already in base64, RNFS handles it correctly)
//                   await RNFS.moveFile(tempPath, finalPath);
//                   setReceivedFiles((prev) => [...prev, finalPath]);
//                   Logger.info(
//                     `Received and saved file: ${finalPath} from ${transfer.deviceName}`
//                   );
//                   transfer.status = "Completed";
//                   transfer.endTime = Date.now();
//                   const ackCompleteBuffer = Buffer.from(
//                     `ACK_COMPLETE:${chunkData.fileId}\n`
//                   );
//                   socket.write(ackCompleteBuffer);
//                   updateTransferSpeed(
//                     transfer,
//                     ackCompleteBuffer.length,
//                     setTransferProgress
//                   );

//                   setTransferProgress?.((prev) => {
//                     const updated = prev.filter(
//                       (p) => p.fileId !== chunkData.fileId
//                     );
//                     return [
//                       ...updated,
//                       {
//                         fileId: chunkData.fileId,
//                         fileName: transfer.fileName,
//                         transferredBytes: transfer.receivedBytes,
//                         fileSize: transfer.totalSize,
//                         speed:
//                           transfer.receivedBytes /
//                           ((Date.now() - transfer.startTime) / 1000 || 1),
//                         status: "Completed",
//                       },
//                     ];
//                   });
//                 } catch (error) {
//                   Logger.error(`Failed to move file to ${finalPath}`, error);
//                   throw new DropShareError(
//                     ERROR_CODES.DATABASE_WRITE_ERROR,
//                     `Failed to save file: ${
//                       error instanceof Error ? error.message : "Unknown error"
//                     }`
//                   );
//                 } finally {
//                   if (await RNFS.exists(tempPath)) {
//                     await RNFS.unlink(tempPath).catch((err) =>
//                       Logger.error(
//                         `Failed to delete temp file ${tempPath}`,
//                         err
//                       )
//                     );
//                   }
//                   fileTransfers.delete(chunkData.fileId);
//                   receivingFile = false;
//                   fileId = "";
//                 }
//               }
//             }
//           } else if (dataStr.startsWith("FILE:") && fileId) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(
//                 `Incomplete retransmission FILE header from ${source}, waiting...`
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
//               const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
//               if (await RNFS.exists(tempPath)) {
//                 await RNFS.unlink(tempPath).catch((err) =>
//                   Logger.error(`Failed to delete temp file ${tempPath}`, err)
//                 );
//               }
//               await initializeFileTransfer(
//                 headerData,
//                 socket,
//                 setTransferProgress
//               );
//               const ackBuffer = Buffer.from(`ACK_FILE:${fileId}\n`);
//               socket.write(ackBuffer);
//               const transfer = fileTransfers.get(fileId);
//               if (transfer) {
//                 updateTransferSpeed(
//                   transfer,
//                   ackBuffer.length,
//                   setTransferProgress
//                 );
//               }
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
//               Logger.info(`Incomplete FILE header from ${source}, waiting...`);
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
//               setTransferProgress
//             );
//             const ackBuffer = Buffer.from(`ACK_FILE:${headerData.fileId}\n`);
//             socket.write(ackBuffer);
//             const transfer = fileTransfers.get(headerData.fileId);
//             if (transfer) {
//               updateTransferSpeed(
//                 transfer,
//                 ackBuffer.length,
//                 setTransferProgress
//               );
//             }
//             buffer = buffer.slice(headerEnd + 2);
//             receivingFile = true;
//           } else if (dataStr.startsWith("MSG:")) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(`Incomplete MSG from ${source}, waiting...`);
//               return;
//             }
//             const messageReceived = buffer.slice(4, messageEnd).toString();
//             try {
//               const messageObj = JSON.parse(messageReceived);
//               setMessages((prev) => [...prev, messageObj]);
//               if (role === "host" && connectedSockets) {
//                 connectedSockets
//                   .filter((s) => s !== socket)
//                   .forEach((s) => {
//                     s.write(Buffer.from(`MSG:${messageObj}\n`));
//                     Logger.info(
//                       `Forwarded MSG to ${s.remoteAddress ?? "unknown"}`
//                     );
//                   });
//               }
//               buffer = buffer.slice(messageEnd + 1);
//             } catch (err) {
//               Logger.error(`Error getting message: `, err);
//             }
//           } else if (
//             dataStr.startsWith("ACK_FILE:") ||
//             dataStr.startsWith("ACK_COMPLETE:") ||
//             dataStr.startsWith("ACK_CHUNK:")
//           ) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(
//                 `Incomplete ${dataStr.slice(0, 10)} from ${source}, waiting...`
//               );
//               return;
//             }
//             Logger.info(`Processed ${dataStr.slice(0, messageEnd)}`);
//             buffer = buffer.slice(messageEnd + 1);
//           } else {
//             Logger.warn(
//               `Invalid data from ${source}: ${dataStr.slice(0, 50)}...`
//             );
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
//       Logger.error(`Error processing data from ${source}`, error);
//       const err = DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         "Data processing failed"
//       );
//       socket.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
//       buffer = Buffer.alloc(0);
//       receivingFile = false;
//       fileTransfers.delete(fileId);
//       const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
//       if (await RNFS.exists(tempPath)) {
//         await RNFS.unlink(tempPath).catch((err) =>
//           Logger.error(`Failed to delete temp file ${tempPath}`, err)
//         );
//       }
//       fileId = "";
//       setTransferProgress?.((prev) => {
//         const updated = prev.filter((p) => p.fileId !== fileId);
//         return [
//           ...updated,
//           {
//             fileId,
//             fileName: fileTransfers.get(fileId)?.fileName || "unknown",
//             transferredBytes: 0,
//             fileSize: 0,
//             speed: 0,
//             status: "Failed",
//             error: err.message,
//           },
//         ];
//       });
//     }
//   }

//   async function initializeFileTransfer(
//     headerData: FileHeader,
//     socket: TCPSocket.Socket,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     if (headerData.protocolVersion !== PROTOCOL_VERSION) {
//       Logger.error(
//         `Protocol version mismatch for ${headerData.fileId}: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
//       );
//       socket.write(
//         Buffer.from(
//           `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
//         )
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

//     const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
//     if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
//       await RNFS.mkdir(TEMP_CHUNKS_PATH);
//     }
//     await RNFS.writeFile(tempPath, "", "base64");

//     const transfer: FileTransfer = {
//       fileId,
//       fileName,
//       fileSize,
//       deviceName,
//       senderIp: socket.remoteAddress || "unknown",
//       chunks: new Array(totalChunks).fill(undefined),
//       receivedBytes: 0,
//       startTime: Date.now(),
//       totalChunks,
//       chunkSize,
//       totalSize: fileSize,
//       chunkHashes: [],
//       aesKey: undefined,
//       iv: undefined,
//       status: "Receiving",
//       progress: 0,
//       lastChunkIndex: -1,
//       speedWindow: [],
//     };
//     fileTransfers.set(fileId, transfer);

//     setTransferProgress?.((prev) => {
//       const updated = prev.filter((p) => p.fileId !== fileId);
//       return [
//         ...updated,
//         {
//           fileId,
//           fileName,
//           transferredBytes: 0,
//           fileSize,
//           speed: 0,
//           status: "Receiving",
//         },
//       ];
//     });
//   }

//   return {
//     sendFiles,
//     sendMessage,
//     receiveFile,
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
import { SAVE_PATH, TEMP_CHUNKS_PATH } from "../utils/FileSystemUtil";

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

interface ReceiveProps {
  socket: TCPSocket.Socket;
  data: string | Buffer;
  ip?: string; // Only for client role
  setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
  setMessages: React.Dispatch<React.SetStateAction<message[]>>;
  connectedSockets?: TCPSocket.Socket[]; // Only for host role
  setTransferProgress?: React.Dispatch<
    React.SetStateAction<TransferProgress[]>
  >;
}

const fileTransfers = new Map<string, FileTransfer>();
let buffer = Buffer.alloc(0);
let receivingFile = false;
let fileId = "";
let lastLoggedChunkIndex: number | null = null;

const MAX_RETRIES = 3;
const ACK_TIMEOUT = 15000;
const PROTOCOL_VERSION = "1.0";
const SPEED_WINDOW_DURATION = 1000; // 1 second window for speed calculation

export const Sharing = (role: "host" | "client") => {
  // Helper function to update transfer speed
  function updateTransferSpeed(
    transfer: FileTransfer,
    bytes: number,
    setTransferProgress?: React.Dispatch<
      React.SetStateAction<TransferProgress[]>
    >
  ) {
    const currentTime = Date.now();
    // Add new bytes to speed window
    transfer.speedWindow = transfer.speedWindow || [];
    transfer.speedWindow.push({ bytes, timestamp: currentTime });

    // Filter out entries older than SPEED_WINDOW_DURATION
    transfer.speedWindow = transfer.speedWindow.filter(
      (entry) => currentTime - entry.timestamp <= SPEED_WINDOW_DURATION
    );

    // Calculate speed (bytes per second)
    const totalBytesInWindow = transfer.speedWindow.reduce(
      (sum, entry) => sum + entry.bytes,
      0
    );
    const speed = totalBytesInWindow; // Bytes per second (over 1-second window)

    setTransferProgress?.((prev) => {
      const updated = prev.filter((p) => p.fileId !== transfer.fileId);
      return [
        ...updated,
        {
          fileId: transfer.fileId,
          fileName: transfer.fileName,
          transferredBytes: transfer.receivedBytes,
          fileSize: transfer.totalSize,
          speed,
          status: transfer.status,
          error: transfer.error,
        },
      ];
    });
  }

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
      speedWindow: [],
    };
    fileTransfers.set(fileId, transfer);

    try {
      const stat = await RNFS.stat(filePath);
      const fileSize = stat.size;
      const { chunkSize, numChunks: totalChunks } =
        calculateDynamicChunkDivision(fileSize);

      // Update FileTransfer with actual values
      transfer = {
        ...transfer,
        fileSize,
        totalChunks,
        chunkSize,
        totalSize: fileSize,
        chunks: new Array(totalChunks).fill(undefined),
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
              const resetBuffer = Buffer.from(`RESET:${fileId}\n`);
              socket.write(resetBuffer);
              updateTransferSpeed(
                transfer,
                resetBuffer.length,
                setTransferProgress
              );
              Logger.info(`Sent RESET for ${fileId}`);
            });
          }

          // Send file header
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
              if (message.startsWith(`ACK_FILE:${fileId}`)) {
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
            const headerBuffer = Buffer.from(
              `FILE:${JSON.stringify(header)}\n\n`
            );
            socket.write(headerBuffer);
            updateTransferSpeed(
              transfer,
              headerBuffer.length,
              setTransferProgress
            );
            Logger.info(`Sent header for ${fileId}: ${JSON.stringify(header)}`);
          });

          let sentBytes = 0;
          for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const actualChunkSize = Math.min(chunkSize, fileSize - start);
            // Read chunk as base64
            const base64Chunk = await RNFS.read(
              filePath,
              actualChunkSize,
              start,
              "base64"
            );
            // Convert base64 to binary for transmission
            const chunk = Buffer.from(base64Chunk, "base64");

            // Send chunk
            const chunkHeader = Buffer.from(
              `CHUNK:${JSON.stringify({
                fileId,
                chunkIndex: i,
                chunkSize: actualChunkSize,
              })}\n\n`
            );
            const chunkBuffer = Buffer.concat([chunkHeader, chunk]);
            socket.write(chunkBuffer);
            updateTransferSpeed(
              transfer,
              chunkBuffer.length,
              setTransferProgress
            );
            Logger.info(
              `Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
            );

            // Update progress
            sentBytes += actualChunkSize;
            const percentage = (sentBytes / fileSize) * 100;

            transfer.receivedBytes = sentBytes;
            transfer.progress = percentage;
            transfer.lastChunkIndex = i;
            fileTransfers.set(fileId, transfer);

            // Wait for ACK with robust handling for interleaved messages and out-of-order ACKs
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(
                  new DropShareError(
                    ERROR_CODES.NETWORK_ERROR,
                    `Timeout waiting for ACK_CHUNK:${i} (attempt ${
                      retries + 1
                    })`
                  )
                );
              }, ACK_TIMEOUT);

              let receivedAcks: number[] = []; // Track received ACK indices
              const checkAck = () => {
                socket.once("data", (data) => {
                  const message = data.toString();
                  Logger.info(`Received for ACK_CHUNK:${i}: ${message}`);
                  if (message.startsWith(`ACK_CHUNK:${fileId}:${i}`)) {
                    clearTimeout(timeout);
                    updateTransferSpeed(
                      transfer,
                      Buffer.from(message).length,
                      setTransferProgress
                    );
                    resolve();
                  } else if (message.startsWith(`ACK_CHUNK:${fileId}:`)) {
                    const receivedIndex = parseInt(
                      message.split(":")[2].split("\n")[0],
                      10
                    );
                    if (!receivedAcks.includes(receivedIndex)) {
                      receivedAcks.push(receivedIndex);
                      Logger.info(
                        `Queued out-of-order ACK_CHUNK for ${fileId}: index ${receivedIndex}, still waiting for ${i}`
                      );
                    }
                    if (receivedIndex > i) {
                      clearTimeout(timeout);
                      reject(
                        new DropShareError(
                          ERROR_CODES.INVALID_HEADER,
                          `Unexpected future ACK_CHUNK: ${message}`
                        )
                      );
                    } else {
                      checkAck(); // Continue waiting for the correct ACK
                    }
                  } else if (message.startsWith("MSG:")) {
                    Logger.info(
                      `Received MSG during ACK_CHUNK:${i} wait, continuing to wait for ACK`
                    );
                    checkAck(); // Ignore message and continue waiting
                  } else if (message.startsWith("ERROR:")) {
                    clearTimeout(timeout);
                    reject(
                      new DropShareError(
                        ERROR_CODES.NETWORK_ERROR,
                        `Receiver error: ${message}`
                      )
                    );
                  } else {
                    Logger.warn(
                      `Unexpected data during ACK_CHUNK:${i} wait: ${message.slice(
                        0,
                        50
                      )}...`
                    );
                    checkAck(); // Ignore unexpected data and continue waiting
                  }
                });
              };
              checkAck();
            });
          }

          // Wait for final ACK
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
                updateTransferSpeed(
                  transfer,
                  Buffer.from(message).length,
                  setTransferProgress
                );
                const elapsedTime =
                  (Date.now() - transfer.startTime) / 1000 || 1;
                const finalSpeed = fileSize / elapsedTime;
                setTransferProgress?.((prev) => {
                  const updated = prev.filter((p) => p.fileId !== fileId);
                  return [
                    ...updated,
                    {
                      fileId,
                      fileName,
                      transferredBytes: fileSize,
                      fileSize,
                      speed: finalSpeed,
                      status: "Completed",
                    },
                  ];
                });
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
      setTransferProgress?.((prev) => {
        const updated = prev.filter((p) => p.fileId !== fileId);
        return [
          ...updated,
          {
            fileId,
            fileName,
            transferredBytes: transfer.receivedBytes,
            fileSize: transfer.totalSize,
            speed: 0,
            status: "Failed",
            error: err.message,
          },
        ];
      });
      Logger.error(`Error in file transfer for ${fileName}`, error);
      throw err;
    } finally {
      if (transfer.status === "Completed" || transfer.status === "Failed") {
        fileTransfers.delete(fileId);
      }
    }
  }

  async function sendFiles(
    socket: TCPSocket.Socket | TCPSocket.Socket[] | null,
    files: { filePath: string }[],
    username: string,
    connectedSockets: TCPSocket.Socket[],
    setTransferProgress?: React.Dispatch<
      React.SetStateAction<TransferProgress[]>
    >
  ): Promise<void> {
    if (!socket) {
      Logger.toast("No active socket to send files", "error");
      throw new DropShareError(ERROR_CODES.NETWORK_ERROR, "No active socket");
    }

    if (role === "host" && (!Array.isArray(socket) || socket.length === 0)) {
      Logger.toast("No connected clients to send files", "error");
      throw new DropShareError(
        ERROR_CODES.NETWORK_ERROR,
        "No connected clients"
      );
    }

    for (const { filePath } of files) {
      const fileName = filePath.split("/").pop() ?? "unknown";
      const fileId = `${username}_${fileName}_${Date.now()}`;

      if (role === "host" && Array.isArray(socket)) {
        try {
          await Promise.all(
            socket.map((s) =>
              sendFile(
                s,
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
      } else if (role === "client" && !Array.isArray(socket)) {
        await sendFile(
          socket,
          fileName,
          filePath,
          username,
          fileId,
          setTransferProgress
        );
        Logger.info(`Sent file: ${fileName} from ${username} to host`);
        Logger.toast(`Sent file ${fileName}`, "info");
      }
    }
  }

  function sendMessage(
    socket: TCPSocket.Socket | TCPSocket.Socket[] | null,
    messages: string,
    username: string,
    connectedSockets: TCPSocket.Socket[],
    senderIP: string
  ): void {
    if (!socket) {
      Logger.toast("No active socket to send message", "error");
      return;
    }

    const message: message = {
      ip: senderIP,
      message: messages,
      name: username,
    };

    const messageBuffer = Buffer.from(`MSG:${JSON.stringify(message)}\n`);

    if (role === "host" && Array.isArray(socket)) {
      if (socket.length === 0) {
        Logger.toast("No connected clients to send message", "error");
        return;
      }
      socket.forEach((s) => {
        s.write(messageBuffer);
        Logger.info(`Sent MSG to ${s.remoteAddress ?? "unknown"}: ${message}`);
      });
    } else if (role === "client" && !Array.isArray(socket)) {
      socket.write(Buffer.from(messageBuffer));
      Logger.info(`Sent MSG to host: ${message}`);
    }
  }

  async function receiveFile({
    socket,
    data,
    ip,
    setMessages,
    setReceivedFiles,
    connectedSockets,
    setTransferProgress,
  }: ReceiveProps): Promise<void> {
    const source =
      role === "host" ? socket.remoteAddress ?? "unknown" : ip ?? "host";
    try {
      const dataBytes =
        typeof data === "string" ? Buffer.from(data).length : data.length;
      buffer = Buffer.concat([
        buffer,
        typeof data === "string" ? Buffer.from(data) : data,
      ]);

      // Update speed for incoming bytes during file transfer
      if (receivingFile) {
        const transfer = fileTransfers.get(fileId);
        if (transfer) {
          updateTransferSpeed(transfer, dataBytes, setTransferProgress);
        }
      }

      while (buffer.length > 0) {
        const dataStr = buffer.toString();
        const nextNewline = buffer.indexOf(Buffer.from("\n"));
        const nextDoubleNewline = buffer.indexOf(Buffer.from("\n\n"));

        // File transfer processing first to prioritize ACKs
        if (receivingFile) {
          if (dataStr.startsWith("CHUNK:")) {
            if (nextDoubleNewline === -1) {
              Logger.info(`Incomplete CHUNK header from ${source}, waiting...`);
              return;
            }
            const headerStr = buffer.slice(6, nextDoubleNewline).toString();
            let chunkData: {
              fileId: string;
              chunkIndex: number;
              chunkSize: number;
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
            const chunkStart = nextDoubleNewline + 2;
            const chunkEnd = chunkStart + chunkSize;

            if (buffer.length < chunkEnd) {
              if (lastLoggedChunkIndex !== chunkData.chunkIndex) {
                Logger.info(
                  `Waiting for chunk data for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}, expected ${chunkSize} bytes)`
                );
                lastLoggedChunkIndex = chunkData.chunkIndex;
              }
              return;
            }

            const chunk = buffer.slice(chunkStart, chunkEnd);

            if (chunk.length !== chunkSize) {
              Logger.error(
                `Chunk size mismatch for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}): expected ${chunkSize}, received ${chunk.length}`
              );
              throw new DropShareError(
                ERROR_CODES.CORRUPTED_CHUNK,
                `Chunk size mismatch: expected ${chunkSize}, received ${chunk.length}`
              );
            }

            Logger.info(
              `Processed chunk ${chunkData.chunkIndex} for ${chunkData.fileId}`
            );
            lastLoggedChunkIndex = null;

            const tempPath = `${TEMP_CHUNKS_PATH}/${chunkData.fileId}`;
            if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
              await RNFS.mkdir(TEMP_CHUNKS_PATH);
            }

            // Convert binary chunk to base64 for RNFS
            const base64Chunk = chunk.toString("base64");
            await RNFS.appendFile(tempPath, base64Chunk, "base64");

            const transfer = fileTransfers.get(chunkData.fileId);
            if (transfer) {
              transfer.chunks[chunkData.chunkIndex] = chunk;
              transfer.receivedBytes += chunkSize;
              transfer.progress =
                (transfer.receivedBytes / transfer.totalSize) * 100;
              transfer.lastChunkIndex = chunkData.chunkIndex;
              fileTransfers.set(chunkData.fileId, transfer);

              // Send ACK immediately to prioritize file transfer
              const ackBuffer = Buffer.from(
                `ACK_CHUNK:${chunkData.fileId}:${chunkData.chunkIndex}\n`
              );
              socket.write(ackBuffer);
              updateTransferSpeed(
                transfer,
                ackBuffer.length,
                setTransferProgress
              );
              buffer = buffer.slice(chunkEnd);

              if (transfer.receivedBytes === transfer.totalSize) {
                if (!(await RNFS.exists(SAVE_PATH))) {
                  await RNFS.mkdir(SAVE_PATH);
                  Logger.info(`Created directory ${SAVE_PATH}`);
                }

                const sanitizedFileName = transfer.fileName.replace(
                  /[^a-zA-Z0-9.-]/g,
                  "_"
                );
                const finalPath = `${SAVE_PATH}/${sanitizedFileName}`;
                try {
                  // Move file (already in base64, RNFS handles it correctly)
                  await RNFS.moveFile(tempPath, finalPath);
                  setReceivedFiles((prev) => [...prev, finalPath]);
                  Logger.info(
                    `Received and saved file: ${finalPath} from ${transfer.deviceName}`
                  );
                  transfer.status = "Completed";
                  transfer.endTime = Date.now();
                  const ackCompleteBuffer = Buffer.from(
                    `ACK_COMPLETE:${chunkData.fileId}\n`
                  );
                  socket.write(ackCompleteBuffer);
                  updateTransferSpeed(
                    transfer,
                    ackCompleteBuffer.length,
                    setTransferProgress
                  );

                  setTransferProgress?.((prev) => {
                    const updated = prev.filter(
                      (p) => p.fileId !== chunkData.fileId
                    );
                    return [
                      ...updated,
                      {
                        fileId: chunkData.fileId,
                        fileName: transfer.fileName,
                        transferredBytes: transfer.receivedBytes,
                        fileSize: transfer.totalSize,
                        speed:
                          transfer.receivedBytes /
                          ((Date.now() - transfer.startTime) / 1000 || 1),
                        status: "Completed",
                      },
                    ];
                  });
                } catch (error) {
                  Logger.error(`Failed to move file to ${finalPath}`, error);
                  throw new DropShareError(
                    ERROR_CODES.DATABASE_WRITE_ERROR,
                    `Failed to save file: ${
                      error instanceof Error ? error.message : "Unknown error"
                    }`
                  );
                } finally {
                  if (await RNFS.exists(tempPath)) {
                    await RNFS.unlink(tempPath).catch((err) =>
                      Logger.error(
                        `Failed to delete temp file ${tempPath}`,
                        err
                      )
                    );
                  }
                  fileTransfers.delete(chunkData.fileId);
                  receivingFile = false;
                  fileId = "";
                }
              }
            }
            continue;
          } else if (dataStr.startsWith("RESET:")) {
            if (nextNewline === -1) {
              Logger.info(`Incomplete RESET from ${source}, waiting...`);
              return;
            }
            const resetFileId = dataStr.slice(6, nextNewline);
            Logger.info(`Received RESET for fileId ${resetFileId}`);
            if (resetFileId === fileId || !fileId) {
              receivingFile = false;
              fileTransfers.delete(resetFileId);
              const tempPath = `${TEMP_CHUNKS_PATH}/${resetFileId}`;
              if (await RNFS.exists(tempPath)) {
                await RNFS.unlink(tempPath).catch((err) =>
                  Logger.error(`Failed to delete temp file ${tempPath}`, err)
                );
              }
              fileId = "";
            }
            const ackBuffer = Buffer.from(`ACK_RESET:${resetFileId}\n`);
            socket.write(ackBuffer);
            const transfer = fileTransfers.get(resetFileId);
            if (transfer) {
              updateTransferSpeed(
                transfer,
                ackBuffer.length,
                setTransferProgress
              );
            }
            buffer = buffer.slice(nextNewline + 1);
            continue;
          } else if (dataStr.startsWith("FILE:") && fileId) {
            if (nextDoubleNewline === -1) {
              Logger.info(
                `Incomplete retransmission FILE header from ${source}, waiting...`
              );
              return;
            }
            const headerStr = buffer.slice(5, nextDoubleNewline).toString();
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
              const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
              if (await RNFS.exists(tempPath)) {
                await RNFS.unlink(tempPath).catch((err) =>
                  Logger.error(`Failed to delete temp file ${tempPath}`, err)
                );
              }
              await initializeFileTransfer(
                headerData,
                socket,
                setTransferProgress
              );
              const ackBuffer = Buffer.from(`ACK_FILE:${fileId}\n`);
              socket.write(ackBuffer);
              const transfer = fileTransfers.get(fileId);
              if (transfer) {
                updateTransferSpeed(
                  transfer,
                  ackBuffer.length,
                  setTransferProgress
                );
              }
              buffer = buffer.slice(nextDoubleNewline + 2);
              receivingFile = true;
            } else {
              Logger.warn(
                `Unexpected FILE header for different fileId ${headerData.fileId} while processing ${fileId}`
              );
              buffer = Buffer.alloc(0);
              return;
            }
            continue;
          }
        }

        // Message processing after file transfer to avoid delaying ACKs
        if (dataStr.startsWith("MSG:")) {
          if (nextNewline === -1) {
            Logger.info(`Incomplete MSG from ${source}, waiting...`);
            return;
          }
          const messageReceived = buffer.slice(4, nextNewline).toString();
          try {
            const messageObj = JSON.parse(messageReceived);
            setMessages((prev) => [...prev, messageObj]);
            if (role === "host" && connectedSockets) {
              connectedSockets
                .filter((s) => s !== socket)
                .forEach((s) => {
                  s.write(Buffer.from(`MSG:${JSON.stringify(messageObj)}\n`));
                  Logger.info(
                    `Forwarded MSG to ${s.remoteAddress ?? "unknown"}`
                  );
                });
            }
            Logger.info(`Processed MSG from ${source}: ${messageReceived}`);
            buffer = buffer.slice(nextNewline + 1);
            continue;
          } catch (err) {
            Logger.error(`Error parsing message from ${source}`, err);
            buffer = buffer.slice(nextNewline + 1);
            continue;
          }
        }

        // Non-file transfer file processing
        if (!receivingFile) {
          if (dataStr.startsWith("FILE:")) {
            if (nextDoubleNewline === -1) {
              Logger.info(`Incomplete FILE header from ${source}, waiting...`);
              return;
            }
            const headerStr = buffer.slice(5, nextDoubleNewline).toString();
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
            const ackBuffer = Buffer.from(`ACK_FILE:${headerData.fileId}\n`);
            socket.write(ackBuffer);
            const transfer = fileTransfers.get(headerData.fileId);
            if (transfer) {
              updateTransferSpeed(
                transfer,
                ackBuffer.length,
                setTransferProgress
              );
            }
            buffer = buffer.slice(nextDoubleNewline + 2);
            receivingFile = true;
            continue;
          }
        }

        // Handle ACKs and other protocol messages
        if (
          dataStr.startsWith("ACK_FILE:") ||
          dataStr.startsWith("ACK_COMPLETE:") ||
          dataStr.startsWith("ACK_CHUNK:")
        ) {
          if (nextNewline === -1) {
            Logger.info(
              `Incomplete ${dataStr.slice(0, 10)} from ${source}, waiting...`
            );
            return;
          }
          Logger.info(`Processed ${dataStr.slice(0, nextNewline)}`);
          buffer = buffer.slice(nextNewline + 1);
          continue;
        }

        // Skip invalid data
        Logger.warn(
          `Skipping unexpected data from ${source}: ${dataStr.slice(0, 50)}...`
        );
        const nextMarker = Math.min(
          nextNewline !== -1 ? nextNewline : buffer.length,
          nextDoubleNewline !== -1 ? nextDoubleNewline : buffer.length
        );
        if (nextMarker < buffer.length) {
          buffer = buffer.slice(nextMarker + 1);
        } else {
          buffer = Buffer.alloc(0);
        }
      }
    } catch (error) {
      Logger.error(`Error processing data from ${source}`, error);
      const err = DropShareError.from(
        error,
        ERROR_CODES.NETWORK_ERROR,
        "Data processing failed"
      );
      socket.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
      buffer = Buffer.alloc(0);
      receivingFile = false;
      fileTransfers.delete(fileId);
      const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
      if (await RNFS.exists(tempPath)) {
        await RNFS.unlink(tempPath).catch((err) =>
          Logger.error(`Failed to delete temp file ${tempPath}`, err)
        );
      }
      fileId = "";
      setTransferProgress?.((prev) => {
        const updated = prev.filter((p) => p.fileId !== fileId);
        return [
          ...updated,
          {
            fileId,
            fileName: fileTransfers.get(fileId)?.fileName || "unknown",
            transferredBytes: 0,
            fileSize: 0,
            speed: 0,
            status: "Failed",
            error: err.message,
          },
        ];
      });
    }
  }

  async function initializeFileTransfer(
    headerData: FileHeader,
    socket: TCPSocket.Socket,
    setTransferProgress?: React.Dispatch<
      React.SetStateAction<TransferProgress[]>
    >
  ): Promise<void> {
    if (headerData.protocolVersion !== PROTOCOL_VERSION) {
      Logger.error(
        `Protocol version mismatch for ${headerData.fileId}: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
      );
      socket.write(
        Buffer.from(
          `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
        )
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

    const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
    if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
      await RNFS.mkdir(TEMP_CHUNKS_PATH);
    }
    await RNFS.writeFile(tempPath, "", "base64");

    const transfer: FileTransfer = {
      fileId,
      fileName,
      fileSize,
      deviceName,
      senderIp: socket.remoteAddress || "unknown",
      chunks: new Array(totalChunks).fill(undefined),
      receivedBytes: 0,
      startTime: Date.now(),
      totalChunks,
      chunkSize,
      totalSize: fileSize,
      chunkHashes: [],
      aesKey: undefined,
      iv: undefined,
      status: "Receiving",
      progress: 0,
      lastChunkIndex: -1,
      speedWindow: [],
    };
    fileTransfers.set(fileId, transfer);

    setTransferProgress?.((prev) => {
      const updated = prev.filter((p) => p.fileId !== fileId);
      return [
        ...updated,
        {
          fileId,
          fileName,
          transferredBytes: 0,
          fileSize,
          speed: 0,
          status: "Receiving",
        },
      ];
    });
  }

  return {
    sendFiles,
    sendMessage,
    receiveFile,
  };
};
