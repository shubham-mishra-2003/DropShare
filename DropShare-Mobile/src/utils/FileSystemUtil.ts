import RNFS from "react-native-fs";
import { Permission, PermissionsAndroid } from "react-native";
import { Toast } from "../components/Toasts";

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

export const requestStoragePermission = async (): Promise<boolean> => {
  try {
    const permission: Permission[] = [
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
    ]
    const ImagesPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      {
        title: "Storage Permission",
        message: "App needs access to your storage to count files.",
        buttonPositive: "OK",
      }
    );
    const VideosPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      {
        title: "Storage Permission",
        message: "App needs access to your storage to count files.",
        buttonPositive: "OK",
      }
    );
    const AudioPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      {
        title: "Storage Permission",
        message: "App needs access to your storage to count files.",
        buttonPositive: "OK",
      }
    );
    const granted = [
      ImagesPermission === PermissionsAndroid.RESULTS.GRANTED,
      VideosPermission === PermissionsAndroid.RESULTS.GRANTED,
      AudioPermission === PermissionsAndroid.RESULTS.GRANTED,
    ]
    return granted.every(Boolean);

  } catch (err) {
    console.error("Failed to request storage permission:", err);
    return false;
  }
};

export const getFileCounts = async (
  path = RNFS.ExternalStorageDirectoryPath
): Promise<FileCounts> => {
  try {
    if (!path) {
      throw new Error("Storage path is undefined.");
    }

    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      console.warn("Storage permission denied.");
      return {
        Photos: 0,
        Videos: 0,
        Audio: 0,
        Documents: 0,
        APKs: 0,
        Archives: 0,
      };
    }

    const pathExists = await RNFS.exists(path);
    if (!pathExists) {
      console.warn(`Path does not exist: ${path}`);
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
    } catch (err) {
      console.error(`Error reading directory at ${path}:`, err);
      return {
        Photos: 0,
        Videos: 0,
        Audio: 0,
        Documents: 0,
        APKs: 0,
        Archives: 0,
      };
    }

    if (!files || !Array.isArray(files)) {
      console.error(`RNFS.readDir returned null or non-array for path: ${path}`);
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
      if (!file || !file.name) continue;

      if (file.isFile()) {
        if (/\.(jpg|png|jpeg|gif|webp)$/i.test(file.name)) counts.Photos++;
        else if (/\.(mp4|mkv|mov|avi)$/i.test(file.name)) counts.Videos++;
        else if (/\.(mp3|wav|aac|ogg)$/i.test(file.name)) counts.Audio++;
        else if (/\.(pdf|docx|xlsx|pptx|txt)$/i.test(file.name)) counts.Documents++;
        else if (/\.apk$/i.test(file.name)) counts.APKs++;
        else if (/\.(zip|rar|7z|tar)$/i.test(file.name)) counts.Archives++;
      } else if (file.isDirectory()) {
        const subCounts = await getFileCounts(file.path);
        Object.keys(counts).forEach((key) => {
          counts[key as keyof FileCounts] += subCounts[key as keyof FileCounts] || 0;
        });
      }
    }

    return counts;
  } catch (error) {
    console.error("Error fetching file counts:", error);
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

export const formatFileSize = (size: number): string => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};
