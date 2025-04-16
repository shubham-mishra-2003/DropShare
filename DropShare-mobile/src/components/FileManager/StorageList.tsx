// import React, { useEffect, useState } from "react";
// import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
// import { SafeAreaView } from "react-native-safe-area-context";
// import RNFS from "react-native-fs";
// import { BackHandler } from "react-native";
// import { useFocusEffect, useRoute } from "@react-navigation/native";

// import CreateFile from "./CreateFile";
// import { useTheme } from "../../hooks/ThemeProvider";
// import { FilesListStyles } from "../../constants/Styles";
// import { Toast } from "../Toasts";
// import useSelectFile from "../../hooks/useSelectFile";
// import { goBack, navigate } from "../../utils/NavigationUtil";
// import Header from "../ui/Header";
// import { Colors } from "../../constants/Colors";
// import Icon from "../Icon";
// import { icons } from "../../assets";
// import useCurrentPath from "../../hooks/useCurrentPath";
// import LinearGradient from "react-native-linear-gradient";
// import StyledText from "../ui/StyledText";

// const StorageList = () => {
//   const { colorScheme } = useTheme();
//   const [createVisible, setCreateVisible] = useState(false);
//   const styles = FilesListStyles(colorScheme);
//   const [files, setFiles] = useState<RNFS.ReadDirItem[]>([]);
//   const { currentPath, setCurrentPath } = useCurrentPath(
//     RNFS.ExternalStorageDirectoryPath
//   );

//   const goBackDirectory = () => {
//     if (currentPath === RNFS.ExternalStorageDirectoryPath) return;
//     const parentPath = currentPath.substring(0, currentPath.lastIndexOf("/"));
//     setCurrentPath(parentPath || RNFS.ExternalStorageDirectoryPath);
//   };

//   const getFiles = async () => {
//     RNFS.readDir(currentPath)
//       .then((files) => {
//         setFiles(files);
//       })
//       .catch((err) => {
//         Toast(`${err.message} - ${err.code}`);
//       });
//   };

//   const { selectedFiles, setSelectedFiles } = useSelectFile();

//   useEffect(() => {
//     getFiles();
//   }, [currentPath, createVisible]);

//   useFocusEffect(
//     React.useCallback(() => {
//       const onBackPress = () => {
//         if (currentPath === RNFS.ExternalStorageDirectoryPath) {
//           goBack();
//         } else {
//           goBackDirectory();
//           return true;
//         }
//       };
//       const backFunction = () => {
//         if (selectedFiles.length > 0) {
//           setSelectedFiles([]);
//           return true;
//         }
//         return onBackPress();
//       };
//       const backhandler = BackHandler.addEventListener(
//         "hardwareBackPress",
//         backFunction
//       );
//       return () => backhandler.remove();
//     }, [currentPath, selectedFiles])
//   );

//   return (
//     <LinearGradient
//       start={{ x: 0, y: 0 }}
//       end={{ x: 1, y: 1 }}
//       colors={Colors[colorScheme].linearGradientColors}
//       style={styles.view}
//     >
//       <Header
//         page="Internal Storage"
//         onPress={() =>
//           currentPath == RNFS.ExternalStorageDirectoryPath
//             ? goBack()
//             : goBackDirectory()
//         }
//       />
//       <StyledText fontWeight="bold" fontSize={16} text={currentPath} />
//       <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 5 }}>
//         {files.map((file) => (
//           <TouchableOpacity
//             key={file.path}
//             onLongPress={() => setSelectedFiles((prev) => [...prev, file])}
//             style={{
//               backgroundColor: selectedFiles.some((f) => f.path === file.path)
//                 ? Colors[colorScheme].tint
//                 : Colors[colorScheme].transparent,
//               margin: 5,
//               padding: 10,
//               borderRadius: 12,
//             }}
//             onPress={() => {
//               if (selectedFiles.some((f) => f.path === file.path)) {
//                 setSelectedFiles((prev) =>
//                   prev.filter((f) => f.path !== file.path)
//                 );
//               } else if (selectedFiles.length > 0) {
//                 setSelectedFiles((prev) => [...prev, file]);
//               } else {
//                 file.isDirectory()
//                   ? setCurrentPath(file.path)
//                   : navigate("fileviewer", { file });
//               }
//             }}
//           >
//             {selectedFiles.some((f) => f.path === file.path) && (
//               <Image
//                 source={icons.check}
//                 style={{
//                   filter: "invert(1)",
//                   position: "absolute",
//                   bottom: 22,
//                   right: 15,
//                 }}
//               />
//             )}
//             <View
//               style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
//             >
//               {file.isDirectory() ? (
//                 <Icon source={icons.folder} height={50} width={50} filter={1} />
//               ) : (
//                 <Image
//                   source={{ uri: `file://${file.path}` }}
//                   style={{ width: 50, height: 50, borderRadius: 8 }}
//                 />
//               )}
//               <StyledText fontWeight="bold" fontSize={20}>
//                 {file.name}
//               </StyledText>
//             </View>
//           </TouchableOpacity>
//         ))}
//       </ScrollView>
//       <TouchableOpacity
//         style={styles.fileAddbtn}
//         onPress={() => setCreateVisible(!createVisible)}
//       >
//         <Icon source={icons.folderPlus} height={40} width={40} filter={1} />
//       </TouchableOpacity>
//       <CreateFile
//         path={currentPath}
//         createVisible={createVisible}
//         setCreateVisible={setCreateVisible}
//       />
//     </LinearGradient>
//   );
// };

// export default StorageList;

import React, { useEffect, useState, useCallback } from "react";
import {
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import RNFS from "react-native-fs";
import { BackHandler } from "react-native";
import { useFocusEffect, useRoute } from "@react-navigation/native";

import CreateFile from "./CreateFile";
import { useTheme } from "../../hooks/ThemeProvider";
import { FilesListStyles } from "../../constants/Styles";
import { Toast } from "../Toasts";
import useSelectFile from "../../hooks/useSelectFile";
import useSettingsButton from "../../hooks/useSettingsButton"; // Import the settings hook
import { goBack, navigate } from "../../utils/NavigationUtil";
import Header from "../ui/Header";
import { Colors } from "../../constants/Colors";
import Icon from "../Icon";
import { icons } from "../../assets";
import useCurrentPath from "../../hooks/useCurrentPath";
import LinearGradient from "react-native-linear-gradient";
import StyledText from "../ui/StyledText";

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
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      colors={Colors[colorScheme].linearGradientColors}
      style={styles.view}
    >
      <Header
        page="Internal Storage"
        onPress={() =>
          currentPath == RNFS.ExternalStorageDirectoryPath
            ? goBack()
            : goBackDirectory()
        }
      />
      <StyledText fontWeight="bold" fontSize={16} text={currentPath} />
      {isLoading ? (
        <ActivityIndicator
          size="large"
          color={Colors[colorScheme].tint}
          style={{ marginTop: 20 }}
        />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 5 }}>
          {files.length === 0 && (
            <StyledText
              fontSize={16}
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
                margin: 5,
                padding: 10,
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
              {selectedFiles.some((f) => f.path === file.path) && (
                <Image
                  source={icons.check}
                  height={20}
                  width={20}
                  style={{
                    position: "absolute",
                    bottom: 22,
                    right: 15,
                  }}
                />
              )}
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                {file.isDirectory() ? (
                  <Icon
                    source={icons.folder}
                    height={50}
                    width={50}
                    filter={1}
                  />
                ) : (
                  <Image
                    source={{ uri: `file://${file.path}` }}
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 8,
                      backgroundColor: Colors[colorScheme].background,
                    }}
                    onError={() => (
                      <Icon
                        source={icons.document}
                        height={50}
                        width={50}
                        filter={1}
                      />
                    )}
                  />
                )}
                <StyledText fontWeight="bold" fontSize={20}>
                  {file.name}
                </StyledText>
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
