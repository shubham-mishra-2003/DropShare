import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useEffect, useState } from "react";
import RNFS from "react-native-fs";
import { icons } from "../assets";
import BottomSheet from "./ui/BottomSheet";
import { Colors } from "../constants/Colors";
import { useTheme } from "../hooks/ThemeProvider";
import StyledText from "./ui/StyledText";
import { formatFileSize, getFileType } from "../utils/FileSystemUtil";
import Icon from "./Icon";

interface Category {
  name: string;
  icon: any;
  color: string;
  extensions: string[];
}

interface MediaPickerProps {
  selectToSend: RNFS.ReadDirItem[];
  setSelectToSend: React.Dispatch<React.SetStateAction<RNFS.ReadDirItem[]>>;
}

const categories: Category[] = [
  {
    name: "Photos",
    icon: icons.photo,
    color: "#4A90E2",
    extensions: [".jpg", ".jpeg", ".png"],
  },
  {
    name: "Videos",
    icon: icons.video,
    color: "#8B5CF6",
    extensions: [".mp4", ".mkv", ".avi"],
  },
  {
    name: "Audio",
    icon: icons.audio,
    color: "#E67E22",
    extensions: [".mp3", ".wav", ".flac"],
  },
  {
    name: "Documents",
    icon: icons.document,
    color: "#3498DB",
    extensions: [".pdf", ".docx", ".txt"],
  },
];

const MediaPicker = ({ selectToSend, setSelectToSend }: MediaPickerProps) => {
  const [loading, setLoading] = useState(true);
  const { colorScheme } = useTheme();
  const [files, setFiles] = useState<RNFS.ReadDirItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category>(
    categories[0]
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const loadFiles = async () => {
      setLoading(true);
      const restrictedDirs = [
        "/storage/emulated/0/Android/data",
        "/storage/emulated/0/Android/obb",
      ];

      const fetchFiles = async (
        directory: string
      ): Promise<RNFS.ReadDirItem[]> => {
        try {
          if (restrictedDirs.includes(directory)) return [];
          const items = await RNFS.readDir(directory);
          if (!Array.isArray(items)) return [];
          const filteredItems = items.filter(
            (item) =>
              !item.name.startsWith(".") &&
              !item.name.startsWith("._") &&
              !item.name.endsWith("~")
          );

          let allFiles: RNFS.ReadDirItem[] = [];
          for (const item of filteredItems) {
            if (
              item.isFile() &&
              selectedCategory.extensions.some((ext) => item.name.endsWith(ext))
            ) {
              allFiles.push(item);
            } else if (item.isDirectory()) {
              const subFiles = await fetchFiles(item.path);
              allFiles = [...allFiles, ...subFiles];
            }
          }
          return allFiles;
        } catch (error) {
          console.error(`Error reading directory ${directory}:`, error);
          return [];
        }
      };

      const rootPath = RNFS.ExternalStorageDirectoryPath;
      if (!rootPath) {
        console.error("ExternalStorageDirectoryPath is null or undefined");
        setLoading(false);
        return;
      }

      try {
        const fetchedFiles = await fetchFiles(rootPath);
        const sortedFiles = fetchedFiles.sort((a, b) => {
          const timeA = a.mtime?.getTime() || 0;
          const timeB = b.mtime?.getTime() || 0;
          return timeB - timeA;
        });
        setFiles(sortedFiles);
      } catch (error) {
        console.error("Error fetching files:", error);
        setFiles([]);
      } finally {
        setLoading(false);
      }
    };
    if (visible) {
      loadFiles();
    }
  }, [selectedCategory, visible]);

  const styles = MediaPickerStyles(colorScheme);

  const toggleFileSelection = (file: RNFS.ReadDirItem) => {
    setSelectToSend((prevSelected: RNFS.ReadDirItem[]) =>
      prevSelected.some((f) => f.path === file.path)
        ? prevSelected.filter((f) => f.path !== file.path)
        : [...prevSelected, file]
    );
  };

  const handleSelection = () => {
    setVisible(false);
  };

  const handleClose = () => {
    setVisible(false);
    setSelectToSend([]);
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(!visible)}
        style={{
          padding: 15,
          backgroundColor: Colors[colorScheme].tint,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          width: "45%",
        }}
      >
        <StyledText fontSize={20} fontWeight="bold" text="Select to Send" />
      </TouchableOpacity>
      <BottomSheet visible={visible} onRequestClose={handleClose} height={550}>
        <View style={{ gap: 10, flex: 1, width: "100%" }}>
          <View style={styles.categoryTabs}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.name}
                style={[
                  styles.categoryButton,
                  selectedCategory.name === category.name &&
                    styles.selectedCategory,
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <StyledText fontSize={16} isEllipsis fontWeight="bold">
                  {category.name}
                </StyledText>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flex: 1, width: "100%" }}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={Colors[colorScheme].tint} size={50} />
              </View>
            ) : (
              <FlatList
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <StyledText
                    fontSize={20}
                    fontWeight="bold"
                    style={{ textAlign: "center" }}
                    text="No files available to share"
                  />
                }
                keyExtractor={(file) => file.path}
                data={files}
                style={{ flex: 1 }}
                contentContainerStyle={{
                  gap: 5,
                  width: "100%",
                }}
                renderItem={(file) => (
                  <TouchableOpacity
                    key={file.item.path}
                    style={[
                      styles.fileItem,
                      {
                        backgroundColor: selectToSend.some(
                          (f) => f.path === file.item.path
                        )
                          ? Colors[colorScheme].tint
                          : Colors[colorScheme].transparent,
                      },
                    ]}
                    onPress={() => toggleFileSelection(file.item)}
                  >
                    <View
                      style={{
                        flex: 1,
                        width: "100%",
                        flexDirection: "row",
                        gap: 10,
                        overflow: "hidden",
                      }}
                    >
                      {getFileType(file.item) == "audio" ? (
                        <Icon
                          filter={1}
                          source={icons.audio}
                          height={40}
                          width={30}
                        />
                      ) : getFileType(file.item) == "document" ? (
                        <Icon
                          filter={1}
                          height={40}
                          source={icons.document}
                          width={30}
                        />
                      ) : (
                        <Image
                          source={{ uri: `file://${file.item.path}` }}
                          style={{ height: 50, width: 50, borderRadius: 10 }}
                        />
                      )}
                      <StyledText
                        style={{ width: "80%" }}
                        fontSize={16}
                        fontWeight="bold"
                        isEllipsis
                      >
                        {file.item.name}
                      </StyledText>
                    </View>
                    <StyledText>{formatFileSize(file.item.size)}</StyledText>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
          <TouchableOpacity
            onPress={handleSelection}
            disabled={selectToSend.length === 0}
            style={[
              styles.sendButton,
              { opacity: selectToSend.length === 0 ? 0.5 : 1 },
            ]}
          >
            <StyledText
              fontSize={20}
              fontWeight="bold"
              isEllipsis
              style={{ textAlign: "center" }}
            >
              Selected {selectToSend.length} Files
            </StyledText>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </>
  );
};

export default MediaPicker;

const MediaPickerStyles = (colorScheme: "dark" | "light") =>
  StyleSheet.create({
    categoryTabs: {
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
      gap: 5,
    },
    categoryButton: {
      paddingVertical: 8,
      borderRadius: 5,
      backgroundColor: Colors[colorScheme].itemBackground,
      paddingHorizontal: 10,
    },
    selectedCategory: {
      backgroundColor: Colors[colorScheme].tint,
    },
    fileItem: {
      borderRadius: 10,
      padding: 10,
      gap: 10,
      flexDirection: "row",
      justifyContent: "space-between",
      height: 70,
      alignItems: "center",
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    sendButton: {
      backgroundColor: Colors[colorScheme].tint,
      padding: 15,
      borderRadius: 20,
      width: "70%",
      alignSelf: "center",
    },
  });
