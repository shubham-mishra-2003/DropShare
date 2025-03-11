import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  ScrollView,
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
    const fetchFiles = async (directory: string) => {
      try {
        const items = await RNFS.readDir(directory);
        let allFiles: any[] = [];
        const allowedExtensions = categories[category] || [];
        for (const item of items) {
          if (
            item.isFile() &&
            allowedExtensions.some((ext) => item.name.endsWith(ext))
          ) {
            allFiles.push({
              name: item.name,
              path: item.path,
              size: item.size,
              ctime: item.ctime,
              mtime: item.mtime,
            });
          } else if (item.isDirectory()) {
            const subFiles = await fetchFiles(item.path);
            allFiles = allFiles.concat(subFiles);
          }
        }
        return allFiles;
      } catch (error) {
        console.error("Error fetching files:", error);
        return [];
      }
    };

    const loadFiles = async () => {
      const rootPath = RNFS.ExternalStorageDirectoryPath;
      const fetchedFiles = await fetchFiles(rootPath);
      setFiles(fetchedFiles);
      setLoading(false);
    };

    loadFiles();
  }, [category]);

  const { selectedFiles, setSelectedFiles } = useSelectFile();

  return (
    <View style={styles.container}>
      <Header
        menu={selectedFiles ? true : false}
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
                  if (selectedFiles.includes(file.path)) {
                    setSelectedFiles((prev) =>
                      prev.filter((path) => path !== file.path)
                    );
                  } else if (selectedFiles.length > 0) {
                    setSelectedFiles((prev) => [...prev, file.path]);
                  } else {
                    navigate("fileviewer", { file });
                  }
                }}
                onLongPress={() => setSelectedFiles((prev) => [...prev, file])}
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
                    { opacity: selectedFiles ? 1 : 0 },
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
