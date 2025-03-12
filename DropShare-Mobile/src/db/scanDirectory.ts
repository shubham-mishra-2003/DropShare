import RNFS from "react-native-fs";

// Recursively scan all directories
const scanDirectoryRecursive = async (directoryPath: string): Promise<RNFS.ReadDirItem[]> => {
    let results: RNFS.ReadDirItem[] = [];

    try {
        const files = await RNFS.readDir(directoryPath);

        for (const file of files) {
            results.push(file);
            if (file.isDirectory()) {
                const subFiles = await scanDirectoryRecursive(file.path);
                results = [...results, ...subFiles];
            }
        }
    } catch (error) {
        console.error("❌ Error scanning directory:", error);
    }

    return results;
};

// Scan entire storage (Requires MANAGE_EXTERNAL_STORAGE on Android 11+)
export const scanEntireStorage = async (): Promise<RNFS.ReadDirItem[]> => {
    const storagePaths = [RNFS.ExternalStorageDirectoryPath]; // Root external storage

    let allFiles: RNFS.ReadDirItem[] = [];

    for (const path of storagePaths) {
        const files = await scanDirectoryRecursive(path);
        allFiles = [...allFiles, ...files];
    }

    return allFiles;
};
