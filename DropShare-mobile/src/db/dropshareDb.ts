import SQLite, { SQLiteDatabase } from "react-native-sqlite-storage";
import RNFS from "react-native-fs";
import { scanEntireStorage } from "./scanDirectory";

const dbName: string = "dropshare.db";
let database: SQLiteDatabase | null = null;

const initializeDB = async (): Promise<void> => {
  database = SQLite.openDatabase(
    { name: dbName, location: "default" },
    () => console.log("✅ Database opened"),
    (error) => console.error("❌ Database open error:", error)
  );

  if (!database) return;
  database.transaction((tx) => {
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                path TEXT UNIQUE NOT NULL,
                type TEXT NOT NULL,
                size INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                ai_tags TEXT,
                category TEXT,
                content_summary TEXT
            );`,
      [],
      () => console.log("✅ Database initialized"),
      (error) => console.error("❌ Database initialization error:", error)
    );
  });
};

const extractTextFromFile = async (filePath: string): Promise<string> => {
  try {
    const content = await RNFS.readFile(filePath, "utf8");
    return content.slice(0, 500);
  } catch (error) {
    console.error("❌ Text extraction error (utf8):", error);
    try {
      const content = await RNFS.readFile(filePath, "utf16le");
      return content.slice(0, 500);
    } catch (error) {
      console.error("❌ Text extraction error (utf16le):", error);
      return "";
    }
  }
};

const getFileCategory = (fileName: string): string => {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "png", "jpeg", "gif"].includes(ext)) return "Image";
  if (["txt", "md", "pdf", "docx"].includes(ext)) return "Document";
  if (["mp4", "mkv", "avi"].includes(ext)) return "Video";
  if (["mp3", "wav", "flac"].includes(ext)) return "Audio";
  return "Other";
};

const insertFile = async (
  name: string,
  path: string,
  size: number,
  isDirectory: () => boolean
): Promise<void> => {
  let type = isDirectory() ? "folder" : "file";
  if (!database) return;
  const category = getFileCategory(name);
  const contentSummary =
    category === "Document" ? await extractTextFromFile(path) : null;
  database.transaction((tx) => {
    tx.executeSql(
      `INSERT INTO files (name, path, type, size, created_at, category, content_summary) 
             VALUES (?, ?, ?, ?, datetime('now'), ?, ?) 
             ON CONFLICT(path) DO UPDATE SET 
             name=excluded.name, type=excluded.type, size=excluded.size, category=excluded.category, content_summary=excluded.content_summary;`,
      [name, path, type, size, category, contentSummary],
      () => {
        null;
      },
      (error) => console.error("❌ Error indexing file:", error)
    );
  });
};

export const searchFiles = (
  query: string,
  callback: (results: any[]) => void
): void => {
  if (!database) return;
  database.transaction((tx) => {
    tx.executeSql(
      `SELECT * FROM files WHERE name LIKE ? OR ai_tags LIKE ? OR category LIKE ? OR content_summary LIKE ?`,
      [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`],
      (_, results) => callback(results.rows.raw()),
      (error) => console.error("❌ Search query error:", error)
    );
  });
};

export const startIndexing = async () => {
  await initializeDB();
  const files = await scanEntireStorage();
  files.forEach(async (file) => {
    const { name, path, size, isDirectory } = file;
    await insertFile(name, path, size, isDirectory);
  });
};
