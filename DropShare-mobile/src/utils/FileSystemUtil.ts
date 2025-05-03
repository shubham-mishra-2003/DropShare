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

interface File {
  name: string;
  path?: string;
}

interface ConstantProps {
  selectedFiles: File[];
  setSelectedFiles: (files: File[]) => void;
}

export const fileOperations = () => {
  const validateFileName = (name: string): boolean => {
    const invalidChars = /[<>:"/\\|?*]|\.\.|\.$/;
    return !invalidChars.test(name) && name.length > 0 && name.length <= 255;
  };

  // const generateUniquePath = async (destPath: string): Promise<string> => {
  //   if (!(await RNFS.exists(destPath))) return destPath;
  //   const timestamp = Date.now();
  //   const extension = path.extname(destPath);
  //   const baseName = path.basename(destPath, extension);
  //   return path.join(path.dirname(destPath), `${baseName}_${timestamp}${extension}`);
  // };

  const handleMove = async ({
    selectedFiles,
    setSelectedFiles,
    destinationPath,
  }: ConstantProps & { destinationPath: string }) => {
    const results: { file: string; success: boolean; error?: string }[] = [];

    for (const file of selectedFiles) {
      if (!file.path) {
        results.push({
          file: file.name,
          success: false,
          error: "File path is required",
        });
        continue;
      }

      try {
        // const destPath = await generateUniquePath(path.join(destinationPath, file.name));
        // await RNFS.moveFile(file.path, destPath);
        results.push({ file: file.name, success: true });
      } catch (error) {
        results.push({ file: file.name, success: false, error: String(error) });
      }
    }

    setSelectedFiles([]);
    return results;
  };

  const handleCopy = async ({
    selectedFiles,
    setSelectedFiles,
    destinationPath,
  }: ConstantProps & { destinationPath: string }) => {
    const results: { file: string; success: boolean; error?: string }[] = [];

    for (const file of selectedFiles) {
      if (!file.path) {
        results.push({
          file: file.name,
          success: false,
          error: "File path is required",
        });
        continue;
      }

      try {
        // const destPath = await generateUniquePath(path.join(destinationPath, file.name));
        // await RNFS.copyFile(file.path, destPath);
        results.push({ file: file.name, success: true });
      } catch (error) {
        results.push({ file: file.name, success: false, error: String(error) });
      }
    }

    setSelectedFiles([]);
    return results;
  };

  const handleMoveToSafe = async ({
    selectedFiles,
    setSelectedFiles,
  }: // safePath = path.join(RNFS.DocumentDirectoryPath, 'Safe'),
  ConstantProps & { safePath?: string }) => {
    const results: { file: string; success: boolean; error?: string }[] = [];

    try {
      // if (!(await RNFS.exists(safePath))) {
      //   await RNFS.mkdir(safePath);
      // }

      for (const file of selectedFiles) {
        if (!file.path) {
          results.push({
            file: file.name,
            success: false,
            error: "File path is required",
          });
          continue;
        }

        try {
          // const destPath = await generateUniquePath(path.join(safePath, file.name));
          // await RNFS.moveFile(file.path, destPath);
          results.push({ file: file.name, success: true });
        } catch (error) {
          results.push({
            file: file.name,
            success: false,
            error: String(error),
          });
        }
      }
    } catch (error) {
      results.push({
        file: "Safe directory creation",
        success: false,
        error: String(error),
      });
    }

    setSelectedFiles([]);
    return results;
  };

  const handleDelete = async ({
    selectedFiles,
    setSelectedFiles,
  }: ConstantProps) => {
    const results: { file: string; success: boolean; error?: string }[] = [];

    for (const file of selectedFiles) {
      if (!file.path) {
        results.push({
          file: file.name,
          success: false,
          error: "File path is required",
        });
        continue;
      }

      try {
        await RNFS.unlink(file.path);
        results.push({ file: file.name, success: true });
      } catch (error) {
        results.push({ file: file.name, success: false, error: String(error) });
      }
    }

    setSelectedFiles([]);
    return results;
  };

  const handleInfo = async ({ selectedFiles }: ConstantProps) => {
    const results: { name: string; stats?: any; error?: string }[] = [];

    for (const file of selectedFiles) {
      if (!file.path) {
        results.push({ name: file.name, error: "File path is required" });
        continue;
      }

      try {
        const stats = await RNFS.stat(file.path);
        results.push({ name: file.name, stats });
      } catch (error) {
        results.push({ name: file.name, error: String(error) });
      }
    }

    return results;
  };

  const handleRename = async ({
    selectedFiles,
    setSelectedFiles,
    newNames,
  }: ConstantProps & { newNames: string[] }) => {
    const results: { file: string; success: boolean; error?: string }[] = [];

    if (selectedFiles.length !== newNames.length) {
      return [
        {
          file: "Rename operation",
          success: false,
          error: "Number of files and new names must match",
        },
      ];
    }

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const newName = newNames[i];

      if (!file.path) {
        results.push({
          file: file.name,
          success: false,
          error: "File path is required",
        });
        continue;
      }

      if (!validateFileName(newName)) {
        results.push({
          file: file.name,
          success: false,
          error: "Invalid file name",
        });
        continue;
      }

      try {
        // const dir = path.dirname(file.path);
        // const newPath = await generateUniquePath(path.join(dir, newName));
        // await RNFS.moveFile(file.path, newPath);
        results.push({ file: file.name, success: true });
      } catch (error) {
        results.push({ file: file.name, success: false, error: String(error) });
      }
    }

    setSelectedFiles([]);
    return results;
  };

  return {
    handleMove,
    handleCopy,
    handleDelete,
    handleMoveToSafe,
    handleInfo,
    handleRename,
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

export const categories = {
  Photos: [".jpg", ".jpeg", ".png", ".gif", ".bmp"],
  Videos: [".mp4", ".mkv", ".avi", ".mov", ".wmv"],
  Audio: [".mp3", ".wav", ".aac", ".flac", ".ogg"],
  Documents: [
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".txt",
  ],
  APKs: [".apk"],
  Archives: [".zip", ".rar", ".7z", ".tar", ".gz"],
};

export const getFileType = (file: any) => {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (categories.Photos.includes(`.${extension}`)) return "photo";
  if (categories.Videos.includes(`.${extension}`)) return "video";
  if (categories.Documents.includes(`.${extension}`)) return "document";
  if (categories.Audio.includes(`.${extension}`)) return "audio";
  if (categories.APKs.includes(`.${extension}`)) return "apk";
  if (categories.Archives.includes(`.${extension}`)) return "archive";
  return "folder";
};
