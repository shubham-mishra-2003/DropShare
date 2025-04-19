import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
  Alert,
  RefreshControl,
} from "react-native";
import RNFS from "react-native-fs";
import { useTheme } from "../../hooks/ThemeProvider";
import { FilesStyles } from "../../constants/Styles";
import useSelectFile from "../../hooks/useSelectFile";
import { Colors } from "../../constants/Colors";
import Header from "../ui/Header";
import { goBack, navigate } from "../../utils/NavigationUtil";
import { formatFileSize } from "../../utils/FileSystemUtil";
import { icons } from "../../assets";
import Icon from "../Icon";
import LinearGradient from "react-native-linear-gradient";
import StyledText from "../ui/StyledText";
import { RouteProp, useRoute } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

type RootStackParamList = {
  filelist: { params: { category: keyof typeof categories } };
};

const FilesList: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, "filelist">>();
  const { category } = route.params?.params || {};
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { colorScheme } = useTheme();
  const styles = FilesStyles(colorScheme);
  const { selectedFiles, setSelectedFiles } = useSelectFile();
  const cacheRef = useRef<{ [key: string]: any[] }>({});
  const isFetchingRef = useRef(false);

  const fetchFiles = useCallback(
    async (directory: string, category: keyof typeof categories) => {
      const restrictedDirs = [
        "/storage/emulated/0/Android/data",
        "/storage/emulated/0/Android/obb",
      ];
      try {
        if (restrictedDirs.includes(directory)) return [];
        const items = await RNFS.readDir(directory);
        if (!Array.isArray(items)) return [];

        const allFiles: any[] = [];
        const allowedExtensions = categories[category] || [];

        // Process files and directories concurrently
        const promises: Promise<any[]>[] = items.map(async (item) => {
          if (!item || !item.name || item.name.startsWith(".")) return [];
          if (
            item.isFile() &&
            allowedExtensions.some((ext: string) => item.name.endsWith(ext))
          ) {
            return [
              {
                name: item.name,
                path: item.path,
                size: item.size,
                ctime: item.ctime,
                mtime: item.mtime,
              },
            ];
          } else if (item.isDirectory()) {
            return fetchFiles(item.path, category);
          }
          return [];
        });

        const results = await Promise.all(promises);
        return allFiles.concat(...results);
      } catch (error) {
        console.error(`Error reading directory ${directory}:`, error);
        return [];
      }
    },
    []
  );

  const loadFiles = useCallback(async () => {
    if (isFetchingRef.current || !category) return;
    const cacheKey = `files_${category}`;

    // Check cache first
    if (cacheRef.current[cacheKey]) {
      setFiles(cacheRef.current[cacheKey]);
      setLoading(false);
      return;
    }

    // Check AsyncStorage for persisted cache
    try {
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        cacheRef.current[cacheKey] = parsedData;
        setFiles(parsedData);
        setLoading(false);
        return;
      }
    } catch (error) {
      console.error("Error reading from AsyncStorage:", error);
    }

    isFetchingRef.current = true;
    setLoading(true);
    try {
      const rootPath = RNFS.ExternalStorageDirectoryPath;
      if (!rootPath) {
        console.error("ExternalStorageDirectoryPath is null or undefined");
        return;
      }
      const fetchedFiles = await fetchFiles(rootPath, category);
      console.log("Fetched files:", fetchedFiles.length);
      setFiles(fetchedFiles);
      cacheRef.current[cacheKey] = fetchedFiles;

      // Persist to AsyncStorage
      await AsyncStorage.setItem(cacheKey, JSON.stringify(fetchedFiles));
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [category, fetchFiles]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const getThumbnail = (file: any) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (categories.Photos.includes(`.${extension}`))
      return { uri: `file://${file.path}` };
    if (categories.Videos.includes(`.${extension}`))
      return { uri: `file://${file.path}` };
    if (categories.Documents.includes(`.${extension}`)) return icons.document;
    if (categories.Audio.includes(`.${extension}`)) return icons.audio;
    if (categories.APKs.includes(`.${extension}`)) return icons.app;
    if (categories.Archives.includes(`.${extension}`)) return icons.archive;
    return icons.folder; // Fallback icon
  };

  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      colors={Colors[colorScheme].linearGradientColors}
      style={styles.container}
    >
      <Header
        menu={selectedFiles.length === 0 ? false : true}
        page={category}
        onPress={goBack}
      />
      {loading ? (
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={loadFiles}
              progressBackgroundColor={Colors[colorScheme].background}
              colors={[Colors[colorScheme].tint]}
            />
          }
          contentContainerStyle={styles.scrollContainer}
        >
          <View style={styles.filesView}>
            {files.length === 0 ? (
              <StyledText style={{ color: Colors[colorScheme].text }}>
                No files found
              </StyledText>
            ) : (
              files.map((file) => (
                <TouchableOpacity
                  onPress={() => {
                    if (selectedFiles.some((f) => f.path === file.path)) {
                      setSelectedFiles((prev) =>
                        prev.filter((f) => f.path !== file.path)
                      );
                    } else if (selectedFiles.length > 0) {
                      setSelectedFiles((prev) => [...prev, file]);
                    } else {
                      if (!files || files.length === 0) {
                        Alert.alert("Error", "No files available to view");
                        return;
                      }
                      navigate("fileviewer", {
                        files: files,
                        currentIndex: files.findIndex(
                          (f) => f.path === file.path
                        ),
                      });
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
                  <Image source={getThumbnail(file)} style={[styles.image]} />
                  <View style={styles.textView}>
                    <StyledText
                      fontWeight="bold"
                      isEllipsis
                      text={file.name}
                      style={{ width: "65%" }}
                    />
                    <StyledText
                      fontWeight="regular"
                      text={formatFileSize(file.size)}
                    />
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
              ))
            )}
          </View>
        </ScrollView>
      )}
    </LinearGradient>
  );
};

export default React.memo(FilesList);
