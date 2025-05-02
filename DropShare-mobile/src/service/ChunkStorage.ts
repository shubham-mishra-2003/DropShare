// // // import RNFS from "react-native-fs";
// // // import SQLite from "react-native-sqlite-storage";
// // // import { Buffer } from "buffer";
// // // import SHA256 from "crypto-js/sha256";

// // // SQLite.enablePromise(true);

// // // const DB_NAME = "DropShareChunks.db";
// // // const CHUNK_DIR = `${RNFS.DocumentDirectoryPath}/DropShareChunks`; // Chunks stay temporary
// // // const OUTPUT_DIR = `${RNFS.ExternalStorageDirectoryPath}/DropShare`; // Final files go here
// // // const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

// // // interface TransferRecord {
// // //   fileId: string;
// // //   fileName: string;
// // //   totalSize: number;
// // //   chunkSize: number;
// // //   lastChunkIndex: number;
// // //   totalChunks: number;
// // //   status: "in_progress" | "completed" | "interrupted";
// // //   senderIp: string;
// // //   timestamp: number;
// // // }

// // // class ChunkStorage {
// // //   private db: SQLite.SQLiteDatabase | null = null;

// // //   async initialize(): Promise<void> {
// // //     try {
// // //       await RNFS.mkdir(CHUNK_DIR);
// // //       await RNFS.mkdir(OUTPUT_DIR);
// // //       this.db = await SQLite.openDatabase({
// // //         name: DB_NAME,
// // //         location: "default",
// // //       });
// // //       await this.db.executeSql(`
// // //         CREATE TABLE IF NOT EXISTS transfers (
// // //           fileId TEXT PRIMARY KEY,
// // //           fileName TEXT NOT NULL,
// // //           totalSize INTEGER NOT NULL,
// // //           chunkSize INTEGER NOT NULL,
// // //           lastChunkIndex INTEGER NOT NULL,
// // //           totalChunks INTEGER NOT NULL,
// // //           status TEXT NOT NULL,
// // //           senderIp TEXT NOT NULL,
// // //           timestamp INTEGER NOT NULL
// // //         )
// // //       `);
// // //       await this.cleanupOldChunks();
// // //     } catch (error) {
// // //       console.error("Failed to initialize ChunkStorage:", error);
// // //       throw new Error(`ChunkStorage initialization failed: ${error}`);
// // //     }
// // //   }

// // //   generateFileId(
// // //     senderIp: string,
// // //     fileName: string,
// // //     timestamp: number
// // //   ): string {
// // //     const rawId = `${senderIp}-${fileName}-${timestamp}`;
// // //     return SHA256(rawId).toString();
// // //   }

// // //   async saveChunk(
// // //     fileId: string,
// // //     chunkIndex: number,
// // //     chunkData: Buffer
// // //   ): Promise<void> {
// // //     try {
// // //       const chunkPath = `${CHUNK_DIR}/${fileId}_${chunkIndex}.chunk`;
// // //       await RNFS.writeFile(chunkPath, chunkData.toString("base64"), "base64");
// // //       console.log(
// // //         `💾 Saved chunk ${chunkIndex} for ${fileId} (${chunkData.length} bytes)`
// // //       );
// // //     } catch (error) {
// // //       console.error(`Failed to save chunk ${fileId}_${chunkIndex}:`, error);
// // //       throw error;
// // //     }
// // //   }

// // //   async getChunk(fileId: string, chunkIndex: number): Promise<Buffer | null> {
// // //     try {
// // //       const chunkPath = `${CHUNK_DIR}/${fileId}_${chunkIndex}.chunk`;
// // //       if (await RNFS.exists(chunkPath)) {
// // //         const data = await RNFS.readFile(chunkPath, "base64");
// // //         return Buffer.from(data, "base64");
// // //       }
// // //       return null;
// // //     } catch (error) {
// // //       console.error(`Failed to get chunk ${fileId}_${chunkIndex}:`, error);
// // //       return null;
// // //     }
// // //   }

// // //   async saveTransferRecord(record: TransferRecord): Promise<void> {
// // //     if (!this.db) throw new Error("Database not initialized");
// // //     try {
// // //       await this.db.executeSql(
// // //         `INSERT OR REPLACE INTO transfers (fileId, fileName, totalSize, chunkSize, lastChunkIndex, totalChunks, status, senderIp, timestamp)
// // //          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
// // //         [
// // //           record.fileId,
// // //           record.fileName,
// // //           record.totalSize,
// // //           record.chunkSize,
// // //           record.lastChunkIndex,
// // //           record.totalChunks,
// // //           record.status,
// // //           record.senderIp,
// // //           record.timestamp,
// // //         ]
// // //       );
// // //       console.log(
// // //         `📝 Saved transfer record for ${record.fileId}: ${record.totalChunks} chunks expected`
// // //       );
// // //     } catch (error) {
// // //       console.error(`Failed to save transfer record ${record.fileId}:`, error);
// // //       throw error;
// // //     }
// // //   }

// // //   async getTransferRecord(fileId: string): Promise<TransferRecord | null> {
// // //     if (!this.db) throw new Error("Database not initialized");
// // //     try {
// // //       const [result] = await this.db.executeSql(
// // //         "SELECT * FROM transfers WHERE fileId = ?",
// // //         [fileId]
// // //       );
// // //       return result.rows.length > 0
// // //         ? (result.rows.item(0) as TransferRecord)
// // //         : null;
// // //     } catch (error) {
// // //       console.error(`Failed to get transfer record ${fileId}:`, error);
// // //       return null;
// // //     }
// // //   }

// // //   async updateLastChunkIndex(
// // //     fileId: string,
// // //     lastChunkIndex: number,
// // //     status?: string
// // //   ): Promise<void> {
// // //     if (!this.db) throw new Error("Database not initialized");
// // //     try {
// // //       const updates = status
// // //         ? "lastChunkIndex = ?, status = ?"
// // //         : "lastChunkIndex = ?";
// // //       const values = status
// // //         ? [lastChunkIndex, status, fileId]
// // //         : [lastChunkIndex, fileId];
// // //       await this.db.executeSql(
// // //         `UPDATE transfers SET ${updates} WHERE fileId = ?`,
// // //         values
// // //       );
// // //       console.log(
// // //         `🔄 Updated ${fileId} to lastChunkIndex=${lastChunkIndex}${
// // //           status ? `, status=${status}` : ""
// // //         }`
// // //       );
// // //     } catch (error) {
// // //       console.error(`Failed to update chunk index for ${fileId}:`, error);
// // //       throw error;
// // //     }
// // //   }

// // //   async cleanupOldChunks(): Promise<void> {
// // //     if (!this.db) return;
// // //     try {
// // //       const now = Date.now();
// // //       const [result] = await this.db.executeSql(
// // //         "SELECT fileId FROM transfers WHERE timestamp < ? AND status != 'completed'",
// // //         [now - TWENTY_FOUR_HOURS]
// // //       );
// // //       const oldFileIds = result.rows.raw().map((row: any) => row.fileId);
// // //       for (const fileId of oldFileIds) {
// // //         await this.deleteTransfer(fileId);
// // //       }
// // //     } catch (error) {
// // //       console.error("Failed to cleanup old chunks:", error);
// // //     }
// // //   }

// // //   async deleteTransfer(fileId: string): Promise<void> {
// // //     if (!this.db) return;
// // //     try {
// // //       await this.db.executeSql("DELETE FROM transfers WHERE fileId = ?", [
// // //         fileId,
// // //       ]);
// // //       const files = await RNFS.readDir(CHUNK_DIR);
// // //       for (const file of files) {
// // //         if (file.name.startsWith(`${fileId}_`)) {
// // //           await RNFS.unlink(file.path);
// // //         }
// // //       }
// // //       console.log(`🗑️ Deleted transfer ${fileId}`);
// // //     } catch (error) {
// // //       console.error(`Failed to delete transfer ${fileId}:`, error);
// // //     }
// // //   }

// // //   async assembleFile(fileId: string, fileName: string): Promise<string> {
// // //     try {
// // //       const record = await this.getTransferRecord(fileId);
// // //       if (!record) {
// // //         throw new Error(`No transfer record found for ${fileId}`);
// // //       }
// // //       console.log(
// // //         `🔍 Assembling ${fileId}: lastChunkIndex=${record.lastChunkIndex}, totalChunks=${record.totalChunks}`
// // //       );
// // //       if (record.lastChunkIndex + 1 < record.totalChunks) {
// // //         console.warn(
// // //           `⚠️ Incomplete transfer for ${fileId}: ${record.lastChunkIndex + 1}/${
// // //             record.totalChunks
// // //           } chunks received`
// // //         );
// // //         throw new Error(`Incomplete transfer for ${fileId}`);
// // //       }
// // //       const buffers: Buffer[] = [];
// // //       for (let i = 0; i < record.totalChunks; i++) {
// // //         const chunk = await this.getChunk(fileId, i);
// // //         if (!chunk) throw new Error(`Missing chunk ${i} for ${fileId}`);
// // //         buffers.push(chunk);
// // //       }
// // //       const fullFile = Buffer.concat(buffers);
// // //       const tempPath = `${OUTPUT_DIR}/${Date.now()}-${fileName}`;
// // //       await RNFS.writeFile(tempPath, fullFile.toString("base64"), "base64");
// // //       await this.updateLastChunkIndex(
// // //         fileId,
// // //         record.lastChunkIndex,
// // //         "completed"
// // //       );
// // //       await this.deleteTransfer(fileId);
// // //       console.log(`✅ Assembled file ${fileId} at ${tempPath}`);
// // //       return tempPath;
// // //     } catch (error) {
// // //       console.error(`Failed to assemble file ${fileId}:`, error);
// // //       throw error;
// // //     }
// // //   }
// // // }

// // // export const chunkStorage = new ChunkStorage();

// // // import "react-native-get-random-values";
// // // import RNFS from "react-native-fs";
// // // import SQLite from "react-native-sqlite-storage";
// // // import { Buffer } from "buffer";
// // // import SHA256 from "crypto-js/sha256";
// // // import { Logger } from "../utils/Logger";
// // // import { DropShareError, ERROR_CODES } from "../utils/Error";
// // // import { v4 as uuidv4 } from "uuid";

// // // SQLite.enablePromise(true);

// // // const DB_NAME = "DropShareChunks.db";
// // // const CHUNK_DIR = `${RNFS.DocumentDirectoryPath}/DropShareChunks`;
// // // const OUTPUT_DIR = `${RNFS.ExternalStorageDirectoryPath}/DropShare`;
// // // const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

// // // interface TransferRecord {
// // //   fileId: string;
// // //   fileName: string;
// // //   totalSize: number;
// // //   chunkSize: number;
// // //   lastChunkIndex: number;
// // //   totalChunks: number;
// // //   status: "in_progress" | "completed" | "interrupted";
// // //   senderIp: string;
// // //   timestamp: number;
// // //   aesKey?: string;
// // //   iv?: string;
// // //   direction: "sending" | "receiving";
// // //   filePath?: string;
// // // }

// // // interface ChunkRecord {
// // //   fileId: string;
// // //   chunkIndex: number;
// // //   chunkHash: string;
// // // }

// // // class ChunkStorage {
// // //   private db: SQLite.SQLiteDatabase | null = null;

// // //   async initialize(): Promise<void> {
// // //     try {
// // //       await RNFS.mkdir(CHUNK_DIR);
// // //       await RNFS.mkdir(OUTPUT_DIR);
// // //       this.db = await SQLite.openDatabase({
// // //         name: DB_NAME,
// // //         location: "default",
// // //       });

// // //       // Create transfers table with direction column
// // //       await this.db.executeSql(`
// // //         CREATE TABLE IF NOT EXISTS transfers (
// // //           fileId TEXT PRIMARY KEY,
// // //           fileName TEXT NOT NULL,
// // //           totalSize INTEGER NOT NULL,
// // //           chunkSize INTEGER NOT NULL,
// // //           lastChunkIndex INTEGER NOT NULL,
// // //           totalChunks INTEGER NOT NULL,
// // //           status TEXT NOT NULL,
// // //           senderIp TEXT NOT NULL,
// // //           timestamp INTEGER NOT NULL,
// // //           aesKey TEXT,
// // //           iv TEXT,
// // //           direction TEXT NOT NULL,
// // //           filePath TEXT
// // //         )
// // //       `);

// // //       // Migration: Add direction column if missing
// // //       try {
// // //         await this.db.executeSql(
// // //           "ALTER TABLE transfers ADD COLUMN direction TEXT"
// // //         );
// // //         Logger.info("Added direction column to transfers table");
// // //       } catch (alterError) {
// // //         // Ignore if column already exists
// // //         Logger.info("Direction column already exists or migration not needed");
// // //       }

// // //       await this.db.executeSql(`
// // //         CREATE TABLE IF NOT EXISTS chunks (
// // //           fileId TEXT NOT NULL,
// // //           chunkIndex INTEGER NOT NULL,
// // //           chunkHash TEXT NOT NULL,
// // //           PRIMARY KEY (fileId, chunkIndex)
// // //         )
// // //       `);
// // //       await this.cleanupOldChunks();
// // //       Logger.info("ChunkStorage initialized successfully");
// // //     } catch (error) {
// // //       Logger.error("Failed to initialize ChunkStorage", error);
// // //       throw DropShareError.from(
// // //         error,
// // //         ERROR_CODES.DATABASE_ERROR,
// // //         "ChunkStorage initialization failed"
// // //       );
// // //     }
// // //   }

// // //   async saveTransferRecord(record: TransferRecord): Promise<void> {
// // //     if (!this.db) {
// // //       await this.initialize();
// // //       if (!this.db) {
// // //         throw new DropShareError(
// // //           ERROR_CODES.DATABASE_ERROR,
// // //           "Database initialization failed"
// // //         );
// // //       }
// // //     }
// // //     try {
// // //       await this.db.transaction(async (tx) => {
// // //         await tx.executeSql(
// // //           `INSERT OR REPLACE INTO transfers (
// // //             fileId, fileName, totalSize, chunkSize, lastChunkIndex, totalChunks,
// // //             status, senderIp, timestamp, aesKey, iv, direction, filePath
// // //           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
// // //           [
// // //             record.fileId,
// // //             record.fileName,
// // //             record.totalSize,
// // //             record.chunkSize,
// // //             record.lastChunkIndex,
// // //             record.totalChunks,
// // //             record.status,
// // //             record.senderIp,
// // //             record.timestamp,
// // //             record.aesKey || "",
// // //             record.iv || "",
// // //             record.direction,
// // //             record.filePath || "",
// // //           ]
// // //         );
// // //       });
// // //       Logger.info(
// // //         `Saved transfer record for ${record.fileId}: ${record.totalChunks} chunks expected`
// // //       );
// // //     } catch (error: any) {
// // //       Logger.error(
// // //         `Failed to save transfer record ${record.fileId}: ${
// // //           error.message || error
// // //         }`,
// // //         error
// // //       );
// // //       throw DropShareError.from(
// // //         error,
// // //         ERROR_CODES.DATABASE_ERROR,
// // //         `Failed to save transfer record for ${record.fileId}`
// // //       );
// // //     }
// // //   }

// // //   // Rest of the file remains unchanged
// // //   generateFileId(fileName: string): string {
// // //     const randomId = uuidv4().replace(/-/g, "");
// // //     const safeFileName = fileName.replace(/[^a-zA-Z0-9.]/g, "_");
// // //     const fileId = `${randomId}_${safeFileName}`;
// // //     Logger.info(`Generated fileId: ${fileId}`);
// // //     return fileId;
// // //   }

// // //   async saveChunk(
// // //     fileId: string,
// // //     chunkIndex: number,
// // //     chunkData: Buffer
// // //   ): Promise<string> {
// // //     try {
// // //       const chunkHash = SHA256(chunkData.toString("base64")).toString();
// // //       const chunkPath = `${CHUNK_DIR}/${fileId}_${chunkIndex}.chunk`;
// // //       await RNFS.writeFile(chunkPath, chunkData.toString("base64"), "base64");
// // //       if (this.db) {
// // //         await this.db.executeSql(
// // //           `INSERT OR REPLACE INTO chunks (fileId, chunkIndex, chunkHash) VALUES (?, ?, ?)`,
// // //           [fileId, chunkIndex, chunkHash]
// // //         );
// // //       }
// // //       Logger.info(
// // //         `Saved chunk ${chunkIndex} for ${fileId} (${chunkData.length} bytes)`
// // //       );
// // //       return chunkHash;
// // //     } catch (error) {
// // //       Logger.error(`Failed to save chunk ${fileId}_${chunkIndex}`, error);
// // //       throw DropShareError.from(
// // //         error,
// // //         ERROR_CODES.FILE_IO_ERROR,
// // //         `Failed to save chunk ${chunkIndex}`
// // //       );
// // //     }
// // //   }

// // //   async saveSentChunk(
// // //     fileId: string,
// // //     chunkIndex: number,
// // //     chunkData: Buffer
// // //   ): Promise<string> {
// // //     return this.saveChunk(fileId, chunkIndex, chunkData);
// // //   }

// // //   async getChunk(
// // //     fileId: string,
// // //     chunkIndex: number
// // //   ): Promise<{ data: Buffer } | null> {
// // //     try {
// // //       const chunkPath = `${CHUNK_DIR}/${fileId}_${chunkIndex}.chunk`;
// // //       if (await RNFS.exists(chunkPath)) {
// // //         const data = await RNFS.readFile(chunkPath, "base64");
// // //         const buffer = Buffer.from(data, "base64");
// // //         if (this.db) {
// // //           const [result] = await this.db.executeSql(
// // //             "SELECT chunkHash FROM chunks WHERE fileId = ? AND chunkIndex = ?",
// // //             [fileId, chunkIndex]
// // //           );
// // //           if (result.rows.length > 0) {
// // //             const { chunkHash } = result.rows.item(0);
// // //             const computedHash = SHA256(buffer.toString("base64")).toString();
// // //             if (chunkHash !== computedHash) {
// // //               throw new DropShareError(
// // //                 ERROR_CODES.CORRUPTED_CHUNK,
// // //                 `Chunk ${chunkIndex} for ${fileId} is corrupted`
// // //               );
// // //             }
// // //             return { data: buffer };
// // //           }
// // //         }
// // //         return { data: buffer };
// // //       }
// // //       return null;
// // //     } catch (error) {
// // //       Logger.error(`Failed to get chunk ${fileId}_${chunkIndex}`, error);
// // //       throw DropShareError.from(
// // //         error,
// // //         ERROR_CODES.FILE_IO_ERROR,
// // //         `Failed to get chunk ${chunkIndex}`
// // //       );
// // //     }
// // //   }

// // //   async getSentChunk(
// // //     fileId: string,
// // //     chunkIndex: number
// // //   ): Promise<{ data: Buffer } | null> {
// // //     return this.getChunk(fileId, chunkIndex);
// // //   }

// // //   async getLastSentChunkIndex(fileId: string): Promise<number> {
// // //     try {
// // //       const record = await this.getTransferRecord(fileId);
// // //       return record ? record.lastChunkIndex : -1;
// // //     } catch (error) {
// // //       Logger.error(`Failed to get last sent chunk index for ${fileId}`, error);
// // //       return -1;
// // //     }
// // //   }

// // //   async getTransferRecord(fileId: string): Promise<TransferRecord | null> {
// // //     if (!this.db) {
// // //       await this.initialize();
// // //       if (!this.db) {
// // //         throw new DropShareError(
// // //           ERROR_CODES.DATABASE_ERROR,
// // //           "Database not initialized"
// // //         );
// // //       }
// // //     }
// // //     try {
// // //       const [result] = await this.db.executeSql(
// // //         "SELECT * FROM transfers WHERE fileId = ?",
// // //         [fileId]
// // //       );
// // //       return result.rows.length > 0
// // //         ? (result.rows.item(0) as TransferRecord)
// // //         : null;
// // //     } catch (error) {
// // //       Logger.error(`Failed to get transfer record ${fileId}`, error);
// // //       return null;
// // //     }
// // //   }

// // //   async updateLastChunkIndex(
// // //     fileId: string,
// // //     lastChunkIndex: number,
// // //     status?: string
// // //   ): Promise<void> {
// // //     if (!this.db) {
// // //       await this.initialize();
// // //       if (!this.db) {
// // //         throw new DropShareError(
// // //           ERROR_CODES.DATABASE_ERROR,
// // //           "Database not initialized"
// // //         );
// // //       }
// // //     }
// // //     try {
// // //       await this.db.transaction(async (tx) => {
// // //         const updates = status
// // //           ? "lastChunkIndex = ?, status = ?"
// // //           : "lastChunkIndex = ?";
// // //         const values = status
// // //           ? [lastChunkIndex, status, fileId]
// // //           : [lastChunkIndex, fileId];
// // //         await tx.executeSql(
// // //           `UPDATE transfers SET ${updates} WHERE fileId = ?`,
// // //           values
// // //         );
// // //       });
// // //       Logger.info(
// // //         `Updated ${fileId} to lastChunkIndex=${lastChunkIndex}${
// // //           status ? `, status=${status}` : ""
// // //         }`
// // //       );
// // //     } catch (error) {
// // //       Logger.error(`Failed to update chunk index for ${fileId}`, error);
// // //       throw DropShareError.from(
// // //         error,
// // //         ERROR_CODES.DATABASE_ERROR,
// // //         "Failed to update chunk index"
// // //       );
// // //     }
// // //   }

// // //   async cleanupOldChunks(): Promise<void> {
// // //     if (!this.db) {
// // //       await this.initialize();
// // //       if (!this.db) return;
// // //     }
// // //     try {
// // //       await this.db.transaction(async (tx) => {
// // //         const now = Date.now();
// // //         const [result] = await tx.executeSql(
// // //           "SELECT fileId FROM transfers WHERE timestamp < ? AND status != 'completed'",
// // //           [now - TWENTY_FOUR_HOURS]
// // //         );
// // //         const oldFileIds = (result as unknown as SQLite.ResultSet).rows
// // //           .raw()
// // //           .map((row: any) => row.fileId);
// // //         for (const fileId of oldFileIds) {
// // //           await this.deleteTransfer(fileId);
// // //         }
// // //         Logger.info(`Cleaned up ${oldFileIds.length} old transfers`);
// // //       });
// // //     } catch (error) {
// // //       Logger.error("Failed to cleanup old chunks", error);
// // //     }
// // //   }

// // //   async deleteTransfer(fileId: string): Promise<void> {
// // //     if (!this.db) {
// // //       await this.initialize();
// // //       if (!this.db) return;
// // //     }
// // //     try {
// // //       await this.db.transaction(async (tx) => {
// // //         await tx.executeSql("DELETE FROM transfers WHERE fileId = ?", [fileId]);
// // //         await tx.executeSql("DELETE FROM chunks WHERE fileId = ?", [fileId]);
// // //         const files = await RNFS.readDir(CHUNK_DIR);
// // //         for (const file of files) {
// // //           if (file.name.startsWith(`${fileId}_`)) {
// // //             await RNFS.unlink(file.path);
// // //           }
// // //         }
// // //       });
// // //       Logger.info(`Deleted transfer ${fileId}`);
// // //     } catch (error) {
// // //       Logger.error(`Failed to delete transfer ${fileId}`, error);
// // //       throw DropShareError.from(
// // //         error,
// // //         ERROR_CODES.FILE_IO_ERROR,
// // //         "Failed to delete transfer"
// // //       );
// // //     }
// // //   }

// // //   async assembleFile(fileId: string, fileName: string): Promise<string> {
// // //     try {
// // //       const record = await this.getTransferRecord(fileId);
// // //       if (!record) {
// // //         throw new DropShareError(
// // //           ERROR_CODES.DATABASE_ERROR,
// // //           `No transfer record found for ${fileId}`
// // //         );
// // //       }
// // //       Logger.info(
// // //         `Assembling ${fileId}: lastChunkIndex=${record.lastChunkIndex}, totalChunks=${record.totalChunks}`
// // //       );
// // //       if (record.lastChunkIndex + 1 < record.totalChunks) {
// // //         Logger.warn(
// // //           `Incomplete transfer for ${fileId}: ${record.lastChunkIndex + 1}/${
// // //             record.totalChunks
// // //           } chunks received`
// // //         );
// // //         throw new DropShareError(
// // //           ERROR_CODES.CHUNK_MISSING,
// // //           `Incomplete transfer for ${fileId}`
// // //         );
// // //       }
// // //       const buffers: Buffer[] = [];
// // //       for (let i = 0; i < record.totalChunks; i++) {
// // //         const chunk = await this.getChunk(fileId, i);
// // //         if (!chunk || !chunk.data) {
// // //           throw new DropShareError(
// // //             ERROR_CODES.CHUNK_MISSING,
// // //             `Missing chunk ${i} for ${fileId}`
// // //           );
// // //         }
// // //         buffers.push(chunk.data);
// // //       }
// // //       const fullFile = Buffer.concat(buffers);
// // //       let SAVE_PATH = `${OUTPUT_DIR}/${fileName}`;
// // //       let counter = 1;
// // //       const [name, exten] = fileName.split(/(\.[^.]+)$/);
// // //       const ext = exten || "";
// // //       while (await RNFS.exists(SAVE_PATH)) {
// // //         SAVE_PATH = `${OUTPUT_DIR}/${name}-${counter}${ext}`;
// // //         counter++;
// // //       }
// // //       await RNFS.writeFile(SAVE_PATH, fullFile.toString("base64"), "base64");
// // //       await this.updateLastChunkIndex(
// // //         fileId,
// // //         record.lastChunkIndex,
// // //         "completed"
// // //       );
// // //       await this.deleteTransfer(fileId);
// // //       Logger.info(`Assembled file ${fileId} at ${SAVE_PATH}`);
// // //       return SAVE_PATH;
// // //     } catch (error) {
// // //       Logger.error(`Failed to assemble file ${fileId}`, error);
// // //       throw DropShareError.from(
// // //         error,
// // //         ERROR_CODES.FILE_IO_ERROR,
// // //         "Failed to assemble file"
// // //       );
// // //     }
// // //   }
// // // }

// // // export const chunkStorage = new ChunkStorage();

// // // import RNFS from "react-native-fs";
// // // import SQLite from "react-native-sqlite-storage";
// // // import { Buffer } from "buffer";
// // // import { Logger } from "../utils/Logger";
// // // import { DropShareError, ERROR_CODES } from "../utils/Error";
// // // import { Platform } from "react-native";

// // // SQLite.enablePromise(true);

// // // const CHUNK_DIR = `${RNFS.DocumentDirectoryPath}/DropShareChunks`;
// // // const OUTPUT_DIR =
// // //   Platform.OS === "android"
// // //     ? `${RNFS.ExternalStorageDirectoryPath}/DropShare`
// // //     : `${RNFS.DocumentDirectoryPath}/DropShare`;
// // // const DB_NAME = "DropShareChunks.db";
// // // const DB_PATH = `${RNFS.DocumentDirectoryPath}/${DB_NAME}`;

// // // interface TransferRecord {
// // //   fileId: string;
// // //   fileName: string;
// // //   totalSize: number;
// // //   chunkSize: number;
// // //   lastChunkIndex: number;
// // //   totalChunks: number;
// // //   status: string;
// // //   senderIp: string;
// // //   timestamp: number;
// // //   aesKey?: string;
// // //   iv?: string;
// // //   direction: string;
// // //   filePath?: string;
// // // }

// // // export class ChunkStorage {
// // //   private db: SQLite.SQLiteDatabase | null = null;
// // //   private initialized = false;

// // //   async initialize(): Promise<void> {
// // //     if (this.initialized) {
// // //       Logger.info("ChunkStorage already initialized");
// // //       return;
// // //     }

// // //     try {
// // //       // Ensure directories exist
// // //       const chunkDirExists = await RNFS.exists(CHUNK_DIR);
// // //       if (!chunkDirExists) {
// // //         await RNFS.mkdir(CHUNK_DIR);
// // //         Logger.info(`Created CHUNK_DIR: ${CHUNK_DIR}`);
// // //       } else {
// // //         Logger.info(`CHUNK_DIR exists: ${CHUNK_DIR}`);
// // //       }

// // //       const outputDirExists = await RNFS.exists(OUTPUT_DIR);
// // //       if (!outputDirExists) {
// // //         await RNFS.mkdir(OUTPUT_DIR);
// // //         Logger.info(`Created OUTPUT_DIR: ${OUTPUT_DIR}`);
// // //       } else {
// // //         Logger.info(`OUTPUT_DIR exists: ${OUTPUT_DIR}`);
// // //       }

// // //       // Check database file permissions
// // //       try {
// // //         await RNFS.stat(DB_PATH);
// // //       } catch (error) {
// // //         Logger.warn(
// // //           `Database file not found or inaccessible, will create: ${DB_PATH}`
// // //         );
// // //       }

// // //       // Initialize database
// // //       this.db = await SQLite.openDatabase({
// // //         name: DB_NAME,
// // //         location: "default",
// // //       });
// // //       Logger.info(`Opened database: ${DB_NAME}`);

// // //       // Create transfers table
// // //       await this.db.executeSql(`
// // //         CREATE TABLE IF NOT EXISTS transfers (
// // //           fileId TEXT PRIMARY KEY,
// // //           fileName TEXT NOT NULL,
// // //           totalSize INTEGER NOT NULL,
// // //           chunkSize INTEGER NOT NULL,
// // //           lastChunkIndex INTEGER NOT NULL,
// // //           totalChunks INTEGER NOT NULL,
// // //           status TEXT NOT NULL,
// // //           senderIp TEXT NOT NULL,
// // //           timestamp INTEGER NOT NULL,
// // //           aesKey TEXT,
// // //           iv TEXT,
// // //           direction TEXT NOT NULL
// // //         )
// // //       `);
// // //       Logger.info("Created transfers table (base schema)");

// // //       // Check and add filePath column
// // //       let [pragmaResult] = await this.db.executeSql(
// // //         `PRAGMA table_info(transfers)`
// // //       );
// // //       let columns = pragmaResult.rows.raw().map((row: any) => row.name);
// // //       if (!columns.includes("filePath")) {
// // //         await this.db.executeSql(
// // //           `ALTER TABLE transfers ADD COLUMN filePath TEXT`
// // //         );
// // //         Logger.info("Added filePath column to transfers table");
// // //       } else {
// // //         Logger.info("filePath column already exists in transfers table");
// // //       }

// // //       // Check chunks table schema
// // //       [pragmaResult] = await this.db.executeSql(`PRAGMA table_info(chunks)`);
// // //       columns = pragmaResult.rows.raw().map((row: any) => row.name);
// // //       if (!columns.includes("chunkData")) {
// // //         Logger.warn(
// // //           "chunks table missing chunkData column, performing migration"
// // //         );

// // //         // Create temporary table with correct schema
// // //         await this.db.executeSql(`
// // //           CREATE TABLE chunks_temp (
// // //             fileId TEXT,
// // //             chunkIndex INTEGER,
// // //             chunkData BLOB NOT NULL,
// // //             PRIMARY KEY (fileId, chunkIndex),
// // //             FOREIGN KEY (fileId) REFERENCES transfers(fileId)
// // //           )
// // //         `);

// // //         // If old chunks table exists, drop it (data migration skipped as chunkData is missing)
// // //         await this.db.executeSql(`DROP TABLE IF EXISTS chunks`);
// // //         Logger.info("Dropped outdated chunks table");

// // //         // Rename temp table to chunks
// // //         await this.db.executeSql(`ALTER TABLE chunks_temp RENAME TO chunks`);
// // //         Logger.info("Created chunks table with correct schema");
// // //       } else {
// // //         Logger.info("chunkData column already exists in chunks table");
// // //       }

// // //       // Ensure chunks table exists (fallback if it was never created)
// // //       await this.db.executeSql(`
// // //         CREATE TABLE IF NOT EXISTS chunks (
// // //           fileId TEXT,
// // //           chunkIndex INTEGER,
// // //           chunkData BLOB NOT NULL,
// // //           PRIMARY KEY (fileId, chunkIndex),
// // //           FOREIGN KEY (fileId) REFERENCES transfers(fileId)
// // //         )
// // //       `);
// // //       Logger.info("Ensured chunks table exists");

// // //       // Verify schemas
// // //       const [transfersSchema] = await this.db.executeSql(
// // //         `SELECT sql FROM sqlite_master WHERE type='table' AND name='transfers'`
// // //       );
// // //       Logger.info(
// // //         `Transfers table schema: ${transfersSchema.rows.item(0).sql}`
// // //       );

// // //       const [chunksSchema] = await this.db.executeSql(
// // //         `SELECT sql FROM sqlite_master WHERE type='table' AND name='chunks'`
// // //       );
// // //       Logger.info(`Chunks table schema: ${chunksSchema.rows.item(0).sql}`);

// // //       this.initialized = true;
// // //       Logger.info("ChunkStorage initialized successfully");
// // //     } catch (error) {
// // //       Logger.error("Failed to initialize ChunkStorage", error);
// // //       try {
// // //         await RNFS.unlink(DB_PATH);
// // //         Logger.info(`Deleted corrupted database: ${DB_PATH}`);
// // //         this.db = null;
// // //         this.initialized = false;
// // //         await this.initialize(); // Retry initialization
// // //       } catch (deleteError) {
// // //         Logger.error("Failed to delete corrupted database", deleteError);
// // //         throw new DropShareError(
// // //           ERROR_CODES.DATABASE_ERROR,
// // //           `Failed to initialize database: ${
// // //             error instanceof Error ? error.message : "Unknown error"
// // //           }`,
// // //           error
// // //         );
// // //       }
// // //     }
// // //   }

// // //   async saveTransferRecord(record: TransferRecord): Promise<void> {
// // //     if (!this.db || !this.initialized) {
// // //       await this.initialize();
// // //     }

// // //     try {
// // //       const {
// // //         fileId,
// // //         fileName,
// // //         totalSize,
// // //         chunkSize,
// // //         lastChunkIndex,
// // //         totalChunks,
// // //         status,
// // //         senderIp,
// // //         timestamp,
// // //         aesKey,
// // //         iv,
// // //         direction,
// // //         filePath,
// // //       } = record;

// // //       // Validate required fields
// // //       if (
// // //         !fileId ||
// // //         !fileName ||
// // //         !totalSize ||
// // //         !chunkSize ||
// // //         !totalChunks ||
// // //         !status ||
// // //         !senderIp ||
// // //         !timestamp ||
// // //         !direction
// // //       ) {
// // //         throw new Error("Missing required transfer record fields");
// // //       }

// // //       const query = `
// // //         INSERT OR REPLACE INTO transfers (
// // //           fileId, fileName, totalSize, chunkSize, lastChunkIndex, totalChunks,
// // //           status, senderIp, timestamp, aesKey, iv, direction, filePath
// // //         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
// // //       `;
// // //       const params = [
// // //         fileId,
// // //         fileName,
// // //         totalSize,
// // //         chunkSize,
// // //         lastChunkIndex,
// // //         totalChunks,
// // //         status,
// // //         senderIp,
// // //         timestamp,
// // //         aesKey || null,
// // //         iv || null,
// // //         direction,
// // //         filePath || null,
// // //       ];

// // //       Logger.info(
// // //         `Saving transfer record for ${fileId}: ${totalChunks} chunks`
// // //       );
// // //       await this.db!.executeSql(query, params);
// // //       Logger.info(`Saved transfer record for ${fileId}`);
// // //     } catch (error) {
// // //       Logger.error(`Failed to save transfer record ${record.fileId}`, {
// // //         message: error instanceof Error ? error.message : "Unknown error",
// // //         code: error instanceof Error ? (error as any).code || 0 : 0,
// // //       });
// // //       throw new DropShareError(
// // //         ERROR_CODES.DATABASE_WRITE_ERROR,
// // //         `Failed to save transfer record for ${record.fileId}: ${
// // //           error instanceof Error ? error.message : "Unknown error"
// // //         }`,
// // //         error
// // //       );
// // //     }
// // //   }

// // //   async getTransferRecord(fileId: string): Promise<TransferRecord | null> {
// // //     if (!this.db || !this.initialized) {
// // //       await this.initialize();
// // //     }

// // //     try {
// // //       const [result] = await this.db!.executeSql(
// // //         `SELECT * FROM transfers WHERE fileId = ?`,
// // //         [fileId]
// // //       );
// // //       if (result.rows.length === 0) {
// // //         Logger.info(`No transfer record found for ${fileId}`);
// // //         return null;
// // //       }
// // //       const record = result.rows.item(0) as TransferRecord;
// // //       Logger.info(`Retrieved transfer record for ${fileId}: ${record.status}`);
// // //       return record;
// // //     } catch (error) {
// // //       Logger.error(`Failed to retrieve transfer record ${fileId}`, error);
// // //       return null;
// // //     }
// // //   }

// // //   async saveChunk(
// // //     fileId: string,
// // //     chunkIndex: number,
// // //     chunkData: Buffer
// // //   ): Promise<void> {
// // //     if (!this.db || !this.initialized) {
// // //       await this.initialize();
// // //     }

// // //     try {
// // //       await this.db!.executeSql(
// // //         `INSERT OR REPLACE INTO chunks (fileId, chunkIndex, chunkData) VALUES (?, ?, ?)`,
// // //         [fileId, chunkIndex, chunkData]
// // //       );
// // //       Logger.info(`Saved chunk ${chunkIndex} for ${fileId}`);
// // //     } catch (error) {
// // //       Logger.error(`Failed to save chunk ${chunkIndex} for ${fileId}`, {
// // //         message: error instanceof Error ? error.message : "Unknown error",
// // //         code: error instanceof Error ? (error as any).code || 0 : 0,
// // //       });
// // //       throw new DropShareError(
// // //         ERROR_CODES.DATABASE_WRITE_ERROR,
// // //         `Failed to save chunk: ${
// // //           error instanceof Error ? error.message : "Unknown error"
// // //         }`,
// // //         error
// // //       );
// // //     }
// // //   }

// // //   async saveSentChunk(
// // //     fileId: string,
// // //     chunkIndex: number,
// // //     chunkData: Buffer
// // //   ): Promise<void> {
// // //     return this.saveChunk(fileId, chunkIndex, chunkData);
// // //   }

// // //   async updateLastChunkIndex(
// // //     fileId: string,
// // //     chunkIndex: number
// // //   ): Promise<void> {
// // //     if (!this.db || !this.initialized) {
// // //       await this.initialize();
// // //     }

// // //     try {
// // //       await this.db!.executeSql(
// // //         `UPDATE transfers SET lastChunkIndex = ?, status = ? WHERE fileId = ?`,
// // //         [chunkIndex, chunkIndex === -1 ? "in_progress" : "in_progress", fileId]
// // //       );
// // //       Logger.info(`Updated lastChunkIndex to ${chunkIndex} for ${fileId}`);
// // //     } catch (error) {
// // //       Logger.error(`Failed to update lastChunkIndex for ${fileId}`, error);
// // //       throw new DropShareError(
// // //         ERROR_CODES.DATABASE_WRITE_ERROR,
// // //         `Failed to update chunk index: ${
// // //           error instanceof Error ? error.message : "Unknown error"
// // //         }`,
// // //         error
// // //       );
// // //     }
// // //   }

// // //   async assembleFile(fileId: string, fileName: string): Promise<string> {
// // //     if (!this.db || !this.initialized) {
// // //       await this.initialize();
// // //     }

// // //     try {
// // //       const record = await this.getTransferRecord(fileId);
// // //       if (!record) {
// // //         throw new DropShareError(
// // //           ERROR_CODES.DATABASE_ERROR,
// // //           `No transfer record found for ${fileId}`
// // //         );
// // //       }

// // //       const [chunksResult] = await this.db!.executeSql(
// // //         `SELECT chunkData FROM chunks WHERE fileId = ? ORDER BY chunkIndex ASC`,
// // //         [fileId]
// // //       );
// // //       const chunks = chunksResult.rows
// // //         .raw()
// // //         .map((row: any) => Buffer.from(row.chunkData));

// // //       const SAVE_PATH = `${OUTPUT_DIR}/${fileName}`;
// // //       await RNFS.writeFile(SAVE_PATH, "", "utf8"); // Initialize empty file
// // //       for (const chunk of chunks) {
// // //         await RNFS.appendFile(SAVE_PATH, chunk.toString("base64"), "base64");
// // //       }

// // //       await this.db!.executeSql(
// // //         `UPDATE transfers SET status = ?, filePath = ? WHERE fileId = ?`,
// // //         ["completed", SAVE_PATH, fileId]
// // //       );
// // //       await this.db!.executeSql(`DELETE FROM chunks WHERE fileId = ?`, [
// // //         fileId,
// // //       ]);
// // //       Logger.info(`Assembled and saved file: ${SAVE_PATH}`);

// // //       return SAVE_PATH;
// // //     } catch (error) {
// // //       Logger.error(`Failed to assemble file ${fileId}`, error);
// // //       throw new DropShareError(
// // //         ERROR_CODES.FILE_IO_ERROR,
// // //         `Failed to assemble file: ${
// // //           error instanceof Error ? error.message : "Unknown error"
// // //         }`,
// // //         error
// // //       );
// // //     }
// // //   }

// // //   generateFileId(fileName: string): string {
// // //     const timestamp = Date.now().toString();
// // //     const random = Math.random().toString(36).substring(2, 15);
// // //     return `dropshare_${fileName}_${timestamp}_${random}`;
// // //   }

// // //   async cleanup(): Promise<void> {
// // //     if (!this.db) return;

// // //     try {
// // //       await this.db.executeSql(
// // //         `DELETE FROM transfers WHERE status = ? AND timestamp < ?`,
// // //         ["in_progress", Date.now() - 24 * 60 * 60 * 1000]
// // //       );
// // //       await this.db.executeSql(
// // //         `
// // //         DELETE FROM chunks
// // //         WHERE fileId IN (
// // //           SELECT fileId FROM transfers WHERE status = ? AND timestamp < ?
// // //         )
// // //       `,
// // //         ["in_progress", Date.now() - 24 * 60 * 60 * 1000]
// // //       );
// // //       Logger.info("Cleaned up stale transfers and chunks");
// // //     } catch (error) {
// // //       Logger.error("Failed to clean up database", error);
// // //     }
// // //   }

// // //   async close(): Promise<void> {
// // //     if (this.db) {
// // //       await this.db.close();
// // //       this.db = null;
// // //       this.initialized = false;
// // //       Logger.info("Database closed");
// // //     }
// // //   }
// // // }

// // // export const chunkStorage = new ChunkStorage();

// // import RNFS from "react-native-fs";
// // import { Logger } from "../utils/Logger";
// // import { DropShareError, ERROR_CODES } from "../utils/Error";
// // import SQLite from "react-native-sqlite-storage";

// // // Assuming this is the structure based on usage in HostSharing.ts and ClientSharing.ts
// // interface FileMetadata {
// //   fileId: string;
// //   fileName: string;
// //   filePath: string;
// //   fileSize: number;
// //   totalChunks: number;
// //   chunkSize: number;
// //   lastChunkIndex: number;
// // }

// // export const ChunkStorage = {
// //   db: null as SQLite.SQLiteDatabase | null,

// //   async initialize(): Promise<void> {
// //     try {
// //       this.db = await SQLite.openDatabase({
// //         name: "DropShare.db",
// //         location: "default",
// //       });
// //       await this.db.executeSql(`
// //         CREATE TABLE IF NOT EXISTS files (
// //           fileId TEXT PRIMARY KEY,
// //           fileName TEXT,
// //           filePath TEXT,
// //           fileSize INTEGER,
// //           totalChunks INTEGER,
// //           chunkSize INTEGER,
// //           lastChunkIndex INTEGER
// //         )
// //       `);
// //       await this.db.executeSql(`
// //         CREATE TABLE IF NOT EXISTS chunks (
// //           fileId TEXT,
// //           chunkIndex INTEGER,
// //           chunkPath TEXT,
// //           chunkSize INTEGER,
// //           PRIMARY KEY (fileId, chunkIndex)
// //         )
// //       `);
// //       Logger.info("ChunkStorage initialized");
// //     } catch (error) {
// //       Logger.error("Failed to initialize ChunkStorage", error);
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_ERROR,
// //         `Database initialization failed: ${
// //           error instanceof Error ? error.message : "Unknown error"
// //         }`
// //       );
// //     }
// //   },

// //   async storeFileMetadata(metadata: FileMetadata): Promise<void> {
// //     if (!this.db) {
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_ERROR,
// //         "Database not initialized"
// //       );
// //     }
// //     try {
// //       await this.db.executeSql(
// //         `INSERT OR REPLACE INTO files (fileId, fileName, filePath, fileSize, totalChunks, chunkSize, lastChunkIndex)
// //          VALUES (?, ?, ?, ?, ?, ?, ?)`,
// //         [
// //           metadata.fileId,
// //           metadata.fileName,
// //           metadata.filePath,
// //           metadata.fileSize,
// //           metadata.totalChunks,
// //           metadata.chunkSize,
// //           metadata.lastChunkIndex,
// //         ]
// //       );
// //       Logger.info(`Stored metadata for ${metadata.fileId}`);
// //     } catch (error) {
// //       Logger.error(`Failed to store metadata for ${metadata.fileId}`, error);
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_ERROR,
// //         `Failed to store metadata: ${
// //           error instanceof Error ? error.message : "Unknown error"
// //         }`
// //       );
// //     }
// //   },

// //   async getFileMetadata(fileId: string): Promise<FileMetadata | null> {
// //     if (!this.db) {
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_ERROR,
// //         "Database not initialized"
// //       );
// //     }
// //     try {
// //       const [results] = await this.db.executeSql(
// //         `SELECT * FROM files WHERE fileId = ?`,
// //         [fileId]
// //       );
// //       if (results.rows.length > 0) {
// //         const row = results.rows.item(0);
// //         return {
// //           fileId: row.fileId,
// //           fileName: row.fileName,
// //           filePath: row.filePath,
// //           fileSize: row.fileSize,
// //           totalChunks: row.totalChunks,
// //           chunkSize: row.chunkSize,
// //           lastChunkIndex: row.lastChunkIndex,
// //         };
// //       }
// //       return null;
// //     } catch (error) {
// //       Logger.error(`Failed to get metadata for ${fileId}`, error);
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_ERROR,
// //         `Failed to get metadata: ${
// //           error instanceof Error ? error.message : "Unknown error"
// //         }`
// //       );
// //     }
// //   },

// //   async getFileMetadataByPath(filePath: string): Promise<FileMetadata | null> {
// //     if (!this.db) {
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_ERROR,
// //         "Database not initialized"
// //       );
// //     }
// //     try {
// //       const [results] = await this.db.executeSql(
// //         `SELECT * FROM files WHERE filePath = ?`,
// //         [filePath]
// //       );
// //       if (results.rows.length > 0) {
// //         const row = results.rows.item(0);
// //         return {
// //           fileId: row.fileId,
// //           fileName: row.fileName,
// //           filePath: row.filePath,
// //           fileSize: row.fileSize,
// //           totalChunks: row.totalChunks,
// //           chunkSize: row.chunkSize,
// //           lastChunkIndex: row.lastChunkIndex,
// //         };
// //       }
// //       return null;
// //     } catch (error) {
// //       Logger.error(`Failed to get metadata for path ${filePath}`, error);
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_ERROR,
// //         `Failed to get metadata: ${
// //           error instanceof Error ? error.message : "Unknown error"
// //         }`
// //       );
// //     }
// //   },

// //   async storeChunk(
// //     fileId: string,
// //     chunkIndex: number,
// //     chunk: Buffer,
// //     chunkSize: number
// //   ): Promise<void> {
// //     if (!this.db) {
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_ERROR,
// //         "Database not initialized"
// //       );
// //     }
// //     const chunkPath = `${RNFS.TemporaryDirectoryPath}/${fileId}_${chunkIndex}.chunk`;
// //     try {
// //       await RNFS.writeFile(chunkPath, chunk.toString("base64"), "base64");
// //       await this.db.executeSql(
// //         `INSERT OR REPLACE INTO chunks (fileId, chunkIndex, chunkPath, chunkSize)
// //          VALUES (?, ?, ?, ?)`,
// //         [fileId, chunkIndex, chunkPath, chunkSize]
// //       );
// //       Logger.info(`Stored chunk ${chunkIndex} for ${fileId}`);
// //     } catch (error) {
// //       Logger.error(`Failed to store chunk ${chunkIndex} for ${fileId}`, error);
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_WRITE_ERROR,
// //         `Failed to store chunk: ${
// //           error instanceof Error ? error.message : "Unknown error"
// //         }`
// //       );
// //     }
// //   },

// //   async getReceivedChunkIndexes(fileId: string): Promise<number[]> {
// //     if (!this.db) {
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_ERROR,
// //         "Database not initialized"
// //       );
// //     }
// //     try {
// //       const [results] = await this.db.executeSql(
// //         `SELECT chunkIndex FROM chunks WHERE fileId = ?`,
// //         [fileId]
// //       );
// //       const indexes: number[] = [];
// //       for (let i = 0; i < results.rows.length; i++) {
// //         indexes.push(results.rows.item(i).chunkIndex);
// //       }
// //       return indexes.sort((a, b) => a - b);
// //     } catch (error) {
// //       Logger.error(`Failed to get chunk indexes for ${fileId}`, error);
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_ERROR,
// //         `Failed to get chunk indexes: ${
// //           error instanceof Error ? error.message : "Unknown error"
// //         }`
// //       );
// //     }
// //   },

// //   async assembleFile(fileId: string, finalPath: string): Promise<void> {
// //     if (!this.db) {
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_ERROR,
// //         "Database not initialized"
// //       );
// //     }
// //     try {
// //       const metadata = await this.getFileMetadata(fileId);
// //       if (!metadata) {
// //         throw new DropShareError(
// //           ERROR_CODES.DATABASE_ERROR,
// //           `No metadata found for ${fileId}`
// //         );
// //       }
// //       const [results] = await this.db.executeSql(
// //         `SELECT chunkPath, chunkIndex FROM chunks WHERE fileId = ? ORDER BY chunkIndex`,
// //         [fileId]
// //       );
// //       if (results.rows.length !== metadata.totalChunks) {
// //         throw new DropShareError(
// //           ERROR_CODES.CORRUPTED_CHUNK,
// //           `Incomplete chunks for ${fileId}: expected ${metadata.totalChunks}, found ${results.rows.length}`
// //         );
// //       }
// //       for (let i = 0; i < results.rows.length; i++) {
// //         const { chunkPath } = results.rows.item(i);
// //         const chunkData = await RNFS.readFile(chunkPath, "base64");
// //         await RNFS.appendFile(finalPath, chunkData, "base64");
// //       }
// //       await this.cleanup(fileId);
// //       Logger.info(`Assembled file ${fileId} to ${finalPath}`);
// //     } catch (error) {
// //       Logger.error(`Failed to assemble file ${fileId}`, error);
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_WRITE_ERROR,
// //         `Failed to assemble file: ${
// //           error instanceof Error ? error.message : "Unknown error"
// //         }`
// //       );
// //     }
// //   },

// //   async cleanup(fileId: string): Promise<void> {
// //     if (!this.db) {
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_ERROR,
// //         "Database not initialized"
// //       );
// //     }
// //     try {
// //       const [results] = await this.db.executeSql(
// //         `SELECT chunkPath FROM chunks WHERE fileId = ?`,
// //         [fileId]
// //       );
// //       for (let i = 0; i < results.rows.length; i++) {
// //         const { chunkPath } = results.rows.item(i);
// //         if (await RNFS.exists(chunkPath)) {
// //           await RNFS.unlink(chunkPath);
// //         }
// //       }
// //       await this.db.executeSql(`DELETE FROM chunks WHERE fileId = ?`, [fileId]);
// //       await this.db.executeSql(`DELETE FROM files WHERE fileId = ?`, [fileId]);
// //       Logger.info(`Cleaned up storage for ${fileId}`);
// //     } catch (error) {
// //       Logger.error(`Failed to clean up storage for ${fileId}`, error);
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_ERROR,
// //         `Failed to clean up: ${
// //           error instanceof Error ? error.message : "Unknown error"
// //         }`
// //       );
// //     }
// //   },
// // };

// // import SQLite from "react-native-sqlite-storage";
// // import RNFS from "react-native-fs";
// // import { Buffer } from "buffer";
// // import { Logger } from "../utils/Logger";
// // import { DropShareError, ERROR_CODES } from "../utils/Error";
// // import { TEMP_CHUNKS_PATH } from "../utils/FileSystemUtil";
// // import crypto from "crypto";

// // export class ChunkStorage {
// //   private db: SQLite.SQLiteDatabase;

// //   constructor() {
// //     this.db = SQLite.openDatabase(
// //       { name: "file_transfer.db", location: "default" },
// //       () => Logger.info("SQLite database opened"),
// //       (err) => Logger.error("Failed to open SQLite database", err)
// //     );

// //     this.initializeDatabase();
// //   }

// //   private async initializeDatabase(): Promise<void> {
// //     await new Promise<void>((resolve, reject) => {
// //       this.db.transaction((tx) => {
// //         tx.executeSql(
// //           `CREATE TABLE IF NOT EXISTS chunks (
// //             fileId TEXT,
// //             chunkIndex INTEGER,
// //             chunkSize INTEGER,
// //             hash TEXT,
// //             stored BOOLEAN,
// //             PRIMARY KEY (fileId, chunkIndex)
// //           )`,
// //           [],
// //           () => resolve(),
// //           (_, err) => reject(err)
// //         );
// //       });
// //     });
// //   }

// //   async storeChunk(
// //     fileId: string,
// //     chunkIndex: number,
// //     chunk: Buffer,
// //     chunkSize: number
// //   ): Promise<void> {
// //     const hash = crypto.createHash("sha256").update(chunk).digest("hex");
// //     const chunkPath = `${TEMP_CHUNKS_PATH}/${fileId}_${chunkIndex}.chunk`;

// //     try {
// //       if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
// //         await RNFS.mkdir(TEMP_CHUNKS_PATH);
// //       }
// //       await RNFS.writeFile(chunkPath, chunk.toString("base64"), "base64");

// //       await new Promise<void>((resolve, reject) => {
// //         this.db.transaction((tx) => {
// //           tx.executeSql(
// //             `INSERT OR REPLACE INTO chunks (fileId, chunkIndex, chunkSize, hash, stored)
// //              VALUES (?, ?, ?, ?, ?)`,
// //             [fileId, chunkIndex, chunkSize, hash, true],
// //             () => resolve(),
// //             (_, err) => reject(err)
// //           );
// //         });
// //       });
// //       Logger.info(`Stored chunk ${chunkIndex} for file ${fileId}`);
// //     } catch (error) {
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_WRITE_ERROR,
// //         `Failed to store chunk ${chunkIndex}: ${
// //           error instanceof Error ? error.message : "Unknown error"
// //         }`
// //       );
// //     }
// //   }

// //   async getChunk(
// //     fileId: string,
// //     chunkIndex: number
// //   ): Promise<{ chunk: Buffer; hash: string } | null> {
// //     try {
// //       const results = await new Promise<any[]>((resolve, reject) => {
// //         this.db.transaction((tx) => {
// //           tx.executeSql(
// //             `SELECT * FROM chunks WHERE fileId = ? AND chunkIndex = ? AND stored = ?`,
// //             [fileId, chunkIndex, true],
// //             (_, { rows }) => resolve(rows.raw()),
// //             (_, err) => reject(err)
// //           );
// //         });
// //       });

// //       if (results.length === 0) return null;

// //       const { chunkSize, hash } = results[0];
// //       const chunkPath = `${TEMP_CHUNKS_PATH}/${fileId}_${chunkIndex}.chunk`;

// //       if (await RNFS.exists(chunkPath)) {
// //         const base64Data = await RNFS.readFile(chunkPath, "base64");
// //         const chunk = Buffer.from(base64Data, "base64");
// //         if (chunk.length === chunkSize) {
// //           return { chunk, hash };
// //         }
// //       }
// //       return null;
// //     } catch (error) {
// //       Logger.error(
// //         `Failed to retrieve chunk ${chunkIndex} for ${fileId}`,
// //         error
// //       );
// //       return null;
// //     }
// //   }

// //   async getAvailableChunks(fileId: string): Promise<Set<number>> {
// //     try {
// //       const results = await new Promise<any[]>((resolve, reject) => {
// //         this.db.transaction((tx) => {
// //           tx.executeSql(
// //             `SELECT chunkIndex FROM chunks WHERE fileId = ? AND stored = ?`,
// //             [fileId, true],
// //             (_, { rows }) => resolve(rows.raw()),
// //             (_, err) => reject(err)
// //           );
// //         });
// //       });
// //       return new Set(results.map((row) => row.chunkIndex));
// //     } catch (error) {
// //       Logger.error(`Failed to get available chunks for ${fileId}`, error);
// //       return new Set();
// //     }
// //   }

// //   async deleteChunks(fileId: string): Promise<void> {
// //     try {
// //       const chunks = await this.getAvailableChunks(fileId);
// //       for (const chunkIndex of chunks) {
// //         const chunkPath = `${TEMP_CHUNKS_PATH}/${fileId}_${chunkIndex}.chunk`;
// //         if (await RNFS.exists(chunkPath)) {
// //           await RNFS.unlink(chunkPath);
// //         }
// //       }

// //       await new Promise<void>((resolve, reject) => {
// //         this.db.transaction((tx) => {
// //           tx.executeSql(
// //             `DELETE FROM chunks WHERE fileId = ?`,
// //             [fileId],
// //             () => resolve(),
// //             (_, err) => reject(err)
// //           );
// //         });
// //       });
// //       Logger.info(`Deleted all chunks for file ${fileId}`);
// //     } catch (error) {
// //       Logger.error(`Failed to delete chunks for ${fileId}`, error);
// //     }
// //   }
// // }

// // export const chunkStorage = new ChunkStorage();

// // import SQLite from "react-native-sqlite-storage";
// // import RNFS from "react-native-fs";
// // import { Logger } from "../utils/Logger";
// // import { DropShareError, ERROR_CODES } from "../utils/Error";
// // import { TEMP_CHUNKS_PATH, SAVE_PATH } from "../utils/FileSystemUtil";

// // SQLite.enablePromise(true);

// // interface ChunkInfo {
// //   fileId: string;
// //   chunkIndex: number;
// //   chunkSize: number;
// //   tempPath: string;
// // }

// // export class ChunkStorage {
// //   private db: SQLite.SQLiteDatabase | null = null;
// //   private static instance: ChunkStorage;

// //   private constructor() {}

// //   public static getInstance(): ChunkStorage {
// //     if (!ChunkStorage.instance) {
// //       ChunkStorage.instance = new ChunkStorage();
// //     }
// //     return ChunkStorage.instance;
// //   }

// //   async initialize(): Promise<void> {
// //     try {
// //       this.db = await SQLite.openDatabase({
// //         name: "chunkStorage.db",
// //         location: "default",
// //       });
// //       await this.db.executeSql(`
// //         CREATE TABLE IF NOT EXISTS chunks (
// //           fileId TEXT,
// //           chunkIndex INTEGER,
// //           chunkSize INTEGER,
// //           tempPath TEXT,
// //           PRIMARY KEY (fileId, chunkIndex)
// //         )
// //       `);
// //       Logger.info("ChunkStorage database initialized");
// //     } catch (error) {
// //       Logger.error("Failed to initialize ChunkStorage database", error);
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_WRITE_ERROR,
// //         "Failed to initialize database"
// //       );
// //     }
// //   }

// //   async storeChunk(
// //     fileId: string,
// //     chunkIndex: number,
// //     chunkSize: number,
// //     base64Data: string
// //   ): Promise<void> {
// //     if (!this.db) {
// //       await this.initialize();
// //     }
// //     const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}_${chunkIndex}`;
// //     try {
// //       if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
// //         await RNFS.mkdir(TEMP_CHUNKS_PATH);
// //       }
// //       await RNFS.writeFile(tempPath, base64Data, "base64");
// //       await this.db!.executeSql(
// //         "INSERT OR REPLACE INTO chunks (fileId, chunkIndex, chunkSize, tempPath) VALUES (?, ?, ?, ?)",
// //         [fileId, chunkIndex, chunkSize, tempPath]
// //       );
// //       Logger.info(`Stored chunk ${chunkIndex} for fileId ${fileId}`);
// //     } catch (error) {
// //       Logger.error(
// //         `Failed to store chunk ${chunkIndex} for fileId ${fileId}`,
// //         error
// //       );
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_WRITE_ERROR,
// //         `Failed to store chunk: ${
// //           error instanceof Error ? error.message : "Unknown error"
// //         }`
// //       );
// //     }
// //   }

// //   async getChunk(
// //     fileId: string,
// //     chunkIndex: number
// //   ): Promise<ChunkInfo | null> {
// //     if (!this.db) {
// //       await this.initialize();
// //     }
// //     try {
// //       const [results] = await this.db!.executeSql(
// //         "SELECT * FROM chunks WHERE fileId = ? AND chunkIndex = ?",
// //         [fileId, chunkIndex]
// //       );
// //       if (results.rows.length > 0) {
// //         const row = results.rows.item(0);
// //         return {
// //           fileId: row.fileId,
// //           chunkIndex: row.chunkIndex,
// //           chunkSize: row.chunkSize,
// //           tempPath: row.tempPath,
// //         };
// //       }
// //       return null;
// //     } catch (error) {
// //       Logger.error(
// //         `Failed to retrieve chunk ${chunkIndex} for fileId ${fileId}`,
// //         error
// //       );
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_ERROR,
// //         `Failed to retrieve chunk: ${
// //           error instanceof Error ? error.message : "Unknown error"
// //         }`
// //       );
// //     }
// //   }

// //   async getAvailableChunks(fileId: string): Promise<number[]> {
// //     if (!this.db) {
// //       await this.initialize();
// //     }
// //     try {
// //       const [results] = await this.db!.executeSql(
// //         "SELECT chunkIndex FROM chunks WHERE fileId = ? ORDER BY chunkIndex",
// //         [fileId]
// //       );
// //       const chunkIndices: number[] = [];
// //       for (let i = 0; i < results.rows.length; i++) {
// //         chunkIndices.push(results.rows.item(i).chunkIndex);
// //       }
// //       return chunkIndices;
// //     } catch (error) {
// //       Logger.error(
// //         `Failed to retrieve available chunks for fileId ${fileId}`,
// //         error
// //       );
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_ERROR,
// //         `Failed to retrieve available chunks: ${
// //           error instanceof Error ? error.message : "Unknown error"
// //         }`
// //       );
// //     }
// //   }

// //   async assembleFile(
// //     fileId: string,
// //     totalChunks: number,
// //     fileName: string
// //   ): Promise<string> {
// //     if (!this.db) {
// //       await this.initialize();
// //     }
// //     try {
// //       const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
// //       const finalPath = `${SAVE_PATH}/${sanitizedFileName}`;
// //       if (!(await RNFS.exists(SAVE_PATH))) {
// //         await RNFS.mkdir(SAVE_PATH);
// //       }
// //       await RNFS.writeFile(finalPath, "", "base64");
// //       for (let i = 0; i < totalChunks; i++) {
// //         const chunkInfo = await this.getChunk(fileId, i);
// //         if (!chunkInfo) {
// //           throw new DropShareError(
// //             ERROR_CODES.CORRUPTED_CHUNK,
// //             `Missing chunk ${i} for fileId ${fileId}`
// //           );
// //         }
// //         const base64Data = await RNFS.readFile(chunkInfo.tempPath, "base64");
// //         await RNFS.appendFile(finalPath, base64Data, "base64");
// //         await RNFS.unlink(chunkInfo.tempPath);
// //         await this.db!.executeSql(
// //           "DELETE FROM chunks WHERE fileId = ? AND chunkIndex = ?",
// //           [fileId, i]
// //         );
// //       }
// //       Logger.info(`Assembled file ${fileName} at ${finalPath}`);
// //       return finalPath;
// //     } catch (error) {
// //       Logger.error(
// //         `Failed to assemble file ${fileName} for fileId ${fileId}`,
// //         error
// //       );
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_WRITE_ERROR,
// //         `Failed to assemble file: ${
// //           error instanceof Error ? error.message : "Unknown error"
// //         }`
// //       );
// //     }
// //   }

// //   async clearChunks(fileId: string): Promise<void> {
// //     if (!this.db) {
// //       await this.initialize();
// //     }
// //     try {
// //       const [results] = await this.db!.executeSql(
// //         "SELECT tempPath FROM chunks WHERE fileId = ?",
// //         [fileId]
// //       );
// //       for (let i = 0; i < results.rows.length; i++) {
// //         const tempPath = results.rows.item(i).tempPath;
// //         if (await RNFS.exists(tempPath)) {
// //           await RNFS.unlink(tempPath);
// //         }
// //       }
// //       await this.db!.executeSql("DELETE FROM chunks WHERE fileId = ?", [
// //         fileId,
// //       ]);
// //       Logger.info(`Cleared chunks for fileId ${fileId}`);
// //     } catch (error) {
// //       Logger.error(`Failed to clear chunks for fileId ${fileId}`, error);
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_WRITE_ERROR,
// //         `Failed to clear chunks: ${
// //           error instanceof Error ? error.message : "Unknown error"
// //         }`
// //       );
// //     }
// //   }
// // }

// // previous works, but new added for more checks
// import SQLite from "react-native-sqlite-storage";
// import RNFS from "react-native-fs";
// import { Logger } from "../utils/Logger";
// import { DropShareError, ERROR_CODES } from "../utils/Error";
// import { TEMP_CHUNKS_PATH, SAVE_PATH } from "../utils/FileSystemUtil";

// SQLite.enablePromise(true);

// interface ChunkInfo {
//   fileId: string;
//   chunkIndex: number;
//   chunkSize: number;
//   tempPath: string;
// }

// export class ChunkStorage {
//   private db: SQLite.SQLiteDatabase | null = null;
//   private static instance: ChunkStorage;

//   private constructor() {}

//   public static getInstance(): ChunkStorage {
//     if (!ChunkStorage.instance) {
//       ChunkStorage.instance = new ChunkStorage();
//     }
//     return ChunkStorage.instance;
//   }

//   async initialize(): Promise<void> {
//     try {
//       this.db = await SQLite.openDatabase({
//         name: "chunkStorage.db",
//         location: "default",
//       });
//       await this.db.executeSql(`
//         CREATE TABLE IF NOT EXISTS chunks (
//           fileId TEXT,
//           chunkIndex INTEGER,
//           chunkSize INTEGER,
//           tempPath TEXT,
//           PRIMARY KEY (fileId, chunkIndex)
//         )
//       `);
//       Logger.info("ChunkStorage database initialized");
//     } catch (error) {
//       Logger.error("Failed to initialize ChunkStorage database", error);
//       throw new DropShareError(
//         ERROR_CODES.DATABASE_WRITE_ERROR,
//         "Failed to initialize database"
//       );
//     }
//   }

//   async storeChunk(
//     fileId: string,
//     chunkIndex: number,
//     chunkSize: number,
//     base64Data: string
//   ): Promise<void> {
//     if (!this.db) {
//       await this.initialize();
//     }
//     const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}_${chunkIndex}`;
//     try {
//       if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
//         await RNFS.mkdir(TEMP_CHUNKS_PATH);
//       }
//       await RNFS.writeFile(tempPath, base64Data, "base64");
//       await this.db!.executeSql(
//         "INSERT OR REPLACE INTO chunks (fileId, chunkIndex, chunkSize, tempPath) VALUES (?, ?, ?, ?)",
//         [fileId, chunkIndex, chunkSize, tempPath]
//       );
//       Logger.info(`Stored chunk ${chunkIndex} for fileId ${fileId}`);
//     } catch (error) {
//       const errorMessage =
//         error instanceof Error ? error.message : "Unknown error";
//       Logger.error(
//         `Failed to store chunk ${chunkIndex} for fileId ${fileId}: ${errorMessage}`,
//         error
//       );
//       const errorCode = errorMessage.includes("no space")
//         ? ERROR_CODES.FILE_IO_ERROR
//         : ERROR_CODES.DATABASE_WRITE_ERROR;
//       throw new DropShareError(
//         errorCode,
//         `Failed to store chunk: ${errorMessage}`
//       );
//     }
//   }

//   async getChunk(
//     fileId: string,
//     chunkIndex: number
//   ): Promise<ChunkInfo | null> {
//     if (!this.db) {
//       await this.initialize();
//     }
//     try {
//       const [results] = await this.db!.executeSql(
//         "SELECT * FROM chunks WHERE fileId = ? AND chunkIndex = ?",
//         [fileId, chunkIndex]
//       );
//       if (results.rows.length > 0) {
//         const row = results.rows.item(0);
//         return {
//           fileId: row.fileId,
//           chunkIndex: row.chunkIndex,
//           chunkSize: row.chunkSize,
//           tempPath: row.tempPath,
//         };
//       }
//       return null;
//     } catch (error) {
//       Logger.error(
//         `Failed to retrieve chunk ${chunkIndex} for fileId ${fileId}`,
//         error
//       );
//       throw new DropShareError(
//         ERROR_CODES.DATABASE_ERROR,
//         `Failed to retrieve chunk: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`
//       );
//     }
//   }

//   async getAvailableChunks(fileId: string): Promise<number[]> {
//     if (!this.db) {
//       await this.initialize();
//     }
//     try {
//       const [results] = await this.db!.executeSql(
//         "SELECT chunkIndex FROM chunks WHERE fileId = ? ORDER BY chunkIndex",
//         [fileId]
//       );
//       const chunkIndices: number[] = [];
//       for (let i = 0; i < results.rows.length; i++) {
//         chunkIndices.push(results.rows.item(i).chunkIndex);
//       }
//       return chunkIndices;
//     } catch (error) {
//       Logger.error(
//         `Failed to retrieve available chunks for fileId ${fileId}`,
//         error
//       );
//       throw new DropShareError(
//         ERROR_CODES.DATABASE_ERROR,
//         `Failed to retrieve available chunks: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`
//       );
//     }
//   }

//   async assembleFile(
//     fileId: string,
//     totalChunks: number,
//     fileName: string
//   ): Promise<string> {
//     if (!this.db) {
//       await this.initialize();
//     }
//     try {
//       const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
//       const finalPath = `${SAVE_PATH}/${sanitizedFileName}`;
//       if (!(await RNFS.exists(SAVE_PATH))) {
//         await RNFS.mkdir(SAVE_PATH);
//       }
//       await RNFS.writeFile(finalPath, "", "base64");
//       for (let i = 0; i < totalChunks; i++) {
//         const chunkInfo = await this.getChunk(fileId, i);
//         if (!chunkInfo) {
//           throw new DropShareError(
//             ERROR_CODES.CORRUPTED_CHUNK,
//             `Missing chunk ${i} for fileId ${fileId}`
//           );
//         }
//         const base64Data = await RNFS.readFile(chunkInfo.tempPath, "base64");
//         await RNFS.appendFile(finalPath, base64Data, "base64");
//         await RNFS.unlink(chunkInfo.tempPath);
//         await this.db!.executeSql(
//           "DELETE FROM chunks WHERE fileId = ? AND chunkIndex = ?",
//           [fileId, i]
//         );
//       }
//       Logger.info(`Assembled file ${fileName} at ${finalPath}`);
//       return finalPath;
//     } catch (error) {
//       const errorMessage =
//         error instanceof Error ? error.message : "Unknown error";
//       Logger.error(
//         `Failed to assemble file ${fileName} for fileId ${fileId}: ${errorMessage}`,
//         error
//       );
//       const errorCode = errorMessage.includes("no space")
//         ? ERROR_CODES.FILE_IO_ERROR
//         : ERROR_CODES.DATABASE_WRITE_ERROR;
//       throw new DropShareError(
//         errorCode,
//         `Failed to assemble file: ${errorMessage}`
//       );
//     }
//   }

//   async clearChunks(fileId: string): Promise<void> {
//     if (!this.db) {
//       await this.initialize();
//     }
//     try {
//       const [results] = await this.db!.executeSql(
//         "SELECT tempPath FROM chunks WHERE fileId = ?",
//         [fileId]
//       );
//       for (let i = 0; i < results.rows.length; i++) {
//         const tempPath = results.rows.item(i).tempPath;
//         if (await RNFS.exists(tempPath)) {
//           await RNFS.unlink(tempPath);
//         }
//       }
//       await this.db!.executeSql("DELETE FROM chunks WHERE fileId = ?", [
//         fileId,
//       ]);
//       Logger.info(`Cleared chunks for fileId ${fileId}`);
//     } catch (error) {
//       Logger.error(`Failed to clear chunks for fileId ${fileId}`, error);
//       throw new DropShareError(
//         ERROR_CODES.DATABASE_WRITE_ERROR,
//         `Failed to clear chunks: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`
//       );
//     }
//   }
// }

// import { Logger } from "../utils/Logger";
// import SQLite from "react-native-sqlite-storage";
// import RNFS from "react-native-fs";

// SQLite.DEBUG(true);
// SQLite.enablePromise(true);

// interface ChunkData {
//   fileId: string;
//   chunkIndex: number;
//   chunkSize: number;
//   chunkData: string;
//   isSent: boolean;
// }

// export class ChunkStorage {
//   private static instance: ChunkStorage;
//   private db: SQLite.SQLiteDatabase | null = null;
//   private dbName = "DropShareChunks.db";

//   private constructor() {}

//   public static getInstance(): ChunkStorage {
//     if (!ChunkStorage.instance) {
//       ChunkStorage.instance = new ChunkStorage();
//     }
//     return ChunkStorage.instance;
//   }

//   async init(): Promise<void> {
//     try {
//       this.db = await SQLite.openDatabase({
//         name: this.dbName,
//         location: "default",
//       });
//       // Create table if it doesn't exist
//       await this.db.executeSql(`
//         CREATE TABLE IF NOT EXISTS chunks (
//           fileId TEXT,
//           chunkIndex INTEGER,
//           chunkSize INTEGER,
//           chunkData TEXT,
//           isSent BOOLEAN DEFAULT 0,
//           PRIMARY KEY (fileId, chunkIndex)
//         )
//       `);
//       // Check if isSent column exists and add it if not
//       const [pragmaResults] = await this.db.executeSql(
//         `PRAGMA table_info(chunks)`
//       );
//       const hasIsSent = pragmaResults.rows
//         .raw()
//         .some((column: any) => column.name === "isSent");
//       if (!hasIsSent) {
//         await this.db.executeSql(
//           `ALTER TABLE chunks ADD COLUMN isSent BOOLEAN DEFAULT 0`
//         );
//         Logger.info("Added isSent column to chunks table");
//       }
//       Logger.info("ChunkStorage database initialized");
//     } catch (error) {
//       Logger.error("Failed to initialize ChunkStorage database", error);
//       throw error;
//     }
//   }

//   public async ensureInitialized(): Promise<void> {
//     if (!this.isInitialized || !this.db) {
//       await this.initialize();
//     }
//     if (!this.db) {
//       throw new DropShareError(
//         ERROR_CODES.DATABASE_ERROR,
//         "Database not initialized"
//       );
//     }
//   }

//   async storeChunk(
//     fileId: string,
//     chunkIndex: number,
//     chunkSize: number,
//     chunkData: string,
//     isSent: boolean = false
//   ): Promise<void> {
//     if (!this.db) {
//       throw new Error("Database not initialized");
//     }
//     try {
//       await this.db.executeSql(
//         `INSERT OR REPLACE INTO chunks (fileId, chunkIndex, chunkSize, chunkData, isSent)
//          VALUES (?, ?, ?, ?, ?)`,
//         [fileId, chunkIndex, chunkSize, chunkData, isSent ? 1 : 0]
//       );
//       Logger.info(`Stored chunk ${chunkIndex} for fileId ${fileId}`);
//     } catch (error) {
//       Logger.error(
//         `Failed to store chunk ${chunkIndex} for fileId ${fileId}`,
//         error
//       );
//       throw error;
//     }
//   }

//   async markChunkAsSent(fileId: string, chunkIndex: number): Promise<void> {
//     if (!this.db) {
//       throw new Error("Database not initialized");
//     }
//     try {
//       await this.db.executeSql(
//         `UPDATE chunks SET isSent = 1 WHERE fileId = ? AND chunkIndex = ?`,
//         [fileId, chunkIndex]
//       );
//       Logger.info(`Marked chunk ${chunkIndex} as sent for fileId ${fileId}`);
//     } catch (error) {
//       Logger.error(
//         `Failed to mark chunk ${chunkIndex} as sent for fileId ${fileId}`,
//         error
//       );
//       throw error;
//     }
//   }

//   async getAvailableChunks(fileId: string): Promise<number[]> {
//     if (!this.db) {
//       throw new Error("Database not initialized");
//     }
//     try {
//       const [results] = await this.db.executeSql(
//         `SELECT chunkIndex FROM chunks WHERE fileId = ? AND isSent = 0`,
//         [fileId]
//       );
//       const chunks: number[] = [];
//       for (let i = 0; i < results.rows.length; i++) {
//         chunks.push(results.rows.item(i).chunkIndex);
//       }
//       Logger.info(
//         `Retrieved ${chunks.length} available chunks for fileId ${fileId}`
//       );
//       return chunks;
//     } catch (error) {
//       Logger.error(
//         `Failed to retrieve available chunks for fileId ${fileId}`,
//         error
//       );
//       throw new Error(
//         `Failed to retrieve available chunks: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`
//       );
//     }
//   }

//   async getSentChunks(fileId: string): Promise<number[]> {
//     if (!this.db) {
//       throw new Error("Database not initialized");
//     }
//     try {
//       const [results] = await this.db.executeSql(
//         `SELECT chunkIndex FROM chunks WHERE fileId = ? AND isSent = 1`,
//         [fileId]
//       );
//       const chunks: number[] = [];
//       for (let i = 0; i < results.rows.length; i++) {
//         chunks.push(results.rows.item(i).chunkIndex);
//       }
//       Logger.info(
//         `Retrieved ${chunks.length} sent chunks for fileId ${fileId}`
//       );
//       return chunks;
//     } catch (error) {
//       Logger.error(
//         `Failed to retrieve sent chunks for fileId ${fileId}`,
//         error
//       );
//       throw new Error(
//         `Failed to retrieve sent chunks: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`
//       );
//     }
//   }

//   async getChunk(
//     fileId: string,
//     chunkIndex: number
//   ): Promise<ChunkData | null> {
//     if (!this.db) {
//       throw new Error("Database not initialized");
//     }
//     try {
//       const [results] = await this.db.executeSql(
//         `SELECT fileId, chunkIndex, chunkSize, chunkData, isSent FROM chunks WHERE fileId = ? AND chunkIndex = ?`,
//         [fileId, chunkIndex]
//       );
//       if (results.rows.length > 0) {
//         const item = results.rows.item(0);
//         return {
//           fileId: item.fileId,
//           chunkIndex: item.chunkIndex,
//           chunkSize: item.chunkSize,
//           chunkData: item.chunkData,
//           isSent: !!item.isSent,
//         };
//       }
//       return null;
//     } catch (error) {
//       Logger.error(
//         `Failed to retrieve chunk ${chunkIndex} for fileId ${fileId}`,
//         error
//       );
//       throw error;
//     }
//   }

//   async assembleFile(
//     fileId: string,
//     totalChunks: number,
//     fileName: string
//   ): Promise<string> {
//     if (!this.db) {
//       throw new Error("Database not initialized");
//     }
//     try {
//       const chunks: ChunkData[] = [];
//       for (let i = 0; i < totalChunks; i++) {
//         const chunk = await this.getChunk(fileId, i);
//         if (!chunk) {
//           throw new Error(`Missing chunk ${i} for fileId ${fileId}`);
//         }
//         chunks.push(chunk);
//       }

//       const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
//       await RNFS.unlink(filePath).catch(() => {});
//       for (const chunk of chunks) {
//         await RNFS.appendFile(filePath, chunk.chunkData, "base64");
//       }

//       Logger.info(`Assembled file ${fileName} at ${filePath}`);
//       return filePath;
//     } catch (error) {
//       Logger.error(
//         `Failed to assemble file ${fileName} for fileId ${fileId}`,
//         error
//       );
//       throw error;
//     }
//   }

//   async clearChunks(fileId: string): Promise<void> {
//     if (!this.db) {
//       throw new Error("Database not initialized");
//     }
//     try {
//       await this.db.executeSql(`DELETE FROM chunks WHERE fileId = ?`, [fileId]);
//       Logger.info(`Cleared chunks for fileId ${fileId}`);
//     } catch (error) {
//       Logger.error(`Failed to clear chunks for fileId ${fileId}`, error);
//       throw error;
//     }
//   }

//   async close(): Promise<void> {
//     if (this.db) {
//       try {
//         await this.db.close();
//         Logger.info("ChunkStorage database closed");
//       } catch (error) {
//         Logger.error("Failed to close ChunkStorage database", error);
//         throw error;
//       }
//       this.db = null;
//     }
//   }
// }

import SQLite from "react-native-sqlite-storage";
import RNFS from "react-native-fs";
import { Logger } from "../utils/Logger";
import { DropShareError, ERROR_CODES } from "../utils/Error";
import { TEMP_CHUNKS_PATH, SAVE_PATH } from "../utils/FileSystemUtil";

SQLite.enablePromise(true);

interface ChunkInfo {
  fileId: string;
  chunkIndex: number;
  chunkSize: number;
  tempPath: string;
}

export class ChunkStorage {
  private db: SQLite.SQLiteDatabase | null = null;
  private static instance: ChunkStorage;

  private constructor() {}

  public static getInstance(): ChunkStorage {
    if (!ChunkStorage.instance) {
      ChunkStorage.instance = new ChunkStorage();
    }
    return ChunkStorage.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.db = await SQLite.openDatabase({
        name: "chunkStorage.db",
        location: "default",
      });
      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS chunks (
          fileId TEXT,
          chunkIndex INTEGER,
          chunkSize INTEGER,
          tempPath TEXT,
          PRIMARY KEY (fileId, chunkIndex)
        )
      `);
      Logger.info("ChunkStorage database initialized");
    } catch (error) {
      Logger.error("Failed to initialize ChunkStorage database", error);
      throw new DropShareError(
        ERROR_CODES.DATABASE_WRITE_ERROR,
        "Failed to initialize database"
      );
    }
  }

  async storeChunk(
    fileId: string,
    chunkIndex: number,
    chunkSize: number,
    base64Data: string
  ): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }
    const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}_${chunkIndex}`;
    try {
      if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
        await RNFS.mkdir(TEMP_CHUNKS_PATH);
      }
      await RNFS.writeFile(tempPath, base64Data, "base64");
      await this.db!.executeSql(
        "INSERT OR REPLACE INTO chunks (fileId, chunkIndex, chunkSize, tempPath) VALUES (?, ?, ?, ?)",
        [fileId, chunkIndex, chunkSize, tempPath]
      );
      Logger.info(`Stored chunk ${chunkIndex} for fileId ${fileId}`);
    } catch (error) {
      Logger.error(
        `Failed to store chunk ${chunkIndex} for fileId ${fileId}`,
        error
      );
      throw new DropShareError(
        ERROR_CODES.DATABASE_WRITE_ERROR,
        `Failed to store chunk: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getChunk(
    fileId: string,
    chunkIndex: number
  ): Promise<ChunkInfo | null> {
    if (!this.db) {
      await this.initialize();
    }
    try {
      const [results] = await this.db!.executeSql(
        "SELECT * FROM chunks WHERE fileId = ? AND chunkIndex = ?",
        [fileId, chunkIndex]
      );
      if (results.rows.length > 0) {
        const row = results.rows.item(0);
        return {
          fileId: row.fileId,
          chunkIndex: row.chunkIndex,
          chunkSize: row.chunkSize,
          tempPath: row.tempPath,
        };
      }
      return null;
    } catch (error) {
      Logger.error(
        `Failed to retrieve chunk ${chunkIndex} for fileId ${fileId}`,
        error
      );
      throw new DropShareError(
        ERROR_CODES.DATABASE_ERROR,
        `Failed to retrieve chunk: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getAvailableChunks(fileId: string): Promise<number[]> {
    if (!this.db) {
      await this.initialize();
    }
    try {
      const [results] = await this.db!.executeSql(
        "SELECT chunkIndex FROM chunks WHERE fileId = ? ORDER BY chunkIndex",
        [fileId]
      );
      const chunkIndices: number[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        chunkIndices.push(results.rows.item(i).chunkIndex);
      }
      return chunkIndices;
    } catch (error) {
      Logger.error(
        `Failed to retrieve available chunks for fileId ${fileId}`,
        error
      );
      throw new DropShareError(
        ERROR_CODES.DATABASE_ERROR,
        `Failed to retrieve available chunks: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async assembleFile(
    fileId: string,
    totalChunks: number,
    fileName: string
  ): Promise<string> {
    if (!this.db) {
      await this.initialize();
    }
    try {
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      const finalPath = `${SAVE_PATH}/${sanitizedFileName}_${Date.now()}`; // Avoid overwriting
      if (!(await RNFS.exists(SAVE_PATH))) {
        await RNFS.mkdir(SAVE_PATH);
      }
      await RNFS.writeFile(finalPath, "");
      for (let i = 0; i < totalChunks; i++) {
        const chunkInfo = await this.getChunk(fileId, i);
        if (!chunkInfo) {
          throw new DropShareError(
            ERROR_CODES.CORRUPTED_CHUNK,
            `Missing chunk ${i} for fileId ${fileId}`
          );
        }
        const chunkData = await RNFS.readFile(chunkInfo.tempPath, "base64");
        const chunk = Buffer.from(chunkData, "base64");
        await RNFS.appendFile(finalPath, chunk.toString("base64"), "base64");
        await RNFS.unlink(chunkInfo.tempPath);
        await this.db!.executeSql(
          "DELETE FROM chunks WHERE fileId = ? AND chunkIndex = ?",
          [fileId, i]
        );
      }
      Logger.info(`Assembled file ${fileName} at ${finalPath}`);
      return finalPath;
    } catch (error) {
      Logger.error(
        `Failed to assemble file ${fileName} for fileId ${fileId}`,
        error
      );
      throw new DropShareError(
        ERROR_CODES.DATABASE_WRITE_ERROR,
        `Failed to assemble file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async clearChunks(fileId: string): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }
    try {
      const [results] = await this.db!.executeSql(
        "SELECT tempPath FROM chunks WHERE fileId = ?",
        [fileId]
      );
      for (let i = 0; i < results.rows.length; i++) {
        const tempPath = results.rows.item(i).tempPath;
        try {
          if (await RNFS.exists(tempPath)) {
            await RNFS.unlink(tempPath);
          }
        } catch (error) {
          Logger.warn(
            `Failed to delete chunk file ${tempPath} for fileId ${fileId}: ${error}`,
          );
        }
      }
      await this.db!.executeSql("DELETE FROM chunks WHERE fileId = ?", [
        fileId,
      ]);
      Logger.info(`Cleared chunks for fileId ${fileId}`);
    } catch (error) {
      Logger.error(`Failed to clear chunks for fileId ${fileId}`, error);
      throw new DropShareError(
        ERROR_CODES.DATABASE_WRITE_ERROR,
        `Failed to clear chunks: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
