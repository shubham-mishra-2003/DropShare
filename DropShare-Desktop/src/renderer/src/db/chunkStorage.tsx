// import { create } from "zustand";
// import { Buffer } from "buffer";

// interface ChunkState {
//   chunkStore: {
//     id: string | null;
//     name: string;
//     totalChunks: number;
//     chunksArray: Buffer[];
//   } | null;
//   currentChunkSet: {
//     id: string | null;
//     totalChunks: number;
//     chunkArray: Buffer[];
//   } | null;

//   setChunkStore: (chunkStore: any) => void;
//   resetChunkStore: () => void;
//   setCurrentChunkSet: (chunkChunkSet: any) => void;
//   resetCurrentChunkSet: () => void;
// }

// export const useChunkStore = create<ChunkState>((set) => ({
//   chunkStore: null,
//   currentChunkSet: null,
//   setChunkStore: (chunkStore) => set(() => ({ chunkStore })),
//   resetChunkStore: () => set(() => ({ chunkStore: null })),
//   setCurrentChunkSet: (currentChunkSet) => set(() => ({ currentChunkSet })),
//   resetCurrentChunkSet: () => set(() => ({ currentChunkSet: null })),
// }));

import { app } from "electron";
import path from "path";
import fs from "fs/promises";
import { Buffer } from "buffer";
import SHA256 from "crypto-js/sha256";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const DB_NAME = "DropShareChunks.db";
const CHUNK_DIR = path.join(app.getPath("appData"), "DropShareChunks");
const OUTPUT_DIR = path.join(app.getPath("downloads"), "DropShare");
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
}

class ChunkStorage {
  private db: any = null;

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(CHUNK_DIR, { recursive: true });
      await fs.mkdir(OUTPUT_DIR, { recursive: true });

      const dbPath = path.join(app.getPath("userData"), DB_NAME);
      this.db = await open({
        filename: dbPath,
        driver: sqlite3.Database,
      });

      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS transfers (
          fileId TEXT PRIMARY KEY,
          fileName TEXT NOT NULL,
          totalSize INTEGER NOT NULL,
          chunkSize INTEGER NOT NULL,
          lastChunkIndex INTEGER NOT NULL,
          totalChunks INTEGER NOT NULL,
          status TEXT NOT NULL,
          senderIp TEXT NOT NULL,
          timestamp INTEGER NOT NULL
        )
      `);
      await this.cleanupOldChunks();
    } catch (error) {
      console.error("Failed to initialize ChunkStorage:", error);
      throw new Error(`ChunkStorage initialization failed: ${error}`);
    }
  }

  generateFileId(
    senderIp: string,
    fileName: string,
    timestamp: number,
  ): string {
    const rawId = `${senderIp}-${fileName}-${timestamp}`;
    return SHA256(rawId).toString();
  }

  async saveChunk(
    fileId: string,
    chunkIndex: number,
    chunkData: Buffer,
  ): Promise<void> {
    try {
      const chunkPath = path.join(CHUNK_DIR, `${fileId}_${chunkIndex}.chunk`);
      await fs.writeFile(chunkPath, chunkData);
      console.log(
        `💾 Saved chunk ${chunkIndex} for ${fileId} (${chunkData.length} bytes)`,
      );
    } catch (error) {
      console.error(`Failed to save chunk ${fileId}_${chunkIndex}:`, error);
      throw error;
    }
  }

  async getChunk(fileId: string, chunkIndex: number): Promise<Buffer | null> {
    try {
      const chunkPath = path.join(CHUNK_DIR, `${fileId}_${chunkIndex}.chunk`);
      if (
        await fs
          .access(chunkPath)
          .then(() => true)
          .catch(() => false)
      ) {
        return await fs.readFile(chunkPath);
      }
      return null;
    } catch (error) {
      console.error(`Failed to get chunk ${fileId}_${chunkIndex}:`, error);
      return null;
    }
  }

  async saveTransferRecord(record: TransferRecord): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    try {
      await this.db.run(
        `INSERT OR REPLACE INTO transfers (fileId, fileName, totalSize, chunkSize, lastChunkIndex, totalChunks, status, senderIp, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        ],
      );
      console.log(
        `📝 Saved transfer record for ${record.fileId}: ${record.totalChunks} chunks expected`,
      );
    } catch (error) {
      console.error(`Failed to save transfer record ${record.fileId}:`, error);
      throw error;
    }
  }

  async getTransferRecord(fileId: string): Promise<TransferRecord | null> {
    if (!this.db) throw new Error("Database not initialized");
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
    if (!this.db) throw new Error("Database not initialized");
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
      throw error;
    }
  }

  async cleanupOldChunks(): Promise<void> {
    if (!this.db) return;
    try {
      const now = Date.now();
      const oldFileIds = await this.db.all(
        "SELECT fileId FROM transfers WHERE timestamp < ? AND status != 'completed'",
        [now - TWENTY_FOUR_HOURS],
      );
      for (const { fileId } of oldFileIds) {
        await this.deleteTransfer(fileId);
      }
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
    }
  }

  async assembleFile(fileId: string, fileName: string): Promise<string> {
    try {
      const record = await this.getTransferRecord(fileId);
      if (!record) {
        throw new Error(`No transfer record found for ${fileId}`);
      }
      console.log(
        `🔍 Assembling ${fileId}: lastChunkIndex=${record.lastChunkIndex}, totalChunks=${record.totalChunks}`,
      );

      if (record.lastChunkIndex + 1 < record.totalChunks) {
        console.warn(
          `⚠️ Incomplete transfer for ${fileId}: ${record.lastChunkIndex + 1}/${record.totalChunks} chunks received`,
        );
        throw new Error(`Incomplete transfer for ${fileId}`);
      }

      const buffers: Buffer[] = [];
      for (let i = 0; i < record.totalChunks; i++) {
        const chunk = await this.getChunk(fileId, i);
        if (!chunk) throw new Error(`Missing chunk ${i} for ${fileId}`);
        buffers.push(chunk);
      }

      const fullFile = Buffer.concat(buffers);
      const tempPath = path.join(OUTPUT_DIR, `${Date.now()}-${fileName}`);
      await fs.writeFile(tempPath, fullFile);
      await this.updateLastChunkIndex(
        fileId,
        record.lastChunkIndex,
        "completed",
      );
      await this.deleteTransfer(fileId);
      console.log(`✅ Assembled file ${fileId} at ${tempPath}`);
      return tempPath;
    } catch (error) {
      console.error(`Failed to assemble file ${fileId}:`, error);
      throw error;
    }
  }
}

export const chunkStorage = new ChunkStorage();
