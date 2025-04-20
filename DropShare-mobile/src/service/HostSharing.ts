import {
  calculateDynamicChunkDivision,
  checkTransferLimits,
} from "../utils/NetworkUtils";
import ReactNativeBlobUtil from "react-native-blob-util";
import { Buffer } from "buffer";
import { Logger } from "../utils/Logger";
import { DropShareError, ERROR_CODES } from "../utils/Error";
import TCPSocket from "react-native-tcp-socket";
import { SAVE_PATH, TEMP_CHUNKS_PATH } from "../utils/FileSystemUtil";
import {
  generateAESKey,
  generateRSAKeyPair,
  encryptAESKeyWithRSA,
  decryptAESKeyWithRSA,
} from "./Crypto";

const fileTransfers = new Map<string, FileTransfer>();
let buffer = Buffer.alloc(0);
let receivingFile = false;
let chunkCounts: { [fileId: string]: number } = {};
let fileId = "";
let fileName = "";
let fileSize = 0;
let deviceName = "";
let startTime = 0;
let totalChunks = 0;
let expectedChunkSize = 0;
let lastLoggedChunkIndex: number | null = null;
let aesKeyPair: { [fileId: string]: { key: string; iv: string } } = {};
let rsaKeyPair: { publicKey: string; privateKey: string } | null = null;
let senderPublicKey: string | null = null;

interface FileHeader {
  protocolVersion: string;
  name: string;
  size: number;
  sender: string;
  fileId: string;
  totalChunks: number;
  chunkSize: number;
  encryptedAESKey?: string;
}

interface HostReceiveProps {
  ip: string;
  socket: TCPSocket.Socket;
  data: string | Buffer;
  setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
  setMessages: React.Dispatch<React.SetStateAction<string[]>>;
  setTransferProgress?: React.Dispatch<
    React.SetStateAction<TransferProgress[]>
  >;
}

const MAX_RETRIES = 3;
const ACK_TIMEOUT = 10000;
const PROTOCOL_VERSION = "1.0";

export const HostSharing = () => {
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
    let tempEncryptedPath = "";
    try {
      const stat = await ReactNativeBlobUtil.fs.stat(filePath);
      const fileSize = stat.size;
      const { chunkSize, numChunks: totalChunks } =
        calculateDynamicChunkDivision(fileSize);

      // Generate AES key pair for this file transfer
      Logger.info(`Generating AES key for ${fileId}`);
      const { key, iv } = await generateAESKey();
      aesKeyPair[fileId] = { key, iv };
      Logger.info(`Generated AES key for ${fileId}`);

      // Generate RSA key pair if not already generated
      if (!rsaKeyPair) {
        Logger.info(`Generating RSA key pair for ${fileId}`);
        rsaKeyPair = await generateRSAKeyPair(30000); // 30-second timeout
        Logger.info(`Completed RSA key pair generation for ${fileId}`);
      } else {
        Logger.info(`Reusing existing RSA key pair for ${fileId}`);
      }

      // Send RSA public key to receiver
      Logger.info(`Sending PUBKEY for ${fileId}`);
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new DropShareError(
              ERROR_CODES.NETWORK_ERROR,
              `Timeout waiting for ACK_PUBKEY`
            )
          );
        }, ACK_TIMEOUT);
        socket.once("data", (data) => {
          clearTimeout(timeout);
          const message = data.toString();
          Logger.info(`Received for ACK_PUBKEY: ${message}`);
          if (message.startsWith(`ACK_PUBKEY:${fileId}`)) {
            resolve();
          } else {
            reject(
              new DropShareError(
                ERROR_CODES.INVALID_HEADER,
                `Invalid ACK_PUBKEY response: ${message}`
              )
            );
          }
        });
        socket.write(
          Buffer.from(`PUBKEY:${fileId}:${rsaKeyPair!.publicKey}\n`)
        );
        Logger.info(`Sent PUBKEY for ${fileId}`);
      });

      // Encrypt AES key with receiver's public key
      Logger.info(`Encrypting AES key for ${fileId}`);
      const encryptedAESKey = await encryptAESKeyWithRSA(
        key,
        rsaKeyPair.publicKey
      );
      Logger.info(`Encrypted AES key for ${fileId}`);

      // Stream-encrypt the file
      tempEncryptedPath = `${TEMP_CHUNKS_PATH}/${fileId}_encrypted`;
      await ReactNativeBlobUtil.fs.mkdir(TEMP_CHUNKS_PATH).catch(() => {});
      await encryptFileStream(filePath, key, iv, tempEncryptedPath);
      const encryptedStat = await ReactNativeBlobUtil.fs.stat(
        tempEncryptedPath
      );
      const encryptedFileSize = encryptedStat.size;

      let retries = 0;
      while (retries < MAX_RETRIES) {
        try {
          if (retries > 0) {
            Logger.info(`Sending RESET for ${fileId}, attempt ${retries + 1}`);
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

          Logger.info(`Sending FILE header for ${fileId}`);
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
              sender: username,
              fileId,
              totalChunks,
              chunkSize,
              encryptedAESKey: encryptedAESKey.toString("base64"),
            };
            socket.write(Buffer.from(`FILE:${JSON.stringify(header)}\n\n`));
            Logger.info(`Sent header for ${fileId}: ${JSON.stringify(header)}`);
          });

          const startTime = Date.now();
          let sentBytes = 0;

          // Send encrypted file in chunks
          for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const actualChunkSize = Math.min(
              chunkSize,
              encryptedFileSize - start
            );
            const chunk = await ReactNativeBlobUtil.fs.readStream(
              tempEncryptedPath,
              "base64",
              actualChunkSize,
              start
            );
            let encryptedChunk: Buffer;
            await new Promise<void>((resolve, reject) => {
              chunk.onData((chunk: string | number[]) => {
                if (typeof chunk === "string") {
                  encryptedChunk = Buffer.from(chunk, "base64");
                } else {
                  encryptedChunk = Buffer.from(chunk);
                }
                resolve();
              });
              chunk.onError((err: Error) => reject(err));
            });

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
                  if (message.startsWith("ERROR:")) {
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
                }
              });
              const chunkHeader = Buffer.from(
                `CHUNK:${JSON.stringify({
                  fileId,
                  chunkIndex: i,
                  chunkSize: encryptedChunk.length,
                })}\n\n`
              );
              socket.write(Buffer.concat([chunkHeader, encryptedChunk]));
              Logger.info(
                `Sent chunk ${i}/${totalChunks} for ${fileId} (${encryptedChunk.length} bytes)`
              );
            });

            sentBytes += actualChunkSize;
            const percentage = (sentBytes / encryptedFileSize) * 100;
            const elapsedTime = (Date.now() - startTime) / 1000 || 1;
            const speed = (sentBytes / elapsedTime / 1024).toFixed(2);

            setTransferProgress?.((prev) => [
              ...prev.filter((p) => p.fileId !== fileId),
              {
                fileId,
                fileName,
                progress: `${sentBytes}/${encryptedFileSize} bytes`,
                speed: `${speed} KB/s`,
                percentage,
              },
            ]);
          }

          Logger.info(`Waiting for ACK_COMPLETE for ${fileId}`);
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
                const speed = (encryptedFileSize / elapsedTime / 1024).toFixed(
                  2
                );
                setTransferProgress?.((prev) => [
                  ...prev.filter((p) => p.fileId !== fileId),
                  {
                    fileId,
                    fileName,
                    progress: `${encryptedFileSize}/${encryptedFileSize} bytes`,
                    speed: `${speed} KB/s`,
                    percentage: 100,
                  },
                ]);
                resolve();
              } else {
                if (message.startsWith("ERROR:")) {
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
        `File transfer failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      if (await ReactNativeBlobUtil.fs.exists(tempEncryptedPath)) {
        await ReactNativeBlobUtil.fs
          .unlink(tempEncryptedPath)
          .catch((err) =>
            Logger.error(`Failed to delete temp file ${tempEncryptedPath}`, err)
          );
      }
      delete aesKeyPair[fileId];
    }
  }

  async function sendFilesInHost(
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

  function sendMessageInHost(
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

  async function receiveFileInHost({
    data,
    socket,
    ip,
    setMessages,
    setReceivedFiles,
    setTransferProgress,
  }: HostReceiveProps) {
    let tempEncryptedPath = "";
    try {
      buffer = Buffer.concat([
        buffer,
        typeof data === "string" ? Buffer.from(data) : data,
      ]);

      while (buffer.length > 0) {
        const dataStr = buffer.toString();

        // Handle PUBKEY messages
        if (dataStr.startsWith("PUBKEY:")) {
          const messageEnd = buffer.indexOf(Buffer.from("\n"));
          if (messageEnd === -1) {
            Logger.info(`Incomplete PUBKEY from client ${ip}, waiting...`);
            return;
          }
          const parts = dataStr.slice(7, messageEnd).split(":", 2);
          const pubKeyFileId = parts[0];
          const publicKey = dataStr.slice(
            7 + pubKeyFileId.length + 1,
            messageEnd
          );
          Logger.info(`Received PUBKEY for fileId ${pubKeyFileId} from ${ip}`);
          senderPublicKey = publicKey;
          socket.write(Buffer.from(`ACK_PUBKEY:${pubKeyFileId}\n`));
          Logger.info(`Sent ACK_PUBKEY for ${pubKeyFileId} to ${ip}`);
          buffer = buffer.slice(messageEnd + 1);
          continue;
        }

        // Handle RESET messages
        if (dataStr.startsWith("RESET:")) {
          const messageEnd = buffer.indexOf(Buffer.from("\n"));
          if (messageEnd === -1) {
            Logger.info(`Incomplete RESET from client ${ip}, waiting...`);
            return;
          }
          const resetFileId = dataStr.slice(6, messageEnd);
          Logger.info(`Received RESET for fileId ${resetFileId} from ${ip}`);
          if (resetFileId === fileId || !fileId) {
            receivingFile = false;
            chunkCounts[resetFileId] = 0;
            tempEncryptedPath = `${TEMP_CHUNKS_PATH}/${resetFileId}_encrypted`;
            if (await ReactNativeBlobUtil.fs.exists(tempEncryptedPath)) {
              await ReactNativeBlobUtil.fs
                .unlink(tempEncryptedPath)
                .catch((err) =>
                  Logger.error(
                    `Failed to delete temp file ${tempEncryptedPath}`,
                    err
                  )
                );
            }
            fileId = "";
            fileName = "";
            fileSize = 0;
            deviceName = "";
            totalChunks = 0;
            expectedChunkSize = 0;
            delete aesKeyPair[resetFileId];
            senderPublicKey = null;
          }
          socket.write(Buffer.from(`ACK_RESET:${resetFileId}\n`));
          Logger.info(`Sent ACK_RESET for ${resetFileId} to ${ip}`);
          buffer = buffer.slice(messageEnd + 1);
          continue;
        }

        if (receivingFile) {
          if (dataStr.startsWith("CHUNK:")) {
            const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
            if (headerEnd === -1) {
              Logger.info(
                `Incomplete CHUNK header from client ${ip}, waiting...`
              );
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
              socket.write(
                Buffer.from(
                  `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid chunk header\n`
                )
              );
              buffer = Buffer.alloc(0);
              return;
            }

            const chunkStart = headerEnd + 2;
            const chunkEnd = chunkStart + chunkData.chunkSize;

            if (buffer.length < chunkEnd) {
              if (lastLoggedChunkIndex !== chunkData.chunkIndex) {
                Logger.info(
                  `Waiting for chunk data for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}, expected ${chunkData.chunkSize} bytes)`
                );
                lastLoggedChunkIndex = chunkData.chunkIndex;
              }
              return;
            }

            const encryptedChunk = buffer.slice(chunkStart, chunkEnd);
            Logger.info(
              `Received chunk ${chunkData.chunkIndex}/${totalChunks} for ${chunkData.fileId} (${encryptedChunk.length} bytes)`
            );

            // Append chunk to temporary encrypted file
            if (!(await ReactNativeBlobUtil.fs.exists(TEMP_CHUNKS_PATH))) {
              await ReactNativeBlobUtil.fs.mkdir(TEMP_CHUNKS_PATH);
            }
            await ReactNativeBlobUtil.fs.appendFile(
              tempEncryptedPath,
              encryptedChunk.toString("base64"),
              "base64"
            );

            chunkCounts[fileId]++;

            const receivedBytes = chunkCounts[fileId] * expectedChunkSize;
            const percentage = Math.min(
              (receivedBytes / (totalChunks * expectedChunkSize)) * 100,
              100
            );
            const elapsedTime = (Date.now() - startTime) / 1000 || 1;
            const speed = (receivedBytes / elapsedTime / 1024).toFixed(2);

            setTransferProgress?.((prev) => [
              ...prev.filter((p) => p.fileId !== fileId),
              {
                fileId,
                fileName,
                progress: `${receivedBytes}/${
                  totalChunks * expectedChunkSize
                } bytes`,
                speed: `${speed} KB/s`,
                percentage,
              },
            ]);

            socket.write(
              Buffer.from(`ACK_CHUNK:${fileId}:${chunkData.chunkIndex}\n`)
            );
            buffer = buffer.slice(chunkEnd);

            if (chunkCounts[fileId] === totalChunks) {
              // Decrypt the reassembled encrypted file
              const finalPath = `${SAVE_PATH}/${fileName.replace(
                /[^a-zA-Z0-9.-]/g,
                "_"
              )}`;
              if (!(await ReactNativeBlobUtil.fs.exists(SAVE_PATH))) {
                await ReactNativeBlobUtil.fs.mkdir(SAVE_PATH);
                Logger.info(`Created directory ${SAVE_PATH}`);
              }

              const { key, iv } = aesKeyPair[fileId];
              await decryptFileStream(tempEncryptedPath, key, iv, finalPath);

              setReceivedFiles((prev) => [...prev, finalPath]);
              Logger.info(
                `Received and saved file: ${finalPath} from ${deviceName}`
              );
              fileTransfers.delete(fileId);
              socket.write(Buffer.from(`ACK_COMPLETE:${fileId}\n`));

              // Cleanup
              if (await ReactNativeBlobUtil.fs.exists(tempEncryptedPath)) {
                await ReactNativeBlobUtil.fs
                  .unlink(tempEncryptedPath)
                  .catch((err) =>
                    Logger.error(
                      `Failed to delete temp file ${tempEncryptedPath}`,
                      err
                    )
                  );
              }
              receivingFile = false;
              delete chunkCounts[fileId];
              delete aesKeyPair[fileId];
              fileId = "";
              fileName = "";
              fileSize = 0;
              deviceName = "";
              totalChunks = 0;
              expectedChunkSize = 0;
              senderPublicKey = null;
            }
          } else if (dataStr.startsWith("FILE:") && fileId) {
            const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
            if (headerEnd === -1) {
              Logger.info(
                `Incomplete retransmission FILE header from client ${ip}, waiting...`
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
              socket.write(
                Buffer.from(
                  `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid file header\n`
                )
              );
              buffer = Buffer.alloc(0);
              return;
            }

            if (headerData.fileId === fileId) {
              Logger.info(
                `Detected retransmission for fileId ${fileId}, resetting state`
              );
              receivingFile = false;
              chunkCounts[fileId] = 0;
              tempEncryptedPath = `${TEMP_CHUNKS_PATH}/${fileId}_encrypted`;
              if (await ReactNativeBlobUtil.fs.exists(tempEncryptedPath)) {
                await ReactNativeBlobUtil.fs
                  .unlink(tempEncryptedPath)
                  .catch((err) =>
                    Logger.error(
                      `Failed to delete temp file ${tempEncryptedPath}`,
                      err
                    )
                  );
              }
              await ReactNativeBlobUtil.fs.writeFile(
                tempEncryptedPath,
                "",
                "base64"
              );

              if (headerData.protocolVersion !== PROTOCOL_VERSION) {
                Logger.error(
                  `Protocol version mismatch for ${fileId}: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
                );
                socket.write(
                  Buffer.from(
                    `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
                  )
                );
                buffer = Buffer.alloc(0);
                return;
              }

              fileName = headerData.name;
              fileSize = headerData.size;
              deviceName = headerData.sender || "Unknown";
              totalChunks = headerData.totalChunks;
              expectedChunkSize = headerData.chunkSize;

              if (
                !fileName ||
                !fileSize ||
                !fileId ||
                !totalChunks ||
                !expectedChunkSize ||
                !headerData.encryptedAESKey
              ) {
                Logger.error(
                  `Missing required fields in retransmission FILE header for ${fileId}`
                );
                socket.write(
                  Buffer.from(
                    `ERROR:${ERROR_CODES.INVALID_HEADER}:Missing required fields\n`
                  )
                );
                buffer = Buffer.alloc(0);
                return;
              }

              // Decrypt AES key
              if (!senderPublicKey) {
                Logger.error(`Sender public key not received for ${fileId}`);
                socket.write(
                  Buffer.from(
                    `ERROR:${ERROR_CODES.ENCRYPTION_FAILED}:Sender public key not received\n`
                  )
                );
                buffer = Buffer.alloc(0);
                return;
              }
              try {
                const aesKey = await decryptAESKeyWithRSA(
                  Buffer.from(headerData.encryptedAESKey, "base64"),
                  rsaKeyPair!.privateKey
                );
                aesKeyPair[fileId] = { key: aesKey, iv: aesKeyPair[fileId].iv };
              } catch (error) {
                Logger.error(`Failed to decrypt AES key for ${fileId}`, error);
                socket.write(
                  Buffer.from(
                    `ERROR:${ERROR_CODES.DECRYPTION_FAILED}:Failed to decrypt AES key\n`
                  )
                );
                buffer = Buffer.alloc(0);
                return;
              }

              const { chunkSize: calculatedChunkSize } =
                calculateDynamicChunkDivision(fileSize);
              if (expectedChunkSize !== calculatedChunkSize) {
                Logger.error(
                  `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
                );
                socket.write(
                  Buffer.from(
                    `ERROR:${ERROR_CODES.INVALID_HEADER}:Chunk size mismatch\n`
                  )
                );
                buffer = Buffer.alloc(0);
                return;
              }

              if (!checkTransferLimits(fileSize, fileTransfers)) {
                socket.write(
                  Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
                );
                Logger.toast(
                  `Transfer limit exceeded for ${fileName}`,
                  "error"
                );
                buffer = Buffer.alloc(0);
                return;
              }

              socket.write(Buffer.from(`ACK_FILE:${fileId}\n`));
              buffer = buffer.slice(headerEnd + 2);
              receivingFile = true;
              startTime = Date.now();
            } else {
              Logger.warn(
                `Unexpected FILE header for different fileId ${headerData.fileId} while processing ${fileId}`
              );
              buffer = Buffer.alloc(0);
              socket.write(
                Buffer.from(
                  `ERROR:${ERROR_CODES.INVALID_HEADER}:Unexpected fileId\n`
                )
              );
              return;
            }
          } else {
            Logger.warn(
              `Unexpected data while receiving file for ${fileId} from ${ip}: ${dataStr.slice(
                0,
                50
              )}...`
            );
            buffer = Buffer.alloc(0);
            socket.write(
              Buffer.from(
                `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
              )
            );
            return;
          }
        } else {
          if (dataStr.startsWith("FILE:")) {
            const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
            if (headerEnd === -1) {
              Logger.info(
                `Incomplete FILE header from client ${ip}, waiting...`
              );
              return;
            }
            const headerStr = buffer.slice(5, headerEnd).toString();
            let headerData: FileHeader;
            try {
              headerData = JSON.parse(headerStr);
            } catch (error) {
              Logger.error(`Failed to parse FILE header: ${headerStr}`, error);
              socket.write(
                Buffer.from(
                  `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid file header\n`
                )
              );
              buffer = Buffer.alloc(0);
              return;
            }

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
              return;
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
              !expectedChunkSize ||
              !headerData.encryptedAESKey
            ) {
              Logger.error(
                `Missing required fields in FILE header for ${fileId}`
              );
              socket.write(
                Buffer.from(
                  `ERROR:${ERROR_CODES.INVALID_HEADER}:Missing required fields\n`
                )
              );
              buffer = Buffer.alloc(0);
              return;
            }

            // Generate RSA key pair if not already generated
            if (!rsaKeyPair) {
              Logger.info(`Generating RSA key pair for ${fileId}`);
              rsaKeyPair = await generateRSAKeyPair(30000);
              Logger.info(`Completed RSA key pair generation for ${fileId}`);
            } else {
              Logger.info(`Reusing existing RSA key pair for ${fileId}`);
            }

            // Decrypt AES key
            if (!senderPublicKey) {
              Logger.error(`Sender public key not received for ${fileId}`);
              socket.write(
                Buffer.from(
                  `ERROR:${ERROR_CODES.ENCRYPTION_FAILED}:Sender public key not received\n`
                )
              );
              buffer = Buffer.alloc(0);
              return;
            }
            try {
              const aesKey = await decryptAESKeyWithRSA(
                Buffer.from(headerData.encryptedAESKey, "base64"),
                rsaKeyPair.privateKey
              );
              aesKeyPair[fileId] = { key: aesKey, iv: "" }; // IV will be set later
            } catch (error) {
              Logger.error(`Failed to decrypt AES key for ${fileId}`, error);
              socket.write(
                Buffer.from(
                  `ERROR:${ERROR_CODES.DECRYPTION_FAILED}:Failed to decrypt AES key\n`
                )
              );
              buffer = Buffer.alloc(0);
              return;
            }

            const { chunkSize: calculatedChunkSize } =
              calculateDynamicChunkDivision(fileSize);
            if (expectedChunkSize !== calculatedChunkSize) {
              Logger.error(
                `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${expectedChunkSize}`
              );
              socket.write(
                Buffer.from(
                  `ERROR:${ERROR_CODES.INVALID_HEADER}:Chunk size mismatch\n`
                )
              );
              buffer = Buffer.alloc(0);
              return;
            }

            if (!checkTransferLimits(fileSize, fileTransfers)) {
              socket.write(
                Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
              );
              Logger.toast(`Transfer limit exceeded for ${fileName}`, "error");
              buffer = Buffer.alloc(0);
              return;
            }

            tempEncryptedPath = `${TEMP_CHUNKS_PATH}/${fileId}_encrypted`;
            if (!(await ReactNativeBlobUtil.fs.exists(TEMP_CHUNKS_PATH))) {
              await ReactNativeBlobUtil.fs.mkdir(TEMP_CHUNKS_PATH);
            }
            await ReactNativeBlobUtil.fs.writeFile(
              tempEncryptedPath,
              "",
              "base64"
            );

            // Generate IV for this file transfer
            const { iv } = await generateAESKey();
            aesKeyPair[fileId].iv = iv;

            socket.write(Buffer.from(`ACK_FILE:${fileId}\n`));
            buffer = buffer.slice(headerEnd + 2);
            receivingFile = true;
            startTime = Date.now();
          } else if (dataStr.startsWith("MSG:")) {
            const messageEnd = buffer.indexOf(Buffer.from("\n"));
            if (messageEnd === -1) {
              Logger.info(`Incomplete MSG from client ${ip}, waiting...`);
              return;
            }
            const message = buffer.slice(4, messageEnd).toString();
            setMessages((prev) => [...prev, `Client: ${message}`]);
            buffer = buffer.slice(messageEnd + 1);
          } else if (
            dataStr.startsWith("ACK_FILE:") ||
            dataStr.startsWith("ACK_COMPLETE:") ||
            dataStr.startsWith("ACK_CHUNK:") ||
            dataStr.startsWith("ACK_PUBKEY:")
          ) {
            const messageEnd = buffer.indexOf(Buffer.from("\n"));
            if (messageEnd === -1) {
              Logger.info(
                `Incomplete ${dataStr.slice(
                  0,
                  10
                )} from client ${ip}, waiting...`
              );
              return;
            }
            Logger.info(`Processed ${dataStr.slice(0, messageEnd)} from ${ip}`);
            buffer = buffer.slice(messageEnd + 1);
          } else {
            Logger.warn(
              `Invalid data from client ${ip}: ${dataStr.slice(0, 50)}...`
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
      Logger.error(`Error processing data from client ${ip}`, error);
      const err = DropShareError.from(
        error,
        ERROR_CODES.NETWORK_ERROR,
        `Data processing failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      socket.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
      buffer = Buffer.alloc(0);
      receivingFile = false;
      chunkCounts = {};
      if (await ReactNativeBlobUtil.fs.exists(tempEncryptedPath)) {
        await ReactNativeBlobUtil.fs
          .unlink(tempEncryptedPath)
          .catch((err) =>
            Logger.error(`Failed to delete temp file ${tempEncryptedPath}`, err)
          );
      }
      fileId = "";
      fileName = "";
      fileSize = 0;
      deviceName = "";
      totalChunks = 0;
      expectedChunkSize = 0;
      delete aesKeyPair[fileId];
      senderPublicKey = null;
    }
  }

  return {
    sendFilesInHost,
    sendMessageInHost,
    receiveFileInHost,
  };
};
