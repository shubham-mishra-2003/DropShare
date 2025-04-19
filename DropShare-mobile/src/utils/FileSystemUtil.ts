import RNFS from "react-native-fs";

export interface StorageInfo {
  used: number;
  total: number;
}

export interface FileCounts {
  [key: string]: number;
}

export const getStorageInfo = async (): Promise<StorageInfo> => {
  try {
    const device = await RNFS.getFSInfo();

    if (
      !device ||
      device.totalSpace === undefined ||
      device.freeSpace === undefined
    ) {
      throw new Error("FSInfo returned null or undefined values.");
    }
    return {
      used: Number(
        ((device.totalSpace - device.freeSpace) / 1024 ** 3).toFixed(2)
      ),
      total: Number((device.totalSpace / 1024 ** 3).toFixed(2)),
    };
  } catch (error) {
    console.error("Error fetching storage info:", error);
    return { used: 0, total: 0 };
  }
};

export interface FileCounts {
  Photos: number;
  Videos: number;
  Audio: number;
  Documents: number;
  APKs: number;
  Archives: number;
}

export const getFileCounts = async (
  path: string = RNFS.ExternalStorageDirectoryPath
): Promise<FileCounts> => {
  try {
    if (!path) {
      throw new Error("Storage path is undefined.");
    }
    const pathExists = await RNFS.exists(path);
    if (!pathExists) {
      return {
        Photos: 0,
        Videos: 0,
        Audio: 0,
        Documents: 0,
        APKs: 0,
        Archives: 0,
      };
    }

    if (path.includes("/Android/data") || path.includes("/Android/obb")) {
      return {
        Photos: 0,
        Videos: 0,
        Audio: 0,
        Documents: 0,
        APKs: 0,
        Archives: 0,
      };
    }

    let files;
    try {
      files = await RNFS.readDir(path);
      if (!Array.isArray(files)) {
        return {
          Photos: 0,
          Videos: 0,
          Audio: 0,
          Documents: 0,
          APKs: 0,
          Archives: 0,
        };
      }
    } catch (err) {
      return {
        Photos: 0,
        Videos: 0,
        Audio: 0,
        Documents: 0,
        APKs: 0,
        Archives: 0,
      };
    }

    let counts: FileCounts = {
      Photos: 0,
      Videos: 0,
      Audio: 0,
      Documents: 0,
      APKs: 0,
      Archives: 0,
    };

    for (const file of files) {
      if (!file || !file.name || file.name.startsWith(".")) continue;

      if (file.isFile()) {
        if (/\.(jpg|png|jpeg|gif|webp)$/i.test(file.name)) counts.Photos++;
        else if (/\.(mp4|mkv|mov|avi)$/i.test(file.name)) counts.Videos++;
        else if (/\.(mp3|wav|aac|ogg)$/i.test(file.name)) counts.Audio++;
        else if (/\.(pdf|docx|xlsx|pptx|txt)$/i.test(file.name))
          counts.Documents++;
        else if (/\.apk$/i.test(file.name)) counts.APKs++;
        else if (/\.(zip|rar|7z|tar)$/i.test(file.name)) counts.Archives++;
      } else if (file.isDirectory()) {
        const subCounts = await getFileCounts(file.path);
        Object.keys(counts).forEach((key) => {
          counts[key as keyof FileCounts] +=
            subCounts[key as keyof FileCounts] || 0;
        });
      }
    }

    return counts;
  } catch (error) {
    return {
      Photos: 0,
      Videos: 0,
      Audio: 0,
      Documents: 0,
      APKs: 0,
      Archives: 0,
    };
  }
};

export const fileType = (file: RNFS.ReadDirItem) => {
  if (!file) return null;
  const fileExtension = file.name.split(".").pop()?.toLowerCase();
  const isImage = ["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(
    fileExtension || ""
  );
  const isPdf = fileExtension === "pdf";
  const isVideo = ["mp4", "mov", "avi", "mkv", "webm"].includes(
    fileExtension || ""
  );
  const isAudio = ["mp3", "wav", "aac", "ogg", "m4a"].includes(
    fileExtension || ""
  );

  let fileType = "";

  if (isImage) {
    fileType = "image";
  } else if (isVideo) {
    fileType = "video";
  } else if (isAudio) {
    fileType = "audio";
  } else if (isPdf) {
    fileType = "pdf";
  } else {
    fileType = "";
  }

  return fileType;
};

interface ReadDirItem extends RNFS.ReadDirItem {
  path: string;
  name: string;
  isDirectory: () => boolean;
  isFile: () => boolean;
}

export interface ConstantProps {
  filePath?: string;
  selectedFiles: ReadDirItem[];
}

export const fileOperations = () => {
  const handleMove = async ({ filePath, selectedFiles }: ConstantProps) => {
    if (!filePath) throw new Error("filePath is required for move operation");
    try {
      await Promise.all(
        selectedFiles.map(async (file) => {
          const destPath = `${filePath}/${file.name}`;
          await RNFS.moveFile(file.path, destPath);
          console.log(`File moved to: ${destPath}`);
        })
      );
    } catch (error) {
      console.error("Error moving files:", error);
      throw error;
    }
  };

  const handleCopy = async ({ filePath, selectedFiles }: ConstantProps) => {
    if (!filePath) throw new Error("filePath is required for copy operation");
    try {
      await Promise.all(
        selectedFiles.map(async (file) => {
          const destPath = `${filePath}/${file.name}`;
          await RNFS.copyFile(file.path, destPath);
          console.log(`File copied to: ${destPath}`);
        })
      );
    } catch (error) {
      console.error("Error copying files:", error);
      throw error;
    }
  };

  const handleMoveToSafe = async ({ selectedFiles }: ConstantProps) => {
    try {
      const safePath = `${RNFS.DocumentDirectoryPath}/Safe/`;
      const safeDirectoryExists = await RNFS.exists(safePath);
      if (!safeDirectoryExists) {
        await RNFS.mkdir(safePath);
      }

      await Promise.all(
        selectedFiles.map(async (file) => {
          const destPath = `${safePath}${file.name}`;
          await RNFS.moveFile(file.path, destPath);
          console.log(`File moved to safe location: ${destPath}`);
        })
      );
    } catch (error) {
      console.error("Error moving files to safe:", error);
      throw error;
    }
  };

  const handleDelete = async ({ selectedFiles }: ConstantProps) => {
    try {
      await Promise.all(
        selectedFiles.map(async (file) => {
          await RNFS.unlink(file.path);
          console.log(`File deleted: ${file.path}`);
        })
      );
    } catch (error) {
      console.error("Error deleting files:", error);
      throw error;
    }
  };

  const handleInfo = async ({ selectedFiles }: ConstantProps) => {
    try {
      const fileInfos = await Promise.all(
        selectedFiles.map(async (file) => {
          const stats = await RNFS.stat(file.path);
          return { name: file.name, stats };
        })
      );
      console.log("File Info:", fileInfos);
      return fileInfos;
    } catch (error) {
      console.error("Error retrieving files info:", error);
      throw error;
    }
  };

  return {
    handleMove,
    handleCopy,
    handleDelete,
    handleMoveToSafe,
    handleInfo,
  };
};

export const formatFileSize = (sizeInBytes: number): string => {
  if (sizeInBytes >= 1024 ** 3) {
    return (sizeInBytes / 1024 ** 3).toFixed(2) + " GB";
  } else if (sizeInBytes >= 1024 ** 2) {
    return (sizeInBytes / 1024 ** 2).toFixed(2) + " MB";
  } else if (sizeInBytes >= 1024) {
    return (sizeInBytes / 1024).toFixed(2) + " KB";
  } else {
    return sizeInBytes + " B";
  }
};

export const TEMP_CHUNKS_PATH = `${RNFS.TemporaryDirectoryPath}/DropShare/chunks`;
export const SAVE_PATH = `${RNFS.ExternalStorageDirectoryPath}/DropShare`;
