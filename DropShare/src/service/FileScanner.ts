import RNFS from "react-native-fs";
import { classifyImage, extractTextFromFile } from "./AISearch";
import { saveFileRecord } from "../db/dropshareDb";

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

// Scan and store AI metadata
export const scanEntireStorage = async () => {
    const storagePaths = [RNFS.ExternalStorageDirectoryPath];
    let allFiles: RNFS.ReadDirItem[] = [];

    for (const path of storagePaths) {
        const files = await scanDirectoryRecursive(path);
        allFiles = [...allFiles, ...files];
    }

    console.log("✅ Scanning complete. Processing AI features...");

    for (const file of allFiles) {
        let tags: string | null = '';
        let content_summary: string | null = '';
        if (file.isFile?.()) {
            if (file.name.endsWith(".jpg") || file.name.endsWith(".png")) {
                tags = await classifyImage(file.path);
            } else if (file.name.endsWith(".txt") || file.name.endsWith(".md")) {
                content_summary = await extractTextFromFile(file.path);
            }
        }
        saveFileRecord(file, tags, content_summary);
    }

    console.log("✅ AI-enhanced scanning and storage complete!");
};
