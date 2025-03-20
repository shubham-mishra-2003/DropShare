import RNFS from "react-native-fs";

const scanDirectoryRecursive = async (
  directoryPath: string
): Promise<RNFS.ReadDirItem[]> => {
  let results: RNFS.ReadDirItem[] = [];
  try {
    const restrictedDirs = [
      "/storage/emulated/0/Android/data",
      "/storage/emulated/0/Android/obb",
    ];
    if (restrictedDirs.includes(directoryPath)) {
      return [];
    }
    const files = await RNFS.readDir(directoryPath);
    for (const file of files) {
      results.push(file);
      if (file.isDirectory()) {
        const subFiles = await scanDirectoryRecursive(file.path);
        results = [...results, ...subFiles];
      }
    }
  } catch (error) {
    console.error(`❌ Error scanning directory ${directoryPath}:`, error);
  }
  return results;
};

export const scanEntireStorage = async (): Promise<RNFS.ReadDirItem[]> => {
  const storagePaths = [RNFS.ExternalStorageDirectoryPath];
  let allFiles: RNFS.ReadDirItem[] = [];
  for (const path of storagePaths) {
    const files = await scanDirectoryRecursive(path);
    allFiles = [...allFiles, ...files];
  }
  return allFiles;
};
