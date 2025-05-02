import React, { useEffect, useState, useCallback } from "react";
import {
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import RNFS from "react-native-fs";
import { BackHandler } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import CreateFile from "./CreateFolder";
import { useTheme } from "../../hooks/ThemeProvider";
import { FilesListStyles } from "../../constants/Styles";
import { Toast } from "../Toasts";
import useSelectFile from "../../hooks/useSelectFile";
import useSettingsButton from "../../hooks/useSettingsButton";
import { goBack, navigate, resetAndNavigate } from "../../utils/NavigationUtil";
import Header from "../ui/Header";
import { Colors } from "../../constants/Colors";
import Icon from "../Icon";
import { icons } from "../../assets";
import useCurrentPath from "../../hooks/useCurrentPath";
import LinearGradient from "react-native-linear-gradient";
import StyledText from "../ui/StyledText";
import { formatFileSize, getFileType } from "../../utils/FileSystemUtil";
import FilesHeader from "./FilesHeader";

const StorageList = () => {
  const { colorScheme } = useTheme();
  const [createVisible, setCreateVisible] = useState(false);
  const styles = FilesListStyles(colorScheme);
  const [files, setFiles] = useState<RNFS.ReadDirItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { currentPath, setCurrentPath } = useCurrentPath(
    RNFS.ExternalStorageDirectoryPath
  );
  const { selectedFiles, setSelectedFiles } = useSelectFile();
  const { settings } = useSettingsButton();
  const [showOptions, setShowOptions] = useState(false);
  const goBackDirectory = () => {
    if (currentPath === RNFS.ExternalStorageDirectoryPath) return;
    const parentPath = currentPath.substring(0, currentPath.lastIndexOf("/"));
    setCurrentPath(parentPath || RNFS.ExternalStorageDirectoryPath);
  };

  const getFiles = async () => {
    setIsLoading(true);
    try {
      const files = await RNFS.readDir(currentPath);
      const filteredFiles = settings.showHiddenFiles
        ? files
        : files.filter((file) => !file.name.startsWith("."));
      setFiles(filteredFiles.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      Toast(err as string);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getFiles();
  }, [currentPath, createVisible, settings.showHiddenFiles]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (currentPath === RNFS.ExternalStorageDirectoryPath) {
          resetAndNavigate("home");
        } else {
          goBackDirectory();
          return true;
        }
      };
      const backFunction = () => {
        if (selectedFiles.length > 0) {
          setSelectedFiles([]);
          return true;
        }
        return onBackPress();
      };
      const backhandler = BackHandler.addEventListener(
        "hardwareBackPress",
        backFunction
      );
      return () => backhandler.remove();
    }, [currentPath, selectedFiles])
  );

  useEffect(() => {
    if (selectedFiles.length > 0) {
      setShowOptions(true);
    } else {
      setShowOptions(false);
    }
  }, [selectedFiles]);

  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      colors={Colors[colorScheme].linearGradientColors}
      style={styles.view}
    >
      <FilesHeader
        onPressInput={() =>
          currentPath == RNFS.ExternalStorageDirectoryPath
            ? goBack()
            : goBackDirectory()
        }
        heading="Internal Storage"
        showOptions={showOptions}
        setShowOptions={setShowOptions}
      />
      <StyledText fontWeight="bold" fontSize={16} text={currentPath} />
      {isLoading ? (
        <ActivityIndicator
          size="large"
          color={Colors[colorScheme].tint}
          style={{ marginTop: 20 }}
        />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={getFiles}
              progressBackgroundColor={Colors[colorScheme].background}
              colors={[Colors[colorScheme].tint]}
            />
          }
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 5 }}
        >
          {files.length === 0 && (
            <StyledText
              fontSize={20}
              fontWeight="bold"
              text="No files found"
              style={{ textAlign: "center", marginTop: 20 }}
            />
          )}
          {files.map((file) => (
            <TouchableOpacity
              key={file.path}
              onLongPress={() => setSelectedFiles((prev) => [...prev, file])}
              style={{
                backgroundColor: selectedFiles.some((f) => f.path === file.path)
                  ? Colors[colorScheme].tint
                  : Colors[colorScheme].transparent,
                margin: 3,
                padding: 5,
                height: 65,
                justifyContent: "center",
                borderRadius: 12,
              }}
              onPress={() => {
                if (selectedFiles.some((f) => f.path === file.path)) {
                  setSelectedFiles((prev) =>
                    prev.filter((f) => f.path !== file.path)
                  );
                } else if (selectedFiles.length > 0) {
                  setSelectedFiles((prev) => [...prev, file]);
                } else {
                  if (file.isDirectory()) {
                    setCurrentPath(file.path);
                  } else {
                    navigate("fileviewer", {
                      files: files.filter((f) => !f.isDirectory()),
                      currentIndex: files
                        .filter((f) => !f.isDirectory())
                        .findIndex((f) => f.path === file.path),
                    });
                  }
                }
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  height: "100%",
                }}
              >
                {getFileType(file) === "photo" ||
                getFileType(file) === "video" ? (
                  <Image
                    source={{ uri: `file://${file.path}` }}
                    style={{ width: "18%", height: "100%", borderRadius: 8 }}
                  />
                ) : (
                  <Icon
                    source={
                      getFileType(file) == "audio"
                        ? icons.audio
                        : getFileType(file) == "apk"
                        ? icons.app
                        : getFileType(file) == "archive"
                        ? icons.zip
                        : getFileType(file) == "document"
                        ? icons.document
                        : icons.folder
                    }
                    height={40}
                    width={60}
                    filter={1}
                    resizeMode="contain"
                  />
                )}
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    overflow: "hidden",
                    gap: 10,
                    alignItems: "center",
                    paddingHorizontal: 5,
                  }}
                >
                  <StyledText
                    fontWeight="bold"
                    isEllipsis
                    text={file.name}
                    style={{ width: "65%" }}
                    fontSize={20}
                  />
                  {selectedFiles.some((f) => f.path === file.path) ? (
                    <Icon
                      filter={1}
                      source={icons.check}
                      height={25}
                      width={25}
                    />
                  ) : (
                    !file.isDirectory() && (
                      <StyledText
                        fontWeight="regular"
                        text={formatFileSize(file.size)}
                      />
                    )
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <TouchableOpacity
        style={styles.fileAddbtn}
        onPress={() => setCreateVisible(!createVisible)}
      >
        <Icon source={icons.folderPlus} height={40} width={40} filter={1} />
      </TouchableOpacity>
      <CreateFile
        path={currentPath}
        createVisible={createVisible}
        setCreateVisible={setCreateVisible}
      />
    </LinearGradient>
  );
};

export default StorageList;
