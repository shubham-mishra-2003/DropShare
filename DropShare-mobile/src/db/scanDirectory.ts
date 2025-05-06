import RNFS from "react-native-fs";

const scanDirectoryRecursive = async (
  directoryPath: string,
  maxDepth: number = 3,
  currentDepth: number = 0
): Promise<RNFS.ReadDirItem[]> => {
  let results: RNFS.ReadDirItem[] = [];

  const restrictedDirs = [
    "/storage/emulated/0/Android/data",
    "/storage/emulated/0/Android/obb",
    "/storage/emulated/0/WhatsApp",
    "/storage/emulated/0/WhatsApp/Databases",
    "/storage/emulated/0/WhatsApp/Media",
    "/storage/emulated/0/WhatsApp/Backups",
    "/storage/emulated/0/Telegram",
    "/storage/emulated/0/DCIM/.thumbnails",
    "/storage/emulated/0/Download/cache",
    "/storage/emulated/0/.cache",
  ];

  // Skip hidden folders/files and restricted directories
  if (
    directoryPath.split("/").pop()?.startsWith(".") ||
    restrictedDirs.some((dir) => directoryPath.includes(dir)) ||
    currentDepth > maxDepth
  ) {
    // console.log(
    //   `Skipping path: ${directoryPath} (hidden, restricted, or too deep)`
    // );
    return [];
  }

  try {
    const files = await RNFS.readDir(directoryPath);
    for (const file of files) {
      // Skip hidden files/folders
      if (file.name.startsWith(".")) {
        // console.log(`Skipping hidden item: ${file.path}`);
        continue;
      }

      results.push(file);
      if (file.isDirectory() && currentDepth < maxDepth) {
        const subFiles = await scanDirectoryRecursive(
          file.path,
          maxDepth,
          currentDepth + 1
        );
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
  // console.log(`✅ Scanned ${allFiles.length} items`);
  return allFiles;
};
