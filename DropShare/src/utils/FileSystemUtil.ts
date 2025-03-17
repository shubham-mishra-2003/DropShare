import RNFS from "react-native-fs";
import { PermissionsAndroid, Platform } from "react-native";
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
    let granted = false;
    if (Platform.OS === "android") {
      if (Number(Platform.Version) >= 33) {
        const imagePermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          {
            title: "Image Access Required",
            message: "We need your permissions to serve you",
            buttonPositive: "Allow",
            buttonNegative: "Deny",
          }
        );
        const videoPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
          {
            title: "Video Access Required",
            message: "We need your permissions to serve you",
            buttonPositive: "Allow",
            buttonNegative: "Deny",
          }
        );
        const audioPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
          {
            title: "Audio Access Required",
            message: "We need your permissions to serve you",
            buttonPositive: "Allow",
            buttonNegative: "Deny",
          }
        );
        granted =
          imagePermission === PermissionsAndroid.RESULTS.GRANTED &&
          videoPermission === PermissionsAndroid.RESULTS.GRANTED &&
          audioPermission === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const storageReadPermissions = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: "Files Read Access Required",
            message: "We need your permissions to serve you",
            buttonPositive: "Allow",
            buttonNegative: "Deny",
          }
        );
        const storageWritePermissions = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: "Write Files Access Required",
            message: "We need your permissions to serve you",
            buttonPositive: "Allow",
            buttonNegative: "Deny",
          }
        );
        granted = storageReadPermissions === PermissionsAndroid.RESULTS.GRANTED && storageWritePermissions === PermissionsAndroid.RESULTS.GRANTED;
      }
      if (!granted) {
        Toast("Permission denied.");
      }
      return granted;
    }
    return false;
  } catch (err) {
    Toast("Failed to request storage permission. Please grant permission from settings.");
    return false;
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
      return { Photos: 0, Videos: 0, Audio: 0, Documents: 0, APKs: 0, Archives: 0 };
    }

    if (path.includes("/Android/data") || path.includes("/Android/obb")) {
      return { Photos: 0, Videos: 0, Audio: 0, Documents: 0, APKs: 0, Archives: 0 };
    }

    let files;
    try {
      files = await RNFS.readDir(path);
      if (!Array.isArray(files)) {
        return { Photos: 0, Videos: 0, Audio: 0, Documents: 0, APKs: 0, Archives: 0 };
      }
    } catch (err) {
      return { Photos: 0, Videos: 0, Audio: 0, Documents: 0, APKs: 0, Archives: 0 };
    }

    let counts: FileCounts = { Photos: 0, Videos: 0, Audio: 0, Documents: 0, APKs: 0, Archives: 0 };

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
    return { Photos: 0, Videos: 0, Audio: 0, Documents: 0, APKs: 0, Archives: 0 };
  }
};

export const formatFileSize = (size: number): string => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};
