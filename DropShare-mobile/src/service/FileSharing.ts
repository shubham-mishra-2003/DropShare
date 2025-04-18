// // import {
// //   calculateDynamicChunkDivision,
// //   checkTransferLimits,
// // } from "../utils/NetworkUtils";
// // import RNFS from "react-native-fs";
// // import { Buffer } from "buffer";
// // import { Logger } from "../utils/Logger";
// // import { DropShareError, ERROR_CODES } from "../utils/Error";
// // import TCPSocket from "react-native-tcp-socket";
// // import { savePath } from "../utils/FileSystemUtil";

// // const fileTransfers = new Map<string, FileTransfer>();
// // let buffer = Buffer.alloc(0);
// // let receivingFile = false;
// // let fileChunks: { [fileId: string]: Buffer[] } = {};
// // let chunkCounts: { [fileId: string]: number } = {};
// // let fileId = "";
// // let fileName = "";
// // let fileSize = 0;
// // let deviceName = "";
// // let startTime = 0;
// // let totalChunks = 0;
// // let expectedChunkSize = 0;

// // interface FileHeader {
// //   protocolVersion: string;
// //   name: string;
// //   size: number;
// //   sender: string;
// //   fileId: string;
// //   totalChunks: number;
// //   chunkSize: number;
// // }

// // interface HostReceiveProps {
// //   socket: TCPSocket.Socket;
// //   data: string | Buffer;
// //   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
// //   setMessages: React.Dispatch<React.SetStateAction<string[]>>;
// //   setTransferProgress?: React.Dispatch<
// //     React.SetStateAction<TransferProgress[]>
// //   >;
// // }

// // interface ClientReceiveProps {
// //   ip: string;
// //   client: TCPSocket.Socket;
// //   data: string | Buffer;
// //   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
// //   setMessages: React.Dispatch<React.SetStateAction<string[]>>;
// //   setTransferProgress?: React.Dispatch<
// //     React.SetStateAction<TransferProgress[]>
// //   >;
// // }

// // interface ConnectedSocket extends TCPSocket.Socket {}

// // const MAX_RETRIES = 3;
// // const ACK_TIMEOUT = 10000;
// // const PROTOCOL_VERSION = "1.0";
// // let connectedSockets: ConnectedSocket[] = [];

// // function validateHeader(header: FileHeader): string | null {
// //   const requiredFields: (keyof FileHeader)[] = [
// //     "protocolVersion",
// //     "name",
// //     "size",
// //     "sender",
// //     "fileId",
// //     "totalChunks",
// //     "chunkSize",
// //   ];
// //   const missingFields = requiredFields.filter(
// //     (field) => header[field] === undefined || header[field] === null
// //   );
// //   if (missingFields.length > 0) {
// //     return `Missing required fields: ${missingFields.join(", ")}`;
// //   }
// //   if (header.protocolVersion !== PROTOCOL_VERSION) {
// //     return `Invalid protocol version: expected ${PROTOCOL_VERSION}, received ${header.protocolVersion}`;
// //   }
// //   if (typeof header.name !== "string" || header.name.trim() === "") {
// //     return "Invalid or empty file name";
// //   }
// //   if (typeof header.size !== "number" || header.size <= 0) {
// //     return "Invalid file size";
// //   }
// //   if (typeof header.fileId !== "string" || header.fileId.trim() === "") {
// //     return "Invalid or empty file ID";
// //   }
// //   if (
// //     typeof header.totalChunks !== "number" ||
// //     header.totalChunks <= 0 ||
// //     !Number.isInteger(header.totalChunks)
// //   ) {
// //     return "Invalid total chunks";
// //   }
// //   if (typeof header.chunkSize !== "number" || header.chunkSize <= 0) {
// //     return "Invalid chunk size";
// //   }
// //   return null;
// // }

// // export const HostSharing = () => {
// //   async function sendFile(
// //     socket: TCPSocket.Socket,
// //     fileName: string,
// //     filePath: string,
// //     deviceName: string,
// //     fileId: string,
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): Promise<void> {
// //     try {
// //       const fileData = await RNFS.readFile(filePath, "base64");
// //       const fileBuffer = Buffer.from(fileData, "base64");
// //       const fileSize = fileBuffer.length;
// //       const { chunkSize, numChunks: totalChunks } =
// //         calculateDynamicChunkDivision(fileSize);

// //       let retries = 0;
// //       while (retries < MAX_RETRIES) {
// //         try {
// //           // Send file header
// //           await new Promise<void>((resolve, reject) => {
// //             const timeout = setTimeout(() => {
// //               reject(
// //                 new DropShareError(
// //                   ERROR_CODES.NETWORK_ERROR,
// //                   `Timeout waiting for ACK_FILE (attempt ${retries + 1})`
// //                 )
// //               );
// //             }, ACK_TIMEOUT);
// //             socket.once("data", (data) => {
// //               clearTimeout(timeout);
// //               const message = data.toString();
// //               Logger.info(`[Host] Received for ACK_FILE: ${message}`);
// //               if (message.startsWith(`ACK_FILE:${fileId}`)) {
// //                 resolve();
// //               } else {
// //                 reject(
// //                   new DropShareError(
// //                     ERROR_CODES.INVALID_HEADER,
// //                     `Invalid ACK_FILE response: ${message}`
// //                   )
// //                 );
// //               }
// //             });
// //             const header: FileHeader = {
// //               protocolVersion: PROTOCOL_VERSION,
// //               name: fileName,
// //               size: fileSize,
// //               sender: deviceName,
// //               fileId,
// //               totalChunks,
// //               chunkSize,
// //             };
// //             const headerStr = `FILE:${JSON.stringify(header)}\n\n`;
// //             socket.write(Buffer.from(headerStr));
// //             Logger.info(`[Host] Sent header for ${fileId}: ${headerStr}`);
// //           });

// //           const startTime = Date.now();
// //           let sentBytes = 0;

// //           // Send chunks
// //           for (let i = 0; i < totalChunks; i++) {
// //             const start = i * chunkSize;
// //             const chunk = fileBuffer.slice(start, start + chunkSize);
// //             const actualChunkSize = chunk.length;

// //             await new Promise<void>((resolve, reject) => {
// //               const timeout = setTimeout(() => {
// //                 reject(
// //                   new DropShareError(
// //                     ERROR_CODES.NETWORK_ERROR,
// //                     `Timeout waiting for ACK_CHUNK:${i} (attempt ${
// //                       retries + 1
// //                     })`
// //                   )
// //                 );
// //               }, ACK_TIMEOUT);
// //               socket.once("data", (data) => {
// //                 clearTimeout(timeout);
// //                 const message = data.toString();
// //                 Logger.info(`[Host] Received for ACK_CHUNK:${i}: ${message}`);
// //                 if (message.startsWith(`ACK_CHUNK:${fileId}:${i}`)) {
// //                   resolve();
// //                 } else {
// //                   reject(
// //                     new DropShareError(
// //                       ERROR_CODES.INVALID_HEADER,
// //                       `Invalid ACK_CHUNK response: ${message}`
// //                     )
// //                   );
// //                 }
// //               });
// //               const chunkHeader = Buffer.from(
// //                 `CHUNK:${JSON.stringify({
// //                   fileId,
// //                   chunkIndex: i,
// //                   chunkSize: actualChunkSize,
// //                 })}\n\n`
// //               );
// //               socket.write(Buffer.concat([chunkHeader, chunk]));
// //               Logger.info(
// //                 `[Host] Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
// //               );
// //             });

// //             sentBytes += actualChunkSize;
// //             const percentage = (sentBytes / fileSize) * 100;
// //             const elapsedTime = (Date.now() - startTime) / 1000 || 1;
// //             const speed = (sentBytes / elapsedTime / 1024).toFixed(2);

// //             setTransferProgress?.((prev) => [
// //               ...prev.filter((p) => p.fileId !== fileId),
// //               {
// //                 fileId,
// //                 fileName,
// //                 progress: `${sentBytes}/${fileSize} bytes`,
// //                 speed: `${speed} KB/s`,
// //                 percentage,
// //               },
// //             ]);
// //           }

// //           // Wait for final ACK
// //           await new Promise<void>((resolve, reject) => {
// //             const timeout = setTimeout(() => {
// //               reject(
// //                 new DropShareError(
// //                   ERROR_CODES.NETWORK_ERROR,
// //                   `Timeout waiting for ACK_COMPLETE (attempt ${retries + 1})`
// //                 )
// //               );
// //             }, ACK_TIMEOUT);
// //             socket.once("data", (data) => {
// //               clearTimeout(timeout);
// //               const message = data.toString();
// //               Logger.info(`[Host] Received for ACK_COMPLETE: ${message}`);
// //               if (message.startsWith(`ACK_COMPLETE:${fileId}`)) {
// //                 const elapsedTime = (Date.now() - startTime) / 1000 || 1;
// //                 const speed = (fileSize / elapsedTime / 1024).toFixed(2);
// //                 setTransferProgress?.((prev) => [
// //                   ...prev.filter((p) => p.fileId !== fileId),
// //                   {
// //                     fileId,
// //                     fileName,
// //                     progress: `${fileSize}/${fileSize} bytes`,
// //                     speed: `${speed} KB/s`,
// //                     percentage: 100,
// //                   },
// //                 ]);
// //                 resolve();
// //               } else {
// //                 reject(
// //                   new DropShareError(
// //                     ERROR_CODES.NETWORK_ERROR,
// //                     `Invalid ACK_COMPLETE response: ${message}`
// //                   )
// //                 );
// //               }
// //             });
// //           });
// //           break;
// //         } catch (error) {
// //           retries++;
// //           if (retries === MAX_RETRIES) {
// //             throw error;
// //           }
// //           Logger.warn(
// //             `[Host] Retrying file send for ${fileId} after error: ${error}`
// //           );
// //           await new Promise((resolve) => setTimeout(resolve, 1000));
// //         }
// //       }
// //     } catch (error) {
// //       Logger.error(`[Host] Error in file transfer for ${fileName}`, error);
// //       throw DropShareError.from(
// //         error,
// //         ERROR_CODES.NETWORK_ERROR,
// //         `Transfer failed: ${
// //           error instanceof Error ? error.message : "Unknown error"
// //         }`
// //       );
// //     }
// //   }

// //   async function sendHostFile(
// //     server: TCPSocket.Server | TCPSocket.Socket | null,
// //     filePath: string,
// //     fileData: Buffer,
// //     username: string,
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): Promise<void> {
// //     if (!server || connectedSockets.length === 0) {
// //       Logger.toast("No connected clients to send file", "error");
// //       return;
// //     }
// //     const fileName = filePath.split("/").pop() || "unknown";
// //     const fileId = `${Date.now()}-${fileName}`;
// //     const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
// //     await RNFS.writeFile(tempPath, fileData.toString("base64"), "base64");
// //     try {
// //       await Promise.all(
// //         connectedSockets.map((socket) =>
// //           sendFile(
// //             socket,
// //             fileName,
// //             tempPath,
// //             username,
// //             fileId,
// //             setTransferProgress
// //           )
// //         )
// //       );
// //       Logger.info(
// //         `[Host] Sent file: ${fileName} from ${username} to all clients`
// //       );
// //       Logger.toast(`Sent file ${fileName}`, "info");
// //     } catch (error) {
// //       Logger.error(`[Host] Failed to send file ${fileName}`, error);
// //       throw error;
// //     } finally {
// //       await RNFS.unlink(tempPath).catch((err) =>
// //         Logger.error(`[Host] Failed to delete temp file ${tempPath}`, err)
// //       );
// //     }
// //   }

// //   async function sendFilesInHost(
// //     server: TCPSocket.Server | TCPSocket.Socket | null,
// //     files: { filePath: string; fileData: Buffer }[],
// //     username: string,
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): Promise<void> {
// //     if (!server || connectedSockets.length === 0) {
// //       Logger.toast("No connected clients to send files", "error");
// //       return;
// //     }

// //     for (const { filePath, fileData } of files) {
// //       await sendHostFile(
// //         server,
// //         filePath,
// //         fileData,
// //         username,
// //         setTransferProgress
// //       );
// //       Logger.info(
// //         `[Host] Sent file: ${filePath.split("/").pop()} from ${username}`
// //       );
// //     }
// //   }

// //   function sendMessageInHost(message: string, username: string): void {
// //     if (connectedSockets.length === 0) {
// //       Logger.toast("No connected clients to send message", "error");
// //       return;
// //     }

// //     connectedSockets.forEach((socket) => {
// //       socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
// //       Logger.info(`[Host] Sent MSG to ${socket.remoteAddress}: ${message}`);
// //     });
// //   }

// //   async function receiveFileInHost({
// //     socket,
// //     data,
// //     setReceivedFiles,
// //     setMessages,
// //     setTransferProgress,
// //   }: HostReceiveProps) {
// //     try {
// //       if (receivingFile) {
// //         buffer = Buffer.concat([
// //           buffer,
// //           typeof data === "string" ? Buffer.from(data) : data,
// //         ]);

// //         while (buffer.length > 0) {
// //           const dataStr = buffer.toString();
// //           if (dataStr.startsWith("CHUNK:")) {
// //             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
// //             if (headerEnd === -1) {
// //               Logger.info(
// //                 `[Host] Incomplete CHUNK header from client ${socket.remoteAddress}, waiting...`
// //               );
// //               return;
// //             }
// //             const headerStr = buffer.slice(6, headerEnd).toString();
// //             let chunkData: {
// //               fileId: string;
// //               chunkIndex: number;
// //               chunkSize: number;
// //             };
// //             try {
// //               chunkData = JSON.parse(headerStr);
// //             } catch (error) {
// //               Logger.error(
// //                 `[Host] Failed to parse CHUNK header: ${headerStr}`,
// //                 error
// //               );
// //               throw new DropShareError(
// //                 ERROR_CODES.INVALID_HEADER,
// //                 `Invalid chunk header: ${
// //                   error instanceof Error ? error.message : "Unknown error"
// //                 }`
// //               );
// //             }

// //             const chunkSize = chunkData.chunkSize;
// //             const expectedChunkEnd = headerEnd + 2 + chunkSize;

// //             if (buffer.length < expectedChunkEnd) {
// //               Logger.info(
// //                 `[Host] Incomplete chunk data for ${chunkData.fileId}, waiting...`
// //               );
// //               return;
// //             }

// //             const chunk = buffer.slice(headerEnd + 2, expectedChunkEnd);
// //             if (chunk.length !== chunkSize) {
// //               Logger.error(
// //                 `[Host] Chunk size mismatch for ${chunkData.fileId}: expected ${chunkSize}, received ${chunk.length}`
// //               );
// //               throw new DropShareError(
// //                 ERROR_CODES.CORRUPTED_CHUNK,
// //                 `Chunk size mismatch: expected ${chunkSize}, received ${chunk.length}`
// //               );
// //             }

// //             if (!fileChunks[fileId]) {
// //               fileChunks[fileId] = [];
// //               chunkCounts[fileId] = 0;
// //             }
// //             fileChunks[fileId][chunkData.chunkIndex] = chunk;
// //             chunkCounts[fileId]++;

// //             const receivedBytes = Object.values(fileChunks[fileId]).reduce(
// //               (sum, chunk) => sum + (chunk?.length || 0),
// //               0
// //             );
// //             const percentage = (receivedBytes / fileSize) * 100;
// //             const elapsedTime = (Date.now() - startTime) / 1000 || 1;
// //             const speed = (receivedBytes / elapsedTime / 1024).toFixed(2);

// //             setTransferProgress?.((prev) => [
// //               ...prev.filter((p) => p.fileId !== fileId),
// //               {
// //                 fileId,
// //                 fileName,
// //                 progress: `${receivedBytes}/${fileSize} bytes`,
// //                 speed: `${speed} KB/s`,
// //                 percentage,
// //               },
// //             ]);

// //             socket.write(
// //               Buffer.from(`ACK_CHUNK:${fileId}:${chunkData.chunkIndex}\n`)
// //             );
// //             buffer = buffer.slice(expectedChunkEnd);

// //             if (chunkCounts[fileId] === totalChunks) {
// //               // All chunks received, reconstruct file
// //               const fileBuffer = Buffer.concat(
// //                 fileChunks[fileId].filter(Boolean)
// //               );
// //               if (fileBuffer.length !== fileSize) {
// //                 Logger.error(
// //                   `[Host] File size mismatch for ${fileId}: expected ${fileSize}, received ${fileBuffer.length}`
// //                 );
// //                 throw new DropShareError(
// //                   ERROR_CODES.CORRUPTED_CHUNK,
// //                   `File size mismatch: expected ${fileSize}, received ${fileBuffer.length}`
// //                 );
// //               }
// //               await RNFS.writeFile(
// //                 `${savePath}/${fileName}`,
// //                 fileBuffer.toString("base64"),
// //                 "base64"
// //               );
// //               setReceivedFiles((prev) => [...prev, `${savePath}/${fileName}`]);
// //               Logger.info(
// //                 `[Host] Received and saved file: ${savePath}/${fileName} from ${deviceName}`
// //               );
// //               fileTransfers.delete(fileId);
// //               socket.write(Buffer.from(`ACK_COMPLETE:${fileId}\n`));
// //               receivingFile = false;
// //               delete fileChunks[fileId];
// //               delete chunkCounts[fileId];
// //               fileId = "";
// //               fileName = "";
// //               fileSize = 0;
// //               deviceName = "";
// //               totalChunks = 0;
// //               expectedChunkSize = 0;
// //             }
// //           } else {
// //             Logger.warn(
// //               `[Host] Unexpected data while receiving file: ${dataStr.slice(
// //                 0,
// //                 50
// //               )}...`
// //             );
// //             buffer = Buffer.alloc(0);
// //             return;
// //           }
// //         }
// //         return;
// //       }

// //       // Handle protocol messages
// //       buffer = Buffer.concat([
// //         buffer,
// //         typeof data === "string" ? Buffer.from(data) : data,
// //       ]);

// //       while (buffer.length > 0) {
// //         const dataStr = buffer.toString();
// //         if (dataStr.startsWith("FILE:")) {
// //           const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
// //           if (headerEnd === -1) {
// //             Logger.info(
// //               `[Host] Incomplete FILE header from ${socket.remoteAddress}, waiting...`
// //             );
// //             return;
// //           }
// //           const headerStr = buffer.slice(5, headerEnd).toString();
// //           let headerData: FileHeader;
// //           try {
// //             headerData = JSON.parse(headerStr);
// //           } catch (error) {
// //             Logger.error(
// //               `[Host] Failed to parse FILE header: ${headerStr}`,
// //               error
// //             );
// //             socket.write(
// //               Buffer.from(
// //                 `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid JSON format\n`
// //               )
// //             );
// //             buffer = Buffer.alloc(0);
// //             return;
// //           }

// //           // Validate header
// //           const validationError = validateHeader(headerData);
// //           if (validationError) {
// //             Logger.error(
// //               `[Host] Invalid header from ${socket.remoteAddress}: ${validationError}`
// //             );
// //             socket.write(
// //               Buffer.from(
// //                 `ERROR:${ERROR_CODES.INVALID_HEADER}:${validationError}\n`
// //               )
// //             );
// //             buffer = Buffer.alloc(0);
// //             return;
// //           }

// //           fileName = headerData.name;
// //           fileSize = headerData.size;
// //           deviceName = headerData.sender || "Unknown";
// //           fileId = headerData.fileId;
// //           totalChunks = headerData.totalChunks;
// //           expectedChunkSize = headerData.chunkSize;

// //           const { chunkSize: calculatedChunkSize } =
// //             calculateDynamicChunkDivision(fileSize);
// //           if (expectedChunkSize !== calculatedChunkSize) {
// //             const errorMsg = `Chunk size mismatch: expected ${calculatedChunkSize}, received ${expectedChunkSize}`;
// //             Logger.error(`[Host] ${errorMsg} for ${fileId}`);
// //             socket.write(
// //               Buffer.from(`ERROR:${ERROR_CODES.INVALID_HEADER}:${errorMsg}\n`)
// //             );
// //             buffer = Buffer.alloc(0);
// //             return;
// //           }

// //           if (!checkTransferLimits(fileSize, fileTransfers)) {
// //             socket.write(
// //               Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
// //             );
// //             Logger.toast(`Transfer limit exceeded for ${fileName}`, "error");
// //             buffer = Buffer.alloc(0);
// //             return;
// //           }

// //           socket.write(Buffer.from(`ACK_FILE:${fileId}\n`));
// //           buffer = buffer.slice(headerEnd + 2);
// //           receivingFile = true;
// //           startTime = Date.now();
// //         } else if (dataStr.startsWith("MSG:")) {
// //           const messageEnd = buffer.indexOf(Buffer.from("\n"));
// //           if (messageEnd === -1) {
// //             Logger.info(
// //               `[Host] Incomplete MSG from ${socket.remoteAddress}, waiting...`
// //             );
// //             return;
// //           }
// //           const message = buffer.slice(4, messageEnd).toString();
// //           setMessages((prev) => [
// //             ...prev,
// //             `${socket.remoteAddress}: ${message}`,
// //           ]);
// //           connectedSockets
// //             .filter((s) => s !== socket)
// //             .forEach((s) => {
// //               s.write(Buffer.from(`MSG:${message}\n`));
// //               Logger.info(`[Host] Forwarded MSG to ${s.remoteAddress}`);
// //             });
// //           buffer = buffer.slice(messageEnd + 1);
// //         } else if (
// //           dataStr.startsWith("ACK_FILE:") ||
// //           dataStr.startsWith("ACK_COMPLETE:") ||
// //           dataStr.startsWith("ACK_CHUNK:")
// //         ) {
// //           const messageEnd = buffer.indexOf(Buffer.from("\n"));
// //           if (messageEnd === -1) {
// //             Logger.info(
// //               `[Host] Incomplete ${dataStr.slice(0, 10)} from ${
// //                 socket.remoteAddress
// //               }, waiting...`
// //             );
// //             return;
// //           }
// //           Logger.info(`[Host] Processed ${dataStr.slice(0, messageEnd)}`);
// //           buffer = buffer.slice(messageEnd + 1);
// //         } else {
// //           Logger.warn(
// //             `[Host] Invalid data from ${socket.remoteAddress}: ${dataStr.slice(
// //               0,
// //               50
// //             )}...`
// //           );
// //           socket.write(
// //             Buffer.from(
// //               `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
// //             )
// //           );
// //           buffer = Buffer.alloc(0);
// //         }
// //       }
// //     } catch (error) {
// //       Logger.error(
// //         `[Host] Error processing data from ${socket.remoteAddress}`,
// //         error
// //       );
// //       const err = DropShareError.from(
// //         error,
// //         ERROR_CODES.NETWORK_ERROR,
// //         "Data processing failed"
// //       );
// //       socket.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
// //       buffer = Buffer.alloc(0);
// //       receivingFile = false;
// //       fileChunks = {};
// //       chunkCounts = {};
// //     }
// //   }

// //   function validateHeader(header: FileHeader): string | null {
// //     const requiredFields: (keyof FileHeader)[] = [
// //       "protocolVersion",
// //       "name",
// //       "size",
// //       "sender",
// //       "fileId",
// //       "totalChunks",
// //       "chunkSize",
// //     ];
// //     const missingFields = requiredFields.filter(
// //       (field) => header[field] === undefined || header[field] === null
// //     );
// //     if (missingFields.length > 0) {
// //       return `Missing required fields: ${missingFields.join(", ")}`;
// //     }
// //     if (header.protocolVersion !== PROTOCOL_VERSION) {
// //       return `Invalid protocol version: expected ${PROTOCOL_VERSION}, received ${header.protocolVersion}`;
// //     }
// //     if (typeof header.name !== "string" || header.name.trim() === "") {
// //       return "Invalid or empty file name";
// //     }
// //     if (typeof header.size !== "number" || header.size <= 0) {
// //       return "Invalid file size";
// //     }
// //     if (typeof header.fileId !== "string" || header.fileId.trim() === "") {
// //       return "Invalid or empty file ID";
// //     }
// //     if (
// //       typeof header.totalChunks !== "number" ||
// //       header.totalChunks <= 0 ||
// //       !Number.isInteger(header.totalChunks)
// //     ) {
// //       return "Invalid total chunks";
// //     }
// //     if (typeof header.chunkSize !== "number" || header.chunkSize <= 0) {
// //       return "Invalid chunk size";
// //     }
// //     return null;
// //   }

// //   return {
// //     sendFilesInHost,
// //     sendMessageInHost,
// //     receiveFileInHost,
// //   };
// // };

// // export const ClientSharing = () => {
// //   async function sendFile(
// //     socket: TCPSocket.Socket,
// //     fileName: string,
// //     filePath: string,
// //     username: string,
// //     fileId: string,
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): Promise<void> {
// //     try {
// //       const fileData = await RNFS.readFile(filePath, "base64");
// //       const fileBuffer = Buffer.from(fileData, "base64");
// //       const fileSize = fileBuffer.length;
// //       const { chunkSize, numChunks: totalChunks } =
// //         calculateDynamicChunkDivision(fileSize);

// //       let retries = 0;
// //       while (retries < MAX_RETRIES) {
// //         try {
// //           await new Promise<void>((resolve, reject) => {
// //             const timeout = setTimeout(() => {
// //               reject(
// //                 new DropShareError(
// //                   ERROR_CODES.NETWORK_ERROR,
// //                   `Timeout waiting for ACK_FILE (attempt ${retries + 1})`
// //                 )
// //               );
// //             }, ACK_TIMEOUT);
// //             socket.once("data", (data) => {
// //               clearTimeout(timeout);
// //               const message = data.toString();
// //               Logger.info(`[Client] Received for ACK_FILE: ${message}`);
// //               if (message.startsWith(`ACK_FILE:${fileId}`)) {
// //                 resolve();
// //               } else {
// //                 reject(
// //                   new DropShareError(
// //                     ERROR_CODES.INVALID_HEADER,
// //                     `Invalid ACK_FILE response: ${message}`
// //                   )
// //                 );
// //               }
// //             });
// //             const header: FileHeader = {
// //               protocolVersion: PROTOCOL_VERSION,
// //               name: fileName,
// //               size: fileSize,
// //               sender: username,
// //               fileId,
// //               totalChunks,
// //               chunkSize,
// //             };
// //             const headerStr = `FILE:${JSON.stringify(header)}\n\n`;
// //             socket.write(Buffer.from(headerStr));
// //             Logger.info(`[Client] Sent header for ${fileId}: ${headerStr}`);
// //           });

// //           const startTime = Date.now();
// //           let sentBytes = 0;

// //           for (let i = 0; i < totalChunks; i++) {
// //             const start = i * chunkSize;
// //             const chunk = fileBuffer.slice(start, start + chunkSize);
// //             const actualChunkSize = chunk.length;

// //             await new Promise<void>((resolve, reject) => {
// //               const timeout = setTimeout(() => {
// //                 reject(
// //                   new DropShareError(
// //                     ERROR_CODES.NETWORK_ERROR,
// //                     `Timeout waiting for ACK_CHUNK:${i} (attempt ${
// //                       retries + 1
// //                     })`
// //                   )
// //                 );
// //               }, ACK_TIMEOUT);
// //               socket.once("data", (data) => {
// //                 clearTimeout(timeout);
// //                 const message = data.toString();
// //                 Logger.info(`[Client] Received for ACK_CHUNK:${i}: ${message}`);
// //                 if (message.startsWith(`ACK_CHUNK:${fileId}:${i}`)) {
// //                   resolve();
// //                 } else {
// //                   reject(
// //                     new DropShareError(
// //                       ERROR_CODES.INVALID_HEADER,
// //                       `Invalid ACK_CHUNK response: ${message}`
// //                     )
// //                   );
// //                 }
// //               });
// //               const chunkHeader = Buffer.from(
// //                 `CHUNK:${JSON.stringify({
// //                   fileId,
// //                   chunkIndex: i,
// //                   chunkSize: actualChunkSize,
// //                 })}\n\n`
// //               );
// //               socket.write(Buffer.concat([chunkHeader, chunk]));
// //               Logger.info(
// //                 `[Client] Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
// //               );
// //             });

// //             sentBytes += actualChunkSize;
// //             const percentage = (sentBytes / fileSize) * 100;
// //             const elapsedTime = (Date.now() - startTime) / 1000 || 1;
// //             const speed = (sentBytes / elapsedTime / 1024).toFixed(2);

// //             setTransferProgress?.((prev) => [
// //               ...prev.filter((p) => p.fileId !== fileId),
// //               {
// //                 fileId,
// //                 fileName,
// //                 progress: `${sentBytes}/${fileSize} bytes`,
// //                 speed: `${speed} KB/s`,
// //                 percentage,
// //               },
// //             ]);
// //           }

// //           await new Promise<void>((resolve, reject) => {
// //             const timeout = setTimeout(() => {
// //               reject(
// //                 new DropShareError(
// //                   ERROR_CODES.NETWORK_ERROR,
// //                   `Timeout waiting for ACK_COMPLETE (attempt ${retries + 1})`
// //                 )
// //               );
// //             }, ACK_TIMEOUT);
// //             socket.once("data", (data) => {
// //               clearTimeout(timeout);
// //               const message = data.toString();
// //               Logger.info(`[Client] Received for ACK_COMPLETE: ${message}`);
// //               if (message.startsWith(`ACK_COMPLETE:${fileId}`)) {
// //                 const elapsedTime = (Date.now() - startTime) / 1000 || 1;
// //                 const speed = (fileSize / elapsedTime / 1024).toFixed(2);
// //                 setTransferProgress?.((prev) => [
// //                   ...prev.filter((p) => p.fileId !== fileId),
// //                   {
// //                     fileId,
// //                     fileName,
// //                     progress: `${fileSize}/${fileSize} bytes`,
// //                     speed: `${speed} KB/s`,
// //                     percentage: 100,
// //                   },
// //                 ]);
// //                 resolve();
// //               } else {
// //                 reject(
// //                   new DropShareError(
// //                     ERROR_CODES.NETWORK_ERROR,
// //                     `Invalid ACK_COMPLETE response: ${message}`
// //                   )
// //                 );
// //               }
// //             });
// //           });
// //           break;
// //         } catch (error) {
// //           retries++;
// //           if (retries === MAX_RETRIES) {
// //             throw error;
// //           }
// //           Logger.warn(
// //             `[Client] Retrying file send for ${fileId} after error: ${error}`
// //           );
// //           await new Promise((resolve) => setTimeout(resolve, 1000));
// //         }
// //       }
// //     } catch (error) {
// //       Logger.error(`[Client] Failed to send file ${fileName}`, error);
// //       throw DropShareError.from(
// //         error,
// //         ERROR_CODES.NETWORK_ERROR,
// //         "File transfer failed"
// //       );
// //     }
// //   }

// //   async function sendFilesInClient(
// //     socket: TCPSocket.Socket | null,
// //     files: { filePath: string; fileData: Buffer }[],
// //     username: string,
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): Promise<void> {
// //     if (!socket) {
// //       Logger.toast("No active socket to send files", "error");
// //       return;
// //     }

// //     for (const { filePath } of files) {
// //       const fileName = filePath.split("/").pop() || "unknown";
// //       const fileId = `${username}_${fileName}_${Date.now()}`;
// //       await sendFile(
// //         socket,
// //         fileName,
// //         filePath,
// //         username,
// //         fileId,
// //         setTransferProgress
// //       );
// //       Logger.info(`[Client] Sent file: ${fileName} from ${username}`);
// //     }
// //   }

// //   function sendMessageInClient(
// //     socket: TCPSocket.Socket | null,
// //     message: string,
// //     username: string
// //   ): void {
// //     if (!socket) {
// //       Logger.toast("No active socket to send message", "error");
// //       return;
// //     }
// //     socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
// //     Logger.info(`[Client] Sent MSG: ${message}`);
// //   }

// //   async function receiveFileInClient({
// //     ip,
// //     client,
// //     data,
// //     setReceivedFiles,
// //     setMessages,
// //     setTransferProgress,
// //   }: ClientReceiveProps) {
// //     try {
// //       if (receivingFile) {
// //         buffer = Buffer.concat([
// //           buffer,
// //           typeof data === "string" ? Buffer.from(data) : data,
// //         ]);
// //         while (buffer.length > 0) {
// //           const dataStr = buffer.toString();
// //           if (dataStr.startsWith("CHUNK:")) {
// //             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
// //             if (headerEnd === -1) {
// //               Logger.info(
// //                 `[Client] Incomplete CHUNK header from host, waiting...`
// //               );
// //               return;
// //             }
// //             const headerStr = buffer.slice(6, headerEnd).toString();
// //             let chunkData: {
// //               fileId: string;
// //               chunkIndex: number;
// //               chunkSize: number;
// //             };
// //             try {
// //               chunkData = JSON.parse(headerStr);
// //             } catch (error) {
// //               Logger.error(
// //                 `[Client] Failed to parse CHUNK header: ${headerStr}`,
// //                 error
// //               );
// //               throw new DropShareError(
// //                 ERROR_CODES.INVALID_HEADER,
// //                 `Invalid chunk header: ${
// //                   error instanceof Error ? error.message : "Unknown error"
// //                 }`
// //               );
// //             }
// //             const chunkSize = chunkData.chunkSize;
// //             const expectedChunkEnd = headerEnd + 2 + chunkSize;
// //             if (buffer.length < expectedChunkEnd) {
// //               Logger.info(
// //                 `[Client] Incomplete chunk data for ${chunkData.fileId}, waiting...`
// //               );
// //               return;
// //             }
// //             const chunk = buffer.slice(headerEnd + 2, expectedChunkEnd);
// //             if (chunk.length !== chunkSize) {
// //               Logger.error(
// //                 `[Client] Chunk size mismatch for ${chunkData.fileId}: expected ${chunkSize}, received ${chunk.length}`
// //               );
// //               throw new DropShareError(
// //                 ERROR_CODES.CORRUPTED_CHUNK,
// //                 `Chunk size mismatch: expected ${chunkSize}, received ${chunk.length}`
// //               );
// //             }

// //             if (!fileChunks[fileId]) {
// //               fileChunks[fileId] = [];
// //               chunkCounts[fileId] = 0;
// //             }
// //             fileChunks[fileId][chunkData.chunkIndex] = chunk;
// //             chunkCounts[fileId]++;

// //             const receivedBytes = Object.values(fileChunks[fileId]).reduce(
// //               (sum, chunk) => sum + (chunk?.length || 0),
// //               0
// //             );
// //             const percentage = (receivedBytes / fileSize) * 100;
// //             const elapsedTime = (Date.now() - startTime) / 1000 || 1;
// //             const speed = (receivedBytes / elapsedTime / 1024).toFixed(2);

// //             setTransferProgress?.((prev) => [
// //               ...prev.filter((p) => p.fileId !== fileId),
// //               {
// //                 fileId,
// //                 fileName,
// //                 progress: `${receivedBytes}/${fileSize} bytes`,
// //                 speed: `${speed} KB/s`,
// //                 percentage,
// //               },
// //             ]);

// //             client.write(
// //               Buffer.from(`ACK_CHUNK:${fileId}:${chunkData.chunkIndex}\n`)
// //             );
// //             buffer = buffer.slice(expectedChunkEnd);

// //             if (chunkCounts[fileId] === totalChunks) {
// //               const fileBuffer = Buffer.concat(
// //                 fileChunks[fileId].filter(Boolean)
// //               );
// //               if (fileBuffer.length !== fileSize) {
// //                 Logger.error(
// //                   `[Client] File size mismatch for ${fileId}: expected ${fileSize}, received ${fileBuffer.length}`
// //                 );
// //                 throw new DropShareError(
// //                   ERROR_CODES.CORRUPTED_CHUNK,
// //                   `File size mismatch: expected ${fileSize}, received ${fileBuffer.length}`
// //                 );
// //               }
// //               await RNFS.writeFile(
// //                 `${savePath}/${fileName}`,
// //                 fileBuffer.toString("base64"),
// //                 "base64"
// //               );
// //               setReceivedFiles((prev) => [...prev, `${savePath}/${fileName}`]);
// //               Logger.info(
// //                 `[Client] Received and saved file: ${savePath}/${fileName} from ${deviceName}`
// //               );
// //               fileTransfers.delete(fileId);
// //               client.write(Buffer.from(`ACK_COMPLETE:${fileId}\n`));
// //               receivingFile = false;
// //               delete fileChunks[fileId];
// //               delete chunkCounts[fileId];
// //               fileId = "";
// //               fileName = "";
// //               fileSize = 0;
// //               deviceName = "";
// //               totalChunks = 0;
// //               expectedChunkSize = 0;
// //             }
// //           } else {
// //             Logger.warn(
// //               `[Client] Unexpected data while receiving file: ${dataStr.slice(
// //                 0,
// //                 50
// //               )}...`
// //             );
// //             buffer = Buffer.alloc(0);
// //             return;
// //           }
// //         }
// //         return;
// //       }

// //       buffer = Buffer.concat([
// //         buffer,
// //         typeof data === "string" ? Buffer.from(data) : data,
// //       ]);
// //       while (buffer.length > 0) {
// //         const dataStr = buffer.toString();
// //         if (dataStr.startsWith("FILE:")) {
// //           const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
// //           if (headerEnd === -1) {
// //             Logger.info(
// //               `[Client] Incomplete FILE header from host, waiting...`
// //             );
// //             return;
// //           }
// //           const headerStr = buffer.slice(5, headerEnd).toString();
// //           let headerData: FileHeader;
// //           try {
// //             headerData = JSON.parse(headerStr);
// //           } catch (error) {
// //             Logger.error(
// //               `[Client] Failed to parse FILE header: ${headerStr}`,
// //               error
// //             );
// //             client.write(
// //               Buffer.from(
// //                 `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid JSON format\n`
// //               )
// //             );
// //             buffer = Buffer.alloc(0);
// //             return;
// //           }
// //           const validationError = validateHeader(headerData);
// //           if (validationError) {
// //             Logger.error(
// //               `[Client] Invalid header from host: ${validationError}`
// //             );
// //             client.write(
// //               Buffer.from(
// //                 `ERROR:${ERROR_CODES.INVALID_HEADER}:${validationError}\n`
// //               )
// //             );
// //             buffer = Buffer.alloc(0);
// //             return;
// //           }

// //           fileName = headerData.name;
// //           fileSize = headerData.size;
// //           fileId = headerData.fileId;
// //           deviceName = headerData.sender || "Unknown";
// //           totalChunks = headerData.totalChunks;
// //           expectedChunkSize = headerData.chunkSize;

// //           const { chunkSize: calculatedChunkSize } =
// //             calculateDynamicChunkDivision(fileSize);
// //           if (expectedChunkSize !== calculatedChunkSize) {
// //             const errorMsg = `Chunk size mismatch: expected ${calculatedChunkSize}, received ${expectedChunkSize}`;
// //             Logger.error(`[Client] ${errorMsg} for ${fileId}`);
// //             client.write(
// //               Buffer.from(`ERROR:${ERROR_CODES.INVALID_HEADER}:${errorMsg}\n`)
// //             );
// //             buffer = Buffer.alloc(0);
// //             return;
// //           }

// //           if (!checkTransferLimits(fileSize, fileTransfers)) {
// //             client.write(
// //               Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
// //             );
// //             Logger.toast(`Transfer limit exceeded for ${fileName}`, "error");
// //             buffer = Buffer.alloc(0);
// //             return;
// //           }

// //           client.write(Buffer.from(`ACK_FILE:${fileId}\n`));
// //           buffer = buffer.slice(headerEnd + 2);
// //           receivingFile = true;
// //           startTime = Date.now();
// //         } else if (dataStr.startsWith("MSG:")) {
// //           const messageEnd = buffer.indexOf(Buffer.from("\n"));
// //           if (messageEnd === -1) {
// //             Logger.info(`[Client] Incomplete MSG from host, waiting...`);
// //             return;
// //           }
// //           const message = buffer.slice(4, messageEnd).toString();
// //           setMessages((prev) => [...prev, `Host: ${message}`]);
// //           buffer = buffer.slice(messageEnd + 1);
// //         } else if (
// //           dataStr.startsWith("ACK_FILE:") ||
// //           dataStr.startsWith("ACK_COMPLETE:") ||
// //           dataStr.startsWith("ACK_CHUNK:")
// //         ) {
// //           const messageEnd = buffer.indexOf(Buffer.from("\n"));
// //           if (messageEnd === -1) {
// //             Logger.info(
// //               `[Client] Incomplete ${dataStr.slice(
// //                 0,
// //                 10
// //               )} from host, waiting...`
// //             );
// //             return;
// //           }
// //           Logger.info(`[Client] Processed ${dataStr.slice(0, messageEnd)}`);
// //           buffer = buffer.slice(messageEnd + 1);
// //         } else {
// //           Logger.warn(
// //             `[Client] Unknown data from host ${ip}: ${dataStr.slice(0, 50)}...`
// //           );
// //           client.write(
// //             Buffer.from(
// //               `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
// //             )
// //           );
// //           buffer = Buffer.alloc(0);
// //         }
// //       }
// //     } catch (error) {
// //       Logger.error(`[Client] Error processing data from host`, error);
// //       const err = DropShareError.from(
// //         error,
// //         ERROR_CODES.NETWORK_ERROR,
// //         "Data processing failed"
// //       );
// //       client.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
// //       buffer = Buffer.alloc(0);
// //       receivingFile = false;
// //       fileChunks = {};
// //       chunkCounts = {};
// //     }
// //   }

// //   return {
// //     sendFilesInClient,
// //     sendMessageInClient,
// //     receiveFileInClient,
// //   };
// // };

// import {
//   calculateDynamicChunkDivision,
//   checkTransferLimits,
//   checkIncomingLimits,
//   MAX_CONCURRENT_FILES,
// } from "../utils/NetworkUtils";
// import RNFS from "react-native-fs";
// import { Buffer } from "buffer";
// import { Logger } from "../utils/Logger";
// import { DropShareError, ERROR_CODES } from "../utils/Error";
// import TCPSocket from "react-native-tcp-socket";
// import { savePath } from "../utils/FileSystemUtil";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import { throttle } from "lodash";

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

// function validateHeader(header: FileHeader): string | null {
//   const requiredFields: (keyof FileHeader)[] = [
//     "protocolVersion",
//     "name",
//     "size",
//     "sender",
//     "fileId",
//     "totalChunks",
//     "chunkSize",
//   ];
//   const missingFields = requiredFields.filter(
//     (field) => header[field] === undefined || header[field] === null
//   );
//   if (missingFields.length > 0) {
//     return `Missing required fields: ${missingFields.join(", ")}`;
//   }
//   if (header.protocolVersion !== PROTOCOL_VERSION) {
//     return `Invalid protocol version: expected ${PROTOCOL_VERSION}, received ${header.protocolVersion}`;
//   }
//   if (typeof header.name !== "string" || header.name.trim() === "") {
//     return "Invalid or empty file name";
//   }
//   if (typeof header.size !== "number" || header.size <= 0) {
//     return "Invalid file size";
//   }
//   if (typeof header.fileId !== "string" || header.fileId.trim() === "") {
//     return "Invalid or empty file ID";
//   }
//   if (
//     typeof header.totalChunks !== "number" ||
//     header.totalChunks <= 0 ||
//     !Number.isInteger(header.totalChunks)
//   ) {
//     return "Invalid total chunks";
//   }
//   if (typeof header.chunkSize !== "number" || header.chunkSize <= 0) {
//     return "Invalid chunk size";
//   }
//   return null;
// }

// // Throttle progress updates to prevent UI freezes
// const throttleProgressUpdate = throttle(
//   (
//     setTransferProgress: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >,
//     fileId: string,
//     fileName: string,
//     sentBytes: number,
//     fileSize: number,
//     startTime: number
//   ) => {
//     const percentage = (sentBytes / fileSize) * 100;
//     const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//     const speed = (sentBytes / elapsedTime / 1024).toFixed(2);

//     setTransferProgress((prev) => [
//       ...prev.filter((p) => p.fileId !== fileId),
//       {
//         fileId,
//         fileName,
//         progress: `${sentBytes}/${fileSize} bytes`,
//         speed: `${speed} KB/s`,
//         percentage,
//       },
//     ]);
//   },
//   1000
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
//     let retries = 0;
//     let lastChunkIndex = -1;

//     // Check for resumable transfer
//     const metadataKey = `host_transfer_${fileId}`;
//     const metadata = await AsyncStorage.getItem(metadataKey);
//     if (metadata) {
//       const { lastChunk } = JSON.parse(metadata);
//       lastChunkIndex = lastChunk || -1;
//       Logger.info(
//         `[Host] Resuming transfer for ${fileId} from chunk ${
//           lastChunkIndex + 1
//         }`
//       );
//     }

//     try {
//       const fileStat = await RNFS.stat(filePath);
//       const fileSize = fileStat.size;
//       const { chunkSize, numChunks: totalChunks } =
//         calculateDynamicChunkDivision(fileSize);

//       fileTransfers.set(fileId, {
//         fileId,
//         fileName,
//         totalSize: fileSize,
//         receivedBytes: (lastChunkIndex + 1) * chunkSize,
//         fileSize,
//         deviceName,
//         senderIp: socket.remoteAddress || "",
//         chunks: Array(totalChunks).fill(undefined),
//         chunkSize,
//         startTime: Date.now(),
//         totalChunks,
//         chunkHashes: [],
//         status: "Sending",
//         progress: 0,
//         lastChunkIndex: -1,
//       });

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
//               Logger.info(`[Host] Received for ACK_FILE: ${message}`);
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
//             const headerStr = `FILE:${JSON.stringify(header)}\n\n`;
//             socket.write(Buffer.from(headerStr));
//             Logger.info(`[Host] Sent header for ${fileId}: ${headerStr}`);
//           });

//           const startTime = Date.now();
//           let sentBytes = (lastChunkIndex + 1) * chunkSize;

//           // Stream file chunks
//           for (let i = lastChunkIndex + 1; i < totalChunks; i++) {
//             const start = i * chunkSize;
//             const end = Math.min(start + chunkSize, fileSize);
//             const chunk = await RNFS.readFile(filePath, {
//               encoding: "base64",
//               start,
//               end,
//             });
//             const chunkBuffer = Buffer.from(chunk, "base64");
//             const actualChunkSize = chunkBuffer.length;

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
//                 Logger.info(`[Host] Received for ACK_CHUNK:${i}: ${message}`);
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
//               socket.write(Buffer.concat([chunkHeader, chunkBuffer]));
//               Logger.info(
//                 `[Host] Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
//               );
//             });

//             sentBytes += actualChunkSize;
//             // Save progress for resumable transfer
//             await AsyncStorage.setItem(
//               metadataKey,
//               JSON.stringify({ lastChunk: i, filePath, fileId })
//             );

//             // Throttled progress update
//             throttleProgressUpdate(
//               setTransferProgress!,
//               fileId,
//               fileName,
//               sentBytes,
//               fileSize,
//               startTime
//             );
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
//               Logger.info(`[Host] Received for ACK_COMPLETE: ${message}`);
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

//           // Cleanup metadata on success
//           await AsyncStorage.removeItem(metadataKey);
//           fileTransfers.delete(fileId);
//           break;
//         } catch (error) {
//           retries++;
//           if (retries === MAX_RETRIES) {
//             Logger.error(`[Host] Max retries reached for ${fileId}`);
//             Logger.toast(`Transfer failed for ${fileName}`, "error");
//             fileTransfers.delete(fileId);
//             await AsyncStorage.removeItem(metadataKey);
//             throw DropShareError.from(
//               error,
//               ERROR_CODES.NETWORK_ERROR,
//               `Transfer failed after ${MAX_RETRIES} attempts`
//             );
//           }
//           Logger.warn(
//             `[Host] Retrying file send for ${fileId} after error: ${error}`
//           );
//           await new Promise((resolve) => setTimeout(resolve, 1000));
//         }
//       }
//     } catch (error) {
//       Logger.error(`[Host] Error in file transfer for ${fileName}`, error);
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
//     server: TCPSocket.Server | TCPSocket.Socket | null,
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
//       // Limit concurrent transfers per client
//       const transfersPerClient = Math.min(3, connectedSockets.length);
//       for (let i = 0; i < connectedSockets.length; i += transfersPerClient) {
//         const batch = connectedSockets.slice(i, i + transfersPerClient);
//         await Promise.all(
//           batch.map((socket) =>
//             sendFile(
//               socket,
//               fileName,
//               tempPath,
//               username,
//               fileId,
//               setTransferProgress
//             )
//           )
//         );
//       }
//       Logger.info(
//         `[Host] Sent file: ${fileName} from ${username} to all clients`
//       );
//       Logger.toast(`Sent file ${fileName}`, "info");
//     } catch (error) {
//       Logger.error(`[Host] Failed to send file ${fileName}`, error);
//       throw error;
//     } finally {
//       await RNFS.unlink(tempPath).catch((err) =>
//         Logger.error(`[Host] Failed to delete temp file ${tempPath}`, err)
//       );
//     }
//   }

//   async function sendFilesInHost(
//     server: TCPSocket.Server | TCPSocket.Socket | null,
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

//     // Queue-based transfer for multiple files
//     for (const { filePath, fileData } of files) {
//       if (fileTransfers.size >= MAX_CONCURRENT_FILES) {
//         Logger.info(
//           `[Host] Waiting for available transfer slot (${fileTransfers.size}/${MAX_CONCURRENT_FILES})`
//         );
//         await new Promise((resolve) => setTimeout(resolve, 1000));
//       }
//       await sendHostFile(
//         server,
//         filePath,
//         fileData,
//         username,
//         setTransferProgress
//       );
//       Logger.info(
//         `[Host] Sent file: ${filePath.split("/").pop()} from ${username}`
//       );
//     }
//   }

//   function sendMessageInHost(message: string, username: string): void {
//     if (connectedSockets.length === 0) {
//       Logger.toast("No connected clients to send message", "error");
//       return;
//     }

//     connectedSockets.forEach((socket) => {
//       socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
//       Logger.info(`[Host] Sent MSG to ${socket.remoteAddress}: ${message}`);
//     });
//   }

//   async function receiveFileInHost({
//     socket,
//     data,
//     setReceivedFiles,
//     setMessages,
//     setTransferProgress,
//   }: HostReceiveProps) {
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
//               Logger.info(
//                 `[Host] Incomplete CHUNK header from client ${socket.remoteAddress}, waiting...`
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
//                 `[Host] Failed to parse CHUNK header: ${headerStr}`,
//                 error
//               );
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 `Invalid chunk header: ${
//                   error instanceof Error ? error.message : "Unknown error"
//                 }`
//               );
//             }

//             const chunkSize = chunkData.chunkSize;
//             const expectedChunkEnd = headerEnd + chunkSize;

//             if (buffer.length < expectedChunkEnd) {
//               Logger.info(
//                 `[Host] Incomplete chunk data for ${chunkData.fileId}, waiting...`
//               );
//               return;
//             }

//             const chunk = buffer.slice(headerEnd + 2, expectedChunkEnd);
//             if (chunk.length !== chunkSize) {
//               Logger.error(
//                 `[Host] Chunk size mismatch for ${chunkData.fileId}: expected ${chunkSize}, received ${chunk.length}`
//               );
//               throw new DropShareError(
//                 ERROR_CODES.CORRUPTED_CHUNK,
//                 `Chunk size mismatch: expected ${chunkSize}, received ${chunk.length}`
//               );
//             }

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

//             // Throttled progress update
//             throttleProgressUpdate(
//               setTransferProgress!,
//               fileId,
//               fileName,
//               receivedBytes,
//               fileSize,
//               startTime
//             );

//             socket.write(
//               Buffer.from(`ACK_CHUNK:${fileId}:${chunkData.chunkIndex}\n`)
//             );
//             buffer = buffer.slice(expectedChunkEnd);

//             // Save progress for resumable transfer
//             await AsyncStorage.setItem(
//               `host_transfer_${fileId}`,
//               JSON.stringify({
//                 lastChunk: chunkData.chunkIndex,
//                 fileId,
//                 filePath: `${savePath}/${fileName}`,
//               })
//             );

//             if (chunkCounts[fileId] === totalChunks) {
//               // All chunks received, reconstruct file
//               const fileBuffer = Buffer.concat(
//                 fileChunks[fileId].filter(Boolean)
//               );
//               if (fileBuffer.length !== fileSize) {
//                 Logger.error(
//                   `[Host] File size mismatch for ${fileId}: expected ${fileSize}, received ${fileBuffer.length}`
//                 );
//                 throw new DropShareError(
//                   ERROR_CODES.CORRUPTED_CHUNK,
//                   `File size mismatch: expected ${fileSize}, received ${fileBuffer.length}`
//                 );
//               }
//               await RNFS.writeFile(
//                 `${savePath}/${fileName}`,
//                 fileBuffer.toString("base64"),
//                 "base64"
//               );
//               setReceivedFiles((prev) => [...prev, `${savePath}/${fileName}`]);
//               Logger.info(
//                 `[Host] Received and saved file: ${savePath}/${fileName} from ${deviceName}`
//               );
//               fileTransfers.delete(fileId);
//               socket.write(Buffer.from(`ACK_COMPLETE:${fileId}\n`));
//               receivingFile = false;
//               delete fileChunks[fileId];
//               delete chunkCounts[fileId];
//               await AsyncStorage.removeItem(`host_transfer_${fileId}`);
//               fileId = "";
//               fileName = "";
//               fileSize = 0;
//               deviceName = "";
//               totalChunks = 0;
//               expectedChunkSize = 0;
//             }
//           } else {
//             Logger.warn(
//               `[Host] Unexpected data while receiving file: ${dataStr.slice(
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

//       // Handle protocol messages
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
//               `[Host] Incomplete FILE header from ${socket.remoteAddress}, waiting...`
//             );
//             return;
//           }
//           const headerStr = buffer.slice(5, headerEnd).toString();
//           let headerData: FileHeader;
//           try {
//             headerData = JSON.parse(headerStr);
//           } catch (error) {
//             Logger.error(
//               `[Host] Failed to parse FILE header: ${headerStr}`,
//               error
//             );
//             socket.write(
//               Buffer.from(
//                 `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid JSON format\n`
//               )
//             );
//             buffer = Buffer.alloc(0);
//             return;
//           }

//           // Validate header
//           const validationError = validateHeader(headerData);
//           if (validationError) {
//             Logger.error(
//               `[Host] Invalid header from ${socket.remoteAddress}: ${validationError}`
//             );
//             socket.write(
//               Buffer.from(
//                 `ERROR:${ERROR_CODES.INVALID_HEADER}:${validationError}\n`
//               )
//             );
//             buffer = Buffer.alloc(0);
//             return;
//           }

//           fileName = headerData.name;
//           fileSize = headerData.size;
//           deviceName = headerData.sender || "Unknown";
//           fileId = headerData.fileId;
//           totalChunks = headerData.totalChunks;
//           expectedChunkSize = headerData.chunkSize;

//           const { chunkSize: calculatedChunkSize } =
//             calculateDynamicChunkDivision(fileSize);
//           if (expectedChunkSize !== calculatedChunkSize) {
//             const errorMsg = `Chunk size mismatch: expected ${calculatedChunkSize}, received ${expectedChunkSize}`;
//             Logger.error(`[Host] ${errorMsg} for ${fileId}`);
//             socket.write(
//               Buffer.from(`ERROR:${ERROR_CODES.INVALID_HEADER}:${errorMsg}\n`)
//             );
//             buffer = Buffer.alloc(0);
//             return;
//           }

//           if (!checkTransferLimits(fileSize, fileTransfers)) {
//             socket.write(
//               Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
//             );
//             Logger.toast(`Transfer limit exceeded for ${fileName}`, "error");
//             buffer = Buffer.alloc(0);
//             return;
//           }

//           if (!checkIncomingLimits(fileTransfers)) {
//             socket.write(
//               Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
//             );
//             Logger.toast(
//               `Too many incoming transfers for ${fileName}`,
//               "error"
//             );
//             buffer = Buffer.alloc(0);
//             return;
//           }

//           socket.write(Buffer.from(`ACK_FILE:${fileId}\n`));
//           buffer = buffer.slice(headerEnd + 2);
//           receivingFile = true;
//           startTime = Date.now();

//           // Check for resumable transfer
//           const metadata = await AsyncStorage.getItem(
//             `host_transfer_${fileId}`
//           );
//           if (metadata) {
//             const { lastChunk } = JSON.parse(metadata);
//             chunkCounts[fileId] = lastChunk + 1;
//             fileChunks[fileId] = new Array(totalChunks).fill(null);
//             for (let i = 0; i <= lastChunk; i++) {
//               const chunkPath = `${RNFS.TemporaryDirectoryPath}/${fileId}_chunk_${i}`;
//               if (await RNFS.exists(chunkPath)) {
//                 const chunkData = await RNFS.readFile(chunkPath, "base64");
//                 fileChunks[fileId][i] = Buffer.from(chunkData, "base64");
//               }
//             }
//             Logger.info(
//               `[Host] Resumed receiving ${fileId} from chunk ${lastChunk + 1}`
//             );
//           }
//         } else if (dataStr.startsWith("MSG:")) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) {
//             Logger.info(
//               `[Host] Incomplete MSG from ${socket.remoteAddress}, waiting...`
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
//               Logger.info(`[Host] Forwarded MSG to ${s.remoteAddress}`);
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
//               `[Host] Incomplete ${dataStr.slice(0, 10)} from ${
//                 socket.remoteAddress
//               }, waiting...`
//             );
//             return;
//           }
//           Logger.info(`[Host] Processed ${dataStr.slice(0, messageEnd)}`);
//           buffer = buffer.slice(messageEnd + 1);
//         } else {
//           Logger.warn(
//             `[Host] Invalid data from ${socket.remoteAddress}: ${dataStr.slice(
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
//       Logger.error(
//         `[Host] Error processing data from ${socket.remoteAddress}`,
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
//       fileChunks = {};
//       chunkCounts = {};
//       fileTransfers.delete(fileId);
//       await AsyncStorage.removeItem(`host_transfer_${fileId}`);
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
//     let retries = 0;
//     let lastChunkIndex = -1;

//     // Check for resumable transfer
//     const metadataKey = `client_transfer_${fileId}`;
//     const metadata = await AsyncStorage.getItem(metadataKey);
//     if (metadata) {
//       const { lastChunk } = JSON.parse(metadata);
//       lastChunkIndex = lastChunk || -1;
//       Logger.info(
//         `[Client] Resuming transfer for ${fileId} from chunk ${
//           lastChunkIndex + 1
//         }`
//       );
//     }

//     try {
//       const fileStat = await RNFS.stat(filePath);
//       const fileSize = fileStat.size;
//       const { chunkSize, numChunks: totalChunks } =
//         calculateDynamicChunkDivision(fileSize);

//       fileTransfers.set(fileId, {
//         fileId,
//         fileName,
//         totalSize: fileSize,
//         receivedBytes: (lastChunkIndex + 1) * chunkSize,
//         fileSize,
//         deviceName: username,
//         senderIp: socket.remoteAddress || "",
//         chunks: Array(totalChunks).fill(undefined),
//         chunkSize,
//         startTime: Date.now(),
//         totalChunks,
//         chunkHashes: [],
//         status: "Sending",
//         progress: 0,
//         lastChunkIndex: -1,
//       });

//       while (retries < MAX_RETRIES) {
//         try {
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
//               Logger.info(`[Client] Received for ACK_FILE: ${message}`);
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
//             const headerStr = `FILE:${JSON.stringify(header)}\n\n`;
//             socket.write(Buffer.from(headerStr));
//             Logger.info(`[Client] Sent header for ${fileId}: ${headerStr}`);
//           });

//           const startTime = Date.now();
//           let sentBytes = (lastChunkIndex + 1) * chunkSize;

//           for (let i = lastChunkIndex + 1; i < totalChunks; i++) {
//             const start = i * chunkSize;
//             const end = Math.min(start + chunkSize, fileSize);
//             const chunk = await RNFS.readFile(filePath, {
//               encoding: "base64",
//               start,
//               end,
//             });
//             const chunkBuffer = Buffer.from(chunk, "base64");
//             const actualChunkSize = chunkBuffer.length;

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
//                 Logger.info(`[Client] Received for ACK_CHUNK:${i}: ${message}`);
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
//               socket.write(Buffer.concat([chunkHeader, chunkBuffer]));
//               Logger.info(
//                 `[Client] Sent chunk ${i}/${totalChunks} for ${fileId} (${actualChunkSize} bytes)`
//               );
//             });

//             sentBytes += actualChunkSize;
//             await AsyncStorage.setItem(
//               metadataKey,
//               JSON.stringify({ lastChunk: i, filePath, fileId })
//             );

//             throttleProgressUpdate(
//               setTransferProgress!,
//               fileId,
//               fileName,
//               sentBytes,
//               fileSize,
//               startTime
//             );
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
//               Logger.info(`[Client] Received for ACK_COMPLETE: ${message}`);
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

//           await AsyncStorage.removeItem(metadataKey);
//           fileTransfers.delete(fileId);
//           break;
//         } catch (error) {
//           retries++;
//           if (retries === MAX_RETRIES) {
//             Logger.error(`[Client] Max retries reached for ${fileId}`);
//             Logger.toast(`Transfer failed for ${fileName}`, "error");
//             fileTransfers.delete(fileId);
//             await AsyncStorage.removeItem(metadataKey);
//             throw DropShareError.from(
//               error,
//               ERROR_CODES.NETWORK_ERROR,
//               `Transfer failed after ${MAX_RETRIES} attempts`
//             );
//           }
//           Logger.warn(
//             `[Client] Retrying file send for ${fileId} after error: ${error}`
//           );
//           await new Promise((resolve) => setTimeout(resolve, 1000));
//         }
//       }
//     } catch (error) {
//       Logger.error(`[Client] Failed to send file ${fileName}`, error);
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
//       if (fileTransfers.size >= MAX_CONCURRENT_FILES) {
//         Logger.info(
//           `[Client] Waiting for available transfer slot (${fileTransfers.size}/${MAX_CONCURRENT_FILES})`
//         );
//         await new Promise((resolve) => setTimeout(resolve, 1000));
//       }
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
//       Logger.info(`[Client] Sent file: ${fileName} from ${username}`);
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
//     Logger.info(`[Client] Sent MSG: ${message}`);
//   }

//   async function receiveFileInClient({
//     ip,
//     client,
//     data,
//     setReceivedFiles,
//     setMessages,
//     setTransferProgress,
//   }: ClientReceiveProps) {
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
//               Logger.info(
//                 `[Client] Incomplete CHUNK header from host, waiting...`
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
//                 `[Client] Failed to parse CHUNK header: ${headerStr}`,
//                 error
//               );
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 `Invalid chunk header: ${
//                   error instanceof Error ? error.message : "Unknown error"
//                 }`
//               );
//             }
//             const chunkSize = chunkData.chunkSize;
//             const expectedChunkEnd = headerEnd + 2 + chunkSize;
//             if (buffer.length < expectedChunkEnd) {
//               Logger.info(
//                 `[Client] Incomplete chunk data for ${chunkData.fileId}, waiting...`
//               );
//               return;
//             }
//             const chunk = buffer.slice(headerEnd + 2, expectedChunkEnd);
//             if (chunk.length !== chunkSize) {
//               Logger.error(
//                 `[Client] Chunk size mismatch for ${chunkData.fileId}: expected ${chunkSize}, received ${chunk.length}`
//               );
//               throw new DropShareError(
//                 ERROR_CODES.CORRUPTED_CHUNK,
//                 `Chunk size mismatch: expected ${chunkSize}, received ${chunk.length}`
//               );
//             }

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

//             throttleProgressUpdate(
//               setTransferProgress!,
//               fileId,
//               fileName,
//               receivedBytes,
//               fileSize,
//               startTime
//             );

//             client.write(
//               Buffer.from(`ACK_CHUNK:${fileId}:${chunkData.chunkIndex}\n`)
//             );
//             buffer = buffer.slice(expectedChunkEnd);

//             await AsyncStorage.setItem(
//               `client_transfer_${fileId}`,
//               JSON.stringify({
//                 lastChunk: chunkData.chunkIndex,
//                 fileId,
//                 filePath: `${savePath}/${fileName}`,
//               })
//             );

//             if (chunkCounts[fileId] === totalChunks) {
//               const fileBuffer = Buffer.concat(
//                 fileChunks[fileId].filter(Boolean)
//               );
//               if (fileBuffer.length !== fileSize) {
//                 Logger.error(
//                   `[Client] File size mismatch for ${fileId}: expected ${fileSize}, received ${fileBuffer.length}`
//                 );
//                 throw new DropShareError(
//                   ERROR_CODES.CORRUPTED_CHUNK,
//                   `File size mismatch: expected ${fileSize}, received ${fileBuffer.length}`
//                 );
//               }
//               await RNFS.writeFile(
//                 `${savePath}/${fileName}`,
//                 fileBuffer.toString("base64"),
//                 "base64"
//               );
//               setReceivedFiles((prev) => [...prev, `${savePath}/${fileName}`]);
//               Logger.info(
//                 `[Client] Received and saved file: ${savePath}/${fileName} from ${deviceName}`
//               );
//               fileTransfers.delete(fileId);
//               client.write(Buffer.from(`ACK_COMPLETE:${fileId}\n`));
//               receivingFile = false;
//               delete fileChunks[fileId];
//               delete chunkCounts[fileId];
//               await AsyncStorage.removeItem(`client_transfer_${fileId}`);
//               fileId = "";
//               fileName = "";
//               fileSize = 0;
//               deviceName = "";
//               totalChunks = 0;
//               expectedChunkSize = 0;
//             }
//           } else {
//             Logger.warn(
//               `[Client] Unexpected data while receiving file: ${dataStr.slice(
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
//               `[Client] Incomplete FILE header from host, waiting...`
//             );
//             return;
//           }
//           const headerStr = buffer.slice(5, headerEnd).toString();
//           let headerData: FileHeader;
//           try {
//             headerData = JSON.parse(headerStr);
//           } catch (error) {
//             Logger.error(
//               `[Client] Failed to parse FILE header: ${headerStr}`,
//               error
//             );
//             client.write(
//               Buffer.from(
//                 `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid JSON format\n`
//               )
//             );
//             buffer = Buffer.alloc(0);
//             return;
//           }
//           const validationError = validateHeader(headerData);
//           if (validationError) {
//             Logger.error(
//               `[Client] Invalid header from host: ${validationError}`
//             );
//             client.write(
//               Buffer.from(
//                 `ERROR:${ERROR_CODES.INVALID_HEADER}:${validationError}\n`
//               )
//             );
//             buffer = Buffer.alloc(0);
//             return;
//           }

//           fileName = headerData.name;
//           fileSize = headerData.size;
//           fileId = headerData.fileId;
//           deviceName = headerData.sender || "Unknown";
//           totalChunks = headerData.totalChunks;
//           expectedChunkSize = headerData.chunkSize;

//           const { chunkSize: calculatedChunkSize } =
//             calculateDynamicChunkDivision(fileSize);
//           if (expectedChunkSize !== calculatedChunkSize) {
//             const errorMsg = `Chunk size mismatch: expected ${calculatedChunkSize}, received ${expectedChunkSize}`;
//             Logger.error(`[Client] ${errorMsg} for ${fileId}`);
//             client.write(
//               Buffer.from(`ERROR:${ERROR_CODES.INVALID_HEADER}:${errorMsg}\n`)
//             );
//             buffer = Buffer.alloc(0);
//             return;
//           }

//           if (!checkTransferLimits(fileSize, fileTransfers)) {
//             client.write(
//               Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
//             );
//             Logger.toast(`Transfer limit exceeded for ${fileName}`, "error");
//             buffer = Buffer.alloc(0);
//             return;
//           }

//           if (!checkIncomingLimits(fileTransfers)) {
//             client.write(
//               Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
//             );
//             Logger.toast(
//               `Too many incoming transfers for ${fileName}`,
//               "error"
//             );
//             buffer = Buffer.alloc(0);
//             return;
//           }

//           client.write(Buffer.from(`ACK_FILE:${fileId}\n`));
//           buffer = buffer.slice(headerEnd + 2);
//           receivingFile = true;
//           startTime = Date.now();

//           // Check for resumable transfer
//           const metadata = await AsyncStorage.getItem(
//             `client_transfer_${fileId}`
//           );
//           if (metadata) {
//             const { lastChunk } = JSON.parse(metadata);
//             chunkCounts[fileId] = lastChunk + 1;
//             fileChunks[fileId] = new Array(totalChunks).fill(null);
//             for (let i = 0; i <= lastChunk; i++) {
//               const chunkPath = `${RNFS.TemporaryDirectoryPath}/${fileId}_chunk_${i}`;
//               if (await RNFS.exists(chunkPath)) {
//                 const chunkData = await RNFS.readFile(chunkPath, "base64");
//                 fileChunks[fileId][i] = Buffer.from(chunkData, "base64");
//               }
//             }
//             Logger.info(
//               `[Client] Resumed receiving ${fileId} from chunk ${lastChunk + 1}`
//             );
//           }
//         } else if (dataStr.startsWith("MSG:")) {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) {
//             Logger.info(`[Client] Incomplete MSG from host, waiting...`);
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
//               `[Client] Incomplete ${dataStr.slice(
//                 0,
//                 10
//               )} from host, waiting...`
//             );
//             return;
//           }
//           Logger.info(`[Client] Processed ${dataStr.slice(0, messageEnd)}`);
//           buffer = buffer.slice(messageEnd + 1);
//         } else {
//           Logger.warn(
//             `[Client] Unknown data from host ${ip}: ${dataStr.slice(0, 50)}...`
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
//       Logger.error(`[Client] Error processing data from host`, error);
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
//       fileTransfers.delete(fileId);
//       await AsyncStorage.removeItem(`client_transfer_${fileId}`);
//     }
//   }

//   return {
//     sendFilesInClient,
//     sendMessageInClient,
//     receiveFileInClient,
//   };
// };
