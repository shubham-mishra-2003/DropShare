import { app } from "electron";
import path from "path";
import fs from "fs/promises";
import { Buffer } from "buffer";
import SHA256 from "crypto-js/sha256";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { DropShareError, ERROR_CODES } from "../renderer/src/utils/Errors";
import crypto from "crypto";

const DB_NAME = path.join(app.getPath("userData"), "chunks.db");
const CHUNK_DIR = path.join(app.getPath("userData"), "chunks");
const OUTPUT_DIR = path.join(app.getPath("userData"), "output");
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

interface TransferRecord {
  fileId: string;
  fileName: string;
  totalSize: number;
  chunkSize: number;
  lastChunkIndex: number;
  totalChunks: number;
  status: "in_progress" | "completed" | "interrupted";
  senderIp: string;
  timestamp: number;
  aesKey?: string;
  iv?: string;
}

// interface ChunkRecord {
//   fileId: string;
//   chunkIndex: number;
//   chunkHash: string;
// }

export class ChunkStorage {
  private db: sqlite3.Database;

  constructor() {
    this.db = new sqlite3.Database(DB_NAME);
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await fs.mkdir(CHUNK_DIR, { recursive: true });
      await fs.mkdir(OUTPUT_DIR, { recursive: true });

      this.db.run(`
        CREATE TABLE IF NOT EXISTS chunks (
          id TEXT PRIMARY KEY,
          file_id TEXT,
          index INTEGER,
          size INTEGER,
          hash TEXT,
          path TEXT
        )
      `);

      await this.cleanupOldChunks();
      console.log("ChunkStorage initialized successfully");
    } catch (error) {
      console.error("Failed to initialize ChunkStorage:", error);
      throw DropShareError.from(
        error,
        ERROR_CODES.DATABASE_ERROR,
        "ChunkStorage initialization failed",
      );
    }
  }

  // Helper to mimic React Native's DropShareError.from
  static DropShareError = {
    from: (error: any, code: string, message: string): DropShareError => {
      const err = new DropShareError(
        code,
        `${message}: ${error.message || error}`,
      );
      return err;
    },
  };

  generateFileId(
    senderIp: string,
    fileName: string,
    timestamp: number,
  ): string {
    const rawId = `${senderIp}-${fileName}-${timestamp}`;
    const fileId = SHA256(rawId).toString();
    console.log(`Generated fileId: ${fileId}`);
    return fileId;
  }

  async storeChunk(
    fileId: string,
    index: number,
    data: Buffer,
  ): Promise<string> {
    const id = crypto.randomUUID();
    const hash = crypto.createHash("sha256").update(data).digest("hex");
    const chunkPath = path.join(CHUNK_DIR, `${id}.chunk`);

    await fs.writeFile(chunkPath, data);

    this.db.run(
      "INSERT INTO chunks (id, file_id, index, size, hash, path) VALUES (?, ?, ?, ?, ?, ?)",
      [id, fileId, index, data.length, hash, chunkPath],
    );

    return id;
  }

  async getChunk(id: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT path FROM chunks WHERE id = ?",
        [id],
        async (err, row) => {
          if (err) reject(err);
          else if (!row) reject(new Error("Chunk not found"));
          else {
            try {
              const data = await fs.readFile(row.path as string);
              resolve(data);
            } catch (err) {
              reject(err);
            }
          }
        },
      );
    });
  }

  async deleteChunk(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT path FROM chunks WHERE id = ?",
        [id],
        async (err, row) => {
          if (err) reject(err);
          else if (row) {
            try {
              await fs.unlink(row.path);
              this.db.run("DELETE FROM chunks WHERE id = ?", [id]);
              resolve();
            } catch (err) {
              reject(err);
            }
          } else {
            resolve();
          }
        },
      );
    });
  }

  async getChunksForFile(
    fileId: string,
  ): Promise<Array<{ id: string; index: number }>> {
    return new Promise((resolve, reject) => {
      this.db.all(
        "SELECT id, index FROM chunks WHERE file_id = ? ORDER BY index",
        [fileId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        },
      );
    });
  }

  async saveTransferRecord(record: TransferRecord): Promise<void> {
    if (!this.db) {
      throw new DropShareError(
        ERROR_CODES.DATABASE_ERROR,
        "Database not initialized",
      );
    }
    try {
      await this.db.run(
        `INSERT OR REPLACE INTO transfers (
          fileId, fileName, totalSize, chunkSize, lastChunkIndex, totalChunks, status, senderIp, timestamp, aesKey, iv
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.fileId,
          record.fileName,
          record.totalSize,
          record.chunkSize,
          record.lastChunkIndex,
          record.totalChunks,
          record.status,
          record.senderIp,
          record.timestamp,
          record.aesKey || "",
          record.iv || "",
        ],
      );
      console.log(
        `📝 Saved transfer record for ${record.fileId}: ${record.totalChunks} chunks expected`,
      );
    } catch (error) {
      console.error(`Failed to save transfer record ${record.fileId}:`, error);
      throw DropShareError.from(
        error,
        ERROR_CODES.DATABASE_ERROR,
        `Failed to save transfer record for ${record.fileId}`,
      );
    }
  }

  async getTransferRecord(fileId: string): Promise<TransferRecord | null> {
    if (!this.db) {
      throw new DropShareError(
        ERROR_CODES.DATABASE_ERROR,
        "Database not initialized",
      );
    }
    try {
      const result = await this.db.get(
        "SELECT * FROM transfers WHERE fileId = ?",
        [fileId],
      );
      return result || null;
    } catch (error) {
      console.error(`Failed to get transfer record ${fileId}:`, error);
      return null;
    }
  }

  async updateLastChunkIndex(
    fileId: string,
    lastChunkIndex: number,
    status?: string,
  ): Promise<void> {
    if (!this.db) {
      throw new DropShareError(
        ERROR_CODES.DATABASE_ERROR,
        "Database not initialized",
      );
    }
    try {
      const updates = status
        ? "lastChunkIndex = ?, status = ?"
        : "lastChunkIndex = ?";
      const values = status
        ? [lastChunkIndex, status, fileId]
        : [lastChunkIndex, fileId];
      await this.db.run(
        `UPDATE transfers SET ${updates} WHERE fileId = ?`,
        values,
      );
      console.log(
        `🔄 Updated ${fileId} to lastChunkIndex=${lastChunkIndex}${status ? `, status=${status}` : ""}`,
      );
    } catch (error) {
      console.error(`Failed to update chunk index for ${fileId}:`, error);
      throw DropShareError.from(
        error,
        ERROR_CODES.DATABASE_ERROR,
        "Failed to update chunk index",
      );
    }
  }

  async cleanupOldChunks(): Promise<void> {
    if (!this.db) return;
    try {
      const now = Date.now();
      const oldFileIds = await this.db.all(
        'SELECT fileId FROM transfers WHERE timestamp < ? AND status != "completed"',
        [now - TWENTY_FOUR_HOURS],
      );
      for (const { fileId } of oldFileIds) {
        await this.deleteTransfer(fileId);
      }
      console.log(`🗑️ Cleaned up ${oldFileIds.length} old transfers`);
    } catch (error) {
      console.error("Failed to cleanup old chunks:", error);
    }
  }

  async deleteTransfer(fileId: string): Promise<void> {
    if (!this.db) return;
    try {
      await this.db.run("DELETE FROM transfers WHERE fileId = ?", [fileId]);
      const files = await fs.readdir(CHUNK_DIR);
      for (const file of files) {
        if (file.startsWith(`${fileId}_`)) {
          await fs.unlink(path.join(CHUNK_DIR, file));
        }
      }
      console.log(`🗑️ Deleted transfer ${fileId}`);
    } catch (error) {
      console.error(`Failed to delete transfer ${fileId}:`, error);
      throw DropShareError.from(
        error,
        ERROR_CODES.FILE_IO_ERROR,
        "Failed to delete transfer",
      );
    }
  }

  async assembleFile(fileId: string, fileName: string): Promise<string> {
    try {
      const record = await this.getTransferRecord(fileId);
      if (!record) {
        throw new DropShareError(
          ERROR_CODES.DATABASE_ERROR,
          `No transfer record found for ${fileId}`,
        );
      }
      console.log(
        `🔍 Assembling ${fileId}: lastChunkIndex=${record.lastChunkIndex}, totalChunks=${record.totalChunks}`,
      );

      if (record.lastChunkIndex + 1 < record.totalChunks) {
        console.warn(
          `⚠️ Incomplete transfer for ${fileId}: ${record.lastChunkIndex + 1}/${record.totalChunks} chunks received`,
        );
        throw new DropShareError(
          ERROR_CODES.CHUNK_MISSING,
          `Incomplete transfer for ${fileId}`,
        );
      }

      const buffers: Buffer[] = [];
      for (let i = 0; i < record.totalChunks; i++) {
        const chunk = await this.getChunk(i.toString());
        if (!chunk) {
          throw new DropShareError(
            ERROR_CODES.CHUNK_MISSING,
            `Missing chunk ${i} for ${fileId}`,
          );
        }
        buffers.push(chunk);
      }

      const fullFile = Buffer.concat(buffers);
      let savePath = path.join(OUTPUT_DIR, fileName);
      let counter = 1;
      const [name, ext] = fileName.split(/(\.[^.]+)$/);
      while (
        await fs
          .access(savePath)
          .then(() => true)
          .catch(() => false)
      ) {
        savePath = path.join(OUTPUT_DIR, `${name}-${counter}${ext || ""}`);
        counter++;
      }

      await fs.writeFile(savePath, fullFile);
      await this.updateLastChunkIndex(
        fileId,
        record.lastChunkIndex,
        "completed",
      );
      await this.deleteTransfer(fileId);
      console.log(`✅ Assembled file ${fileId} at ${savePath}`);
      return savePath;
    } catch (error) {
      console.error(`Failed to assemble file ${fileId}:`, error);
      throw DropShareError.from(
        error,
        ERROR_CODES.FILE_IO_ERROR,
        "Failed to assemble file",
      );
    }
  }
}

export const chunkStorage = new ChunkStorage();
