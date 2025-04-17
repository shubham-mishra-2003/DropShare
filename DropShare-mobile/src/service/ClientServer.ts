import dgram from "react-native-udp";
import {
  getLocalIPAddress,
  checkTransferLimits,
  calculateDynamicChunkDivision,
} from "../utils/NetworkUtils";
import { Buffer } from "buffer";
import { Logger } from "../utils/Logger";
import { DropShareError, ERROR_CODES } from "../utils/Error";
import TCPSocket from "react-native-tcp-socket";
import RNFS from "react-native-fs";
import { savePath } from "../utils/FileSystemUtil";

type UdpSocket = ReturnType<typeof dgram.createSocket>;

const UDP_PORT = 5000;
const TCP_PORT = 6000;
const ACK_TIMEOUT = 10000;
const MAX_RETRIES = 3;

let udpSocket: UdpSocket | null = null;
let clientSocket: TCPSocket.Socket | null = null;

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
          // Logger.info(`Discovered host: ${data.ip} (${data.name})`);
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

  client.on("connect", () => {
    Logger.info("Connected to host!");
    setConnected(true);
    setSocket(client);
  });

  client.on("data", async (data: string | Buffer) => {
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
              Logger.error(`Failed to parse CHUNK header: ${headerStr}`, error);
              throw new DropShareError(
                ERROR_CODES.INVALID_HEADER,
                "Invalid chunk header"
              );
            }
            const chunkSize = chunkData.chunkSize;
            const expectedChunkEnd = headerEnd + 2 + chunkSize;
            if (buffer.length < expectedChunkEnd) {
              Logger.info(
                `Incomplete chunk data for ${chunkData.fileId}, waiting...`
              );
              return;
            }
            const chunk = buffer.slice(headerEnd + 2, expectedChunkEnd);
            if (chunk.length !== chunkSize) {
              Logger.error(
                `Chunk size mismatch for ${chunkData.fileId}: expected ${chunkSize}, received ${chunk.length}`
              );
              throw new DropShareError(
                ERROR_CODES.CORRUPTED_CHUNK,
                `Chunk size mismatch: expected ${chunkSize}, received ${chunk.length}`
              );
            }

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
              // All chunks received, reconstruct file
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
                `${savePath}/${fileName}`,
                fileBuffer.toString("base64"),
                "base64"
              );
              setReceivedFiles((prev) => [...prev, `${savePath}/${fileName}`]);
              Logger.info(
                `Received and saved file: ${savePath}/${fileName} from ${deviceName}`
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
              `Unexpected data while receiving file: ${dataStr.slice(0, 50)}...`
            );
            buffer = Buffer.alloc(0);
            return;
          }
        }
        return;
      }

      // Handle protocol messages
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

async function sendFile(
  socket: TCPSocket.Socket,
  fileName: string,
  filePath: string,
  username: string,
  fileId: string,
  setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
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
                  `Timeout waiting for ACK_CHUNK:${i} (attempt ${retries + 1})`
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
  Logger.info(`Sent MSG: ${message}`);
}

export function stopClientServer(): void {
  if (clientSocket) {
    clientSocket.end();
    clientSocket = null;
    Logger.info("Client server stopped");
  }
}

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
// } from "../utils/NetworkUtils";
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
// const ACK_TIMEOUT = 10000; // Increased to 10 seconds
// const MAX_RETRIES = 3;

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
//     Logger.info(`Sent SESSION key: ${key}, IV: ${iv}`);
//   });

//   client.on("data", async (data: string | Buffer) => {
//     try {
//       Logger.info(
//         `Received data (length: ${data.length}): ${data
//           .toString()
//           .slice(0, 50)}...`
//       );
//       buffer = Buffer.concat([
//         buffer,
//         typeof data === "string" ? Buffer.from(data) : data,
//       ]);
//       Logger.info(`Buffer length: ${buffer.length}`);

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
//             Logger.info(`Received raw FILE header: ${headerStr}`);
//             let headerData: {
//               name: string;
//               size: number;
//               sender: string;
//               fileId: string;
//             };
//             try {
//               headerData = JSON.parse(headerStr);
//               Logger.info(`Parsed FILE header: ${JSON.stringify(headerData)}`);
//             } catch (error) {
//               Logger.error(`Failed to parse FILE header: ${headerStr}`, error);
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
//               Logger.info(
//                 `Generated chunk AES key: ${key}, IV: ${iv} for ${fileId}`
//               );
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
//                 direction: "receiving",
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
//             Logger.info(`Processing CHECK_CHUNKS: ${dataStr}`);
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
//             Logger.info(`Sent ACK_CHUNKS:${fileId}:${lastReceivedIndex}`);
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
//             Logger.info(`Decrypted MSG: ${decrypted.toString()}`);
//             setMessages((prev) => [...prev, `Host: ${decrypted.toString()}`]);
//             buffer = buffer.slice(messageEnd + 1);
//           } else if (dataStr.startsWith("CHUNK:")) {
//             const chunkEnd = buffer.indexOf(Buffer.from("\n"));
//             if (chunkEnd === -1) {
//               Logger.info(`Incomplete CHUNK header from host, waiting...`);
//               return;
//             }
//             const chunkHeader = buffer.slice(0, chunkEnd).toString();
//             Logger.info(`Received CHUNK header: ${chunkHeader}`);
//             const [, fileId, chunkIndexStr, iv, encrypted] =
//               chunkHeader.split(":");
//             const chunkIndex = parseInt(chunkIndexStr);
//             const record = await chunkStorage.getTransferRecord(fileId);
//             if (!record) {
//               Logger.warn(`No record for ${fileId}, ignoring chunk`);
//               buffer = Buffer.alloc(0);
//               return;
//             }
//             Logger.info(
//               `Retrieved chunk AES key: ${record.aesKey}, IV: ${iv} for ${fileId}`
//             );
//             const chunkData = await decryptData(
//               Buffer.from(encrypted, "base64"),
//               record.aesKey || "",
//               iv
//             );
//             const transfer = fileTransfers.get(fileId);
//             if (!transfer) {
//               Logger.error(`No transfer found for fileId: ${fileId}`);
//               return;
//             }
//             await chunkStorage.saveChunk(fileId, chunkIndex, chunkData);
//             transfer.chunks[chunkIndex] = chunkData;
//             transfer.receivedBytes += chunkData.length;
//             await chunkStorage.updateLastChunkIndex(fileId, chunkIndex);
//             client.write(Buffer.from(`ACK_CHUNK:${fileId}:${chunkIndex}\n`));
//             Logger.info(
//               `Sent ACK_CHUNK for ${fileId}:${chunkIndex}, ${transfer.receivedBytes}/${transfer.totalSize} bytes`
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
//             Logger.info(
//               `Processed ${dataStr.slice(0, 10)}: ${dataStr.slice(
//                 0,
//                 messageEnd
//               )}`
//             );
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
//     } catch (error: unknown) {
//       if (error instanceof Error) {
//         Logger.error(`Error processing data from host: ${error.message}`);
//       } else {
//         Logger.error("Unknown error processing data from host");
//       }
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

//     let retries = 0;
//     while (retries < MAX_RETRIES) {
//       try {
//         await new Promise<void>((resolve, reject) => {
//           const timeout = setTimeout(() => {
//             reject(
//               new DropShareError(
//                 ERROR_CODES.NETWORK_ERROR,
//                 `Timeout waiting for ACK_CHUNKS (attempt ${retries + 1})`
//               )
//             );
//           }, ACK_TIMEOUT);
//           socket.once("data", (data) => {
//             clearTimeout(timeout);
//             const message = data.toString();
//             Logger.info(`Received for CHECK_CHUNKS: ${message}`);
//             if (message.startsWith("ACK_CHUNKS:")) {
//               const [, ackFileId, lastReceivedIndex] = message.split(":");
//               if (ackFileId === fileId) {
//                 lastSentChunkIndex = Math.min(
//                   parseInt(lastReceivedIndex),
//                   lastSentChunkIndex
//                 );
//                 resolve();
//               } else {
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.INVALID_HEADER,
//                     "Invalid ACK_CHUNKS response"
//                   )
//                 );
//               }
//             }
//           });
//           Logger.info(
//             `Sending CHECK_CHUNKS (attempt ${
//               retries + 1
//             }): ${fileId}:${lastSentChunkIndex}`
//           );
//           socket.write(
//             Buffer.from(`CHECK_CHUNKS:${fileId}:${lastSentChunkIndex}\n`)
//           );
//         });
//         break;
//       } catch (error) {
//         retries++;
//         if (retries === MAX_RETRIES) {
//           throw error;
//         }
//         Logger.warn(`Retrying CHECK_CHUNKS for ${fileId} after error ${error}`);
//         await new Promise((resolve) => setTimeout(resolve, 1000));
//       }
//     }

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
//     Logger.info(`Sent header for ${fileId}: ${header.toString()}`);

//     let sentBytes = (lastSentChunkIndex + 1) * chunkSize;
//     const startTime = Date.now();
//     const { key, iv } = await generateAESKey();
//     Logger.info(`Generated chunk AES key: ${key}, IV: ${iv} for ${fileId}`);

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
//       Logger.info(
//         `Read chunk ${chunkIndex} for ${fileId}: ${chunkBuffer.length} bytes`
//       );
//       await chunkStorage.saveSentChunk(fileId, chunkIndex, chunkBuffer);

//       const chunkIv = CryptoJS.lib.WordArray.random(16).toString(
//         CryptoJS.enc.Hex
//       );
//       const encrypted = await encryptData(chunkBuffer, key, chunkIv);
//       retries = 0;
//       while (retries < MAX_RETRIES) {
//         try {
//           await new Promise<void>((resolve, reject) => {
//             const timeout = setTimeout(() => {
//               reject(
//                 new DropShareError(
//                   ERROR_CODES.NETWORK_ERROR,
//                   `Timeout waiting for ACK_CHUNK ${chunkIndex} (attempt ${
//                     retries + 1
//                   })`
//                 )
//               );
//             }, ACK_TIMEOUT);
//             socket.once("data", (data) => {
//               clearTimeout(timeout);
//               const message = data.toString();
//               Logger.info(`Received for ACK_CHUNK: ${message}`);
//               if (
//                 message.startsWith("ACK_CHUNK:") &&
//                 message.includes(`${fileId}:${chunkIndex}`)
//               ) {
//                 resolve();
//               } else {
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.NETWORK_ERROR,
//                     "Invalid ACK_CHUNK response"
//                   )
//                 );
//               }
//             });
//             const chunkMessage = `CHUNK:${fileId}:${chunkIndex}:${chunkIv}:${encrypted.toString(
//               "base64"
//             )}\n`;
//             Logger.info(
//               `Sending CHUNK ${chunkIndex} for ${fileId}: ${chunkMessage.length} bytes`
//             );
//             socket.write(Buffer.from(chunkMessage), "binary", (err) => {
//               if (err) {
//                 Logger.error(
//                   `Error writing chunk ${chunkIndex} for ${fileId}:`,
//                   err
//                 );
//                 return;
//               }
//             });
//           });
//           break;
//         } catch (error) {
//           retries++;
//           if (retries === MAX_RETRIES) {
//             throw error;
//           }
//           Logger.warn(
//             `Retrying CHUNK ${chunkIndex} for ${fileId} after error: ${error}`
//           );
//           await new Promise((resolve) => setTimeout(resolve, 1000));
//         }
//       }

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
//       await new Promise((resolve) => setTimeout(resolve, 10)); // 10ms delay
//     }

//     Logger.info(`Sent file: ${fileName} from ${username}`);
//   } catch (err) {
//     const error = err as Error;
//     Logger.error(`Error in file transfer: ${error.message}`);
//     if (clientSocket) {
//       clientSocket.write(
//         Buffer.from(`ERROR:${ERROR_CODES.NETWORK_ERROR}:Transfer failed\n`)
//       );
//     }
//     return;
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
//     )
//       .then((encrypted) => {
//         socket.write(
//           Buffer.from(`MSG:${iv}:${encrypted.toString("base64")}\n`)
//         );
//         Logger.info(`Sent MSG: ${message}`);
//       })
//       .catch((error) => {
//         Logger.error(`Failed to encrypt and send message`, error);
//       });
//   }
// }

// export function stopClientServer(): void {
//   if (clientSocket) {
//     clientSocket.end();
//     clientSocket = null;
//     Logger.info("Client server stopped");
//   }
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
// const ACK_TIMEOUT = 10000;
// const MAX_RETRIES = 3;

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
//     Logger.info(
//       `Sent SESSION key: ${key.slice(0, 10)}..., IV: ${iv.slice(0, 10)}...`
//     );
//   });

//   client.on("data", async (data: string | Buffer) => {
//     try {
//       Logger.info(
//         `Received data (length: ${data.length}): ${data
//           .toString()
//           .slice(0, 50)}...`
//       );
//       buffer = Buffer.concat([
//         buffer,
//         typeof data === "string" ? Buffer.from(data) : data,
//       ]);
//       Logger.info(`Buffer length: ${buffer.length}`);

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
//             Logger.info(`Received raw FILE header: ${headerStr}`);
//             let headerData: {
//               name: string;
//               size: number;
//               sender: string;
//               fileId: string;
//             };
//             try {
//               headerData = JSON.parse(headerStr);
//               Logger.info(`Parsed FILE header: ${JSON.stringify(headerData)}`);
//             } catch (error) {
//               Logger.error(`Failed to parse FILE header: ${headerStr}`, error);
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
//               Logger.info(
//                 `Generated chunk AES key: ${key.slice(
//                   0,
//                   10
//                 )}..., IV: ${iv.slice(0, 10)}... for ${fileId}`
//               );
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
//                 direction: "receiving",
//               };
//               try {
//                 await chunkStorage.saveTransferRecord(record);
//               } catch (error) {
//                 Logger.error(
//                   `Failed to save transfer record for ${fileId}`,
//                   error
//                 );
//                 client.write(
//                   Buffer.from(
//                     `ERROR:${ERROR_CODES.DATABASE_WRITE_ERROR}:Failed to save transfer record\n`
//                   )
//                 );
//                 buffer = Buffer.alloc(0);
//                 throw error;
//               }
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
//             Logger.info(`Processing CHECK_CHUNKS: ${dataStr}`);
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
//             Logger.info(`Sent ACK_CHUNKS:${fileId}:${lastReceivedIndex}`);
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
//             Logger.info(`Decrypted MSG: ${decrypted.toString()}`);
//             setMessages((prev) => [...prev, `Host: ${decrypted.toString()}`]);
//             buffer = buffer.slice(messageEnd + 1);
//           } else if (dataStr.startsWith("CHUNK:")) {
//             const chunkEnd = buffer.indexOf(Buffer.from("\n"));
//             if (chunkEnd === -1) {
//               Logger.info(`Incomplete CHUNK header from host, waiting...`);
//               return;
//             }
//             const chunkHeader = buffer.slice(0, chunkEnd).toString();
//             Logger.info(`Received CHUNK header: ${chunkHeader}`);
//             const [, fileId, chunkIndexStr, iv, encrypted] =
//               chunkHeader.split(":");
//             const chunkIndex = parseInt(chunkIndexStr);
//             const record = await chunkStorage.getTransferRecord(fileId);
//             if (!record) {
//               Logger.warn(`No record for ${fileId}, ignoring chunk`);
//               buffer = Buffer.alloc(0);
//               return;
//             }
//             Logger.info(
//               `Retrieved chunk AES key: ${record.aesKey?.slice(
//                 0,
//                 10
//               )}..., IV: ${iv.slice(0, 10)}... for ${fileId}`
//             );
//             let chunkData: Buffer;
//             try {
//               chunkData = await decryptData(
//                 Buffer.from(encrypted, "base64"),
//                 record.aesKey || "",
//                 iv
//               );
//               Logger.info(
//                 `Decrypted chunk ${chunkIndex} for ${fileId}: ${chunkData.length} bytes`
//               );
//             } catch (error) {
//               Logger.error(
//                 `Failed to decrypt chunk ${chunkIndex} for ${fileId}`,
//                 error
//               );
//               client.write(
//                 Buffer.from(
//                   `ERROR:${ERROR_CODES.DECRYPTION_FAILED}:Decryption failed\n`
//                 )
//               );
//               buffer = Buffer.alloc(0);
//               return;
//             }
//             await chunkStorage.saveChunk(fileId, chunkIndex, chunkData);
//             const transfer = fileTransfers.get(fileId);
//             if (!transfer) {
//               Logger.error(`No transfer found for fileId: ${fileId}`);
//               return;
//             }
//             transfer.chunks[chunkIndex] = chunkData;
//             transfer.receivedBytes += chunkData.length;
//             await chunkStorage.updateLastChunkIndex(fileId, chunkIndex);
//             client.write(Buffer.from(`ACK_CHUNK:${fileId}:${chunkIndex}\n`));
//             Logger.info(
//               `Sent ACK_CHUNK for ${fileId}:${chunkIndex}, ${transfer.receivedBytes}/${transfer.totalSize} bytes`
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
//       setTransferProgress?.((prev) =>
//         prev.map((p) =>
//           p.fileId === fileTransfers.keys().next().value
//             ? { ...p, error: err.message }
//             : p
//         )
//       );
//       buffer = Buffer.alloc(0);
//       inFileTransfer = false;
//       fileTransfers.clear();
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

//     let retries = 0;
//     while (retries < MAX_RETRIES) {
//       try {
//         await new Promise<void>((resolve, reject) => {
//           const timeout = setTimeout(() => {
//             reject(
//               new DropShareError(
//                 ERROR_CODES.NETWORK_ERROR,
//                 `Timeout waiting for ACK_CHUNKS (attempt ${retries + 1})`
//               )
//             );
//           }, ACK_TIMEOUT);
//           socket.once("data", (data) => {
//             clearTimeout(timeout);
//             const message = data.toString();
//             Logger.info(`Received for CHECK_CHUNKS: ${message}`);
//             if (message.startsWith("ACK_CHUNKS:")) {
//               const [, ackFileId, lastReceivedIndex] = message.split(":");
//               if (ackFileId === fileId) {
//                 lastSentChunkIndex = Math.min(
//                   parseInt(lastReceivedIndex),
//                   lastSentChunkIndex
//                 );
//                 resolve();
//               } else {
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.INVALID_HEADER,
//                     "Invalid ACK_CHUNKS response"
//                   )
//                 );
//               }
//             }
//           });
//           Logger.info(
//             `Sending CHECK_CHUNKS (attempt ${
//               retries + 1
//             }): ${fileId}:${lastSentChunkIndex}`
//           );
//           socket.write(
//             Buffer.from(`CHECK_CHUNKS:${fileId}:${lastSentChunkIndex}\n`)
//           );
//         });
//         break;
//       } catch (error) {
//         retries++;
//         if (retries === MAX_RETRIES) {
//           throw error;
//         }
//         Logger.warn(`Retrying CHECK_CHUNKS for ${fileId} after error ${error}`);
//         await new Promise((resolve) => setTimeout(resolve, 1000));
//       }
//     }

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
//     Logger.info(`Sent header for ${fileId}: ${header.toString()}`);

//     let sentBytes = (lastSentChunkIndex + 1) * chunkSize;
//     const startTime = Date.now();
//     const { key, iv } = await generateAESKey();
//     Logger.info(
//       `Generated chunk AES key: ${key.slice(0, 10)}..., IV: ${iv.slice(
//         0,
//         10
//       )}... for ${fileId}`
//     );

//     if (!record) {
//       try {
//         await chunkStorage.saveTransferRecord({
//           fileId,
//           fileName,
//           filePath,
//           totalSize: fileSize,
//           chunkSize,
//           lastChunkIndex: -1,
//           totalChunks,
//           status: "in_progress",
//           senderIp: await getLocalIPAddress(),
//           timestamp: Date.now(),
//           aesKey: key,
//           iv,
//           direction: "sending",
//         });
//       } catch (error) {
//         Logger.error(`Failed to save transfer record for ${fileId}`, error);
//         throw error;
//       }
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
//       Logger.info(
//         `Read chunk ${chunkIndex} for ${fileId}: ${chunkBuffer.length} bytes`
//       );
//       await chunkStorage.saveSentChunk(fileId, chunkIndex, chunkBuffer);

//       const chunkIv = CryptoJS.lib.WordArray.random(16).toString(
//         CryptoJS.enc.Hex
//       );
//       const encrypted = await encryptData(chunkBuffer, key, chunkIv);
//       retries = 0;
//       while (retries < MAX_RETRIES) {
//         try {
//           await new Promise<void>((resolve, reject) => {
//             const timeout = setTimeout(() => {
//               reject(
//                 new DropShareError(
//                   ERROR_CODES.NETWORK_ERROR,
//                   `Timeout waiting for ACK_CHUNK ${chunkIndex} (attempt ${
//                     retries + 1
//                   })`
//                 )
//               );
//             }, ACK_TIMEOUT);
//             socket.once("data", (data) => {
//               clearTimeout(timeout);
//               const message = data.toString();
//               Logger.info(`Received for ACK_CHUNK: ${message}`);
//               if (
//                 message.startsWith("ACK_CHUNK:") &&
//                 message.includes(`${fileId}:${chunkIndex}`)
//               ) {
//                 resolve();
//               } else {
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.NETWORK_ERROR,
//                     "Invalid ACK_CHUNK response"
//                   )
//                 );
//               }
//             });
//             const chunkMessage = `CHUNK:${fileId}:${chunkIndex}:${chunkIv}:${encrypted.toString(
//               "base64"
//             )}\n`;
//             Logger.info(
//               `Sending CHUNK ${chunkIndex} for ${fileId}: ${chunkMessage.length} bytes`
//             );
//             socket.write(Buffer.from(chunkMessage), "base64", (err) => {
//               if (err) {
//                 Logger.error("Socket write error", err);
//               }
//             });
//           });
//           break;
//         } catch (error) {
//           retries++;
//           if (retries === MAX_RETRIES) {
//             throw error;
//           }
//           Logger.warn(
//             `Retrying CHUNK ${chunkIndex} for ${fileId} after error ${error}`
//           );
//           await new Promise((resolve) => setTimeout(resolve, 1000));
//         }
//       }

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
//       await new Promise((resolve) => setTimeout(resolve, 10));
//     }
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
//     Logger.info(`Successfully sent file ${fileName} from ${username}`);
//   } catch (error) {
//     Logger.error(`Failed to send file ${fileName}`, error);
//     throw error;
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
//     )
//       .then((encrypted) => {
//         socket.write(
//           Buffer.from(`MSG:${iv}:${encrypted.toString("base64")}\n`)
//         );
//         Logger.info(`Sent MSG: ${message}`);
//       })
//       .catch((error) => {
//         Logger.error(`Failed to encrypt and send message`, error);
//       });
//   }
// }

// export function stopClientServer(): void {
//   if (clientSocket) {
//     clientSocket.end();
//     clientSocket = null;
//     Logger.info("Client server stopped");
//   }
// }

// worked well for file transfer without chunks
// import dgram from "react-native-udp";
// import { getLocalIPAddress, checkTransferLimits } from "../utils/NetworkUtils";
// import { Buffer } from "buffer";
// import { Logger } from "../utils/Logger";
// import { DropShareError, ERROR_CODES } from "../utils/Error";
// import TCPSocket from "react-native-tcp-socket";
// import RNFS from "react-native-fs";
// import { savePath } from "../utils/FileSystemUtil";

// type UdpSocket = ReturnType<typeof dgram.createSocket>;

// const UDP_PORT = 5000;
// const TCP_PORT = 6000;
// const ACK_TIMEOUT = 10000;
// const MAX_RETRIES = 3;

// let udpSocket: UdpSocket | null = null;
// let clientSocket: TCPSocket.Socket | null = null;

// export async function startClientDiscovery(
//   setDevices: React.Dispatch<React.SetStateAction<Device[]>>
// ): Promise<void> {
//   try {
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
//   let receivingFile = false;
//   let fileBuffer = Buffer.alloc(0);
//   let fileId = "";
//   let fileName = "";
//   let fileSize = 0;
//   let deviceName = "";
//   let startTime = 0;

//   client.on("connect", () => {
//     Logger.info("Connected to host!");
//     setConnected(true);
//     setSocket(client);
//   });

//   client.on("data", async (data: string | Buffer) => {
//     try {
//       if (receivingFile) {
//         // Accumulate file data
//         fileBuffer = Buffer.concat([
//           fileBuffer,
//           typeof data === "string" ? Buffer.from(data) : data,
//         ]);

//         const percentage = (fileBuffer.length / fileSize) * 100;
//         const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//         const speed = (fileBuffer.length / elapsedTime / 1024).toFixed(2);

//         setTransferProgress?.((prev) => [
//           ...prev.filter((p) => p.fileId !== fileId),
//           {
//             fileId,
//             fileName,
//             progress: `${fileBuffer.length}/${fileSize} bytes`,
//             speed: `${speed} KB/s`,
//             percentage,
//           },
//         ]);

//         if (fileBuffer.length >= fileSize) {
//           // File fully received
//           await RNFS.writeFile(
//             `${savePath}/${fileName}`,
//             fileBuffer.toString("base64"),
//             "base64"
//           );
//           setReceivedFiles((prev) => [...prev, `${savePath}/${fileName}`]);
//           Logger.info(
//             `Received and saved file: ${savePath} from ${deviceName}`
//           );
//           fileTransfers.delete(fileId);
//           client.write(Buffer.from(`ACK_COMPLETE:${fileId}\n`));
//           receivingFile = false;
//           fileBuffer = Buffer.alloc(0);
//           fileId = "";
//           fileName = "";
//           fileSize = 0;
//           deviceName = "";
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
//             Logger.info(`Incomplete FILE header from host, waiting...`);
//             return;
//           }
//           const headerStr = buffer.slice(5, headerEnd).toString();
//           let headerData: {
//             name: string;
//             size: number;
//             sender: string;
//             fileId: string;
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

//           if (!fileName || !fileSize || !fileId) {
//             throw new DropShareError(
//               ERROR_CODES.INVALID_HEADER,
//               "Missing file name, size, or ID"
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
//           fileBuffer = Buffer.alloc(0);
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
//           dataStr.startsWith("ACK_COMPLETE:")
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
//       fileBuffer = Buffer.alloc(0);
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

// async function sendFile(
//   socket: TCPSocket.Socket,
//   fileName: string,
//   filePath: string,
//   username: string,
//   fileId: string,
//   setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
// ): Promise<void> {
//   try {
//     const fileData = await RNFS.readFile(filePath, "base64");
//     const fileBuffer = Buffer.from(fileData, "base64");
//     const fileSize = fileBuffer.length;

//     let retries = 0;
//     while (retries < MAX_RETRIES) {
//       try {
//         await new Promise<void>((resolve, reject) => {
//           const timeout = setTimeout(() => {
//             reject(
//               new DropShareError(
//                 ERROR_CODES.NETWORK_ERROR,
//                 `Timeout waiting for ACK_FILE (attempt ${retries + 1})`
//               )
//             );
//           }, ACK_TIMEOUT);
//           socket.once("data", (data) => {
//             clearTimeout(timeout);
//             const message = data.toString();
//             Logger.info(`Received for ACK_FILE: ${message}`);
//             if (message.startsWith(`ACK_FILE:${fileId}`)) {
//               resolve();
//             } else {
//               reject(
//                 new DropShareError(
//                   ERROR_CODES.INVALID_HEADER,
//                   `Invalid ACK_FILE response: ${message}`
//                 )
//               );
//             }
//           });
//           const header = Buffer.from(
//             `FILE:${JSON.stringify({
//               name: fileName,
//               size: fileSize,
//               sender: username,
//               fileId,
//             })}\n\n`
//           );
//           socket.write(header);
//           Logger.info(`Sent header for ${fileId}: ${header.toString()}`);
//         });

//         const startTime = Date.now();
//         await new Promise<void>((resolve, reject) => {
//           socket.write(fileBuffer, "binary", (err?: Error) => {
//             if (err) {
//               reject(err);
//             } else {
//               Logger.info(`Sent file data for ${fileId}: ${fileSize} bytes`);
//               resolve();
//             }
//           });
//         });

//         await new Promise<void>((resolve, reject) => {
//           const timeout = setTimeout(() => {
//             reject(
//               new DropShareError(
//                 ERROR_CODES.NETWORK_ERROR,
//                 `Timeout waiting for ACK_COMPLETE (attempt ${retries + 1})`
//               )
//             );
//           }, ACK_TIMEOUT);
//           socket.once("data", (data) => {
//             clearTimeout(timeout);
//             const message = data.toString();
//             Logger.info(`Received for ACK_COMPLETE: ${message}`);
//             if (message.startsWith(`ACK_COMPLETE:${fileId}`)) {
//               const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//               const speed = (fileSize / elapsedTime / 1024).toFixed(2);
//               setTransferProgress?.((prev) => [
//                 ...prev.filter((p) => p.fileId !== fileId),
//                 {
//                   fileId,
//                   fileName,
//                   progress: `${fileSize}/${fileSize} bytes`,
//                   speed: `${speed} KB/s`,
//                   percentage: 100,
//                 },
//               ]);
//               resolve();
//             } else {
//               reject(
//                 new DropShareError(
//                   ERROR_CODES.NETWORK_ERROR,
//                   `Invalid ACK_COMPLETE response: ${message}`
//                 )
//               );
//             }
//           });
//         });
//         break;
//       } catch (error) {
//         retries++;
//         if (retries === MAX_RETRIES) {
//           throw error;
//         }
//         Logger.warn(`Retrying file send for ${fileId} after error ${error}`);
//         await new Promise((resolve) => setTimeout(resolve, 1000));
//       }
//     }
//   } catch (error) {
//     Logger.error(`Failed to send file ${fileName}`, error);
//     throw DropShareError.from(
//       error,
//       ERROR_CODES.NETWORK_ERROR,
//       "File transfer failed"
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

//   for (const { filePath, fileData } of files) {
//     const fileName = filePath.split("/").pop() || "unknown";
//     const fileId = `${username}_${fileName}_${Date.now()}`;
//     await sendFile(
//       socket,
//       fileName,
//       filePath,
//       username,
//       fileId,
//       setTransferProgress
//     );
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
//   socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
//   Logger.info(`Sent MSG: ${message}`);
// }

// export function stopClientServer(): void {
//   if (clientSocket) {
//     clientSocket.end();
//     clientSocket = null;
//     Logger.info("Client server stopped");
//   }
// }

// worked well for file transfer with chunks but single file
// import dgram from "react-native-udp";
// import { getLocalIPAddress, checkTransferLimits } from "../utils/NetworkUtils";
// import { Buffer } from "buffer";
// import { Logger } from "../utils/Logger";
// import { DropShareError, ERROR_CODES } from "../utils/Error";
// import TCPSocket from "react-native-tcp-socket";
// import RNFS from "react-native-fs";
// import { savePath } from "../utils/FileSystemUtil";

// type UdpSocket = ReturnType<typeof dgram.createSocket>;

// const UDP_PORT = 5000;
// const TCP_PORT = 6000;
// const ACK_TIMEOUT = 10000;
// const MAX_RETRIES = 3;
// const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

// let udpSocket: UdpSocket | null = null;
// let clientSocket: TCPSocket.Socket | null = null;

// export async function startClientDiscovery(
//   setDevices: React.Dispatch<React.SetStateAction<Device[]>>
// ): Promise<void> {
//   try {
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
//   let receivingFile = false;
//   let fileChunks: { [fileId: string]: Buffer[] } = {};
//   let chunkCounts: { [fileId: string]: number } = {};
//   let fileId = "";
//   let fileName = "";
//   let fileSize = 0;
//   let deviceName = "";
//   let startTime = 0;
//   let totalChunks = 0;

//   client.on("connect", () => {
//     Logger.info("Connected to host!");
//     setConnected(true);
//     setSocket(client);
//   });

//   client.on("data", async (data: string | Buffer) => {
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
//               Logger.error(`Failed to parse CHUNK header: ${headerStr}`, error);
//               throw new DropShareError(
//                 ERROR_CODES.INVALID_HEADER,
//                 "Invalid chunk header"
//               );
//             }

//             const chunkSize = chunkData.chunkSize;
//             const expectedChunkEnd = headerEnd + 2 + chunkSize;

//             if (buffer.length < expectedChunkEnd) {
//               Logger.info(`Incomplete chunk data, waiting...`);
//               return;
//             }

//             const chunk = buffer.slice(headerEnd + 2, expectedChunkEnd);
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
//               // All chunks received, reconstruct file
//               const fileBuffer = Buffer.concat(
//                 fileChunks[fileId].filter(Boolean)
//               );
//               await RNFS.writeFile(
//                 `${savePath}/${fileName}`,
//                 fileBuffer.toString("base64"),
//                 "base64"
//               );
//               setReceivedFiles((prev) => [...prev, `${savePath}/${fileName}`]);
//               Logger.info(
//                 `Received and saved file: ${savePath}/${fileName} from ${deviceName}`
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
//             }
//           } else {
//             Logger.warn(
//               `Unexpected data while receiving file: ${dataStr.slice(0, 50)}...`
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

//           if (!fileName || !fileSize || !fileId || !totalChunks) {
//             throw new DropShareError(
//               ERROR_CODES.INVALID_HEADER,
//               "Missing file name, size, ID, or total chunks"
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

// async function sendFile(
//   socket: TCPSocket.Socket,
//   fileName: string,
//   filePath: string,
//   username: string,
//   fileId: string,
//   setTransferProgress?: React.Dispatch<React.SetStateAction<TransferProgress[]>>
// ): Promise<void> {
//   try {
//     const fileData = await RNFS.readFile(filePath, "base64");
//     const fileBuffer = Buffer.from(fileData, "base64");
//     const fileSize = fileBuffer.length;
//     const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

//     let retries = 0;
//     while (retries < MAX_RETRIES) {
//       try {
//         // Send file header
//         await new Promise<void>((resolve, reject) => {
//           const timeout = setTimeout(() => {
//             reject(
//               new DropShareError(
//                 ERROR_CODES.NETWORK_ERROR,
//                 `Timeout waiting for ACK_FILE (attempt ${retries + 1})`
//               )
//             );
//           }, ACK_TIMEOUT);
//           socket.once("data", (data) => {
//             clearTimeout(timeout);
//             const message = data.toString();
//             Logger.info(`Received for ACK_FILE: ${message}`);
//             if (message.startsWith(`ACK_FILE:${fileId}`)) {
//               resolve();
//             } else {
//               reject(
//                 new DropShareError(
//                   ERROR_CODES.INVALID_HEADER,
//                   `Invalid ACK_FILE response: ${message}`
//                 )
//               );
//             }
//           });
//           const header = Buffer.from(
//             `FILE:${JSON.stringify({
//               name: fileName,
//               size: fileSize,
//               sender: username,
//               fileId,
//               totalChunks,
//             })}\n\n`
//           );
//           socket.write(header);
//           Logger.info(`Sent header for ${fileId}: ${header.toString()}`);
//         });

//         const startTime = Date.now();
//         let sentBytes = 0;

//         // Send chunks
//         for (let i = 0; i < totalChunks; i++) {
//           const start = i * CHUNK_SIZE;
//           const chunk = fileBuffer.slice(start, start + CHUNK_SIZE);
//           const chunkSize = chunk.length;

//           await new Promise<void>((resolve, reject) => {
//             const timeout = setTimeout(() => {
//               reject(
//                 new DropShareError(
//                   ERROR_CODES.NETWORK_ERROR,
//                   `Timeout waiting for ACK_CHUNK:${i} (attempt ${retries + 1})`
//                 )
//               );
//             }, ACK_TIMEOUT);
//             socket.once("data", (data) => {
//               clearTimeout(timeout);
//               const message = data.toString();
//               Logger.info(`Received for ACK_CHUNK:${i}: ${message}`);
//               if (message.startsWith(`ACK_CHUNK:${fileId}:${i}`)) {
//                 resolve();
//               } else {
//                 reject(
//                   new DropShareError(
//                     ERROR_CODES.INVALID_HEADER,
//                     `Invalid ACK_CHUNK response: ${message}`
//                   )
//                 );
//               }
//             });
//             const chunkHeader = Buffer.from(
//               `CHUNK:${JSON.stringify({
//                 fileId,
//                 chunkIndex: i,
//                 chunkSize,
//               })}\n\n`
//             );
//             socket.write(Buffer.concat([chunkHeader, chunk]));
//             Logger.info(`Sent chunk ${i}/${totalChunks} for ${fileId}`);
//           });

//           sentBytes += chunkSize;
//           const percentage = (sentBytes / fileSize) * 100;
//           const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//           const speed = (sentBytes / elapsedTime / 1024).toFixed(2);

//           setTransferProgress?.((prev) => [
//             ...prev.filter((p) => p.fileId !== fileId),
//             {
//               fileId,
//               fileName,
//               progress: `${sentBytes}/${fileSize} bytes`,
//               speed: `${speed} KB/s`,
//               percentage,
//             },
//           ]);
//         }

//         // Wait for final ACK
//         await new Promise<void>((resolve, reject) => {
//           const timeout = setTimeout(() => {
//             reject(
//               new DropShareError(
//                 ERROR_CODES.NETWORK_ERROR,
//                 `Timeout waiting for ACK_COMPLETE (attempt ${retries + 1})`
//               )
//             );
//           }, ACK_TIMEOUT);
//           socket.once("data", (data) => {
//             clearTimeout(timeout);
//             const message = data.toString();
//             Logger.info(`Received for ACK_COMPLETE: ${message}`);
//             if (message.startsWith(`ACK_COMPLETE:${fileId}`)) {
//               const elapsedTime = (Date.now() - startTime) / 1000 || 1;
//               const speed = (fileSize / elapsedTime / 1024).toFixed(2);
//               setTransferProgress?.((prev) => [
//                 ...prev.filter((p) => p.fileId !== fileId),
//                 {
//                   fileId,
//                   fileName,
//                   progress: `${fileSize}/${fileSize} bytes`,
//                   speed: `${speed} KB/s`,
//                   percentage: 100,
//                 },
//               ]);
//               resolve();
//             } else {
//               reject(
//                 new DropShareError(
//                   ERROR_CODES.NETWORK_ERROR,
//                   `Invalid ACK_COMPLETE response: ${message}`
//                 )
//               );
//             }
//           });
//         });
//         break;
//       } catch (error) {
//         retries++;
//         if (retries === MAX_RETRIES) {
//           throw error;
//         }
//         Logger.warn(`Retrying file send for ${fileId} after error ${error}`);
//         await new Promise((resolve) => setTimeout(resolve, 1000));
//       }
//     }
//   } catch (error) {
//     Logger.error(`Failed to send file ${fileName}`, error);
//     throw DropShareError.from(
//       error,
//       ERROR_CODES.NETWORK_ERROR,
//       "File transfer failed"
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

//   for (const { filePath, fileData } of files) {
//     const fileName = filePath.split("/").pop() || "unknown";
//     const fileId = `${username}_${fileName}_${Date.now()}`;
//     await sendFile(
//       socket,
//       fileName,
//       filePath,
//       username,
//       fileId,
//       setTransferProgress
//     );
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
//   socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
//   Logger.info(`Sent MSG: ${message}`);
// }

// export function stopClientServer(): void {
//   if (clientSocket) {
//     clientSocket.end();
//     clientSocket = null;
//     Logger.info("Client server stopped");
//   }
// }
