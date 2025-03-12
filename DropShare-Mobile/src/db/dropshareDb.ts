import SQLite from "react-native-sqlite-storage";
import RNFS from "react-native-fs";

// Define the database storage path (similar to WhatsApp's structure)
const dataPath = `${RNFS.ExternalStorageDirectoryPath}/Android/media/com.dropshare/databases`;
const dbName = "dropshare_files.db";

// Ensure directory exists before opening DB
const ensureDatabaseDirectory = async () => {
    try {
        await RNFS.mkdir(dataPath);
    } catch (error) {
        console.error("Error creating database directory:", error);
    }
};

// Open Database
const db = SQLite.openDatabase(
    { name: dbName, location: "default" },
    () => console.log("✅ Database opened successfully"),
    (error) => console.error("❌ Database error:", error)
);

// Initialize Tables
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
                isFile INTEGER DEFAULT 0
            );`,
            [],
            () => console.log("✅ Files table created successfully"),
            (error) => console.error("❌ Error creating files table:", error)
        );

        // Indexing for fast lookup
        tx.executeSql(
            `CREATE INDEX IF NOT EXISTS idx_files_path ON files (path);`,
            [],
            () => console.log("✅ Index created on path"),
            (error) => console.error("❌ Error creating index:", error)
        );
    });
};

// Save files efficiently using bulk transactions
export const saveToDatabase = async (files: RNFS.ReadDirItem[]) => {
    await ensureDatabaseDirectory();
    initializeDatabase();

    db.transaction((tx) => {
        files.forEach((file) => {
            tx.executeSql(
                `INSERT OR REPLACE INTO files 
                (name, path, size, isDirectory, isFile, ctime, mtime) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    file.name,
                    file.path,
                    file.size || 0,
                    file.isDirectory() ? 1 : 0, // Convert boolean to integer
                    file.isFile() ? 1 : 0, // Convert boolean to integer
                    file.ctime ? file.ctime.getTime() : null,
                    file.mtime ? file.mtime.getTime() : null
                ],
                () => console.log(`✅ Inserted: ${file.name}`),
                (error) => console.error("❌ Insert error:", error)
            );
        });
    });
};

// Get all stored files
export const getFilesFromDatabase = (callback: (files: RNFS.ReadDirItem[]) => void) => {
    db.transaction((tx) => {
        tx.executeSql(
            `SELECT * FROM files;`,
            [],
            (_, results) => {
                let files: RNFS.ReadDirItem[] = [];
                for (let i = 0; i < results.rows.length; i++) {
                    files.push(results.rows.item(i));
                }
                callback(files);
            },
            (error) => console.error("❌ Error fetching files:", error)
        );
    });
};

// Delete file from database
export const deleteFileFromDatabase = (filePath: string) => {
    db.transaction((tx) => {
        tx.executeSql(
            `DELETE FROM files WHERE path = ?;`,
            [filePath],
            () => console.log(`✅ Deleted file: ${filePath}`),
            (error) => console.error("❌ Error deleting file:", error)
        );
    });
};
