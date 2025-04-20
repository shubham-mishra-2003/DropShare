// import {
//   calculateDynamicChunkDivision,
//   checkTransferLimits,
// } from "../utils/NetworkUtils";
// import RNFS from "react-native-fs";
// import { Buffer } from "buffer";
// import { Logger } from "../utils/Logger";
// import { DropShareError, ERROR_CODES } from "../utils/Error";
// import TCPSocket from "react-native-tcp-socket";
// import { SAVE_PATH } from "../utils/FileSystemUtil";

// const fileTransfers = new Map<string, FileTransfer>();
// let buffer = Buffer.alloc(0);
// let receivingFile = false;
// let fileChunks: { [fileId: string]: Buffer[] } = {};
// let chunkCounts: { [fileId: string]: number } = {};
// let fileId = "";
// let fileName = "";
// let fileSize = 0;
// let deviceName = "";
// let startTime = 0;
// let totalChunks = 0;
// let expectedChunkSize = 0;
// let lastLoggedChunkIndex: number | null = null;

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
//   setTransferProgress?: React.Dispatch<
//     React.SetStateAction<TransferProgress[]>
//   >;
// }

// interface ClientReceiveProps {
//   ip: string;
//   client: TCPSocket.Socket;
//   data: string | Buffer;
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
//   setMessages: React.Dispatch<React.SetStateAction<string[]>>;
//   setTransferProgress?: React.Dispatch<
//     React.SetStateAction<TransferProgress[]>
//   >;
// }

// interface ConnectedSocket extends TCPSocket.Socket {}

// const MAX_RETRIES = 3;
// const ACK_TIMEOUT = 10000;
// const PROTOCOL_VERSION = "1.0";
// let connectedSockets: ConnectedSocket[] = [];

// export const HostSharing = () => {
//   async function sendFile(
//     socket: ConnectedSocket,
//     fileName: string,
//     filePath: string,
//     deviceName: string,
//     fileId: string,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     try {
//       const fileData = await RNFS.readFile(filePath, "base64");
//       const fileBuffer = Buffer.from(fileData, "base64");
//       const fileSize = fileBuffer.length;
//       const { chunkSize, numChunks: totalChunks } =
//         calculateDynamicChunkDivision(fileSize);

//       let retries = 0;
//       while (retries < MAX_RETRIES) {
//         try {
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
//             const header = Buffer.from(
//               `FILE:${JSON.stringify({
//                 name: fileName,
//                 size: fileSize,
//                 sender: deviceName,
//                 fileId,
//                 totalChunks,
//                 chunkSize,
//               })}\n\n`
//             );
//             socket.write(header);
//             Logger.info(`Sent header for ${fileId}: ${header.toString()}`);
//           });

//           const startTime = Date.now();
//           let sentBytes = 0;

//           // Send chunks
//           for (let i = 0; i < totalChunks; i++) {
//             const start = i * chunkSize;
//             const chunk = fileBuffer.slice(start, start + chunkSize);
//             const actualChunkSize = chunk.length;

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
//                   resolve();
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
//                   chunkIndex: i,
//                   chunkSize: actualChunkSize,
//                 })}\n\n`
//               );
//               socket.write(Buffer.concat([chunkHeader, chunk]));
//               Logger.info(
//                 `Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
//               );
//             });

//             sentBytes += actualChunkSize;
//             const percentage = (sentBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//             const speed = (sentBytes / elapsedTime / 1024).toFixed(2);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== fileId),
//               {
//                 fileId,
//                 fileName,
//                 progress: `${sentBytes}/${fileSize} bytes`,
//                 speed: `${speed} KB/s`,
//                 percentage,
//               },
//             ]);
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
//                 const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//                 const speed = (fileSize / elapsedTime / 1024).toFixed(2);
//                 setTransferProgress?.((prev) => [
//                   ...prev.filter((p) => p.fileId !== fileId),
//                   {
//                     fileId,
//                     fileName,
//                     progress: `${fileSize}/${fileSize} bytes`,
//                     speed: `${speed} KB/s`,
//                     percentage: 100,
//                   },
//                 ]);
//                 resolve();
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
//           Logger.warn(`Retrying file send for ${fileId} after error ${error}`);
//           await new Promise((resolve) => setTimeout(resolve, 1000));
//         }
//       }
//     } catch (error) {
//       Logger.error(`Error in file transfer for ${fileName}`, error);
//       throw DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         `Transfer failed: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`
//       );
//     }
//   }

//   async function sendHostFile(
//     server: TCPSocket.Server | null,
//     filePath: string,
//     fileData: Buffer,
//     username: string,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     if (!server || connectedSockets.length === 0) {
//       Logger.toast("No connected clients to send file", "error");
//       return;
//     }

//     const fileName = filePath.split("/").pop() || "unknown";
//     const fileId = `${Date.now()}-${fileName}`;
//     const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//     await RNFS.writeFile(tempPath, fileData.toString("base64"), "base64");

//     try {
//       await Promise.all(
//         connectedSockets.map((socket) =>
//           sendFile(
//             socket,
//             fileName,
//             tempPath,
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
//     } finally {
//       await RNFS.unlink(tempPath).catch((err) =>
//         Logger.error(`Failed to delete temp file ${tempPath}`, err)
//       );
//     }
//   }

//   async function sendFilesInHost(
//     server: TCPSocket.Server | null,
//     files: { filePath: string; fileData: Buffer }[],
//     username: string,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     if (!server || connectedSockets.length === 0) {
//       Logger.toast("No connected clients to send files", "error");
//       return;
//     }

//     for (const { filePath, fileData } of files) {
//       await sendHostFile(
//         server,
//         filePath,
//         fileData,
//         username,
//         setTransferProgress
//       );
//       Logger.info(`Sent file: ${filePath.split("/").pop()} from ${username}`);
//     }
//   }

//   function sendMessageInHost(message: string, username: string): void {
//     if (connectedSockets.length === 0) {
//       Logger.toast("No connected clients to send message", "error");
//       return;
//     }

//     connectedSockets.forEach((socket) => {
//       socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
//       Logger.info(`Sent MSG to ${socket.remoteAddress}: ${message}`);
//     });
//   }

//   async function receiveFileInHost({
//     data,
//     setMessages,
//     setReceivedFiles,
//     socket,
//     setTransferProgress,
//   }: HostReceiveProps) {
//     Logger.info(
//       `Received data of length ${data.length} bytes from ${socket.remoteAddress}`
//     );
//     try {
//       if (receivingFile) {
//         buffer = Buffer.concat([
//           buffer,
//           typeof data === "string" ? Buffer.from(data) : data,
//         ]);

//         while (buffer.length > 0) {
//           const dataStr = buffer.toString();
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
//             const expectedChunkEnd = headerEnd + 2 + chunkSize;

//             if (buffer.length < expectedChunkEnd) {
//               if (lastLoggedChunkIndex !== chunkData.chunkIndex) {
//                 Logger.info(
//                   `Incomplete chunk data for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}), waiting...`
//                 );
//                 lastLoggedChunkIndex = chunkData.chunkIndex;
//               }
//               return;
//             }

//             const chunk = buffer.slice(headerEnd + 2, expectedChunkEnd);
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
//             lastLoggedChunkIndex = null; // Reset after processing
//             if (!fileChunks[fileId]) {
//               fileChunks[fileId] = [];
//               chunkCounts[fileId] = 0;
//             }
//             fileChunks[fileId][chunkData.chunkIndex] = chunk;
//             chunkCounts[fileId]++;

//             const receivedBytes = Object.values(fileChunks[fileId]).reduce(
//               (sum, chunk) => sum + (chunk?.length || 0),
//               0
//             );
//             const percentage = (receivedBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//             const speed = (receivedBytes / elapsedTime / 1024).toFixed(2);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== fileId),
//               {
//                 fileId,
//                 fileName,
//                 progress: `${receivedBytes}/${fileSize} bytes`,
//                 speed: `${speed} KB/s`,
//                 percentage,
//               },
//             ]);

//             socket.write(
//               Buffer.from(`ACK_CHUNK:${fileId}:${chunkData.chunkIndex}\n`)
//             );
//             buffer = buffer.slice(expectedChunkEnd);

//             if (chunkCounts[fileId] === totalChunks) {
//               const fileBuffer = Buffer.concat(
//                 fileChunks[fileId].filter(Boolean)
//               );
//               if (fileBuffer.length !== fileSize) {
//                 Logger.error(
//                   `File size mismatch for ${fileId}: expected ${fileSize}, received ${fileBuffer.length}`
//                 );
//                 throw new DropShareError(
//                   ERROR_CODES.CORRUPTED_CHUNK,
//                   `File size mismatch: expected ${fileSize}, received ${fileBuffer.length}`
//                 );
//               }
//               await RNFS.writeFile(
//                 `${SAVE_PATH}/${fileName}`,
//                 fileBuffer.toString("base64"),
//                 "base64"
//               );
//               setReceivedFiles((prev) => [...prev, `${SAVE_PATH}/${fileName}`]);
//               Logger.info(
//                 `Received and saved file: ${SAVE_PATH}/${fileName} from ${deviceName}`
//               );
//               fileTransfers.delete(fileId);
//               socket.write(Buffer.from(`ACK_COMPLETE:${fileId}\n`));
//               receivingFile = false;
//               delete fileChunks[fileId];
//               delete chunkCounts[fileId];
//               fileId = "";
//               fileName = "";
//               fileSize = 0;
//               deviceName = "";
//               totalChunks = 0;
//               expectedChunkSize = 0;
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
//         }
//         return;
//       }

//       buffer = Buffer.concat([
//         buffer,
//         typeof data === "string" ? Buffer.from(data) : data,
//       ]);

//       while (buffer.length > 0) {
//         const dataStr = buffer.toString();
//         if (dataStr.startsWith("FILE:")) {
//           const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//           if (headerEnd === -1) {
//             Logger.info(
//               `Incomplete FILE header from ${socket.remoteAddress}, waiting...`
//             );
//             return;
//           }
//           const headerStr = buffer.slice(5, headerEnd).toString();
//           let headerData: {
//             name: string;
//             size: number;
//             sender: string;
//             fileId: string;
//             totalChunks: number;
//             chunkSize: number;
//           };
//           try {
//             headerData = JSON.parse(headerStr);
//           } catch (error) {
//             Logger.error(`Failed to parse FILE header: ${headerStr}`, error);
//             throw new DropShareError(
//               ERROR_CODES.INVALID_HEADER,
//               "Invalid file header"
//             );
//           }

//           fileName = headerData.name;
//           fileSize = headerData.size;
//           deviceName = headerData.sender || "Unknown";
//           fileId = headerData.fileId;
//           totalChunks = headerData.totalChunks;
//           expectedChunkSize = headerData.chunkSize;

//           if (
//             !fileName ||
//             !fileSize ||
//             !fileId ||
//             !totalChunks ||
//             !expectedChunkSize
//           ) {
//             throw new DropShareError(
//               ERROR_CODES.INVALID_HEADER,
//               "Missing file name, size, ID, total chunks, or chunk size"
//             );
//           }

//           const { chunkSize: calculatedChunkSize } =
//             calculateDynamicChunkDivision(fileSize);
//           if (expectedChunkSize !== calculatedChunkSize) {
//             Logger.error(
//               `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//             );
//             throw new DropShareError(
//               ERROR_CODES.INVALID_HEADER,
//               `Chunk size mismatch: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//             );
//           }

//           if (!checkTransferLimits(fileSize, fileTransfers)) {
//             socket.write(
//               Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
//             );
//             Logger.toast(`Transfer limit exceeded for ${fileName}`, "error");
//             buffer = Buffer.alloc(0);
//             return;
//           }

//           socket.write(Buffer.from(`ACK_FILE:${fileId}\n`));
//           buffer = buffer.slice(headerEnd + 2);
//           receivingFile = true;
//           startTime = Date.now();
//         } else if (dataStr.startsWith("MSG:")) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) {
//             Logger.info(
//               `Incomplete MSG from ${socket.remoteAddress}, waiting...`
//             );
//             return;
//           }
//           const message = buffer.slice(4, messageEnd).toString();
//           setMessages((prev) => [
//             ...prev,
//             `${socket.remoteAddress}: ${message}`,
//           ]);
//           connectedSockets
//             .filter((s) => s !== socket)
//             .forEach((s) => {
//               s.write(Buffer.from(`MSG:${message}\n`));
//               Logger.info(`Forwarded MSG to ${s.remoteAddress}`);
//             });
//           buffer = buffer.slice(messageEnd + 1);
//         } else if (
//           dataStr.startsWith("ACK_FILE:") ||
//           dataStr.startsWith("ACK_COMPLETE:") ||
//           dataStr.startsWith("ACK_CHUNK:")
//         ) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) {
//             Logger.info(
//               `Incomplete ${dataStr.slice(0, 10)} from ${
//                 socket.remoteAddress
//               }, waiting...`
//             );
//             return;
//           }
//           Logger.info(`Processed ${dataStr.slice(0, messageEnd)}`);
//           buffer = buffer.slice(messageEnd + 1);
//         } else {
//           Logger.warn(
//             `Invalid data from ${socket.remoteAddress}: ${dataStr.slice(
//               0,
//               50
//             )}...`
//           );
//           socket.write(
//             Buffer.from(
//               `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
//             )
//           );
//           buffer = Buffer.alloc(0);
//         }
//       }
//     } catch (error) {
//       Logger.error(`Error processing data from ${socket.remoteAddress}`, error);
//       const err = DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         "Data processing failed"
//       );
//       socket.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
//       buffer = Buffer.alloc(0);
//       receivingFile = false;
//       fileChunks = {};
//       chunkCounts = {};
//     }
//   }

//   return {
//     sendFilesInHost,
//     sendMessageInHost,
//     receiveFileInHost,
//   };
// };

// export const ClientSharing = () => {
//   async function sendFile(
//     socket: TCPSocket.Socket,
//     fileName: string,
//     filePath: string,
//     username: string,
//     fileId: string,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     try {
//       const fileData = await RNFS.readFile(filePath, "base64");
//       const fileBuffer = Buffer.from(fileData, "base64");
//       const fileSize = fileBuffer.length;
//       const { chunkSize, numChunks: totalChunks } =
//         calculateDynamicChunkDivision(fileSize);

//       let retries = 0;
//       while (retries < MAX_RETRIES) {
//         try {
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
//             const header = Buffer.from(
//               `FILE:${JSON.stringify({
//                 name: fileName,
//                 size: fileSize,
//                 sender: username,
//                 fileId,
//                 totalChunks,
//                 chunkSize,
//               })}\n\n`
//             );
//             socket.write(header);
//             Logger.info(`Sent header for ${fileId}: ${header.toString()}`);
//           });

//           const startTime = Date.now();
//           let sentBytes = 0;

//           // Send chunks
//           for (let i = 0; i < totalChunks; i++) {
//             const start = i * chunkSize;
//             const chunk = fileBuffer.slice(start, start + chunkSize);
//             const actualChunkSize = chunk.length;

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
//                   resolve();
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
//                   chunkIndex: i,
//                   chunkSize: actualChunkSize,
//                 })}\n\n`
//               );
//               socket.write(Buffer.concat([chunkHeader, chunk]));
//               Logger.info(
//                 `Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
//               );
//             });

//             sentBytes += actualChunkSize;
//             const percentage = (sentBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//             const speed = (sentBytes / elapsedTime / 1024).toFixed(2);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== fileId),
//               {
//                 fileId,
//                 fileName,
//                 progress: `${sentBytes}/${fileSize} bytes`,
//                 speed: `${speed} KB/s`,
//                 percentage,
//               },
//             ]);
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
//                 const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//                 const speed = (fileSize / elapsedTime / 1024).toFixed(2);
//                 setTransferProgress?.((prev) => [
//                   ...prev.filter((p) => p.fileId !== fileId),
//                   {
//                     fileId,
//                     fileName,
//                     progress: `${fileSize}/${fileSize} bytes`,
//                     speed: `${speed} KB/s`,
//                     percentage: 100,
//                   },
//                 ]);
//                 resolve();
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
//           Logger.warn(`Retrying file send for ${fileId} after error ${error}`);
//           await new Promise((resolve) => setTimeout(resolve, 1000));
//         }
//       }
//     } catch (error) {
//       Logger.error(`Failed to send file ${fileName}`, error);
//       throw DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         "File transfer failed"
//       );
//     }
//   }

//   async function sendFilesInClient(
//     socket: TCPSocket.Socket | null,
//     files: { filePath: string; fileData: Buffer }[],
//     username: string,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     if (!socket) {
//       Logger.toast("No active socket to send files", "error");
//       return;
//     }

//     for (const { filePath } of files) {
//       const fileName = filePath.split("/").pop() || "unknown";
//       const fileId = `${username}_${fileName}_${Date.now()}`;
//       await sendFile(
//         socket,
//         fileName,
//         filePath,
//         username,
//         fileId,
//         setTransferProgress
//       );
//       Logger.info(`Sent file: ${fileName} from ${username}`);
//     }
//   }

//   function sendMessageInClient(
//     socket: TCPSocket.Socket | null,
//     message: string,
//     username: string
//   ): void {
//     if (!socket) {
//       Logger.toast("No active socket to send message", "error");
//       return;
//     }
//     socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
//     Logger.info(`Sent MSG: ${message}`);
//   }

//   async function receiveFileInClient({
//     client,
//     data,
//     ip,
//     setMessages,
//     setReceivedFiles,
//     setTransferProgress,
//   }: ClientReceiveProps) {
//     Logger.info(`Received data of length ${data.length} bytes`);
//     try {
//       if (receivingFile) {
//         buffer = Buffer.concat([
//           buffer,
//           typeof data === "string" ? Buffer.from(data) : data,
//         ]);
//         while (buffer.length > 0) {
//           const dataStr = buffer.toString();
//           if (dataStr.startsWith("CHUNK:")) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(`Incomplete CHUNK header from host, waiting...`);
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
//             const expectedChunkEnd = headerEnd + 2 + chunkSize;
//             if (buffer.length < expectedChunkEnd) {
//               if (lastLoggedChunkIndex !== chunkData.chunkIndex) {
//                 Logger.info(
//                   `Incomplete chunk data for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}), waiting...`
//                 );
//                 lastLoggedChunkIndex = chunkData.chunkIndex;
//               }
//               return;
//             }
//             const chunk = buffer.slice(headerEnd + 2, expectedChunkEnd);
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
//             lastLoggedChunkIndex = null; // Reset after processing
//             if (!fileChunks[fileId]) {
//               fileChunks[fileId] = [];
//               chunkCounts[fileId] = 0;
//             }
//             fileChunks[fileId][chunkData.chunkIndex] = chunk;
//             chunkCounts[fileId]++;

//             const receivedBytes = Object.values(fileChunks[fileId]).reduce(
//               (sum, chunk) => sum + (chunk?.length || 0),
//               0
//             );
//             const percentage = (receivedBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//             const speed = (receivedBytes / elapsedTime / 1024).toFixed(2);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== fileId),
//               {
//                 fileId,
//                 fileName,
//                 progress: `${receivedBytes}/${fileSize} bytes`,
//                 speed: `${speed} KB/s`,
//                 percentage,
//               },
//             ]);

//             client.write(
//               Buffer.from(`ACK_CHUNK:${fileId}:${chunkData.chunkIndex}\n`)
//             );
//             buffer = buffer.slice(expectedChunkEnd);

//             if (chunkCounts[fileId] === totalChunks) {
//               const fileBuffer = Buffer.concat(
//                 fileChunks[fileId].filter(Boolean)
//               );
//               if (fileBuffer.length !== fileSize) {
//                 Logger.error(
//                   `File size mismatch for ${fileId}: expected ${fileSize}, received ${fileBuffer.length}`
//                 );
//                 throw new DropShareError(
//                   ERROR_CODES.CORRUPTED_CHUNK,
//                   `File size mismatch: expected ${fileSize}, received ${fileBuffer.length}`
//                 );
//               }
//               await RNFS.writeFile(
//                 `${SAVE_PATH}/${fileName}`,
//                 fileBuffer.toString("base64"),
//                 "base64"
//               );
//               setReceivedFiles((prev) => [...prev, `${SAVE_PATH}/${fileName}`]);
//               Logger.info(
//                 `Received and saved file: ${SAVE_PATH}/${fileName} from ${deviceName}`
//               );
//               fileTransfers.delete(fileId);
//               client.write(Buffer.from(`ACK_COMPLETE:${fileId}\n`));
//               receivingFile = false;
//               delete fileChunks[fileId];
//               delete chunkCounts[fileId];
//               fileId = "";
//               fileName = "";
//               fileSize = 0;
//               deviceName = "";
//               totalChunks = 0;
//               expectedChunkSize = 0;
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
//         }
//         return;
//       }
//       buffer = Buffer.concat([
//         buffer,
//         typeof data === "string" ? Buffer.from(data) : data,
//       ]);
//       while (buffer.length > 0) {
//         const dataStr = buffer.toString();
//         if (dataStr.startsWith("FILE:")) {
//           const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//           if (headerEnd === -1) {
//             Logger.info(`Incomplete FILE header from host, waiting...`);
//             return;
//           }
//           const headerStr = buffer.slice(5, headerEnd).toString();
//           let headerData: {
//             name: string;
//             size: number;
//             sender: string;
//             fileId: string;
//             totalChunks: number;
//             chunkSize: number;
//           };
//           try {
//             headerData = JSON.parse(headerStr);
//           } catch (error) {
//             Logger.error(`Failed to parse FILE header: ${headerStr}`, error);
//             throw new DropShareError(
//               ERROR_CODES.INVALID_HEADER,
//               "Invalid file header"
//             );
//           }

//           fileName = headerData.name;
//           fileSize = headerData.size;
//           fileId = headerData.fileId;
//           deviceName = headerData.sender || "Unknown";
//           totalChunks = headerData.totalChunks;
//           expectedChunkSize = headerData.chunkSize;

//           if (
//             !fileName ||
//             !fileSize ||
//             !fileId ||
//             !totalChunks ||
//             !expectedChunkSize
//           ) {
//             throw new DropShareError(
//               ERROR_CODES.INVALID_HEADER,
//               "Missing file name, size, ID, total chunks, or chunk size"
//             );
//           }

//           const { chunkSize: calculatedChunkSize } =
//             calculateDynamicChunkDivision(fileSize);
//           if (expectedChunkSize !== calculatedChunkSize) {
//             Logger.error(
//               `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//             );
//             throw new DropShareError(
//               ERROR_CODES.INVALID_HEADER,
//               `Chunk size mismatch: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//             );
//           }

//           if (!checkTransferLimits(fileSize, fileTransfers)) {
//             client.write(
//               Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
//             );
//             Logger.toast(`Transfer limit exceeded for ${fileName}`, "error");
//             buffer = Buffer.alloc(0);
//             return;
//           }

//           client.write(Buffer.from(`ACK_FILE:${fileId}\n`));
//           buffer = buffer.slice(headerEnd + 2);
//           receivingFile = true;
//           startTime = Date.now();
//         } else if (dataStr.startsWith("MSG:")) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) {
//             Logger.info(`Incomplete MSG from host, waiting...`);
//             return;
//           }
//           const message = buffer.slice(4, messageEnd).toString();
//           setMessages((prev) => [...prev, `Host: ${message}`]);
//           buffer = buffer.slice(messageEnd + 1);
//         } else if (
//           dataStr.startsWith("ACK_FILE:") ||
//           dataStr.startsWith("ACK_COMPLETE:") ||
//           dataStr.startsWith("ACK_CHUNK:")
//         ) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) {
//             Logger.info(
//               `Incomplete ${dataStr.slice(0, 10)} from host, waiting...`
//             );
//             return;
//           }
//           Logger.info(`Processed ${dataStr.slice(0, messageEnd)}`);
//           buffer = buffer.slice(messageEnd + 1);
//         } else {
//           Logger.warn(
//             `Unknown data from host ${ip}: ${dataStr.slice(0, 50)}...`
//           );
//           client.write(
//             Buffer.from(
//               `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
//             )
//           );
//           buffer = Buffer.alloc(0);
//         }
//       }
//     } catch (error) {
//       Logger.error("Error processing data from host", error);
//       const err = DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         "Data processing failed"
//       );
//       client.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
//       buffer = Buffer.alloc(0);
//       receivingFile = false;
//       fileChunks = {};
//       chunkCounts = {};
//     }
//   }

//   return {
//     sendFilesInClient,
//     sendMessageInClient,
//     receiveFileInClient,
//   };
// };

// working without encryption
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

// // State variables for file transfer
// const fileTransfers = new Map<string, FileTransfer>();
// let buffer = Buffer.alloc(0);
// let receivingFile = false;
// let fileChunks: { [fileId: string]: Buffer[] } = {};
// let chunkCounts: { [fileId: string]: number } = {};
// let fileId = "";
// let fileName = "";
// let fileSize = 0;
// let deviceName = "";
// let startTime = 0;
// let totalChunks = 0;
// let expectedChunkSize = 0;
// let lastLoggedChunkIndex: number | null = null;

// // Interface for file header
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
//   setTransferProgress?: React.Dispatch<
//     React.SetStateAction<TransferProgress[]>
//   >;
//   connectedSockets: ConnectedSocket[];
// }

// interface ClientReceiveProps {
//   ip: string;
//   client: TCPSocket.Socket;
//   data: string | Buffer;
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
//   setMessages: React.Dispatch<React.SetStateAction<string[]>>;
//   setTransferProgress?: React.Dispatch<
//     React.SetStateAction<TransferProgress[]>
//   >;
// }

// interface ConnectedSocket extends TCPSocket.Socket {}

// const MAX_RETRIES = 3;
// const ACK_TIMEOUT = 10000;
// const PROTOCOL_VERSION = "1.0";

// export const HostSharing = () => {
//   async function sendFile(
//     socket: ConnectedSocket,
//     fileName: string,
//     filePath: string,
//     deviceName: string,
//     fileId: string,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >,
//   ): Promise<void> {
//     try {
//       const stat = await RNFS.stat(filePath);
//       const fileSize = stat.size;
//       const { chunkSize, numChunks: totalChunks } =
//         calculateDynamicChunkDivision(fileSize);

//       let retries = 0;
//       while (retries < MAX_RETRIES) {
//         try {
//           if (retries > 0) {
//             // Send RESET message before retrying to clear receiver state
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

//           // Send file header with protocol version
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
//             socket.write(Buffer.from(`FILE:${JSON.stringify(header)}\n\n`));
//             Logger.info(`Sent header for ${fileId}: ${JSON.stringify(header)}`);
//           });

//           const startTime = Date.now();
//           let sentBytes = 0;

//           // Read and send chunks with base64 encoding
//           for (let i = 0; i < totalChunks; i++) {
//             const start = i * chunkSize;
//             const actualChunkSize = Math.min(chunkSize, fileSize - start);
//             const base64Chunk = await RNFS.read(
//               filePath,
//               actualChunkSize,
//               start,
//               "base64"
//             );

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
//                   resolve();
//                 } else {
//                   // Change: Check for ERROR response and abort
//                   // Reason: Prevents retries on receiver filesystem errors
//                   if (message.startsWith("ERROR:")) {
//                     reject(
//                       new DropShareError(
//                         ERROR_CODES.NETWORK_ERROR,
//                         `Receiver error: ${message}`
//                       )
//                     );
//                   } else {
//                     reject(
//                       new DropShareError(
//                         ERROR_CODES.INVALID_HEADER,
//                         `Invalid ACK_CHUNK response: ${message}`
//                       )
//                     );
//                   }
//                 }
//               });
//               const chunkHeader = Buffer.from(
//                 `CHUNK:${JSON.stringify({
//                   fileId,
//                   chunkIndex: i,
//                   chunkSize: actualChunkSize,
//                 })}\n\n`
//               );
//               socket.write(
//                 Buffer.concat([chunkHeader, Buffer.from(base64Chunk)])
//               );
//               Logger.info(
//                 `Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
//               );
//             });

//             sentBytes += actualChunkSize;
//             const percentage = (sentBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//             const speed = (sentBytes / elapsedTime / 1024).toFixed(2);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== fileId),
//               {
//                 fileId,
//                 fileName,
//                 progress: `${sentBytes}/${fileSize} bytes`,
//                 speed: `${speed} KB/s`,
//                 percentage,
//               },
//             ]);
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
//                 const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//                 const speed = (fileSize / elapsedTime / 1024).toFixed(2);
//                 setTransferProgress?.((prev) => [
//                   ...prev.filter((p) => p.fileId !== fileId),
//                   {
//                     fileId,
//                     fileName,
//                     progress: `${fileSize}/${fileSize} bytes`,
//                     speed: `${speed} KB/s`,
//                     percentage: 100,
//                   },
//                 ]);
//                 resolve();
//               } else {
//                 // Change: Check for ERROR response and abort
//                 // Reason: Prevents retries on receiver filesystem errors
//                 if (message.startsWith("ERROR:")) {
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.NETWORK_ERROR,
//                       `Receiver error: ${message}`
//                     )
//                   );
//                 } else {
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.NETWORK_ERROR,
//                       `Invalid ACK_COMPLETE response: ${message}`
//                     )
//                   );
//                 }
//               }
//             });
//           });
//           break;
//         } catch (error) {
//           retries++;
//           if (retries === MAX_RETRIES) {
//             throw error;
//           }
//           Logger.warn(`Retrying file send for ${fileId} after error ${error}`);
//           await new Promise((resolve) => setTimeout(resolve, 1000));
//         }
//       }
//     } catch (error) {
//       Logger.error(`Error in file transfer for ${fileName}`, error);
//       throw DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         `Transfer failed: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`
//       );
//     }
//   }

//   async function sendHostFile(
//     server: TCPSocket.Server | null,
//     filePath: string,
//     fileData: Buffer,
//     username: string,
//     connectedSockets: ConnectedSocket[],
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >,
//   ): Promise<void> {
//     if (!server || connectedSockets.length === 0) {
//       Logger.toast("No connected clients to send file", "error");
//       return;
//     }

//     const fileName = filePath.split("/").pop() || "unknown";
//     const fileId = `${Date.now()}-${fileName}`;
//     const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;

//     if (!(await RNFS.exists(tempPath))) {
//       await RNFS.mkdir(tempPath);
//     }
//     await RNFS.writeFile(tempPath, fileData.toString("base64"), "base64");

//     try {
//       await Promise.all(
//         connectedSockets.map((socket) =>
//           sendFile(
//             socket,
//             fileName,
//             tempPath,
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
//     } finally {
//       if (await RNFS.exists(tempPath)) {
//         await RNFS.unlink(tempPath).catch((err) =>
//           Logger.error(`Failed to delete temp file ${tempPath}`, err)
//         );
//       }
//     }
//   }

//   async function sendFilesInHost(
//     server: TCPSocket.Server | null,
//     files: { filePath: string; fileData: Buffer }[],
//     username: string,
//     connectedSockets: ConnectedSocket[],
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     if (!server || connectedSockets.length === 0) {
//       Logger.toast("No connected clients to send files", "error");
//       return;
//     }

//     for (const { filePath, fileData } of files) {
//       await sendHostFile(
//         server,
//         filePath,
//         fileData,
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
//     connectedSockets: ConnectedSocket[]
//   ): void {
//     if (connectedSockets.length === 0) {
//       Logger.toast("No connected clients to send message", "error");
//       return;
//     }

//     connectedSockets.forEach((socket) => {
//       socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
//       Logger.info(`Sent MSG to ${socket.remoteAddress}: ${message}`);
//     });
//   }

//   async function receiveFileInHost({
//     data,
//     setMessages,
//     setReceivedFiles,
//     socket,
//     setTransferProgress,
//     connectedSockets,
//   }: HostReceiveProps) {
//     try {
//       buffer = Buffer.concat([
//         buffer,
//         typeof data === "string" ? Buffer.from(data) : data,
//       ]);

//       while (buffer.length > 0) {
//         const dataStr = buffer.toString();

//         // Handle RESET messages at the top level
//         if (dataStr.startsWith("RESET:")) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) {
//             Logger.info(
//               `Incomplete RESET from ${socket.remoteAddress}, waiting...`
//             );
//             return;
//           }
//           const resetFileId = dataStr.slice(6, messageEnd);
//           Logger.info(`Received RESET for fileId ${resetFileId}`);
//           if (resetFileId === fileId || !fileId) {
//             receivingFile = false;
//             fileChunks[resetFileId] = [];
//             chunkCounts[resetFileId] = 0;
//             const tempPath = `${RNFS.TemporaryDirectoryPath}/${resetFileId}`;
//             if (await RNFS.exists(tempPath)) {
//               await RNFS.unlink(tempPath).catch((err) =>
//                 Logger.error(`Failed to delete temp file ${tempPath}`, err)
//               );
//             }
//             fileId = "";
//             fileName = "";
//             fileSize = 0;
//             deviceName = "";
//             totalChunks = 0;
//             expectedChunkSize = 0;
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

//             // Change: Calculate base64 length precisely and validate chunk
//             // Reason: Prevents buffer parsing issues with base64 padding
//             const chunkSize = chunkData.chunkSize;
//             const base64Length = Buffer.from(
//               Buffer.alloc(chunkSize).toString("base64")
//             ).length;
//             const chunkStart = headerEnd + 2;
//             const chunkEnd = chunkStart + base64Length;

//             if (buffer.length < chunkEnd) {
//               if (lastLoggedChunkIndex !== chunkData.chunkIndex) {
//                 Logger.info(
//                   `Waiting for base64 chunk data for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}, expected ${base64Length} bytes)`
//                 );
//                 lastLoggedChunkIndex = chunkData.chunkIndex;
//               }
//               return;
//             }

//             const base64Chunk = buffer.slice(chunkStart, chunkEnd).toString();
//             let chunk: Buffer;
//             try {
//               chunk = Buffer.from(base64Chunk, "base64");
//             } catch (error) {
//               Logger.error(
//                 `Failed to decode base64 chunk for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex})`,
//                 error
//               );
//               throw new DropShareError(
//                 ERROR_CODES.CORRUPTED_CHUNK,
//                 "Invalid base64 chunk data"
//               );
//             }

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
//             if (!fileChunks[fileId]) {
//               fileChunks[fileId] = [];
//               chunkCounts[fileId] = 0;
//             }
//             fileChunks[fileId][chunkData.chunkIndex] = chunk;
//             chunkCounts[fileId]++;

//             const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
//             if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
//               await RNFS.mkdir(TEMP_CHUNKS_PATH);
//             }
//             await RNFS.appendFile(tempPath, base64Chunk, "base64");
//             const receivedBytes = Object.values(fileChunks[fileId]).reduce(
//               (sum, chunk) => sum + (chunk?.length || 0),
//               0
//             );
//             const percentage = (receivedBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//             const speed = (receivedBytes / elapsedTime / 1024).toFixed(2);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== fileId),
//               {
//                 fileId,
//                 fileName,
//                 progress: `${receivedBytes}/${fileSize} bytes`,
//                 speed: `${speed} KB/s`,
//                 percentage,
//               },
//             ]);

//             socket.write(
//               Buffer.from(`ACK_CHUNK:${fileId}:${chunkData.chunkIndex}\n`)
//             );
//             buffer = buffer.slice(chunkEnd);

//             if (chunkCounts[fileId] === totalChunks) {
//               // Change: Ensure SAVE_PATH exists before moving file
//               // Reason: Prevents ENOENT errors due to missing directory
//               if (!(await RNFS.exists(SAVE_PATH))) {
//                 await RNFS.mkdir(SAVE_PATH);
//                 Logger.info(`Created directory ${SAVE_PATH}`);
//               }

//               // Change: Sanitize file name to prevent invalid paths
//               // Reason: Avoids filesystem errors from invalid characters
//               const sanitizedFileName = fileName.replace(
//                 /[^a-zA-Z0-9.-]/g,
//                 "_"
//               );
//               const finalPath = `${SAVE_PATH}/${sanitizedFileName}`;
//               try {
//                 if (!(await RNFS.exists(SAVE_PATH))) {
//                   await RNFS.mkdir(SAVE_PATH);
//                   Logger.info(`Created directory ${SAVE_PATH}`);
//                 }
//                 await RNFS.moveFile(tempPath, finalPath);
//                 setReceivedFiles((prev) => [...prev, finalPath]);
//                 Logger.info(
//                   `Received and saved file: ${finalPath} from ${deviceName}`
//                 );
//                 fileTransfers.delete(fileId);
//                 socket.write(Buffer.from(`ACK_COMPLETE:${fileId}\n`));
//               } catch (error) {
//                 Logger.error(`Failed to move file to ${finalPath}`, error);
//                 throw new DropShareError(
//                   ERROR_CODES.DATABASE_WRITE_ERROR,
//                   `Failed to save file: ${
//                     error instanceof Error ? error.message : "Unknown error"
//                   }`
//                 );
//               } finally {
//                 if (await RNFS.exists(tempPath)) {
//                   await RNFS.unlink(tempPath).catch((err) =>
//                     Logger.error(`Failed to delete temp file ${tempPath}`, err)
//                   );
//                 }
//                 receivingFile = false;
//                 delete fileChunks[fileId];
//                 delete chunkCounts[fileId];
//                 fileId = "";
//                 fileName = "";
//                 fileSize = 0;
//                 deviceName = "";
//                 totalChunks = 0;
//                 expectedChunkSize = 0;
//               }
//             }
//           } else if (dataStr.startsWith("FILE:") && fileId) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(
//                 `Incomplete retransmission FILE header from ${socket.remoteAddress}, waiting...`
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
//               fileChunks[fileId] = [];
//               chunkCounts[fileId] = 0;
//               const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//               if (await RNFS.exists(tempPath)) {
//                 await RNFS.unlink(tempPath).catch((err) =>
//                   Logger.error(`Failed to delete temp file ${tempPath}`, err)
//                 );
//               }
//               await RNFS.writeFile(tempPath, "", "base64");

//               if (headerData.protocolVersion !== PROTOCOL_VERSION) {
//                 Logger.error(
//                   `Protocol version mismatch for ${fileId}: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
//                 );
//                 socket.write(
//                   Buffer.from(
//                     `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
//                   )
//                 );
//                 buffer = Buffer.alloc(0);
//                 return;
//               }

//               fileName = headerData.name;
//               fileSize = headerData.size;
//               deviceName = headerData.sender || "Unknown";
//               totalChunks = headerData.totalChunks;
//               expectedChunkSize = headerData.chunkSize;

//               if (
//                 !fileName ||
//                 !fileSize ||
//                 !fileId ||
//                 !totalChunks ||
//                 !expectedChunkSize
//               ) {
//                 throw new DropShareError(
//                   ERROR_CODES.INVALID_HEADER,
//                   "Missing file name, size, ID, total chunks, or chunk size"
//                 );
//               }

//               const { chunkSize: calculatedChunkSize } =
//                 calculateDynamicChunkDivision(fileSize);
//               if (expectedChunkSize !== calculatedChunkSize) {
//                 Logger.error(
//                   `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//                 );
//                 throw new DropShareError(
//                   ERROR_CODES.INVALID_HEADER,
//                   `Chunk size mismatch: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//                 );
//               }

//               if (!checkTransferLimits(fileSize, fileTransfers)) {
//                 socket.write(
//                   Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
//                 );
//                 Logger.toast(
//                   `Transfer limit exceeded for ${fileName}`,
//                   "error"
//                 );
//                 buffer = Buffer.alloc(0);
//                 return;
//               }

//               socket.write(Buffer.from(`ACK_FILE:${fileId}\n`));
//               buffer = buffer.slice(headerEnd + 2);
//               receivingFile = true;
//               startTime = Date.now();
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
//               Logger.info(
//                 `Incomplete FILE header from ${socket.remoteAddress}, waiting...`
//               );
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

//             if (headerData.protocolVersion !== PROTOCOL_VERSION) {
//               Logger.error(
//                 `Protocol version mismatch for ${headerData.fileId}: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
//               );
//               socket.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             fileName = headerData.name;
//             fileSize = headerData.size;
//             deviceName = headerData.sender || "Unknown";
//             fileId = headerData.fileId;
//             totalChunks = headerData.totalChunks;
//             expectedChunkSize = headerData.chunkSize;

//             if (
//               !fileName ||
//               !fileSize ||
//               !fileId ||
//               !totalChunks ||
//               !expectedChunkSize
//             ) {
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 "Missing file name, size, ID, total chunks, or chunk size"
//               );
//             }

//             const { chunkSize: calculatedChunkSize } =
//               calculateDynamicChunkDivision(fileSize);
//             if (expectedChunkSize !== calculatedChunkSize) {
//               Logger.error(
//                 `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//               );
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 `Chunk size mismatch: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//               );
//             }

//             if (!checkTransferLimits(fileSize, fileTransfers)) {
//               socket.write(
//                 Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
//               );
//               Logger.toast(`Transfer limit exceeded for ${fileName}`, "error");
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//             await RNFS.writeFile(tempPath, "", "base64");

//             socket.write(Buffer.from(`ACK_FILE:${fileId}\n`));
//             buffer = buffer.slice(headerEnd + 2);
//             receivingFile = true;
//             startTime = Date.now();
//           } else if (dataStr.startsWith("MSG:")) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(
//                 `Incomplete MSG from ${socket.remoteAddress}, waiting...`
//               );
//               return;
//             }
//             const message = buffer.slice(4, messageEnd).toString();
//             setMessages((prev) => [
//               ...prev,
//               `${socket.remoteAddress}: ${message}`,
//             ]);
//             connectedSockets
//               .filter((s) => s !== socket)
//               .forEach((s) => {
//                 s.write(Buffer.from(`MSG:${message}\n`));
//                 Logger.info(`Forwarded MSG to ${s.remoteAddress}`);
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
//                   socket.remoteAddress
//                 }, waiting...`
//               );
//               return;
//             }
//             Logger.info(`Processed ${dataStr.slice(0, messageEnd)}`);
//             buffer = buffer.slice(messageEnd + 1);
//           } else {
//             Logger.warn(
//               `Invalid data from ${socket.remoteAddress}: ${dataStr.slice(
//                 0,
//                 50
//               )}...`
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
//       Logger.error(`Error processing data from ${socket.remoteAddress}`, error);
//       const err = DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         "Data processing failed"
//       );
//       socket.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
//       // Change: Clear buffer and state after error
//       // Reason: Prevents Invalid protocol errors on retry
//       buffer = Buffer.alloc(0);
//       receivingFile = false;
//       fileChunks = {};
//       chunkCounts = {};
//       const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//       if (await RNFS.exists(tempPath)) {
//         await RNFS.unlink(tempPath).catch((err) =>
//           Logger.error(`Failed to delete temp file ${tempPath}`, err)
//         );
//       }
//       fileId = "";
//       fileName = "";
//       fileSize = 0;
//       deviceName = "";
//       totalChunks = 0;
//       expectedChunkSize = 0;
//     }
//   }

//   return {
//     sendFilesInHost,
//     sendMessageInHost,
//     receiveFileInHost,
//   };
// };

// export const ClientSharing = () => {
//   async function sendFile(
//     socket: TCPSocket.Socket,
//     fileName: string,
//     filePath: string,
//     username: string,
//     fileId: string,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     try {
//       const stat = await RNFS.stat(filePath);
//       const fileSize = stat.size;
//       const { chunkSize, numChunks: totalChunks } =
//         calculateDynamicChunkDivision(fileSize);

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
//               socket.write(Buffer.from(`RESET:${fileId}\n`));
//               Logger.info(`Sent RESET for ${fileId}`);
//             });
//           }

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
//               sender: username,
//               fileId,
//               totalChunks,
//               chunkSize,
//             };
//             socket.write(Buffer.from(`FILE:${JSON.stringify(header)}\n\n`));
//             Logger.info(`Sent header for ${fileId}: ${JSON.stringify(header)}`);
//           });

//           const startTime = Date.now();
//           let sentBytes = 0;

//           for (let i = 0; i < totalChunks; i++) {
//             const start = i * chunkSize;
//             const actualChunkSize = Math.min(chunkSize, fileSize - start);
//             const base64Chunk = await RNFS.read(
//               filePath,
//               actualChunkSize,
//               start,
//               "base64"
//             );

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
//                   resolve();
//                 } else {
//                   // Change: Check for ERROR response and abort
//                   // Reason: Prevents retries on receiver filesystem errors
//                   if (message.startsWith("ERROR:")) {
//                     reject(
//                       new DropShareError(
//                         ERROR_CODES.NETWORK_ERROR,
//                         `Receiver error: ${message}`
//                       )
//                     );
//                   } else {
//                     reject(
//                       new DropShareError(
//                         ERROR_CODES.INVALID_HEADER,
//                         `Invalid ACK_CHUNK response: ${message}`
//                       )
//                     );
//                   }
//                 }
//               });
//               const chunkHeader = Buffer.from(
//                 `CHUNK:${JSON.stringify({
//                   fileId,
//                   chunkIndex: i,
//                   chunkSize: actualChunkSize,
//                 })}\n\n`
//               );
//               socket.write(
//                 Buffer.concat([chunkHeader, Buffer.from(base64Chunk)])
//               );
//               Logger.info(
//                 `Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
//               );
//             });

//             sentBytes += actualChunkSize;
//             const percentage = (sentBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//             const speed = (sentBytes / elapsedTime / 1024).toFixed(2);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== fileId),
//               {
//                 fileId,
//                 fileName,
//                 progress: `${sentBytes}/${fileSize} bytes`,
//                 speed: `${speed} KB/s`,
//                 percentage,
//               },
//             ]);
//           }

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
//                 const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//                 const speed = (fileSize / elapsedTime / 1024).toFixed(2);
//                 setTransferProgress?.((prev) => [
//                   ...prev.filter((p) => p.fileId !== fileId),
//                   {
//                     fileId,
//                     fileName,
//                     progress: `${fileSize}/${fileSize} bytes`,
//                     speed: `${speed} KB/s`,
//                     percentage: 100,
//                   },
//                 ]);
//                 resolve();
//               } else {
//                 // Change: Check for ERROR response and abort
//                 // Reason: Prevents retries on receiver filesystem errors
//                 if (message.startsWith("ERROR:")) {
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.NETWORK_ERROR,
//                       `Receiver error: ${message}`
//                     )
//                   );
//                 } else {
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.NETWORK_ERROR,
//                       `Invalid ACK_COMPLETE response: ${message}`
//                     )
//                   );
//                 }
//               }
//             });
//           });
//           break;
//         } catch (error) {
//           retries++;
//           if (retries === MAX_RETRIES) {
//             throw error;
//           }
//           Logger.warn(`Retrying file send for ${fileId} after error ${error}`);
//           await new Promise((resolve) => setTimeout(resolve, 1000));
//         }
//       }
//     } catch (error) {
//       Logger.error(`Failed to send file ${fileName}`, error);
//       throw DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         "File transfer failed"
//       );
//     }
//   }

//   async function sendFilesInClient(
//     socket: TCPSocket.Socket | null,
//     files: { filePath: string; fileData: Buffer }[],
//     username: string,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     if (!socket) {
//       Logger.toast("No active socket to send files", "error");
//       return;
//     }

//     for (const { filePath } of files) {
//       const fileName = filePath.split("/").pop() || "unknown";
//       const fileId = `${username}_${fileName}_${Date.now()}`;
//       await sendFile(
//         socket,
//         fileName,
//         filePath,
//         username,
//         fileId,
//         setTransferProgress
//       );
//       Logger.info(`Sent file: ${fileName} from ${username}`);
//     }
//   }

//   function sendMessageInClient(
//     socket: TCPSocket.Socket | null,
//     message: string,
//     username: string
//   ): void {
//     if (!socket) {
//       Logger.toast("No active socket to send message", "error");
//       return;
//     }
//     socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
//     Logger.info(`Sent MSG: ${message}`);
//   }

//   async function receiveFileInClient({
//     client,
//     data,
//     ip,
//     setMessages,
//     setReceivedFiles,
//     setTransferProgress,
//   }: ClientReceiveProps) {
//     try {
//       buffer = Buffer.concat([
//         buffer,
//         typeof data === "string" ? Buffer.from(data) : data,
//       ]);

//       while (buffer.length > 0) {
//         const dataStr = buffer.toString();

//         if (dataStr.startsWith("RESET:")) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) {
//             Logger.info(`Incomplete RESET from host, waiting...`);
//             return;
//           }
//           const resetFileId = dataStr.slice(6, messageEnd);
//           Logger.info(`Received RESET for fileId ${resetFileId}`);
//           if (resetFileId === fileId || !fileId) {
//             receivingFile = false;
//             fileChunks[resetFileId] = [];
//             chunkCounts[resetFileId] = 0;
//             const tempPath = `${RNFS.TemporaryDirectoryPath}/${resetFileId}`;
//             if (await RNFS.exists(tempPath)) {
//               await RNFS.unlink(tempPath).catch((err) =>
//                 Logger.error(`Failed to delete temp file ${tempPath}`, err)
//               );
//             }
//             fileId = "";
//             fileName = "";
//             fileSize = 0;
//             deviceName = "";
//             totalChunks = 0;
//             expectedChunkSize = 0;
//           }
//           client.write(Buffer.from(`ACK_RESET:${resetFileId}\n`));
//           buffer = buffer.slice(messageEnd + 1);
//           continue;
//         }

//         if (receivingFile) {
//           if (dataStr.startsWith("CHUNK:")) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(`Incomplete CHUNK header from host, waiting...`);
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

//             // Change: Calculate base64 length precisely and validate chunk
//             // Reason: Prevents buffer parsing issues with base64 padding
//             const chunkSize = chunkData.chunkSize;
//             const base64Length = Buffer.from(
//               Buffer.alloc(chunkSize).toString("base64")
//             ).length;
//             const chunkStart = headerEnd + 2;
//             const chunkEnd = chunkStart + base64Length;

//             if (buffer.length < chunkEnd) {
//               if (lastLoggedChunkIndex !== chunkData.chunkIndex) {
//                 Logger.info(
//                   `Waiting for base64 chunk data for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}, expected ${base64Length} bytes)`
//                 );
//                 lastLoggedChunkIndex = chunkData.chunkIndex;
//               }
//               return;
//             }

//             const base64Chunk = buffer.slice(chunkStart, chunkEnd).toString();
//             let chunk: Buffer;
//             try {
//               chunk = Buffer.from(base64Chunk, "base64");
//             } catch (error) {
//               Logger.error(
//                 `Failed to decode base64 chunk for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex})`,
//                 error
//               );
//               throw new DropShareError(
//                 ERROR_CODES.CORRUPTED_CHUNK,
//                 "Invalid base64 chunk data"
//               );
//             }

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
//             if (!fileChunks[fileId]) {
//               fileChunks[fileId] = [];
//               chunkCounts[fileId] = 0;
//             }
//             fileChunks[fileId][chunkData.chunkIndex] = chunk;
//             chunkCounts[fileId]++;

//             const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
//             if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
//               await RNFS.mkdir(TEMP_CHUNKS_PATH);
//             }
//             await RNFS.appendFile(tempPath, base64Chunk, "base64");

//             const receivedBytes = Object.values(fileChunks[fileId]).reduce(
//               (sum, chunk) => sum + (chunk?.length || 0),
//               0
//             );
//             const percentage = (receivedBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//             const speed = (receivedBytes / elapsedTime / 1024).toFixed(2);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== fileId),
//               {
//                 fileId,
//                 fileName,
//                 progress: `${receivedBytes}/${fileSize} bytes`,
//                 speed: `${speed} KB/s`,
//                 percentage,
//               },
//             ]);

//             client.write(
//               Buffer.from(`ACK_CHUNK:${fileId}:${chunkData.chunkIndex}\n`)
//             );
//             buffer = buffer.slice(chunkEnd);

//             if (chunkCounts[fileId] === totalChunks) {
//               // Change: Ensure SAVE_PATH exists before moving file
//               // Reason: Prevents ENOENT errors due to missing directory
//               if (!(await RNFS.exists(SAVE_PATH))) {
//                 await RNFS.mkdir(SAVE_PATH);
//                 Logger.info(`Created directory ${SAVE_PATH}`);
//               }

//               // Change: Sanitize file name to prevent invalid paths
//               // Reason: Avoids filesystem errors from invalid characters
//               const sanitizedFileName = fileName.replace(
//                 /[^a-zA-Z0-9.-]/g,
//                 "_"
//               );
//               const finalPath = `${SAVE_PATH}/${sanitizedFileName}`;
//               try {
//                 if (!(await RNFS.exists(SAVE_PATH))) {
//                   await RNFS.mkdir(SAVE_PATH);
//                   Logger.info(`Created directory ${SAVE_PATH}`);
//                 }
//                 await RNFS.moveFile(tempPath, finalPath);
//                 setReceivedFiles((prev) => [...prev, finalPath]);
//                 Logger.info(
//                   `Received and saved file: ${finalPath} from ${deviceName}`
//                 );
//                 fileTransfers.delete(fileId);
//                 client.write(Buffer.from(`ACK_COMPLETE:${fileId}\n`));
//               } catch (error) {
//                 Logger.error(`Failed to move file to ${finalPath}`, error);
//                 throw new DropShareError(
//                   ERROR_CODES.DATABASE_WRITE_ERROR,
//                   `Failed to save file: ${
//                     error instanceof Error ? error.message : "Unknown error"
//                   }`
//                 );
//               } finally {
//                 if (await RNFS.exists(tempPath)) {
//                   await RNFS.unlink(tempPath).catch((err) =>
//                     Logger.error(`Failed to delete temp file ${tempPath}`, err)
//                   );
//                 }
//                 receivingFile = false;
//                 delete fileChunks[fileId];
//                 delete chunkCounts[fileId];
//                 fileId = "";
//                 fileName = "";
//                 fileSize = 0;
//                 deviceName = "";
//                 totalChunks = 0;
//                 expectedChunkSize = 0;
//               }
//             }
//           } else if (dataStr.startsWith("FILE:") && fileId) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(
//                 `Incomplete retransmission FILE header from host, waiting...`
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
//               fileChunks[fileId] = [];
//               chunkCounts[fileId] = 0;
//               const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//               if (await RNFS.exists(tempPath)) {
//                 await RNFS.unlink(tempPath).catch((err) =>
//                   Logger.error(`Failed to delete temp file ${tempPath}`, err)
//                 );
//               }
//               if (!(await RNFS.exists(tempPath))) {
//                 await RNFS.mkdir(tempPath);
//               }
//               await RNFS.writeFile(tempPath, "", "base64");
//               if (headerData.protocolVersion !== PROTOCOL_VERSION) {
//                 Logger.error(
//                   `Protocol version mismatch for ${fileId}: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
//                 );
//                 client.write(
//                   Buffer.from(
//                     `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
//                   )
//                 );
//                 buffer = Buffer.alloc(0);
//                 return;
//               }

//               fileName = headerData.name;
//               fileSize = headerData.size;
//               deviceName = headerData.sender || "Unknown";
//               totalChunks = headerData.totalChunks;
//               expectedChunkSize = headerData.chunkSize;

//               if (
//                 !fileName ||
//                 !fileSize ||
//                 !fileId ||
//                 !totalChunks ||
//                 !expectedChunkSize
//               ) {
//                 throw new DropShareError(
//                   ERROR_CODES.INVALID_HEADER,
//                   "Missing file name, size, ID, total chunks, or chunk size"
//                 );
//               }

//               const { chunkSize: calculatedChunkSize } =
//                 calculateDynamicChunkDivision(fileSize);
//               if (expectedChunkSize !== calculatedChunkSize) {
//                 Logger.error(
//                   `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//                 );
//                 throw new DropShareError(
//                   ERROR_CODES.INVALID_HEADER,
//                   `Chunk size mismatch: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//                 );
//               }

//               if (!checkTransferLimits(fileSize, fileTransfers)) {
//                 client.write(
//                   Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
//                 );
//                 Logger.toast(
//                   `Transfer limit exceeded for ${fileName}`,
//                   "error"
//                 );
//                 buffer = Buffer.alloc(0);
//                 return;
//               }

//               client.write(Buffer.from(`ACK_FILE:${fileId}\n`));
//               buffer = buffer.slice(headerEnd + 2);
//               receivingFile = true;
//               startTime = Date.now();
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
//               Logger.info(`Incomplete FILE header from host, waiting...`);
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

//             if (headerData.protocolVersion !== PROTOCOL_VERSION) {
//               Logger.error(
//                 `Protocol version mismatch for ${headerData.fileId}: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
//               );
//               client.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             fileName = headerData.name;
//             fileSize = headerData.size;
//             fileId = headerData.fileId;
//             deviceName = headerData.sender || "Unknown";
//             totalChunks = headerData.totalChunks;
//             expectedChunkSize = headerData.chunkSize;

//             if (
//               !fileName ||
//               !fileSize ||
//               !fileId ||
//               !totalChunks ||
//               !expectedChunkSize
//             ) {
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 "Missing file name, size, ID, total chunks, or chunk size"
//               );
//             }
//             const { chunkSize: calculatedChunkSize } =
//               calculateDynamicChunkDivision(fileSize);
//             if (expectedChunkSize !== calculatedChunkSize) {
//               Logger.error(
//                 `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//               );
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 `Chunk size mismatch: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//               );
//             }

//             if (!checkTransferLimits(fileSize, fileTransfers)) {
//               client.write(
//                 Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
//               );
//               Logger.toast(`Transfer limit exceeded for ${fileName}`, "error");
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//             if (!(await RNFS.exists(tempPath))) {
//               await RNFS.mkdir(tempPath);
//             }
//             await RNFS.writeFile(tempPath, "", "base64");

//             client.write(Buffer.from(`ACK_FILE:${fileId}\n`));
//             buffer = buffer.slice(headerEnd + 2);
//             receivingFile = true;
//             startTime = Date.now();
//           } else if (dataStr.startsWith("MSG:")) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(`Incomplete MSG from host, waiting...`);
//               return;
//             }
//             const message = buffer.slice(4, messageEnd).toString();
//             setMessages((prev) => [...prev, `Host: ${message}`]);
//             buffer = buffer.slice(messageEnd + 1);
//           } else if (
//             dataStr.startsWith("ACK_FILE:") ||
//             dataStr.startsWith("ACK_COMPLETE:") ||
//             dataStr.startsWith("ACK_CHUNK:")
//           ) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(
//                 `Incomplete ${dataStr.slice(0, 10)} from host, waiting...`
//               );
//               return;
//             }
//             Logger.info(`Processed ${dataStr.slice(0, messageEnd)}`);
//             buffer = buffer.slice(messageEnd + 1);
//           } else {
//             Logger.warn(
//               `Unknown data from host ${ip}: ${dataStr.slice(0, 50)}...`
//             );
//             client.write(
//               Buffer.from(
//                 `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
//               )
//             );
//             buffer = Buffer.alloc(0);
//           }
//         }
//       }
//     } catch (error) {
//       Logger.error("Error processing data from host", error);
//       const err = DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         "Data processing failed"
//       );
//       client.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
//       // Change: Clear buffer and state after error
//       // Reason: Prevents Invalid protocol errors on retry
//       buffer = Buffer.alloc(0);
//       receivingFile = false;
//       fileChunks = {};
//       chunkCounts = {};
//       const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//       if (await RNFS.exists(tempPath)) {
//         await RNFS.unlink(tempPath).catch((err) =>
//           Logger.error(`Failed to delete temp file ${tempPath}`, err)
//         );
//       }
//       fileId = "";
//       fileName = "";
//       fileSize = 0;
//       deviceName = "";
//       totalChunks = 0;
//       expectedChunkSize = 0;
//     }
//   }

//   return {
//     sendFilesInClient,
//     sendMessageInClient,
//     receiveFileInClient,
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
import { SAVE_PATH } from "../utils/FileSystemUtil";

const fileTransfers = new Map<string, FileTransfer>();
let buffer = Buffer.alloc(0);
let receivingFile = false;
let fileChunks: { [fileId: string]: Buffer[] } = {};
let chunkCounts: { [fileId: string]: number } = {};
let fileId = "";
let fileName = "";
let fileSize = 0;
let deviceName = "";
let startTime = 0;
let totalChunks = 0;
let expectedChunkSize = 0;
let lastLoggedChunkIndex: number | null = null;

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
  setTransferProgress?: React.Dispatch<
    React.SetStateAction<TransferProgress[]>
  >;
}

interface ClientReceiveProps {
  ip: string;
  client: TCPSocket.Socket;
  data: string | Buffer;
  setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
  setMessages: React.Dispatch<React.SetStateAction<string[]>>;
  setTransferProgress?: React.Dispatch<
    React.SetStateAction<TransferProgress[]>
  >;
}

interface ConnectedSocket extends TCPSocket.Socket {}

const MAX_RETRIES = 3;
const ACK_TIMEOUT = 10000;
const PROTOCOL_VERSION = "1.0";
let connectedSockets: ConnectedSocket[] = [];

export const HostSharing = () => {
  async function sendFile(
    socket: ConnectedSocket,
    fileName: string,
    filePath: string,
    deviceName: string,
    fileId: string,
    setTransferProgress?: React.Dispatch<
      React.SetStateAction<TransferProgress[]>
    >
  ): Promise<void> {
    try {
      const fileData = await RNFS.readFile(filePath, "base64");
      const fileBuffer = Buffer.from(fileData, "base64");
      const fileSize = fileBuffer.length;
      const { chunkSize, numChunks: totalChunks } =
        calculateDynamicChunkDivision(fileSize);

      let retries = 0;
      while (retries < MAX_RETRIES) {
        try {
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
            const header = Buffer.from(
              `FILE:${JSON.stringify({
                protocolVersion: PROTOCOL_VERSION,
                name: fileName,
                size: fileSize,
                sender: deviceName,
                fileId,
                totalChunks,
                chunkSize,
              })}\n\n`
            );
            socket.write(header);
            Logger.info(`Sent header for ${fileId}: ${header.toString()}`);
          });

          const startTime = Date.now();
          let sentBytes = 0;

          // Send chunks
          for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const chunk = fileBuffer.slice(start, start + chunkSize);
            const actualChunkSize = chunk.length;

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
              socket.once("data", (data) => {
                clearTimeout(timeout);
                const message = data.toString();
                Logger.info(`Received for ACK_CHUNK:${i}: ${message}`);
                if (message.startsWith(`ACK_CHUNK:${fileId}:${i}`)) {
                  resolve();
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
                  chunkIndex: i,
                  chunkSize: actualChunkSize,
                })}\n\n`
              );
              socket.write(Buffer.concat([chunkHeader, chunk]));
              Logger.info(
                `Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
              );
            });

            sentBytes += actualChunkSize;
            const percentage = (sentBytes / fileSize) * 100;
            const elapsedTime = (Date.now() - startTime) / 1000 || 1;
            const speed = (sentBytes / elapsedTime / 1024).toFixed(2);

            setTransferProgress?.((prev) => [
              ...prev.filter((p) => p.fileId !== fileId),
              {
                fileId,
                fileName,
                progress: `${sentBytes}/${fileSize} bytes`,
                speed: `${speed} KB/s`,
                percentage,
              },
            ]);
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
                const elapsedTime = (Date.now() - startTime) / 1000 || 1;
                const speed = (fileSize / elapsedTime / 1024).toFixed(2);
                setTransferProgress?.((prev) => [
                  ...prev.filter((p) => p.fileId !== fileId),
                  {
                    fileId,
                    fileName,
                    progress: `${fileSize}/${fileSize} bytes`,
                    speed: `${speed} KB/s`,
                    percentage: 100,
                  },
                ]);
                resolve();
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
          Logger.warn(`Retrying file send for ${fileId} after error ${error}`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      Logger.error(`Error in file transfer for ${fileName}`, error);
      throw DropShareError.from(
        error,
        ERROR_CODES.NETWORK_ERROR,
        `Transfer failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async function sendHostFile(
    server: TCPSocket.Server | null,
    filePath: string,
    fileData: Buffer,
    username: string,
    setTransferProgress?: React.Dispatch<
      React.SetStateAction<TransferProgress[]>
    >
  ): Promise<void> {
    if (!server || connectedSockets.length === 0) {
      Logger.toast("No connected clients to send file", "error");
      return;
    }

    const fileName = filePath.split("/").pop() || "unknown";
    const fileId = `${Date.now()}-${fileName}`;
    const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
    await RNFS.writeFile(tempPath, fileData.toString("base64"), "base64");

    try {
      await Promise.all(
        connectedSockets.map((socket) =>
          sendFile(
            socket,
            fileName,
            tempPath,
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
    } finally {
      await RNFS.unlink(tempPath).catch((err) =>
        Logger.error(`Failed to delete temp file ${tempPath}`, err)
      );
    }
  }

  async function sendFilesInHost(
    server: TCPSocket.Server | null,
    files: { filePath: string; fileData: Buffer }[],
    username: string,
    setTransferProgress?: React.Dispatch<
      React.SetStateAction<TransferProgress[]>
    >
  ): Promise<void> {
    if (!server || connectedSockets.length === 0) {
      Logger.toast("No connected clients to send files", "error");
      return;
    }

    for (const { filePath, fileData } of files) {
      await sendHostFile(
        server,
        filePath,
        fileData,
        username,
        setTransferProgress
      );
      Logger.info(`Sent file: ${filePath.split("/").pop()} from ${username}`);
    }
  }

  function sendMessageInHost(message: string, username: string): void {
    if (connectedSockets.length === 0) {
      Logger.toast("No connected clients to send message", "error");
      return;
    }

    connectedSockets.forEach((socket) => {
      socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
      Logger.info(`Sent MSG to ${socket.remoteAddress}: ${message}`);
    });
  }

  async function receiveFileInHost({
    data,
    setMessages,
    setReceivedFiles,
    socket,
    setTransferProgress,
  }: HostReceiveProps) {
    Logger.info(
      `Received data of length ${data.length} bytes from ${socket.remoteAddress}`
    );
    try {
      if (receivingFile) {
        buffer = Buffer.concat([
          buffer,
          typeof data === "string" ? Buffer.from(data) : data,
        ]);

        while (buffer.length > 0) {
          const dataStr = buffer.toString();
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
            const expectedChunkEnd = headerEnd + 2 + chunkSize;

            if (buffer.length < expectedChunkEnd) {
              if (lastLoggedChunkIndex !== chunkData.chunkIndex) {
                Logger.info(
                  `Incomplete chunk data for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}), waiting...`
                );
                lastLoggedChunkIndex = chunkData.chunkIndex;
              }
              return;
            }

            const chunk = buffer.slice(headerEnd + 2, expectedChunkEnd);
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
            lastLoggedChunkIndex = null; // Reset after processing
            if (!fileChunks[fileId]) {
              fileChunks[fileId] = [];
              chunkCounts[fileId] = 0;
            }
            fileChunks[fileId][chunkData.chunkIndex] = chunk;
            chunkCounts[fileId]++;

            const receivedBytes = Object.values(fileChunks[fileId]).reduce(
              (sum, chunk) => sum + (chunk?.length || 0),
              0
            );
            const percentage = (receivedBytes / fileSize) * 100;
            const elapsedTime = (Date.now() - startTime) / 1000 || 1;
            const speed = (receivedBytes / elapsedTime / 1024).toFixed(2);

            setTransferProgress?.((prev) => [
              ...prev.filter((p) => p.fileId !== fileId),
              {
                fileId,
                fileName,
                progress: `${receivedBytes}/${fileSize} bytes`,
                speed: `${speed} KB/s`,
                percentage,
              },
            ]);

            socket.write(
              Buffer.from(`ACK_CHUNK:${fileId}:${chunkData.chunkIndex}\n`)
            );
            buffer = buffer.slice(expectedChunkEnd);

            if (chunkCounts[fileId] === totalChunks) {
              const fileBuffer = Buffer.concat(
                fileChunks[fileId].filter(Boolean)
              );
              if (fileBuffer.length !== fileSize) {
                Logger.error(
                  `File size mismatch for ${fileId}: expected ${fileSize}, received ${fileBuffer.length}`
                );
                throw new DropShareError(
                  ERROR_CODES.CORRUPTED_CHUNK,
                  `File size mismatch: expected ${fileSize}, received ${fileBuffer.length}`
                );
              }
              await RNFS.writeFile(
                `${SAVE_PATH}/${fileName}`,
                fileBuffer.toString("base64"),
                "base64"
              );
              setReceivedFiles((prev) => [...prev, `${SAVE_PATH}/${fileName}`]);
              Logger.info(
                `Received and saved file: ${SAVE_PATH}/${fileName} from ${deviceName}`
              );
              fileTransfers.delete(fileId);
              socket.write(Buffer.from(`ACK_COMPLETE:${fileId}\n`));
              receivingFile = false;
              delete fileChunks[fileId];
              delete chunkCounts[fileId];
              fileId = "";
              fileName = "";
              fileSize = 0;
              deviceName = "";
              totalChunks = 0;
              expectedChunkSize = 0;
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
        }
        return;
      }

      buffer = Buffer.concat([
        buffer,
        typeof data === "string" ? Buffer.from(data) : data,
      ]);

      while (buffer.length > 0) {
        const dataStr = buffer.toString();
        if (dataStr.startsWith("FILE:")) {
          const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
          if (headerEnd === -1) {
            Logger.info(
              `Incomplete FILE header from ${socket.remoteAddress}, waiting...`
            );
            return;
          }
          const headerStr = buffer.slice(5, headerEnd).toString();
          let headerData: {
            name: string;
            size: number;
            sender: string;
            fileId: string;
            totalChunks: number;
            chunkSize: number;
          };
          try {
            headerData = JSON.parse(headerStr);
          } catch (error) {
            Logger.error(`Failed to parse FILE header: ${headerStr}`, error);
            throw new DropShareError(
              ERROR_CODES.INVALID_HEADER,
              "Invalid file header"
            );
          }

          fileName = headerData.name;
          fileSize = headerData.size;
          deviceName = headerData.sender || "Unknown";
          fileId = headerData.fileId;
          totalChunks = headerData.totalChunks;
          expectedChunkSize = headerData.chunkSize;

          if (
            !fileName ||
            !fileSize ||
            !fileId ||
            !totalChunks ||
            !expectedChunkSize
          ) {
            throw new DropShareError(
              ERROR_CODES.INVALID_HEADER,
              "Missing file name, size, ID, total chunks, or chunk size"
            );
          }

          const { chunkSize: calculatedChunkSize } =
            calculateDynamicChunkDivision(fileSize);
          if (expectedChunkSize !== calculatedChunkSize) {
            Logger.error(
              `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
            );
            throw new DropShareError(
              ERROR_CODES.INVALID_HEADER,
              `Chunk size mismatch: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
            );
          }

          if (!checkTransferLimits(fileSize, fileTransfers)) {
            socket.write(
              Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
            );
            Logger.toast(`Transfer limit exceeded for ${fileName}`, "error");
            buffer = Buffer.alloc(0);
            return;
          }

          socket.write(Buffer.from(`ACK_FILE:${fileId}\n`));
          buffer = buffer.slice(headerEnd + 2);
          receivingFile = true;
          startTime = Date.now();
        } else if (dataStr.startsWith("MSG:")) {
          const messageEnd = buffer.indexOf(Buffer.from("\n"));
          if (messageEnd === -1) {
            Logger.info(
              `Incomplete MSG from ${socket.remoteAddress}, waiting...`
            );
            return;
          }
          const message = buffer.slice(4, messageEnd).toString();
          setMessages((prev) => [
            ...prev,
            `${socket.remoteAddress}: ${message}`,
          ]);
          connectedSockets
            .filter((s) => s !== socket)
            .forEach((s) => {
              s.write(Buffer.from(`MSG:${message}\n`));
              Logger.info(`Forwarded MSG to ${s.remoteAddress}`);
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
                socket.remoteAddress
              }, waiting...`
            );
            return;
          }
          Logger.info(`Processed ${dataStr.slice(0, messageEnd)}`);
          buffer = buffer.slice(messageEnd + 1);
        } else {
          Logger.warn(
            `Invalid data from ${socket.remoteAddress}: ${dataStr.slice(
              0,
              50
            )}...`
          );
          socket.write(
            Buffer.from(
              `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
            )
          );
          buffer = Buffer.alloc(0);
        }
      }
    } catch (error) {
      Logger.error(`Error processing data from ${socket.remoteAddress}`, error);
      const err = DropShareError.from(
        error,
        ERROR_CODES.NETWORK_ERROR,
        "Data processing failed"
      );
      socket.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
      buffer = Buffer.alloc(0);
      receivingFile = false;
      fileChunks = {};
      chunkCounts = {};
    }
  }

  return {
    sendFilesInHost,
    sendMessageInHost,
    receiveFileInHost,
  };
};

export const ClientSharing = () => {
  async function sendFile(
    socket: TCPSocket.Socket,
    fileName: string,
    filePath: string,
    username: string,
    fileId: string,
    setTransferProgress?: React.Dispatch<
      React.SetStateAction<TransferProgress[]>
    >
  ): Promise<void> {
    try {
      const fileData = await RNFS.readFile(filePath, "base64");
      const fileBuffer = Buffer.from(fileData, "base64");
      const fileSize = fileBuffer.length;
      const { chunkSize, numChunks: totalChunks } =
        calculateDynamicChunkDivision(fileSize);

      let retries = 0;
      while (retries < MAX_RETRIES) {
        try {
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
            const header = Buffer.from(
              `FILE:${JSON.stringify({
                protocolVersion: PROTOCOL_VERSION,
                name: fileName,
                size: fileSize,
                sender: username,
                fileId,
                totalChunks,
                chunkSize,
              })}\n\n`
            );
            socket.write(header);
            Logger.info(`Sent header for ${fileId}: ${header.toString()}`);
          });

          const startTime = Date.now();
          let sentBytes = 0;

          // Send chunks
          for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const chunk = fileBuffer.slice(start, start + chunkSize);
            const actualChunkSize = chunk.length;

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
              socket.once("data", (data) => {
                clearTimeout(timeout);
                const message = data.toString();
                Logger.info(`Received for ACK_CHUNK:${i}: ${message}`);
                if (message.startsWith(`ACK_CHUNK:${fileId}:${i}`)) {
                  resolve();
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
                  chunkIndex: i,
                  chunkSize: actualChunkSize,
                })}\n\n`
              );
              socket.write(Buffer.concat([chunkHeader, chunk]));
              Logger.info(
                `Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
              );
            });

            sentBytes += actualChunkSize;
            const percentage = (sentBytes / fileSize) * 100;
            const elapsedTime = (Date.now() - startTime) / 1000 || 1;
            const speed = (sentBytes / elapsedTime / 1024).toFixed(2);

            setTransferProgress?.((prev) => [
              ...prev.filter((p) => p.fileId !== fileId),
              {
                fileId,
                fileName,
                progress: `${sentBytes}/${fileSize} bytes`,
                speed: `${speed} KB/s`,
                percentage,
              },
            ]);
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
                const elapsedTime = (Date.now() - startTime) / 1000 || 1;
                const speed = (fileSize / elapsedTime / 1024).toFixed(2);
                setTransferProgress?.((prev) => [
                  ...prev.filter((p) => p.fileId !== fileId),
                  {
                    fileId,
                    fileName,
                    progress: `${fileSize}/${fileSize} bytes`,
                    speed: `${speed} KB/s`,
                    percentage: 100,
                  },
                ]);
                resolve();
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
          Logger.warn(`Retrying file send for ${fileId} after error ${error}`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      Logger.error(`Failed to send file ${fileName}`, error);
      throw DropShareError.from(
        error,
        ERROR_CODES.NETWORK_ERROR,
        "File transfer failed"
      );
    }
  }

  async function sendFilesInClient(
    socket: TCPSocket.Socket | null,
    files: { filePath: string; fileData: Buffer }[],
    username: string,
    setTransferProgress?: React.Dispatch<
      React.SetStateAction<TransferProgress[]>
    >
  ): Promise<void> {
    if (!socket) {
      Logger.toast("No active socket to send files", "error");
      return;
    }

    for (const { filePath } of files) {
      const fileName = filePath.split("/").pop() || "unknown";
      const fileId = `${username}_${fileName}_${Date.now()}`;
      await sendFile(
        socket,
        fileName,
        filePath,
        username,
        fileId,
        setTransferProgress
      );
      Logger.info(`Sent file: ${fileName} from ${username}`);
    }
  }

  function sendMessageInClient(
    socket: TCPSocket.Socket | null,
    message: string,
    username: string
  ): void {
    if (!socket) {
      Logger.toast("No active socket to send message", "error");
      return;
    }
    socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
    Logger.info(`Sent MSG: ${message}`);
  }

  async function receiveFileInClient({
    client,
    data,
    ip,
    setMessages,
    setReceivedFiles,
    setTransferProgress,
  }: ClientReceiveProps) {
    Logger.info(`Received data of length ${data.length} bytes`);
    try {
      if (receivingFile) {
        buffer = Buffer.concat([
          buffer,
          typeof data === "string" ? Buffer.from(data) : data,
        ]);
        while (buffer.length > 0) {
          const dataStr = buffer.toString();
          if (dataStr.startsWith("CHUNK:")) {
            const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
            if (headerEnd === -1) {
              Logger.info(`Incomplete CHUNK header from host, waiting...`);
              return;
            }
            const headerStr = buffer.slice(6, headerEnd).toString();
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
            const expectedChunkEnd = headerEnd + 2 + chunkSize;
            if (buffer.length < expectedChunkEnd) {
              if (lastLoggedChunkIndex !== chunkData.chunkIndex) {
                Logger.info(
                  `Incomplete chunk data for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}), waiting...`
                );
                lastLoggedChunkIndex = chunkData.chunkIndex;
              }
              return;
            }
            const chunk = buffer.slice(headerEnd + 2, expectedChunkEnd);
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
            lastLoggedChunkIndex = null; // Reset after processing
            if (!fileChunks[fileId]) {
              fileChunks[fileId] = [];
              chunkCounts[fileId] = 0;
            }
            fileChunks[fileId][chunkData.chunkIndex] = chunk;
            chunkCounts[fileId]++;

            const receivedBytes = Object.values(fileChunks[fileId]).reduce(
              (sum, chunk) => sum + (chunk?.length || 0),
              0
            );
            const percentage = (receivedBytes / fileSize) * 100;
            const elapsedTime = (Date.now() - startTime) / 1000 || 1;
            const speed = (receivedBytes / elapsedTime / 1024).toFixed(2);

            setTransferProgress?.((prev) => [
              ...prev.filter((p) => p.fileId !== fileId),
              {
                fileId,
                fileName,
                progress: `${receivedBytes}/${fileSize} bytes`,
                speed: `${speed} KB/s`,
                percentage,
              },
            ]);

            client.write(
              Buffer.from(`ACK_CHUNK:${fileId}:${chunkData.chunkIndex}\n`)
            );
            buffer = buffer.slice(expectedChunkEnd);

            if (chunkCounts[fileId] === totalChunks) {
              const fileBuffer = Buffer.concat(
                fileChunks[fileId].filter(Boolean)
              );
              if (fileBuffer.length !== fileSize) {
                Logger.error(
                  `File size mismatch for ${fileId}: expected ${fileSize}, received ${fileBuffer.length}`
                );
                throw new DropShareError(
                  ERROR_CODES.CORRUPTED_CHUNK,
                  `File size mismatch: expected ${fileSize}, received ${fileBuffer.length}`
                );
              }
              await RNFS.writeFile(
                `${SAVE_PATH}/${fileName}`,
                fileBuffer.toString("base64"),
                "base64"
              );
              setReceivedFiles((prev) => [...prev, `${SAVE_PATH}/${fileName}`]);
              Logger.info(
                `Received and saved file: ${SAVE_PATH}/${fileName} from ${deviceName}`
              );
              fileTransfers.delete(fileId);
              client.write(Buffer.from(`ACK_COMPLETE:${fileId}\n`));
              receivingFile = false;
              delete fileChunks[fileId];
              delete chunkCounts[fileId];
              fileId = "";
              fileName = "";
              fileSize = 0;
              deviceName = "";
              totalChunks = 0;
              expectedChunkSize = 0;
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
        }
        return;
      }
      buffer = Buffer.concat([
        buffer,
        typeof data === "string" ? Buffer.from(data) : data,
      ]);
      while (buffer.length > 0) {
        const dataStr = buffer.toString();
        if (dataStr.startsWith("FILE:")) {
          const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
          if (headerEnd === -1) {
            Logger.info(`Incomplete FILE header from host, waiting...`);
            return;
          }
          const headerStr = buffer.slice(5, headerEnd).toString();
          let headerData: {
            name: string;
            size: number;
            sender: string;
            fileId: string;
            totalChunks: number;
            chunkSize: number;
          };
          try {
            headerData = JSON.parse(headerStr);
          } catch (error) {
            Logger.error(`Failed to parse FILE header: ${headerStr}`, error);
            throw new DropShareError(
              ERROR_CODES.INVALID_HEADER,
              "Invalid file header"
            );
          }

          fileName = headerData.name;
          fileSize = headerData.size;
          fileId = headerData.fileId;
          deviceName = headerData.sender || "Unknown";
          totalChunks = headerData.totalChunks;
          expectedChunkSize = headerData.chunkSize;

          if (
            !fileName ||
            !fileSize ||
            !fileId ||
            !totalChunks ||
            !expectedChunkSize
          ) {
            throw new DropShareError(
              ERROR_CODES.INVALID_HEADER,
              "Missing file name, size, ID, total chunks, or chunk size"
            );
          }

          const { chunkSize: calculatedChunkSize } =
            calculateDynamicChunkDivision(fileSize);
          if (expectedChunkSize !== calculatedChunkSize) {
            Logger.error(
              `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
            );
            throw new DropShareError(
              ERROR_CODES.INVALID_HEADER,
              `Chunk size mismatch: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
            );
          }

          if (!checkTransferLimits(fileSize, fileTransfers)) {
            client.write(
              Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
            );
            Logger.toast(`Transfer limit exceeded for ${fileName}`, "error");
            buffer = Buffer.alloc(0);
            return;
          }

          client.write(Buffer.from(`ACK_FILE:${fileId}\n`));
          buffer = buffer.slice(headerEnd + 2);
          receivingFile = true;
          startTime = Date.now();
        } else if (dataStr.startsWith("MSG:")) {
          const messageEnd = buffer.indexOf(Buffer.from("\n"));
          if (messageEnd === -1) {
            Logger.info(`Incomplete MSG from host, waiting...`);
            return;
          }
          const message = buffer.slice(4, messageEnd).toString();
          setMessages((prev) => [...prev, `Host: ${message}`]);
          buffer = buffer.slice(messageEnd + 1);
        } else if (
          dataStr.startsWith("ACK_FILE:") ||
          dataStr.startsWith("ACK_COMPLETE:") ||
          dataStr.startsWith("ACK_CHUNK:")
        ) {
          const messageEnd = buffer.indexOf(Buffer.from("\n"));
          if (messageEnd === -1) {
            Logger.info(
              `Incomplete ${dataStr.slice(0, 10)} from host, waiting...`
            );
            return;
          }
          Logger.info(`Processed ${dataStr.slice(0, messageEnd)}`);
          buffer = buffer.slice(messageEnd + 1);
        } else {
          Logger.warn(
            `Unknown data from host ${ip}: ${dataStr.slice(0, 50)}...`
          );
          client.write(
            Buffer.from(
              `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
            )
          );
          buffer = Buffer.alloc(0);
        }
      }
    } catch (error) {
      Logger.error("Error processing data from host", error);
      const err = DropShareError.from(
        error,
        ERROR_CODES.NETWORK_ERROR,
        "Data processing failed"
      );
      client.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
      buffer = Buffer.alloc(0);
      receivingFile = false;
      fileChunks = {};
      chunkCounts = {};
    }
  }

  return {
    sendFilesInClient,
    sendMessageInClient,
    receiveFileInClient,
  };
};

// Works without encryption, corrected for host sharing
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

// // State variables for file transfer
// const fileTransfers = new Map<string, FileTransfer>();
// let buffer = Buffer.alloc(0);
// let receivingFile = false;
// let fileChunks: { [fileId: string]: Buffer[] } = {};
// let chunkCounts: { [fileId: string]: number } = {};
// let fileId = "";
// let fileName = "";
// let fileSize = 0;
// let deviceName = "";
// let startTime = 0;
// let totalChunks = 0;
// let expectedChunkSize = 0;
// let lastLoggedChunkIndex: number | null = null;

// // Interface for file header
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
//   ip?: string;
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
//   setMessages: React.Dispatch<React.SetStateAction<string[]>>;
//   setTransferProgress?: React.Dispatch<
//     React.SetStateAction<TransferProgress[]>
//   >;
// }

// interface ClientReceiveProps {
//   ip: string;
//   client: TCPSocket.Socket;
//   data: string | Buffer;
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
//   setMessages: React.Dispatch<React.SetStateAction<string[]>>;
//   setTransferProgress?: React.Dispatch<
//     React.SetStateAction<TransferProgress[]>
//   >;
// }

// interface ConnectedSocket extends TCPSocket.Socket {}

// const MAX_RETRIES = 3;
// const ACK_TIMEOUT = 10000;
// const PROTOCOL_VERSION = "1.0";

// export const HostSharing = () => {
//   async function sendFile(
//     socket: ConnectedSocket,
//     fileName: string,
//     filePath: string,
//     deviceName: string,
//     fileId: string,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     try {
//       const stat = await RNFS.stat(filePath);
//       const fileSize = stat.size;
//       const { chunkSize, numChunks: totalChunks } =
//         calculateDynamicChunkDivision(fileSize);

//       let retries = 0;
//       while (retries < MAX_RETRIES) {
//         try {
//           if (retries > 0) {
//             // Send RESET message before retrying to clear receiver state
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

//           // Send file header with protocol version
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
//             socket.write(Buffer.from(`FILE:${JSON.stringify(header)}\n\n`));
//             Logger.info(`Sent header for ${fileId}: ${JSON.stringify(header)}`);
//           });

//           const startTime = Date.now();
//           let sentBytes = 0;

//           // Read and send chunks with base64 encoding
//           for (let i = 0; i < totalChunks; i++) {
//             const start = i * chunkSize;
//             const actualChunkSize = Math.min(chunkSize, fileSize - start);
//             const base64Chunk = await RNFS.read(
//               filePath,
//               actualChunkSize,
//               start,
//               "base64"
//             );

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
//                   resolve();
//                 } else {
//                   if (message.startsWith("ERROR:")) {
//                     reject(
//                       new DropShareError(
//                         ERROR_CODES.NETWORK_ERROR,
//                         `Receiver error: ${message}`
//                       )
//                     );
//                   } else {
//                     reject(
//                       new DropShareError(
//                         ERROR_CODES.INVALID_HEADER,
//                         `Invalid ACK_CHUNK response: ${message}`
//                       )
//                     );
//                   }
//                 }
//               });
//               const chunkHeader = Buffer.from(
//                 `CHUNK:${JSON.stringify({
//                   fileId,
//                   chunkIndex: i,
//                   chunkSize: actualChunkSize,
//                 })}\n\n`
//               );
//               socket.write(
//                 Buffer.concat([chunkHeader, Buffer.from(base64Chunk)])
//               );
//               Logger.info(
//                 `Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
//               );
//             });

//             sentBytes += actualChunkSize;
//             const percentage = (sentBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//             const speed = (sentBytes / elapsedTime / 1024).toFixed(2);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== fileId),
//               {
//                 fileId,
//                 fileName,
//                 progress: `${sentBytes}/${fileSize} bytes`,
//                 speed: `${speed} KB/s`,
//                 percentage,
//               },
//             ]);
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
//                 const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//                 const speed = (fileSize / elapsedTime / 1024).toFixed(2);
//                 setTransferProgress?.((prev) => [
//                   ...prev.filter((p) => p.fileId !== fileId),
//                   {
//                     fileId,
//                     fileName,
//                     progress: `${fileSize}/${fileSize} bytes`,
//                     speed: `${speed} KB/s`,
//                     percentage: 100,
//                   },
//                 ]);
//                 resolve();
//               } else {
//                 if (message.startsWith("ERROR:")) {
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.NETWORK_ERROR,
//                       `Receiver error: ${message}`
//                     )
//                   );
//                 } else {
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.NETWORK_ERROR,
//                       `Invalid ACK_COMPLETE response: ${message}`
//                     )
//                   );
//                 }
//               }
//             });
//           });
//           break;
//         } catch (error) {
//           retries++;
//           if (retries === MAX_RETRIES) {
//             throw error;
//           }
//           Logger.warn(`Retrying file send for ${fileId} after error ${error}`);
//           await new Promise((resolve) => setTimeout(resolve, 1000));
//         }
//       }
//     } catch (error) {
//       Logger.error(`Error in file transfer for ${fileName}`, error);
//       throw DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         `Transfer failed: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`
//       );
//     }
//   }

//   async function sendHostFile(
//     server: TCPSocket.Server | null,
//     filePath: string,
//     fileData: Buffer,
//     username: string,
//     connectedSockets: ConnectedSocket[], // Accept connectedSockets as parameter
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     if (!server || connectedSockets.length === 0) {
//       Logger.toast("No connected clients to send file", "error");
//       return;
//     }

//     const fileName = filePath.split("/").pop() || "unknown";
//     const fileId = `${Date.now()}-${fileName}`;
//     const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;

//     if (!(await RNFS.exists(tempPath))) {
//       await RNFS.mkdir(tempPath);
//     }
//     await RNFS.writeFile(tempPath, fileData.toString("base64"), "base64");

//     try {
//       await Promise.all(
//         connectedSockets.map((socket) =>
//           sendFile(
//             socket,
//             fileName,
//             tempPath,
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
//     } finally {
//       if (await RNFS.exists(tempPath)) {
//         await RNFS.unlink(tempPath).catch((err) =>
//           Logger.error(`Failed to delete temp file ${tempPath}`, err)
//         );
//       }
//     }
//   }

//   async function sendFilesInHost(
//     server: TCPSocket.Server | null,
//     files: { filePath: string; fileData: Buffer }[],
//     username: string,
//     connectedSockets: ConnectedSocket[], // Accept connectedSockets as parameter
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     if (!server || connectedSockets.length === 0) {
//       Logger.toast("No connected clients to send files", "error");
//       return;
//     }

//     for (const { filePath, fileData } of files) {
//       await sendHostFile(
//         server,
//         filePath,
//         fileData,
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
//     connectedSockets: ConnectedSocket[]
//   ): void {
//     if (connectedSockets.length === 0) {
//       Logger.toast("No connected clients to send message", "error");
//       return;
//     }

//     connectedSockets.forEach((socket) => {
//       socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
//       Logger.info(`Sent MSG to ${socket.remoteAddress}: ${message}`);
//     });
//   }

//   async function receiveFileInHost({
//     data,
//     setMessages,
//     setReceivedFiles,
//     socket,
//     setTransferProgress,
//   }: HostReceiveProps) {
//     try {
//       buffer = Buffer.concat([
//         buffer,
//         typeof data === "string" ? Buffer.from(data) : data,
//       ]);

//       while (buffer.length > 0) {
//         const dataStr = buffer.toString();

//         if (dataStr.startsWith("RESET:")) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) {
//             Logger.info(
//               `Incomplete RESET from ${socket.remoteAddress}, waitingBULLET...`
//             );
//             return;
//           }
//           const resetFileId = dataStr.slice(6, messageEnd);
//           Logger.info(`Received RESET for fileId ${resetFileId}`);
//           if (resetFileId === fileId || !fileId) {
//             receivingFile = false;
//             fileChunks[resetFileId] = [];
//             chunkCounts[resetFileId] = 0;
//             const tempPath = `${RNFS.TemporaryDirectoryPath}/${resetFileId}`;
//             if (await RNFS.exists(tempPath)) {
//               await RNFS.unlink(tempPath).catch((err) =>
//                 Logger.error(`Failed to delete temp file ${tempPath}`, err)
//               );
//             }
//             fileId = "";
//             fileName = "";
//             fileSize = 0;
//             deviceName = "";
//             totalChunks = 0;
//             expectedChunkSize = 0;
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
//             const base64Length = Buffer.from(
//               Buffer.alloc(chunkSize).toString("base64")
//             ).length;
//             const chunkStart = headerEnd + 2;
//             const chunkEnd = chunkStart + base64Length;

//             if (buffer.length < chunkEnd) {
//               if (lastLoggedChunkIndex !== chunkData.chunkIndex) {
//                 Logger.info(
//                   `Waiting for base64 chunk data for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}, expected ${base64Length} bytes)`
//                 );
//                 lastLoggedChunkIndex = chunkData.chunkIndex;
//               }
//               return;
//             }

//             const base64Chunk = buffer.slice(chunkStart, chunkEnd).toString();
//             let chunk: Buffer;
//             try {
//               chunk = Buffer.from(base64Chunk, "base64");
//             } catch (error) {
//               Logger.error(
//                 `Failed to decode base64 chunk for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex})`,
//                 error
//               );
//               throw new DropShareError(
//                 ERROR_CODES.CORRUPTED_CHUNK,
//                 "Invalid base64 chunk data"
//               );
//             }

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
//             if (!fileChunks[fileId]) {
//               fileChunks[fileId] = [];
//               chunkCounts[fileId] = 0;
//             }
//             fileChunks[fileId][chunkData.chunkIndex] = chunk;
//             chunkCounts[fileId]++;

//             const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
//             if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
//               await RNFS.mkdir(TEMP_CHUNKS_PATH);
//             }
//             await RNFS.appendFile(tempPath, base64Chunk, "base64");
//             const receivedBytes = Object.values(fileChunks[fileId]).reduce(
//               (sum, chunk) => sum + (chunk?.length || 0),
//               0
//             );
//             const percentage = (receivedBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//             const speed = (receivedBytes / elapsedTime / 1024).toFixed(2);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== fileId),
//               {
//                 fileId,
//                 fileName,
//                 progress: `${receivedBytes}/${fileSize} bytes`,
//                 speed: `${speed} KB/s`,
//                 percentage,
//               },
//             ]);

//             socket.write(
//               Buffer.from(`ACK_CHUNK:${fileId}:${chunkData.chunkIndex}\n`)
//             );
//             buffer = buffer.slice(chunkEnd);

//             if (chunkCounts[fileId] === totalChunks) {
//               if (!(await RNFS.exists(SAVE_PATH))) {
//                 await RNFS.mkdir(SAVE_PATH);
//                 Logger.info(`Created directory ${SAVE_PATH}`);
//               }

//               const sanitizedFileName = fileName.replace(
//                 /[^a-zA-Z0-9.-]/g,
//                 "_"
//               );
//               const finalPath = `${SAVE_PATH}/${sanitizedFileName}`;
//               try {
//                 if (!(await RNFS.exists(SAVE_PATH))) {
//                   await RNFS.mkdir(SAVE_PATH);
//                   Logger.info(`Created directory ${SAVE_PATH}`);
//                 }
//                 await RNFS.moveFile(tempPath, finalPath);
//                 setReceivedFiles((prev) => [...prev, finalPath]);
//                 Logger.info(
//                   `Received and saved file: ${finalPath} from ${deviceName}`
//                 );
//                 fileTransfers.delete(fileId);
//                 socket.write(Buffer.from(`ACK_COMPLETE:${fileId}\n`));
//               } catch (error) {
//                 Logger.error(`Failed to move file to ${finalPath}`, error);
//                 throw new DropShareError(
//                   ERROR_CODES.DATABASE_WRITE_ERROR,
//                   `Failed to save file: ${
//                     error instanceof Error ? error.message : "Unknown error"
//                   }`
//                 );
//               } finally {
//                 if (await RNFS.exists(tempPath)) {
//                   await RNFS.unlink(tempPath).catch((err) =>
//                     Logger.error(`Failed to delete temp file ${tempPath}`, err)
//                   );
//                 }
//                 receivingFile = false;
//                 delete fileChunks[fileId];
//                 delete chunkCounts[fileId];
//                 fileId = "";
//                 fileName = "";
//                 fileSize = 0;
//                 deviceName = "";
//                 totalChunks = 0;
//                 expectedChunkSize = 0;
//               }
//             }
//           } else if (dataStr.startsWith("FILE:") && fileId) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(
//                 `Incomplete retransmission FILE header from ${socket.remoteAddress}, waiting...`
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
//               fileChunks[fileId] = [];
//               chunkCounts[fileId] = 0;
//               const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//               if (await RNFS.exists(tempPath)) {
//                 await RNFS.unlink(tempPath).catch((err) =>
//                   Logger.error(`Failed to delete temp file ${tempPath}`, err)
//                 );
//               }
//               await RNFS.writeFile(tempPath, "", "base64");

//               if (headerData.protocolVersion !== PROTOCOL_VERSION) {
//                 Logger.error(
//                   `Protocol version mismatch for ${fileId}: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
//                 );
//                 socket.write(
//                   Buffer.from(
//                     `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
//                   )
//                 );
//                 buffer = Buffer.alloc(0);
//                 return;
//               }

//               fileName = headerData.name;
//               fileSize = headerData.size;
//               deviceName = headerData.sender || "Unknown";
//               totalChunks = headerData.totalChunks;
//               expectedChunkSize = headerData.chunkSize;

//               if (
//                 !fileName ||
//                 !fileSize ||
//                 !fileId ||
//                 !totalChunks ||
//                 !expectedChunkSize
//               ) {
//                 throw new DropShareError(
//                   ERROR_CODES.INVALID_HEADER,
//                   "Missing file name, size, ID, total chunks, or chunk size"
//                 );
//               }

//               const { chunkSize: calculatedChunkSize } =
//                 calculateDynamicChunkDivision(fileSize);
//               if (expectedChunkSize !== calculatedChunkSize) {
//                 Logger.error(
//                   `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//                 );
//                 throw new DropShareError(
//                   ERROR_CODES.INVALID_HEADER,
//                   `Chunk size mismatch: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//                 );
//               }

//               if (!checkTransferLimits(fileSize, fileTransfers)) {
//                 socket.write(
//                   Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
//                 );
//                 Logger.toast(
//                   `Transfer limit exceeded for ${fileName}`,
//                   "error"
//                 );
//                 buffer = Buffer.alloc(0);
//                 return;
//               }

//               socket.write(Buffer.from(`ACK_FILE:${fileId}\n`));
//               buffer = buffer.slice(headerEnd + 2);
//               receivingFile = true;
//               startTime = Date.now();
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
//               Logger.info(
//                 `Incomplete FILE header from ${socket.remoteAddress}, waiting...`
//               );
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

//             if (headerData.protocolVersion !== PROTOCOL_VERSION) {
//               Logger.error(
//                 `Protocol version mismatch for ${headerData.fileId}: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
//               );
//               socket.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             fileName = headerData.name;
//             fileSize = headerData.size;
//             deviceName = headerData.sender || "Unknown";
//             fileId = headerData.fileId;
//             totalChunks = headerData.totalChunks;
//             expectedChunkSize = headerData.chunkSize;

//             if (
//               !fileName ||
//               !fileSize ||
//               !fileId ||
//               !totalChunks ||
//               !expectedChunkSize
//             ) {
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 "Missing file name, size, ID, total chunks, or chunk size"
//               );
//             }

//             const { chunkSize: calculatedChunkSize } =
//               calculateDynamicChunkDivision(fileSize);
//             if (expectedChunkSize !== calculatedChunkSize) {
//               Logger.error(
//                 `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//               );
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 `Chunk size mismatch: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//               );
//             }

//             if (!checkTransferLimits(fileSize, fileTransfers)) {
//               socket.write(
//                 Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
//               );
//               Logger.toast(`Transfer limit exceeded for ${fileName}`, "error");
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//             await RNFS.writeFile(tempPath, "", "base64");

//             socket.write(Buffer.from(`ACK_FILE:${fileId}\n`));
//             buffer = buffer.slice(headerEnd + 2);
//             receivingFile = true;
//             startTime = Date.now();
//           } else if (dataStr.startsWith("MSG:")) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(
//                 `Incomplete MSG from ${socket.remoteAddress}, waiting...`
//               );
//               return;
//             }
//             const message = buffer.slice(4, messageEnd).toString();
//             setMessages((prev) => [
//               ...prev,
//               `${socket.remoteAddress}: ${message}`,
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
//                 `Incomplete ${dataStr.slice(0, 10)} from ${
//                   socket.remoteAddress
//                 }, waiting...`
//               );
//               return;
//             }
//             Logger.info(`Processed ${dataStr.slice(0, messageEnd)}`);
//             buffer = buffer.slice(messageEnd + 1);
//           } else {
//             Logger.warn(
//               `Invalid data from ${socket.remoteAddress}: ${dataStr.slice(
//                 0,
//                 50
//               )}...`
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
//       Logger.error(`Error processing data from ${socket.remoteAddress}`, error);
//       const err = DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         "Data processing failed"
//       );
//       socket.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
//       buffer = Buffer.alloc(0);
//       receivingFile = false;
//       fileChunks = {};
//       chunkCounts = {};
//       const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//       if (await RNFS.exists(tempPath)) {
//         await RNFS.unlink(tempPath).catch((err) =>
//           Logger.error(`Failed to delete temp file ${tempPath}`, err)
//         );
//       }
//       fileId = "";
//       fileName = "";
//       fileSize = 0;
//       deviceName = "";
//       totalChunks = 0;
//       expectedChunkSize = 0;
//     }
//   }

//   return {
//     sendFilesInHost,
//     sendMessageInHost,
//     receiveFileInHost,
//   };
// };

// export const ClientSharing = () => {
//   async function sendFile(
//     socket: TCPSocket.Socket,
//     fileName: string,
//     filePath: string,
//     username: string,
//     fileId: string,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     try {
//       const stat = await RNFS.stat(filePath);
//       const fileSize = stat.size;
//       const { chunkSize, numChunks: totalChunks } =
//         calculateDynamicChunkDivision(fileSize);

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
//               socket.write(Buffer.from(`RESET:${fileId}\n`));
//               Logger.info(`Sent RESET for ${fileId}`);
//             });
//           }

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
//               sender: username,
//               fileId,
//               totalChunks,
//               chunkSize,
//             };
//             socket.write(Buffer.from(`FILE:${JSON.stringify(header)}\n\n`));
//             Logger.info(`Sent header for ${fileId}: ${JSON.stringify(header)}`);
//           });

//           const startTime = Date.now();
//           let sentBytes = 0;

//           for (let i = 0; i < totalChunks; i++) {
//             const start = i * chunkSize;
//             const actualChunkSize = Math.min(chunkSize, fileSize - start);
//             const base64Chunk = await RNFS.read(
//               filePath,
//               actualChunkSize,
//               start,
//               "base64"
//             );

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
//                   resolve();
//                 } else {
//                   if (message.startsWith("ERROR:")) {
//                     reject(
//                       new DropShareError(
//                         ERROR_CODES.NETWORK_ERROR,
//                         `Receiver error: ${message}`
//                       )
//                     );
//                   } else {
//                     reject(
//                       new DropShareError(
//                         ERROR_CODES.INVALID_HEADER,
//                         `Invalid ACK_CHUNK response: ${message}`
//                       )
//                     );
//                   }
//                 }
//               });
//               const chunkHeader = Buffer.from(
//                 `CHUNK:${JSON.stringify({
//                   fileId,
//                   chunkIndex: i,
//                   chunkSize: actualChunkSize,
//                 })}\n\n`
//               );
//               socket.write(
//                 Buffer.concat([chunkHeader, Buffer.from(base64Chunk)])
//               );
//               Logger.info(
//                 `Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
//               );
//             });

//             sentBytes += actualChunkSize;
//             const percentage = (sentBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//             const speed = (sentBytes / elapsedTime / 1024).toFixed(2);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== fileId),
//               {
//                 fileId,
//                 fileName,
//                 progress: `${sentBytes}/${fileSize} bytes`,
//                 speed: `${speed} KB/s`,
//                 percentage,
//               },
//             ]);
//           }

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
//                 const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//                 const speed = (fileSize / elapsedTime / 1024).toFixed(2);
//                 setTransferProgress?.((prev) => [
//                   ...prev.filter((p) => p.fileId !== fileId),
//                   {
//                     fileId,
//                     fileName,
//                     progress: `${fileSize}/${fileSize} bytes`,
//                     speed: `${speed} KB/s`,
//                     percentage: 100,
//                   },
//                 ]);
//                 resolve();
//               } else {
//                 if (message.startsWith("ERROR:")) {
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.NETWORK_ERROR,
//                       `Receiver error: ${message}`
//                     )
//                   );
//                 } else {
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.NETWORK_ERROR,
//                       `Invalid ACK_COMPLETE response: ${message}`
//                     )
//                   );
//                 }
//               }
//             });
//           });
//           break;
//         } catch (error) {
//           retries++;
//           if (retries === MAX_RETRIES) {
//             throw error;
//           }
//           Logger.warn(`Retrying file send for ${fileId} after error ${error}`);
//           await new Promise((resolve) => setTimeout(resolve, 1000));
//         }
//       }
//     } catch (error) {
//       Logger.error(`Failed to send file ${fileName}`, error);
//       throw DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         "File transfer failed"
//       );
//     }
//   }

//   async function sendFilesInClient(
//     socket: TCPSocket.Socket | null,
//     files: { filePath: string; fileData: Buffer }[],
//     username: string,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     if (!socket) {
//       Logger.toast("No active socket to send files", "error");
//       return;
//     }

//     for (const { filePath } of files) {
//       const fileName = filePath.split("/").pop() || "unknown";
//       const fileId = `${username}_${fileName}_${Date.now()}`;
//       await sendFile(
//         socket,
//         fileName,
//         filePath,
//         username,
//         fileId,
//         setTransferProgress
//       );
//       Logger.info(`Sent file: ${fileName} from ${username}`);
//     }
//   }

//   function sendMessageInClient(
//     socket: TCPSocket.Socket | null,
//     message: string,
//     username: string
//   ): void {
//     if (!socket) {
//       Logger.toast("No active socket to send message", "error");
//       return;
//     }
//     socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
//     Logger.info(`Sent MSG: ${message}`);
//   }

//   async function receiveFileInClient({
//     client,
//     data,
//     ip,
//     setMessages,
//     setReceivedFiles,
//     setTransferProgress,
//   }: ClientReceiveProps) {
//     try {
//       buffer = Buffer

// .concat([
//         buffer,
//         typeof data === "string" ? Buffer.from(data) : data,
//       ]);

//       while (buffer.length > 0) {
//         const dataStr = buffer.toString();

//         if (dataStr.startsWith("RESET:")) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) {
//             Logger.info(`Incomplete RESET from host, waiting...`);
//             return;
//           }
//           const resetFileId = dataStr.slice(6, messageEnd);
//           Logger.info(`Received RESET for fileId ${resetFileId}`);
//           if (resetFileId === fileId || !fileId) {
//             receivingFile = false;
//             fileChunks[resetFileId] = [];
//             chunkCounts[resetFileId] = 0;
//             const tempPath = `${RNFS.TemporaryDirectoryPath}/${resetFileId}`;
//             if (await RNFS.exists(tempPath)) {
//               await RNFS.unlink(tempPath).catch((err) =>
//                 Logger.error(`Failed to delete temp file ${tempPath}`, err)
//               );
//             }
//             fileId = "";
//             fileName = "";
//             fileSize = 0;
//             deviceName = "";
//             totalChunks = 0;
//             expectedChunkSize = 0;
//           }
//           client.write(Buffer.from(`ACK_RESET:${resetFileId}\n`));
//           buffer = buffer.slice(messageEnd + 1);
//           continue;
//         }

//         if (receivingFile) {
//           if (dataStr.startsWith("CHUNK:")) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(`Incomplete CHUNK header from host, waiting...`);
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
//             const base64Length = Buffer.from(
//               Buffer.alloc(chunkSize).toString("base64")
//             ).length;
//             const chunkStart = headerEnd + 2;
//             const chunkEnd = chunkStart + base64Length;

//             if (buffer.length < chunkEnd) {
//               if (lastLoggedChunkIndex !== chunkData.chunkIndex) {
//                 Logger.info(
//                   `Waiting for base64 chunk data for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}, expected ${base64Length} bytes)`
//                 );
//                 lastLoggedChunkIndex = chunkData.chunkIndex;
//               }
//               return;
//             }

//             const base64Chunk = buffer.slice(chunkStart, chunkEnd).toString();
//             let chunk: Buffer;
//             try {
//               chunk = Buffer.from(base64Chunk, "base64");
//             } catch (error) {
//               Logger.error(
//                 `Failed to decode base64 chunk for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex})`,
//                 error
//               );
//               throw new DropShareError(
//                 ERROR_CODES.CORRUPTED_CHUNK,
//                 "Invalid base64 chunk data"
//               );
//             }

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
//             if (!fileChunks[fileId]) {
//               fileChunks[fileId] = [];
//               chunkCounts[fileId] = 0;
//             }
//             fileChunks[fileId][chunkData.chunkIndex] = chunk;
//             chunkCounts[fileId]++;

//             const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
//             if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
//               await RNFS.mkdir(TEMP_CHUNKS_PATH);
//             }
//             await RNFS.appendFile(tempPath, base64Chunk, "base64");

//             const receivedBytes = Object.values(fileChunks[fileId]).reduce(
//               (sum, chunk) => sum + (chunk?.length || 0),
//               0
//             );
//             const percentage = (receivedBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//             const speed = (receivedBytes / elapsedTime / 1024).toFixed(2);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== fileId),
//               {
//                 fileId,
//                 fileName,
//                 progress: `${receivedBytes}/${fileSize} bytes`,
//                 speed: `${speed} KB/s`,
//                 percentage,
//               },
//             ]);

//             client.write(
//               Buffer.from(`ACK_CHUNK:${fileId}:${chunkData.chunkIndex}\n`)
//             );
//             buffer = buffer.slice(chunkEnd);

//             if (chunkCounts[fileId] === totalChunks) {
//               if (!(await RNFS.exists(SAVE_PATH))) {
//                 await RNFS.mkdir(SAVE_PATH);
//                 Logger.info(`Created directory ${SAVE_PATH}`);
//               }

//               const sanitizedFileName = fileName.replace(
//                 /[^a-zA-Z0-9.-]/g,
//                 "_"
//               );
//               const finalPath = `${SAVE_PATH}/${sanitizedFileName}`;
//               try {
//                 if (!(await RNFS.exists(SAVE_PATH))) {
//                   await RNFS.mkdir(SAVE_PATH);
//                   Logger.info(`Created directory ${SAVE_PATH}`);
//                 }
//                 await RNFS.moveFile(tempPath, finalPath);
//                 setReceivedFiles((prev) => [...prev, finalPath]);
//                 Logger.info(
//                   `Received and saved file: ${finalPath} from ${deviceName}`
//                 );
//                 fileTransfers.delete(fileId);
//                 client.write(Buffer.from(`ACK_COMPLETE:${fileId}\n`));
//               } catch (error) {
//                 Logger.error(`Failed to move file to ${finalPath}`, error);
//                 throw new DropShareError(
//                   ERROR_CODES.DATABASE_WRITE_ERROR,
//                   `Failed to save file: ${
//                     error instanceof Error ? error.message : "Unknown error"
//                   }`
//                 );
//               } finally {
//                 if (await RNFS.exists(tempPath)) {
//                   await RNFS.unlink(tempPath).catch((err) =>
//                     Logger.error(`Failed to delete temp file ${tempPath}`, err)
//                   );
//                 }
//                 receivingFile = false;
//                 delete fileChunks[fileId];
//                 delete chunkCounts[fileId];
//                 fileId = "";
//                 fileName = "";
//                 fileSize = 0;
//                 deviceName = "";
//                 totalChunks = 0;
//                 expectedChunkSize = 0;
//               }
//             }
//           } else if (dataStr.startsWith("FILE:") && fileId) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(
//                 `Incomplete retransmission FILE header from host, waiting...`
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
//               fileChunks[fileId] = [];
//               chunkCounts[fileId] = 0;
//               const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//               if (await RNFS.exists(tempPath)) {
//                 await RNFS.unlink(tempPath).catch((err) =>
//                   Logger.error(`Failed to delete temp file ${tempPath}`, err)
//                 );
//               }
//               if (!(await RNFS.exists(tempPath))) {
//                 await RNFS.mkdir(tempPath);
//               }
//               await RNFS.writeFile(tempPath, "", "base64");
//               if (headerData.protocolVersion !== PROTOCOL_VERSION) {
//                 Logger.error(
//                   `Protocol version mismatch for ${fileId}: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
//                 );
//                 client.write(
//                   Buffer.from(
//                     `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
//                   )
//                 );
//                 buffer = Buffer.alloc(0);
//                 return;
//               }

//               fileName = headerData.name;
//               fileSize = headerData.size;
//               deviceName = headerData.sender || "Unknown";
//               totalChunks = headerData.totalChunks;
//               expectedChunkSize = headerData.chunkSize;

//               if (
//                 !fileName ||
//                 !fileSize ||
//                 !fileId ||
//                 !totalChunks ||
//                 !expectedChunkSize
//               ) {
//                 throw new DropShareError(
//                   ERROR_CODES.INVALID_HEADER,
//                   "Missing file name, size, ID, total chunks, or chunk size"
//                 );
//               }

//               const { chunkSize: calculatedChunkSize } =
//                 calculateDynamicChunkDivision(fileSize);
//               if (expectedChunkSize !== calculatedChunkSize) {
//                 Logger.error(
//                   `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//                 );
//                 throw new DropShareError(
//                   ERROR_CODES.INVALID_HEADER,
//                   `Chunk size mismatch: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//                 );
//               }

//               if (!checkTransferLimits(fileSize, fileTransfers)) {
//                 client.write(
//                   Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
//                 );
//                 Logger.toast(
//                   `Transfer limit exceeded for ${fileName}`,
//                   "error"
//                 );
//                 buffer = Buffer.alloc(0);
//                 return;
//               }

//               client.write(Buffer.from(`ACK_FILE:${fileId}\n`));
//               buffer = buffer.slice(headerEnd + 2);
//               receivingFile = true;
//               startTime = Date.now();
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
//               Logger.info(`Incomplete FILE header from host, waiting...`);
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

//             if (headerData.protocolVersion !== PROTOCOL_VERSION) {
//               Logger.error(
//                 `Protocol version mismatch for ${headerData.fileId}: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
//               );
//               client.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             fileName = headerData.name;
//             fileSize = headerData.size;
//             fileId = headerData.fileId;
//             deviceName = headerData.sender || "Unknown";
//             totalChunks = headerData.totalChunks;
//             expectedChunkSize = headerData.chunkSize;

//             if (
//               !fileName ||
//               !fileSize ||
//               !fileId ||
//               !totalChunks ||
//               !expectedChunkSize
//             ) {
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 "Missing file name, size, ID, total chunks, or chunk size"
//               );
//             }
//             const { chunkSize: calculatedChunkSize } =
//               calculateDynamicChunkDivision(fileSize);
//             if (expectedChunkSize !== calculatedChunkSize) {
//               Logger.error(
//                 `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//               );
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 `Chunk size mismatch: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//               );
//             }

//             if (!checkTransferLimits(fileSize, fileTransfers)) {
//               client.write(
//                 Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
//               );
//               Logger.toast(`Transfer limit exceeded for ${fileName}`, "error");
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//             if (!(await RNFS.exists(tempPath))) {
//               await RNFS.mkdir(tempPath);
//             }
//             await RNFS.writeFile(tempPath, "", "base64");

//             client.write(Buffer.from(`ACK_FILE:${fileId}\n`));
//             buffer = buffer.slice(headerEnd + 2);
//             receivingFile = true;
//             startTime = Date.now();
//           } else if (dataStr.startsWith("MSG:")) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(`Incomplete MSG from host, waiting...`);
//               return;
//             }
//             const message = buffer.slice(4, messageEnd).toString();
//             setMessages((prev) => [...prev, `Host: ${message}`]);
//             buffer = buffer.slice(messageEnd + 1);
//           } else if (
//             dataStr.startsWith("ACK_FILE:") ||
//             dataStr.startsWith("ACK_COMPLETE:") ||
//             dataStr.startsWith("ACK_CHUNK:")
//           ) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(
//                 `Incomplete ${dataStr.slice(0, 10)} from host, waiting...`
//               );
//               return;
//             }
//             Logger.info(`Processed ${dataStr.slice(0, messageEnd)}`);
//             buffer = buffer.slice(messageEnd + 1);
//           } else {
//             Logger.warn(
//               `Unknown data from host ${ip}: ${dataStr.slice(0, 50)}...`
//             );
//             client.write(
//               Buffer.from(
//                 `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
//               )
//             );
//             buffer = Buffer.alloc(0);
//           }
//         }
//       }
//     } catch (error) {
//       Logger.error("Error processing data from host", error);
//       const err = DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         "Data processing failed"
//       );
//       client.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
//       buffer = Buffer.alloc(0);
//       receivingFile = false;
//       fileChunks = {};
//       chunkCounts = {};
//       const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//       if (await RNFS.exists(tempPath)) {
//         await RNFS.unlink(tempPath).catch((err) => Logger.error(`Failed to delete temp file ${tempPath}`, err));
//       }
//       fileId = "";
//       fileName = "";
//       fileSize = 0;
//       deviceName = "";
//       totalChunks = 0;
//       expectedChunkSize = 0;
//     }
//   }

//   return {
//     sendFilesInClient,
//     sendMessageInClient,
//     receiveFileInClient,
//   };
// };

//resolving the issues with the sharing
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

// // State variables for file transfer
// const fileTransfers = new Map<string, FileTransfer>();
// let buffer = Buffer.alloc(0);
// let receivingFile = false;
// let fileChunks: { [fileId: string]: Buffer[] } = {};
// let chunkCounts: { [fileId: string]: number } = {};
// let fileId = "";
// let fileName = "";
// let fileSize = 0;
// let deviceName = "";
// let startTime = 0;
// let totalChunks = 0;
// let expectedChunkSize = 0;
// let lastLoggedChunkIndex: number | null = null;

// // Interface for file header
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
//   ip?: string;
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
//   setMessages: React.Dispatch<React.SetStateAction<string[]>>;
//   setTransferProgress?: React.Dispatch<
//     React.SetStateAction<TransferProgress[]>
//   >;
// }

// interface ClientReceiveProps {
//   ip: string;
//   client: TCPSocket.Socket;
//   data: string | Buffer;
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
//   setMessages: React.Dispatch<React.SetStateAction<string[]>>;
//   setTransferProgress?: React.Dispatch<
//     React.SetStateAction<TransferProgress[]>
//   >;
// }

// interface ConnectedSocket extends TCPSocket.Socket {}

// const MAX_RETRIES = 3;
// const ACK_TIMEOUT = 10000;
// const PROTOCOL_VERSION = "1.0";

// export const HostSharing = () => {
//   async function sendFile(
//     socket: ConnectedSocket,
//     fileName: string,
//     filePath: string,
//     deviceName: string,
//     fileId: string,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     try {
//       const stat = await RNFS.stat(filePath);
//       const fileSize = stat.size;
//       const { chunkSize, numChunks: totalChunks } =
//         calculateDynamicChunkDivision(fileSize);

//       let retries = 0;
//       while (retries < MAX_RETRIES) {
//         try {
//           if (retries > 0) {
//             // Send RESET message before retrying to clear receiver state
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

//           // Send file header with protocol version
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
//             socket.write(Buffer.from(`FILE:${JSON.stringify(header)}\n\n`));
//             Logger.info(`Sent header for ${fileId}: ${JSON.stringify(header)}`);
//           });

//           const startTime = Date.now();
//           let sentBytes = 0;

//           // Read and send chunks with base64 encoding
//           for (let i = 0; i < totalChunks; i++) {
//             const start = i * chunkSize;
//             const actualChunkSize = Math.min(chunkSize, fileSize - start);
//             const base64Chunk = await RNFS.read(
//               filePath,
//               actualChunkSize,
//               start,
//               "base64"
//             );

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
//                   resolve();
//                 } else {
//                   if (message.startsWith("ERROR:")) {
//                     reject(
//                       new DropShareError(
//                         ERROR_CODES.NETWORK_ERROR,
//                         `Receiver error: ${message}`
//                       )
//                     );
//                   } else {
//                     reject(
//                       new DropShareError(
//                         ERROR_CODES.INVALID_HEADER,
//                         `Invalid ACK_CHUNK response: ${message}`
//                       )
//                     );
//                   }
//                 }
//               });
//               const chunkHeader = Buffer.from(
//                 `CHUNK:${JSON.stringify({
//                   fileId,
//                   chunkIndex: i,
//                   chunkSize: actualChunkSize,
//                 })}\n\n`
//               );
//               socket.write(
//                 Buffer.concat([chunkHeader, Buffer.from(base64Chunk)])
//               );
//               Logger.info(
//                 `Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
//               );
//             });

//             sentBytes += actualChunkSize;
//             const percentage = (sentBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//             const speed = (sentBytes / elapsedTime / 1024).toFixed(2);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== fileId),
//               {
//                 fileId,
//                 fileName,
//                 progress: `${sentBytes}/${fileSize} bytes`,
//                 speed: `${speed} KB/s`,
//                 percentage,
//               },
//             ]);
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
//                 const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//                 const speed = (fileSize / elapsedTime / 1024).toFixed(2);
//                 setTransferProgress?.((prev) => [
//                   ...prev.filter((p) => p.fileId !== fileId),
//                   {
//                     fileId,
//                     fileName,
//                     progress: `${fileSize}/${fileSize} bytes`,
//                     speed: `${speed} KB/s`,
//                     percentage: 100,
//                   },
//                 ]);
//                 resolve();
//               } else {
//                 if (message.startsWith("ERROR:")) {
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.NETWORK_ERROR,
//                       `Receiver error: ${message}`
//                     )
//                   );
//                 } else {
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.NETWORK_ERROR,
//                       `Invalid ACK_COMPLETE response: ${message}`
//                     )
//                   );
//                 }
//               }
//             });
//           });
//           break;
//         } catch (error) {
//           retries++;
//           if (retries === MAX_RETRIES) {
//             throw error;
//           }
//           Logger.warn(`Retrying file send for ${fileId} after error ${error}`);
//           await new Promise((resolve) => setTimeout(resolve, 1000));
//         }
//       }
//     } catch (error) {
//       Logger.error(`Error in file transfer for ${fileName}`, error);
//       throw DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         `Transfer failed: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`
//       );
//     }
//   }

//   async function sendHostFile(
//     server: TCPSocket.Server | null,
//     filePath: string,
//     fileData: Buffer,
//     username: string,
//     connectedSockets: ConnectedSocket[],
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     if (!server || connectedSockets.length === 0) {
//       Logger.toast("No connected clients to send file", "error");
//       return;
//     }

//     const fileName = filePath.split("/").pop() || "unknown";
//     const fileId = `${Date.now()}-${fileName}`;
//     const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;

//     if (!(await RNFS.exists(tempPath))) {
//       await RNFS.mkdir(tempPath);
//     }
//     await RNFS.writeFile(tempPath, fileData.toString("base64"), "base64");

//     try {
//       await Promise.all(
//         connectedSockets.map((socket) =>
//           sendFile(
//             socket,
//             fileName,
//             tempPath,
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
//     } finally {
//       if (await RNFS.exists(tempPath)) {
//         await RNFS.unlink(tempPath).catch((err) =>
//           Logger.error(`Failed to delete temp file ${tempPath}`, err)
//         );
//       }
//     }
//   }

//   async function sendFilesInHost(
//     server: TCPSocket.Server | null,
//     files: { filePath: string; fileData: Buffer }[],
//     username: string,
//     connectedSockets: ConnectedSocket[],
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     if (!server || connectedSockets.length === 0) {
//       Logger.toast("No connected clients to send files", "error");
//       return;
//     }

//     for (const { filePath, fileData } of files) {
//       await sendHostFile(
//         server,
//         filePath,
//         fileData,
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
//     connectedSockets: ConnectedSocket[]
//   ): void {
//     if (connectedSockets.length === 0) {
//       Logger.toast("No connected clients to send message", "error");
//       return;
//     }

//     connectedSockets.forEach((socket) => {
//       socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
//       Logger.info(`Sent MSG to ${socket.remoteAddress}: ${message}`);
//     });
//   }

//   async function receiveFileInHost({
//     data,
//     setMessages,
//     setReceivedFiles,
//     socket,
//     setTransferProgress,
//   }: HostReceiveProps) {
//     try {
//       buffer = Buffer.concat([
//         buffer,
//         typeof data === "string" ? Buffer.from(data) : data,
//       ]);

//       while (buffer.length > 0) {
//         const dataStr = buffer.toString();

//         // Handle RESET messages at the top level
//         if (dataStr.startsWith("RESET:")) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) {
//             Logger.info(
//               `Incomplete RESET from ${socket.remoteAddress}, waiting...`
//             );
//             return;
//           }
//           const resetFileId = dataStr.slice(6, messageEnd);
//           Logger.info(`Received RESET for fileId ${resetFileId}`);
//           if (resetFileId === fileId || !fileId) {
//             receivingFile = false;
//             fileChunks[resetFileId] = [];
//             chunkCounts[resetFileId] = 0;
//             const tempPath = `${RNFS.TemporaryDirectoryPath}/${resetFileId}`;
//             if (await RNFS.exists(tempPath)) {
//               await RNFS.unlink(tempPath).catch((err) =>
//                 Logger.error(`Failed to delete temp file ${tempPath}`, err)
//               );
//             }
//             fileId = "";
//             fileName = "";
//             fileSize = 0;
//             deviceName = "";
//             totalChunks = 0;
//             expectedChunkSize = 0;
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
//             const base64Length = Buffer.from(
//               Buffer.alloc(chunkSize).toString("base64")
//             ).length;
//             const chunkStart = headerEnd + 2;
//             const chunkEnd = chunkStart + base64Length;

//             if (buffer.length < chunkEnd) {
//               if (lastLoggedChunkIndex !== chunkData.chunkIndex) {
//                 Logger.info(
//                   `Waiting for base64 chunk data for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}, expected ${base64Length} bytes)`
//                 );
//                 lastLoggedChunkIndex = chunkData.chunkIndex;
//               }
//               return;
//             }

//             const base64Chunk = buffer.slice(chunkStart, chunkEnd).toString();
//             let chunk: Buffer;
//             try {
//               chunk = Buffer.from(base64Chunk, "base64");
//             } catch (error) {
//               Logger.error(
//                 `Failed to decode base64 chunk for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex})`,
//                 error
//               );
//               throw new DropShareError(
//                 ERROR_CODES.CORRUPTED_CHUNK,
//                 "Invalid base64 chunk data"
//               );
//             }

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
//             if (!fileChunks[fileId]) {
//               fileChunks[fileId] = [];
//               chunkCounts[fileId] = 0;
//             }
//             fileChunks[fileId][chunkData.chunkIndex] = chunk;
//             chunkCounts[fileId]++;

//             const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
//             if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
//               await RNFS.mkdir(TEMP_CHUNKS_PATH);
//             }
//             await RNFS.appendFile(tempPath, base64Chunk, "base64");
//             const receivedBytes = Object.values(fileChunks[fileId]).reduce(
//               (sum, chunk) => sum + (chunk?.length || 0),
//               0
//             );
//             const percentage = (receivedBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//             const speed = (receivedBytes / elapsedTime / 1024).toFixed(2);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== fileId),
//               {
//                 fileId,
//                 fileName,
//                 progress: `${receivedBytes}/${fileSize} bytes`,
//                 speed: `${speed} KB/s`,
//                 percentage,
//               },
//             ]);

//             socket.write(
//               Buffer.from(`ACK_CHUNK:${fileId}:${chunkData.chunkIndex}\n`)
//             );
//             buffer = buffer.slice(chunkEnd);

//             if (chunkCounts[fileId] === totalChunks) {
//               if (!(await RNFS.exists(SAVE_PATH))) {
//                 await RNFS.mkdir(SAVE_PATH);
//                 Logger.info(`Created directory ${SAVE_PATH}`);
//               }

//               const sanitizedFileName = fileName.replace(
//                 /[^a-zA-Z0-9.-]/g,
//                 "_"
//               );
//               const finalPath = `${SAVE_PATH}/${sanitizedFileName}`;
//               try {
//                 if (!(await RNFS.exists(SAVE_PATH))) {
//                   await RNFS.mkdir(SAVE_PATH);
//                   Logger.info(`Created directory ${SAVE_PATH}`);
//                 }
//                 await RNFS.moveFile(tempPath, finalPath);
//                 setReceivedFiles((prev) => [...prev, finalPath]);
//                 Logger.info(
//                   `Received and saved file: ${finalPath} from ${deviceName}`
//                 );
//                 fileTransfers.delete(fileId);
//                 socket.write(Buffer.from(`ACK_COMPLETE:${fileId}\n`));
//               } catch (error) {
//                 Logger.error(`Failed to move file to ${finalPath}`, error);
//                 throw new DropShareError(
//                   ERROR_CODES.DATABASE_WRITE_ERROR,
//                   `Failed to save file: ${
//                     error instanceof Error ? error.message : "Unknown error"
//                   }`
//                 );
//               } finally {
//                 if (await RNFS.exists(tempPath)) {
//                   await RNFS.unlink(tempPath).catch((err) =>
//                     Logger.error(`Failed to delete temp file ${tempPath}`, err)
//                   );
//                 }
//                 receivingFile = false;
//                 delete fileChunks[fileId];
//                 delete chunkCounts[fileId];
//                 fileId = "";
//                 fileName = "";
//                 fileSize = 0;
//                 deviceName = "";
//                 totalChunks = 0;
//                 expectedChunkSize = 0;
//               }
//             }
//           } else if (dataStr.startsWith("FILE:") && fileId) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(
//                 `Incomplete retransmission FILE header from ${socket.remoteAddress}, waiting...`
//               );
//               return;
//             }
//             const headerStr = buffer.slice(5, headerEnd).toString().trim();
//             Logger.info(`Parsing retransmission FILE header: ${headerStr}`);
//             let headerData: FileHeader;
//             try {
//               headerData = JSON.parse(headerStr);
//             } catch (error) {
//               Logger.error(
//                 `Failed to parse retransmission FILE header for fileId ${fileId}: ${headerStr}`,
//                 error
//               );
//               socket.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid JSON format\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             if (headerData.fileId === fileId) {
//               Logger.info(
//                 `Detected retransmission for fileId ${fileId}, resetting state`
//               );
//               receivingFile = false;
//               fileChunks[fileId] = [];
//               chunkCounts[fileId] = 0;
//               const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//               if (await RNFS.exists(tempPath)) {
//                 await RNFS.unlink(tempPath).catch((err) =>
//                   Logger.error(`Failed to delete temp file ${tempPath}`, err)
//                 );
//               }
//               await RNFS.writeFile(tempPath, "", "base64");

//               if (headerData.protocolVersion !== PROTOCOL_VERSION) {
//                 Logger.error(
//                   `Protocol version mismatch for ${fileId}: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
//                 );
//                 socket.write(
//                   Buffer.from(
//                     `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
//                   )
//                 );
//                 buffer = Buffer.alloc(0);
//                 return;
//               }

//               fileName = headerData.name;
//               fileSize = headerData.size;
//               deviceName = headerData.sender || "Unknown";
//               totalChunks = headerData.totalChunks;
//               expectedChunkSize = headerData.chunkSize;

//               const missingFields = [];
//               if (!fileName) missingFields.push("name");
//               if (!fileSize) missingFields.push("size");
//               if (!fileId) missingFields.push("fileId");
//               if (!totalChunks) missingFields.push("totalChunks");
//               if (!expectedChunkSize) missingFields.push("chunkSize");

//               if (missingFields.length > 0) {
//                 Logger.error(
//                   `Missing required fields in retransmission FILE header for ${fileId}: ${missingFields.join(
//                     ", "
//                   )}`
//                 );
//                 socket.write(
//                   Buffer.from(
//                     `ERROR:${
//                       ERROR_CODES.INVALID_HEADER
//                     }:Missing required fields: ${missingFields.join(", ")}\n`
//                   )
//                 );
//                 buffer = Buffer.alloc(0);
//                 return;
//               }

//               const { chunkSize: calculatedChunkSize } =
//                 calculateDynamicChunkDivision(fileSize);
//               if (expectedChunkSize !== calculatedChunkSize) {
//                 Logger.error(
//                   `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//                 );
//                 throw new DropShareError(
//                   ERROR_CODES.INVALID_HEADER,
//                   `Chunk size mismatch: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//                 );
//               }

//               if (!checkTransferLimits(fileSize, fileTransfers)) {
//                 socket.write(
//                   Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
//                 );
//                 Logger.toast(
//                   `Transfer limit exceeded for ${fileName}`,
//                   "error"
//                 );
//                 buffer = Buffer.alloc(0);
//                 return;
//               }

//               socket.write(Buffer.from(`ACK_FILE:${fileId}\n`));
//               buffer = buffer.slice(headerEnd + 2);
//               receivingFile = true;
//               startTime = Date.now();
//             } else {
//               Logger.warn(
//                 `Unexpected FILE header for different fileId ${headerData.fileId} while processing ${fileId}`
//               );
//               socket.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Unexpected fileId\n`
//                 )
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
//             socket.write(
//               Buffer.from(
//                 `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
//               )
//             );
//             buffer = Buffer.alloc(0);
//             return;
//           }
//         } else {
//           if (dataStr.startsWith("FILE:")) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(
//                 `Incomplete FILE header from ${socket.remoteAddress}, waiting...`
//               );
//               return;
//             }
//             const headerStr = buffer.slice(5, headerEnd).toString().trim();
//             Logger.info(`Parsing FILE header: ${headerStr}`);
//             let headerData: FileHeader;
//             try {
//               headerData = JSON.parse(headerStr);
//             } catch (error) {
//               Logger.error(`Failed to parse FILE header: ${headerStr}`, error);
//               socket.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid JSON format\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             if (headerData.protocolVersion !== PROTOCOL_VERSION) {
//               Logger.error(
//                 `Protocol version mismatch for ${headerData.fileId}: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
//               );
//               socket.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             fileName = headerData.name;
//             fileSize = headerData.size;
//             deviceName = headerData.sender || "Unknown";
//             fileId = headerData.fileId;
//             totalChunks = headerData.totalChunks;
//             expectedChunkSize = headerData.chunkSize;

//             const missingFields = [];
//             if (!fileName) missingFields.push("name");
//             if (!fileSize) missingFields.push("size");
//             if (!fileId) missingFields.push("fileId");
//             if (!totalChunks) missingFields.push("totalChunks");
//             if (!expectedChunkSize) missingFields.push("chunkSize");

//             if (missingFields.length > 0) {
//               Logger.error(
//                 `Missing required fields in FILE header for ${fileId}: ${missingFields.join(
//                   ", "
//                 )}`
//               );
//               socket.write(
//                 Buffer.from(
//                   `ERROR:${
//                     ERROR_CODES.INVALID_HEADER
//                   }:Missing required fields: ${missingFields.join(", ")}\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             const { chunkSize: calculatedChunkSize } =
//               calculateDynamicChunkDivision(fileSize);
//             if (expectedChunkSize !== calculatedChunkSize) {
//               Logger.error(
//                 `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//               );
//               socket.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Chunk size mismatch: expected ${calculatedChunkSize}, received ${expectedChunkSize}\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             if (!checkTransferLimits(fileSize, fileTransfers)) {
//               socket.write(
//                 Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
//               );
//               Logger.toast(`Transfer limit exceeded for ${fileName}`, "error");
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//             await RNFS.writeFile(tempPath, "", "base64");

//             socket.write(Buffer.from(`ACK_FILE:${fileId}\n`));
//             buffer = buffer.slice(headerEnd + 2);
//             receivingFile = true;
//             startTime = Date.now();
//           } else if (dataStr.startsWith("MSG:")) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(
//                 `Incomplete MSG from ${socket.remoteAddress}, waiting...`
//               );
//               return;
//             }
//             const message = buffer.slice(4, messageEnd).toString();
//             setMessages((prev) => [
//               ...prev,
//               `${socket.remoteAddress}: ${message}`,
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
//                 `Incomplete ${dataStr.slice(0, 10)} from ${
//                   socket.remoteAddress
//                 }, waiting...`
//               );
//               return;
//             }
//             Logger.info(`Processed ${dataStr.slice(0, messageEnd)}`);
//             buffer = buffer.slice(messageEnd + 1);
//           } else {
//             Logger.warn(
//               `Invalid data from ${socket.remoteAddress}: ${dataStr.slice(
//                 0,
//                 50
//               )}...`
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
//       Logger.error(`Error processing data from ${socket.remoteAddress}`, error);
//       const err = DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         "Data processing failed"
//       );
//       socket.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
//       buffer = Buffer.alloc(0);
//       receivingFile = false;
//       fileChunks = {};
//       chunkCounts = {};
//       const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//       if (await RNFS.exists(tempPath)) {
//         await RNFS.unlink(tempPath).catch((err) =>
//           Logger.error(`Failed to delete temp file ${tempPath}`, err)
//         );
//       }
//       fileId = "";
//       fileName = "";
//       fileSize = 0;
//       deviceName = "";
//       totalChunks = 0;
//       expectedChunkSize = 0;
//     }
//   }

//   return {
//     sendFilesInHost,
//     sendMessageInHost,
//     receiveFileInHost,
//   };
// };

// export const ClientSharing = () => {
//   async function sendFile(
//     socket: TCPSocket.Socket,
//     fileName: string,
//     filePath: string,
//     username: string,
//     fileId: string,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     try {
//       const stat = await RNFS.stat(filePath);
//       const fileSize = stat.size;
//       const { chunkSize, numChunks: totalChunks } =
//         calculateDynamicChunkDivision(fileSize);

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
//               socket.write(Buffer.from(`RESET:${fileId}\n`));
//               Logger.info(`Sent RESET for ${fileId}`);
//             });
//           }

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
//               sender: username,
//               fileId,
//               totalChunks,
//               chunkSize,
//             };
//             socket.write(Buffer.from(`FILE:${JSON.stringify(header)}\n\n`));
//             Logger.info(`Sent header for ${fileId}: ${JSON.stringify(header)}`);
//           });

//           const startTime = Date.now();
//           let sentBytes = 0;

//           for (let i = 0; i < totalChunks; i++) {
//             const start = i * chunkSize;
//             const actualChunkSize = Math.min(chunkSize, fileSize - start);
//             const base64Chunk = await RNFS.read(
//               filePath,
//               actualChunkSize,
//               start,
//               "base64"
//             );

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
//                   resolve();
//                 } else {
//                   if (message.startsWith("ERROR:")) {
//                     reject(
//                       new DropShareError(
//                         ERROR_CODES.NETWORK_ERROR,
//                         `Receiver error: ${message}`
//                       )
//                     );
//                   } else {
//                     reject(
//                       new DropShareError(
//                         ERROR_CODES.INVALID_HEADER,
//                         `Invalid ACK_CHUNK response: ${message}`
//                       )
//                     );
//                   }
//                 }
//               });
//               const chunkHeader = Buffer.from(
//                 `CHUNK:${JSON.stringify({
//                   fileId,
//                   chunkIndex: i,
//                   chunkSize: actualChunkSize,
//                 })}\n\n`
//               );
//               socket.write(
//                 Buffer.concat([chunkHeader, Buffer.from(base64Chunk)])
//               );
//               Logger.info(
//                 `Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
//               );
//             });

//             sentBytes += actualChunkSize;
//             const percentage = (sentBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//             const speed = (sentBytes / elapsedTime / 1024).toFixed(2);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== fileId),
//               {
//                 fileId,
//                 fileName,
//                 progress: `${sentBytes}/${fileSize} bytes`,
//                 speed: `${speed} KB/s`,
//                 percentage,
//               },
//             ]);
//           }

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
//                 const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//                 const speed = (fileSize / elapsedTime / 1024).toFixed(2);
//                 setTransferProgress?.((prev) => [
//                   ...prev.filter((p) => p.fileId !== fileId),
//                   {
//                     fileId,
//                     fileName,
//                     progress: `${fileSize}/${fileSize} bytes`,
//                     speed: `${speed} KB/s`,
//                     percentage: 100,
//                   },
//                 ]);
//                 resolve();
//               } else {
//                 if (message.startsWith("ERROR:")) {
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.NETWORK_ERROR,
//                       `Receiver error: ${message}`
//                     )
//                   );
//                 } else {
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.NETWORK_ERROR,
//                       `Invalid ACK_COMPLETE response: ${message}`
//                     )
//                   );
//                 }
//               }
//             });
//           });
//           break;
//         } catch (error) {
//           retries++;
//           if (retries === MAX_RETRIES) {
//             throw error;
//           }
//           Logger.warn(`Retrying file send for ${fileId} after error ${error}`);
//           await new Promise((resolve) => setTimeout(resolve, 1000));
//         }
//       }
//     } catch (error) {
//       Logger.error(`Failed to send file ${fileName}`, error);
//       throw DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         "File transfer failed"
//       );
//     }
//   }

//   async function sendFilesInClient(
//     socket: TCPSocket.Socket | null,
//     files: { filePath: string; fileData: Buffer }[],
//     username: string,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     if (!socket) {
//       Logger.toast("No active socket to send files", "error");
//       return;
//     }

//     for (const { filePath } of files) {
//       const fileName = filePath.split("/").pop() || "unknown";
//       const fileId = `${username}_${fileName}_${Date.now()}`;
//       await sendFile(
//         socket,
//         fileName,
//         filePath,
//         username,
//         fileId,
//         setTransferProgress
//       );
//       Logger.info(`Sent file: ${fileName} from ${username}`);
//     }
//   }

//   function sendMessageInClient(
//     socket: TCPSocket.Socket | null,
//     message: string,
//     username: string
//   ): void {
//     if (!socket) {
//       Logger.toast("No active socket to send message", "error");
//       return;
//     }
//     socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
//     Logger.info(`Sent MSG: ${message}`);
//   }

//   async function receiveFileInClient({
//     client,
//     data,
//     ip,
//     setMessages,
//     setReceivedFiles,
//     setTransferProgress,
//   }: ClientReceiveProps) {
//     try {
//       buffer = Buffer.concat([
//         buffer,
//         typeof data === "string" ? Buffer.from(data) : data,
//       ]);

//       while (buffer.length > 0) {
//         const dataStr = buffer.toString();

//         if (dataStr.startsWith("RESET:")) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) {
//             Logger.info(`Incomplete RESET from host, waiting...`);
//             return;
//           }
//           const resetFileId = dataStr.slice(6, messageEnd);
//           Logger.info(`Received RESET for fileId ${resetFileId}`);
//           if (resetFileId === fileId || !fileId) {
//             receivingFile = false;
//             fileChunks[resetFileId] = [];
//             chunkCounts[resetFileId] = 0;
//             const tempPath = `${RNFS.TemporaryDirectoryPath}/${resetFileId}`;
//             if (await RNFS.exists(tempPath)) {
//               await RNFS.unlink(tempPath).catch((err) =>
//                 Logger.error(`Failed to delete temp file ${tempPath}`, err)
//               );
//             }
//             fileId = "";
//             fileName = "";
//             fileSize = 0;
//             deviceName = "";
//             totalChunks = 0;
//             expectedChunkSize = 0;
//           }
//           client.write(Buffer.from(`ACK_RESET:${resetFileId}\n`));
//           buffer = buffer.slice(messageEnd + 1);
//           continue;
//         }

//         if (receivingFile) {
//           if (dataStr.startsWith("CHUNK:")) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(`Incomplete CHUNK header from host, waiting...`);
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
//             const base64Length = Buffer.from(
//               Buffer.alloc(chunkSize).toString("base64")
//             ).length;
//             const chunkStart = headerEnd + 2;
//             const chunkEnd = chunkStart + base64Length;

//             if (buffer.length < chunkEnd) {
//               if (lastLoggedChunkIndex !== chunkData.chunkIndex) {
//                 Logger.info(
//                   `Waiting for base64 chunk data for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}, expected ${base64Length} bytes)`
//                 );
//                 lastLoggedChunkIndex = chunkData.chunkIndex;
//               }
//               return;
//             }

//             const base64Chunk = buffer.slice(chunkStart, chunkEnd).toString();
//             let chunk: Buffer;
//             try {
//               chunk = Buffer.from(base64Chunk, "base64");
//             } catch (error) {
//               Logger.error(
//                 `Failed to decode base64 chunk for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex})`,
//                 error
//               );
//               throw new DropShareError(
//                 ERROR_CODES.CORRUPTED_CHUNK,
//                 "Invalid base64 chunk data"
//               );
//             }

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
//             if (!fileChunks[fileId]) {
//               fileChunks[fileId] = [];
//               chunkCounts[fileId] = 0;
//             }
//             fileChunks[fileId][chunkData.chunkIndex] = chunk;
//             chunkCounts[fileId]++;

//             const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
//             if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
//               await RNFS.mkdir(TEMP_CHUNKS_PATH);
//             }
//             await RNFS.appendFile(tempPath, base64Chunk, "base64");

//             const receivedBytes = Object.values(fileChunks[fileId]).reduce(
//               (sum, chunk) => sum + (chunk?.length || 0),
//               0
//             );
//             const percentage = (receivedBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//             const speed = (receivedBytes / elapsedTime / 1024).toFixed(2);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== fileId),
//               {
//                 fileId,
//                 fileName,
//                 progress: `${receivedBytes}/${fileSize} bytes`,
//                 speed: `${speed} KB/s`,
//                 percentage,
//               },
//             ]);

//             client.write(
//               Buffer.from(`ACK_CHUNK:${fileId}:${chunkData.chunkIndex}\n`)
//             );
//             buffer = buffer.slice(chunkEnd);

//             if (chunkCounts[fileId] === totalChunks) {
//               if (!(await RNFS.exists(SAVE_PATH))) {
//                 await RNFS.mkdir(SAVE_PATH);
//                 Logger.info(`Created directory ${SAVE_PATH}`);
//               }

//               const sanitizedFileName = fileName.replace(
//                 /[^a-zA-Z0-9.-]/g,
//                 "_"
//               );
//               const finalPath = `${SAVE_PATH}/${sanitizedFileName}`;
//               try {
//                 if (!(await RNFS.exists(SAVE_PATH))) {
//                   await RNFS.mkdir(SAVE_PATH);
//                   Logger.info(`Created directory ${SAVE_PATH}`);
//                 }
//                 await RNFS.moveFile(tempPath, finalPath);
//                 setReceivedFiles((prev) => [...prev, finalPath]);
//                 Logger.info(
//                   `Received and saved file: ${finalPath} from ${deviceName}`
//                 );
//                 fileTransfers.delete(fileId);
//                 client.write(Buffer.from(`ACK_COMPLETE:${fileId}\n`));
//               } catch (error) {
//                 Logger.error(`Failed to move file to ${finalPath}`, error);
//                 throw new DropShareError(
//                   ERROR_CODES.DATABASE_WRITE_ERROR,
//                   `Failed to save file: ${
//                     error instanceof Error ? error.message : "Unknown error"
//                   }`
//                 );
//               } finally {
//                 if (await RNFS.exists(tempPath)) {
//                   await RNFS.unlink(tempPath).catch((err) =>
//                     Logger.error(`Failed to delete temp file ${tempPath}`, err)
//                   );
//                 }
//                 receivingFile = false;
//                 delete fileChunks[fileId];
//                 delete chunkCounts[fileId];
//                 fileId = "";
//                 fileName = "";
//                 fileSize = 0;
//                 deviceName = "";
//                 totalChunks = 0;
//                 expectedChunkSize = 0;
//               }
//             }
//           } else if (dataStr.startsWith("FILE:") && fileId) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(
//                 `Incomplete retransmission FILE header from host, waiting...`
//               );
//               return;
//             }
//             const headerStr = buffer.slice(5, headerEnd).toString().trim();
//             Logger.info(`Parsing retransmission FILE header: ${headerStr}`);
//             let headerData: FileHeader;
//             try {
//               headerData = JSON.parse(headerStr);
//             } catch (error) {
//               Logger.error(
//                 `Failed to parse retransmission FILE header: ${headerStr}`,
//                 error
//               );
//               client.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid JSON format\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             if (headerData.fileId === fileId) {
//               Logger.info(
//                 `Detected retransmission for fileId ${fileId}, resetting state`
//               );
//               receivingFile = false;
//               fileChunks[fileId] = [];
//               chunkCounts[fileId] = 0;
//               const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//               if (await RNFS.exists(tempPath)) {
//                 await RNFS.unlink(tempPath).catch((err) =>
//                   Logger.error(`Failed to delete temp file ${tempPath}`, err)
//                 );
//               }
//               await RNFS.writeFile(tempPath, "", "base64");

//               if (headerData.protocolVersion !== PROTOCOL_VERSION) {
//                 Logger.error(
//                   `Protocol version mismatch for ${fileId}: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
//                 );
//                 client.write(
//                   Buffer.from(
//                     `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
//                   )
//                 );
//                 buffer = Buffer.alloc(0);
//                 return;
//               }

//               fileName = headerData.name;
//               fileSize = headerData.size;
//               deviceName = headerData.sender || "Unknown";
//               totalChunks = headerData.totalChunks;
//               expectedChunkSize = headerData.chunkSize;

//               const missingFields = [];
//               if (!fileName) missingFields.push("name");
//               if (!fileSize) missingFields.push("size");
//               if (!fileId) missingFields.push("fileId");
//               if (!totalChunks) missingFields.push("totalChunks");
//               if (!expectedChunkSize) missingFields.push("chunkSize");

//               if (missingFields.length > 0) {
//                 Logger.error(
//                   `Missing required fields in retransmission FILE header for ${fileId}: ${missingFields.join(
//                     ", "
//                   )}`
//                 );
//                 client.write(
//                   Buffer.from(
//                     `ERROR:${
//                       ERROR_CODES.INVALID_HEADER
//                     }:Missing required fields: ${missingFields.join(", ")}\n`
//                   )
//                 );
//                 buffer = Buffer.alloc(0);
//                 return;
//               }

//               const { chunkSize: calculatedChunkSize } =
//                 calculateDynamicChunkDivision(fileSize);
//               if (expectedChunkSize !== calculatedChunkSize) {
//                 Logger.error(
//                   `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//                 );
//                 throw new DropShareError(
//                   ERROR_CODES.INVALID_HEADER,
//                   `Chunk size mismatch: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//                 );
//               }

//               if (!checkTransferLimits(fileSize, fileTransfers)) {
//                 client.write(
//                   Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
//                 );
//                 Logger.toast(
//                   `Transfer limit exceeded for ${fileName}`,
//                   "error"
//                 );
//                 buffer = Buffer.alloc(0);
//                 return;
//               }

//               client.write(Buffer.from(`ACK_FILE:${fileId}\n`));
//               buffer = buffer.slice(headerEnd + 2);
//               receivingFile = true;
//               startTime = Date.now();
//             } else {
//               Logger.warn(
//                 `Unexpected FILE header for different fileId ${headerData.fileId} while processing ${fileId}`
//               );
//               client.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Unexpected fileId\n`
//                 )
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
//             client.write(
//               Buffer.from(
//                 `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
//               )
//             );
//             buffer = Buffer.alloc(0);
//             return;
//           }
//         } else {
//           if (dataStr.startsWith("FILE:")) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(`Incomplete FILE header from host, waiting...`);
//               return;
//             }
//             const headerStr = buffer.slice(5, headerEnd).toString().trim();
//             Logger.info(`Parsing FILE header: ${headerStr}`);
//             let headerData: FileHeader;
//             try {
//               headerData = JSON.parse(headerStr);
//             } catch (error) {
//               Logger.error(`Failed to parse FILE header: ${headerStr}`, error);
//               client.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid JSON format\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             if (headerData.protocolVersion !== PROTOCOL_VERSION) {
//               Logger.error(
//                 `Protocol version mismatch for ${headerData.fileId}: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
//               );
//               client.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             fileName = headerData.name;
//             fileSize = headerData.size;
//             fileId = headerData.fileId;
//             deviceName = headerData.sender || "Unknown";
//             totalChunks = headerData.totalChunks;
//             expectedChunkSize = headerData.chunkSize;

//             const missingFields = [];
//             if (!fileName) missingFields.push("name");
//             if (!fileSize) missingFields.push("size");
//             if (!fileId) missingFields.push("fileId");
//             if (!totalChunks) missingFields.push("totalChunks");
//             if (!expectedChunkSize) missingFields.push("chunkSize");

//             if (missingFields.length > 0) {
//               Logger.error(
//                 `Missing required fields in FILE header for ${fileId}: ${missingFields.join(
//                   ", "
//                 )}`
//               );
//               client.write(
//                 Buffer.from(
//                   `ERROR:${
//                     ERROR_CODES.INVALID_HEADER
//                   }:Missing required fields: ${missingFields.join(", ")}\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             const { chunkSize: calculatedChunkSize } =
//               calculateDynamicChunkDivision(fileSize);
//             if (expectedChunkSize !== calculatedChunkSize) {
//               Logger.error(
//                 `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//               );
//               client.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Chunk size mismatch: expected ${calculatedChunkSize}, received ${expectedChunkSize}\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             if (!checkTransferLimits(fileSize, fileTransfers)) {
//               client.write(
//                 Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
//               );
//               Logger.toast(`Transfer limit exceeded for ${fileName}`, "error");
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//             await RNFS.writeFile(tempPath, "", "base64");

//             client.write(Buffer.from(`ACK_FILE:${fileId}\n`));
//             buffer = buffer.slice(headerEnd + 2);
//             receivingFile = true;
//             startTime = Date.now();
//           } else if (dataStr.startsWith("MSG:")) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(`Incomplete MSG from host, waiting...`);
//               return;
//             }
//             const message = buffer.slice(4, messageEnd).toString();
//             setMessages((prev) => [...prev, `Host: ${message}`]);
//             buffer = buffer.slice(messageEnd + 1);
//           } else if (
//             dataStr.startsWith("ACK_FILE:") ||
//             dataStr.startsWith("ACK_COMPLETE:") ||
//             dataStr.startsWith("ACK_CHUNK:")
//           ) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(
//                 `Incomplete ${dataStr.slice(0, 10)} from host, waiting...`
//               );
//               return;
//             }
//             Logger.info(`Processed ${dataStr.slice(0, messageEnd)}`);
//             buffer = buffer.slice(messageEnd + 1);
//           } else {
//             Logger.warn(
//               `Unknown data from host ${ip}: ${dataStr.slice(0, 50)}...`
//             );
//             client.write(
//               Buffer.from(
//                 `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
//               )
//             );
//             buffer = Buffer.alloc(0);
//           }
//         }
//       }
//     } catch (error) {
//       Logger.error("Error processing data from host", error);
//       const err = DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         "Data processing failed"
//       );
//       client.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
//       buffer = Buffer.alloc(0);
//       receivingFile = false;
//       fileChunks = {};
//       chunkCounts = {};
//       const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//       if (await RNFS.exists(tempPath)) {
//         await RNFS.unlink(tempPath).catch((err) =>
//           Logger.error(`Failed to delete temp file ${tempPath}`, err)
//         );
//       }
//       fileId = "";
//       fileName = "";
//       fileSize = 0;
//       deviceName = "";
//       totalChunks = 0;
//       expectedChunkSize = 0;
//     }
//   }

//   return {
//     sendFilesInClient,
//     sendMessageInClient,
//     receiveFileInClient,
//   };
// };

// failed test
// import RNFS from "react-native-fs";
// import { Buffer } from "buffer";
// import { Logger } from "../utils/Logger";
// import { DropShareError, ERROR_CODES } from "../utils/Error";
// import TCPSocket from "react-native-tcp-socket";
// import {
//   calculateDynamicChunkDivision,
//   checkTransferLimits,
// } from "../utils/NetworkUtils";
// import { SAVE_PATH, TEMP_CHUNKS_PATH } from "../utils/FileSystemUtil";

// interface ConnectedSocket extends TCPSocket.Socket {}
// // Constants
// const MAX_RETRIES = 3;
// const ACK_TIMEOUT = 10000;
// const PROTOCOL_VERSION = "1.0";
// const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
// const MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB max buffer
// let connectedSockets: ConnectedSocket[] = [];

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

// interface TransferProgress {
//   fileId: string;
//   fileName: string;
//   progress: string;
//   speed: string;
//   percentage: number;
// }

// interface HostReceiveProps {
//   socket: TCPSocket.Socket;
//   data: Buffer;
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
//   setMessages: React.Dispatch<React.SetStateAction<string[]>>;
//   setTransferProgress?: React.Dispatch<
//     React.SetStateAction<TransferProgress[]>
//   >;
// }

// interface ClientReceiveProps {
//   ip: string;
//   client: TCPSocket.Socket;
//   data: Buffer;
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
//   setMessages: React.Dispatch<React.SetStateAction<string[]>>;
//   setTransferProgress?: React.Dispatch<
//     React.SetStateAction<TransferProgress[]>
//   >;
// }

// // Transfer session class to manage state per transfer
// class FileTransferSession {
//   fileId: string;
//   fileName: string;
//   fileSize: number;
//   deviceName: string;
//   totalChunks: number;
//   chunkSize: number;
//   receivedBytes: number;
//   startTime: number;
//   tempPath: string;
//   receivedChunks: Set<number>;
//   buffer: Buffer;
//   paused: boolean;

//   constructor(header: FileHeader, tempPath: string) {
//     this.fileId = header.fileId;
//     this.fileName = header.name;
//     this.fileSize = header.size;
//     this.deviceName = header.sender || "Unknown";
//     this.totalChunks = header.totalChunks;
//     this.chunkSize = header.chunkSize;
//     this.receivedBytes = 0;
//     this.startTime = Date.now();
//     this.tempPath = tempPath;
//     this.receivedChunks = new Set();
//     this.buffer = Buffer.alloc(0);
//     this.paused = false;
//   }

//   async writeChunk(chunk: Buffer, isFirstChunk: boolean): Promise<void> {
//     if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
//       await RNFS.mkdir(TEMP_CHUNKS_PATH);
//     }
//     if (isFirstChunk) {
//       await RNFS.writeFile(this.tempPath, chunk.toString("base64"), "base64");
//     } else {
//       await RNFS.appendFile(this.tempPath, chunk.toString("base64"), "base64");
//     }
//   }

//   async finalize(finalPath: string): Promise<void> {
//     if (!(await RNFS.exists(SAVE_PATH))) {
//       await RNFS.mkdir(SAVE_PATH);
//     }
//     await RNFS.moveFile(this.tempPath, finalPath);
//   }

//   updateProgress(chunkSize: number): {
//     progress: string;
//     speed: string;
//     percentage: number;
//   } {
//     this.receivedBytes += chunkSize;
//     const percentage = (this.receivedBytes / this.fileSize) * 100;
//     const elapsedTime = (Date.now() - this.startTime) / 1000 || 1;
//     const speed = (this.receivedBytes / elapsedTime / 1024).toFixed(2);
//     return {
//       progress: `${this.receivedBytes}/${this.fileSize} bytes`,
//       speed: `${speed} KB/s`,
//       percentage,
//     };
//   }

//   pause() {
//     this.paused = true;
//   }

//   resume() {
//     this.paused = false;
//   }

//   getMissingChunks(): number[] {
//     const missing: number[] = [];
//     for (let i = 0; i < this.totalChunks; i++) {
//       if (!this.receivedChunks.has(i)) {
//         missing.push(i);
//       }
//     }
//     return missing;
//   }
// }

// // Map to store sessions per socket
// const transferSessions = new Map<string, FileTransferSession>();

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
//     try {
//       const stat = await RNFS.stat(filePath);
//       const fileSize = stat.size;
//       const { chunkSize, numChunks: totalChunks } = {
//         chunkSize: CHUNK_SIZE,
//         numChunks: Math.ceil(fileSize / CHUNK_SIZE),
//       };

//       let retries = 0;
//       while (retries < MAX_RETRIES) {
//         try {
//           if (retries > 0) {
//             await new Promise<void>((resolve, reject) => {
//               const timeout = setTimeout(
//                 () =>
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.NETWORK_ERROR,
//                       `Timeout waiting for ACK_RESET`
//                     )
//                   ),
//                 ACK_TIMEOUT
//               );
//               socket.once("data", (data) => {
//                 clearTimeout(timeout);
//                 if (data.toString().startsWith(`ACK_RESET:${fileId}`))
//                   resolve();
//                 else
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.INVALID_HEADER,
//                       `Invalid ACK_RESET`
//                     )
//                   );
//               });
//               socket.write(Buffer.from(`RESET:${fileId}\n`));
//             });
//           }

//           // Send header
//           await new Promise<void>((resolve, reject) => {
//             const timeout = setTimeout(
//               () =>
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.NETWORK_ERROR,
//                     `Timeout waiting for ACK_FILE`
//                   )
//                 ),
//               ACK_TIMEOUT
//             );
//             socket.once("data", (data) => {
//               clearTimeout(timeout);
//               if (data.toString().startsWith(`ACK_FILE:${fileId}`)) resolve();
//               else if (data.toString().startsWith(`RESUME:${fileId}`)) {
//                 // Handle resume request
//                 const missingChunks = JSON.parse(
//                   data.toString().slice(`RESUME:${fileId}:`.length)
//                 );
//                 resolve(); // Proceed to send missing chunks
//               } else {
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.INVALID_HEADER,
//                     `Invalid ACK_FILE`
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
//             socket.write(Buffer.from(`FILE:${JSON.stringify(header)}\n\n`));
//           });

//           const startTime = Date.now();
//           let sentBytes = 0;
//           let chunkIndex = 0;

//           while (sentBytes < fileSize) {
//             const bytesToRead = Math.min(chunkSize, fileSize - sentBytes);
//             const chunk = await RNFS.read(
//               filePath,
//               bytesToRead,
//               sentBytes,
//               "base64"
//             ); // Read chunk
//             const chunkBuffer = Buffer.from(chunk, "base64"); // Convert to binary
//             const actualChunkSize = chunkBuffer.length;

//             await new Promise<void>((resolve, reject) => {
//               const timeout = setTimeout(
//                 () =>
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.NETWORK_ERROR,
//                       `Timeout waiting for ACK_CHUNK:${chunkIndex}`
//                     )
//                   ),
//                 ACK_TIMEOUT
//               );
//               socket.once("data", (data) => {
//                 clearTimeout(timeout);
//                 if (
//                   data
//                     .toString()
//                     .startsWith(`ACK_CHUNK:${fileId}:${chunkIndex}`)
//                 )
//                   resolve();
//                 else if (data.toString().startsWith("ERROR:"))
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.NETWORK_ERROR,
//                       `Receiver error: ${data.toString()}`
//                     )
//                   );
//                 else
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.INVALID_HEADER,
//                       `Invalid ACK_CHUNK`
//                     )
//                   );
//               });
//               const chunkHeader = Buffer.from(
//                 `CHUNK:${JSON.stringify({
//                   fileId,
//                   chunkIndex,
//                   chunkSize: actualChunkSize,
//                 })}\n\n`
//               );
//               socket.write(Buffer.concat([chunkHeader, chunkBuffer]));
//             });

//             sentBytes += actualChunkSize;
//             const percentage = (sentBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//             const speed = (sentBytes / elapsedTime / 1024).toFixed(2);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== fileId),
//               {
//                 fileId,
//                 fileName,
//                 progress: `${sentBytes}/${fileSize} bytes`,
//                 speed: `${speed} KB/s`,
//                 percentage,
//               },
//             ]);

//             chunkIndex++;
//             // Yield to event loop to prevent UI freeze
//             await new Promise((resolve) => setTimeout(resolve, 0));
//           }

//           // Wait for final ACK
//           await new Promise<void>((resolve, reject) => {
//             const timeout = setTimeout(
//               () =>
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.NETWORK_ERROR,
//                     `Timeout waiting for ACK_COMPLETE`
//                   )
//                 ),
//               ACK_TIMEOUT
//             );
//             socket.once("data", (data) => {
//               clearTimeout(timeout);
//               if (data.toString().startsWith(`ACK_COMPLETE:${fileId}`)) {
//                 const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//                 const speed = (fileSize / elapsedTime / 1024).toFixed(2);
//                 setTransferProgress?.((prev) => [
//                   ...prev.filter((p) => p.fileId !== fileId),
//                   {
//                     fileId,
//                     fileName,
//                     progress: `${fileSize}/${fileSize} bytes`,
//                     speed: `${speed} KB/s`,
//                     percentage: 100,
//                   },
//                 ]);
//                 resolve();
//               } else if (data.toString().startsWith("ERROR:")) {
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.NETWORK_ERROR,
//                     `Receiver error: ${data.toString()}`
//                   )
//                 );
//               } else {
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.NETWORK_ERROR,
//                     `Invalid ACK_COMPLETE`
//                   )
//                 );
//               }
//             });
//           });

//           break;
//         } catch (error) {
//           retries++;
//           if (retries === MAX_RETRIES) throw error;
//           await new Promise((resolve) => setTimeout(resolve, 1000));
//         }
//       }
//     } catch (error) {
//       throw DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         `Transfer failed: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`
//       );
//     }
//   }

//   async function sendHostFile(
//     server: TCPSocket.Server | null,
//     filePath: string,
//     fileData: Buffer,
//     username: string,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     if (!server || connectedSockets.length === 0) {
//       Logger.toast("No connected clients to send file", "error");
//       return;
//     }

//     const fileName = filePath.split("/").pop() || "unknown";
//     const fileId = `${Date.now()}-${fileName}`;
//     const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;

//     if (!(await RNFS.exists(tempPath))) {
//       await RNFS.mkdir(tempPath);
//     }
//     await RNFS.writeFile(tempPath, fileData.toString("base64"), "base64");

//     try {
//       await Promise.all(
//         connectedSockets.map((socket) =>
//           sendFile(
//             socket,
//             fileName,
//             tempPath,
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
//     } finally {
//       if (await RNFS.exists(tempPath)) {
//         await RNFS.unlink(tempPath).catch((err) =>
//           Logger.error(`Failed to delete temp file ${tempPath}`, err)
//         );
//       }
//     }
//   }

//   async function sendFilesInHost(
//     server: TCPSocket.Server | null,
//     files: { filePath: string; fileData: Buffer }[],
//     username: string,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     if (!server || connectedSockets.length === 0) {
//       Logger.toast("No connected clients to send files", "error");
//       return;
//     }

//     for (const { filePath, fileData } of files) {
//       await sendHostFile(
//         server,
//         filePath,
//         fileData,
//         username,
//         setTransferProgress
//       );
//       Logger.info(`Sent file: ${filePath.split("/").pop()} from ${username}`);
//     }
//   }

//   function sendMessageInHost(message: string, username: string): void {
//     if (connectedSockets.length === 0) {
//       Logger.toast("No connected clients to send message", "error");
//       return;
//     }

//     connectedSockets.forEach((socket) => {
//       socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
//       Logger.info(`Sent MSG to ${socket.remoteAddress}: ${message}`);
//     });
//   }

//   async function receiveFileInHost({
//     socket,
//     data,
//     setMessages,
//     setReceivedFiles,
//     setTransferProgress,
//   }: HostReceiveProps) {
//     const sessionId = `${socket.remoteAddress}:${socket.remotePort}`;
//     let session = transferSessions.get(sessionId);

//     try {
//       let buffer = session?.buffer || Buffer.alloc(0);
//       buffer = Buffer.concat([buffer, data]);

//       if (buffer.length > MAX_BUFFER_SIZE) {
//         socket.pause();
//         session?.pause();
//       }

//       while (buffer.length > 0) {
//         const dataStr = buffer.toString();

//         if (dataStr.startsWith("RESET:")) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) return;
//           const resetFileId = dataStr.slice(6, messageEnd);
//           if (session && (resetFileId === session.fileId || !session.fileId)) {
//             if (await RNFS.exists(session.tempPath)) {
//               await RNFS.unlink(session.tempPath);
//             }
//             transferSessions.delete(sessionId);
//             session = undefined;
//           }
//           socket.write(Buffer.from(`ACK_RESET:${resetFileId}\n`));
//           buffer = buffer.slice(messageEnd + 1);
//           continue;
//         }

//         if (session && session.receivedChunks.size < session.totalChunks) {
//           if (dataStr.startsWith("CHUNK:")) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) return;
//             const headerStr = buffer.slice(6, headerEnd).toString();
//             if (!headerStr) {
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 "Empty chunk header"
//               );
//             }
//             let chunkData: {
//               fileId: string;
//               chunkIndex: number;
//               chunkSize: number;
//             };
//             try {
//               chunkData = JSON.parse(headerStr);
//             } catch {
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 "Invalid chunk header"
//               );
//             }

//             const chunkStart = headerEnd + 2;
//             const chunkEnd = chunkStart + chunkData.chunkSize;
//             if (buffer.length < chunkEnd) return;

//             const chunk = buffer.slice(chunkStart, chunkEnd);
//             if (chunk.length !== chunkData.chunkSize) {
//               throw new DropShareError(
//                 ERROR_CODES.CORRUPTED_CHUNK,
//                 `Chunk size mismatch: expected ${chunkData.chunkSize}, received ${chunk.length}`
//               );
//             }

//             await session.writeChunk(chunk, session.receivedChunks.size === 0);
//             session.receivedChunks.add(chunkData.chunkIndex);
//             const progress = session.updateProgress(chunkData.chunkSize);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== session!.fileId),
//               {
//                 fileId: session!.fileId,
//                 fileName: session!.fileName,
//                 ...progress,
//               },
//             ]);

//             socket.write(
//               Buffer.from(
//                 `ACK_CHUNK:${session.fileId}:${chunkData.chunkIndex}\n`
//               )
//             );
//             buffer = buffer.slice(chunkEnd);

//             if (session.receivedChunks.size === session.totalChunks) {
//               const sanitizedFileName = session.fileName.replace(
//                 /[^a-zA-Z0-9.-]/g,
//                 "_"
//               );
//               const finalPath = `${SAVE_PATH}/${Date.now()}-${sanitizedFileName}`; // Avoid collisions
//               await session.finalize(finalPath);
//               setReceivedFiles((prev) => [...prev, finalPath]);
//               socket.write(Buffer.from(`ACK_COMPLETE:${session.fileId}\n`));
//               transferSessions.delete(sessionId);
//             }
//           }
//         } else if (dataStr.startsWith("FILE:")) {
//           const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//           if (headerEnd === -1) return;
//           const headerStr = buffer.slice(5, headerEnd).toString();
//           if (!headerStr) {
//             throw new DropShareError(
//               ERROR_CODES.INVALID_HEADER,
//               "Empty file header"
//             );
//           }
//           let header: FileHeader;
//           try {
//             header = JSON.parse(headerStr);
//           } catch {
//             throw new DropShareError(
//               ERROR_CODES.INVALID_HEADER,
//               "Invalid file header"
//             );
//           }

//           if (header.protocolVersion !== PROTOCOL_VERSION) {
//             socket.write(
//               Buffer.from(
//                 `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
//               )
//             );
//             buffer = Buffer.alloc(0);
//             return;
//           }

//           if (!checkTransferLimits(header.size, new Map())) {
//             socket.write(
//               Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
//             );
//             buffer = Buffer.alloc(0);
//             return;
//           }

//           // Check disk space
//           const fsInfo = await RNFS.getFSInfo();
//           if (fsInfo.freeSpace < header.size) {
//             socket.write(
//               Buffer.from(
//                 `ERROR:${ERROR_CODES.DATABASE_WRITE_ERROR}:Insufficient disk space\n`
//               )
//             );
//             buffer = Buffer.alloc(0);
//             return;
//           }

//           const tempPath = `${TEMP_CHUNKS_PATH}/${header.fileId}`;
//           session = new FileTransferSession(header, tempPath);
//           transferSessions.set(sessionId, session);

//           // Check for resumable transfer
//           if (await RNFS.exists(tempPath)) {
//             const missingChunks = session.getMissingChunks();
//             if (missingChunks.length > 0) {
//               socket.write(
//                 Buffer.from(
//                   `RESUME:${header.fileId}:${JSON.stringify(missingChunks)}\n`
//                 )
//               );
//             } else {
//               socket.write(Buffer.from(`ACK_FILE:${header.fileId}\n`));
//             }
//           } else {
//             socket.write(Buffer.from(`ACK_FILE:${header.fileId}\n`));
//           }

//           buffer = buffer.slice(headerEnd + 2);
//         } else if (dataStr.startsWith("MSG:")) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) return;
//           const message = buffer.slice(4, messageEnd).toString();
//           setMessages((prev) => [
//             ...prev,
//             `${socket.remoteAddress}: ${message}`,
//           ]);
//           buffer = buffer.slice(messageEnd + 1);
//         } else {
//           socket.write(
//             Buffer.from(
//               `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
//             )
//           );
//           buffer = Buffer.alloc(0);
//         }
//       }

//       if (session) {
//         session.buffer = buffer;
//         transferSessions.set(sessionId, session);
//         if (!session.paused) {
//           socket.resume();
//         }
//       }
//     } catch (error) {
//       const err = DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         "Data processing failed"
//       );
//       socket.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
//       if (session && (await RNFS.exists(session.tempPath))) {
//         await RNFS.unlink(session.tempPath);
//       }
//       transferSessions.delete(sessionId);
//       buffer = Buffer.alloc(0);
//     }
//   }

//   return {
//     sendFilesInHost,
//     sendMessageInHost,
//     receiveFileInHost,
//   };
// };

// export const ClientSharing = () => {
//   async function sendFile(
//     socket: TCPSocket.Socket,
//     fileName: string,
//     filePath: string,
//     username: string,
//     fileId: string,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     try {
//       const stat = await RNFS.stat(filePath);
//       const fileSize = stat.size;
//       const { chunkSize, numChunks: totalChunks } = {
//         chunkSize: CHUNK_SIZE,
//         numChunks: Math.ceil(fileSize / CHUNK_SIZE),
//       };

//       let retries = 0;
//       while (retries < MAX_RETRIES) {
//         try {
//           if (retries > 0) {
//             await new Promise<void>((resolve, reject) => {
//               const timeout = setTimeout(
//                 () =>
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.NETWORK_ERROR,
//                       `Timeout waiting for ACK_RESET`
//                     )
//                   ),
//                 ACK_TIMEOUT
//               );
//               socket.once("data", (data) => {
//                 clearTimeout(timeout);
//                 if (data.toString().startsWith(`ACK_RESET:${fileId}`))
//                   resolve();
//                 else
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.INVALID_HEADER,
//                       `Invalid ACK_RESET`
//                     )
//                   );
//               });
//               socket.write(Buffer.from(`RESET:${fileId}\n`));
//             });
//           }

//           await new Promise<void>((resolve, reject) => {
//             const timeout = setTimeout(
//               () =>
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.NETWORK_ERROR,
//                     `Timeout waiting for ACK_FILE`
//                   )
//                 ),
//               ACK_TIMEOUT
//             );
//             socket.once("data", (data) => {
//               clearTimeout(timeout);
//               if (data.toString().startsWith(`ACK_FILE:${fileId}`)) resolve();
//               else if (data.toString().startsWith(`RESUME:${fileId}`)) {
//                 const missingChunks = JSON.parse(
//                   data.toString().slice(`RESUME:${fileId}:`.length)
//                 );
//                 resolve(); // Proceed to send missing chunks
//               } else {
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.INVALID_HEADER,
//                     `Invalid ACK_FILE`
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
//           });

//           const startTime = Date.now();
//           let sentBytes = 0;
//           let chunkIndex = 0;

//           while (sentBytes < fileSize) {
//             const bytesToRead = Math.min(chunkSize, fileSize - sentBytes);
//             const chunk = await RNFS.read(
//               filePath,
//               bytesToRead,
//               sentBytes,
//               "base64"
//             );
//             const chunkBuffer = Buffer.from(chunk, "base64");
//             const actualChunkSize = chunkBuffer.length;

//             await new Promise<void>((resolve, reject) => {
//               const timeout = setTimeout(
//                 () =>
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.NETWORK_ERROR,
//                       `Timeout waiting for ACK_CHUNK:${chunkIndex}`
//                     )
//                   ),
//                 ACK_TIMEOUT
//               );
//               socket.once("data", (data) => {
//                 clearTimeout(timeout);
//                 if (
//                   data
//                     .toString()
//                     .startsWith(`ACK_CHUNK:${fileId}:${chunkIndex}`)
//                 )
//                   resolve();
//                 else if (data.toString().startsWith("ERROR:"))
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.NETWORK_ERROR,
//                       `Receiver error: ${data.toString()}`
//                     )
//                   );
//                 else
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.INVALID_HEADER,
//                       `Invalid ACK_CHUNK`
//                     )
//                   );
//               });
//               const chunkHeader = Buffer.from(
//                 `CHUNK:${JSON.stringify({
//                   fileId,
//                   chunkIndex,
//                   chunkSize: actualChunkSize,
//                 })}\n\n`
//               );
//               socket.write(Buffer.concat([chunkHeader, chunkBuffer]));
//             });

//             sentBytes += actualChunkSize;
//             const percentage = (sentBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//             const speed = (sentBytes / elapsedTime / 1024).toFixed(2);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== fileId),
//               {
//                 fileId,
//                 fileName,
//                 progress: `${sentBytes}/${fileSize} bytes`,
//                 speed: `${speed} KB/s`,
//                 percentage,
//               },
//             ]);

//             chunkIndex++;
//             await new Promise((resolve) => setTimeout(resolve, 0));
//           }

//           await new Promise<void>((resolve, reject) => {
//             const timeout = setTimeout(
//               () =>
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.NETWORK_ERROR,
//                     `Timeout waiting for ACK_COMPLETE`
//                   )
//                 ),
//               ACK_TIMEOUT
//             );
//             socket.once("data", (data) => {
//               clearTimeout(timeout);
//               if (data.toString().startsWith(`ACK_COMPLETE:${fileId}`)) {
//                 const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//                 const speed = (fileSize / elapsedTime / 1024).toFixed(2);
//                 setTransferProgress?.((prev) => [
//                   ...prev.filter((p) => p.fileId !== fileId),
//                   {
//                     fileId,
//                     fileName,
//                     progress: `${fileSize}/${fileSize} bytes`,
//                     speed: `${speed} KB/s`,
//                     percentage: 100,
//                   },
//                 ]);
//                 resolve();
//               } else if (data.toString().startsWith("ERROR:")) {
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.NETWORK_ERROR,
//                     `Receiver error: ${data.toString()}`
//                   )
//                 );
//               } else {
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.NETWORK_ERROR,
//                     `Invalid ACK_COMPLETE`
//                   )
//                 );
//               }
//             });
//           });

//           break;
//         } catch (error) {
//           retries++;
//           if (retries === MAX_RETRIES) throw error;
//           await new Promise((resolve) => setTimeout(resolve, 1000));
//         }
//       }
//     } catch (error) {
//       throw DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         `Transfer failed: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`
//       );
//     }
//   }

//   async function sendFilesInClient(
//     socket: TCPSocket.Socket | null,
//     files: { filePath: string; fileData: Buffer }[],
//     username: string,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     if (!socket) {
//       Logger.toast("No active socket to send files", "error");
//       return;
//     }

//     for (const { filePath } of files) {
//       const fileName = filePath.split("/").pop() || "unknown";
//       const fileId = `${username}_${fileName}_${Date.now()}`;
//       await sendFile(
//         socket,
//         fileName,
//         filePath,
//         username,
//         fileId,
//         setTransferProgress
//       );
//       Logger.info(`Sent file: ${fileName} from ${username}`);
//     }
//   }

//   function sendMessageInClient(
//     socket: TCPSocket.Socket | null,
//     message: string,
//     username: string
//   ): void {
//     if (!socket) {
//       Logger.toast("No active socket to send message", "error");
//       return;
//     }
//     socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
//     Logger.info(`Sent MSG: ${message}`);
//   }

//   async function receiveFileInClient({
//     client,
//     data,
//     ip,
//     setMessages,
//     setReceivedFiles,
//     setTransferProgress,
//   }: ClientReceiveProps) {
//     const sessionId = `${ip}:${client.remotePort}`;
//     let session = transferSessions.get(sessionId);

//     try {
//       let buffer = session?.buffer || Buffer.alloc(0);
//       buffer = Buffer.concat([buffer, data]);

//       if (buffer.length > MAX_BUFFER_SIZE) {
//         client.pause();
//         session?.pause();
//       }

//       while (buffer.length > 0) {
//         const dataStr = buffer.toString();

//         if (dataStr.startsWith("RESET:")) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) return;
//           const resetFileId = dataStr.slice(6, messageEnd);
//           if (session && (resetFileId === session.fileId || !session.fileId)) {
//             if (await RNFS.exists(session.tempPath)) {
//               await RNFS.unlink(session.tempPath);
//             }
//             transferSessions.delete(sessionId);
//             session = undefined;
//           }
//           client.write(Buffer.from(`ACK_RESET:${resetFileId}\n`));
//           buffer = buffer.slice(messageEnd + 1);
//           continue;
//         }

//         if (session && session.receivedChunks.size < session.totalChunks) {
//           if (dataStr.startsWith("CHUNK:")) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) return;
//             const headerStr = buffer.slice(6, headerEnd).toString();
//             if (!headerStr) {
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 "Empty chunk header"
//               );
//             }
//             let chunkData: {
//               fileId: string;
//               chunkIndex: number;
//               chunkSize: number;
//             };
//             try {
//               chunkData = JSON.parse(headerStr);
//             } catch {
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 "Invalid chunk header"
//               );
//             }

//             const chunkStart = headerEnd + 2;
//             const chunkEnd = chunkStart + chunkData.chunkSize;
//             if (buffer.length < chunkEnd) return;

//             const chunk = buffer.slice(chunkStart, chunkEnd);
//             if (chunk.length !== chunkData.chunkSize) {
//               throw new DropShareError(
//                 ERROR_CODES.CORRUPTED_CHUNK,
//                 `Chunk size mismatch: expected ${chunkData.chunkSize}, received ${chunk.length}`
//               );
//             }

//             await session.writeChunk(chunk, session.receivedChunks.size === 0);
//             session.receivedChunks.add(chunkData.chunkIndex);
//             const progress = session.updateProgress(chunkData.chunkSize);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== session!.fileId),
//               {
//                 fileId: session!.fileId,
//                 fileName: session!.fileName,
//                 ...progress,
//               },
//             ]);

//             client.write(
//               Buffer.from(
//                 `ACK_CHUNK:${session.fileId}:${chunkData.chunkIndex}\n`
//               )
//             );
//             buffer = buffer.slice(chunkEnd);

//             if (session.receivedChunks.size === session.totalChunks) {
//               const sanitizedFileName = session.fileName.replace(
//                 /[^a-zA-Z0-9.-]/g,
//                 "_"
//               );
//               const finalPath = `${SAVE_PATH}/${Date.now()}-${sanitizedFileName}`;
//               await session.finalize(finalPath);
//               setReceivedFiles((prev) => [...prev, finalPath]);
//               client.write(Buffer.from(`ACK_COMPLETE:${session.fileId}\n`));
//               transferSessions.delete(sessionId);
//             }
//           }
//         } else if (dataStr.startsWith("FILE:")) {
//           const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//           if (headerEnd === -1) return;
//           const headerStr = buffer.slice(5, headerEnd).toString();
//           if (!headerStr) {
//             throw new DropShareError(
//               ERROR_CODES.INVALID_HEADER,
//               "Empty file header"
//             );
//           }
//           let header: FileHeader;
//           try {
//             header = JSON.parse(headerStr);
//           } catch {
//             throw new DropShareError(
//               ERROR_CODES.INVALID_HEADER,
//               "Invalid file header"
//             );
//           }

//           if (header.protocolVersion !== PROTOCOL_VERSION) {
//             client.write(
//               Buffer.from(
//                 `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
//               )
//             );
//             buffer = Buffer.alloc(0);
//             return;
//           }

//           if (!checkTransferLimits(header.size, new Map())) {
//             client.write(
//               Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
//             );
//             buffer = Buffer.alloc(0);
//             return;
//           }

//           const fsInfo = await RNFS.getFSInfo();
//           if (fsInfo.freeSpace < header.size) {
//             client.write(
//               Buffer.from(
//                 `ERROR:${ERROR_CODES.DATABASE_WRITE_ERROR}:Insufficient disk space\n`
//               )
//             );
//             buffer = Buffer.alloc(0);
//             return;
//           }

//           const tempPath = `${TEMP_CHUNKS_PATH}/${header.fileId}`;
//           session = new FileTransferSession(header, tempPath);
//           transferSessions.set(sessionId, session);

//           if (await RNFS.exists(tempPath)) {
//             const missingChunks = session.getMissingChunks();
//             if (missingChunks.length > 0) {
//               client.write(
//                 Buffer.from(
//                   `RESUME:${header.fileId}:${JSON.stringify(missingChunks)}\n`
//                 )
//               );
//             } else {
//               client.write(Buffer.from(`ACK_FILE:${header.fileId}\n`));
//             }
//           } else {
//             client.write(Buffer.from(`ACK_FILE:${header.fileId}\n`));
//           }

//           buffer = buffer.slice(headerEnd + 2);
//         } else if (dataStr.startsWith("MSG:")) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) return;
//           const message = buffer.slice(4, messageEnd).toString();
//           setMessages((prev) => [...prev, `Host: ${message}`]);
//           buffer = buffer.slice(messageEnd + 1);
//         } else {
//           client.write(
//             Buffer.from(
//               `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
//             )
//           );
//           buffer = Buffer.alloc(0);
//         }
//       }

//       if (session) {
//         session.buffer = buffer;
//         transferSessions.set(sessionId, session);
//         if (!session.paused) {
//           client.resume();
//         }
//       }
//     } catch (error) {
//       const err = DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         "Data processing failed"
//       );
//       client.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
//       if (session && (await RNFS.exists(session.tempPath))) {
//         await RNFS.unlink(session.tempPath);
//       }
//       transferSessions.delete(sessionId);
//       buffer = Buffer.alloc(0);
//     }
//   }

//   return {
//     sendFilesInClient,
//     sendMessageInClient,
//     receiveFileInClient,
//   };
// };

// import {
//   calculateDynamicChunkDivision,
//   checkTransferLimits,
// } from "../utils/NetworkUtils";
// import ReactNativeBlobUtil from "react-native-blob-util";
// import { Buffer } from "buffer";
// import { Logger } from "../utils/Logger";
// import { DropShareError, ERROR_CODES } from "../utils/Error";
// import TCPSocket from "react-native-tcp-socket";
// import { SAVE_PATH, TEMP_CHUNKS_PATH } from "../utils/FileSystemUtil";
// import {
//   generateAESKey,
//   generateRSAKeyPair,
//   encryptAESKeyWithRSA,
//   decryptAESKeyWithRSA,
//   encryptFileStream,
//   decryptFileStream,
// } from "./Crypto";

// // State variables for file transfer
// const fileTransfers = new Map<string, FileTransfer>();
// let buffer = Buffer.alloc(0);
// let receivingFile = false;
// let chunkCounts: { [fileId: string]: number } = {};
// let fileId = "";
// let fileName = "";
// let fileSize = 0;
// let deviceName = "";
// let startTime = 0;
// let totalChunks = 0;
// let expectedChunkSize = 0;
// let lastLoggedChunkIndex: number | null = null;
// let aesKeyPair: { [fileId: string]: { key: string; iv: string } } = {};
// let rsaKeyPair: { publicKey: string; privateKey: string } | null = null;
// let senderPublicKey: string | null = null; // Store sender's public key

// // Interface for file header
// interface FileHeader {
//   protocolVersion: string;
//   name: string;
//   size: number;
//   sender: string;
//   fileId: string;
//   totalChunks: number;
//   chunkSize: number;
//   encryptedAESKey?: string; // Base64 encoded encrypted AES key
// }

// interface ClientReceiveProps {
//   ip: string;
//   client: TCPSocket.Socket;
//   data: string | Buffer;
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
//   setMessages: React.Dispatch<React.SetStateAction<string[]>>;
//   setTransferProgress?: React.Dispatch<
//     React.SetStateAction<TransferProgress[]>
//   >;
// }

// const MAX_RETRIES = 3;
// const ACK_TIMEOUT = 10000;
// const PROTOCOL_VERSION = "1.0";

// export const ClientSharing = () => {
//   async function sendFile(
//     socket: TCPSocket.Socket,
//     fileName: string,
//     filePath: string,
//     username: string,
//     fileId: string,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     let tempEncryptedPath = "";
//     try {
//       const stat = await ReactNativeBlobUtil.fs.stat(filePath);
//       const fileSize = stat.size;
//       const { chunkSize, numChunks: totalChunks } =
//         calculateDynamicChunkDivision(fileSize);

//       // Generate AES key pair for this file transfer
//       Logger.info(`Generating AES key for ${fileId}`);
//       const { key, iv } = await generateAESKey();
//       aesKeyPair[fileId] = { key, iv };
//       Logger.info(`Generated AES key for ${fileId}`);

//       // Generate RSA key pair if not already generated
//       if (!rsaKeyPair) {
//         Logger.info(`Generating RSA key pair for ${fileId}`);
//         rsaKeyPair = await generateRSAKeyPair(30000); // 30-second timeout
//         Logger.info(`Completed RSA key pair generation for ${fileId}`);
//       } else {
//         Logger.info(`Reusing existing RSA key pair for ${fileId}`);
//       }

//       // Send RSA public key to receiver
//       Logger.info(`Sending PUBKEY for ${fileId}`);
//       await new Promise<void>((resolve, reject) => {
//         const timeout = setTimeout(() => {
//           reject(
//             new DropShareError(
//               ERROR_CODES.NETWORK_ERROR,
//               `Timeout waiting for ACK_PUBKEY`
//             )
//           );
//         }, ACK_TIMEOUT);
//         socket.once("data", (data) => {
//           clearTimeout(timeout);
//           const message = data.toString();
//           Logger.info(`Received for ACK_PUBKEY: ${message}`);
//           if (message.startsWith(`ACK_PUBKEY:${fileId}`)) {
//             resolve();
//           } else {
//             reject(
//               new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 `Invalid ACK_PUBKEY response: ${message}`
//               )
//             );
//           }
//         });
//         socket.write(
//           Buffer.from(`PUBKEY:${fileId}:${rsaKeyPair!.publicKey}\n`)
//         );
//         Logger.info(`Sent PUBKEY for ${fileId}`);
//       });

//       // Encrypt AES key with receiver's public key
//       Logger.info(`Encrypting AES key for ${fileId}`);
//       const encryptedAESKey = await encryptAESKeyWithRSA(
//         key,
//         rsaKeyPair.publicKey
//       );
//       Logger.info(`Encrypted AES key for ${fileId}`);

//       // Stream-encrypt the file
//       tempEncryptedPath = `${TEMP_CHUNKS_PATH}/${fileId}_encrypted`;
//       await ReactNativeBlobUtil.fs.mkdir(TEMP_CHUNKS_PATH).catch(() => {});
//       await encryptFileStream(filePath, key, iv, tempEncryptedPath);
//       const encryptedStat = await ReactNativeBlobUtil.fs.stat(
//         tempEncryptedPath
//       );
//       const encryptedFileSize = encryptedStat.size;

//       let retries = 0;
//       while (retries < MAX_RETRIES) {
//         try {
//           if (retries > 0) {
//             Logger.info(`Sending RESET for ${fileId}, attempt ${retries + 1}`);
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

//           Logger.info(`Sending FILE header for ${fileId}`);
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
//               sender: username,
//               fileId,
//               totalChunks,
//               chunkSize,
//               encryptedAESKey: encryptedAESKey.toString("base64"),
//             };
//             socket.write(Buffer.from(`FILE:${JSON.stringify(header)}\n\n`));
//             Logger.info(`Sent header for ${fileId}: ${JSON.stringify(header)}`);
//           });

//           const startTime = Date.now();
//           let sentBytes = 0;

//           // Send encrypted file in chunks
//           for (let i = 0; i < totalChunks; i++) {
//             const start = i * chunkSize;
//             const actualChunkSize = Math.min(
//               chunkSize,
//               encryptedFileSize - start
//             );
//             const chunk = await ReactNativeBlobUtil.fs.readStream(
//               tempEncryptedPath,
//               "base64",
//               actualChunkSize,
//               start
//             );

//             const chunkData = await new Promise<string>((resolve, reject) => {
//               let data = "";
//               chunk.open();
//               chunk.onData((chunk) => {
//                 data += chunk;
//               });
//               chunk.onEnd(() => {
//                 resolve(data);
//               });
//               chunk.onError((err) => {
//                 reject(err);
//               });
//             });

//             const encryptedChunk = Buffer.from(chunkData, "base64");

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
//                   resolve();
//                 } else {
//                   if (message.startsWith("ERROR:")) {
//                     reject(
//                       new DropShareError(
//                         ERROR_CODES.NETWORK_ERROR,
//                         `Receiver error: ${message}`
//                       )
//                     );
//                   } else {
//                     reject(
//                       new DropShareError(
//                         ERROR_CODES.INVALID_HEADER,
//                         `Invalid ACK_CHUNK response: ${message}`
//                       )
//                     );
//                   }
//                 }
//               });
//               const chunkHeader = Buffer.from(
//                 `CHUNK:${JSON.stringify({
//                   fileId,
//                   chunkIndex: i,
//                   chunkSize: encryptedChunk.length,
//                 })}\n\n`
//               );
//               socket.write(Buffer.concat([chunkHeader, encryptedChunk]));
//               Logger.info(
//                 `Sent chunk ${i}/${totalChunks} for ${fileId} (${encryptedChunk.length} bytes)`
//               );
//             });

//             sentBytes += actualChunkSize;
//             const percentage = (sentBytes / encryptedFileSize) * 100;
//             const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//             const speed = (sentBytes / elapsedTime / 1024).toFixed(2);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== fileId),
//               {
//                 fileId,
//                 fileName,
//                 progress: `${sentBytes}/${encryptedFileSize} bytes`,
//                 speed: `${speed} KB/s`,
//                 percentage,
//               },
//             ]);
//           }

//           Logger.info(`Waiting for ACK_COMPLETE for ${fileId}`);
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
//                 const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//                 const speed = (encryptedFileSize / elapsedTime / 1024).toFixed(
//                   2
//                 );
//                 setTransferProgress?.((prev) => [
//                   ...prev.filter((p) => p.fileId !== fileId),
//                   {
//                     fileId,
//                     fileName,
//                     progress: `${encryptedFileSize}/${encryptedFileSize} bytes`,
//                     speed: `${speed} KB/s`,
//                     percentage: 100,
//                   },
//                 ]);
//                 resolve();
//               } else {
//                 if (message.startsWith("ERROR:")) {
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.NETWORK_ERROR,
//                       `Receiver error: ${message}`
//                     )
//                   );
//                 } else {
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.NETWORK_ERROR,
//                       `Invalid ACK_COMPLETE response: ${message}`
//                     )
//                   );
//                 }
//               }
//             });
//           });
//           break;
//         } catch (error) {
//           retries++;
//           if (retries === MAX_RETRIES) {
//             throw error;
//           }
//           Logger.warn(`Retrying file send for ${fileId} after error ${error}`);
//           await new Promise((resolve) => setTimeout(resolve, 1000));
//         }
//       }
//     } catch (error) {
//       Logger.error(`Failed to send file ${fileName}`, error);
//       throw DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         `File transfer failed: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`
//       );
//     } finally {
//       if (await ReactNativeBlobUtil.fs.exists(tempEncryptedPath)) {
//         await ReactNativeBlobUtil.fs
//           .unlink(tempEncryptedPath)
//           .catch((err) =>
//             Logger.error(`Failed to delete temp file ${tempEncryptedPath}`, err)
//           );
//       }
//       delete aesKeyPair[fileId];
//     }
//   }

//   async function sendFilesInClient(
//     socket: TCPSocket.Socket | null,
//     files: { filePath: string; fileData: Buffer }[],
//     username: string,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     if (!socket) {
//       Logger.toast("No active socket to send files", "error");
//       return;
//     }

//     for (const { filePath } of files) {
//       const fileName = filePath.split("/").pop() || "unknown";
//       const fileId = `${username}_${fileName}_${Date.now()}`;
//       await sendFile(
//         socket,
//         fileName,
//         filePath,
//         username,
//         fileId,
//         setTransferProgress
//       );
//       Logger.info(`Sent file: ${fileName} from ${username}`);
//     }
//   }

//   function sendMessageInClient(
//     socket: TCPSocket.Socket | null,
//     message: string,
//     username: string
//   ): void {
//     if (!socket) {
//       Logger.toast("No active socket to send message", "error");
//       return;
//     }
//     socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
//     Logger.info(`Sent MSG: ${message}`);
//   }

//   async function receiveFileInClient({
//     client,
//     data,
//     ip,
//     setMessages,
//     setReceivedFiles,
//     setTransferProgress,
//   }: ClientReceiveProps) {
//     let tempEncryptedPath = "";
//     try {
//       buffer = Buffer.concat([
//         buffer,
//         typeof data === "string" ? Buffer.from(data) : data,
//       ]);

//       while (buffer.length > 0) {
//         const dataStr = buffer.toString();

//         // Handle PUBKEY messages
//         if (dataStr.startsWith("PUBKEY:")) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) {
//             Logger.info(`Incomplete PUBKEY from host ${ip}, waiting...`);
//             return;
//           }
//           const parts = dataStr.slice(7, messageEnd).split(":", 2);
//           const pubKeyFileId = parts[0];
//           const publicKey = dataStr.slice(
//             7 + pubKeyFileId.length + 1,
//             messageEnd
//           );
//           Logger.info(`Received PUBKEY for fileId ${pubKeyFileId} from ${ip}`);
//           senderPublicKey = publicKey;
//           client.write(Buffer.from(`ACK_PUBKEY:${pubKeyFileId}\n`));
//           Logger.info(`Sent ACK_PUBKEY for ${pubKeyFileId} to ${ip}`);
//           buffer = buffer.slice(messageEnd + 1);
//           continue;
//         }

//         // Handle RESET messages
//         if (dataStr.startsWith("RESET:")) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) {
//             Logger.info(`Incomplete RESET from host ${ip}, waiting...`);
//             return;
//           }
//           const resetFileId = dataStr.slice(6, messageEnd);
//           Logger.info(`Received RESET for fileId ${resetFileId} from ${ip}`);
//           if (resetFileId === fileId || !fileId) {
//             receivingFile = false;
//             chunkCounts[resetFileId] = 0;
//             tempEncryptedPath = `${TEMP_CHUNKS_PATH}/${resetFileId}_encrypted`;
//             if (await ReactNativeBlobUtil.fs.exists(tempEncryptedPath)) {
//               await ReactNativeBlobUtil.fs
//                 .unlink(tempEncryptedPath)
//                 .catch((err) =>
//                   Logger.error(
//                     `Failed to delete temp file ${tempEncryptedPath}`,
//                     err
//                   )
//                 );
//             }
//             fileId = "";
//             fileName = "";
//             fileSize = 0;
//             deviceName = "";
//             totalChunks = 0;
//             expectedChunkSize = 0;
//             delete aesKeyPair[resetFileId];
//             senderPublicKey = null;
//           }
//           client.write(Buffer.from(`ACK_RESET:${resetFileId}\n`));
//           Logger.info(`Sent ACK_RESET for ${resetFileId} to ${ip}`);
//           buffer = buffer.slice(messageEnd + 1);
//           continue;
//         }

//         if (receivingFile) {
//           if (dataStr.startsWith("CHUNK:")) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(
//                 `Incomplete CHUNK header from host ${ip}, waiting...`
//               );
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
//               client.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid chunk header\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             const chunkStart = headerEnd + 2;
//             const chunkEnd = chunkStart + chunkData.chunkSize;

//             if (buffer.length < chunkEnd) {
//               if (lastLoggedChunkIndex !== chunkData.chunkIndex) {
//                 Logger.info(
//                   `Waiting for chunk data for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}, expected ${chunkData.chunkSize} bytes)`
//                 );
//                 lastLoggedChunkIndex = chunkData.chunkIndex;
//               }
//               return;
//             }

//             const encryptedChunk = buffer.slice(chunkStart, chunkEnd);
//             Logger.info(
//               `Received chunk ${chunkData.chunkIndex}/${totalChunks} for ${chunkData.fileId} (${encryptedChunk.length} bytes)`
//             );

//             // Append chunk to temporary encrypted file
//             if (!(await ReactNativeBlobUtil.fs.exists(TEMP_CHUNKS_PATH))) {
//               await ReactNativeBlobUtil.fs.mkdir(TEMP_CHUNKS_PATH);
//             }
//             await ReactNativeBlobUtil.fs.appendFile(
//               tempEncryptedPath,
//               encryptedChunk.toString("base64"),
//               "base64"
//             );

//             chunkCounts[fileId]++;

//             const receivedBytes = chunkCounts[fileId] * expectedChunkSize;
//             const percentage = Math.min(
//               (receivedBytes / (totalChunks * expectedChunkSize)) * 100,
//               100
//             );
//             const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//             const speed = (receivedBytes / elapsedTime / 1024).toFixed(2);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== fileId),
//               {
//                 fileId,
//                 fileName,
//                 progress: `${receivedBytes}/${
//                   totalChunks * expectedChunkSize
//                 } bytes`,
//                 speed: `${speed} KB/s`,
//                 percentage,
//               },
//             ]);

//             client.write(
//               Buffer.from(`ACK_CHUNK:${fileId}:${chunkData.chunkIndex}\n`)
//             );
//             buffer = buffer.slice(chunkEnd);

//             if (chunkCounts[fileId] === totalChunks) {
//               // Decrypt the reassembled encrypted file
//               const finalPath = `${SAVE_PATH}/${fileName.replace(
//                 /[^a-zA-Z0-9.-]/g,
//                 "_"
//               )}`;
//               if (!(await ReactNativeBlobUtil.fs.exists(SAVE_PATH))) {
//                 await ReactNativeBlobUtil.fs.mkdir(SAVE_PATH);
//                 Logger.info(`Created directory ${SAVE_PATH}`);
//               }

//               const { key, iv } = aesKeyPair[fileId];
//               await decryptFileStream(tempEncryptedPath, key, iv, finalPath);

//               setReceivedFiles((prev) => [...prev, finalPath]);
//               Logger.info(
//                 `Received and saved file: ${finalPath} from ${deviceName}`
//               );
//               fileTransfers.delete(fileId);
//               client.write(Buffer.from(`ACK_COMPLETE:${fileId}\n`));

//               // Cleanup
//               if (await ReactNativeBlobUtil.fs.exists(tempEncryptedPath)) {
//                 await ReactNativeBlobUtil.fs
//                   .unlink(tempEncryptedPath)
//                   .catch((err) =>
//                     Logger.error(
//                       `Failed to delete temp file ${tempEncryptedPath}`,
//                       err
//                     )
//                   );
//               }
//               receivingFile = false;
//               delete chunkCounts[fileId];
//               delete aesKeyPair[fileId];
//               fileId = "";
//               fileName = "";
//               fileSize = 0;
//               deviceName = "";
//               totalChunks = 0;
//               expectedChunkSize = 0;
//               senderPublicKey = null;
//             }
//           } else if (dataStr.startsWith("FILE:") && fileId) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(
//                 `Incomplete retransmission FILE header from host ${ip}, waiting...`
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
//               client.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid file header\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             if (headerData.fileId === fileId) {
//               Logger.info(
//                 `Detected retransmission for fileId ${fileId}, resetting state`
//               );
//               receivingFile = false;
//               chunkCounts[fileId] = 0;
//               tempEncryptedPath = `${TEMP_CHUNKS_PATH}/${fileId}_encrypted`;
//               if (await ReactNativeBlobUtil.fs.exists(tempEncryptedPath)) {
//                 await ReactNativeBlobUtil.fs
//                   .unlink(tempEncryptedPath)
//                   .catch((err) =>
//                     Logger.error(
//                       `Failed to delete temp file ${tempEncryptedPath}`,
//                       err
//                     )
//                   );
//               }
//               await ReactNativeBlobUtil.fs.writeFile(
//                 tempEncryptedPath,
//                 "",
//                 "base64"
//               );

//               if (headerData.protocolVersion !== PROTOCOL_VERSION) {
//                 Logger.error(
//                   `Protocol version mismatch for ${fileId}: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
//                 );
//                 client.write(
//                   Buffer.from(
//                     `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
//                   )
//                 );
//                 buffer = Buffer.alloc(0);
//                 return;
//               }

//               fileName = headerData.name;
//               fileSize = headerData.size;
//               deviceName = headerData.sender || "Unknown";
//               totalChunks = headerData.totalChunks;
//               expectedChunkSize = headerData.chunkSize;

//               if (
//                 !fileName ||
//                 !fileSize ||
//                 !fileId ||
//                 !totalChunks ||
//                 !expectedChunkSize ||
//                 !headerData.encryptedAESKey
//               ) {
//                 Logger.error(
//                   `Missing required fields in retransmission FILE header for ${fileId}`
//                 );
//                 client.write(
//                   Buffer.from(
//                     `ERROR:${ERROR_CODES.INVALID_HEADER}:Missing required fields\n`
//                   )
//                 );
//                 buffer = Buffer.alloc(0);
//                 return;
//               }

//               // Decrypt AES key
//               if (!senderPublicKey) {
//                 Logger.error(`Sender public key not received for ${fileId}`);
//                 client.write(
//                   Buffer.from(
//                     `ERROR:${ERROR_CODES.ENCRYPTION_FAILED}:Sender public key not received\n`
//                   )
//                 );
//                 buffer = Buffer.alloc(0);
//                 return;
//               }
//               try {
//                 const aesKey = await decryptAESKeyWithRSA(
//                   Buffer.from(headerData.encryptedAESKey, "base64"),
//                   rsaKeyPair!.privateKey
//                 );
//                 aesKeyPair[fileId] = { key: aesKey, iv: aesKeyPair[fileId].iv };
//               } catch (error) {
//                 Logger.error(`Failed to decrypt AES key for ${fileId}`, error);
//                 client.write(
//                   Buffer.from(
//                     `ERROR:${ERROR_CODES.DECRYPTION_FAILED}:Failed to decrypt AES key\n`
//                   )
//                 );
//                 buffer = Buffer.alloc(0);
//                 return;
//               }

//               const { chunkSize: calculatedChunkSize } =
//                 calculateDynamicChunkDivision(fileSize);
//               if (expectedChunkSize !== calculatedChunkSize) {
//                 Logger.error(
//                   `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//                 );
//                 client.write(
//                   Buffer.from(
//                     `ERROR:${ERROR_CODES.INVALID_HEADER}:Chunk size mismatch\n`
//                   )
//                 );
//                 buffer = Buffer.alloc(0);
//                 return;
//               }

//               if (!checkTransferLimits(fileSize, fileTransfers)) {
//                 client.write(
//                   Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
//                 );
//                 Logger.toast(
//                   `Transfer limit exceeded for ${fileName}`,
//                   "error"
//                 );
//                 buffer = Buffer.alloc(0);
//                 return;
//               }

//               client.write(Buffer.from(`ACK_FILE:${fileId}\n`));
//               buffer = buffer.slice(headerEnd + 2);
//               receivingFile = true;
//               startTime = Date.now();
//             } else {
//               Logger.warn(
//                 `Unexpected FILE header for different fileId ${headerData.fileId} while processing ${fileId}`
//               );
//               buffer = Buffer.alloc(0);
//               client.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Unexpected fileId\n`
//                 )
//               );
//               return;
//             }
//           } else {
//             Logger.warn(
//               `Unexpected data while receiving file for ${fileId} from ${ip}: ${dataStr.slice(
//                 0,
//                 50
//               )}...`
//             );
//             buffer = Buffer.alloc(0);
//             client.write(
//               Buffer.from(
//                 `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
//               )
//             );
//             return;
//           }
//         } else {
//           if (dataStr.startsWith("FILE:")) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(`Incomplete FILE header from host ${ip}, waiting...`);
//               return;
//             }
//             const headerStr = buffer.slice(5, headerEnd).toString();
//             let headerData: FileHeader;
//             try {
//               headerData = JSON.parse(headerStr);
//             } catch (error) {
//               Logger.error(`Failed to parse FILE header: ${headerStr}`, error);
//               client.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid file header\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             if (headerData.protocolVersion !== PROTOCOL_VERSION) {
//               Logger.error(
//                 `Protocol version mismatch for ${headerData.fileId}: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
//               );
//               client.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             fileName = headerData.name;
//             fileSize = headerData.size;
//             fileId = headerData.fileId;
//             deviceName = headerData.sender || "Unknown";
//             totalChunks = headerData.totalChunks;
//             expectedChunkSize = headerData.chunkSize;

//             if (
//               !fileName ||
//               !fileSize ||
//               !fileId ||
//               !totalChunks ||
//               !expectedChunkSize ||
//               !headerData.encryptedAESKey
//             ) {
//               Logger.error(
//                 `Missing required fields in FILE header for ${fileId}`
//               );
//               client.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Missing required fields\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             // Generate RSA key pair if not already generated
//             if (!rsaKeyPair) {
//               Logger.info(`Generating RSA key pair for ${fileId}`);
//               rsaKeyPair = await generateRSAKeyPair(30000);
//               Logger.info(`Completed RSA key pair generation for ${fileId}`);
//             } else {
//               Logger.info(`Reusing existing RSA key pair for ${fileId}`);
//             }

//             // Decrypt AES key
//             if (!senderPublicKey) {
//               Logger.error(`Sender public key not received for ${fileId}`);
//               client.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.ENCRYPTION_FAILED}:Sender public key not received\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }
//             try {
//               const aesKey = await decryptAESKeyWithRSA(
//                 Buffer.from(headerData.encryptedAESKey, "base64"),
//                 rsaKeyPair.privateKey
//               );
//               aesKeyPair[fileId] = { key: aesKey, iv: "" }; // IV will be set later
//             } catch (error) {
//               Logger.error(`Failed to decrypt AES key for ${fileId}`, error);
//               client.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.DECRYPTION_FAILED}:Failed to decrypt AES key\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             const { chunkSize: calculatedChunkSize } =
//               calculateDynamicChunkDivision(fileSize);
//             if (expectedChunkSize !== calculatedChunkSize) {
//               Logger.error(
//                 `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
//               );
//               client.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Chunk size mismatch\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             if (!checkTransferLimits(fileSize, fileTransfers)) {
//               client.write(
//                 Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
//               );
//               Logger.toast(`Transfer limit exceeded for ${fileName}`, "error");
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             tempEncryptedPath = `${TEMP_CHUNKS_PATH}/${fileId}_encrypted`;
//             if (!(await ReactNativeBlobUtil.fs.exists(TEMP_CHUNKS_PATH))) {
//               await ReactNativeBlobUtil.fs.mkdir(TEMP_CHUNKS_PATH);
//             }
//             await ReactNativeBlobUtil.fs.writeFile(
//               tempEncryptedPath,
//               "",
//               "base64"
//             );

//             // Generate IV for this file transfer
//             const { iv } = await generateAESKey();
//             aesKeyPair[fileId].iv = iv;

//             client.write(Buffer.from(`ACK_FILE:${fileId}\n`));
//             buffer = buffer.slice(headerEnd + 2);
//             receivingFile = true;
//             startTime = Date.now();
//           } else if (dataStr.startsWith("MSG:")) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(`Incomplete MSG from host ${ip}, waiting...`);
//               return;
//             }
//             const message = buffer.slice(4, messageEnd).toString();
//             setMessages((prev) => [...prev, `Host: ${message}`]);
//             buffer = buffer.slice(messageEnd + 1);
//           } else if (
//             dataStr.startsWith("ACK_FILE:") ||
//             dataStr.startsWith("ACK_COMPLETE:") ||
//             dataStr.startsWith("ACK_CHUNK:") ||
//             dataStr.startsWith("ACK_PUBKEY:")
//           ) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(
//                 `Incomplete ${dataStr.slice(0, 10)} from host ${ip}, waiting...`
//               );
//               return;
//             }
//             Logger.info(`Processed ${dataStr.slice(0, messageEnd)} from ${ip}`);
//             buffer = buffer.slice(messageEnd + 1);
//           } else {
//             Logger.warn(
//               `Invalid data from host ${ip}: ${dataStr.slice(0, 50)}...`
//             );
//             client.write(
//               Buffer.from(
//                 `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
//               )
//             );
//             buffer = Buffer.alloc(0);
//           }
//         }
//       }
//     } catch (error) {
//       Logger.error(`Error processing data from host ${ip}`, error);
//       const err = DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         `Data processing failed: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`
//       );
//       client.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
//       buffer = Buffer.alloc(0);
//       receivingFile = false;
//       chunkCounts = {};
//       if (await ReactNativeBlobUtil.fs.exists(tempEncryptedPath)) {
//         await ReactNativeBlobUtil.fs
//           .unlink(tempEncryptedPath)
//           .catch((err) =>
//             Logger.error(`Failed to delete temp file ${tempEncryptedPath}`, err)
//           );
//       }
//       fileId = "";
//       fileName = "";
//       fileSize = 0;
//       deviceName = "";
//       totalChunks = 0;
//       expectedChunkSize = 0;
//       delete aesKeyPair[fileId];
//       senderPublicKey = null;
//     }
//   }

//   return {
//     sendFilesInClient,
//     sendMessageInClient,
//     receiveFileInClient,
//   };
// };
