async saveChunk(fileId: string, chunkIndex: number, chunkData: Buffer): Promise<void> {
    if (!this.db || !this.initialized) {
      await this.initialize();
    }
    await this.db!.executeSql(
      `INSERT OR REPLACE INTO chunks (fileId, chunkIndex, chunkData) VALUES (?, ?, ?)`,
      [fileId, chunkIndex, chunkData]
    );
    Logger.info(`Saved chunk ${chunkIndex} for ${fileId}`);
  };
  