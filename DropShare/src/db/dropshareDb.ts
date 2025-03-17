import SQLite from "react-native-sqlite-storage";
import RNFS from "react-native-fs";

const dbName = "dropshare_files.db";
const dbPath = `${RNFS.ExternalStorageDirectoryPath}/Android/media/com.dropshare/databases`;

const ensureDatabaseDirectory = async () => {
    try {
        await RNFS.mkdir(dbPath);
        console.log("✅ Database directory ensured");
    } catch (error) {
        console.error("❌ Error creating database directory:", error);
    }
};

// Open database
const openDatabase = async () => {
    await ensureDatabaseDirectory();
    const db = SQLite.openDatabase(
        { name: dbName, location: "default" },
        () => console.log("✅ Database opened successfully"),
        (error) => console.error("❌ Database open error:", error)
    );
    return db;
};

const db = await openDatabase();

// Initialize database with AI columns
export const initializeDatabase = () => {
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
    });
};

// Insert or update file record
export const saveFileRecord = (file: any, tags: string | null, content_summary: string | null) => {
    db.transaction((tx) => {
        tx.executeSql(
            `INSERT OR REPLACE INTO files 
            (name, path, size, isDirectory, isFile, ctime, mtime, tags, content_summary) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
                file.name,
                file.path,
                file.size || 0,
                file.isDirectory?.() ? 1 : 0,
                file.isFile?.() ? 1 : 0,
                file.ctime ? file.ctime.getTime() : null,
                file.mtime ? file.mtime.getTime() : null,
                tags,
                content_summary
            ],
            () => console.log(`✅ Saved: ${file.name} with AI metadata`),
            (_, error) => console.error(`❌ Insert error: ${error.message}`)
        );
    });
};

// Search files with AI-powered metadata
export const searchFiles = (query: string, callback: (files: any[]) => void) => {
    if (!db) {
        console.error("❌ Database not initialized");
        return;
    }

    const sqlQuery = `
        SELECT * FROM files 
        WHERE name LIKE ? 
        OR tags LIKE ? 
        OR content_summary LIKE ? 
        OR category LIKE ? 
        ORDER BY mtime DESC;
    `;

    const searchParam = `%${query}%`;

    db.transaction((tx) => {
        tx.executeSql(
            sqlQuery,
            [searchParam, searchParam, searchParam, searchParam],
            (_, results) => {
                let files: any[] = [];
                for (let i = 0; i < results.rows.length; i++) {
                    files.push(results.rows.item(i));
                }
                callback(files);
            },
            (_, error) => console.error("❌ Search error:", error.message)
        );
    });
};

export default db;
