import SQLite from "react-native-sqlite-storage";
import { Logger } from "../utils/Logger";
import { DropShareError, ERROR_CODES } from "../utils/Error";
import RNFS from "react-native-fs";

SQLite.enablePromise(true);

const DB_NAME = "DropShareChunks.db";
const TABLE_NAME = "file_transfers";
const EXPIRATION_DURATION = 24 * 60 * 60 * 1000;

interface FileTransferRecord {
  fileId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  chunkSize: number;
  lastChunkIndex: number;
  tempPath: string;
  createdAt: number;
}

export class ChunkStorage {
  private static db: SQLite.SQLiteDatabase | null = null;

  static async initialize(): Promise<void> {
    try {
      this.db = await SQLite.openDatabase({
        name: DB_NAME,
        location: "default",
      });

      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          fileId TEXT PRIMARY KEY,
          fileName TEXT NOT NULL,
          fileSize INTEGER NOT NULL,
          totalChunks INTEGER NOT NULL,
          chunkSize INTEGER NOT NULL,
          lastChunkIndex INTEGER NOT NULL,
          tempPath TEXT NOT NULL,
          createdAt INTEGER NOT NULL
        )
      `);
      Logger.info("ChunkStorage database initialized");
    } catch (error) {
      Logger.error("Failed to initialize ChunkStorage database", error);
      throw new DropShareError(
        ERROR_CODES.DATABASE_ERROR,
        "Failed to initialize database"
      );
    }
  }

  static async storeTransfer(
    fileId: string,
    fileName: string,
    fileSize: number,
    totalChunks: number,
    chunkSize: number,
    lastChunkIndex: number,
    tempPath: string
  ): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    try {
      const createdAt = Date.now();
      await this.db!.executeSql(
        `
        INSERT OR REPLACE INTO ${TABLE_NAME} (
          fileId, fileName, fileSize, totalChunks, chunkSize, lastChunkIndex, tempPath, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          fileId,
          fileName,
          fileSize,
          totalChunks,
          chunkSize,
          lastChunkIndex,
          tempPath,
          createdAt,
        ]
      );
      Logger.info(`Stored transfer metadata for fileId ${fileId}`);
    } catch (error) {
      Logger.error(`Failed to store transfer metadata for ${fileId}`, error);
      throw new DropShareError(
        ERROR_CODES.DATABASE_WRITE_ERROR,
        "Failed to store transfer metadata"
      );
    }
  }

  static async getTransfer(fileId: string): Promise<FileTransferRecord | null> {
    if (!this.db) {
      await this.initialize();
    }

    try {
      const [results] = await this.db!.executeSql(
        `SELECT * FROM ${TABLE_NAME} WHERE fileId = ?`,
        [fileId]
      );

      if (results.rows.length > 0) {
        const record = results.rows.item(0);
        if (Date.now() - record.createdAt > EXPIRATION_DURATION) {
          await this.deleteTransfer(fileId);
          return null;
        }
        return record as FileTransferRecord;
      }
      return null;
    } catch (error) {
      Logger.error(`Failed to retrieve transfer for ${fileId}`, error);
      throw new DropShareError(
        ERROR_CODES.DATABASE_ERROR,
        "Failed to retrieve transfer metadata"
      );
    }
  }

  static async deleteTransfer(fileId: string): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    try {
      const record = await this.getTransfer(fileId);
      if (record && (await RNFS.exists(record.tempPath))) {
        await RNFS.unlink(record.tempPath);
        Logger.info(`Deleted temp file ${record.tempPath}`);
      }

      await this.db!.executeSql(`DELETE FROM ${TABLE_NAME} WHERE fileId = ?`, [
        fileId,
      ]);
      Logger.info(`Deleted transfer metadata for fileId ${fileId}`);
    } catch (error) {
      Logger.error(`Failed to delete transfer for ${fileId}`, error);
      throw new DropShareError(
        ERROR_CODES.DATABASE_ERROR,
        "Failed to delete transfer metadata"
      );
    }
  }

  static async cleanupExpired(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    try {
      const expirationTime = Date.now() - EXPIRATION_DURATION;
      const [results] = await this.db!.executeSql(
        `SELECT fileId, tempPath FROM ${TABLE_NAME} WHERE createdAt < ?`,
        [expirationTime]
      );

      for (let i = 0; i < results.rows.length; i++) {
        const { tempPath } = results.rows.item(i);
        if (await RNFS.exists(tempPath)) {
          await RNFS.unlink(tempPath);
          Logger.info(`Deleted expired temp file ${tempPath}`);
        }
      }

      await this.db!.executeSql(
        `DELETE FROM ${TABLE_NAME} WHERE createdAt < ?`,
        [expirationTime]
      );
      Logger.info("Cleaned up expired transfers");
    } catch (error) {
      Logger.error("Failed to clean up expired transfers", error);
      throw new DropShareError(
        ERROR_CODES.DATABASE_ERROR,
        "Failed to clean up expired transfers"
      );
    }
  }
}
