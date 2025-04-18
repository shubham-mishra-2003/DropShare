// import SQLite, { SQLiteDatabase } from "react-native-sqlite-storage";
// import RNFS from "react-native-fs";
// import { scanEntireStorage } from "./scanDirectory";

// const dbName: string = "fileindex.db";
// let database: SQLiteDatabase | null = null;

// const initializeDB = async (): Promise<void> => {
//   database = SQLite.openDatabase(
//     { name: dbName, location: "default" },
//     () => console.log("✅"),
//     (error) => console.error("❌ Database open error:", error)
//   );

//   if (!database) return;
//   database.transaction((tx) => {
//     tx.executeSql(
//       `CREATE TABLE IF NOT EXISTS files (
//                 id INTEGER PRIMARY KEY AUTOINCREMENT,
//                 name TEXT NOT NULL,
//                 path TEXT UNIQUE NOT NULL,
//                 type TEXT NOT NULL,
//                 size INTEGER DEFAULT 0,
//                 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
//                 ai_tags TEXT,
//                 category TEXT,
//                 content_summary TEXT
//             );`,
//       [],
//       () => console.log("✅"),
//       (error) => console.error("❌ Database initialization error:", error)
//     );
//   });
// };

// const extractTextFromFile = async (filePath: string): Promise<string> => {
//   try {
//     const ext = filePath.split(".").pop()?.toLowerCase();
//     if (ext === "pdf") {

//     }
//     if (["txt", "md"].includes(ext || "")) {
//       console.log(`Attempting to read file: ${filePath} with encoding: utf8`);
//       return (await RNFS.readFile(filePath, "utf8")).slice(0, 500);
//     } else {
//       return "";
//     }
//   } catch (error) {
//     console.error("❌ Text extraction error (utf8):", error);
//     return "";
//   }
// };

// const getFileCategory = (fileName: string): string => {
//   const ext = fileName.split(".").pop()?.toLowerCase() || "";
//   if (["jpg", "png", "jpeg", "gif"].includes(ext)) return "Image";
//   if (["txt", "md", "pdf", "docx"].includes(ext)) return "Document";
//   if (["mp4", "mkv", "avi"].includes(ext)) return "Video";
//   if (["mp3", "wav", "flac"].includes(ext)) return "Audio";
//   return "Other";
// };

// const insertFile = async (
//   name: string,
//   path: string,
//   size: number,
//   isDirectory: () => boolean
// ): Promise<void> => {
//   let type = isDirectory() ? "folder" : "file";
//   if (!database) return;
//   const category = getFileCategory(name);
//   const contentSummary =
//     category === "Document" ? await extractTextFromFile(path) : null;
//   database.transaction((tx) => {
//     tx.executeSql(
//       `INSERT INTO files (name, path, type, size, created_at, category, content_summary)
//              VALUES (?, ?, ?, ?, datetime('now'), ?, ?)
//              ON CONFLICT(path) DO UPDATE SET
//              name=excluded.name, type=excluded.type, size=excluded.size, category=excluded.category, content_summary=excluded.content_summary;`,
//       [name, path, type, size, category, contentSummary],
//       () => {
//         null;
//       },
//       (error) => console.error("❌ Error indexing file:", error)
//     );
//   });
// };

// export const searchFiles = (
//   query: string,
//   callback: (results: any[]) => void
// ): void => {
//   if (!database) return;
//   database.transaction((tx) => {
//     tx.executeSql(
//       `SELECT * FROM files WHERE name LIKE ? OR ai_tags LIKE ? OR category LIKE ? OR content_summary LIKE ?`,
//       [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`],
//       (_, results) => callback(results.rows.raw()),
//       (error) => console.error("❌ Search query error:", error)
//     );
//   });
// };

// export const startIndexing = async () => {
//   await initializeDB();
//   if (!database) return;
//   const files = await scanEntireStorage();
//   files.forEach(async (file) => {
//     const { name, path, size, isDirectory } = file;
//     await insertFile(name, path, size, isDirectory);
//   });
// };

// working till now

// import SQLite, { SQLiteDatabase } from "react-native-sqlite-storage";
// import RNFS from "react-native-fs";
// import { scanEntireStorage } from "./scanDirectory";
// import { classifyImage } from "./AISearch";

// const dbName: string = "fileindex.db";
// let database: SQLiteDatabase | null = null;

// export const initializeDB = async (): Promise<void> => {
//   database = SQLite.openDatabase(
//     { name: dbName, location: "default" },
//     () => console.log("✅ Database opened"),
//     (error) => console.error("❌ Database open error:", error)
//   );

//   if (!database) return;
//   database.transaction((tx) => {
//     tx.executeSql(
//       `CREATE TABLE IF NOT EXISTS files (
//                 id INTEGER PRIMARY KEY AUTOINCREMENT,
//                 name TEXT NOT NULL,
//                 path TEXT UNIQUE NOT NULL,
//                 type TEXT NOT NULL,
//                 size INTEGER DEFAULT 0,
//                 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
//                 ai_tags TEXT,
//                 category TEXT,
//                 content_summary TEXT
//             );`,
//       [],
//       () => console.log("✅ Table created"),
//       (error) => console.error("❌ Database initialization error:", error)
//     );
//   });
// };

// export const extractTextFromFile = async (
//   filePath: string
// ): Promise<string> => {
//   try {
//     const ext = filePath.split(".").pop()?.toLowerCase();
//     if (ext === "pdf") {
//       // Add PDF text extraction logic if needed
//       return "";
//     }
//     if (["txt", "md"].includes(ext || "")) {
//       console.log(`Attempting to read file: ${filePath} with encoding: utf8`);
//       return (await RNFS.readFile(filePath, "utf8")).slice(0, 500);
//     } else {
//       return "";
//     }
//   } catch (error) {
//     console.error("❌ Text extraction error (utf8):", error);
//     return "";
//   }
// };

// export const getFileCategory = (fileName: string): string => {
//   const ext = fileName.split(".").pop()?.toLowerCase() || "";
//   if (["jpg", "png", "jpeg", "gif"].includes(ext)) return "Image";
//   if (["txt", "md", "pdf", "docx"].includes(ext)) return "Document";
//   if (["mp4", "mkv", "avi"].includes(ext)) return "Video";
//   if (["mp3", "wav", "flac"].includes(ext)) return "Audio";
//   return "Other";
// };

// export const insertFile = async (
//   name: string,
//   path: string,
//   size: number,
//   isDirectory: () => boolean
// ): Promise<void> => {
//   if (!database) return;
//   const type = isDirectory() ? "folder" : "file";
//   const category = getFileCategory(name);
//   let aiTags = null;
//   let contentSummary = null;

//   // Generate AI tags for image files
//   if (category === "Image") {
//     try {
//       aiTags = (await classifyImage(path)).join(", "); // Store as comma-separated string
//       console.log(`✅ AI tags for ${path}: ${aiTags}`);
//     } catch (error) {
//       console.error(`❌ AI tag generation failed for ${path}:`, error);
//       aiTags = "unknown";
//     }
//   }
//   if (category === "Document") {
//     contentSummary = await extractTextFromFile(path);
//   }
//   database.transaction((tx) => {
//     tx.executeSql(
//       `INSERT INTO files (name, path, type, size, created_at, category, ai_tags, content_summary)
//              VALUES (?, ?, ?, ?, datetime('now'), ?, ?, ?)
//              ON CONFLICT(path) DO UPDATE SET
//              name=excluded.name, type=excluded.type, size=excluded.size, category=excluded.category,
//              ai_tags=excluded.ai_tags, content_summary=excluded.content_summary;`,
//       [name, path, type, size, category, aiTags, contentSummary],
//       () => console.log(`✅ Indexed ${name}`),
//       (error) => console.error("❌ Error indexing file:", error)
//     );
//   });
// };

// export const searchFiles = (
//   query: string,
//   callback: (results: any[]) => void
// ): void => {
//   if (!database) return;
//   database.transaction((tx) => {
//     tx.executeSql(
//       `SELECT * FROM files WHERE name LIKE ? OR ai_tags LIKE ? OR category LIKE ? OR content_summary LIKE ?`,
//       [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`],
//       (_, results) => callback(results.rows.raw()),
//       (error) => console.error("❌ Search query error:", error)
//     );
//   });
// };

// export const startIndexing = async () => {
//   await initializeDB();
//   if (!database) return;
//   const files = await scanEntireStorage();
//   files.forEach(async (file) => {
//     const { name, path, size, isDirectory } = file;
//     await insertFile(name, path, size, isDirectory);
//   });
// };

import SQLite, { SQLiteDatabase } from "react-native-sqlite-storage";
import RNFS from "react-native-fs";
import { scanEntireStorage } from "./scanDirectory";
import { classifyImage } from "./AISearch";

const dbName: string = "fileindex.db";
let database: SQLiteDatabase | null = null;

export const initializeDB = async (): Promise<void> => {
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
      () => console.log("✅ Table created"),
      (_, error) => console.error("❌ Database initialization error:", error)
    );
  });
};

export const extractTextFromFile = async (
  filePath: string
): Promise<string> => {
  try {
    const ext = filePath.split(".").pop()?.toLowerCase();
    if (["txt", "md"].includes(ext || "")) {
      return (await RNFS.readFile(filePath, "utf8")).slice(0, 500);
    }
    return "";
  } catch (error) {
    console.error("❌ Text extraction error:", error);
    return "";
  }
};
export const getFileCategory = (fileName: string): string => {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "png", "jpeg", "gif"].includes(ext)) return "Image";
  if (["txt", "md", "pdf", "docx"].includes(ext)) return "Document";
  if (["mp4", "mkv", "avi"].includes(ext)) return "Video";
  if (["mp3", "wav", "flac"].includes(ext)) return "Audio";
  return "Other";
};
export const insertFile = async (
  name: string,
  path: string,
  size: number,
  isDirectory: () => boolean,
  enableSmartSearch: boolean
): Promise<void> => {
  if (!database) return;
  const type = isDirectory() ? "folder" : "file";
  const category = getFileCategory(name);
  let aiTags = null;
  let contentSummary = null;

  if (enableSmartSearch) {
    if (category === "Image") {
      try {
        aiTags = (await classifyImage(path)).join(", ");
      } catch (error) {
        console.error(`❌ AI tag generation failed for ${path}:`, error);
        aiTags = null;
      }
    }
    if (category === "Document") {
      contentSummary = await extractTextFromFile(path);
    }
  }

  database.transaction((tx) => {
    tx.executeSql(
      `INSERT OR REPLACE INTO files (name, path, type, size, created_at, category, ai_tags, content_summary)
       VALUES (?, ?, ?, ?, datetime('now'), ?, ?, ?)`,
      [name, path, type, size, category, aiTags, contentSummary],
      () => {},
      (_, error) => console.error("❌ Error indexing file:", error)
    );
  });
};

export const searchFiles = (
  query: string,
  enableSmartSearch: boolean,
  callback: (results: any[]) => void
): void => {
  if (!database) return;

  const sqlQuery = enableSmartSearch
    ? `SELECT * FROM files WHERE name LIKE ? OR category LIKE ? OR ai_tags LIKE ? OR content_summary LIKE ?`
    : `SELECT * FROM files WHERE name LIKE ? OR category LIKE ?`;
  const params = enableSmartSearch
    ? [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`]
    : [`%${query}%`, `%${query}%`];

  database.transaction((tx) => {
    tx.executeSql(
      sqlQuery,
      params,
      (_, results) => callback(results.rows.raw()),
      (_, error) => console.error("❌ Search query error:", error)
    );
  });
};

export const startIndexing = async (
  enableSmartSearch: boolean
): Promise<void> => {
  await initializeDB();
  if (!database) return;
  const files = await scanEntireStorage();
  const batchSize = 50;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    await Promise.all(
      batch.map((file) =>
        insertFile(
          file.name,
          file.path,
          file.size,
          file.isDirectory,
          enableSmartSearch
        )
      )
    );
  }
};
