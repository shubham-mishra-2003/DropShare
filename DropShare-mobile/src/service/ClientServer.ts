// import dgram from "react-native-udp";
// import net from "react-native-tcp-socket";
// import { getLocalIPAddress } from "../utils/networkUtils";
// import RNFS from "react-native-fs";
// import { Buffer } from "buffer";
// import { calculateChunkSize } from "../utils/networkUtils";

// const UDP_PORT = 5000;
// const TCP_PORT = 6000;

// interface FileTransfer {
//   fileName: string;
//   fileSize: number;
//   buffer: Buffer[];
//   receivedBytes: number;
// }

// export function startClientDiscovery(
//   setDevices: React.Dispatch<React.SetStateAction<Device[]>>
// ): void {
//   // Unchanged discovery logic
//   getLocalIPAddress()
//     .then((localIP) => {
//       console.log("🔍 Client Discovery Started...");
//       const udpSocket = dgram.createSocket({ type: "udp4", reusePort: true });
//       udpSocket.bind(UDP_PORT);

//       udpSocket.once("listening", () => {
//         udpSocket.setBroadcast(true);
//       });

//       udpSocket.on("message", (msg: Buffer) => {
//         try {
//           const data = JSON.parse(msg.toString());
//           if (data.ip !== localIP && data.role === "Host") {
//             setDevices((prev) => [
//               ...prev.filter((device) => device.ip !== data.ip),
//               { ip: data.ip, name: data.name, role: "Host" },
//             ]);
//           }
//         } catch (error) {
//           console.error("Error parsing UDP message:", error);
//         }
//       });

//       udpSocket.on("error", (err) => {
//         console.log("❌ UDP Socket Error:", err.message);
//       });
//     })
//     .catch((err) => {
//       console.error("Failed to get local IP:", err);
//     });
// }

// export function connectToHost(
//   ip: string,
//   username: string,
//   setConnected: React.Dispatch<React.SetStateAction<boolean>>,
//   setSocket: React.Dispatch<React.SetStateAction<any>>,
//   setMessages: React.Dispatch<React.SetStateAction<string[]>>,
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
//   setTransferProgress?: React.Dispatch<
//     React.SetStateAction<{ progress: string; speed: string }>
//   >
// ): void {
//   // Unchanged connection logic
//   console.log(`🔗 Connecting to host at ${ip}...`);
//   const client = net.createConnection({ port: TCP_PORT, host: ip }, () => {
//     console.log("✅ Connected to host!");
//     setConnected(true);
//     setSocket(client);
//     client.write(`${username}: Connected`);
//   });

//   const fileTransfers = new Map<string, FileTransfer>();

//   client.on("data", async (data: Buffer) => {
//     console.log(`📥 Client received ${data.length} bytes of data`);
//     try {
//       const header = data.slice(0, 5).toString();
//       if (header === "FILE:") {
//         const headerEnd = data.indexOf(Buffer.from("\n\n"));
//         if (headerEnd === -1) {
//           console.log("Incomplete header received, waiting for more data...");
//           return;
//         }
//         const headerStr = data.slice(5, headerEnd).toString();
//         const headerData = JSON.parse(headerStr);
//         const fileName = headerData.name;
//         const fileSize = headerData.size;

//         if (!fileName || !fileSize)
//           throw new Error("Invalid header: missing name or size");

//         fileTransfers.set(fileName, {
//           fileName,
//           fileSize,
//           buffer: [data.slice(headerEnd + 2)],
//           receivedBytes: data.slice(headerEnd + 2).length,
//         });
//         console.log(
//           `📥 Client started receiving file: ${fileName} (${fileSize} bytes)`
//         );
//         setTransferProgress?.({
//           progress: `${
//             fileTransfers.get(fileName)!.receivedBytes
//           }/${fileSize} bytes`,
//           speed: "0 KB/s",
//         });
//       } else {
//         let matchedTransfer: FileTransfer | undefined;
//         for (const transfer of fileTransfers.values()) {
//           if (transfer.receivedBytes < transfer.fileSize) {
//             matchedTransfer = transfer;
//             break;
//           }
//         }

//         if (matchedTransfer) {
//           const startTime = Date.now();
//           matchedTransfer.buffer.push(data);
//           matchedTransfer.receivedBytes += data.length;
//           const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//           const speed = (data.length / elapsedTime / 1024).toFixed(2);
//           console.log(
//             `📥 Progress for ${matchedTransfer.fileName}: ${matchedTransfer.receivedBytes}/${matchedTransfer.fileSize} bytes`
//           );
//           setTransferProgress?.({
//             progress: `${matchedTransfer.receivedBytes}/${matchedTransfer.fileSize} bytes`,
//             speed: `${speed} KB/s`,
//           });

//           if (matchedTransfer.receivedBytes >= matchedTransfer.fileSize) {
//             const fullFile = Buffer.concat(matchedTransfer.buffer);
//             const saveDir = `${RNFS.ExternalStorageDirectoryPath}/DropShare`;
//             const dirExists = await RNFS.exists(saveDir);
//             if (!dirExists) await RNFS.mkdir(saveDir);

//             let savePath = `${saveDir}/${matchedTransfer.fileName}`;
//             let counter = 1;
//             const [name, ext] = matchedTransfer.fileName.split(/(\.[^.]+)$/);
//             while (await RNFS.exists(savePath)) {
//               savePath = `${saveDir}/${name}-${counter}${ext || ""}`;
//               counter++;
//             }

//             await RNFS.writeFile(
//               savePath,
//               fullFile.toString("base64"),
//               "base64"
//             );
//             setReceivedFiles((prev) => [...prev, savePath]);
//             console.log(`📥 Client received and saved file: ${savePath}`);
//             fileTransfers.delete(matchedTransfer.fileName);
//             setTransferProgress?.({ progress: "0/0 bytes", speed: "0 KB/s" });
//           }
//         } else {
//           const message = data.toString();
//           console.log("📨 Client received message:", message);
//           setMessages((prev) => [...prev, message]);
//         }
//       }
//     } catch (error) {
//       console.error("Error processing data:", error);
//       fileTransfers.clear();
//       setTransferProgress?.({ progress: "0/0 bytes", speed: "0 KB/s" });
//     }
//   });

//   client.on("close", () => {
//     console.log("🔌 Disconnected from host");
//     setConnected(false);
//     setSocket(null);
//     setMessages([]);
//     setReceivedFiles([]);
//     fileTransfers.clear();
//     setTransferProgress?.({ progress: "0/0 bytes", speed: "0 KB/s" });
//   });

//   client.on("error", (err) => {
//     console.log("❌ Client Socket Error:", err.message);
//     setConnected(false);
//     setSocket(null);
//     fileTransfers.clear();
//   });
// }

// // Updated sendFile with dynamic chunking
// export async function sendFile(
//   socket: any,
//   filePath: string,
//   fileData: Buffer,
//   username: string,
//   setTransferProgress?: React.Dispatch<
//     React.SetStateAction<{ progress: string; speed: string }>
//   >
// ): Promise<void> {
//   if (!socket) {
//     console.log("❌ No active socket to send file.");
//     return;
//   }

//   const fileName = filePath.split("/").pop() || "unknown";
//   const fileSize = fileData.length;
//   const chunkSize = calculateChunkSize(fileSize);
//   const header = Buffer.from(
//     `FILE:${JSON.stringify({
//       name: fileName,
//       size: fileSize,
//       sender: username,
//     })}\n\n`
//   );
//   console.log(
//     `📤 Preparing to send file: ${fileName} (${fileSize} bytes) from ${username}`
//   );

//   socket.write(header);

//   let sentBytes = 0;
//   const startTime = Date.now();

//   for (let i = 0; i < fileSize; i += chunkSize) {
//     const chunk = fileData.slice(i, i + chunkSize);
//     socket.write(chunk);
//     sentBytes += chunk.length;
//     const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//     const speed = (sentBytes / elapsedTime / 1024).toFixed(2);
//     setTransferProgress?.({
//       progress: `${sentBytes}/${fileSize} bytes`,
//       speed: `${speed} KB/s`,
//     });
//     console.log(
//       `📤 Sent chunk: ${sentBytes}/${fileSize} bytes at ${speed} KB/s`
//     );
//     await new Promise<void>((resolve) => setTimeout(resolve, 5)); // Reduced delay for speed
//   }

//   console.log(`📤 Sent file: ${fileName} from ${username}`);
// }

// // Updated sendMultipleFiles with dynamic chunking
// export async function sendMultipleFiles(
//   socket: any,
//   files: { filePath: string; fileData: Buffer }[],
//   username: string,
//   setTransferProgress?: React.Dispatch<
//     React.SetStateAction<{ progress: string; speed: string }>
//   >
// ): Promise<void> {
//   if (!socket) {
//     console.log("❌ No active socket to send files.");
//     return;
//   }

//   for (const { filePath, fileData } of files) {
//     const fileName = filePath.split("/").pop() || "unknown";
//     const fileSize = fileData.length;
//     const chunkSize = calculateChunkSize(fileSize);
//     const header = Buffer.from(
//       `FILE:${JSON.stringify({
//         name: fileName,
//         size: fileSize,
//         sender: username,
//       })}\n\n`
//     );
//     console.log(
//       `📤 Preparing to send file: ${fileName} (${fileSize} bytes) from ${username}`
//     );

//     socket.write(header);

//     let sentBytes = 0;
//     const startTime = Date.now();

//     for (let i = 0; i < fileSize; i += chunkSize) {
//       const chunk = fileData.slice(i, i + chunkSize);
//       socket.write(chunk);
//       sentBytes += chunk.length;
//       const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//       const speed = (sentBytes / elapsedTime / 1024).toFixed(2);
//       setTransferProgress?.({
//         progress: `${sentBytes}/${fileSize} bytes`,
//         speed: `${speed} KB/s`,
//       });
//       console.log(
//         `📤 Sent chunk: ${sentBytes}/${fileSize} bytes at ${speed} KB/s`
//       );
//       await new Promise<void>((resolve) => setTimeout(resolve, 5));
//     }

//     console.log(`📤 Sent file: ${fileName} from ${username}`);
//   }
// }

// // Unchanged sendMessage
// export function sendMessage(
//   socket: any,
//   message: string,
//   username: string
// ): void {
//   if (socket) {
//     console.log(`📤 Sending message from ${username}:`, message);
//     socket.write(`${username}: ${message}`);
//   } else {
//     console.log("❌ No active socket to send message.");
//   }
// }

// Working till now

// import dgram from "react-native-udp";
// import {
//   getLocalIPAddress,
//   calculateChunkSize,
//   checkTransferLimits,
//   QUEUE_RETRY_DELAY,
// } from "../utils/networkUtils";
// import RNFS from "react-native-fs";
// import { Buffer } from "buffer";
// import { chunkStorage } from "./ChunkStorage";
// import { Logger } from "../utils/Logger";
// import { DropShareError, ERROR_CODES } from "../utils/Error";
// import TCPSocket from "react-native-tcp-socket";
// import { FileTransfer, TransferProgress } from "../types/global";
// import { formatFileSize } from "../utils/FileSystemUtil";

// type UdpSocket = ReturnType<typeof dgram.createSocket>;

// const UDP_PORT = 5000;
// const TCP_PORT = 6000;

// let udpSocket: UdpSocket | null = null;
// let clientSocket: TCPSocket.Socket | null = null;

// export async function startClientDiscovery(
//   setDevices: React.Dispatch<React.SetStateAction<Device[]>>
// ): Promise<void> {
//   try {
//     await chunkStorage.initialize();
//     const localIP = await getLocalIPAddress();
//     Logger.info("Client Discovery Started...");

//     udpSocket = dgram.createSocket({ type: "udp4" });
//     udpSocket.bind(UDP_PORT);

//     udpSocket.on("listening", () => {
//       Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
//       udpSocket!.setBroadcast(true);
//     });

//     udpSocket.on("message", (msg: Buffer, rinfo) => {
//       try {
//         const data = JSON.parse(msg.toString());
//         if (data.ip !== localIP && data.role === "Host") {
//           setDevices((prev) => [
//             ...prev.filter((device) => device.ip !== data.ip),
//             {
//               ip: data.ip,
//               name: data.name,
//               role: "Host",
//             },
//           ]);
//           Logger.info(`Discovered host: ${data.ip} (${data.name})`);
//         }
//       } catch (error) {
//         Logger.error("Error parsing UDP message", error);
//       }
//     });

//     udpSocket.on("error", (err: Error) => {
//       Logger.error("UDP Socket Error", err);
//       stopClientDiscovery();
//     });
//   } catch (err) {
//     Logger.error("Failed to start client discovery", err);
//     stopClientDiscovery();
//   }
// }

// export function stopClientDiscovery(): void {
//   Logger.info("Stopping client discovery...");
//   if (udpSocket) {
//     udpSocket.close();
//     udpSocket = null;
//     Logger.info("UDP socket closed");
//   }
// }

// export async function connectToHost(
//   ip: string,
//   username: string,
//   setConnected: React.Dispatch<React.SetStateAction<boolean>>,
//   setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
//   setMessages: React.Dispatch<React.SetStateAction<string[]>>,
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
//   setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
// ): Promise<void> {
//   Logger.info(`Connecting to host at ${ip}...`);
//   const client = new TCPSocket.Socket();
//   clientSocket = client;

//   const fileTransfers = new Map<string, FileTransfer>();
//   let buffer = Buffer.alloc(0); // Buffer to accumulate partial data

//   client.on("connect", () => {
//     Logger.info("Connected to host!");
//     setConnected(true);
//     setSocket(client);
//     client.write(Buffer.from(`${username}: Connected`));
//   });

//   client.on("data", async (data: Buffer) => {
//     try {
//       buffer = Buffer.concat([buffer, data]); // Accumulate incoming data
//       Logger.info(`Buffer length: ${formatFileSize(buffer.length)}`); // Debug log
//       while (buffer.length > 0) {
//         const header = buffer.slice(0, 5).toString();
//         if (header === "FILE:") {
//           const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//           if (headerEnd === -1) {
//             Logger.info("Incomplete header received, waiting for more data...");
//             return; // Wait for more data
//           }
//           const headerStr = buffer.slice(5, headerEnd).toString();
//           Logger.info(`Parsed header: ${headerStr}`); // Debug log
//           let headerData: {
//             name: string;
//             size: number;
//             sender: string;
//             fileId: string;
//           };
//           try {
//             headerData = JSON.parse(headerStr);
//           } catch {
//             throw new DropShareError(
//               ERROR_CODES.INVALID_HEADER,
//               "Invalid file header"
//             );
//           }

//           const fileName = headerData.name;
//           const fileSize = headerData.size;
//           const fileId = headerData.fileId;
//           const deviceName = headerData.sender || "Unknown";

//           if (!fileName || !fileSize || !fileId) {
//             throw new DropShareError(
//               ERROR_CODES.INVALID_HEADER,
//               "Missing file name, size, or ID"
//             );
//           }

//           if (!checkTransferLimits(fileSize, fileTransfers)) {
//             client.write(
//               Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}`)
//             );
//             Logger.toast(`Transfer limit exceeded for ${fileName}`, "error");
//             buffer = Buffer.alloc(0); // Clear buffer on error
//             return;
//           }
//           let transfer = fileTransfers.get(fileId);
//           let record = await chunkStorage.getTransferRecord(fileId);
//           let startChunkIndex = 0;

//           if (record && record.status !== "completed") {
//             startChunkIndex = record.lastChunkIndex + 1;
//             client.write(
//               Buffer.from(`RESUME_REQUEST:${fileId}:${record.lastChunkIndex}`)
//             );
//             Logger.info(
//               `Requested resume for ${fileId} at chunk ${record.lastChunkIndex}`
//             );
//           } else {
//             const chunkSize = calculateChunkSize(fileSize);
//             const totalChunks = Math.ceil(fileSize / chunkSize);
//             record = {
//               fileId,
//               fileName,
//               totalSize: fileSize,
//               chunkSize,
//               lastChunkIndex: -1,
//               totalChunks,
//               status: "in_progress",
//               senderIp: ip,
//               timestamp: Date.now(),
//             };
//             await chunkStorage.saveTransferRecord(record);
//             Logger.info(
//               `Started new transfer ${fileId} (${fileSize} bytes) from ${deviceName}`
//             );
//           }

//           if (!transfer) {
//             transfer = {
//               fileId,
//               fileName,
//               fileSize,
//               deviceName,
//               chunks: Array(record.totalChunks).fill(undefined),
//               receivedBytes: startChunkIndex * record.chunkSize,
//               startTime: Date.now(),
//               totalChunks: record.totalChunks,
//               chunkSize: record.chunkSize,
//               totalSize: fileSize,
//               senderIp: ip,
//               chunkHashes: [],
//               status: "Receiving",
//               progress: 0,
//             };
//             fileTransfers.set(fileId, transfer);
//           }

//           let remainingBuffer = buffer.slice(headerEnd + 2); // Keep remaining data
//           buffer = Buffer.alloc(0); // Clear original buffer
//           while (remainingBuffer.length > 0) {
//             const chunkIndex = Math.floor(
//               transfer.receivedBytes / transfer.chunkSize
//             );
//             const chunkSizeBytes = Math.min(
//               transfer.chunkSize,
//               transfer.totalSize - transfer.receivedBytes
//             );
//             if (remainingBuffer.length >= chunkSizeBytes) {
//               const chunkData = remainingBuffer.slice(0, chunkSizeBytes);
//               await chunkStorage.saveChunk(fileId, chunkIndex, chunkData);
//               transfer.chunks[chunkIndex] = chunkData;
//               transfer.receivedBytes += chunkData.length;
//               await chunkStorage.updateLastChunkIndex(fileId, chunkIndex);
//               Logger.info(
//                 `Processed chunk ${chunkIndex} for ${fileId}, ${transfer.receivedBytes}/${fileSize} bytes`
//               );

//               const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
//               const speed = (
//                 transfer.receivedBytes /
//                 elapsedTime /
//                 1024
//               ).toFixed(2);
//               const percentage = (transfer.receivedBytes / fileSize) * 100;
//               setTransferProgress?.((prev) => [
//                 ...prev.filter((p) => p.fileId !== fileId),
//                 {
//                   fileId,
//                   fileName,
//                   progress: `${transfer.receivedBytes}/${fileSize} bytes`,
//                   speed: `${speed} KB/s`,
//                   percentage,
//                 },
//               ]);

//               if (transfer.receivedBytes >= fileSize) {
//                 const savePath = await chunkStorage.assembleFile(
//                   fileId,
//                   fileName
//                 );
//                 setReceivedFiles((prev) => [...prev, savePath]);
//                 Logger.info(
//                   `Received and saved file: ${savePath} from ${deviceName}`
//                 );
//                 fileTransfers.delete(fileId);
//               }
//               remainingBuffer = remainingBuffer.slice(chunkSizeBytes);
//             } else {
//               break; // Wait for more data
//             }
//           }
//           buffer = remainingBuffer; // Update buffer with any unprocessed data
//         } else if (buffer.toString().startsWith("WAIT:")) {
//           const headerEnd = buffer.indexOf(Buffer.from("\n"));
//           if (headerEnd === -1) {
//             Logger.info("Incomplete WAIT message, waiting for more data...");
//             return;
//           }
//           const [, waitMessage] = buffer
//             .slice(0, headerEnd)
//             .toString()
//             .split(":");
//           Logger.info(`Received WAIT: ${waitMessage}`);
//           setTimeout(() => {
//             const fileId = fileTransfers.keys().next().value;
//             if (fileId) {
//               const transfer = fileTransfers.get(fileId)!;
//               client.write(
//                 Buffer.from(
//                   `RESUME_REQUEST:${fileId}:${Math.floor(
//                     transfer.receivedBytes / transfer.chunkSize
//                   )}`
//                 )
//               );
//             }
//           }, QUEUE_RETRY_DELAY);
//           buffer = buffer.slice(headerEnd + 1);
//         } else if (buffer.toString().startsWith("RESUME_ACK:")) {
//           const headerEnd = buffer.indexOf(Buffer.from("\n"));
//           if (headerEnd === -1) {
//             Logger.info("Incomplete RESUME_ACK, waiting for more data...");
//             return;
//           }
//           const [, fileId, startChunkIndexStr] = buffer
//             .slice(0, headerEnd)
//             .toString()
//             .split(":");
//           const startChunkIndex = parseInt(startChunkIndexStr, 10);
//           const transfer = fileTransfers.get(fileId);
//           if (transfer) {
//             transfer.receivedBytes = startChunkIndex * transfer.chunkSize;
//             Logger.info(
//               `Resuming transfer ${fileId} from chunk ${startChunkIndex}`
//             );
//           }
//           buffer = buffer.slice(headerEnd + 1);
//         } else if (buffer.toString().startsWith("RESTART:")) {
//           const headerEnd = buffer.indexOf(Buffer.from("\n"));
//           if (headerEnd === -1) {
//             Logger.info("Incomplete RESTART, waiting for more data...");
//             return;
//           }
//           const [, fileId] = buffer.slice(0, headerEnd).toString().split(":");
//           await chunkStorage.deleteTransfer(fileId);
//           fileTransfers.delete(fileId);
//           Logger.info(`Restarting transfer ${fileId}`);
//           buffer = buffer.slice(headerEnd + 1);
//         } else if (buffer.toString().startsWith("START:")) {
//           const headerEnd = buffer.indexOf(Buffer.from("\n"));
//           if (headerEnd === -1) {
//             Logger.info("Incomplete START, waiting for more data...");
//             return;
//           }
//           const [, fileId] = buffer.slice(0, headerEnd).toString().split(":");
//           const transfer = fileTransfers.get(fileId);
//           if (transfer) {
//             client.write(
//               Buffer.from(
//                 `RESUME_REQUEST:${fileId}:${Math.floor(
//                   transfer.receivedBytes / transfer.chunkSize
//                 )}`
//               )
//             );
//             Logger.info(`Starting queued transfer ${fileId}`);
//           }
//           buffer = buffer.slice(headerEnd + 1);
//         } else if (buffer.toString().startsWith("ERROR:")) {
//           const headerEnd = buffer.indexOf(Buffer.from("\n"));
//           if (headerEnd === -1) {
//             Logger.info("Incomplete ERROR, waiting for more data...");
//             return;
//           }
//           const [, code, errMessage] = buffer
//             .slice(0, headerEnd)
//             .toString()
//             .split(":");
//           const currentFileId = fileTransfers.keys().next().value;
//           Logger.toast(`Error: ${errMessage}`, "error");
//           setTransferProgress?.((prev) =>
//             prev.map((p) =>
//               p.fileId === currentFileId ? { ...p, error: errMessage } : p
//             )
//           );
//           buffer = buffer.slice(headerEnd + 1);
//         } else {
//           const messageEnd = buffer.indexOf(Buffer.from("\n"));
//           if (messageEnd === -1) {
//             Logger.info("Incomplete message, waiting for more data...");
//             return;
//           }
//           const message = buffer.slice(0, messageEnd + 1).toString();
//           Logger.info(`Received message: ${message}`);
//           setMessages((prev) => [...prev, message]);
//           buffer = buffer.slice(messageEnd + 1);
//         }
//       }
//     } catch (error) {
//       Logger.error("Error processing data", error);
//       const err = DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         "Data processing failed"
//       );
//       const currentFileId = fileTransfers.keys().next().value;
//       setTransferProgress?.((prev) =>
//         prev.map((p) =>
//           p.fileId === currentFileId ? { ...p, error: err.message } : p
//         )
//       );
//       buffer = Buffer.alloc(0); // Clear buffer on error
//     }
//   });

//   client.on("close", () => {
//     Logger.info("Disconnected from host");
//     disconnectFromHost(
//       setConnected,
//       setSocket,
//       setMessages,
//       setReceivedFiles,
//       setTransferProgress
//     );
//   });

//   client.on("error", (err) => {
//     Logger.error("Client Socket Error", err);
//     disconnectFromHost(
//       setConnected,
//       setSocket,
//       setMessages,
//       setReceivedFiles,
//       setTransferProgress
//     );
//   });

//   client.connect({ port: TCP_PORT, host: ip });
// }

// export function disconnectFromHost(
//   setConnected: React.Dispatch<React.SetStateAction<boolean>>,
//   setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
//   setMessages: React.Dispatch<React.SetStateAction<string[]>>,
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
//   setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
// ): void {
//   Logger.info("Disconnecting from host...");
//   if (clientSocket) {
//     clientSocket.end();
//     clientSocket = null;
//     Logger.info("Client socket closed");
//   }
//   setConnected(false);
//   setSocket(null);
//   setMessages([]);
//   setReceivedFiles([]);
//   setTransferProgress?.([]);
//   Logger.info("Disconnected from host");
// }

// export async function sendFile(
//   socket: TCPSocket.Socket | null,
//   filePath: string,
//   fileData: Buffer,
//   username: string,
//   setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
// ): Promise<void> {
//   if (!socket) {
//     Logger.toast("No active socket to send file", "error");
//     return;
//   }

//   const fileName = filePath.split("/").pop() || "unknown";
//   const fileSize = fileData.length;
//   const chunkSize = calculateChunkSize(fileSize);
//   const totalChunks = Math.ceil(fileSize / chunkSize);
//   const fileId = chunkStorage.generateFileId(
//     socket.remoteAddress || "Client",
//     fileName,
//     Date.now()
//   );

//   const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//   await RNFS.writeFile(tempPath, fileData.toString("base64"), "base64");

//   try {
//     const header = Buffer.from(
//       `FILE:${JSON.stringify({
//         name: fileName,
//         size: fileSize,
//         sender: username,
//         fileId,
//       })}\n\n`
//     );

//     await new Promise<void>((resolve, reject) => {
//       socket.write(header, "binary", (err) => (err ? reject(err) : resolve()));
//     });

//     let sentBytes = 0;
//     const startTime = Date.now();
//     const fileContent = await RNFS.readFile(tempPath, "base64");
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
//     }

//     Logger.info(`Sent file: ${fileName} from ${username}`);
//   } catch (error) {
//     Logger.error(`Failed to send file ${fileName}`, error);
//     throw DropShareError.from(
//       error,
//       ERROR_CODES.NETWORK_ERROR,
//       "File transfer failed"
//     );
//   } finally {
//     await RNFS.unlink(tempPath).catch((err) =>
//       Logger.error(`Failed to delete temp file ${tempPath}`, err)
//     );
//   }
// }

// export async function sendMultipleFiles(
//   socket: TCPSocket.Socket | null,
//   files: { filePath: string; fileData: Buffer }[],
//   username: string,
//   setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
// ): Promise<void> {
//   if (!socket) {
//     Logger.toast("No active socket to send files", "error");
//     return;
//   }

//   const fileTransfers = new Map<string, FileTransfer>();
//   const queue: { filePath: string; fileData: Buffer }[] = [...files];

//   while (queue.length > 0) {
//     const { filePath, fileData } = queue.shift()!;
//     const fileName = filePath.split("/").pop() || "unknown";
//     const fileId = chunkStorage.generateFileId(
//       socket.remoteAddress || "Client",
//       fileName,
//       Date.now()
//     );

//     if (!checkTransferLimits(fileData.length, fileTransfers)) {
//       Logger.toast(`Transfer limit exceeded for ${fileName}, queuing`, "warn");
//       queue.unshift({ filePath, fileData });
//       await new Promise((resolve) => setTimeout(resolve, 1000));
//       continue;
//     }

//     await sendFile(socket, filePath, fileData, username, setTransferProgress);
//     fileTransfers.set(fileId, {
//       fileId,
//       fileName,
//       fileSize: fileData.length,
//       deviceName: username,
//       chunks: [],
//       receivedBytes: fileData.length,
//       startTime: Date.now(),
//       totalChunks: Math.ceil(
//         fileData.length / calculateChunkSize(fileData.length)
//       ),
//       chunkSize: calculateChunkSize(fileData.length),
//       totalSize: fileData.length,
//       senderIp: socket.remoteAddress || "Client",
//       chunkHashes: [],
//       status: "Completed",
//       progress: 100,
//     });
//     Logger.info(`Sent file: ${fileName} from ${username}`);
//   }
// }

// export function sendMessage(
//   socket: TCPSocket.Socket | null,
//   message: string,
//   username: string
// ): void {
//   if (!socket) {
//     Logger.toast("No active socket to send message", "error");
//     return;
//   }
//   const formattedMessage = `${username}: ${message}`;
//   Logger.info(`Sending message from ${username}: ${formattedMessage}`);
//   socket.write(Buffer.from(formattedMessage));
// }

// import dgram from "react-native-udp";
// import {
//   getLocalIPAddress,
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
// import CryptoJS from "crypto-js";

// type UdpSocket = ReturnType<typeof dgram.createSocket>;

// const UDP_PORT = 5000;
// const TCP_PORT = 6000;
// const ACK_TIMEOUT = 5000;

// let udpSocket: UdpSocket | null = null;
// let clientSocket: TCPSocket.Socket | null = null;

// export async function startClientDiscovery(
//   setDevices: React.Dispatch<React.SetStateAction<Device[]>>
// ): Promise<void> {
//   try {
//     await chunkStorage.initialize();
//     const localIP = await getLocalIPAddress();
//     Logger.info("Client Discovery Started...");

//     udpSocket = dgram.createSocket({ type: "udp4" });
//     udpSocket.bind(UDP_PORT);

//     udpSocket.on("listening", () => {
//       Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
//       udpSocket!.setBroadcast(true);
//     });

//     udpSocket.on("message", (msg: Buffer, rinfo) => {
//       try {
//         const data = JSON.parse(msg.toString());
//         if (data.ip !== localIP && data.role === "Host") {
//           setDevices((prev) => [
//             ...prev.filter((device) => device.ip !== data.ip),
//             {
//               ip: data.ip,
//               name: data.name,
//               role: "Host",
//             },
//           ]);
//           Logger.info(`Discovered host: ${data.ip} (${data.name})`);
//         }
//       } catch (error) {
//         Logger.error("Error parsing UDP message", error);
//       }
//     });

//     udpSocket.on("error", (err: Error) => {
//       Logger.error("UDP Socket Error", err);
//       stopClientDiscovery();
//     });
//   } catch (err) {
//     Logger.error("Failed to start client discovery", err);
//     stopClientDiscovery();
//   }
// }

// export function stopClientDiscovery(): void {
//   Logger.info("Stopping client discovery...");
//   if (udpSocket) {
//     udpSocket.close();
//     udpSocket = null;
//     Logger.info("UDP socket closed");
//   }
// }

// export async function connectToHost(
//   ip: string,
//   username: string,
//   setConnected: React.Dispatch<React.SetStateAction<boolean>>,
//   setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
//   setMessages: React.Dispatch<React.SetStateAction<string[]>>,
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
//   setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
// ): Promise<void> {
//   Logger.info(`Connecting to host at ${ip}...`);
//   const client = new TCPSocket.Socket();
//   clientSocket = client;

//   const fileTransfers = new Map<string, FileTransfer>();
//   let buffer = Buffer.alloc(0);
//   let inFileTransfer = false;

//   client.on("connect", async () => {
//     Logger.info("Connected to host!");
//     setConnected(true);
//     setSocket(client);
//     const { key, iv } = await generateAESKey();
//     (client as any).sessionKey = key;
//     (client as any).iv = iv;
//     client.write(Buffer.from(`SESSION:${key}:${iv}\n`));
//   });

//   client.on("data", async (data: string | Buffer) => {
//     try {
//       buffer = Buffer.concat([
//         buffer,
//         typeof data === "string" ? Buffer.from(data) : data,
//       ]);

//       // Process messages while buffer has data
//       while (buffer.length > 0) {
//         const dataStr = buffer.toString();
//         const validPrefixes = [
//           "FILE:",
//           "CHUNK:",
//           "MSG:",
//           "CHECK_CHUNKS:",
//           "ACK_START:",
//           "ACK_CHUNKS:",
//           "ACK_CHUNK:",
//           "SESSION:",
//           "ERROR:",
//         ];
//         const hasValidPrefix = validPrefixes.some((prefix) =>
//           dataStr.startsWith(prefix)
//         );

//         if (!hasValidPrefix) {
//           Logger.warn(
//             `Invalid data from host ${ip}: ${dataStr.slice(0, 50)}...`
//           );
//           client.write(
//             Buffer.from(
//               `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
//             )
//           );
//           buffer = Buffer.alloc(0);
//           return;
//         }

//         if (!inFileTransfer) {
//           if (dataStr.startsWith("FILE:")) {
//             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
//             if (headerEnd === -1) {
//               Logger.info(`Incomplete FILE header from host, waiting...`);
//               return;
//             }
//             const headerStr = buffer.slice(5, headerEnd).toString();
//             Logger.info(`Parsed header: ${headerStr}`);
//             let headerData: {
//               name: string;
//               size: number;
//               sender: string;
//               fileId: string;
//             };
//             try {
//               headerData = JSON.parse(headerStr);
//             } catch {
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 "Invalid file header"
//               );
//             }

//             const fileName = headerData.name;
//             const fileSize = headerData.size;
//             const fileId = headerData.fileId;
//             const deviceName = headerData.sender || "Unknown";

//             if (!fileName || !fileSize || !fileId) {
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 "Missing file name, size, or ID"
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

//             let transfer = fileTransfers.get(fileId);
//             let record = await chunkStorage.getTransferRecord(fileId);
//             let startChunkIndex = 0;

//             if (record && record.status !== "completed") {
//               startChunkIndex = record.lastChunkIndex + 1;
//               client.write(
//                 Buffer.from(`ACK_START:${fileId}:${record.lastChunkIndex}\n`)
//               );
//               Logger.info(
//                 `Requested resume for ${fileId} at chunk ${record.lastChunkIndex}`
//               );
//             } else {
//               const chunkSize = calculateChunkSize(fileSize);
//               const totalChunks = Math.ceil(fileSize / chunkSize);
//               const { key, iv } = await generateAESKey();
//               record = {
//                 fileId,
//                 fileName,
//                 totalSize: fileSize,
//                 chunkSize,
//                 lastChunkIndex: -1,
//                 totalChunks,
//                 status: "in_progress",
//                 senderIp: ip,
//                 timestamp: Date.now(),
//                 aesKey: key,
//                 iv,
//                 direction: "receiving", // Verified: Matches schema
//               };
//               await chunkStorage.saveTransferRecord(record);
//               client.write(Buffer.from(`ACK_START:${fileId}:-1\n`));
//               Logger.info(
//                 `Started new transfer ${fileId} (${fileSize} bytes) from ${deviceName}`
//               );
//             }

//             if (!transfer) {
//               transfer = {
//                 fileId,
//                 fileName,
//                 fileSize,
//                 deviceName,
//                 chunks: Array(record.totalChunks).fill(undefined),
//                 receivedBytes: startChunkIndex * record.chunkSize,
//                 startTime: Date.now(),
//                 totalChunks: record.totalChunks,
//                 chunkSize: record.chunkSize,
//                 totalSize: fileSize,
//                 senderIp: ip,
//                 chunkHashes: [],
//                 status: "Receiving",
//                 progress: 0,
//                 lastChunkIndex: startChunkIndex - 1,
//               };
//               fileTransfers.set(fileId, transfer);
//             }

//             inFileTransfer = true;
//             buffer = buffer.slice(headerEnd + 2);
//           } else if (dataStr.startsWith("CHECK_CHUNKS:")) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(`Incomplete CHECK_CHUNKS from host, waiting...`);
//               return;
//             }
//             const message = buffer.slice(0, messageEnd).toString();
//             const [, fileId, lastSentIndex] = message.split(":");
//             const record = await chunkStorage.getTransferRecord(fileId);
//             const lastReceivedIndex = record ? record.lastChunkIndex : -1;
//             client.write(
//               Buffer.from(`ACK_CHUNKS:${fileId}:${lastReceivedIndex}\n`)
//             );
//             buffer = buffer.slice(messageEnd + 1);
//           } else if (dataStr.startsWith("MSG:")) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(`Incomplete MSG from host, waiting...`);
//               return;
//             }
//             const encryptedMsg = buffer.slice(4, messageEnd).toString();
//             const [iv, encrypted] = encryptedMsg.split(":");
//             const decrypted = await decryptData(
//               Buffer.from(encrypted, "base64"),
//               (client as any).sessionKey || "",
//               iv
//             );
//             setMessages((prev) => [...prev, `Host: ${decrypted.toString()}`]);
//             buffer = buffer.slice(messageEnd + 1);
//           } else if (dataStr.startsWith("CHUNK:")) {
//             const chunkEnd = buffer.indexOf(Buffer.from("\n"));
//             if (chunkEnd === -1) {
//               Logger.info(`Incomplete CHUNK header from host, waiting...`);
//               return;
//             }
//             const chunkHeader = buffer.slice(0, chunkEnd).toString();
//             const [, fileId, chunkIndexStr, iv, encrypted] =
//               chunkHeader.split(":");
//             const chunkIndex = parseInt(chunkIndexStr);
//             const record = await chunkStorage.getTransferRecord(fileId);
//             if (!record) {
//               Logger.warn(`No record for ${fileId}, ignoring chunk`);
//               buffer = Buffer.alloc(0);
//               return;
//             }
//             const chunkData = await decryptData(
//               Buffer.from(encrypted, "base64"),
//               record.aesKey || "",
//               iv
//             );
//             const transfer = fileTransfers.get(fileId)!;
//             await chunkStorage.saveChunk(fileId, chunkIndex, chunkData);
//             transfer.chunks[chunkIndex] = chunkData;
//             transfer.receivedBytes += chunkData.length;
//             await chunkStorage.updateLastChunkIndex(fileId, chunkIndex);
//             client.write(Buffer.from(`ACK_CHUNK:${fileId}:${chunkIndex}\n`));
//             Logger.info(
//               `Processed and ACKed chunk ${chunkIndex} for ${fileId}, ${transfer.receivedBytes}/${transfer.totalSize} bytes`
//             );

//             const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
//             const speed = (transfer.receivedBytes / elapsedTime / 1024).toFixed(
//               2
//             );
//             const percentage =
//               (transfer.receivedBytes / transfer.totalSize) * 100;
//             setTransferProgress?.((prev) => [
//               ...prev.filter((p) => p.fileId !== fileId),
//               {
//                 fileId,
//                 fileName: transfer.fileName,
//                 progress: `${transfer.receivedBytes}/${transfer.totalSize} bytes`,
//                 speed: `${speed} KB/s`,
//                 percentage,
//               },
//             ]);

//             if (transfer.receivedBytes >= transfer.totalSize) {
//               const savePath = await chunkStorage.assembleFile(
//                 fileId,
//                 transfer.fileName
//               );
//               setReceivedFiles((prev) => [...prev, savePath]);
//               Logger.info(
//                 `Received and saved file: ${savePath} from ${transfer.deviceName}`
//               );
//               fileTransfers.delete(fileId);
//               inFileTransfer = false;
//             }
//             buffer = buffer.slice(chunkEnd + 1);
//           } else if (
//             dataStr.startsWith("SESSION:") ||
//             dataStr.startsWith("ACK_START:") ||
//             dataStr.startsWith("ACK_CHUNKS:") ||
//             dataStr.startsWith("ACK_CHUNK:") ||
//             dataStr.startsWith("ERROR:")
//           ) {
//             const messageEnd = buffer.indexOf(Buffer.from("\n"));
//             if (messageEnd === -1) {
//               Logger.info(
//                 `Incomplete ${dataStr.slice(0, 10)} from host, waiting...`
//               );
//               return;
//             }
//             // Skip processing these as they are handled elsewhere or are responses
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
//       setTransferProgress?.((prev) =>
//         prev.map((p) =>
//           p.fileId === fileTransfers.keys().next().value
//             ? { ...p, error: err.message }
//             : p
//         )
//       );
//       buffer = Buffer.alloc(0);
//       inFileTransfer = false;
//     }
//   });

//   client.on("close", () => {
//     Logger.info("Disconnected from host");
//     disconnectFromHost(
//       setConnected,
//       setSocket,
//       setMessages,
//       setReceivedFiles,
//       setTransferProgress
//     );
//   });

//   client.on("error", (err) => {
//     Logger.error("Client Socket Error", err);
//     disconnectFromHost(
//       setConnected,
//       setSocket,
//       setMessages,
//       setReceivedFiles,
//       setTransferProgress
//     );
//   });

//   client.connect({ port: TCP_PORT, host: ip });
// }

// export function disconnectFromHost(
//   setConnected: React.Dispatch<React.SetStateAction<boolean>>,
//   setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
//   setMessages: React.Dispatch<React.SetStateAction<string[]>>,
//   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
//   setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
// ): void {
//   Logger.info("Disconnecting from host...");
//   if (clientSocket) {
//     clientSocket.end();
//     clientSocket = null;
//     Logger.info("Client socket closed");
//   }
//   setConnected(false);
//   setSocket(null);
//   setMessages([]);
//   setReceivedFiles([]);
//   setTransferProgress?.([]);
//   Logger.info("Disconnected from host");
// }

// async function sendFileInChunks(
//   socket: TCPSocket.Socket,
//   fileName: string,
//   filePath: string,
//   username: string,
//   fileId: string,
//   setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
// ): Promise<void> {
//   try {
//     const fileSize = (await RNFS.stat(filePath)).size;
//     const chunkSize = calculateChunkSize(fileSize);
//     const totalChunks = Math.ceil(fileSize / chunkSize);
//     const record = await chunkStorage.getTransferRecord(fileId);
//     let lastSentChunkIndex = record ? record.lastChunkIndex : -1;

//     // Query receiver for last received chunk
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
//         sender: username,
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

//     Logger.info(`Sent file: ${fileName} from ${username}`);
//   } catch (error) {
//     Logger.error(`Failed to send file ${fileName}`, error);
//     throw DropShareError.from(
//       error,
//       ERROR_CODES.NETWORK_ERROR,
//       "File transfer failed"
//     );
//   }
// }

// export async function sendFile(
//   socket: TCPSocket.Socket | null,
//   filePath: string,
//   fileData: Buffer,
//   username: string,
//   setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
// ): Promise<void> {
//   if (!socket) {
//     Logger.toast("No active socket to send file", "error");
//     return;
//   }

//   const fileName = filePath.split("/").pop() || "unknown";
//   const senderIp = await getLocalIPAddress();
//   const fileId = chunkStorage.generateFileId(fileName);
//   const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
//   await RNFS.writeFile(tempPath, fileData.toString("base64"), "base64");

//   try {
//     await sendFileInChunks(
//       socket,
//       fileName,
//       tempPath,
//       username,
//       fileId,
//       setTransferProgress
//     );
//   } finally {
//     await RNFS.unlink(tempPath).catch((err) =>
//       Logger.error(`Failed to delete temp file ${tempPath}`, err)
//     );
//   }
// }

// export async function sendMultipleFiles(
//   socket: TCPSocket.Socket | null,
//   files: { filePath: string; fileData: Buffer }[],
//   username: string,
//   setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
// ): Promise<void> {
//   if (!socket) {
//     Logger.toast("No active socket to send files", "error");
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

//     await sendFile(socket, filePath, fileData, username, setTransferProgress);
//     fileTransfers.set(fileId, {
//       fileId,
//       fileName,
//       fileSize: fileData.length,
//       deviceName: username,
//       chunks: [],
//       receivedBytes: fileData.length,
//       startTime: Date.now(),
//       totalChunks: Math.ceil(
//         fileData.length / calculateChunkSize(fileData.length)
//       ),
//       chunkSize: calculateChunkSize(fileData.length),
//       totalSize: fileData.length,
//       senderIp: socket.remoteAddress || "Client",
//       chunkHashes: [],
//       status: "Completed",
//       progress: 100,
//       lastChunkIndex:
//         Math.ceil(fileData.length / calculateChunkSize(fileData.length)) - 1,
//     });
//     Logger.info(`Sent file: ${fileName} from ${username}`);
//   }
// }

// export function sendMessage(
//   socket: TCPSocket.Socket | null,
//   message: string,
//   username: string
// ): void {
//   if (!socket) {
//     Logger.toast("No active socket to send message", "error");
//     return;
//   }
//   if ((socket as any).sessionKey && (socket as any).iv) {
//     const iv = CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
//     encryptData(
//       Buffer.from(`${username}: ${message}`),
//       (socket as any).sessionKey,
//       iv
//     ).then((encrypted) => {
//       socket.write(Buffer.from(`MSG:${iv}:${encrypted.toString("base64")}\n`));
//     });
//   }
// }

// export function stopClientServer(): void {
//   if (clientSocket) {
//     clientSocket.end();
//     clientSocket = null;
//     Logger.info("Client server stopped");
//   }
// }

import dgram from "react-native-udp";
import {
  getLocalIPAddress,
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

let udpSocket: UdpSocket | null = null;
let clientSocket: TCPSocket.Socket | null = null;

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

export async function startClientDiscovery(
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>
): Promise<void> {
  try {
    const localIP = await getLocalIPAddress();
    Logger.info("Client Discovery Started...");

    udpSocket = dgram.createSocket({ type: "udp4" });
    udpSocket.bind(UDP_PORT);

    udpSocket.on("listening", () => {
      Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
      udpSocket!.setBroadcast(true);
    });

    udpSocket.on("message", (msg: Buffer, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.ip !== localIP && data.role === "Host") {
          setDevices((prev) => [
            ...prev.filter((device) => device.ip !== data.ip),
            {
              ip: data.ip,
              name: data.name,
              role: "Host",
            },
          ]);
          Logger.info(`Discovered host: ${data.ip} (${data.name})`);
        }
      } catch (error) {
        Logger.error("Error parsing UDP message", error);
      }
    });

    udpSocket.on("error", (err: Error) => {
      Logger.error("UDP Socket Error", err);
      stopClientDiscovery();
    });
  } catch (err) {
    Logger.error("Failed to start client discovery", err);
    stopClientDiscovery();
  }
}

export function stopClientDiscovery(): void {
  Logger.info("Stopping client discovery...");
  if (udpSocket) {
    udpSocket.close();
    udpSocket = null;
    Logger.info("UDP socket closed");
  }
}

export async function connectToHost(
  ip: string,
  username: string,
  setConnected: React.Dispatch<React.SetStateAction<boolean>>,
  setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
  setMessages: React.Dispatch<React.SetStateAction<string[]>>,
  setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
  setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
): Promise<void> {
  Logger.info(`Connecting to host at ${ip}...`);
  const client = new TCPSocket.Socket();
  clientSocket = client;

  const fileTransfers = new Map<string, FileTransfer>();
  let buffer = Buffer.alloc(0);
  let inFileTransfer = false;

  client.on("connect", () => {
    Logger.info("Connected to host!");
    setConnected(true);
    setSocket(client);
  });

  client.on("data", async (data: string | Buffer) => {
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
            `Invalid data from host ${ip}: ${dataStr.slice(0, 50)}...`
          );
          client.write(
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
              Logger.info(`Incomplete FILE header from host, waiting...`);
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
            const fileId = headerData.fileId;
            const deviceName = headerData.sender || "Unknown";

            if (!fileName || !fileSize || !fileId) {
              throw new DropShareError(
                ERROR_CODES.INVALID_HEADER,
                "Missing file name, size, or ID"
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
              senderIp: ip,
              status: "Receiving",
              progress: 0,
              lastChunkIndex: -1,
              chunkHashes: new Array(totalChunks).fill(""),
            };
            fileTransfers.set(fileId, transfer);

            client.write(Buffer.from(`ACK_START:${fileId}:-1\n`));
            Logger.info(
              `Started new transfer ${fileId} (${fileSize} bytes) from ${deviceName}`
            );

            inFileTransfer = true;
            buffer = buffer.slice(headerEnd + 2);
          } else if (dataStr.startsWith("MSG:")) {
            const messageEnd = buffer.indexOf(Buffer.from("\n"));
            if (messageEnd === -1) {
              Logger.info(`Incomplete MSG from host, waiting...`);
              return;
            }
            const message = buffer.slice(4, messageEnd).toString();
            setMessages((prev) => [...prev, `Host: ${message}`]);
            buffer = buffer.slice(messageEnd + 1);
          } else if (dataStr.startsWith("CHUNK:")) {
            const chunkEnd = buffer.indexOf(Buffer.from("\n"));
            if (chunkEnd === -1) {
              Logger.info(`Incomplete CHUNK header from host, waiting...`);
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
            client.write(Buffer.from(`ACK_CHUNK:${fileId}:${chunkIndex}\n`));
            Logger.info(
              `Processed and ACKed chunk ${chunkIndex} for ${fileId}, ${transfer.receivedBytes}/${transfer.totalSize} bytes`
            );

            const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
            const speed = (transfer.receivedBytes / elapsedTime / 1024).toFixed(
              2
            );
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
                `Incomplete ${dataStr.slice(0, 10)} from host, waiting...`
              );
              return;
            }
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
      }
    } catch (error) {
      Logger.error("Error processing data from host", error);
      const err = DropShareError.from(
        error,
        ERROR_CODES.NETWORK_ERROR,
        "Data processing failed"
      );
      setTransferProgress?.((prev) =>
        prev.map((p) =>
          p.fileId === fileTransfers.keys().next().value
            ? { ...p, error: err.message }
            : p
        )
      );
      buffer = Buffer.alloc(0);
      inFileTransfer = false;
    }
  });

  client.on("close", () => {
    Logger.info("Disconnected from host");
    disconnectFromHost(
      setConnected,
      setSocket,
      setMessages,
      setReceivedFiles,
      setTransferProgress
    );
  });

  client.on("error", (err) => {
    Logger.error("Client Socket Error", err);
    disconnectFromHost(
      setConnected,
      setSocket,
      setMessages,
      setReceivedFiles,
      setTransferProgress
    );
  });

  client.connect({ port: TCP_PORT, host: ip });
}

export function disconnectFromHost(
  setConnected: React.Dispatch<React.SetStateAction<boolean>>,
  setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
  setMessages: React.Dispatch<React.SetStateAction<string[]>>,
  setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
  setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
): void {
  Logger.info("Disconnecting from host...");
  if (clientSocket) {
    clientSocket.end();
    clientSocket = null;
    Logger.info("Client socket closed");
  }
  setConnected(false);
  setSocket(null);
  setMessages([]);
  setReceivedFiles([]);
  setTransferProgress?.([]);
  Logger.info("Disconnected from host");
}

async function sendFileInChunks(
  socket: TCPSocket.Socket,
  fileName: string,
  filePath: string,
  username: string,
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
      deviceName: username,
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
        sender: username,
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
    Logger.info(`Sent file: ${fileName} from ${username}`);
  } catch (error) {
    Logger.error(`Failed to send file ${fileName}`, error);
    throw DropShareError.from(
      error,
      ERROR_CODES.NETWORK_ERROR,
      "File transfer failed"
    );
  }
}

export async function sendFile(
  socket: TCPSocket.Socket | null,
  filePath: string,
  fileData: Buffer,
  username: string,
  setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
): Promise<void> {
  if (!socket) {
    Logger.toast("No active socket to send file", "error");
    return;
  }

  const fileName = filePath.split("/").pop() || "unknown";
  const fileId = `${Date.now()}_${fileName}`;
  const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileId}`;
  await RNFS.writeFile(tempPath, fileData.toString("base64"), "base64");

  try {
    await sendFileInChunks(
      socket,
      fileName,
      tempPath,
      username,
      fileId,
      setTransferProgress
    );
  } finally {
    await RNFS.unlink(tempPath).catch((err) =>
      Logger.error(`Failed to delete temp file ${tempPath}`, err)
    );
  }
}

export async function sendMultipleFiles(
  socket: TCPSocket.Socket | null,
  files: { filePath: string; fileData: Buffer }[],
  username: string,
  setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
): Promise<void> {
  if (!socket) {
    Logger.toast("No active socket to send files", "error");
    return;
  }

  for (const { filePath, fileData } of files) {
    await sendFile(socket, filePath, fileData, username, setTransferProgress);
  }
}

export function sendMessage(
  socket: TCPSocket.Socket | null,
  message: string,
  username: string
): void {
  if (!socket) {
    Logger.toast("No active socket to send message", "error");
    return;
  }
  socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
}

export function stopClientServer(): void {
  if (clientSocket) {
    clientSocket.end();
    clientSocket = null;
    Logger.info("Client server stopped");
  }
}
