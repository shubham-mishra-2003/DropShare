import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useEffect, useState, useCallback, useRef } from "react";
import RNFS from "react-native-fs";
import { Colors } from "../../constants/Colors";
import { useTheme } from "../../hooks/ThemeProvider";
import Header from "../ui/Header";
import { goBack, navigate } from "../../utils/NavigationUtil";
import useSelectFile from "../../hooks/useSelectFile";
import { FilesStyles } from "../../constants/Styles";
import { formatFileSize, SAVE_PATH } from "../../utils/FileSystemUtil";
import LinearGradient from "react-native-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import StyledText from "../ui/StyledText";
import Icon from "../Icon";
import { icons } from "../../assets";

const ReceivedFile: React.FC = () => {
  const [receivedFiles, setReceivedFiles] = useState<RNFS.ReadDirItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { colorScheme } = useTheme();
  const styles = FilesStyles(colorScheme);
  const { selectedFiles, setSelectedFiles } = useSelectFile();
  const cacheRef = useRef<{
    files?: RNFS.ReadDirItem[];
    lastModified?: number;
  }>({});
  const isFetchingRef = useRef(false);

  const fetchFiles = useCallback(async (forceRefresh = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);

    try {
      const folderExists = await RNFS.exists(SAVE_PATH);
      if (!folderExists) {
        await RNFS.mkdir(SAVE_PATH);
        setReceivedFiles([]);
        cacheRef.current = { files: [], lastModified: Date.now() };
        await AsyncStorage.setItem("received_files", JSON.stringify([]));
        return;
      }
      const stat = await RNFS.stat(SAVE_PATH);
      const lastModified = stat.mtime || Date.now();
      if (
        !forceRefresh &&
        cacheRef.current.files &&
        cacheRef.current.lastModified &&
        cacheRef.current.lastModified >= lastModified
      ) {
        setReceivedFiles(cacheRef.current.files);
        setLoading(false);
        isFetchingRef.current = false;
        return;
      }

      const cachedData = await AsyncStorage.getItem("received_files");
      const cachedModified = await AsyncStorage.getItem(
        "received_files_lastModified"
      );
      if (
        cachedData &&
        cachedModified &&
        parseInt(cachedModified) >= lastModified &&
        !forceRefresh
      ) {
        const files = JSON.parse(cachedData);
        cacheRef.current = { files, lastModified: parseInt(cachedModified) };
        setReceivedFiles(files);
        setLoading(false);
        isFetchingRef.current = false;
        return;
      }

      const receivedFile = await RNFS.readDir(SAVE_PATH);
      setReceivedFiles(receivedFile);
      cacheRef.current = { files: receivedFile, lastModified };

      await AsyncStorage.setItem(
        "received_files",
        JSON.stringify(receivedFile)
      );
      await AsyncStorage.setItem(
        "received_files_lastModified",
        lastModified.toString()
      );
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      colors={Colors[colorScheme].linearGradientColors}
      style={{
        flex: 1,
        width: "100%",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: 14,
          backgroundColor: Colors[colorScheme].background,
          justifyContent: "center",
        }}
      >
        <TouchableOpacity
          onPress={goBack}
          style={{
            position: "absolute",
            left: 10,
            padding: 10,
          }}
        >
          <Icon source={icons.back} filter={1} height={20} width={20} />
        </TouchableOpacity>
        <StyledText text="Received Files" fontSize={24} fontWeight="bold" />
      </View>
      {loading ? (
        <ActivityIndicator color={Colors[colorScheme].tint} size="large" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => fetchFiles(true)}
              progressBackgroundColor={Colors[colorScheme].background}
              colors={[Colors[colorScheme].tint]}
            />
          }
        >
          {receivedFiles.length === 0 ? (
            <StyledText
              fontSize={16}
              fontWeight="bold"
              style={{
                textAlign: "center",
                marginTop: 20,
              }}
            >
              No files found in the folder
            </StyledText>
          ) : (
            <View style={styles.filesView}>
              {receivedFiles.map((file) => (
                <TouchableOpacity
                  onPress={() => {
                    if (
                      selectedFiles.some(
                        (selected) => selected.path === file.path
                      )
                    ) {
                      setSelectedFiles((prev) =>
                        prev.filter((selected) => selected.path !== file.path)
                      );
                    } else if (selectedFiles.length > 0) {
                      setSelectedFiles((prev) => [...prev, file]);
                    } else {
                      navigate("fileviewer", {
                        files: receivedFiles,
                        currentIndex: receivedFiles.findIndex(
                          (f) => f.path === file.path
                        ),
                      });
                    }
                  }}
                  onLongPress={() => {
                    if (
                      !selectedFiles.some(
                        (selected) => selected.path === file.path
                      )
                    ) {
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
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </LinearGradient>
  );
};

export default React.memo(ReceivedFile);
