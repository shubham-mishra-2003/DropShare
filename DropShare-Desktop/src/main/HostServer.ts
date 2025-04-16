// import { Server, Socket } from "net";
// import dgram from "dgram";
// import fs from "fs/promises";
// import path from "path";
// import { Buffer } from "buffer";
// import { v4 as uuidv4 } from "uuid";
// import os from "os";
// import { emitToRenderer } from "./index";

// const UDP_PORT = 5000;
// const TCP_PORT = 6000;
// const APP_IDENTIFIER = "DropShare_Electron";

// let connectedSockets: Socket[] = [];
// let isServerRunning = false;
// let udpSocket: dgram.Socket | null = null;
// let tcpServer: Server | null = null;

// const getLocalIPAddress = (): string => {
//   const interfaces = os.networkInterfaces();
//   for (const iface of Object.values(interfaces)) {
//     for (const alias of iface as os.NetworkInterfaceInfo[]) {
//       if (alias.family === "IPv4" && !alias.internal) return alias.address;
//     }
//   }
//   throw new Error("No local IP found");
// };

// const getBroadcastIPAddress = (ip: string): string => {
//   const parts = ip.split(".");
//   return `${parts[0]}.${parts[1]}.${parts[2]}.255`;
// };

// const getDynamicChunkSize = (fileSize: number): number => {
//   if (fileSize < 1024 * 1024) return 64 * 1024;
//   if (fileSize < 10 * 1024 * 1024) return 256 * 1024;
//   if (fileSize < 1024 * 1024 * 1024) return 2 * 1024 * 1024;
//   return 8 * 1024 * 1024;
// };

// const getUniqueSavePath = async (fileName: string): Promise<string> => {
//   const saveDir = path.join(__dirname, "../received");
//   await fs.mkdir(saveDir, { recursive: true });
//   let savePath = path.join(saveDir, fileName);
//   let counter = 1;
//   const [name, ext] = fileName.split(/(\.[^.]+)$/);
//   while (await fs.stat(savePath).catch(() => false)) {
//     savePath = path.join(saveDir, `${name}-${counter}${ext || ""}`);
//     counter++;
//   }
//   return savePath;
// };

// export function startHostServer(username: string): string {
//   if (isServerRunning) {
//     console.log("🔵 Host server already running, skipping start.");
//     return getLocalIPAddress();
//   }
//   isServerRunning = true;

//   const ip = getLocalIPAddress();
//   const broadcastAddr = getBroadcastIPAddress(ip);

//   udpSocket = dgram.createSocket("udp4");
//   udpSocket.bind(UDP_PORT, () => {
//     console.log(`🔗 UDP Socket bound to port ${UDP_PORT}`);
//     udpSocket!.setBroadcast(true);
//     const broadcastInterval = setInterval(() => {
//       const message = JSON.stringify({
//         role: "Host",
//         ip,
//         name: username,
//         appId: APP_IDENTIFIER,
//       });
//       udpSocket!.send(message, UDP_PORT, broadcastAddr, (err) => {
//         if (err) console.error("❌ UDP Send Error:", err.message);
//       });
//     }, 2000);
//     udpSocket!.on("close", () => clearInterval(broadcastInterval));
//   });

//   tcpServer = new Server((socket: Socket) => {
//     console.log("✅ Client connected:", socket.remoteAddress);
//     connectedSockets.push(socket);
//     emitToRenderer("update-devices", [
//       ...connectedSockets.map((s) => ({
//         ip: s.remoteAddress || "Unknown",
//         name: "Client",
//         role: "Client" as const,
//       })),
//     ]);

//     const fileTransfers = new Map<string, FileTransfer>();

//     socket.on("data", async (data: Buffer) => {
//       try {
//         const header = data.slice(0, 5).toString();
//         if (header === "FILE:") {
//           const headerEnd = data.indexOf(Buffer.from("\n\n"));
//           if (headerEnd === -1) return;

//           const headerData = JSON.parse(data.slice(5, headerEnd).toString());
//           const fileId = headerData.fileId || uuidv4();
//           const fileName = headerData.name as string;
//           const fileSize = headerData.size as number;
//           const deviceName = headerData.sender || "Unknown";
//           const chunkIndex = headerData.chunkIndex || 0;
//           const chunkSize = getDynamicChunkSize(fileSize);
//           const totalChunks = Math.ceil(fileSize / chunkSize);

//           let transfer = fileTransfers.get(fileId);
//           if (!transfer) {
//             const savePath = await getUniqueSavePath(fileName);
//             transfer = {
//               fileId,
//               fileName,
//               fileSize,
//               deviceName,
//               chunkSize,
//               totalChunks,
//               receivedChunks: new Set(),
//               lastReceivedChunk: -1,
//               savePath,
//             };
//             fileTransfers.set(fileId, transfer);
//             await fs.writeFile(savePath, "");
//           }

//           const chunkData = data.slice(headerEnd + 2);
//           await fs.appendFile(transfer.savePath, chunkData);
//           transfer.receivedChunks.add(chunkIndex);
//           transfer.lastReceivedChunk = Math.max(
//             transfer.lastReceivedChunk,
//             chunkIndex,
//           );

//           emitToRenderer("file-progress", {
//             fileName,
//             progress: `${transfer.receivedChunks.size * chunkSize}/${fileSize}`,
//             speed: "N/A", // Add speed calculation if needed
//           });

//           if (transfer.receivedChunks.size === transfer.totalChunks) {
//             emitToRenderer("file-received", transfer.savePath);
//             fileTransfers.delete(fileId);
//           }
//         } else {
//           const message = data.toString();
//           emitToRenderer("message-received", message);
//           broadcastMessage(socket, data);
//         }
//       } catch (error) {
//         console.error("❌ Error processing data:", error);
//       }
//     });

//     socket.on("close", () => handleSocketClose(socket));
//     socket.on("error", (err) => console.error("❌ Socket Error:", err.message));
//   });

//   tcpServer.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
//     console.log("🚀 Host TCP server running on port", TCP_PORT);
//   });

//   return ip;
// }

// export function stopHostServer(): void {
//   if (!isServerRunning) return;
//   connectedSockets.forEach((socket) => socket.destroy());
//   connectedSockets = [];
//   udpSocket?.close();
//   tcpServer?.close(() => {
//     console.log("🔌 Host TCP server closed");
//     isServerRunning = false;
//     emitToRenderer("disconnected", null);
//   });
// }

// export function removeClient(ip: string): void {
//   const socket = connectedSockets.find((s) => s.remoteAddress === ip);
//   if (socket) {
//     socket.destroy();
//     connectedSockets = connectedSockets.filter((s) => s !== socket);
//     emitToRenderer("update-devices", [
//       ...connectedSockets.map((s) => ({
//         ip: s.remoteAddress || "Unknown",
//         name: "Client",
//         role: "Client" as const,
//       })),
//     ]);
//   }
// }

// function handleSocketClose(socket: Socket): void {
//   console.log("🔌 Client disconnected:", socket.remoteAddress);
//   connectedSockets = connectedSockets.filter((s) => s !== socket);
//   emitToRenderer("update-devices", [
//     ...connectedSockets.map((s) => ({
//       ip: s.remoteAddress || "Unknown",
//       name: "Client",
//       role: "Client" as const,
//     })),
//   ]);
// }

// function broadcastMessage(senderSocket: Socket, data: Buffer): void {
//   connectedSockets.forEach((socket) => {
//     if (socket !== senderSocket && !socket.destroyed) {
//       socket.write(data, (err) => {
//         if (err) console.error("❌ Broadcast Write Error:", err.message);
//       });
//     }
//   });
// }

// export function sendHostMessage(message: string, username: string): void {
//   if (!tcpServer || connectedSockets.length === 0) {
//     console.log("❌ No connected clients to send message.");
//     return;
//   }
//   const formattedMessage = `${username}: ${message}`;
//   broadcastMessage({} as Socket, Buffer.from(formattedMessage));
// }

// export async function sendHostFile(
//   filePath: string,
//   fileData: Buffer,
//   username: string,
// ): Promise<void> {
//   if (!tcpServer || connectedSockets.length === 0) {
//     console.log("❌ No connected clients to send file.");
//     return;
//   }
//   const fileId = uuidv4();
//   const fileName = path.basename(filePath) || "unknown";
//   const chunkSize = getDynamicChunkSize(fileData.length);
//   const totalChunks = Math.ceil(fileData.length / chunkSize);

//   for (const socket of connectedSockets) {
//     if (!socket.destroyed) {
//       let offset = 0;
//       for (let i = 0; i < totalChunks; i++) {
//         const chunk = fileData.slice(offset, offset + chunkSize);
//         const header = Buffer.from(
//           `FILE:${JSON.stringify({
//             fileId,
//             name: fileName,
//             size: fileData.length,
//             sender: username,
//             chunkIndex: i,
//           })}\n\n`,
//         );
//         socket.write(Buffer.concat([header, chunk]));
//         offset += chunkSize;
//         emitToRenderer("file-progress", {
//           fileName,
//           progress: `${offset}/${fileData.length}`,
//           speed: "N/A", // Add speed calculation if needed
//         });
//       }
//     }
//   }
// }

// import dgram from "dgram";
// import net from "net";
// import fs from "fs";

// import { app } from "electron";
// import path from "path";
// import { calculateChunkSize, getBroadcastIPAddress, getLocalIPAddress } from "../renderer/src/utils/NetworkUtils";

// const UDP_PORT = 5000;
// const TCP_PORT = 6000;

// let connectedSockets: net.Socket[] = [];
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
//   setDevices: (devices: Device[]) => void,
//   setSocket: (server: net.Server) => void,
//   setMessages: (messages: string[]) => void,
//   setReceivedFiles: (files: { path: string; originalName: string }[]) => void,
//   setTransferProgress?: (progress: { progress: string; speed: string }) => void,
// ): void {
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
//         broadcastAddr,
//       );
//       const udpSocket = dgram.createSocket({ type: "udp4", reuseAddr: true });
//       udpSocket.bind(UDP_PORT);

//       udpSocket.once("listening", () => {
//         console.log(`🔗 UDP Socket bound to port ${UDP_PORT}`);
//         udpSocket.setBroadcast(true);
//         setInterval(() => {
//           const message = Buffer.from(
//             JSON.stringify({ role: "Host", ip, name: username }),
//           );
//           udpSocket.send(message, UDP_PORT, broadcastAddr, (err) => {
//             if (err)
//               console.error(
//                 "❌ UDP Send Error:",
//                 err.stack || err.message || err,
//               );
//           });
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
//         setDevices([
//           ...connectedSockets.map((s) => ({
//             ip: s.remoteAddress || "Unknown",
//             name: "Client",
//             role: "Client" as const,
//             deviceName: "Unknown",
//           })),
//         ]);
//         const fileTransfers = new Map<string, FileTransfer>();

//         socket.on("data", async (data: Buffer) => {
//           console.log(
//             `📥 Host received ${data.length} bytes of data from ${socket.remoteAddress}`,
//           );
//           try {
//             const header = data.slice(0, 5).toString();
//             if (header === "FILE:") {
//               const headerEnd = data.indexOf(Buffer.from("\n\n"));
//               if (headerEnd === -1) {
//                 console.log(
//                   "Incomplete header received, waiting for more data...",
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
//                 `📥 Host started receiving file: ${fileName} (${fileSize} bytes) from ${deviceName}`,
//               );
//               setTransferProgress?.({
//                 progress: `${fileTransfers.get(fileName)!.receivedBytes}/${fileSize} bytes`,
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
//                   `📥 Progress for ${matchedTransfer.fileName}: ${matchedTransfer.receivedBytes}/${matchedTransfer.fileSize} bytes`,
//                 );
//                 setTransferProgress?.({
//                   progress: `${matchedTransfer.receivedBytes}/${matchedTransfer.fileSize} bytes`,
//                   speed: `${speed} KB/s`,
//                 });

//                 if (matchedTransfer.receivedBytes >= matchedTransfer.fileSize) {
//                   const fullFile = Buffer.concat(matchedTransfer.buffer);
//                   const tempDir = path.join(
//                     app.getPath("userData"),
//                     "DropShareTemp",
//                   );
//                   if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

//                   const tempPath = path.join(
//                     tempDir,
//                     `${Date.now()}-${matchedTransfer.fileName}`,
//                   );
//                   fs.writeFileSync(tempPath, fullFile);
//                   setReceivedFiles((prev) => [
//                     ...prev,
//                     { path: tempPath, originalName: matchedTransfer.fileName },
//                   ]);
//                   console.log(
//                     `📥 Host received and saved file temporarily: ${tempPath} from ${matchedTransfer.deviceName}`,
//                   );

//                   connectedSockets.forEach((s) => {
//                     if (s !== socket) {
//                       sendFileInChunks(
//                         s,
//                         matchedTransfer!.fileName,
//                         fullFile,
//                         matchedTransfer!.deviceName,
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
//                     s.write(data, (err) => {
//                       if (err)
//                         console.error(
//                           "❌ Write Error to Client:",
//                           err.stack || err.message || err,
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
//           setDevices(
//             connectedSockets.map((s) => ({
//               ip: s.remoteAddress || "Unknown",
//               name: "Client",
//               role: "Client" as const,
//               deviceName: "Unknown",
//             })),
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

// async function sendFileInChunks(
//   socket: net.Socket,
//   fileName: string | null,
//   fileData: Buffer,
//   deviceName: string | null,
// ): Promise<void> {
//   const safeFileName = fileName || "unnamed_file";
//   const fileSize = fileData.length;
//   const chunkSize = calculateChunkSize(fileSize);
//   const header = Buffer.from(
//     `FILE:${JSON.stringify({
//       name: safeFileName,
//       size: fileSize,
//       sender: deviceName || "Host",
//     })}\n\n`,
//   );
//   socket.write(header, (err) => {
//     if (err)
//       console.error("❌ Header Write Error:", err.stack || err.message || err);
//   });

//   let sentBytes = 0;
//   const startTime = Date.now();

//   for (let i = 0; i < fileSize; i += chunkSize) {
//     const chunk = fileData.slice(i, i + chunkSize);
//     socket.write(chunk, (err) => {
//       if (err)
//         console.error("❌ Chunk Write Error:", err.stack || err.message || err);
//     });
//     sentBytes += chunk.length;
//     const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//     const speed = (sentBytes / elapsedTime / 1024).toFixed(2);
//     console.log(
//       `📤 Sent chunk: ${sentBytes}/${fileSize} bytes at ${speed} KB/s`,
//     );
//     await new Promise<void>((resolve) => setTimeout(resolve, 5));
//   }

//   console.log(
//     `📤 Broadcasted file: ${safeFileName} from ${deviceName || "Host"}`,
//   );
// }

// export async function sendHostFile(
//   filePath: string,
//   fileData: Buffer,
//   username: string,
//   setTransferProgress?: (progress: { progress: string; speed: string }) => void,
// ): Promise<void> {
//   if (connectedSockets.length === 0) {
//     console.log("❌ No connected clients to send file.");
//     return;
//   }

//   const fileName = filePath.split(/[\\/]/).pop() || "unknown";
//   console.log(
//     `📤 Preparing to send file: ${fileName} (${fileData.length} bytes)`,
//   );
//   await Promise.all(
//     connectedSockets.map((socket) =>
//       sendFileInChunks(socket, fileName, fileData, username),
//     ),
//   );
//   setTransferProgress?.({
//     progress: `${fileData.length}/${fileData.length} bytes`,
//     speed: "0 KB/s",
//   });
//   console.log(`📤 Sent file: ${fileName} from ${username} to all clients`);
// }

// export function sendHostMessage(
//   message: string,
//   username: string,
// ): void {
//   if (connectedSockets.length === 0) {
//     console.log("❌ No connected clients to send message.");
//     return;
//   }
//   const formattedMessage = `${username}: ${message}`;
//   console.log("📤 Sending message from Host:", formattedMessage);
//   connectedSockets.forEach((socket) => {
//     socket.write(formattedMessage, (err) => {
//       if (err)
//         console.error(
//           `❌ Write Error to ${socket.remoteAddress}:`,
//           err.stack || err.message || err,
//         );
//     });
//   });
// }

import dgram from "dgram";
import net from "net";
import { Buffer } from "buffer";
import { ipcMain } from "electron";
import {
  calculateChunkSize,
  getBroadcastIPAddress,
  getLocalIPAddress,
} from "../renderer/src/utils/NetworkUtils";
import { chunkStorage } from "../renderer/src/db/chunkStorage";

const UDP_PORT = 5000;
const TCP_PORT = 6000;

let connectedSockets: net.Socket[] = [];
let isServerRunning = false;

interface FileTransfer {
  fileId: string;
  fileName: string;
  fileSize: number;
  deviceName: string;
  buffer: Buffer[];
  receivedBytes: number;
  chunkSize: number;
  totalChunks: number;
}

interface Device {
  ip: string;
  name: string;
  role: string;
  deviceName: string;
}

export function startHostServer(
  username: string,
  setDevices: (devices: Device[] | ((prev: Device[]) => Device[])) => void,
  setSocket: (socket: net.Server | null) => void,
  setMessages: (messages: string[] | ((prev: string[]) => string[])) => void,
  setReceivedFiles: (
    files:
      | { path: string; originalName: string }[]
      | ((
          prev: { path: string; originalName: string }[],
        ) => { path: string; originalName: string }[]),
  ) => void,
  setTransferProgress?: (progress: {
    [fileId: string]: { progress: string; speed: string; percentage: number };
  }) => void,
): void {
  if (isServerRunning) {
    console.log("🔵 Host server already running, skipping start.");
    return;
  }
  isServerRunning = true;
  chunkStorage
    .initialize()
    .catch((err) => console.error("ChunkStorage init failed:", err));

  getLocalIPAddress()
    .then(async (ip) => {
      const broadcastAddr = await getBroadcastIPAddress();
      console.log(
        "🔵 Host started on IP:",
        ip,
        "Broadcasting to:",
        broadcastAddr,
      );
      const udpSocket = dgram.createSocket({ type: "udp4", reusePort: true });
      udpSocket.bind(UDP_PORT);

      udpSocket.once("listening", () => {
        console.log(`🔗 UDP Socket bound to port ${UDP_PORT}`);
        udpSocket.setBroadcast(true);
        const broadcastInterval = setInterval(() => {
          const message = JSON.stringify({ role: "Host", ip, name: username });
          udpSocket.send(
            message,
            0,
            message.length,
            UDP_PORT,
            broadcastAddr,
            (err) => {
              if (err)
                console.error(
                  "❌ UDP Send Error:",
                  err.stack || err.message || err,
                );
            },
          );
        }, 2000);

        // Cleanup interval on socket close
        udpSocket.on("close", () => clearInterval(broadcastInterval));
      });

      udpSocket.on("error", (err) => {
        console.log("❌ UDP Socket Error:", err.stack || err.message || err);
        isServerRunning = false;
        udpSocket.close();
      });

      const server = net.createServer((socket) => {
        console.log("✅ Client connected:", socket.remoteAddress);
        connectedSockets.push(socket);
        setSocket(server);
        setDevices((currentDevices: Device[]) => [
          ...currentDevices.filter((d) => d.ip !== socket.remoteAddress),
          {
            ip: socket.remoteAddress || "Unknown",
            name: "Client",
            role: "Client",
            deviceName: "Unknown",
          },
        ]);
        const fileTransfers = new Map<string, FileTransfer>();

        socket.on("data", async (data: Buffer) => {
          console.log(
            `📥 Host received ${data.length} bytes of data from ${socket.remoteAddress}`,
          );
          try {
            const header = data.slice(0, 5).toString();
            if (header === "FILE:") {
              const headerEnd = data.indexOf(Buffer.from("\n\n"));
              if (headerEnd === -1) {
                console.log(
                  "Incomplete header received, waiting for more data...",
                );
                return;
              }
              const headerStr = data.slice(5, headerEnd).toString();
              const headerData = JSON.parse(headerStr);
              const fileName = headerData.name;
              const fileSize = headerData.size;
              const deviceName = headerData.sender || "Unknown";
              const chunkSize = calculateChunkSize(fileSize);
              const totalChunks = Math.ceil(fileSize / chunkSize);
              const fileId = await chunkStorage.generateFileId(
                socket.remoteAddress || "Unknown",
                fileName,
                Date.now(),
              );

              if (!fileName || !fileSize)
                throw new Error("Invalid header: missing name or size");

              const initialChunk = data.slice(headerEnd + 2);
              const transfer: FileTransfer = {
                fileId,
                fileName,
                fileSize,
                deviceName,
                buffer: [initialChunk],
                receivedBytes: initialChunk.length,
                chunkSize,
                totalChunks,
              };
              fileTransfers.set(fileId, transfer);

              await chunkStorage.saveTransferRecord({
                fileId,
                fileName,
                totalSize: fileSize,
                chunkSize,
                lastChunkIndex: -1,
                totalChunks,
                status: "in_progress",
                senderIp: socket.remoteAddress || "Unknown",
                timestamp: Date.now(),
              });
              await chunkStorage.saveChunk(fileId, 0, initialChunk);

              console.log(
                `📥 Host started receiving file: ${fileName} (${fileSize} bytes) from ${deviceName}`,
              );
              setTransferProgress?.({
                [fileId]: {
                  progress: `${transfer.receivedBytes}/${fileSize} bytes`,
                  speed: "0 KB/s",
                  percentage: (transfer.receivedBytes / fileSize) * 100,
                },
              });
            } else {
              let matchedTransfer: FileTransfer | undefined;
              for (const [fileId, transfer] of fileTransfers) {
                if (transfer.receivedBytes < transfer.fileSize) {
                  matchedTransfer = transfer;
                  break;
                }
              }

              if (matchedTransfer) {
                const startTime = Date.now();
                matchedTransfer.buffer.push(data);
                matchedTransfer.receivedBytes += data.length;
                const elapsedTime = (Date.now() - startTime) / 1000 || 1;
                const speed = (data.length / elapsedTime / 1024).toFixed(2);
                const chunkIndex =
                  Math.floor(
                    matchedTransfer.receivedBytes / matchedTransfer.chunkSize,
                  ) - 1;

                console.log(
                  `📥 Progress for ${matchedTransfer.fileName}: ${matchedTransfer.receivedBytes}/${matchedTransfer.fileSize} bytes`,
                );
                setTransferProgress?.({
                  [matchedTransfer.fileId]: {
                    progress: `${matchedTransfer.receivedBytes}/${matchedTransfer.fileSize} bytes`,
                    speed: `${speed} KB/s`,
                    percentage:
                      (matchedTransfer.receivedBytes /
                        matchedTransfer.fileSize) *
                      100,
                  },
                });

                if (
                  chunkIndex >= 0 &&
                  chunkIndex < matchedTransfer.totalChunks
                ) {
                  await chunkStorage.saveChunk(
                    matchedTransfer.fileId,
                    chunkIndex,
                    data,
                  );
                  await chunkStorage.updateLastChunkIndex(
                    matchedTransfer.fileId,
                    chunkIndex,
                    "in_progress",
                  );
                }

                if (matchedTransfer.receivedBytes >= matchedTransfer.fileSize) {
                  const tempPath = await chunkStorage.assembleFile(
                    matchedTransfer.fileId,
                    matchedTransfer.fileName,
                  );
                  setReceivedFiles((prevFiles) => [
                    ...prevFiles,
                    { path: tempPath, originalName: matchedTransfer.fileName },
                  ]);
                  console.log(
                    `📥 Host received and assembled file: ${tempPath} from ${matchedTransfer.deviceName}`,
                  );

                  const fileBuffer = Buffer.concat(matchedTransfer.buffer);
                  for (const s of connectedSockets) {
                    if (s !== socket) {
                      await sendFileInChunks(
                        s,
                        matchedTransfer.fileName,
                        fileBuffer,
                        matchedTransfer.deviceName,
                      );
                    }
                  }

                  fileTransfers.delete(matchedTransfer.fileId);
                  setTransferProgress?.({
                    [matchedTransfer.fileId]: {
                      progress: `${matchedTransfer.fileSize}/${matchedTransfer.fileSize} bytes`,
                      speed: "0 KB/s",
                      percentage: 100,
                    },
                  });
                }
              } else {
                const message = data.toString();
                console.log(`📨 Host received message: ${message}`);
                setMessages((prevMessages) => [...prevMessages, message]);
                for (const s of connectedSockets) {
                  if (s !== socket) {
                    s.write(data, (err?: Error) => {
                      if (err) console.error("❌ Write Error to Client:", err);
                    });
                  }
                }
              }
            }
          } catch (error) {
            console.error("Error processing data:", error);
            fileTransfers.clear();
            setTransferProgress?.({});
          }
        });

        socket.on("close", () => {
          console.log("🔌 Client disconnected:", socket.remoteAddress);
          connectedSockets = connectedSockets.filter((s) => s !== socket);
          setDevices((currentDevices: Device[]) =>
            currentDevices.filter((d) => d.ip !== socket.remoteAddress),
          );
          fileTransfers.clear();
        });

        socket.on("error", (err) => {
          console.log("❌ Host Socket Error:", err.stack || err.message || err);
          fileTransfers.clear();
        });
      });

      server.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
        console.log("🚀 Host TCP server running on port", TCP_PORT);
      });

      server.on("error", (err) => {
        console.log("❌ Server Error:", err.stack || err.message || err);
        isServerRunning = false;
        server.close();
      });

      server.on("close", () => {
        console.log("🔌 Host TCP server closed");
        isServerRunning = false;
        connectedSockets = [];
      });
    })
    .catch((err) => {
      console.error("Failed to get local IP:", err.stack || err.message || err);
      isServerRunning = false;
    });
}

async function sendFileInChunks(
  socket: net.Socket,
  fileName: string | null,
  fileData: Buffer,
  deviceName: string | null,
): Promise<void> {
  const safeFileName = fileName || "unnamed_file";
  const fileSize = fileData.length;
  const chunkSize = calculateChunkSize(fileSize);
  const header = Buffer.from(
    `FILE:${JSON.stringify({
      name: safeFileName,
      size: fileSize,
      sender: deviceName || "Host",
    })}\n\n`,
  );
  socket.write(header, (err: any) => {
    if (err)
      console.error("❌ Header Write Error:", err.stack || err.message || err);
  });

  let sentBytes = 0;
  const startTime = Date.now();

  for (let i = 0; i < fileSize; i += chunkSize) {
    const chunk = fileData.slice(i, i + chunkSize);
    socket.write(chunk, (err: any) => {
      if (err)
        console.error("❌ Chunk Write Error:", err.stack || err.message || err);
    });
    sentBytes += chunk.length;
    const elapsedTime = (Date.now() - startTime) / 1000 || 1;
    const speed = (sentBytes / elapsedTime / 1024).toFixed(2);
    console.log(
      `📤 Sent chunk: ${sentBytes}/${fileSize} bytes at ${speed} KB/s`,
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 10)); // Increased delay for large files
  }

  console.log(
    `📤 Broadcasted file: ${safeFileName} from ${deviceName || "Host"}`,
  );
}

export async function sendHostFile(
  server: net.Server | null,
  filePath: string,
  fileData: Buffer,
  username: string,
  setTransferProgress?: (progress: {
    [fileId: string]: { progress: string; speed: string; percentage: number };
  }) => void,
): Promise<void> {
  if (connectedSockets.length === 0) {
    console.log("❌ No connected clients to send file.");
    return;
  }

  const fileName = filePath.split("/").pop() || "unknown";
  const fileSize = fileData.length;
  const chunkSize = calculateChunkSize(fileSize);
  const totalChunks = Math.ceil(fileSize / fileData.length);
  const fileId = await chunkStorage.generateFileId(
    "Host",
    fileName,
    Date.now(),
  );

  console.log(
    `📤 Preparing to send file: ${fileName} (${fileData.length} bytes)`,
  );

  let sentBytes = 0;
  const startTime = Date.now();

  await Promise.all(
    connectedSockets.map(async (socket) => {
      await sendFileInChunks(socket, fileName, fileData, username);

      sentBytes += fileData.length;
      const elapsedTime = (Date.now() - startTime) / 1000 || 1;
      const speed = (sentBytes / elapsedTime / 1024).toFixed(2);
      setTransferProgress?.({
        [fileId]: {
          progress: `${sentBytes}/${fileSize} bytes`,
          speed: `${speed} KB/s`,
          percentage: (sentBytes / fileSize) * 100,
        },
      });
    }),
  );

  setTransferProgress?.({
    [fileId]: {
      progress: `${fileSize}/${fileSize} bytes`,
      speed: "0 KB/s",
      percentage: 100,
    },
  });

  console.log(`📤 Sent file: ${fileName} from ${username} to all clients`);
}

// Register IPC handlers for chunk storage operations
ipcMain.handle("initialize-chunk-storage", async () => {
  await chunkStorage.initialize();
});

ipcMain.handle(
  "generate-file-id",
  async (_event, senderIp: string, fileName: string, timestamp: number) => {
    return chunkStorage.generateFileId(senderIp, fileName, timestamp);
  },
);

ipcMain.handle(
  "save-chunk",
  async (_event, fileId: string, chunkIndex: number, chunkData: Buffer) => {
    await chunkStorage.saveChunk(fileId, chunkIndex, chunkData);
  },
);

ipcMain.handle(
  "get-chunk",
  async (_event, fileId: string, chunkIndex: number) => {
    return chunkStorage.getChunk(fileId, chunkIndex);
  },
);

ipcMain.handle(
  "save-transfer-record",
  async (
    _event,
    fileId: string,
    fileName: string,
    totalSize: number,
    chunkSize: number,
    totalChunks: number,
    senderIp: string,
  ) => {
    await chunkStorage.saveTransferRecord({
      fileId,
      fileName,
      totalSize,
      chunkSize,
      lastChunkIndex: -1,
      totalChunks,
      status: "in_progress",
      senderIp,
      timestamp: Date.now(),
    });
  },
);

ipcMain.handle(
  "update-last-chunk-index",
  async (
    _event,
    fileId: string,
    lastChunkIndex: number,
    status: "in_progress" | "completed" | "interrupted",
  ) => {
    await chunkStorage.updateLastChunkIndex(fileId, lastChunkIndex, status);
  },
);

ipcMain.handle("get-transfer-record", async (_event, fileId: string) => {
  return chunkStorage.getTransferRecord(fileId);
});

ipcMain.handle("delete-transfer", async (_event, fileId: string) => {
  await chunkStorage.deleteTransfer(fileId);
});

ipcMain.handle(
  "assemble-file",
  async (_event, fileId: string, fileName: string) => {
    return chunkStorage.assembleFile(fileId, fileName);
  },
);
