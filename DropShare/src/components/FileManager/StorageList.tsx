import React, { useEffect, useState } from "react";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import RNFS from "react-native-fs";
import { BackHandler } from "react-native";
import { useFocusEffect, useRoute } from "@react-navigation/native";

import CreateFile from "./CreateFile";
import { useTheme } from "../../hooks/ThemeProvider";
import { FilesListStyles } from "../../constants/Styles";
import { Toast } from "../Toasts";
import useSelectFile from "../../hooks/useSelectFile";
import { goBack, navigate } from "../../utils/NavigationUtil";
import Header from "../Header";
import { Colors } from "../../constants/Colors";
import Icon from "../Icon";
import { icons } from "../../assets";
import useCurrentPath from "../../hooks/useCurrentPath";

const StorageList = () => {
  const { colorScheme } = useTheme();
  const [createVisible, setCreateVisible] = useState(false);
  const styles = FilesListStyles(colorScheme);
  const [files, setFiles] = useState<RNFS.ReadDirItem[]>([]);
  const { currentPath, setCurrentPath } = useCurrentPath(RNFS.ExternalStorageDirectoryPath);

  const goBackDirectory = () => {
    if (currentPath === RNFS.ExternalStorageDirectoryPath) return;
    const parentPath = currentPath.substring(0, currentPath.lastIndexOf("/"));
    setCurrentPath(parentPath || RNFS.ExternalStorageDirectoryPath);
  };

  const getFiles = async () => {
    RNFS.readDir(currentPath)
      .then((files) => {
        setFiles(files);
      })
      .catch((err) => {
        Toast(`${err.message} - ${err.code}`);
      });
  };

  const { selectedFiles, setSelectedFiles } = useSelectFile();

  useEffect(() => {
    getFiles();
  }, [currentPath, createVisible]);

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (currentPath === RNFS.ExternalStorageDirectoryPath) {
          goBack();
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

  return (
    <SafeAreaView style={styles.view}>
      <Header
        page="Internal Storage"
        onPress={() =>
          currentPath == RNFS.ExternalStorageDirectoryPath
            ? goBack()
            : goBackDirectory()
        }
      />
      <Text style={{ color: "#fff" }}>{currentPath}</Text>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 5 }}>
        {files.map((file) => (
          <TouchableOpacity
            key={file.path}
            onLongPress={() => setSelectedFiles((prev) => [...prev, file])}
            style={{
              backgroundColor: selectedFiles.some((f) => f.path === file.path)
                ? Colors[colorScheme].tint
                : Colors[colorScheme].itemBackground,
              margin: 5,
              padding: 10,
              borderRadius: 12,
              borderBottomWidth: 1,
              borderBottomColor: Colors[colorScheme].transparent,
            }}
            onPress={() => {
              if (selectedFiles.some((f) => f.path === file.path)) {
                setSelectedFiles((prev) =>
                  prev.filter((f) => f.path !== file.path)
                );
              } else if (selectedFiles.length > 0) {
                setSelectedFiles((prev) => [...prev, file]);
              } else {
                file.isDirectory()
                  ? setCurrentPath(file.path)
                  : navigate("fileviewer", { file });
              }
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              {file.isDirectory() ? (
                <Icon
                  source={
                    selectedFiles.some((f) => f.path === file.path)
                      ? icons.folderCheck
                      : icons.folder
                  }
                  height={50}
                  width={50}
                  filter={1}
                />
              ) : (
                <Image
                  source={{ uri: `file://${file.path}` }}
                  style={{ width: 50, height: 50, borderRadius: 8 }}
                />
              )}
              <Text style={{ color: "#fff" }}>{file.name}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
    </SafeAreaView>
  );
};

export default StorageList;
