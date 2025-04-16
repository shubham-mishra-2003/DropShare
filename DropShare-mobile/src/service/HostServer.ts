// import dgram from "react-native-udp";
// import net from "react-native-tcp-socket";
// import {
//   getLocalIPAddress,
//   getBroadcastIPAddress,
//   calculateChunkSize,
// } from "../utils/networkUtils";
// import RNFS from "react-native-fs";
// import { Buffer } from "buffer";

// const UDP_PORT = 5000;
// const TCP_PORT = 6000;

// let connectedSockets: any[] = [];
// let isServerRunning = false;

// interface FileTransfer {
//   fileName: string;
//   fileSize: number;
//   deviceName: string;
//   buffer: Buffer[];
//   receivedBytes: number;
// }

// export function startHostServer(
//   username: string,
//   setDevices: React.Dispatch<React.SetStateAction<Device[]>>,
//   setSocket: React.Dispatch<React.SetStateAction<any>>,
//   setMessages: React.Dispatch<React.SetStateAction<string[]>>,
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
//   setTransferProgress?: React.Dispatch<
//     React.SetStateAction<{ progress: string; speed: string }>
//   >
// ): void {
//   // Unchanged discovery and connection logic
//   if (isServerRunning) {
//     console.log("🔵 Host server already running, skipping start.");
//     return;
//   }
//   isServerRunning = true;

//   getLocalIPAddress()
//     .then(async (ip) => {
//       const broadcastAddr = await getBroadcastIPAddress();
//       console.log(
//         "🔵 Host started on IP:",
//         ip,
//         "Broadcasting to:",
//         broadcastAddr
//       );
//       const udpSocket = dgram.createSocket({ type: "udp4", reusePort: true });
//       udpSocket.bind(UDP_PORT);

//       udpSocket.once("listening", () => {
//         console.log(`🔗 UDP Socket bound to port ${UDP_PORT}`);
//         udpSocket.setBroadcast(true);
//         setInterval(() => {
//           const message = JSON.stringify({ role: "Host", ip, name: username });
//           udpSocket.send(
//             message,
//             undefined,
//             undefined,
//             UDP_PORT,
//             broadcastAddr,
//             (err) => {
//               if (err)
//                 console.error(
//                   "❌ UDP Send Error:",
//                   err.stack || err.message || err
//                 );
//             }
//           );
//         }, 2000);
//       });

//       udpSocket.on("error", (err) => {
//         console.log("❌ UDP Socket Error:", err.stack || err.message || err);
//         isServerRunning = false;
//         udpSocket.close();
//       });

//       const server = net.createServer((socket) => {
//         console.log("✅ Client connected:", socket.remoteAddress);
//         connectedSockets.push(socket);
//         setSocket(server);
//         setDevices((prev) => [
//           ...prev.filter((d) => d.ip !== socket.remoteAddress),
//           {
//             ip: socket.remoteAddress || "Unknown",
//             name: "Client",
//             role: "Client",
//             deviceName: "Unknown",
//           },
//         ]);
//         const fileTransfers = new Map<string, FileTransfer>();

//         socket.on("data", async (data: Buffer) => {
//           // Unchanged data handling logic
//           console.log(
//             `📥 Host received ${data.length} bytes of data from ${socket.remoteAddress}`
//           );
//           try {
//             const header = data.slice(0, 5).toString();
//             if (header === "FILE:") {
//               const headerEnd = data.indexOf(Buffer.from("\n\n"));
//               if (headerEnd === -1) {
//                 console.log(
//                   "Incomplete header received, waiting for more data..."
//                 );
//                 return;
//               }
//               const headerStr = data.slice(5, headerEnd).toString();
//               const headerData = JSON.parse(headerStr);
//               const fileName = headerData.name;
//               const fileSize = headerData.size;
//               const deviceName = headerData.sender || "Unknown";

//               if (!fileName || !fileSize)
//                 throw new Error("Invalid header: missing name or size");

//               fileTransfers.set(fileName, {
//                 fileName,
//                 fileSize,
//                 deviceName,
//                 buffer: [data.slice(headerEnd + 2)],
//                 receivedBytes: data.slice(headerEnd + 2).length,
//               });
//               console.log(
//                 `📥 Host started receiving file: ${fileName} (${fileSize} bytes) from ${deviceName}`
//               );
//               setTransferProgress?.({
//                 progress: `${
//                   fileTransfers.get(fileName)!.receivedBytes
//                 }/${fileSize} bytes`,
//                 speed: "0 KB/s",
//               });
//             } else {
//               let matchedTransfer: FileTransfer | undefined;
//               for (const transfer of fileTransfers.values()) {
//                 if (transfer.receivedBytes < transfer.fileSize) {
//                   matchedTransfer = transfer;
//                   break;
//                 }
//               }

//               if (matchedTransfer) {
//                 const startTime = Date.now();
//                 matchedTransfer.buffer.push(data);
//                 matchedTransfer.receivedBytes += data.length;
//                 const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//                 const speed = (data.length / elapsedTime / 1024).toFixed(2);
//                 console.log(
//                   `📥 Progress for ${matchedTransfer.fileName}: ${matchedTransfer.receivedBytes}/${matchedTransfer.fileSize} bytes`
//                 );
//                 setTransferProgress?.({
//                   progress: `${matchedTransfer.receivedBytes}/${matchedTransfer.fileSize} bytes`,
//                   speed: `${speed} KB/s`,
//                 });

//                 if (matchedTransfer.receivedBytes >= matchedTransfer.fileSize) {
//                   const fullFile = Buffer.concat(matchedTransfer.buffer);
//                   const saveDir = `${RNFS.ExternalStorageDirectoryPath}/DropShare`;
//                   const dirExists = await RNFS.exists(saveDir);
//                   if (!dirExists) await RNFS.mkdir(saveDir);

//                   let savePath = `${saveDir}/${matchedTransfer.fileName}`;
//                   let counter = 1;
//                   const [name, ext] =
//                     matchedTransfer.fileName.split(/(\.[^.]+)$/);
//                   while (await RNFS.exists(savePath)) {
//                     savePath = `${saveDir}/${name}-${counter}${ext || ""}`;
//                     counter++;
//                   }

//                   await RNFS.writeFile(
//                     savePath,
//                     fullFile.toString("base64"),
//                     "base64"
//                   );
//                   setReceivedFiles((prev) => [...prev, savePath]);
//                   console.log(
//                     `📥 Host received and saved file: ${savePath} from ${matchedTransfer.deviceName}`
//                   );

//                   connectedSockets.forEach((s) => {
//                     if (s !== socket) {
//                       sendFileInChunks(
//                         s,
//                         matchedTransfer!.fileName,
//                         fullFile,
//                         matchedTransfer!.deviceName
//                       );
//                     }
//                   });

//                   fileTransfers.delete(matchedTransfer.fileName);
//                   setTransferProgress?.({
//                     progress: "0/0 bytes",
//                     speed: "0 KB/s",
//                   });
//                 }
//               } else {
//                 const message = data.toString();
//                 console.log(`📨 Host received message: ${message}`);
//                 setMessages((prev) => [...prev, message]);
//                 connectedSockets.forEach((s) => {
//                   if (s !== socket)
//                     s.write(data, (err: Error) => {
//                       if (err)
//                         console.error(
//                           "❌ Write Error to Client:",
//                           err.stack || err.message || err
//                         );
//                     });
//                 });
//               }
//             }
//           } catch (error) {
//             console.error("Error processing data:", error);
//             fileTransfers.clear();
//             setTransferProgress?.({ progress: "0/0 bytes", speed: "0 KB/s" });
//           }
//         });

//         socket.on("close", () => {
//           console.log("🔌 Client disconnected:", socket.remoteAddress);
//           connectedSockets = connectedSockets.filter((s) => s !== socket);
//           setDevices((prev) =>
//             prev.filter((d) => d.ip !== socket.remoteAddress)
//           );
//           fileTransfers.clear();
//         });

//         socket.on("error", (err) => {
//           console.log("❌ Host Socket Error:", err.stack || err.message || err);
//           fileTransfers.clear();
//         });
//       });

//       server.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
//         console.log("🚀 Host TCP server running on port", TCP_PORT);
//       });

//       server.on("error", (err) => {
//         console.log("❌ Server Error:", err.stack || err.message || err);
//         isServerRunning = false;
//         server.close();
//       });

//       server.on("close", () => {
//         console.log("🔌 Host TCP server closed");
//         isServerRunning = false;
//         connectedSockets = [];
//       });
//     })
//     .catch((err) => {
//       console.error("Failed to get local IP:", err.stack || err.message || err);
//       isServerRunning = false;
//     });
// }

// // Updated sendFileInChunks with dynamic chunking
// async function sendFileInChunks(
//   socket: any,
//   fileName: string | null,
//   fileData: Buffer,
//   deviceName: string | null
// ): Promise<void> {
//   const safeFileName = fileName || "unnamed_file";
//   const fileSize = fileData.length;
//   const chunkSize = calculateChunkSize(fileSize);
//   const header = Buffer.from(
//     `FILE:${JSON.stringify({
//       name: safeFileName,
//       size: fileSize,
//       sender: deviceName || "Host",
//     })}\n\n`
//   );
//   socket.write(header, (err: Error) => {
//     if (err)
//       console.error("❌ Header Write Error:", err.stack || err.message || err);
//   });

//   let sentBytes = 0;
//   const startTime = Date.now();

//   for (let i = 0; i < fileSize; i += chunkSize) {
//     const chunk = fileData.slice(i, i + chunkSize);
//     socket.write(chunk, (err: Error) => {
//       if (err)
//         console.error("❌ Chunk Write Error:", err.stack || err.message || err);
//     });
//     sentBytes += chunk.length;
//     const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//     const speed = (sentBytes / elapsedTime / 1024).toFixed(2);
//     console.log(
//       `📤 Sent chunk: ${sentBytes}/${fileSize} bytes at ${speed} KB/s`
//     );
//     await new Promise<void>((resolve) => setTimeout(resolve, 5)); // Reduced delay for speed
//   }

//   console.log(
//     `📤 Broadcasted file: ${safeFileName} from ${deviceName || "Host"}`
//   );
// }

// // Updated sendHostFile with dynamic chunking
// export async function sendHostFile(
//   server: any,
//   filePath: string,
//   fileData: Buffer,
//   username: string,
//   setTransferProgress?: React.Dispatch<
//     React.SetStateAction<{ progress: string; speed: string }>
//   >
// ): Promise<void> {
//   if (connectedSockets.length === 0) {
//     console.log("❌ No connected clients to send file.");
//     return;
//   }

//   const fileName = filePath.split("/").pop() || "unknown";
//   console.log(
//     `📤 Preparing to send file: ${fileName} (${fileData.length} bytes)`
//   );
//   await Promise.all(
//     connectedSockets.map((socket) =>
//       sendFileInChunks(socket, fileName, fileData, username)
//     )
//   );
//   setTransferProgress?.({
//     progress: `${fileData.length}/${fileData.length} bytes`,
//     speed: "0 KB/s",
//   });
//   console.log(`📤 Sent file: ${fileName} from ${username} to all clients`);
// }

// // Updated sendMultipleHostFiles with dynamic chunking
// export async function sendMultipleHostFiles(
//   server: any,
//   files: { filePath: string; fileData: Buffer }[],
//   username: string,
//   setTransferProgress?: React.Dispatch<
//     React.SetStateAction<{ progress: string; speed: string }>
//   >
// ): Promise<void> {
//   if (connectedSockets.length === 0) {
//     console.log("❌ No connected clients to send files.");
//     return;
//   }

//   for (const { filePath, fileData } of files) {
//     const fileName = filePath.split("/").pop() || "unknown";
//     console.log(
//       `📤 Preparing to send file: ${fileName} (${fileData.length} bytes)`
//     );
//     await Promise.all(
//       connectedSockets.map((socket) =>
//         sendFileInChunks(socket, fileName, fileData, username)
//       )
//     );
//     setTransferProgress?.({
//       progress: `${fileData.length}/${fileData.length} bytes`,
//       speed: "0 KB/s",
//     });
//     console.log(`📤 Sent file: ${fileName} from ${username} to all clients`);
//   }
// }

// // Unchanged sendHostMessage
// export function sendHostMessage(
//   server: any,
//   message: string,
//   username: string
// ): void {
//   if (connectedSockets.length === 0) {
//     console.log("❌ No connected clients to send message.");
//     return;
//   }
//   const formattedMessage = `${username}: ${message}`;
//   console.log("📤 Sending message from Host:", formattedMessage);
//   connectedSockets.forEach((socket) => {
//     socket.write(formattedMessage, (err: Error) => {
//       if (err)
//         console.error(
//           `❌ Write Error to ${socket.remoteAddress}:`,
//           err.stack || err.message || err
//         );
//     });
//   });
// }

// Working till now

// import dgram from "react-native-udp";
// import {
//   getLocalIPAddress,
//   getBroadcastIPAddress,
//   calculateChunkSize,
//   checkTransferLimits,
//   checkIncomingLimits,
//   QUEUE_RETRY_DELAY,
// } from "../utils/networkUtils";
// import RNFS from "react-native-fs";
// import { Buffer } from "buffer";
// import { chunkStorage } from "./ChunkStorage";
// import { Logger } from "../utils/Logger";
// import { DropShareError, ERROR_CODES } from "../utils/Error";
// import TCPSocket from "react-native-tcp-socket";
// import { FileTransfer, TransferProgress } from "../types/global";

// type UdpSocket = ReturnType<typeof dgram.createSocket>;

// const UDP_PORT = 5000;
// const TCP_PORT = 6000;

// let connectedSockets: TCPSocket.Socket[] = [];
// let isServerRunning = false;
// let udpSocket: UdpSocket | null = null;
// let server: TCPSocket.Server | null = null;

// export async function startHostServer(
//   username: string,
//   setDevices: React.Dispatch<React.SetStateAction<Device[]>>,
//   setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Server | null>>,
//   setMessages: React.Dispatch<React.SetStateAction<string[]>>,
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
//   setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
// ): Promise<void> {
//   if (isServerRunning) {
//     Logger.info("Host server already running, skipping start.");
//     return;
//   }
//   isServerRunning = true;

//   try {
//     await chunkStorage.initialize();
//     const ip = await getLocalIPAddress();
//     const broadcastAddr = await getBroadcastIPAddress();
//     Logger.info(`Host started on IP: ${ip}, Broadcasting to: ${broadcastAddr}`);

//     udpSocket = dgram.createSocket({ type: "udp4" });
//     udpSocket.bind(UDP_PORT);

//     udpSocket.once("listening", () => {
//       Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
//       udpSocket!.setBroadcast(true);
//       const broadcastInterval = setInterval(() => {
//         const message = JSON.stringify({ role: "Host", ip, name: username });
//         udpSocket!.send(
//           Buffer.from(message),
//           0,
//           message.length,
//           UDP_PORT,
//           broadcastAddr,
//           (err) => {
//             if (err) Logger.error("UDP Send Error", err);
//           }
//         );
//       }, 2000);

//       udpSocket!.on("close", () => clearInterval(broadcastInterval));
//     });

//     udpSocket.on("error", (err: Error) => {
//       Logger.error("UDP Socket Error", err);
//       isServerRunning = false;
//       udpSocket?.close();
//       udpSocket = null;
//     });

//     server = new TCPSocket.Server();
//     server.on("connection", (socket: TCPSocket.Socket) => {
//       Logger.info(`Client connected: ${socket.remoteAddress}`);
//       connectedSockets.push(socket);
//       setSocket(server);
//       setDevices((prev) => [
//         ...prev.filter((d) => d.ip !== socket.remoteAddress),
//         {
//           ip: socket.remoteAddress || "Unknown",
//           name: "Client",
//           role: "Client",
//           deviceName: "Unknown",
//         },
//       ]);

//       const fileTransfers = new Map<string, FileTransfer>();
//       const incomingQueue: string[] = [];
//       let buffer = Buffer.alloc(0); // Buffer to accumulate partial data

//       socket.on("data", async (data: Buffer) => {
//         try {
//           buffer = Buffer.concat([buffer, data]); // Accumulate incoming data
//           Logger.info(`Buffer length: ${buffer.length}`); // Debug log
//           while (buffer.length > 0) {
//             const header = buffer.slice(0, 5).toString();
//             if (header === "FILE:") {
//               const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//               if (headerEnd === -1) {
//                 Logger.info(
//                   "Incomplete header received, waiting for more data..."
//                 );
//                 return; // Wait for more data
//               }
//               const headerStr = buffer.slice(5, headerEnd).toString();
//               Logger.info(`Parsed header: ${headerStr}`); // Debug log
//               let headerData: {
//                 name: string;
//                 size: number;
//                 sender: string;
//                 fileId?: string;
//               };
//               try {
//                 headerData = JSON.parse(headerStr);
//               } catch {
//                 throw new DropShareError(
//                   ERROR_CODES.INVALID_HEADER,
//                   "Invalid file header"
//                 );
//               }

//               const fileName = headerData.name;
//               const fileSize = headerData.size;
//               const deviceName = headerData.sender || "Unknown";
//               const fileId =
//                 headerData.fileId ||
//                 chunkStorage.generateFileId(
//                   socket.remoteAddress || "Unknown",
//                   fileName,
//                   Date.now()
//                 );

//               if (!fileName || !fileSize) {
//                 throw new DropShareError(
//                   ERROR_CODES.INVALID_HEADER,
//                   "Missing file name or size"
//                 );
//               }

//               if (!checkTransferLimits(fileSize, fileTransfers)) {
//                 socket.write(
//                   Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}`)
//                 );
//                 Logger.toast(
//                   `Transfer limit exceeded for ${fileName}`,
//                   "error"
//                 );
//                 buffer = Buffer.alloc(0); // Clear buffer on error
//                 return;
//               }

//               if (!checkIncomingLimits(fileTransfers)) {
//                 incomingQueue.push(fileId);
//                 socket.write(
//                   Buffer.from(
//                     `WAIT:Another transfer in progress, retry in ${
//                       QUEUE_RETRY_DELAY / 1000
//                     }s`
//                   )
//                 );
//                 Logger.info(
//                   `Queued transfer ${fileId} from ${socket.remoteAddress}`
//                 );
//                 buffer = Buffer.alloc(0); // Clear buffer on wait
//                 return;
//               }

//               let transfer = fileTransfers.get(fileId);
//               let record = await chunkStorage.getTransferRecord(fileId);
//               let startChunkIndex = 0;

//               if (record && record.status !== "completed") {
//                 startChunkIndex = record.lastChunkIndex + 1;
//                 socket.write(
//                   Buffer.from(`RESUME_ACK:${fileId}:${startChunkIndex}`)
//                 );
//                 Logger.info(
//                   `Resuming transfer ${fileId} from chunk ${startChunkIndex}`
//                 );
//               } else {
//                 const chunkSize = calculateChunkSize(fileSize);
//                 const totalChunks = Math.ceil(fileSize / chunkSize);
//                 record = {
//                   fileId,
//                   fileName,
//                   totalSize: fileSize,
//                   chunkSize,
//                   lastChunkIndex: -1,
//                   totalChunks,
//                   status: "in_progress",
//                   senderIp: socket.remoteAddress || "Unknown",
//                   timestamp: Date.now(),
//                   aesKey: "", // Placeholder for future AES-256-CBC encryption
//                   iv: "", // Placeholder for future AES-256-CBC encryption
//                 };
//                 await chunkStorage.saveTransferRecord(record);
//                 Logger.info(
//                   `Started new transfer ${fileId} (${fileSize} bytes) from ${deviceName}`
//                 );
//               }

//               if (!transfer) {
//                 transfer = {
//                   fileId,
//                   fileName,
//                   fileSize,
//                   deviceName,
//                   chunks: Array(record.totalChunks).fill(undefined),
//                   receivedBytes: startChunkIndex * record.chunkSize,
//                   startTime: Date.now(),
//                   totalChunks: record.totalChunks,
//                   chunkSize: record.chunkSize,
//                   totalSize: fileSize,
//                   senderIp: socket.remoteAddress || "Unknown",
//                   chunkHashes: [],
//                   status: "Receiving",
//                   progress: 0,
//                 };
//                 fileTransfers.set(fileId, transfer);
//               }

//               let remainingBuffer = buffer.slice(headerEnd + 2); // Keep remaining data
//               buffer = Buffer.alloc(0); // Clear original buffer
//               while (remainingBuffer.length > 0) {
//                 const chunkIndex = Math.floor(
//                   transfer.receivedBytes / transfer.chunkSize
//                 );
//                 const chunkSizeBytes = Math.min(
//                   transfer.chunkSize,
//                   transfer.totalSize - transfer.receivedBytes
//                 );
//                 if (remainingBuffer.length >= chunkSizeBytes) {
//                   const chunkData = remainingBuffer.slice(0, chunkSizeBytes);
//                   await chunkStorage.saveChunk(fileId, chunkIndex, chunkData);
//                   transfer.chunks[chunkIndex] = chunkData;
//                   transfer.receivedBytes += chunkData.length;
//                   await chunkStorage.updateLastChunkIndex(fileId, chunkIndex);
//                   Logger.info(
//                     `Processed chunk ${chunkIndex} for ${fileId}, ${transfer.receivedBytes}/${fileSize} bytes`
//                   );

//                   const elapsedTime =
//                     (Date.now() - transfer.startTime) / 1000 || 1;
//                   const speed = (
//                     transfer.receivedBytes /
//                     elapsedTime /
//                     1024
//                   ).toFixed(2);
//                   const percentage = (transfer.receivedBytes / fileSize) * 100;
//                   setTransferProgress?.((prev) => [
//                     ...prev.filter((p) => p.fileId !== fileId),
//                     {
//                       fileId,
//                       fileName,
//                       progress: `${transfer.receivedBytes}/${fileSize} bytes`,
//                       speed: `${speed} KB/s`,
//                       percentage,
//                     },
//                   ]);

//                   if (transfer.receivedBytes >= fileSize) {
//                     const savePath = await chunkStorage.assembleFile(
//                       fileId,
//                       fileName
//                     );
//                     setReceivedFiles((prev) => [...prev, savePath]);
//                     Logger.info(
//                       `Received and saved file: ${savePath} from ${deviceName}`
//                     );
//                     fileTransfers.delete(fileId);

//                     if (incomingQueue.length > 0) {
//                       const nextFileId = incomingQueue.shift();
//                       if (nextFileId) {
//                         socket.write(Buffer.from(`START:${nextFileId}`));
//                         Logger.info(`Started queued transfer ${nextFileId}`);
//                       }
//                     }
//                   }
//                   remainingBuffer = remainingBuffer.slice(chunkSizeBytes);
//                 } else {
//                   break; // Wait for more data
//                 }
//               }
//               buffer = remainingBuffer; // Update buffer with any unprocessed data
//             } else if (buffer.toString().startsWith("RESUME_REQUEST:")) {
//               const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//               if (headerEnd === -1) {
//                 Logger.info(
//                   "Incomplete RESUME_REQUEST, waiting for more data..."
//                 );
//                 return;
//               }
//               const message = buffer.slice(0, headerEnd + 2).toString();
//               const [, fileId, lastChunkIndexStr] = message.split(":");
//               const lastChunkIndex = parseInt(lastChunkIndexStr, 10);
//               const record = await chunkStorage.getTransferRecord(fileId);
//               if (record && record.lastChunkIndex >= lastChunkIndex) {
//                 socket.write(
//                   Buffer.from(
//                     `RESUME_ACK:${fileId}:${record.lastChunkIndex + 1}`
//                   )
//                 );
//                 Logger.info(
//                   `Sent RESUME_ACK for ${fileId} at chunk ${
//                     record.lastChunkIndex + 1
//                   }`
//                 );
//               } else {
//                 socket.write(Buffer.from(`RESTART:${fileId}`));
//                 Logger.info(`Sent RESTART for ${fileId}`);
//               }
//               buffer = buffer.slice(headerEnd + 2);
//             } else {
//               const messageEnd = buffer.indexOf(Buffer.from("\n"));
//               if (messageEnd === -1) {
//                 Logger.info("Incomplete message, waiting for more data...");
//                 return;
//               }
//               const message = buffer.slice(0, messageEnd + 1).toString();
//               Logger.info(`Received message: ${message}`);
//               setMessages((prev) => [...prev, message]);
//               connectedSockets.forEach((s) => {
//                 if (s !== socket) s.write(Buffer.from(message));
//               });
//               buffer = buffer.slice(messageEnd + 1);
//             }
//           }
//         } catch (error) {
//           Logger.error("Error processing data", error);
//           const err = DropShareError.from(
//             error,
//             ERROR_CODES.NETWORK_ERROR,
//             "Data processing failed"
//           );
//           socket.write(Buffer.from(`ERROR:${err.code}:${err.message}`));
//           buffer = Buffer.alloc(0); // Clear buffer on error
//         }
//       });

//       socket.on("close", () => {
//         Logger.info(`Client disconnected: ${socket.remoteAddress}`);
//         connectedSockets = connectedSockets.filter((s) => s !== socket);
//         setDevices((prev) => prev.filter((d) => d.ip !== socket.remoteAddress));
//         fileTransfers.clear();
//       });

//       socket.on("error", (err) => {
//         Logger.error(`Host Socket Error for ${socket.remoteAddress}`, err);
//         fileTransfers.clear();
//       });
//     });

//     server.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
//       Logger.info(`Host TCP server running on port ${TCP_PORT}`);
//     });

//     server.on("error", (err) => {
//       Logger.error("Server Error", err);
//       stopHostServer();
//     });

//     server.on("close", () => {
//       Logger.info("Host TCP server closed");
//       isServerRunning = false;
//     });
//   } catch (err) {
//     Logger.error("Failed to start host server", err);
//     isServerRunning = false;
//     stopHostServer();
//   }
// }

// async function sendFileInChunks(
//   socket: TCPSocket.Socket,
//   fileName: string,
//   filePath: string,
//   deviceName: string,
//   fileId: string
// ): Promise<void> {
//   try {
//     const fileSize = (await RNFS.stat(filePath)).size;
//     const chunkSize = calculateChunkSize(fileSize);
//     const totalChunks = Math.ceil(fileSize / chunkSize);
//     const header = Buffer.from(
//       `FILE:${JSON.stringify({
//         name: fileName,
//         size: fileSize,
//         sender: deviceName,
//         fileId,
//       })}\n\n`
//     );

//     await new Promise<void>((resolve, reject) => {
//       socket.write(header, "binary", (err) => (err ? reject(err) : resolve()));
//     });

//     let sentBytes = 0;
//     const startTime = Date.now();
//     const fileContent = await RNFS.readFile(filePath, "base64");
//     const chunks =
//       fileContent.match(new RegExp(`.{1,${chunkSize}}`, "g")) || [];

//     for (const chunk of chunks) {
//       const chunkBuffer = Buffer.from(chunk, "base64");
//       await new Promise<void>((resolve, reject) => {
//         socket.write(chunkBuffer, "binary", (err) =>
//           err ? reject(err) : resolve()
//         );
//       });
//       sentBytes += chunkBuffer.length;
//       const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//       const speed = (sentBytes / elapsedTime / 1024).toFixed(2);
//       Logger.info(
//         `Sent chunk: ${sentBytes}/${fileSize} bytes at ${speed} KB/s`
//       );
//     }

//     Logger.info(`Sent file: ${fileName} from ${deviceName}`);
//   } catch (error) {
//     Logger.error(`Failed to send file ${fileName}`, error);
//     throw DropShareError.from(
//       error,
//       ERROR_CODES.NETWORK_ERROR,
//       "File transfer failed"
//     );
//   }
// }

// export async function sendHostFile(
//   server: TCPSocket.Server | null,
//   filePath: string,
//   fileData: Buffer,
//   username: string,
//   setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
// ): Promise<void> {
//   if (!server || connectedSockets.length === 0) {
//     Logger.toast("No connected clients to send file", "error");
//     return;
//   }

//   const fileName = filePath.split("/").pop() || "unknown";
//   const fileId = chunkStorage.generateFileId("Host", fileName, Date.now());
//   const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//   await RNFS.writeFile(tempPath, fileData.toString("base64"), "base64");

//   await Promise.all(
//     connectedSockets.map((socket) =>
//       sendFileInChunks(socket, fileName, tempPath, username, fileId)
//     )
//   );

//   setTransferProgress?.((prev) => [
//     ...prev.filter((p) => p.fileId !== fileId),
//     {
//       fileId,
//       fileName,
//       progress: `${fileData.length}/${fileData.length} bytes`,
//       speed: "0 KB/s",
//       percentage: 100,
//     },
//   ]);

//   await RNFS.unlink(tempPath);
//   Logger.info(`Sent file: ${fileName} from ${username} to all clients`);
// }

// export async function sendMultipleHostFiles(
//   server: TCPSocket.Server | null,
//   files: { filePath: string; fileData: Buffer }[],
//   username: string,
//   setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
// ): Promise<void> {
//   if (!server || connectedSockets.length === 0) {
//     Logger.toast("No connected clients to send files", "error");
//     return;
//   }

//   const fileTransfers = new Map<string, FileTransfer>();
//   const queue: { filePath: string; fileData: Buffer }[] = [...files];

//   while (queue.length > 0) {
//     const { filePath, fileData } = queue.shift()!;
//     const fileName = filePath.split("/").pop() || "unknown";
//     const fileId = chunkStorage.generateFileId("Host", fileName, Date.now());

//     if (!checkTransferLimits(fileData.length, fileTransfers)) {
//       Logger.toast(`Transfer limit exceeded for ${fileName}, queuing`, "warn");
//       queue.unshift({ filePath, fileData });
//       await new Promise((resolve) => setTimeout(resolve, 1000));
//       continue;
//     }

//     const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//     await RNFS.writeFile(tempPath, fileData.toString("base64"), "base64");

//     await Promise.all(
//       connectedSockets.map((socket) =>
//         sendFileInChunks(socket, fileName, tempPath, username, fileId)
//       )
//     );

//     setTransferProgress?.((prev) => [
//       ...prev.filter((p) => p.fileId !== fileId),
//       {
//         fileId,
//         fileName,
//         progress: `${fileData.length}/${fileData.length} bytes`,
//         speed: "0 KB/s",
//         percentage: 100,
//       },
//     ]);

//     await RNFS.unlink(tempPath);
//     Logger.info(`Sent file: ${fileName} from ${username} to all clients`);
//   }
// }

// export function sendHostMessage(
//   server: TCPSocket.Server | null,
//   message: string,
//   username: string
// ): void {
//   if (!server || connectedSockets.length === 0) {
//     Logger.toast("No connected clients to send message", "error");
//     return;
//   }
//   const formattedMessage = `${username}: ${message}`;
//   Logger.info(`Sending message from Host: ${formattedMessage}`);
//   connectedSockets.forEach((socket) =>
//     socket.write(Buffer.from(formattedMessage))
//   );
// }

// export function stopHostServer(): void {
//   Logger.info("Stopping host server...");
//   isServerRunning = false;

//   if (udpSocket) {
//     udpSocket.close();
//     udpSocket = null;
//     Logger.info("UDP socket closed");
//   }

//   if (server) {
//     server.close();
//     server = null;
//     Logger.info("TCP server closed");
//   }

//   connectedSockets.forEach((socket) => {
//     socket.destroy();
//     Logger.info(`Closed socket for ${socket.remoteAddress}`);
//   });
//   connectedSockets = [];
//   Logger.info("Host server stopped");
// }

// export function kickClient(clientIp: string): void {
//   const socket = connectedSockets.find((s) => s.remoteAddress === clientIp);
//   if (!socket) {
//     Logger.warn(`No client found with IP ${clientIp}`);
//     return;
//   }
//   socket.end();
//   connectedSockets = connectedSockets.filter(
//     (s) => s.remoteAddress !== clientIp
//   );
//   Logger.info(`Kicked client ${clientIp}`);
// }

// import dgram from "react-native-udp";
// import {
//   getLocalIPAddress,
//   getBroadcastIPAddress,
//   calculateChunkSize,
//   checkTransferLimits,
// } from "../utils/networkUtils";
// import RNFS from "react-native-fs";
// import { Buffer } from "buffer";
// import { chunkStorage } from "./ChunkStorage";
// import { Logger } from "../utils/Logger";
// import { DropShareError, ERROR_CODES } from "../utils/Error";
// import TCPSocket from "react-native-tcp-socket";
// import { generateAESKey, encryptData, decryptData } from "../utils/Crypto";

// type UdpSocket = ReturnType<typeof dgram.createSocket>;

// const UDP_PORT = 5000;
// const TCP_PORT = 6000;
// const ACK_TIMEOUT = 5000;
// const MAX_CLIENTS = 5;

// interface ConnectedSocket extends TCPSocket.Socket {
//   sessionKey?: string;
//   iv?: string;
// }
// let connectedSockets: ConnectedSocket[] = [];
// let isServerRunning = false;
// let udpSocket: UdpSocket | null = null;
// let server: TCPSocket.Server | null = null;
// const TRANSFER_QUEUE: {
//   socket: ConnectedSocket;
//   fileId: string;
//   chunkIndex: number;
// }[] = [];

// export async function startHostServer(
//   username: string,
//   setDevices: React.Dispatch<React.SetStateAction<Device[]>>,
//   setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Server | null>>,
//   setMessages: React.Dispatch<React.SetStateAction<string[]>>,
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
//   setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
// ): Promise<void> {
//   if (isServerRunning) {
//     Logger.info("Host server already running, skipping start.");
//     return;
//   }
//   isServerRunning = true;

//   try {
//     await chunkStorage.initialize();
//     const ip = await getLocalIPAddress();
//     const broadcastAddr = await getBroadcastIPAddress();
//     Logger.info(`Host started on IP: ${ip}, Broadcasting to: ${broadcastAddr}`);

//     udpSocket = dgram.createSocket({ type: "udp4" });
//     udpSocket.bind(UDP_PORT);

//     udpSocket.once("listening", () => {
//       Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
//       udpSocket!.setBroadcast(true);
//       const broadcastInterval = setInterval(() => {
//         const message = JSON.stringify({ role: "Host", ip, name: username });
//         udpSocket!.send(
//           Buffer.from(message),
//           0,
//           message.length,
//           UDP_PORT,
//           broadcastAddr,
//           (err) => {
//             if (err) Logger.error("UDP Send Error", err);
//           }
//         );
//       }, 2000);

//       udpSocket!.on("close", () => clearInterval(broadcastInterval));
//     });

//     udpSocket.on("error", (err: Error) => {
//       Logger.error("UDP Socket Error", err);
//       isServerRunning = false;
//       udpSocket?.close();
//       udpSocket = null;
//     });

//     server = new TCPSocket.Server();
//     server.on("connection", async (socket: ConnectedSocket) => {
//       if (connectedSockets.length >= MAX_CLIENTS) {
//         socket.write(Buffer.from(`ERROR:${ERROR_CODES.MAX_CLIENTS_REACHED}\n`));
//         socket.destroy();
//         Logger.warn("Max clients reached, rejecting new connection");
//         return;
//       }

//       Logger.info(`Client connected: ${socket.remoteAddress}`);
//       connectedSockets.push(socket);
//       setSocket(server);
//       setDevices((prev) => [
//         ...prev.filter((d) => d.ip !== socket.remoteAddress),
//         {
//           ip: socket.remoteAddress || "Unknown",
//           name: "Unknown",
//           role: "Client",
//         },
//       ]);

//       const fileTransfers = new Map<string, FileTransfer>();
//       let buffer = Buffer.alloc(0);
//       let inFileTransfer = false;

//       const { key, iv } = await generateAESKey();
//       socket.sessionKey = key;
//       socket.iv = iv;
//       socket.write(Buffer.from(`SESSION:${key}:${iv}\n`));

//       socket.on("data", async (data: string | Buffer) => {
//         try {
//           buffer = Buffer.concat([
//             buffer,
//             typeof data === "string" ? Buffer.from(data) : data,
//           ]);

//           // Process messages while buffer has data
//           while (buffer.length > 0) {
//             const dataStr = buffer.toString();
//             const validPrefixes = [
//               "FILE:",
//               "CHUNK:",
//               "MSG:",
//               "CHECK_CHUNKS:",
//               "ACK_START:",
//               "ACK_CHUNKS:",
//               "ACK_CHUNK:",
//               "SESSION:",
//               "ERROR:",
//             ];
//             const hasValidPrefix = validPrefixes.some((prefix) =>
//               dataStr.startsWith(prefix)
//             );

//             if (!hasValidPrefix) {
//               Logger.warn(
//                 `Invalid data from ${socket.remoteAddress}: ${dataStr.slice(
//                   0,
//                   50
//                 )}...`
//               );
//               socket.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }

//             if (!inFileTransfer) {
//               if (dataStr.startsWith("FILE:")) {
//                 const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//                 if (headerEnd === -1) {
//                   Logger.info(
//                     `Incomplete FILE header from ${socket.remoteAddress}, waiting...`
//                   );
//                   return;
//                 }
//                 const headerStr = buffer.slice(5, headerEnd).toString();
//                 Logger.info(`Parsed header: ${headerStr}`);
//                 let headerData: {
//                   name: string;
//                   size: number;
//                   sender: string;
//                   fileId: string;
//                 };
//                 try {
//                   headerData = JSON.parse(headerStr);
//                 } catch {
//                   throw new DropShareError(
//                     ERROR_CODES.INVALID_HEADER,
//                     "Invalid file header"
//                   );
//                 }

//                 const fileName = headerData.name;
//                 const fileSize = headerData.size;
//                 const deviceName = headerData.sender || "Unknown";
//                 const fileId = headerData.fileId;

//                 if (!fileName || !fileSize || !fileId) {
//                   throw new DropShareError(
//                     ERROR_CODES.INVALID_HEADER,
//                     "Missing file name, size, or ID"
//                   );
//                 }

//                 if (!checkTransferLimits(fileSize, fileTransfers)) {
//                   socket.write(
//                     Buffer.from(
//                       `ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`
//                     )
//                   );
//                   Logger.toast(
//                     `Transfer limit exceeded for ${fileName}`,
//                     "error"
//                   );
//                   buffer = Buffer.alloc(0);
//                   return;
//                 }

//                 let transfer = fileTransfers.get(fileId);
//                 let record = await chunkStorage.getTransferRecord(fileId);
//                 let startChunkIndex = 0;

//                 if (record && record.status !== "completed") {
//                   startChunkIndex = record.lastChunkIndex + 1;
//                   socket.write(
//                     Buffer.from(
//                       `ACK_START:${fileId}:${record.lastChunkIndex}\n`
//                     )
//                   );
//                   Logger.info(
//                     `Resuming transfer ${fileId} from chunk ${startChunkIndex}`
//                   );
//                 } else {
//                   const chunkSize = calculateChunkSize(fileSize);
//                   const totalChunks = Math.ceil(fileSize / chunkSize);
//                   const { key, iv } = await generateAESKey();
//                   record = {
//                     fileId,
//                     fileName,
//                     totalSize: fileSize,
//                     chunkSize,
//                     lastChunkIndex: -1,
//                     totalChunks,
//                     status: "in_progress",
//                     senderIp: socket.remoteAddress || "Unknown",
//                     timestamp: Date.now(),
//                     aesKey: key,
//                     iv,
//                     direction: "receiving", // Verified: Matches schema
//                   };
//                   await chunkStorage.saveTransferRecord(record);
//                   socket.write(Buffer.from(`ACK_START:${fileId}:-1\n`));
//                   Logger.info(
//                     `Started new transfer ${fileId} (${fileSize} bytes) from ${deviceName}`
//                   );
//                 }

//                 if (!transfer) {
//                   transfer = {
//                     fileId,
//                     fileName,
//                     fileSize,
//                     deviceName,
//                     chunks: Array(record.totalChunks).fill(undefined),
//                     receivedBytes: startChunkIndex * record.chunkSize,
//                     startTime: Date.now(),
//                     totalChunks: record.totalChunks,
//                     chunkSize: record.chunkSize,
//                     totalSize: fileSize,
//                     senderIp: socket.remoteAddress || "Unknown",
//                     chunkHashes: [],
//                     status: "Receiving",
//                     progress: 0,
//                     lastChunkIndex: startChunkIndex - 1,
//                   };
//                   fileTransfers.set(fileId, transfer);
//                 }

//                 inFileTransfer = true;
//                 buffer = buffer.slice(headerEnd + 2);
//               } else if (dataStr.startsWith("CHECK_CHUNKS:")) {
//                 const messageEnd = buffer.indexOf(Buffer.from("\n"));
//                 if (messageEnd === -1) {
//                   Logger.info(
//                     `Incomplete CHECK_CHUNKS from ${socket.remoteAddress}, waiting...`
//                   );
//                   return;
//                 }
//                 const message = buffer.slice(0, messageEnd).toString();
//                 const [, fileId, lastSentIndex] = message.split(":");
//                 const record = await chunkStorage.getTransferRecord(fileId);
//                 const lastReceivedIndex = record ? record.lastChunkIndex : -1;
//                 socket.write(
//                   Buffer.from(`ACK_CHUNKS:${fileId}:${lastReceivedIndex}\n`)
//                 );
//                 buffer = buffer.slice(messageEnd + 1);
//               } else if (dataStr.startsWith("MSG:")) {
//                 const messageEnd = buffer.indexOf(Buffer.from("\n"));
//                 if (messageEnd === -1) {
//                   Logger.info(
//                     `Incomplete MSG from ${socket.remoteAddress}, waiting...`
//                   );
//                   return;
//                 }
//                 const encryptedMsg = buffer.slice(4, messageEnd).toString();
//                 const [iv, encrypted] = encryptedMsg.split(":");
//                 const decrypted = await decryptData(
//                   Buffer.from(encrypted, "base64"),
//                   socket.sessionKey || "",
//                   iv
//                 );
//                 const message = decrypted.toString();
//                 setMessages((prev) => [
//                   ...prev,
//                   `${socket.remoteAddress}: ${message}`,
//                 ]);
//                 connectedSockets
//                   .filter((s) => s !== socket)
//                   .forEach(async (s) => {
//                     const newIv = CryptoJS.lib.WordArray.random(16).toString(
//                       CryptoJS.enc.Hex
//                     );
//                     const reEncrypted = await encryptData(
//                       Buffer.from(message),
//                       s.sessionKey || "",
//                       newIv
//                     );
//                     s.write(
//                       Buffer.from(
//                         `MSG:${newIv}:${reEncrypted.toString("base64")}\n`
//                       )
//                     );
//                   });
//                 buffer = buffer.slice(messageEnd + 1);
//               } else if (dataStr.startsWith("CHUNK:")) {
//                 const chunkEnd = buffer.indexOf(Buffer.from("\n"));
//                 if (chunkEnd === -1) {
//                   Logger.info(
//                     `Incomplete CHUNK header from ${socket.remoteAddress}, waiting...`
//                   );
//                   return;
//                 }
//                 const chunkHeader = buffer.slice(0, chunkEnd).toString();
//                 const [, fileId, chunkIndexStr, iv, encrypted] =
//                   chunkHeader.split(":");
//                 const chunkIndex = parseInt(chunkIndexStr);
//                 const record = await chunkStorage.getTransferRecord(fileId);
//                 if (!record) {
//                   Logger.warn(`No record for ${fileId}, ignoring chunk`);
//                   buffer = Buffer.alloc(0);
//                   return;
//                 }
//                 const chunkData = await decryptData(
//                   Buffer.from(encrypted, "base64"),
//                   record.aesKey || "",
//                   iv
//                 );
//                 const transfer = fileTransfers.get(fileId)!;
//                 await chunkStorage.saveChunk(fileId, chunkIndex, chunkData);
//                 transfer.chunks[chunkIndex] = chunkData;
//                 transfer.receivedBytes += chunkData.length;
//                 await chunkStorage.updateLastChunkIndex(fileId, chunkIndex);
//                 socket.write(
//                   Buffer.from(`ACK_CHUNK:${fileId}:${chunkIndex}\n`)
//                 );
//                 Logger.info(
//                   `Processed and ACKed chunk ${chunkIndex} for ${fileId}, ${transfer.receivedBytes}/${transfer.totalSize} bytes`
//                 );

//                 const elapsedTime =
//                   (Date.now() - transfer.startTime) / 1000 || 1;
//                 const speed = (
//                   transfer.receivedBytes /
//                   elapsedTime /
//                   1024
//                 ).toFixed(2);
//                 const percentage =
//                   (transfer.receivedBytes / transfer.totalSize) * 100;
//                 setTransferProgress?.((prev) => [
//                   ...prev.filter((p) => p.fileId !== fileId),
//                   {
//                     fileId,
//                     fileName: transfer.fileName,
//                     progress: `${transfer.receivedBytes}/${transfer.totalSize} bytes`,
//                     speed: `${speed} KB/s`,
//                     percentage,
//                   },
//                 ]);

//                 if (transfer.receivedBytes >= transfer.totalSize) {
//                   const savePath = await chunkStorage.assembleFile(
//                     fileId,
//                     transfer.fileName
//                   );
//                   setReceivedFiles((prev) => [...prev, savePath]);
//                   Logger.info(
//                     `Received and saved file: ${savePath} from ${transfer.deviceName}`
//                   );
//                   fileTransfers.delete(fileId);
//                   inFileTransfer = false;
//                 }
//                 buffer = buffer.slice(chunkEnd + 1);
//               } else if (
//                 dataStr.startsWith("SESSION:") ||
//                 dataStr.startsWith("ACK_START:") ||
//                 dataStr.startsWith("ACK_CHUNKS:") ||
//                 dataStr.startsWith("ACK_CHUNK:") ||
//                 dataStr.startsWith("ERROR:")
//               ) {
//                 const messageEnd = buffer.indexOf(Buffer.from("\n"));
//                 if (messageEnd === -1) {
//                   Logger.info(
//                     `Incomplete ${dataStr.slice(0, 10)} from ${
//                       socket.remoteAddress
//                     }, waiting...`
//                   );
//                   return;
//                 }
//                 // Skip processing these as they are handled elsewhere or are responses
//                 buffer = buffer.slice(messageEnd + 1);
//               } else {
//                 Logger.warn(
//                   `Unknown data from ${socket.remoteAddress}: ${dataStr.slice(
//                     0,
//                     50
//                   )}...`
//                 );
//                 socket.write(
//                   Buffer.from(
//                     `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
//                   )
//                 );
//                 buffer = Buffer.alloc(0);
//               }
//             }
//           }
//         } catch (error) {
//           Logger.error(
//             `Error processing data from ${socket.remoteAddress}`,
//             error
//           );
//           const err = DropShareError.from(
//             error,
//             ERROR_CODES.NETWORK_ERROR,
//             "Data processing failed"
//           );
//           socket.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
//           buffer = Buffer.alloc(0);
//           inFileTransfer = false;
//         }
//       });

//       socket.on("close", () => {
//         Logger.info(`Client disconnected: ${socket.remoteAddress}`);
//         connectedSockets = connectedSockets.filter((s) => s !== socket);
//         setDevices((prev) => prev.filter((d) => d.ip !== socket.remoteAddress));
//       });

//       socket.on("error", (err) => {
//         Logger.error(`Host Socket Error for ${socket.remoteAddress}`, err);
//       });
//     });

//     server.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
//       Logger.info(`Host TCP server running on port ${TCP_PORT}`);
//     });

//     server.on("error", (err) => {
//       Logger.error("Server Error", err);
//       stopHostServer();
//     });

//     server.on("close", () => {
//       Logger.info("Host TCP server closed");
//       isServerRunning = false;
//     });
//   } catch (err) {
//     Logger.error("Failed to start host server", err);
//     isServerRunning = false;
//     stopHostServer();
//   }
// }

// async function sendFileInChunks(
//   socket: ConnectedSocket,
//   fileName: string,
//   filePath: string,
//   deviceName: string,
//   fileId: string,
//   setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
// ): Promise<void> {
//   try {
//     const fileSize = (await RNFS.stat(filePath)).size;
//     const chunkSize = calculateChunkSize(fileSize);
//     const totalChunks = Math.ceil(fileSize / chunkSize);
//     const record = await chunkStorage.getTransferRecord(fileId);
//     let lastSentChunkIndex = record ? record.lastChunkIndex : -1;
//     await new Promise<void>((resolve, reject) => {
//       const timeout = setTimeout(() => {
//         reject(
//           new DropShareError(
//             ERROR_CODES.NETWORK_ERROR,
//             "Timeout waiting for ACK_CHUNKS"
//           )
//         );
//       }, ACK_TIMEOUT);
//       socket.once("data", (data) => {
//         clearTimeout(timeout);
//         const message = data.toString();
//         if (message.startsWith("ACK_CHUNKS:")) {
//           const [, ackFileId, lastReceivedIndex] = message.split(":");
//           if (ackFileId === fileId) {
//             lastSentChunkIndex = Math.min(
//               parseInt(lastReceivedIndex),
//               lastSentChunkIndex
//             );
//             resolve();
//           } else {
//             reject(
//               new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 "Invalid ACK_CHUNKS response"
//               )
//             );
//           }
//         }
//       });
//       socket.write(
//         Buffer.from(`CHECK_CHUNKS:${fileId}:${lastSentChunkIndex}\n`)
//       );
//     });

//     const header = Buffer.from(
//       `FILE:${JSON.stringify({
//         name: fileName,
//         size: fileSize,
//         sender: deviceName,
//         fileId,
//       })}\n\n`
//     );

//     await new Promise<void>((resolve, reject) => {
//       socket.write(header, "binary", (err) => (err ? reject(err) : resolve()));
//     });
//     Logger.info(`Sent header for ${fileId}`);

//     let sentBytes = (lastSentChunkIndex + 1) * chunkSize;
//     const startTime = Date.now();
//     const { key, iv } = await generateAESKey();

//     if (!record) {
//       await chunkStorage.saveTransferRecord({
//         fileId,
//         fileName,
//         filePath,
//         totalSize: fileSize,
//         chunkSize,
//         lastChunkIndex: -1,
//         totalChunks,
//         status: "in_progress",
//         senderIp: await getLocalIPAddress(),
//         timestamp: Date.now(),
//         aesKey: key,
//         iv,
//         direction: "sending",
//       });
//     }

//     for (
//       let chunkIndex = lastSentChunkIndex + 1;
//       chunkIndex < totalChunks;
//       chunkIndex++
//     ) {
//       const offset = chunkIndex * chunkSize;
//       const length = Math.min(chunkSize, fileSize - offset);
//       const chunkData = await RNFS.read(filePath, length, offset, "base64");
//       const chunkBuffer = Buffer.from(chunkData, "base64");
//       await chunkStorage.saveSentChunk(fileId, chunkIndex, chunkBuffer);

//       const chunkIv = CryptoJS.lib.WordArray.random(16).toString(
//         CryptoJS.enc.Hex
//       );
//       const encrypted = await encryptData(chunkBuffer, key, chunkIv);
//       await new Promise<void>((resolve, reject) => {
//         const timeout = setTimeout(() => {
//           reject(
//             new DropShareError(
//               ERROR_CODES.NETWORK_ERROR,
//               `Timeout waiting for ACK_CHUNK ${chunkIndex}`
//             )
//           );
//         }, ACK_TIMEOUT);
//         socket.once("data", (data) => {
//           clearTimeout(timeout);
//           const message = data.toString();
//           if (
//             message.startsWith("ACK_CHUNK:") &&
//             message.includes(`${fileId}:${chunkIndex}`)
//           ) {
//             resolve();
//           } else {
//             reject(
//               new DropShareError(
//                 ERROR_CODES.NETWORK_ERROR,
//                 "Invalid ACK_CHUNK response"
//               )
//             );
//           }
//         });
//         socket.write(
//           Buffer.from(
//             `CHUNK:${fileId}:${chunkIndex}:${chunkIv}:${encrypted.toString(
//               "base64"
//             )}\n`
//           )
//         );
//       });

//       sentBytes += chunkBuffer.length;
//       await chunkStorage.updateLastChunkIndex(fileId, chunkIndex);
//       const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//       const speed = (sentBytes / elapsedTime / 1024).toFixed(2);
//       setTransferProgress?.((prev) => [
//         ...prev.filter((p) => p.fileId !== fileId),
//         {
//           fileId,
//           fileName,
//           progress: `${sentBytes}/${fileSize} bytes`,
//           speed: `${speed} KB/s`,
//           percentage: (sentBytes / fileSize) * 100,
//         },
//       ]);
//       Logger.info(
//         `Sent chunk ${chunkIndex} for ${fileId}, ${sentBytes}/${fileSize} bytes`
//       );
//     }

//     Logger.info(`Sent file: ${fileName} from ${deviceName}`);
//   } catch (error) {
//     Logger.error(`Failed to send file ${fileName}`, error);
//     throw DropShareError.from(
//       error,
//       ERROR_CODES.NETWORK_ERROR,
//       "File transfer failed"
//     );
//   }
// }

// export async function sendHostFile(
//   server: TCPSocket.Server | null,
//   filePath: string,
//   fileData: Buffer,
//   username: string,
//   setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
// ): Promise<void> {
//   if (!server || connectedSockets.length === 0) {
//     Logger.toast("No connected clients to send file", "error");
//     return;
//   }

//   const fileName = filePath.split("/").pop() || "unknown";
//   const senderIp = await getLocalIPAddress();
//   const fileId = chunkStorage.generateFileId(fileName);
//   const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//   await RNFS.writeFile(tempPath, fileData.toString("base64"), "base64");

//   await Promise.all(
//     connectedSockets.map((socket) =>
//       sendFileInChunks(
//         socket,
//         fileName,
//         tempPath,
//         username,
//         fileId,
//         setTransferProgress
//       )
//     )
//   );

//   setTransferProgress?.((prev) => [
//     ...prev.filter((p) => p.fileId !== fileId),
//     {
//       fileId,
//       fileName,
//       progress: `${fileData.length}/${fileData.length} bytes`,
//       speed: "0 KB/s",
//       percentage: 100,
//     },
//   ]);

//   await RNFS.unlink(tempPath);
//   Logger.info(`Sent file: ${fileName} from ${username} to all clients`);
// }

// export async function sendMultipleHostFiles(
//   server: TCPSocket.Server | null,
//   files: { filePath: string; fileData: Buffer }[],
//   username: string,
//   setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
// ): Promise<void> {
//   if (!server || connectedSockets.length === 0) {
//     Logger.toast("No connected clients to send files", "error");
//     return;
//   }

//   const fileTransfers = new Map<string, FileTransfer>();
//   const queue: { filePath: string; fileData: Buffer }[] = [...files];

//   while (queue.length > 0) {
//     const { filePath, fileData } = queue.shift()!;
//     const fileName = filePath.split("/").pop() || "unknown";
//     const senderIp = await getLocalIPAddress();
//     const fileId = chunkStorage.generateFileId(fileName);

//     if (!checkTransferLimits(fileData.length, fileTransfers)) {
//       Logger.toast(`Transfer limit exceeded for ${fileName}, queuing`, "warn");
//       queue.unshift({ filePath, fileData });
//       await new Promise((resolve) => setTimeout(resolve, 1000));
//       continue;
//     }

//     const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//     await RNFS.writeFile(tempPath, fileData.toString("base64"), "base64");

//     await Promise.all(
//       connectedSockets.map((socket) =>
//         sendFileInChunks(
//           socket,
//           fileName,
//           tempPath,
//           username,
//           fileId,
//           setTransferProgress
//         )
//       )
//     );

//     setTransferProgress?.((prev) => [
//       ...prev.filter((p) => p.fileId !== fileId),
//       {
//         fileId,
//         fileName,
//         progress: `${fileData.length}/${fileData.length} bytes`,
//         speed: "0 KB/s",
//         percentage: 100,
//       },
//     ]);

//     await RNFS.unlink(tempPath);
//     Logger.info(`Sent file: ${fileName} from ${username} to all clients`);
//   }
// }

// export function sendHostMessage(
//   server: TCPSocket.Server | null,
//   message: string,
//   username: string
// ): void {
//   if (!server || connectedSockets.length === 0) {
//     Logger.toast("No connected clients to send message", "error");
//     return;
//   }
//   connectedSockets.forEach(async (socket) => {
//     if (socket.sessionKey && socket.iv) {
//       const iv = CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
//       const encrypted = await encryptData(
//         Buffer.from(`${username}: ${message}`),
//         socket.sessionKey,
//         iv
//       );
//       socket.write(Buffer.from(`MSG:${iv}:${encrypted.toString("base64")}\n`));
//     }
//   });
// }

// export function stopHostServer(): void {
//   Logger.info("Stopping host server...");
//   isServerRunning = false;

//   if (udpSocket) {
//     udpSocket.close();
//     udpSocket = null;
//     Logger.info("UDP socket closed");
//   }

//   if (server) {
//     server.close();
//     server = null;
//     Logger.info("TCP server closed");
//   }

//   connectedSockets.forEach((socket) => {
//     socket.destroy();
//     Logger.info(`Closed socket for ${socket.remoteAddress}`);
//   });
//   connectedSockets = [];
//   Logger.info("Host server stopped");
// }

// export function kickClient(clientIp: string): void {
//   const socket = connectedSockets.find((s) => s.remoteAddress === clientIp);
//   if (!socket) {
//     Logger.warn(`No client found with IP ${clientIp}`);
//     return;
//   }
//   socket.end();
//   connectedSockets = connectedSockets.filter(
//     (s) => s.remoteAddress !== clientIp
//   );
//   Logger.toast(`Kicked client ${clientIp}`, "info");
// }

import dgram from "react-native-udp";
import {
  getLocalIPAddress,
  getBroadcastIPAddress,
  calculateChunkSize,
  checkTransferLimits,
} from "../utils/networkUtils";
import RNFS from "react-native-fs";
import { Buffer } from "buffer";
import { Logger } from "../utils/Logger";
import { DropShareError, ERROR_CODES } from "../utils/Error";
import TCPSocket from "react-native-tcp-socket";

type UdpSocket = ReturnType<typeof dgram.createSocket>;

const UDP_PORT = 5000;
const TCP_PORT = 6000;
const ACK_TIMEOUT = 5000;
const MAX_CLIENTS = 5;

interface ConnectedSocket extends TCPSocket.Socket {}

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
  senderIp: string;
  status: "Receiving" | "Sending" | "Completed";
  progress: number;
  lastChunkIndex: number;
  chunkHashes: string[];
}

let connectedSockets: ConnectedSocket[] = [];
let isServerRunning = false;
let udpSocket: UdpSocket | null = null;
let server: TCPSocket.Server | null = null;
const TRANSFER_QUEUE: {
  socket: ConnectedSocket;
  fileId: string;
  chunkIndex: number;
}[] = [];

export async function startHostServer(
  username: string,
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>,
  setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Server | null>>,
  setMessages: React.Dispatch<React.SetStateAction<string[]>>,
  setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
  setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
): Promise<void> {
  if (isServerRunning) {
    Logger.info("Host server already running, skipping start.");
    return;
  }
  isServerRunning = true;

  try {
    const ip = await getLocalIPAddress();
    const broadcastAddr = await getBroadcastIPAddress();
    Logger.info(`Host started on IP: ${ip}, Broadcasting to: ${broadcastAddr}`);

    udpSocket = dgram.createSocket({ type: "udp4" });
    udpSocket.bind(UDP_PORT);

    udpSocket.once("listening", () => {
      Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
      udpSocket!.setBroadcast(true);
      const broadcastInterval = setInterval(() => {
        const message = JSON.stringify({ role: "Host", ip, name: username });
        udpSocket!.send(
          Buffer.from(message),
          0,
          message.length,
          UDP_PORT,
          broadcastAddr,
          (err) => {
            if (err) Logger.error("UDP Send Error", err);
          }
        );
      }, 2000);

      udpSocket!.on("close", () => clearInterval(broadcastInterval));
    });

    udpSocket.on("error", (err: Error) => {
      Logger.error("UDP Socket Error", err);
      isServerRunning = false;
      udpSocket?.close();
      udpSocket = null;
    });

    server = new TCPSocket.Server();
    server.on("connection", async (socket: ConnectedSocket) => {
      if (connectedSockets.length >= MAX_CLIENTS) {
        socket.write(Buffer.from(`ERROR:${ERROR_CODES.MAX_CLIENTS_REACHED}\n`));
        socket.destroy();
        Logger.warn("Max clients reached, rejecting new connection");
        return;
      }

      Logger.info(`Client connected: ${socket.remoteAddress}`);
      connectedSockets.push(socket);
      setSocket(server);
      setDevices((prev) => [
        ...prev.filter((d) => d.ip !== socket.remoteAddress),
        {
          ip: socket.remoteAddress || "Unknown",
          name: "Unknown",
          role: "Client",
        },
      ]);

      const fileTransfers = new Map<string, FileTransfer>();
      let buffer = Buffer.alloc(0);
      let inFileTransfer = false;

      socket.on("data", async (data: string | Buffer) => {
        try {
          buffer = Buffer.concat([
            buffer,
            typeof data === "string" ? Buffer.from(data) : data,
          ]);

          while (buffer.length > 0) {
            const dataStr = buffer.toString();
            const validPrefixes = [
              "FILE:",
              "CHUNK:",
              "MSG:",
              "ACK_START:",
              "ACK_CHUNK:",
              "ERROR:",
            ];
            if (!validPrefixes.some((prefix) => dataStr.startsWith(prefix))) {
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
              return;
            }

            if (!inFileTransfer) {
              if (dataStr.startsWith("FILE:")) {
                const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
                if (headerEnd === -1) {
                  Logger.info(
                    `Incomplete FILE header from ${socket.remoteAddress}, waiting...`
                  );
                  return;
                }
                const headerStr = buffer.slice(5, headerEnd).toString();
                Logger.info(`Parsed header: ${headerStr}`);
                let headerData: {
                  name: string;
                  size: number;
                  sender: string;
                  fileId: string;
                };
                try {
                  headerData = JSON.parse(headerStr);
                } catch {
                  throw new DropShareError(
                    ERROR_CODES.INVALID_HEADER,
                    "Invalid file header"
                  );
                }

                const fileName = headerData.name;
                const fileSize = headerData.size;
                const deviceName = headerData.sender || "Unknown";
                const fileId = headerData.fileId;

                if (!fileName || !fileSize || !fileId) {
                  throw new DropShareError(
                    ERROR_CODES.INVALID_HEADER,
                    "Missing file name, size, or ID"
                  );
                }

                if (!checkTransferLimits(fileSize, fileTransfers)) {
                  socket.write(
                    Buffer.from(
                      `ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`
                    )
                  );
                  Logger.toast(
                    `Transfer limit exceeded for ${fileName}`,
                    "error"
                  );
                  buffer = Buffer.alloc(0);
                  return;
                }

                const chunkSize = calculateChunkSize(fileSize);
                const totalChunks = Math.ceil(fileSize / chunkSize);

                const transfer: FileTransfer = {
                  fileId,
                  fileName,
                  fileSize,
                  deviceName,
                  chunks: Array(totalChunks).fill(undefined),
                  receivedBytes: 0,
                  startTime: Date.now(),
                  totalChunks,
                  chunkSize,
                  totalSize: fileSize,
                  senderIp: socket.remoteAddress || "Unknown",
                  status: "Receiving",
                  progress: 0,
                  lastChunkIndex: -1,
                  chunkHashes: new Array(totalChunks).fill(""),
                };
                fileTransfers.set(fileId, transfer);

                socket.write(Buffer.from(`ACK_START:${fileId}:-1\n`));
                Logger.info(
                  `Started new transfer ${fileId} (${fileSize} bytes) from ${deviceName}`
                );

                inFileTransfer = true;
                buffer = buffer.slice(headerEnd + 2);
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
                  });
                buffer = buffer.slice(messageEnd + 1);
              } else if (dataStr.startsWith("CHUNK:")) {
                const chunkEnd = buffer.indexOf(Buffer.from("\n"));
                if (chunkEnd === -1) {
                  Logger.info(
                    `Incomplete CHUNK header from ${socket.remoteAddress}, waiting...`
                  );
                  return;
                }
                const chunkHeader = buffer.slice(0, chunkEnd).toString();
                const [, fileId, chunkIndexStr, chunkDataBase64] =
                  chunkHeader.split(":");
                const chunkIndex = parseInt(chunkIndexStr);
                const transfer = fileTransfers.get(fileId);
                if (!transfer) {
                  Logger.warn(`No transfer for ${fileId}, ignoring chunk`);
                  buffer = Buffer.alloc(0);
                  return;
                }
                const chunkData = Buffer.from(chunkDataBase64, "base64");
                transfer.chunks[chunkIndex] = chunkData;
                transfer.receivedBytes += chunkData.length;
                transfer.lastChunkIndex = chunkIndex;
                transfer.chunkHashes[chunkIndex] = "";
                socket.write(
                  Buffer.from(`ACK_CHUNK:${fileId}:${chunkIndex}\n`)
                );
                Logger.info(
                  `Processed and ACKed chunk ${chunkIndex} for ${fileId}, ${transfer.receivedBytes}/${transfer.totalSize} bytes`
                );

                const elapsedTime =
                  (Date.now() - transfer.startTime) / 1000 || 1;
                const speed = (
                  transfer.receivedBytes /
                  elapsedTime /
                  1024
                ).toFixed(2);
                const percentage =
                  (transfer.receivedBytes / transfer.totalSize) * 100;
                setTransferProgress?.((prev) => [
                  ...prev.filter((p) => p.fileId !== fileId),
                  {
                    fileId,
                    fileName: transfer.fileName,
                    progress: `${transfer.receivedBytes}/${transfer.totalSize} bytes`,
                    speed: `${speed} KB/s`,
                    percentage,
                  },
                ]);

                if (transfer.receivedBytes >= transfer.totalSize) {
                  const savePath = `${RNFS.DocumentDirectoryPath}/${transfer.fileName}`;
                  const assembled = Buffer.concat(
                    transfer.chunks.filter((c): c is Buffer => !!c)
                  );
                  await RNFS.writeFile(
                    savePath,
                    assembled.toString("base64"),
                    "base64"
                  );
                  setReceivedFiles((prev) => [...prev, savePath]);
                  Logger.info(
                    `Received and saved file: ${savePath} from ${transfer.deviceName}`
                  );
                  fileTransfers.delete(fileId);
                  inFileTransfer = false;
                }
                buffer = buffer.slice(chunkEnd + 1);
              } else if (
                dataStr.startsWith("ACK_START:") ||
                dataStr.startsWith("ACK_CHUNK:") ||
                dataStr.startsWith("ERROR:")
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
                buffer = buffer.slice(messageEnd + 1);
              } else {
                Logger.warn(
                  `Unknown data from ${socket.remoteAddress}: ${dataStr.slice(
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
          }
        } catch (error) {
          Logger.error(
            `Error processing data from ${socket.remoteAddress}`,
            error
          );
          const err = DropShareError.from(
            error,
            ERROR_CODES.NETWORK_ERROR,
            "Data processing failed"
          );
          socket.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
          buffer = Buffer.alloc(0);
          inFileTransfer = false;
        }
      });

      socket.on("close", () => {
        Logger.info(`Client disconnected: ${socket.remoteAddress}`);
        connectedSockets = connectedSockets.filter((s) => s !== socket);
        setDevices((prev) => prev.filter((d) => d.ip !== socket.remoteAddress));
      });

      socket.on("error", (err) => {
        Logger.error(`Host Socket Error for ${socket.remoteAddress}`, err);
      });
    });

    server.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
      Logger.info(`Host TCP server running on port ${TCP_PORT}`);
    });

    server.on("error", (err) => {
      Logger.error("Server Error", err);
      stopHostServer();
    });

    server.on("close", () => {
      Logger.info("Host TCP server closed");
      isServerRunning = false;
    });
  } catch (err) {
    Logger.error("Failed to start host server", err);
    isServerRunning = false;
    stopHostServer();
  }
}

async function sendFileInChunks(
  socket: ConnectedSocket,
  fileName: string,
  filePath: string,
  deviceName: string,
  fileId: string,
  setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
): Promise<void> {
  try {
    const fileSize = (await RNFS.stat(filePath)).size;
    const chunkSize = calculateChunkSize(fileSize);
    const totalChunks = Math.ceil(fileSize / chunkSize);
    const fileTransfers = new Map<string, FileTransfer>();

    const transfer: FileTransfer = {
      fileId,
      fileName,
      fileSize,
      deviceName,
      chunks: [],
      receivedBytes: 0,
      startTime: Date.now(),
      totalChunks,
      chunkSize,
      totalSize: fileSize,
      senderIp: await getLocalIPAddress(),
      status: "Sending",
      progress: 0,
      lastChunkIndex: -1,
      chunkHashes: new Array(totalChunks).fill(""),
    };
    fileTransfers.set(fileId, transfer);

    const header = Buffer.from(
      `FILE:${JSON.stringify({
        name: fileName,
        size: fileSize,
        sender: deviceName,
        fileId,
      })}\n\n`
    );

    await new Promise<void>((resolve, reject) => {
      socket.write(header, "binary", (err) => (err ? reject(err) : resolve()));
    });
    Logger.info(`Sent header for ${fileId}`);

    let sentBytes = 0;
    const startTime = Date.now();

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const offset = chunkIndex * chunkSize;
      const length = Math.min(chunkSize, fileSize - offset);
      const chunkData = await RNFS.read(filePath, length, offset, "base64");
      const chunkBuffer = Buffer.from(chunkData, "base64");

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new DropShareError(
              ERROR_CODES.NETWORK_ERROR,
              `Timeout waiting for ACK_CHUNK ${chunkIndex}`
            )
          );
        }, ACK_TIMEOUT);
        socket.once("data", (data) => {
          clearTimeout(timeout);
          const message = data.toString();
          if (
            message.startsWith("ACK_CHUNK:") &&
            message.includes(`${fileId}:${chunkIndex}`)
          ) {
            resolve();
          } else {
            reject(
              new DropShareError(
                ERROR_CODES.NETWORK_ERROR,
                "Invalid ACK_CHUNK response"
              )
            );
          }
        });
        socket.write(
          Buffer.from(
            `CHUNK:${fileId}:${chunkIndex}:${chunkBuffer.toString("base64")}\n`
          )
        );
      });

      sentBytes += chunkBuffer.length;
      transfer.lastChunkIndex = chunkIndex;
      transfer.chunkHashes[chunkIndex] = "";
      const elapsedTime = (Date.now() - startTime) / 1000 || 1;
      const speed = (sentBytes / elapsedTime / 1024).toFixed(2);
      setTransferProgress?.((prev) => [
        ...prev.filter((p) => p.fileId !== fileId),
        {
          fileId,
          fileName,
          progress: `${sentBytes}/${fileSize} bytes`,
          speed: `${speed} KB/s`,
          percentage: (sentBytes / fileSize) * 100,
        },
      ]);
      Logger.info(
        `Sent chunk ${chunkIndex} for ${fileId}, ${sentBytes}/${fileSize} bytes`
      );
    }

    fileTransfers.delete(fileId);
    Logger.info(`Sent file: ${fileName} from ${deviceName}`);
  } catch (error) {
    Logger.error(`Failed to send file ${fileName}`, error);
    throw DropShareError.from(
      error,
      ERROR_CODES.NETWORK_ERROR,
      "File transfer failed"
    );
  }
}

export async function sendHostFile(
  server: TCPSocket.Server | null,
  filePath: string,
  fileData: Buffer,
  username: string,
  setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
): Promise<void> {
  if (!server || connectedSockets.length === 0) {
    Logger.toast("No connected clients to send file", "error");
    return;
  }

  const fileName = filePath.split("/").pop() || "unknown";
  const fileId = `${Date.now()}_${fileName}`;
  const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
  await RNFS.writeFile(tempPath, fileData.toString("base64"), "base64");

  try {
    await Promise.all(
      connectedSockets.map((socket) =>
        sendFileInChunks(
          socket,
          fileName,
          tempPath,
          username,
          fileId,
          setTransferProgress
        )
      )
    );

    setTransferProgress?.((prev) => [
      ...prev.filter((p) => p.fileId !== fileId),
      {
        fileId,
        fileName,
        progress: `${fileData.length}/${fileData.length} bytes`,
        speed: "0 KB/s",
        percentage: 100,
      },
    ]);

    Logger.info(`Sent file: ${fileName} from ${username} to all clients`);
  } finally {
    await RNFS.unlink(tempPath).catch((err) =>
      Logger.error(`Failed to delete temp file ${tempPath}`, err)
    );
  }
}

export async function sendMultipleHostFiles(
  server: TCPSocket.Server | null,
  files: { filePath: string; fileData: Buffer }[],
  username: string,
  setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
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
  }
}

export function sendHostMessage(
  server: TCPSocket.Server | null,
  message: string,
  username: string
): void {
  if (!server || connectedSockets.length === 0) {
    Logger.toast("No connected clients to send message", "error");
    return;
  }
  connectedSockets.forEach((socket) => {
    socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
  });
}

export function stopHostServer(): void {
  Logger.info("Stopping host server...");
  isServerRunning = false;

  if (udpSocket) {
    udpSocket.close();
    udpSocket = null;
    Logger.info("UDP socket closed");
  }

  if (server) {
    server.close();
    server = null;
    Logger.info("TCP server closed");
  }

  connectedSockets.forEach((socket) => {
    socket.destroy();
    Logger.info(`Closed socket for ${socket.remoteAddress}`);
  });
  connectedSockets = [];
  Logger.info("Host server stopped");
}

export function kickClient(clientIp: string): void {
  const socket = connectedSockets.find((s) => s.remoteAddress === clientIp);
  if (!socket) {
    Logger.warn(`No client found with IP ${clientIp}`);
    return;
  }
  socket.end();
  connectedSockets = connectedSockets.filter(
    (s) => s.remoteAddress !== clientIp
  );
  Logger.toast(`Kicked client ${clientIp}`, "info");
}
