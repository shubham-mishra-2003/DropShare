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

// last working version
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
//   connectedSockets: ConnectedSocket[];
//   setTransferProgress?: React.Dispatch<
//     React.SetStateAction<TransferProgress[]>
//   >;
// }

// interface ClientReceiveProps {
//   ip: string;
//   client: TCPSocket.Socket;
//   data: string | Buffer;
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
//   connectedSockets: ConnectedSocket[];
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

//   function sendMessageInHost(message: string, username: string, connectedSockets: ConnectedSocket[]): void {
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
//     connectedSockets,
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
//     connectedSockets: ConnectedSocket[],
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
//     username: string,
//     connectedSockets: ConnectedSocket[]
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

// tried, not to use this
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

// Try for enhancing the file transfer
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

// interface TransferProgress {
//   fileId: string;
//   fileName: string;
//   progress: string;
//   speed: string;
//   percentage: number;
//   error?: string;
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

// interface ClientReceiveProps {
//   ip: string;
//   client: TCPSocket.Socket;
//   data: string | Buffer;
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
//   connectedSockets: TCPSocket.Socket[];
//   setMessages: React.Dispatch<React.SetStateAction<string[]>>;
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
// const ACK_TIMEOUT = 15000; // Increased for large files
// const PROTOCOL_VERSION = "1.0";

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
//               socket.write(Buffer.from(`RESET:${fileId}\n`));
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
//             socket.write(Buffer.from(`FILE:${JSON.stringify(header)}\n\n`));
//             Logger.info(`Sent header for ${fileId}: ${JSON.stringify(header)}`);
//           });

//           let sentBytes = 0;
//           for (let i = 0; i < totalChunks; i++) {
//             const start = i * chunkSize;
//             const actualChunkSize = Math.min(chunkSize, fileSize - start);
//             const chunk = await RNFS.read(
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
//                   chunkIndex: i,
//                   chunkSize: actualChunkSize,
//                 })}\n\n`
//               );
//               socket.write(Buffer.concat([chunkHeader, Buffer.from(chunk)]));
//               Logger.info(
//                 `Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
//               );
//             });

//             sentBytes += actualChunkSize;
//             const percentage = (sentBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
//             const speed = (sentBytes / elapsedTime / 1024 / 1024).toFixed(2);

//             transfer.receivedBytes = sentBytes;
//             transfer.progress = percentage;
//             transfer.lastChunkIndex = i;
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
//                 const elapsedTime =
//                   (Date.now() - transfer.startTime) / 1000 || 1;
//                 const speed = (fileSize / elapsedTime / 1024 / 1024).toFixed(2);
//                 setTransferProgress?.((prev) => [
//                   ...prev.filter((p) => p.fileId !== fileId),
//                   {
//                     fileId,
//                     fileName,
//                     progress: `${(fileSize / (1024 * 1024)).toFixed(2)}/${(
//                       fileSize /
//                       (1024 * 1024)
//                     ).toFixed(2)} MB`,
//                     speed: `${speed} MB/s`,
//                     percentage: 100,
//                   },
//                 ]);
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
//       Logger.error(`Error in file transfer for ${fileName}`, error);
//       throw err;
//     } finally {
//       if (transfer.status === "Completed" || transfer.status === "Failed") {
//         fileTransfers.delete(fileId);
//       }
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

//   async function receiveFileInHost({
//     data,
//     setMessages,
//     setReceivedFiles,
//     socket,
//     connectedSockets,
//     setTransferProgress,
//   }: HostReceiveProps): Promise<void> {
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
//             const tempPath = `${TEMP_CHUNKS_PATH}/${resetFileId}`;
//             if (await RNFS.exists(tempPath)) {
//               await RNFS.unlink(tempPath).catch((err) =>
//                 Logger.error(`Failed to delete temp file ${tempPath}`, err)
//               );
//             }
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

//             const tempPath = `${TEMP_CHUNKS_PATH}/${chunkData.fileId}`;
//             if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
//               await RNFS.mkdir(TEMP_CHUNKS_PATH);
//             }
//             await RNFS.appendFile(tempPath, base64Chunk, "base64");

//             const transfer = fileTransfers.get(chunkData.fileId);
//             if (transfer) {
//               transfer.chunks[chunkData.chunkIndex] = chunk;
//               transfer.receivedBytes += chunkSize;
//               transfer.progress =
//                 (transfer.receivedBytes / transfer.totalSize) * 100;
//               transfer.lastChunkIndex = chunkData.chunkIndex;
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
//                   await RNFS.moveFile(tempPath, finalPath);
//                   setReceivedFiles((prev) => [...prev, finalPath]);
//                   Logger.info(
//                     `Received and saved file: ${finalPath} from ${transfer.deviceName}`
//                   );
//                   transfer.status = "Completed";
//                   transfer.endTime = Date.now();
//                   socket.write(
//                     Buffer.from(`ACK_COMPLETE:${chunkData.fileId}\n`)
//                   );
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
//               socket.write(Buffer.from(`ACK_FILE:${fileId}\n`));
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
//             socket.write(Buffer.from(`ACK_FILE:${headerData.fileId}\n`));
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
//             buffer = Buffer.alloc(0);
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

//     const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
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
//       chunkHashes: [], // Empty for future use
//       aesKey: undefined, // Reserved for encryption
//       iv: undefined, // Reserved for encryption
//       status: "Receiving",
//       progress: 0,
//       lastChunkIndex: -1,
//     };
//     fileTransfers.set(fileId, transfer);
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
//       aesKey: undefined,
//       iv: undefined,
//       status: "Sending",
//       progress: 0,
//       lastChunkIndex: -1,
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

//           let sentBytes = 0;
//           for (let i = 0; i < totalChunks; i++) {
//             const start = i * chunkSize;
//             const actualChunkSize = Math.min(chunkSize, fileSize - start);
//             const chunk = await RNFS.read(
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
//                   chunkIndex: i,
//                   chunkSize: actualChunkSize,
//                 })}\n\n`
//               );
//               socket.write(Buffer.concat([chunkHeader, Buffer.from(chunk)]));
//               Logger.info(
//                 `Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
//               );
//             });

//             sentBytes += actualChunkSize;
//             const percentage = (sentBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
//             const speed = (sentBytes / elapsedTime / 1024 / 1024).toFixed(2);

//             transfer.receivedBytes = sentBytes;
//             transfer.progress = percentage;
//             transfer.lastChunkIndex = i;
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
//                 transfer.status = "Completed";
//                 transfer.endTime = Date.now();
//                 transfer.progress = 100;
//                 fileTransfers.set(fileId, transfer);
//                 const elapsedTime =
//                   (Date.now() - transfer.startTime) / 1000 || 1;
//                 const speed = (fileSize / elapsedTime / 1024 / 1024).toFixed(2);
//                 setTransferProgress?.((prev) => [
//                   ...prev.filter((p) => p.fileId !== fileId),
//                   {
//                     fileId,
//                     fileName,
//                     progress: `${(fileSize / (1024 * 1024)).toFixed(2)}/${(
//                       fileSize /
//                       (1024 * 1024)
//                     ).toFixed(2)} MB`,
//                     speed: `${speed} MB/s`,
//                     percentage: 100,
//                   },
//                 ]);
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
//       Logger.error(`Failed to send file ${fileName}`, error);
//       throw err;
//     } finally {
//       if (transfer.status === "Completed" || transfer.status === "Failed") {
//         fileTransfers.delete(fileId);
//       }
//     }
//   }

//   async function sendFilesInClient(
//     socket: TCPSocket.Socket | null,
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

//     for (const { filePath } of files) {
//       const fileName = filePath.split("/").pop() ?? "unknown";
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
//     username: string,
//     connectedSockets: TCPSocket.Socket[]
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
//   }: ClientReceiveProps): Promise<void> {
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
//             fileTransfers.delete(resetFileId);
//             const tempPath = `${TEMP_CHUNKS_PATH}/${resetFileId}`;
//             if (await RNFS.exists(tempPath)) {
//               await RNFS.unlink(tempPath).catch((err) =>
//                 Logger.error(`Failed to delete temp file ${tempPath}`, err)
//               );
//             }
//             fileId = "";
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

//             const tempPath = `${TEMP_CHUNKS_PATH}/${chunkData.fileId}`;
//             if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
//               await RNFS.mkdir(TEMP_CHUNKS_PATH);
//             }
//             await RNFS.appendFile(tempPath, base64Chunk, "base64");

//             const transfer = fileTransfers.get(chunkData.fileId);
//             if (transfer) {
//               transfer.chunks[chunkData.chunkIndex] = chunk;
//               transfer.receivedBytes += chunkSize;
//               transfer.progress =
//                 (transfer.receivedBytes / transfer.totalSize) * 100;
//               transfer.lastChunkIndex = chunkData.chunkIndex;
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

//               client.write(
//                 Buffer.from(
//                   `ACK_CHUNK:${chunkData.fileId}:${chunkData.chunkIndex}\n`
//                 )
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
//                   await RNFS.moveFile(tempPath, finalPath);
//                   setReceivedFiles((prev) => [...prev, finalPath]);
//                   Logger.info(
//                     `Received and saved file: ${finalPath} from ${transfer.deviceName}`
//                   );
//                   transfer.status = "Completed";
//                   transfer.endTime = Date.now();
//                   client.write(
//                     Buffer.from(`ACK_COMPLETE:${chunkData.fileId}\n`)
//                   );
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
//               fileTransfers.delete(fileId);
//               const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
//               if (await RNFS.exists(tempPath)) {
//                 await RNFS.unlink(tempPath).catch((err) =>
//                   Logger.error(`Failed to delete temp file ${tempPath}`, err)
//                 );
//               }
//               await initializeFileTransfer(
//                 headerData,
//                 client,
//                 setTransferProgress
//               );
//               client.write(Buffer.from(`ACK_FILE:${fileId}\n`));
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

//             await initializeFileTransfer(
//               headerData,
//               client,
//               setTransferProgress
//             );
//             client.write(Buffer.from(`ACK_FILE:${headerData.fileId}\n`));
//             buffer = buffer.slice(headerEnd + 2);
//             receivingFile = true;
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
//       fileTransfers.delete(fileId);
//       const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
//       if (await RNFS.exists(tempPath)) {
//         await RNFS.unlink(tempPath).catch((err) =>
//           Logger.error(`Failed to delete temp file ${tempPath}`, err)
//         );
//       }
//       fileId = "";
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

//     const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
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
//       chunkHashes: [], // Empty for future use
//       aesKey: undefined, // Reserved for encryption
//       iv: undefined, // Reserved for encryption
//       status: "Receiving",
//       progress: 0,
//       lastChunkIndex: -1,
//     };
//     fileTransfers.set(fileId, transfer);
//   }

//   return {
//     sendFilesInClient,
//     sendMessageInClient,
//     receiveFileInClient,
//   };
// };

// with encryption, previous works for sharing

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
// import { Crypto, EncryptionKeys } from "./Crypto";
// import { ChunkStorage } from "./ChunkStorage";

// // Interfaces
// interface FileHeader {
//   protocolVersion: string;
//   name: string;
//   size: number;
//   sender: string;
//   fileId: string;
//   totalChunks: number;
//   chunkSize: number;
//   publicKey: string;
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
//   endTime?: number;
//   totalChunks: number;
//   chunkSize: number;
//   totalSize: number;
//   chunkHashes: string[];
//   aesKey?: string;
//   iv?: string;
//   status: "Sending" | "Receiving" | "Completed" | "Failed";
//   progress: number;
//   lastChunkIndex: number;
//   error?: string;
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

// interface ClientReceiveProps {
//   ip: string;
//   client: TCPSocket.Socket;
//   data: string | Buffer;
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
//   connectedSockets: TCPSocket.Socket[];
//   setMessages: React.Dispatch<React.SetStateAction<string[]>>;
//   setTransferProgress?: React.Dispatch<
//     React.SetStateAction<TransferProgress[]>
//   >;
// }

// const fileTransfers = new Map<string, FileTransfer>();
// let buffer = Buffer.alloc(0);
// let receivingFile = false;
// let fileId = "";
// let lastLoggedChunkIndex: number | null = null;
// let encryptionKeys: EncryptionKeys | null = null;

// const MAX_RETRIES = 3;
// const ACK_TIMEOUT = 60000; // 60s for large files
// const PROTOCOL_VERSION = "1.2"; // Updated for chunk status
// const CHUNK_BUFFER_SIZE = 64 * 1024; // 64KB, matching calculateDynamicChunkDivision

// // Initialize ChunkStorage
// ChunkStorage.initialize().catch((error) =>
//   Logger.error("Failed to initialize ChunkStorage", error)
// );

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
//       status: "Sending",
//       progress: 0,
//       lastChunkIndex: -1,
//     };
//     fileTransfers.set(fileId, transfer);

//     try {
//       const stat = await RNFS.stat(filePath);
//       const fileSize = stat.size;
//       const { chunkSize, numChunks: totalChunks } =
//         calculateDynamicChunkDivision(fileSize);

//       // Generate encryption keys
//       if (!encryptionKeys) {
//         const { key, iv } = Crypto.generateAESKey();
//         const { publicKey, privateKey } = Crypto.generateRSAKeyPair();
//         encryptionKeys = { aesKey: key, iv, publicKey, privateKey };
//       }

//       // Update FileTransfer
//       transfer = {
//         ...transfer,
//         fileSize,
//         totalChunks,
//         chunkSize,
//         totalSize: fileSize,
//         chunks: new Array(totalChunks).fill(undefined),
//         aesKey: encryptionKeys.aesKey,
//         iv: encryptionKeys.iv,
//       };
//       fileTransfers.set(fileId, transfer);

//       let retries = 0;
//       let startChunkIndex = 0;
//       while (retries < MAX_RETRIES) {
//         try {
//           if (retries > 0 || startChunkIndex > 0) {
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
//               publicKey: encryptionKeys?.publicKey!,
//             };
//             socket.write(Buffer.from(`FILE:${JSON.stringify(header)}\n\n`));
//             Logger.info(`Sent header for ${fileId}: ${JSON.stringify(header)}`);
//           });

//           // Query receiver's chunk status
//           const receivedChunks = await new Promise<number[]>(
//             (resolve, reject) => {
//               const timeout = setTimeout(() => {
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.NETWORK_ERROR,
//                     "Timeout waiting for CHUNK_STATUS"
//                   )
//                 );
//               }, ACK_TIMEOUT);
//               socket.once("data", (data) => {
//                 clearTimeout(timeout);
//                 const message = data.toString();
//                 if (message.startsWith(`CHUNK_STATUS:${fileId}:`)) {
//                   const indexes = JSON.parse(message.split(":")[2]);
//                   resolve(indexes);
//                 } else {
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.INVALID_HEADER,
//                       `Invalid CHUNK_STATUS response: ${message}`
//                     )
//                   );
//                 }
//               });
//               socket.write(Buffer.from(`CHUNK_STATUS:${fileId}\n`));
//             }
//           );
//           startChunkIndex =
//             receivedChunks.length > 0 ? Math.max(...receivedChunks) + 1 : 0;
//           Logger.info(
//             `Receiver has chunks up to ${startChunkIndex - 1} for ${fileId}`
//           );

//           // Receive encrypted AES key
//           const encryptedAESKey = await new Promise<string>(
//             (resolve, reject) => {
//               const timeout = setTimeout(() => {
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.NETWORK_ERROR,
//                     "Timeout waiting for encrypted AES key"
//                   )
//                 );
//               }, ACK_TIMEOUT);
//               socket.once("data", (data) => {
//                 clearTimeout(timeout);
//                 const message = data.toString();
//                 if (message.startsWith(`KEY:${fileId}:`)) {
//                   resolve(message.split(":")[2]);
//                 } else {
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.ENCRYPTION_FAILED,
//                       "Invalid encrypted AES key response"
//                     )
//                   );
//                 }
//               });
//             }
//           );

//           // Decrypt AES key
//           transfer.aesKey = Crypto.decryptAESKeyWithRSA(
//             encryptedAESKey,
//             encryptionKeys.privateKey!
//           );
//           fileTransfers.set(fileId, transfer);

//           let sentBytes = startChunkIndex * chunkSize;
//           for (let i = startChunkIndex; i < totalChunks; i++) {
//             const start = i * chunkSize;
//             const actualChunkSize = Math.min(chunkSize, fileSize - start);
//             const chunk = Buffer.alloc(actualChunkSize);
//             await RNFS.read(filePath, actualChunkSize, start); // Stream read
//             const encryptedChunk = Crypto.encryptChunk(
//               chunk,
//               transfer.aesKey!,
//               transfer.iv!
//             );
//             chunk.fill(0); // Clear buffer

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
//                   chunkIndex: i,
//                   chunkSize: actualChunkSize,
//                 })}\n\n`
//               );
//               socket.write(Buffer.concat([chunkHeader, encryptedChunk]));
//               Logger.info(
//                 `Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
//               );
//             });

//             sentBytes += actualChunkSize;
//             const percentage = (sentBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
//             const speed = (sentBytes / elapsedTime / 1024 / 1024).toFixed(2);

//             transfer.receivedBytes = sentBytes;
//             transfer.progress = percentage;
//             transfer.lastChunkIndex = i;
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
//                 const elapsedTime =
//                   (Date.now() - transfer.startTime) / 1000 || 1;
//                 const speed = (fileSize / elapsedTime / 1024 / 1024).toFixed(2);
//                 setTransferProgress?.((prev) => [
//                   ...prev.filter((p) => p.fileId !== fileId),
//                   {
//                     fileId,
//                     fileName,
//                     progress: `${(fileSize / (1024 * 1024)).toFixed(2)}/${(
//                       fileSize /
//                       (1024 * 1024)
//                     ).toFixed(2)} MB`,
//                     speed: `${speed} MB/s`,
//                     percentage: 100,
//                   },
//                 ]);
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
//       Logger.error(`Error in file transfer for ${fileName}`, error);
//       throw err;
//     } finally {
//       if (transfer.status === "Completed" || transfer.status === "Failed") {
//         fileTransfers.delete(fileId);
//         await ChunkStorage.cleanup(fileId);
//       }
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

//   async function receiveFileInHost({
//     data,
//     setMessages,
//     setReceivedFiles,
//     socket,
//     connectedSockets,
//     setTransferProgress,
//   }: HostReceiveProps): Promise<void> {
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
//             await ChunkStorage.cleanup(resetFileId);
//             fileId = "";
//           }
//           socket.write(Buffer.from(`ACK_RESET:${resetFileId}\n`));
//           buffer = buffer.slice(messageEnd + 1);
//           continue;
//         }

//         if (dataStr.startsWith("CHUNK_STATUS:")) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) {
//             Logger.info(
//               `Incomplete CHUNK_STATUS from ${
//                 socket.remoteAddress ?? "unknown"
//               }, waiting...`
//             );
//             return;
//           }
//           const statusFileId = dataStr.slice(13, messageEnd);
//           const receivedChunks = await ChunkStorage.getReceivedChunkIndexes(
//             statusFileId
//           );
//           socket.write(
//             Buffer.from(
//               `CHUNK_STATUS:${statusFileId}:${JSON.stringify(receivedChunks)}\n`
//             )
//           );
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

//             const encryptedChunk = buffer.slice(chunkStart, chunkEnd);
//             const transfer = fileTransfers.get(chunkData.fileId);
//             if (!transfer || !transfer.aesKey || !transfer.iv) {
//               throw new DropShareError(
//                 ERROR_CODES.ENCRYPTION_FAILED,
//                 "Missing encryption keys"
//               );
//             }

//             const chunk = Crypto.decryptChunk(
//               encryptedChunk,
//               transfer.aesKey,
//               transfer.iv
//             );
//             encryptedChunk.fill(0); // Clear buffer

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

//             await ChunkStorage.storeChunk(
//               chunkData.fileId,
//               chunkData.chunkIndex,
//               chunk,
//               chunkSize
//             );

//             transfer.chunks[chunkData.chunkIndex] = chunk;
//             transfer.receivedBytes += chunkSize;
//             transfer.progress =
//               (transfer.receivedBytes / transfer.totalSize) * 100;
//             transfer.lastChunkIndex = chunkData.chunkIndex;
//             fileTransfers.set(chunkData.fileId, transfer);

//             const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
//             const speed = (
//               transfer.receivedBytes /
//               elapsedTime /
//               1024 /
//               1024
//             ).toFixed(2);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== chunkData.fileId),
//               {
//                 fileId: chunkData.fileId,
//                 fileName: transfer.fileName,
//                 progress: `${(transfer.receivedBytes / (1024 * 1024)).toFixed(
//                   2
//                 )}/${(transfer.totalSize / (1024 * 1024)).toFixed(2)} MB`,
//                 speed: `${speed} MB/s`,
//                 percentage: transfer.progress,
//               },
//             ]);

//             socket.write(
//               Buffer.from(
//                 `ACK_CHUNK:${chunkData.fileId}:${chunkData.chunkIndex}\n`
//               )
//             );
//             buffer = buffer.slice(chunkEnd);

//             if (transfer.receivedBytes === transfer.totalSize) {
//               if (!(await RNFS.exists(SAVE_PATH))) {
//                 await RNFS.mkdir(SAVE_PATH);
//                 Logger.info(`Created directory ${SAVE_PATH}`);
//               }

//               const sanitizedFileName = transfer.fileName.replace(
//                 /[^a-zA-Z0-9.-]/g,
//                 "_"
//               );
//               const finalPath = `${SAVE_PATH}/${sanitizedFileName}`;
//               try {
//                 await ChunkStorage.assembleFile(chunkData.fileId, finalPath);
//                 setReceivedFiles((prev) => [...prev, finalPath]);
//                 Logger.info(
//                   `Received and saved file: ${finalPath} from ${transfer.deviceName}`
//                 );
//                 transfer.status = "Completed";
//                 transfer.endTime = Date.now();
//                 socket.write(Buffer.from(`ACK_COMPLETE:${chunkData.fileId}\n`));
//               } catch (error) {
//                 Logger.error(`Failed to move file to ${finalPath}`, error);
//                 throw new DropShareError(
//                   ERROR_CODES.DATABASE_WRITE_ERROR,
//                   `Failed to save file: ${
//                     error instanceof Error ? error.message : "Unknown error"
//                   }`
//                 );
//               } finally {
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
//               await ChunkStorage.cleanup(fileId);
//               await initializeFileTransfer(
//                 headerData,
//                 socket,
//                 setTransferProgress
//               );
//               socket.write(Buffer.from(`ACK_FILE:${fileId}\n`));
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
//             socket.write(Buffer.from(`ACK_FILE:${headerData.fileId}\n`));

//             // Send encrypted AES key
//             const encryptedAESKey = Crypto.encryptAESKeyWithRSA(
//               encryptionKeys!.aesKey!,
//               headerData.publicKey
//             );
//             socket.write(
//               Buffer.from(`KEY:${headerData.fileId}:${encryptedAESKey}\n`)
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
//             dataStr.startsWith("ACK_CHUNK:") ||
//             dataStr.startsWith("KEY:")
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
//             buffer = Buffer.alloc(0);
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
//       buffer = Buffer.alloc(0);
//       receivingFile = false;
//       fileTransfers.delete(fileId);
//       await ChunkStorage.cleanup(fileId);
//       fileId = "";
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

//     if (!encryptionKeys) {
//       const { key, iv } = Crypto.generateAESKey();
//       const { publicKey, privateKey } = Crypto.generateRSAKeyPair();
//       encryptionKeys = { aesKey: key, iv, publicKey, privateKey };
//     }

//     await ChunkStorage.storeFileMetadata({
//       fileId,
//       fileName,
//       fileSize,
//       totalChunks,
//       chunkSize,
//       lastChunkIndex: -1,
//     });

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
//       aesKey: encryptionKeys.aesKey,
//       iv: encryptionKeys.iv,
//       status: "Receiving",
//       progress: 0,
//       lastChunkIndex: -1,
//     };
//     fileTransfers.set(fileId, transfer);
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
//     };
//     fileTransfers.set(fileId, transfer);

//     try {
//       const stat = await RNFS.stat(filePath);
//       const fileSize = stat.size;
//       const { chunkSize, numChunks: totalChunks } =
//         calculateDynamicChunkDivision(fileSize);

//       if (!encryptionKeys) {
//         const { key, iv } = Crypto.generateAESKey();
//         const { publicKey, privateKey } = Crypto.generateRSAKeyPair();
//         encryptionKeys = { aesKey: key, iv, publicKey, privateKey };
//       }

//       transfer = {
//         ...transfer,
//         fileSize,
//         totalChunks,
//         chunkSize,
//         totalSize: fileSize,
//         chunks: new Array(totalChunks).fill(undefined),
//         aesKey: encryptionKeys.aesKey,
//         iv: encryptionKeys.iv,
//       };
//       fileTransfers.set(fileId, transfer);

//       let retries = 0;
//       let startChunkIndex = 0;
//       while (retries < MAX_RETRIES) {
//         try {
//           if (retries > 0 || startChunkIndex > 0) {
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
//               publicKey: encryptionKeys?.publicKey!,
//             };
//             socket.write(Buffer.from(`FILE:${JSON.stringify(header)}\n\n`));
//             Logger.info(`Sent header for ${fileId}: ${JSON.stringify(header)}`);
//           });

//           const receivedChunks = await new Promise<number[]>(
//             (resolve, reject) => {
//               const timeout = setTimeout(() => {
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.NETWORK_ERROR,
//                     "Timeout waiting for CHUNK_STATUS"
//                   )
//                 );
//               }, ACK_TIMEOUT);
//               socket.once("data", (data) => {
//                 clearTimeout(timeout);
//                 const message = data.toString();
//                 if (message.startsWith(`CHUNK_STATUS:${fileId}:`)) {
//                   const indexes = JSON.parse(message.split(":")[2]);
//                   resolve(indexes);
//                 } else {
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.INVALID_HEADER,
//                       `Invalid CHUNK_STATUS response: ${message}`
//                     )
//                   );
//                 }
//               });
//               socket.write(Buffer.from(`CHUNK_STATUS:${fileId}\n`));
//             }
//           );
//           startChunkIndex =
//             receivedChunks.length > 0 ? Math.max(...receivedChunks) + 1 : 0;
//           Logger.info(
//             `Receiver has chunks up to ${startChunkIndex - 1} for ${fileId}`
//           );

//           const encryptedAESKey = await new Promise<string>(
//             (resolve, reject) => {
//               const timeout = setTimeout(() => {
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.NETWORK_ERROR,
//                     "Timeout waiting for encrypted AES key"
//                   )
//                 );
//               }, ACK_TIMEOUT);
//               socket.once("data", (data) => {
//                 clearTimeout(timeout);
//                 const message = data.toString();
//                 if (message.startsWith(`KEY:${fileId}:`)) {
//                   resolve(message.split(":")[2]);
//                 } else {
//                   reject(
//                     new DropShareError(
//                       ERROR_CODES.ENCRYPTION_FAILED,
//                       "Invalid encrypted AES key response"
//                     )
//                   );
//                 }
//               });
//             }
//           );

//           transfer.aesKey = Crypto.decryptAESKeyWithRSA(
//             encryptedAESKey,
//             encryptionKeys.privateKey!
//           );
//           fileTransfers.set(fileId, transfer);

//           let sentBytes = startChunkIndex * chunkSize;
//           for (let i = startChunkIndex; i < totalChunks; i++) {
//             const start = i * chunkSize;
//             const actualChunkSize = Math.min(chunkSize, fileSize - start);
//             const chunk = Buffer.alloc(actualChunkSize);
//             await RNFS.read(filePath, actualChunkSize, start); // Stream read
//             const encryptedChunk = Crypto.encryptChunk(
//               chunk,
//               transfer.aesKey!,
//               transfer.iv!
//             );
//             chunk.fill(0); // Clear buffer

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
//                   chunkIndex: i,
//                   chunkSize: actualChunkSize,
//                 })}\n\n`
//               );
//               socket.write(Buffer.concat([chunkHeader, encryptedChunk]));
//               Logger.info(
//                 `Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
//               );
//             });

//             sentBytes += actualChunkSize;
//             const percentage = (sentBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
//             const speed = (sentBytes / elapsedTime / 1024 / 1024).toFixed(2);

//             transfer.receivedBytes = sentBytes;
//             transfer.progress = percentage;
//             transfer.lastChunkIndex = i;
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
//                 transfer.status = "Completed";
//                 transfer.endTime = Date.now();
//                 transfer.progress = 100;
//                 fileTransfers.set(fileId, transfer);
//                 const elapsedTime =
//                   (Date.now() - transfer.startTime) / 1000 || 1;
//                 const speed = (fileSize / elapsedTime / 1024 / 1024).toFixed(2);
//                 setTransferProgress?.((prev) => [
//                   ...prev.filter((p) => p.fileId !== fileId),
//                   {
//                     fileId,
//                     fileName,
//                     progress: `${(fileSize / (1024 * 1024)).toFixed(2)}/${(
//                       fileSize /
//                       (1024 * 1024)
//                     ).toFixed(2)} MB`,
//                     speed: `${speed} MB/s`,
//                     percentage: 100,
//                   },
//                 ]);
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
//       Logger.error(`Failed to send file ${fileName}`, error);
//       throw err;
//     } finally {
//       if (transfer.status === "Completed" || transfer.status === "Failed") {
//         fileTransfers.delete(fileId);
//         await ChunkStorage.cleanup(fileId);
//       }
//     }
//   }

//   async function sendFilesInClient(
//     socket: TCPSocket.Socket | null,
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

//     for (const { filePath } of files) {
//       const fileName = filePath.split("/").pop() ?? "unknown";
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
//     username: string,
//     connectedSockets: TCPSocket.Socket[]
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
//   }: ClientReceiveProps): Promise<void> {
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
//             fileTransfers.delete(resetFileId);
//             await ChunkStorage.cleanup(resetFileId);
//             fileId = "";
//           }
//           client.write(Buffer.from(`ACK_RESET:${resetFileId}\n`));
//           buffer = buffer.slice(messageEnd + 1);
//           continue;
//         }

//         if (dataStr.startsWith("CHUNK_STATUS:")) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) {
//             Logger.info(`Incomplete CHUNK_STATUS from host, waiting...`);
//             return;
//           }
//           const statusFileId = dataStr.slice(13, messageEnd);
//           const receivedChunks = await ChunkStorage.getReceivedChunkIndexes(
//             statusFileId
//           );
//           client.write(
//             Buffer.from(
//               `CHUNK_STATUS:${statusFileId}:${JSON.stringify(receivedChunks)}\n`
//             )
//           );
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

//             const encryptedChunk = buffer.slice(chunkStart, chunkEnd);
//             const transfer = fileTransfers.get(chunkData.fileId);
//             if (!transfer || !transfer.aesKey || !transfer.iv) {
//               throw new DropShareError(
//                 ERROR_CODES.ENCRYPTION_FAILED,
//                 "Missing encryption keys"
//               );
//             }

//             const chunk = Crypto.decryptChunk(
//               encryptedChunk,
//               transfer.aesKey,
//               transfer.iv
//             );
//             encryptedChunk.fill(0); // Clear buffer

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

//             await ChunkStorage.storeChunk(
//               chunkData.fileId,
//               chunkData.chunkIndex,
//               chunk,
//               chunkSize
//             );

//             transfer.chunks[chunkData.chunkIndex] = chunk;
//             transfer.receivedBytes += chunkSize;
//             transfer.progress =
//               (transfer.receivedBytes / transfer.totalSize) * 100;
//             transfer.lastChunkIndex = chunkData.chunkIndex;
//             fileTransfers.set(chunkData.fileId, transfer);

//             const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
//             const speed = (
//               transfer.receivedBytes /
//               elapsedTime /
//               1024 /
//               1024
//             ).toFixed(2);

//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== chunkData.fileId),
//               {
//                 fileId: chunkData.fileId,
//                 fileName: transfer.fileName,
//                 progress: `${(transfer.receivedBytes / (1024 * 1024)).toFixed(
//                   2
//                 )}/${(transfer.totalSize / (1024 * 1024)).toFixed(2)} MB`,
//                 speed: `${speed} MB/s`,
//                 percentage: transfer.progress,
//               },
//             ]);

//             client.write(
//               Buffer.from(
//                 `ACK_CHUNK:${chunkData.fileId}:${chunkData.chunkIndex}\n`
//               )
//             );
//             buffer = buffer.slice(chunkEnd);

//             if (transfer.receivedBytes === transfer.totalSize) {
//               if (!(await RNFS.exists(SAVE_PATH))) {
//                 await RNFS.mkdir(SAVE_PATH);
//                 Logger.info(`Created directory ${SAVE_PATH}`);
//               }

//               const sanitizedFileName = transfer.fileName.replace(
//                 /[^a-zA-Z0-9.-]/g,
//                 "_"
//               );
//               const finalPath = `${SAVE_PATH}/${sanitizedFileName}`;
//               try {
//                 await ChunkStorage.assembleFile(chunkData.fileId, finalPath);
//                 setReceivedFiles((prev) => [...prev, finalPath]);
//                 Logger.info(
//                   `Received and saved file: ${finalPath} from ${transfer.deviceName}`
//                 );
//                 transfer.status = "Completed";
//                 transfer.endTime = Date.now();
//                 client.write(Buffer.from(`ACK_COMPLETE:${chunkData.fileId}\n`));
//               } catch (error) {
//                 Logger.error(`Failed to move file to ${finalPath}`, error);
//                 throw new DropShareError(
//                   ERROR_CODES.DATABASE_WRITE_ERROR,
//                   `Failed to save file: ${
//                     error instanceof Error ? error.message : "Unknown error"
//                   }`
//                 );
//               } finally {
//                 fileTransfers.delete(chunkData.fileId);
//                 receivingFile = false;
//                 fileId = "";
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
//               fileTransfers.delete(fileId);
//               await ChunkStorage.cleanup(fileId);
//               await initializeFileTransfer(
//                 headerData,
//                 client,
//                 setTransferProgress
//               );
//               client.write(Buffer.from(`ACK_FILE:${fileId}\n`));
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

//             await initializeFileTransfer(
//               headerData,
//               client,
//               setTransferProgress
//             );
//             client.write(Buffer.from(`ACK_FILE:${headerData.fileId}\n`));

//             const encryptedAESKey = Crypto.encryptAESKeyWithRSA(
//               encryptionKeys!.aesKey!,
//               headerData.publicKey
//             );
//             client.write(
//               Buffer.from(`KEY:${headerData.fileId}:${encryptedAESKey}\n`)
//             );

//             buffer = buffer.slice(headerEnd + 2);
//             receivingFile = true;
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
//             dataStr.startsWith("ACK_CHUNK:") ||
//             dataStr.startsWith("KEY:")
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
//       fileTransfers.delete(fileId);
//       await ChunkStorage.cleanup(fileId);
//       fileId = "";
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

//     if (!encryptionKeys) {
//       const { key, iv } = Crypto.generateAESKey();
//       const { publicKey, privateKey } = Crypto.generateRSAKeyPair();
//       encryptionKeys = { aesKey: key, iv, publicKey, privateKey };
//     }

//     await ChunkStorage.storeFileMetadata({
//       fileId,
//       fileName,
//       fileSize,
//       totalChunks,
//       chunkSize,
//       lastChunkIndex: -1,
//     });

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
//       aesKey: encryptionKeys.aesKey,
//       iv: encryptionKeys.iv,
//       status: "Receiving",
//       progress: 0,
//       lastChunkIndex: -1,
//     };
//     fileTransfers.set(fileId, transfer);
//   }

//   return {
//     sendFilesInClient,
//     sendMessageInClient,
//     receiveFileInClient,
//   };
// };

// without encryption, previous supports encryption but some fails.

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

// last working version
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
//   connectedSockets: ConnectedSocket[];
//   setTransferProgress?: React.Dispatch<
//     React.SetStateAction<TransferProgress[]>
//   >;
// }

// interface ClientReceiveProps {
//   ip: string;
//   client: TCPSocket.Socket;
//   data: string | Buffer;
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
//   connectedSockets: ConnectedSocket[];
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

//   function sendMessageInHost(message: string, username: string, connectedSockets: ConnectedSocket[]): void {
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
//     connectedSockets,
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
//     connectedSockets: ConnectedSocket[],
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
//     username: string,
//     connectedSockets: ConnectedSocket[]
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

// tried, not to use this
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

// interface TransferProgress {
//   fileId: string;
//   fileName: string;
//   progress: string;
//   speed: string;
//   percentage: number;
//   error?: string;
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

// interface ClientReceiveProps {
//   ip: string;
//   client: TCPSocket.Socket;
//   data: string | Buffer;
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
//   connectedSockets: TCPSocket.Socket[];
//   setMessages: React.Dispatch<React.SetStateAction<string[]>>;
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
//               socket.write(Buffer.from(`RESET:${fileId}\n`));
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
//             socket.write(Buffer.from(`FILE:${JSON.stringify(header)}\n\n`));
//             Logger.info(`Sent header for ${fileId}: ${JSON.stringify(header)}`);
//           });

//           let sentBytes = 0;
//           for (let i = 0; i < totalChunks; i++) {
//             const start = i * chunkSize;
//             const actualChunkSize = Math.min(chunkSize, fileSize - start);
//             const chunk = await RNFS.read(
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
//                   chunkIndex: i,
//                   chunkSize: actualChunkSize,
//                 })}\n\n`
//               );
//               socket.write(Buffer.concat([chunkHeader, Buffer.from(chunk)]));
//               Logger.info(
//                 `Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
//               );
//             });

//             sentBytes += actualChunkSize;
//             const percentage = (sentBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
//             const speed = (sentBytes / elapsedTime / 1024 / 1024).toFixed(2);

//             transfer.receivedBytes = sentBytes;
//             transfer.progress = percentage;
//             transfer.lastChunkIndex = i;
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
//                 const elapsedTime =
//                   (Date.now() - transfer.startTime) / 1000 || 1;
//                 const speed = (fileSize / elapsedTime / 1024 / 1024).toFixed(2);
//                 setTransferProgress?.((prev) => [
//                   ...prev.filter((p) => p.fileId !== fileId),
//                   {
//                     fileId,
//                     fileName,
//                     progress: `${(fileSize / (1024 * 1024)).toFixed(2)}/${(
//                       fileSize /
//                       (1024 * 1024)
//                     ).toFixed(2)} MB`,
//                     speed: `${speed} MB/s`,
//                     percentage: 100,
//                   },
//                 ]);
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
//       Logger.error(`Error in file transfer for ${fileName}`, error);
//       throw err;
//     } finally {
//       if (transfer.status === "Completed" || transfer.status === "Failed") {
//         fileTransfers.delete(fileId);
//       }
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

//   async function receiveFileInHost({
//     data,
//     setMessages,
//     setReceivedFiles,
//     socket,
//     connectedSockets,
//     setTransferProgress,
//   }: HostReceiveProps): Promise<void> {
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
//             const tempPath = `${TEMP_CHUNKS_PATH}/${resetFileId}`;
//             if (await RNFS.exists(tempPath)) {
//               await RNFS.unlink(tempPath).catch((err) =>
//                 Logger.error(`Failed to delete temp file ${tempPath}`, err)
//               );
//             }
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

//             const tempPath = `${TEMP_CHUNKS_PATH}/${chunkData.fileId}`;
//             if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
//               await RNFS.mkdir(TEMP_CHUNKS_PATH);
//             }
//             await RNFS.appendFile(tempPath, base64Chunk, "base64");

//             const transfer = fileTransfers.get(chunkData.fileId);
//             if (transfer) {
//               transfer.chunks[chunkData.chunkIndex] = chunk;
//               transfer.receivedBytes += chunkSize;
//               transfer.progress =
//                 (transfer.receivedBytes / transfer.totalSize) * 100;
//               transfer.lastChunkIndex = chunkData.chunkIndex;
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
//                   await RNFS.moveFile(tempPath, finalPath);
//                   setReceivedFiles((prev) => [...prev, finalPath]);
//                   Logger.info(
//                     `Received and saved file: ${finalPath} from ${transfer.deviceName}`
//                   );
//                   transfer.status = "Completed";
//                   transfer.endTime = Date.now();
//                   socket.write(
//                     Buffer.from(`ACK_COMPLETE:${chunkData.fileId}\n`)
//                   );
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
//               socket.write(Buffer.from(`ACK_FILE:${fileId}\n`));
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
//             socket.write(Buffer.from(`ACK_FILE:${headerData.fileId}\n`));
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
//             buffer = Buffer.alloc(0);
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

//     const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
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
//       chunkHashes: [], // Empty for future use
//       aesKey: undefined, // Reserved for encryption
//       iv: undefined, // Reserved for encryption
//       status: "Receiving",
//       progress: 0,
//       lastChunkIndex: -1,
//     };
//     fileTransfers.set(fileId, transfer);
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
//       aesKey: undefined,
//       iv: undefined,
//       status: "Sending",
//       progress: 0,
//       lastChunkIndex: -1,
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

//           let sentBytes = 0;
//           for (let i = 0; i < totalChunks; i++) {
//             const start = i * chunkSize;
//             const actualChunkSize = Math.min(chunkSize, fileSize - start);
//             const chunk = await RNFS.read(
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
//                   chunkIndex: i,
//                   chunkSize: actualChunkSize,
//                 })}\n\n`
//               );
//               socket.write(Buffer.concat([chunkHeader, Buffer.from(chunk)]));
//               Logger.info(
//                 `Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
//               );
//             });

//             sentBytes += actualChunkSize;
//             const percentage = (sentBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
//             const speed = (sentBytes / elapsedTime / 1024 / 1024).toFixed(2);

//             transfer.receivedBytes = sentBytes;
//             transfer.progress = percentage;
//             transfer.lastChunkIndex = i;
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
//                 transfer.status = "Completed";
//                 transfer.endTime = Date.now();
//                 transfer.progress = 100;
//                 fileTransfers.set(fileId, transfer);
//                 const elapsedTime =
//                   (Date.now() - transfer.startTime) / 1000 || 1;
//                 const speed = (fileSize / elapsedTime / 1024 / 1024).toFixed(2);
//                 setTransferProgress?.((prev) => [
//                   ...prev.filter((p) => p.fileId !== fileId),
//                   {
//                     fileId,
//                     fileName,
//                     progress: `${(fileSize / (1024 * 1024)).toFixed(2)}/${(
//                       fileSize /
//                       (1024 * 1024)
//                     ).toFixed(2)} MB`,
//                     speed: `${speed} MB/s`,
//                     percentage: 100,
//                   },
//                 ]);
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
//       Logger.error(`Failed to send file ${fileName}`, error);
//       throw err;
//     } finally {
//       if (transfer.status === "Completed" || transfer.status === "Failed") {
//         fileTransfers.delete(fileId);
//       }
//     }
//   }

//   async function sendFilesInClient(
//     socket: TCPSocket.Socket | null,
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

//     for (const { filePath } of files) {
//       const fileName = filePath.split("/").pop() ?? "unknown";
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
//     username: string,
//     connectedSockets: TCPSocket.Socket[]
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
//   }: ClientReceiveProps): Promise<void> {
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
//             fileTransfers.delete(resetFileId);
//             const tempPath = `${TEMP_CHUNKS_PATH}/${resetFileId}`;
//             if (await RNFS.exists(tempPath)) {
//               await RNFS.unlink(tempPath).catch((err) =>
//                 Logger.error(`Failed to delete temp file ${tempPath}`, err)
//               );
//             }
//             fileId = "";
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

//             const tempPath = `${TEMP_CHUNKS_PATH}/${chunkData.fileId}`;
//             if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
//               await RNFS.mkdir(TEMP_CHUNKS_PATH);
//             }
//             await RNFS.appendFile(tempPath, base64Chunk, "base64");

//             const transfer = fileTransfers.get(chunkData.fileId);
//             if (transfer) {
//               transfer.chunks[chunkData.chunkIndex] = chunk;
//               transfer.receivedBytes += chunkSize;
//               transfer.progress =
//                 (transfer.receivedBytes / transfer.totalSize) * 100;
//               transfer.lastChunkIndex = chunkData.chunkIndex;
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

//               client.write(
//                 Buffer.from(
//                   `ACK_CHUNK:${chunkData.fileId}:${chunkData.chunkIndex}\n`
//                 )
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
//                   await RNFS.moveFile(tempPath, finalPath);
//                   setReceivedFiles((prev) => [...prev, finalPath]);
//                   Logger.info(
//                     `Received and saved file: ${finalPath} from ${transfer.deviceName}`
//                   );
//                   transfer.status = "Completed";
//                   transfer.endTime = Date.now();
//                   client.write(
//                     Buffer.from(`ACK_COMPLETE:${chunkData.fileId}\n`)
//                   );
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
//               fileTransfers.delete(fileId);
//               const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
//               if (await RNFS.exists(tempPath)) {
//                 await RNFS.unlink(tempPath).catch((err) =>
//                   Logger.error(`Failed to delete temp file ${tempPath}`, err)
//                 );
//               }
//               await initializeFileTransfer(
//                 headerData,
//                 client,
//                 setTransferProgress
//               );
//               client.write(Buffer.from(`ACK_FILE:${fileId}\n`));
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

//             await initializeFileTransfer(
//               headerData,
//               client,
//               setTransferProgress
//             );
//             client.write(Buffer.from(`ACK_FILE:${headerData.fileId}\n`));
//             buffer = buffer.slice(headerEnd + 2);
//             receivingFile = true;
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
//       fileTransfers.delete(fileId);
//       const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
//       if (await RNFS.exists(tempPath)) {
//         await RNFS.unlink(tempPath).catch((err) =>
//           Logger.error(`Failed to delete temp file ${tempPath}`, err)
//         );
//       }
//       fileId = "";
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

//     const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
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
//       chunkHashes: [], // Empty for future use
//       aesKey: undefined, // Reserved for encryption
//       iv: undefined, // Reserved for encryption
//       status: "Receiving",
//       progress: 0,
//       lastChunkIndex: -1,
//     };
//     fileTransfers.set(fileId, transfer);
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

// interface ClientReceiveProps {
//   ip: string;
//   client: TCPSocket.Socket;
//   data: string | Buffer;
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
//   connectedSockets: TCPSocket.Socket[];
//   setMessages: React.Dispatch<React.SetStateAction<string[]>>;
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
//               socket.write(Buffer.from(`RESET:${fileId}\n`));
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
//             socket.write(Buffer.from(`FILE:${JSON.stringify(header)}\n\n`));
//             Logger.info(`Sent header for ${fileId}: ${JSON.stringify(header)}`);
//           });

//           let sentBytes = 0;
//           for (let i = 0; i < totalChunks; i++) {
//             const start = i * chunkSize;
//             const actualChunkSize = Math.min(chunkSize, fileSize - start);
//             const chunk = await RNFS.read(
//               filePath,
//               actualChunkSize,
//               start,
//               "base64"
//             );

//             // Send chunk
//             const chunkHeader = Buffer.from(
//               `CHUNK:${JSON.stringify({
//                 fileId,
//                 chunkIndex: i,
//                 chunkSize: actualChunkSize,
//               })}\n\n`
//             );
//             socket.write(Buffer.concat([chunkHeader, Buffer.from(chunk)]));
//             Logger.info(
//               `Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
//             );

//             // Update progress immediately after sending
//             sentBytes += actualChunkSize;
//             const percentage = (sentBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
//             const speed = (sentBytes / elapsedTime / 1024 / 1024).toFixed(2);

//             transfer.receivedBytes = sentBytes;
//             transfer.progress = percentage;
//             transfer.lastChunkIndex = i;
//             fileTransfers.set(fileId, transfer);

//             setTransferProgress?.((prev) => {
//               const updated = prev.filter((p) => p.fileId !== fileId);
//               return [
//                 ...updated,
//                 {
//                   fileId,
//                   fileName,
//                   transferredBytes: sentBytes,
//                   fileSize,
//                   speed: `${speed} MB/s`,
//                   status: "Sending",
//                 },
//               ];
//             });

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
//                 const elapsedTime =
//                   (Date.now() - transfer.startTime) / 1000 || 1;
//                 const speed = (fileSize / elapsedTime / 1024 / 1024).toFixed(2);
//                 setTransferProgress?.((prev) => {
//                   const updated = prev.filter((p) => p.fileId !== fileId);
//                   return [
//                     ...updated,
//                     {
//                       fileId,
//                       fileName,
//                       transferredBytes: fileSize,
//                       fileSize,
//                       speed: `${speed} MB/s`,
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
//             speed: "0 MB/s",
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

//   async function receiveFileInHost({
//     data,
//     setMessages,
//     setReceivedFiles,
//     socket,
//     connectedSockets,
//     setTransferProgress,
//   }: HostReceiveProps): Promise<void> {
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
//             const tempPath = `${TEMP_CHUNKS_PATH}/${resetFileId}`;
//             if (await RNFS.exists(tempPath)) {
//               await RNFS.unlink(tempPath).catch((err) =>
//                 Logger.error(`Failed to delete temp file ${tempPath}`, err)
//               );
//             }
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

//             const tempPath = `${TEMP_CHUNKS_PATH}/${chunkData.fileId}`;
//             if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
//               await RNFS.mkdir(TEMP_CHUNKS_PATH);
//             }
//             await RNFS.appendFile(tempPath, base64Chunk, "base64");

//             const transfer = fileTransfers.get(chunkData.fileId);
//             if (transfer) {
//               transfer.chunks[chunkData.chunkIndex] = chunk;
//               transfer.receivedBytes += chunkSize;
//               transfer.progress =
//                 (transfer.receivedBytes / transfer.totalSize) * 100;
//               transfer.lastChunkIndex = chunkData.chunkIndex;
//               fileTransfers.set(chunkData.fileId, transfer);

//               const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
//               const speed = (
//                 transfer.receivedBytes /
//                 elapsedTime /
//                 1024 /
//                 1024
//               ).toFixed(2);

//               setTransferProgress?.((prev) => {
//                 const updated = prev.filter(
//                   (p) => p.fileId !== chunkData.fileId
//                 );
//                 return [
//                   ...updated,
//                   {
//                     fileId: chunkData.fileId,
//                     fileName: transfer.fileName,
//                     transferredBytes: transfer.receivedBytes,
//                     fileSize: transfer.totalSize,
//                     speed: `${speed} MB/s`,
//                     status: "Receiving",
//                   },
//                 ];
//               });

//               socket.write(
//                 Buffer.from(
//                   `ACK_CHUNK:${chunkData.fileId}:${chunkData.chunkIndex}\n`
//                 )
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
//                   await RNFS.moveFile(tempPath, finalPath);
//                   setReceivedFiles((prev) => [...prev, finalPath]);
//                   Logger.info(
//                     `Received and saved file: ${finalPath} from ${transfer.deviceName}`
//                   );
//                   transfer.status = "Completed";
//                   transfer.endTime = Date.now();
//                   socket.write(
//                     Buffer.from(`ACK_COMPLETE:${chunkData.fileId}\n`)
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
//                         speed: `${speed} MB/s`,
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
//               socket.write(Buffer.from(`ACK_FILE:${fileId}\n`));
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
//             socket.write(Buffer.from(`ACK_FILE:${headerData.fileId}\n`));
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
//             buffer = Buffer.alloc(0);
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
//             speed: "0 MB/s",
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

//     const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
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
//           speed: "0 MB/s",
//           status: "Receiving",
//         },
//       ];
//     });
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
//       aesKey: undefined,
//       iv: undefined,
//       status: "Sending",
//       progress: 0,
//       lastChunkIndex: -1,
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

//           let sentBytes = 0;
//           for (let i = 0; i < totalChunks; i++) {
//             const start = i * chunkSize;
//             const actualChunkSize = Math.min(chunkSize, fileSize - start);
//             const chunk = await RNFS.read(
//               filePath,
//               actualChunkSize,
//               start,
//               "base64"
//             );

//             // Send chunk
//             const chunkHeader = Buffer.from(
//               `CHUNK:${JSON.stringify({
//                 fileId,
//                 chunkIndex: i,
//                 chunkSize: actualChunkSize,
//               })}\n\n`
//             );
//             socket.write(Buffer.concat([chunkHeader, Buffer.from(chunk)]));
//             Logger.info(
//               `Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
//             );

//             // Update progress immediately after sending
//             sentBytes += actualChunkSize;
//             const percentage = (sentBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
//             const speed = (sentBytes / elapsedTime / 1024 / 1024).toFixed(2);

//             transfer.receivedBytes = sentBytes;
//             transfer.progress = percentage;
//             transfer.lastChunkIndex = i;
//             fileTransfers.set(fileId, transfer);

//             setTransferProgress?.((prev) => {
//               const updated = prev.filter((p) => p.fileId !== fileId);
//               return [
//                 ...updated,
//                 {
//                   fileId,
//                   fileName,
//                   transferredBytes: sentBytes,
//                   fileSize,
//                   speed: `${speed} MB/s`,
//                   status: "Sending",
//                 },
//               ];
//             });

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
//                 const elapsedTime =
//                   (Date.now() - transfer.startTime) / 1000 || 1;
//                 const speed = (fileSize / elapsedTime / 1024 / 1024).toFixed(2);
//                 setTransferProgress?.((prev) => {
//                   const updated = prev.filter((p) => p.fileId !== fileId);
//                   return [
//                     ...updated,
//                     {
//                       fileId,
//                       fileName,
//                       transferredBytes: fileSize,
//                       fileSize,
//                       speed: `${speed} MB/s`,
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
//             speed: "0 MB/s",
//             status: "Failed",
//             error: err.message,
//           },
//         ];
//       });
//       Logger.error(`Failed to send file ${fileName}`, error);
//       throw err;
//     } finally {
//       if (transfer.status === "Completed" || transfer.status === "Failed") {
//         fileTransfers.delete(fileId);
//       }
//     }
//   }

//   async function sendFilesInClient(
//     socket: TCPSocket.Socket | null,
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

//     for (const { filePath } of files) {
//       const fileName = filePath.split("/").pop() ?? "unknown";
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
//     username: string,
//     connectedSockets: TCPSocket.Socket[]
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
//   }: ClientReceiveProps): Promise<void> {
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
//             fileTransfers.delete(resetFileId);
//             const tempPath = `${TEMP_CHUNKS_PATH}/${resetFileId}`;
//             if (await RNFS.exists(tempPath)) {
//               await RNFS.unlink(tempPath).catch((err) =>
//                 Logger.error(`Failed to delete temp file ${tempPath}`, err)
//               );
//             }
//             fileId = "";
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

//             const tempPath = `${TEMP_CHUNKS_PATH}/${chunkData.fileId}`;
//             if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
//               await RNFS.mkdir(TEMP_CHUNKS_PATH);
//             }
//             await RNFS.appendFile(tempPath, base64Chunk, "base64");

//             const transfer = fileTransfers.get(chunkData.fileId);
//             if (transfer) {
//               transfer.chunks[chunkData.chunkIndex] = chunk;
//               transfer.receivedBytes += chunkSize;
//               transfer.progress =
//                 (transfer.receivedBytes / transfer.totalSize) * 100;
//               transfer.lastChunkIndex = chunkData.chunkIndex;
//               fileTransfers.set(chunkData.fileId, transfer);

//               const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
//               const speed = (
//                 transfer.receivedBytes /
//                 elapsedTime /
//                 1024 /
//                 1024
//               ).toFixed(2);

//               setTransferProgress?.((prev) => {
//                 const updated = prev.filter(
//                   (p) => p.fileId !== chunkData.fileId
//                 );
//                 return [
//                   ...updated,
//                   {
//                     fileId: chunkData.fileId,
//                     fileName: transfer.fileName,
//                     transferredBytes: transfer.receivedBytes,
//                     fileSize: transfer.totalSize,
//                     speed: `${speed} MB/s`,
//                     status: "Receiving",
//                   },
//                 ];
//               });

//               client.write(
//                 Buffer.from(
//                   `ACK_CHUNK:${chunkData.fileId}:${chunkData.chunkIndex}\n`
//                 )
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
//                   await RNFS.moveFile(tempPath, finalPath);
//                   setReceivedFiles((prev) => [...prev, finalPath]);
//                   Logger.info(
//                     `Received and saved file: ${finalPath} from ${transfer.deviceName}`
//                   );
//                   transfer.status = "Completed";
//                   transfer.endTime = Date.now();
//                   client.write(
//                     Buffer.from(`ACK_COMPLETE:${chunkData.fileId}\n`)
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
//                         speed: `${speed} MB/s`,
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
//               fileTransfers.delete(fileId);
//               const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
//               if (await RNFS.exists(tempPath)) {
//                 await RNFS.unlink(tempPath).catch((err) =>
//                   Logger.error(`Failed to delete temp file ${tempPath}`, err)
//                 );
//               }
//               await initializeFileTransfer(
//                 headerData,
//                 client,
//                 setTransferProgress
//               );
//               client.write(Buffer.from(`ACK_FILE:${fileId}\n`));
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

//             await initializeFileTransfer(
//               headerData,
//               client,
//               setTransferProgress
//             );
//             client.write(Buffer.from(`ACK_FILE:${headerData.fileId}\n`));
//             buffer = buffer.slice(headerEnd + 2);
//             receivingFile = true;
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
//             speed: "0 MB/s",
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

//     const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
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
//           speed: "0 MB/s",
//           status: "Receiving",
//         },
//       ];
//     });
//   }

//   return {
//     sendFilesInClient,
//     sendMessageInClient,
//     receiveFileInClient,
//   };
// };

// working with real time progress

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
  setMessages: React.Dispatch<React.SetStateAction<string[]>>;
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

export const Sharing = (role: "host" | "client") => {
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
              socket.write(Buffer.from(`RESET:${fileId}\n`));
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
            socket.write(Buffer.from(`FILE:${JSON.stringify(header)}\n\n`));
            Logger.info(`Sent header for ${fileId}: ${JSON.stringify(header)}`);
          });

          let sentBytes = 0;
          for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const actualChunkSize = Math.min(chunkSize, fileSize - start);
            const chunk = await RNFS.read(
              filePath,
              actualChunkSize,
              start,
              "base64"
            );

            // Send chunk
            const chunkHeader = Buffer.from(
              `CHUNK:${JSON.stringify({
                fileId,
                chunkIndex: i,
                chunkSize: actualChunkSize,
              })}\n\n`
            );
            socket.write(Buffer.concat([chunkHeader, Buffer.from(chunk)]));
            Logger.info(
              `Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
            );

            // Update progress immediately after sending
            sentBytes += actualChunkSize;
            const percentage = (sentBytes / fileSize) * 100;
            const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
            const speed = (sentBytes / elapsedTime / 1024 / 1024).toFixed(2);

            transfer.receivedBytes = sentBytes;
            transfer.progress = percentage;
            transfer.lastChunkIndex = i;
            fileTransfers.set(fileId, transfer);

            setTransferProgress?.((prev) => {
              const updated = prev.filter((p) => p.fileId !== fileId);
              return [
                ...updated,
                {
                  fileId,
                  fileName,
                  transferredBytes: sentBytes,
                  fileSize,
                  speed: `${speed} MB/s`,
                  status: "Sending",
                },
              ];
            });

            // Wait for ACK
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
                const elapsedTime =
                  (Date.now() - transfer.startTime) / 1000 || 1;
                const speed = (fileSize / elapsedTime / 1024 / 1024).toFixed(2);
                setTransferProgress?.((prev) => {
                  const updated = prev.filter((p) => p.fileId !== fileId);
                  return [
                    ...updated,
                    {
                      fileId,
                      fileName,
                      transferredBytes: fileSize,
                      fileSize,
                      speed: `${speed} MB/s`,
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
            speed: "0 MB/s",
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
    message: string,
    username: string,
    connectedSockets: TCPSocket.Socket[]
  ): void {
    if (!socket) {
      Logger.toast("No active socket to send message", "error");
      return;
    }

    if (role === "host" && Array.isArray(socket)) {
      if (socket.length === 0) {
        Logger.toast("No connected clients to send message", "error");
        return;
      }
      socket.forEach((s) => {
        s.write(Buffer.from(`MSG:${username}: ${message}\n`));
        Logger.info(`Sent MSG to ${s.remoteAddress ?? "unknown"}: ${message}`);
      });
    } else if (role === "client" && !Array.isArray(socket)) {
      socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
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
      buffer = Buffer.concat([
        buffer,
        typeof data === "string" ? Buffer.from(data) : data,
      ]);

      while (buffer.length > 0) {
        const dataStr = buffer.toString();

        if (dataStr.startsWith("RESET:")) {
          const messageEnd = buffer.indexOf(Buffer.from("\n"));
          if (messageEnd === -1) {
            Logger.info(`Incomplete RESET from ${source}, waiting...`);
            return;
          }
          const resetFileId = dataStr.slice(6, messageEnd);
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
          socket.write(Buffer.from(`ACK_RESET:${resetFileId}\n`));
          buffer = buffer.slice(messageEnd + 1);
          continue;
        }

        if (receivingFile) {
          if (dataStr.startsWith("CHUNK:")) {
            const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
            if (headerEnd === -1) {
              Logger.info(`Incomplete CHUNK header from ${source}, waiting...`);
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
            const base64Length = Buffer.from(
              Buffer.alloc(chunkSize).toString("base64")
            ).length;
            const chunkStart = headerEnd + 2;
            const chunkEnd = chunkStart + base64Length;

            if (buffer.length < chunkEnd) {
              if (lastLoggedChunkIndex !== chunkData.chunkIndex) {
                Logger.info(
                  `Waiting for base64 chunk data for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}, expected ${base64Length} bytes)`
                );
                lastLoggedChunkIndex = chunkData.chunkIndex;
              }
              return;
            }

            const base64Chunk = buffer.slice(chunkStart, chunkEnd).toString();
            let chunk: Buffer;
            try {
              chunk = Buffer.from(base64Chunk, "base64");
            } catch (error) {
              Logger.error(
                `Failed to decode base64 chunk for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex})`,
                error
              );
              throw new DropShareError(
                ERROR_CODES.CORRUPTED_CHUNK,
                "Invalid base64 chunk data"
              );
            }

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

            await RNFS.appendFile(tempPath, base64Chunk, "base64");

            const transfer = fileTransfers.get(chunkData.fileId);
            if (transfer) {
              transfer.chunks[chunkData.chunkIndex] = chunk;
              transfer.receivedBytes += chunkSize;
              transfer.progress =
                (transfer.receivedBytes / transfer.totalSize) * 100;
              transfer.lastChunkIndex = chunkData.chunkIndex;
              fileTransfers.set(chunkData.fileId, transfer);

              const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
              const speed = (
                transfer.receivedBytes /
                elapsedTime /
                1024 /
                1024
              ).toFixed(2);

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
                    speed: `${speed} MB/s`,
                    status: "Receiving",
                  },
                ];
              });

              socket.write(
                Buffer.from(
                  `ACK_CHUNK:${chunkData.fileId}:${chunkData.chunkIndex}\n`
                )
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
                  await RNFS.moveFile(tempPath, finalPath);
                  setReceivedFiles((prev) => [...prev, finalPath]);
                  Logger.info(
                    `Received and saved file: ${finalPath} from ${transfer.deviceName}`
                  );
                  transfer.status = "Completed";
                  transfer.endTime = Date.now();
                  socket.write(
                    Buffer.from(`ACK_COMPLETE:${chunkData.fileId}\n`)
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
                        speed: `${speed} MB/s`,
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
          } else if (dataStr.startsWith("FILE:") && fileId) {
            const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
            if (headerEnd === -1) {
              Logger.info(
                `Incomplete retransmission FILE header from ${source}, waiting...`
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
              socket.write(Buffer.from(`ACK_FILE:${fileId}\n`));
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
              Logger.info(`Incomplete FILE header from ${source}, waiting...`);
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
            socket.write(Buffer.from(`ACK_FILE:${headerData.fileId}\n`));
            buffer = buffer.slice(headerEnd + 2);
            receivingFile = true;
          } else if (dataStr.startsWith("MSG:")) {
            const messageEnd = buffer.indexOf(Buffer.from("\n"));
            if (messageEnd === -1) {
              Logger.info(`Incomplete MSG from ${source}, waiting...`);
              return;
            }
            const message = buffer.slice(4, messageEnd).toString();
            setMessages((prev) => [
              ...prev,
              `${role === "host" ? source : "Host"}: ${message}`,
            ]);
            if (role === "host" && connectedSockets) {
              connectedSockets
                .filter((s) => s !== socket)
                .forEach((s) => {
                  s.write(Buffer.from(`MSG:${message}\n`));
                  Logger.info(
                    `Forwarded MSG to ${s.remoteAddress ?? "unknown"}`
                  );
                });
            }
            buffer = buffer.slice(messageEnd + 1);
          } else if (
            dataStr.startsWith("ACK_FILE:") ||
            dataStr.startsWith("ACK_COMPLETE:") ||
            dataStr.startsWith("ACK_CHUNK:")
          ) {
            const messageEnd = buffer.indexOf(Buffer.from("\n"));
            if (messageEnd === -1) {
              Logger.info(
                `Incomplete ${dataStr.slice(0, 10)} from ${source}, waiting...`
              );
              return;
            }
            Logger.info(`Processed ${dataStr.slice(0, messageEnd)}`);
            buffer = buffer.slice(messageEnd + 1);
          } else {
            Logger.warn(
              `Invalid data from ${source}: ${dataStr.slice(0, 50)}...`
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
            speed: "0 MB/s",
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

    const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
    if(!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
        await RNFS.mkdir(TEMP_CHUNKS_PATH)
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
          speed: "0 MB/s",
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

// export const Sharing = (role: "host" | "client") => {
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
//               socket.write(Buffer.from(`RESET:${fileId}\n`));
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
//             socket.write(Buffer.from(`FILE:${JSON.stringify(header)}\n\n`));
//             Logger.info(`Sent header for ${fileId}: ${JSON.stringify(header)}`);
//           });

//           let sentBytes = 0;
//           for (let i = 0; i < totalChunks; i++) {
//             const start = i * chunkSize;
//             const actualChunkSize = Math.min(chunkSize, fileSize - start);
//             const chunk = Buffer.from(
//               await RNFS.read(filePath, actualChunkSize, start)
//             );

//             // Send chunk
//             const chunkHeader = Buffer.from(
//               `CHUNK:${JSON.stringify({
//                 fileId,
//                 chunkIndex: i,
//                 chunkSize: actualChunkSize,
//               })}\n\n`
//             );
//             socket.write(Buffer.concat([chunkHeader, chunk]));
//             Logger.info(
//               `Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
//             );

//             // Update progress immediately after sending
//             sentBytes += actualChunkSize;
//             const percentage = (sentBytes / fileSize) * 100;
//             const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
//             const speed = (sentBytes / elapsedTime / 1024 / 1024).toFixed(2);

//             transfer.receivedBytes = sentBytes;
//             transfer.progress = percentage;
//             transfer.lastChunkIndex = i;
//             fileTransfers.set(fileId, transfer);

//             setTransferProgress?.((prev) => {
//               const updated = prev.filter((p) => p.fileId !== fileId);
//               return [
//                 ...updated,
//                 {
//                   fileId,
//                   fileName,
//                   transferredBytes: sentBytes,
//                   fileSize,
//                   speed: `${speed} MB/s`,
//                   status: "Sending",
//                 },
//               ];
//             });

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
//                 const elapsedTime =
//                   (Date.now() - transfer.startTime) / 1000 || 1;
//                 const speed = (fileSize / elapsedTime / 1024 / 1024).toFixed(2);
//                 setTransferProgress?.((prev) => {
//                   const updated = prev.filter((p) => p.fileId !== fileId);
//                   return [
//                     ...updated,
//                     {
//                       fileId,
//                       fileName,
//                       transferredBytes: fileSize,
//                       fileSize,
//                       speed: `${speed} MB/s`,
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
//             speed: "0 MB/s",
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
//       // Append incoming data to buffer
//       buffer = Buffer.concat([
//         buffer,
//         typeof data === "string" ? Buffer.from(data) : data,
//       ]);
//       Logger.info(
//         `Received ${data.length} bytes from ${source}, buffer length: ${buffer.length}`
//       );

//       while (buffer.length > 0) {
//         // Handle RESET
//         if (buffer.toString("ascii", 0, 6).startsWith("RESET:")) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) {
//             Logger.info(`Incomplete RESET from ${source}, waiting...`);
//             return;
//           }
//           const resetFileId = buffer.toString("ascii", 6, messageEnd);
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
//           socket.write(Buffer.from(`ACK_RESET:${resetFileId}\n`));
//           buffer = buffer.slice(messageEnd + 1);
//           continue;
//         }

//         if (receivingFile) {
//           // Handle CHUNK
//           if (buffer.toString("ascii", 0, 6).startsWith("CHUNK:")) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(`Incomplete CHUNK header from ${source}, waiting...`);
//               return;
//             }
//             const headerStr = buffer.toString("ascii", 6, headerEnd);
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
//               socket.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid chunk header format\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 `Invalid chunk header: ${headerStr}`
//               );
//             }

//             const chunkSize = chunkData.chunkSize;
//             const chunkStart = headerEnd + 2;
//             const chunkEnd = chunkStart + chunkSize;

//             if (buffer.length < chunkEnd) {
//               if (lastLoggedChunkIndex !== chunkData.chunkIndex) {
//                 Logger.info(
//                   `Waiting for chunk data for ${
//                     chunkData.fileId
//                   } (chunkIndex: ${
//                     chunkData.chunkIndex
//                   }, expected ${chunkSize} bytes, have ${
//                     buffer.length - chunkStart
//                   })`
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
//               socket.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.CORRUPTED_CHUNK}:Chunk size mismatch: expected ${chunkSize}, received ${chunk.length}\n`
//                 )
//               );
//               throw new DropShareError(
//                 ERROR_CODES.CORRUPTED_CHUNK,
//                 `Chunk size mismatch: expected ${chunkSize}, received ${chunk.length}`
//               );
//             }

//             Logger.info(
//               `Processed chunk ${chunkData.chunkIndex} for ${chunkData.fileId} (${chunkSize} bytes)`
//             );
//             lastLoggedChunkIndex = null;

//             const tempPath = `${TEMP_CHUNKS_PATH}/${chunkData.fileId}`;
//             if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
//               await RNFS.mkdir(TEMP_CHUNKS_PATH);
//             }
//             await RNFS.appendFile(tempPath, chunk.toString("base64"));

//             const transfer = fileTransfers.get(chunkData.fileId);
//             if (transfer) {
//               transfer.chunks[chunkData.chunkIndex] = chunk;
//               transfer.receivedBytes += chunkSize;
//               transfer.progress =
//                 (transfer.receivedBytes / transfer.totalSize) * 100;
//               transfer.lastChunkIndex = chunkData.chunkIndex;
//               fileTransfers.set(chunkData.fileId, transfer);

//               const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
//               const speed = (
//                 transfer.receivedBytes /
//                 elapsedTime /
//                 1024 /
//                 1024
//               ).toFixed(2);

//               setTransferProgress?.((prev) => {
//                 const updated = prev.filter(
//                   (p) => p.fileId !== chunkData.fileId
//                 );
//                 return [
//                   ...updated,
//                   {
//                     fileId: chunkData.fileId,
//                     fileName: transfer.fileName,
//                     transferredBytes: transfer.receivedBytes,
//                     fileSize: transfer.totalSize,
//                     speed: `${speed} MB/s`,
//                     status: "Receiving",
//                   },
//                 ];
//               });

//               socket.write(
//                 Buffer.from(
//                   `ACK_CHUNK:${chunkData.fileId}:${chunkData.chunkIndex}\n`
//                 )
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
//                   await RNFS.moveFile(tempPath, finalPath);
//                   setReceivedFiles((prev) => [...prev, finalPath]);
//                   Logger.info(
//                     `Received and saved file: ${finalPath} from ${transfer.deviceName}`
//                   );
//                   transfer.status = "Completed";
//                   transfer.endTime = Date.now();
//                   socket.write(
//                     Buffer.from(`ACK_COMPLETE:${chunkData.fileId}\n`)
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
//                         speed: `${speed} MB/s`,
//                         status: "Completed",
//                       },
//                     ];
//                   });
//                 } catch (error) {
//                   Logger.error(`Failed to move file to ${finalPath}`, error);
//                   socket.write(
//                     Buffer.from(
//                       `ERROR:${ERROR_CODES.DATABASE_WRITE_ERROR}:Failed to save file\n`
//                     )
//                   );
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
//           } else if (
//             buffer.toString("ascii", 0, 5).startsWith("FILE:") &&
//             fileId
//           ) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(
//                 `Incomplete retransmission FILE header from ${source}, waiting...`
//               );
//               return;
//             }
//             const headerStr = buffer.toString("ascii", 5, headerEnd);
//             let headerData: FileHeader;
//             try {
//               headerData = JSON.parse(headerStr);
//             } catch (error) {
//               Logger.error(
//                 `Failed to parse retransmission FILE header: ${headerStr}`,
//                 error
//               );
//               socket.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid file header format\n`
//                 )
//               );
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 `Invalid file header: ${headerStr}`
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
//               socket.write(Buffer.from(`ACK_FILE:${fileId}\n`));
//               buffer = buffer.slice(headerEnd + 2);
//               receivingFile = true;
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
//               `Invalid data while receiving file for ${fileId}: first 10 bytes: ${buffer
//                 .slice(0, 10)
//                 .toString("hex")}`
//             );
//             socket.write(
//               Buffer.from(
//                 `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol data\n`
//               )
//             );
//             buffer = Buffer.alloc(0);
//             return;
//           }
//         } else {
//           // Handle FILE
//           if (buffer.toString("ascii", 0, 5).startsWith("FILE:")) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(`Incomplete FILE header from ${source}, waiting...`);
//               return;
//             }
//             const headerStr = buffer.toString("ascii", 5, headerEnd);
//             let headerData: FileHeader;
//             try {
//               headerData = JSON.parse(headerStr);
//             } catch (error) {
//               Logger.error(`Failed to parse FILE header: ${headerStr}`, error);
//               socket.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid file header format\n`
//                 )
//               );
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 `Invalid file header: ${headerStr}`
//               );
//             }

//             await initializeFileTransfer(
//               headerData,
//               socket,
//               setTransferProgress
//             );
//             socket.write(Buffer.from(`ACK_FILE:${headerData.fileId}\n`));
//             buffer = buffer.slice(headerEnd + 2);
//             receivingFile = true;
//           } else if (buffer.toString("ascii", 0, 4).startsWith("MSG:")) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(`Incomplete MSG from ${source}, waiting...`);
//               return;
//             }
//             const message = buffer.toString("ascii", 4, messageEnd);
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
//             buffer.toString("ascii", 0, 9).startsWith("ACK_FILE:") ||
//             buffer.toString("ascii", 0, 12).startsWith("ACK_COMPLETE:") ||
//             buffer.toString("ascii", 0, 10).startsWith("ACK_CHUNK:")
//           ) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(
//                 `Incomplete ACK from ${source}: ${buffer.toString(
//                   "ascii",
//                   0,
//                   10
//                 )}..., waiting...`
//               );
//               return;
//             }
//             Logger.info(
//               `Processed ${buffer.toString(
//                 "ascii",
//                 0,
//                 messageEnd
//               )} from ${source}`
//             );
//             buffer = buffer.slice(messageEnd + 1);
//           } else if (buffer.toString("ascii", 0, 6).startsWith("ERROR:")) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(`Incomplete ERROR from ${source}, waiting...`);
//               return;
//             }
//             const errorMsg = buffer.toString("ascii", 6, messageEnd);
//             Logger.warn(`Received ERROR from ${source}: ${errorMsg}`);
//             buffer = buffer.slice(messageEnd + 1);
//             throw new DropShareError(
//               ERROR_CODES.NETWORK_ERROR,
//               `Receiver reported error: ${errorMsg}`
//             );
//           } else {
//             Logger.warn(
//               `Invalid data from ${source}: first 10 bytes: ${buffer
//                 .slice(0, 10)
//                 .toString("hex")}`
//             );
//             socket.write(
//               Buffer.from(
//                 `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
//               )
//             );
//             buffer = Buffer.alloc(0);
//             return;
//           }
//         }
//       }
//     } catch (error) {
//       Logger.error(`Error processing data from ${source}`, error);
//       const err = DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         `Data processing failed: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`
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
//             speed: "0 MB/s",
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
//           `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}\n`
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
//       socket.write(
//         Buffer.from(
//           `ERROR:${ERROR_CODES.INVALID_HEADER}:Missing file name, size, ID, total chunks, or chunk size\n`
//         )
//       );
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
//         Buffer.from(
//           `ERROR:${ERROR_CODES.INVALID_HEADER}:Chunk size mismatch: expected ${calculatedChunkSize}, received ${chunkSize}\n`
//         )
//       );
//       throw new DropShareError(
//         ERROR_CODES.INVALID_HEADER,
//         `Chunk size mismatch: expected ${calculatedChunkSize}, received ${chunkSize}`
//       );
//     }

//     if (!checkTransferLimits(fileSize, fileTransfers)) {
//       socket.write(
//         Buffer.from(
//           `ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}:Transfer limit exceeded\n`
//         )
//       );
//       Logger.toast(`Transfer limit exceeded for ${fileName}`, "error");
//       buffer = Buffer.alloc(0);
//       throw new DropShareError(
//         ERROR_CODES.TRANSFER_LIMIT_EXCEEDED,
//         `Transfer limit exceeded for ${fileName}`
//       );
//     }

//     const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}`;
//     await RNFS.writeFile(tempPath, "");

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
//           speed: "0 MB/s",
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
