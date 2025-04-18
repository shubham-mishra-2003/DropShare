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