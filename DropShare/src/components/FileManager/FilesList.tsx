import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
} from "react-native";
import RNFS from "react-native-fs";

import { useTheme } from "../../hooks/ThemeProvider";
import { FilesStyles } from "../../constants/Styles";
import useSelectFile from "../../hooks/useSelectFile";
import { Colors } from "../../constants/Colors";
import Header from "../Header";
import { goBack, navigate } from "../../utils/NavigationUtil";
import { formatFileSize } from "../../utils/FileSystemUtil";
import { icons } from "../../assets";
import Icon from "../Icon";
import ReactNativeBlobUtil from "react-native-blob-util";

const categories = {
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

const FilesList = ({
  route,
}: {
  route: { params: { category: keyof typeof categories } };
}) => {
  const { category } = route.params;
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { colorScheme } = useTheme();
  const styles = FilesStyles(colorScheme);

  useEffect(() => {
    const loadFiles = async () => {
      const restrictedDirs = [
        "/storage/emulated/0/Android/data",
        "/storage/emulated/0/Android/obb",
      ];
      const fetchFiles = async (
        directory: string,
        category: keyof typeof categories
      ) => {
        try {
          if (restrictedDirs.includes(directory)) {
            return [];
          }
          const items = await RNFS.readDir(directory);
          if (!Array.isArray(items)) {
            return [];
          }

          let allFiles: any[] = [];
          const allowedExtensions = categories[category] || [];

          for (const item of items) {
            if (
              item.isFile() &&
              allowedExtensions.some((ext: string) => item.name.endsWith(ext))
            ) {
              allFiles.push({
                name: item.name,
                path: item.path,
                size: item.size,
                ctime: item.ctime,
                mtime: item.mtime,
              });
            } else if (item.isDirectory()) {
              const subFiles = await fetchFiles(item.path, category);
              allFiles = allFiles.concat(subFiles);
            }
          }

          return allFiles;
        } catch (error) {
          console.error(`Error reading directory ${directory}:`, error);
          return [];
        }
      };
      if (!category) {
        console.error("Category is undefined");
        setLoading(false);
        return;
      }
      const rootPath = RNFS.ExternalStorageDirectoryPath;
      if (!rootPath) {
        console.error("ExternalStorageDirectoryPath is null or undefined");
        setLoading(false);
        return;
      }

      try {
        const fetchedFiles = await fetchFiles(rootPath, category);
        setFiles(fetchedFiles);
      } catch (error) {
        console.error("Error fetching files:", error);
      }

      setLoading(false);
    };

    loadFiles();
  }, [category]);

  const { selectedFiles, setSelectedFiles } = useSelectFile();

  return (
    <View style={styles.container}>
      <Header
        menu={selectedFiles.length == 0 ? false : true}
        page={category}
        onPress={goBack}
      />
      {loading ? (
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.filesView}>
            {files.map((file) => (
              <TouchableOpacity
                onPress={() => {
                  if (selectedFiles.some((f) => f.path === file.path)) {
                    setSelectedFiles((prev) =>
                      prev.filter((f) => f.path !== file.path)
                    );
                  } else if (selectedFiles.length > 0) {
                    setSelectedFiles((prev) => [...prev, file]);
                  } else {
                    navigate("fileviewer", { file });
                  }
                }}
                onLongPress={() => {
                  if (!selectedFiles.some((f) => f.path === file.path)) {
                    setSelectedFiles((prev) => [...prev, file]);
                  }
                }}
                style={styles.fileItem}
                key={file.path}
              >
                <Image
                  source={{ uri: `file://${file.path}` }}
                  style={styles.image}
                />
                <View style={styles.textView}>
                  <Text style={styles.text}>{formatFileSize(file.size)}</Text>
                </View>
                <View
                  style={[
                    styles.dynamicIcon,
                    {
                      opacity: selectedFiles.some((f) => f.path === file.path)
                        ? 1
                        : 0,
                    },
                  ]}
                >
                  <Icon
                    source={icons.check}
                    height={20}
                    width={20}
                    filter={1}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

export default FilesList;
