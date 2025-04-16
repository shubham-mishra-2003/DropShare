// import dgram from "dgram";
// import { Socket } from "net";
// import net from "net";
// import fs from "fs/promises";
// import path from "path";
// import { Buffer } from "buffer";
// import { v4 as uuidv4 } from "uuid";
// import os from "os";
// import { emitToRenderer } from "./index";

// const UDP_PORT = 5000;
// const TCP_PORT = 6000;
// const APP_IDENTIFIER = "DropShare_Electron";

// let udpSocket: dgram.Socket | null = null;
// let clientSocket: Socket | null = null;

// const getLocalIPAddress = (): string => {
//   const interfaces = os.networkInterfaces();
//   for (const iface of Object.values(interfaces)) {
//     for (const alias of iface as os.NetworkInterfaceInfo[]) {
//       if (alias.family === "IPv4" && !alias.internal) return alias.address;
//     }
//   }
//   throw new Error("No local IP found");
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

// export function startClientDiscovery(): void {
//   const localIP = getLocalIPAddress();
//   udpSocket = dgram.createSocket("udp4");
//   udpSocket.bind(UDP_PORT, () => {
//     console.log(`🔗 Client UDP Socket bound to port ${UDP_PORT}`);
//     udpSocket!.setBroadcast(true);
//   });

//   udpSocket.on("message", (msg: Buffer) => {
//     try {
//       const data = JSON.parse(msg.toString());
//       if (
//         data.ip !== localIP &&
//         data.role === "Host" &&
//         data.appId === APP_IDENTIFIER
//       ) {
//         emitToRenderer("device-discovered", {
//           ip: data.ip,
//           name: data.name,
//           role: "Host" as const,
//         });
//       }
//     } catch (error) {
//       console.error("Error parsing UDP message:", error);
//     }
//   });

//   udpSocket.on("error", (err) => {
//     console.error("❌ UDP Socket Error:", err.message);
//     udpSocket?.close();
//   });
// }

// export function connectToHost(ip: string, username: string): void {
//   clientSocket = net.createConnection({ port: TCP_PORT, host: ip }, () => {
//     console.log("✅ Connected to host!");
//     emitToRenderer("update-connection", true);
//     clientSocket!.write(`${username}: Connected`);
//   });

//   const fileTransfers = new Map<string, FileTransfer>();

//   clientSocket.on("data", async (data: Buffer) => {
//     try {
//       const header = data.slice(0, 5).toString();
//       if (header === "FILE:") {
//         const headerEnd = data.indexOf(Buffer.from("\n\n"));
//         if (headerEnd === -1) return;

//         const headerData = JSON.parse(data.slice(5, headerEnd).toString());
//         const fileId = headerData.fileId || uuidv4();
//         const fileName = headerData.name as string;
//         const fileSize = headerData.size as number;
//         const chunkIndex = headerData.chunkIndex || 0;
//         const chunkSize = getDynamicChunkSize(fileSize);
//         const totalChunks = Math.ceil(fileSize / chunkSize);

//         let transfer = fileTransfers.get(fileId);
//         if (!transfer) {
//           const savePath = await getUniqueSavePath(fileName);
//           transfer = {
//             fileId,
//             fileName,
//             fileSize,
//             chunkSize,
//             totalChunks,
//             receivedChunks: new Set(),
//             lastReceivedChunk: -1,
//             savePath,
//           };
//           fileTransfers.set(fileId, transfer);
//           await fs.writeFile(savePath, "");
//         }

//         const chunkData = data.slice(headerEnd + 2);
//         await fs.appendFile(transfer.savePath, chunkData);
//         transfer.receivedChunks.add(chunkIndex);
//         transfer.lastReceivedChunk = Math.max(
//           transfer.lastReceivedChunk,
//           chunkIndex,
//         );

//         emitToRenderer("file-progress", {
//           fileName,
//           progress: `${transfer.receivedChunks.size * chunkSize}/${fileSize}`,
//           speed: "N/A", // Add speed calculation if needed
//         });

//         if (transfer.receivedChunks.size === transfer.totalChunks) {
//           emitToRenderer("file-received", transfer.savePath);
//           fileTransfers.delete(fileId);
//         }
//       } else {
//         const message = data.toString();
//         emitToRenderer("message-received", message);
//       }
//     } catch (error) {
//       console.error("❌ Error processing data:", error);
//     }
//   });

//   clientSocket.on("close", () => {
//     console.log("🔌 Disconnected from host");
//     emitToRenderer("disconnected", null);
//     emitToRenderer("update-connection", false);
//   });

//   clientSocket.on("error", (err) => {
//     console.error("❌ Client Socket Error:", err.message);
//     clientSocket?.destroy();
//   });
// }

// export function sendMessage(message: string, username: string): void {
//   if (!clientSocket || clientSocket.destroyed) {
//     console.log("❌ Cannot send message: socket unavailable or destroyed");
//     return;
//   }
//   clientSocket.write(`${username}: ${message}`, (err) => {
//     if (err) console.error("❌ Message Write Error:", err.message);
//   });
// }

// export async function sendFile(
//   filePath: string,
//   fileData: Buffer,
//   username: string,
// ): Promise<void> {
//   if (!clientSocket || clientSocket.destroyed) {
//     console.log("❌ Cannot send file: socket unavailable or destroyed");
//     return;
//   }
//   const fileId = uuidv4();
//   const fileName = path.basename(filePath) || "unknown";
//   const chunkSize = getDynamicChunkSize(fileData.length);
//   const totalChunks = Math.ceil(fileData.length / chunkSize);

//   let offset = 0;
//   for (let i = 0; i < totalChunks; i++) {
//     const chunk = fileData.slice(offset, offset + chunkSize);
//     const header = Buffer.from(
//       `FILE:${JSON.stringify({
//         fileId,
//         name: fileName,
//         size: fileData.length,
//         sender: username,
//         chunkIndex: i,
//       })}\n\n`,
//     );
//     clientSocket.write(Buffer.concat([header, chunk]));
//     offset += chunkSize;
//     emitToRenderer("file-progress", {
//       fileName,
//       progress: `${offset}/${fileData.length}`,
//       speed: "N/A", // Add speed calculation if needed
//     });
//   }
// }

// export function stopClientDiscovery(): void {
//   udpSocket?.close();
//   clientSocket?.destroy();
// }

import dgram from "dgram";
import net from "net";
import fs from "fs";
import { app } from "electron";
import path from "path";
import {
  calculateChunkSize,
  getLocalIPAddress,
} from "../renderer/src/utils/NetworkUtils";

const UDP_PORT = 5000;
const TCP_PORT = 6000;

interface FileTransfer {
  fileName: string;
  fileSize: number;
  buffer: Buffer[];
  receivedBytes: number;
}

export function startClientDiscovery(
  setDevices: (devices: Device[] | ((prev: Device[]) => Device[])) => void,
): void {
  getLocalIPAddress()
    .then((localIP) => {
      console.log("🔍 Client Discovery Started...");
      const udpSocket = dgram.createSocket({ type: "udp4", reuseAddr: true });
      udpSocket.bind(UDP_PORT);

      udpSocket.once("listening", () => {
        udpSocket.setBroadcast(true);
      });

      udpSocket.on("message", (msg: Buffer) => {
        try {
          const data = JSON.parse(msg.toString());
          if (data.ip !== localIP && data.role === "Host") {
            setDevices((prev) => [
              ...prev.filter((device) => device.ip !== data.ip),
              { ip: data.ip, name: data.name, role: "Host" },
            ]);
          }
        } catch (error) {
          console.error("Error parsing UDP message:", error);
        }
      });

      udpSocket.on("error", (err) => {
        console.log("❌ UDP Socket Error:", err.message);
      });
    })
    .catch((err) => {
      console.error("Failed to get local IP:", err);
    });
}

export function connectToHost(
  ip: string,
  username: string,
  setConnected: (connected: boolean) => void,
  setSocket: (socket: net.Socket) => void,
  setMessages: (messages: string[] | ((prev: string[]) => string[])) => void,
  setReceivedFiles: (
    files:
      | { path: string; originalName: string }[]
      | ((
          prev: { path: string; originalName: string }[],
        ) => { path: string; originalName: string }[]),
  ) => void,
  setTransferProgress?: (progress: { progress: string; speed: string }) => void,
): void {
  console.log(`🔗 Connecting to host at ${ip}...`);
  const client = net.createConnection({ port: TCP_PORT, host: ip }, () => {
    console.log("✅ Connected to host!");
    setConnected(true);
    setSocket(client);
    client.write(`${username}: Connected`);
  });

  const fileTransfers = new Map<string, FileTransfer>();

  client.on("data", async (data: Buffer) => {
    console.log(`📥 Client received ${data.length} bytes of data`);
    try {
      const header = data.slice(0, 5).toString();
      if (header === "FILE:") {
        const headerEnd = data.indexOf(Buffer.from("\n\n"));
        if (headerEnd === -1) {
          console.log("Incomplete header received, waiting for more data...");
          return;
        }
        const headerStr = data.slice(5, headerEnd).toString();
        const headerData = JSON.parse(headerStr);
        const fileName = headerData.name;
        const fileSize = headerData.size;

        if (!fileName || !fileSize)
          throw new Error("Invalid header: missing name or size");

        fileTransfers.set(fileName, {
          fileName,
          fileSize,
          buffer: [data.slice(headerEnd + 2)],
          receivedBytes: data.slice(headerEnd + 2).length,
        });
        console.log(
          `📥 Client started receiving file: ${fileName} (${fileSize} bytes)`,
        );
        setTransferProgress?.({
          progress: `${fileTransfers.get(fileName)!.receivedBytes}/${fileSize} bytes`,
          speed: "0 KB/s",
        });
      } else {
        let matchedTransfer: FileTransfer | undefined;
        for (const transfer of fileTransfers.values()) {
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
          console.log(
            `📥 Progress for ${matchedTransfer.fileName}: ${matchedTransfer.receivedBytes}/${matchedTransfer.fileSize} bytes`,
          );
          setTransferProgress?.({
            progress: `${matchedTransfer.receivedBytes}/${matchedTransfer.fileSize} bytes`,
            speed: `${speed} KB/s`,
          });

          if (matchedTransfer.receivedBytes >= matchedTransfer.fileSize) {
            const fullFile = Buffer.concat(matchedTransfer.buffer);
            const tempDir = path.join(app.getPath("userData"), "DropShareTemp");
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

            const tempPath = path.join(
              tempDir,
              `${Date.now()}-${matchedTransfer.fileName}`,
            );
            fs.writeFileSync(tempPath, fullFile);
            setReceivedFiles((prev) => [
              ...prev,
              { path: tempPath, originalName: matchedTransfer.fileName },
            ]);
            console.log(
              `📥 Client received and saved file temporarily: ${tempPath}`,
            );
            fileTransfers.delete(matchedTransfer.fileName);
            setTransferProgress?.({ progress: "0/0 bytes", speed: "0 KB/s" });
          }
        } else {
          const message = data.toString();
          console.log("📨 Client received message:", message);
          setMessages((prev) => [...prev, message]);
        }
      }
    } catch (error) {
      console.error("Error processing data:", error);
      fileTransfers.clear();
      setTransferProgress?.({ progress: "0/0 bytes", speed: "0 KB/s" });
    }
  });

  client.on("close", () => {
    console.log("🔌 Disconnected from host");
    setConnected(false);
    setSocket(null as any);
    setMessages([]);
    setReceivedFiles([]);
    fileTransfers.clear();
    setTransferProgress?.({ progress: "0/0 bytes", speed: "0 KB/s" });
  });

  client.on("error", (err) => {
    console.log("❌ Client Socket Error:", err.message);
    setConnected(false);
    setSocket(null as any);
    fileTransfers.clear();
  });
}

export async function sendFile(
  socket: net.Socket,
  filePath: string,
  fileData: Buffer,
  username: string,
  setTransferProgress?: (progress: { progress: string; speed: string }) => void,
): Promise<void> {
  if (!socket) {
    console.log("❌ No active socket to send file.");
    return;
  }

  const fileName = filePath.split(/[\\/]/).pop() || "unknown";
  const fileSize = fileData.length;
  const chunkSize = calculateChunkSize(fileSize);
  const header = Buffer.from(
    `FILE:${JSON.stringify({
      name: fileName,
      size: fileSize,
      sender: username,
    })}\n\n`,
  );
  console.log(
    `📤 Preparing to send file: ${fileName} (${fileSize} bytes) from ${username}`,
  );

  socket.write(header);

  let sentBytes = 0;
  const startTime = Date.now();

  for (let i = 0; i < fileSize; i += chunkSize) {
    const chunk = fileData.slice(i, i + chunkSize);
    socket.write(chunk);
    sentBytes += chunk.length;
    const elapsedTime = (Date.now() - startTime) / 1000 || 1;
    const speed = (sentBytes / elapsedTime / 1024).toFixed(2);
    setTransferProgress?.({
      progress: `${sentBytes}/${fileSize} bytes`,
      speed: `${speed} KB/s`,
    });
    console.log(
      `📤 Sent chunk: ${sentBytes}/${fileSize} bytes at ${speed} KB/s`,
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }

  console.log(`📤 Sent file: ${fileName} from ${username}`);
}

export function sendMessage(
  socket: net.Socket,
  message: string,
  username: string,
): void {
  if (socket) {
    console.log(`📤 Sending message from ${username}:`, message);
    socket.write(`${username}: ${message}`);
  } else {
    console.log("❌ No active socket to send message.");
  }
}
