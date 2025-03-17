import SQLite from "react-native-sqlite-storage";
import RNFS from "react-native-fs";

const dbName: string = "dropshare_files.db";
const dbPath: string = `${RNFS.ExternalStorageDirectoryPath}/Android/media/com.dropshare/databases`;

const ensureDatabaseDirectory = async (): Promise<void> => {
  try {
    await RNFS.mkdir(dbPath);
    console.log("✅ Database directory ensured");
  } catch (error) {
    console.error("❌ Error creating database directory:", error);
  }
};

// Open database asynchronously
const openDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  await ensureDatabaseDirectory();
  return new Promise((resolve, reject) => {
    const db = SQLite.openDatabase(
      { name: dbName, location: "default" },
      () => resolve(db),
      (error) => reject(error)
    );
  });
};

const db: SQLite.SQLiteDatabase = await openDatabase();

// Initialize database with AI columns and indexes
export const initializeDatabase = (): void => {
  db.transaction((tx) => {
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                path TEXT UNIQUE NOT NULL,
                size INTEGER DEFAULT 0,
                ctime INTEGER DEFAULT NULL,
                mtime INTEGER DEFAULT NULL,
                isDirectory INTEGER DEFAULT 0, 
                isFile INTEGER DEFAULT 0,
                tags TEXT DEFAULT NULL, 
                content_summary TEXT DEFAULT NULL, 
                category TEXT DEFAULT NULL
            );`,
      [],
      () => console.log("✅ Files table initialized"),
      (error) => console.error("❌ Error creating table:", error)
    );

    // Create indexes for faster search
    tx.executeSql("CREATE INDEX IF NOT EXISTS idx_name ON files(name);");
    tx.executeSql("CREATE INDEX IF NOT EXISTS idx_tags ON files(tags);");
    tx.executeSql(
      "CREATE INDEX IF NOT EXISTS idx_content ON files(content_summary);"
    );
  });
};

// Determine category based on file extension
const getFileCategory = (fileName: string): string => {
  const ext: string = fileName.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "png", "jpeg", "gif"].includes(ext)) return "Image";
  if (["txt", "md", "pdf", "docx"].includes(ext)) return "Document";
  if (["mp4", "mkv", "avi"].includes(ext)) return "Video";
  if (["mp3", "wav", "flac"].includes(ext)) return "Audio";
  return "Other";
};

interface FileRecord {
  name: string;
  path: string;
  size?: number;
  isDirectory?: () => boolean;
  isFile?: () => boolean;
  ctime?: Date;
  mtime?: Date;
}

// Insert or update file record
export const saveFileRecord = (
  file: FileRecord,
  tags: string | null = null,
  content_summary: string | null = null
): void => {
  const category: string = getFileCategory(file.name);
  db.transaction((tx) => {
    tx.executeSql(
      `INSERT INTO files (name, path, size, isDirectory, isFile, ctime, mtime, tags, content_summary, category)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(path) DO UPDATE SET 
                name = excluded.name,
                size = excluded.size,
                mtime = excluded.mtime,
                tags = excluded.tags,
                content_summary = excluded.content_summary,
                category = excluded.category;`,
      [
        file.name,
        file.path,
        file.size || 0,
        file.isDirectory?.() ? 1 : 0,
        file.isFile?.() ? 1 : 0,
        file.ctime ? file.ctime.getTime() : null,
        file.mtime ? file.mtime.getTime() : null,
        tags,
        content_summary,
        category,
      ],
      () => console.log(`✅ Saved: ${file.name} with AI metadata`),
      (_, error) => console.error(`❌ Insert error: ${error.message}`)
    );
  });
};

// Hybrid search: AI-powered and local file system fallback
export const searchFiles = (
  query: string,
  callback: (files: any[]) => void
): void => {
  if (!db) {
    console.error("❌ Database not initialized");
    return;
  }

  const sqlQuery: string = `
        SELECT * FROM files 
        WHERE name LIKE ? 
        OR tags LIKE ? 
        OR content_summary LIKE ? 
        OR category LIKE ? 
        ORDER BY mtime DESC;
    `;

  const searchParam: string = `%${query}%`;

  db.transaction((tx) => {
    tx.executeSql(
      sqlQuery,
      [searchParam, searchParam, searchParam, searchParam],
      async (_, results) => {
        const files: any[] = [];
        for (let i = 0; i < results.rows.length; i++) {
          files.push(results.rows.item(i));
        }
        if (files.length === 0) {
          try {
            const fileList = await RNFS.readDir(
              RNFS.ExternalStorageDirectoryPath
            );
            const filtered = fileList.filter((file) =>
              file.name.toLowerCase().includes(query.toLowerCase())
            );
            files.push(
              ...filtered.map((file) => ({
                name: file.name,
                path: file.path,
                isDirectory: file.isDirectory(),
                isFile: file.isFile(),
              }))
            );
          } catch (error) {
            console.error("❌ File system search error:", error);
          }
        }
        callback(files);
      },
      (_, error) => console.error("❌ Search error:", error.message)
    );
  });
};

export default db;
