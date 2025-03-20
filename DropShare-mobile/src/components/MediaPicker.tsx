import {
  ActivityIndicator,
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
import { screenWidth } from "../utils/Constants";

interface Category {
  name: string;
  icon: any;
  color: string;
  extensions: string[];
}

interface MediaPickerProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

interface filesSelect extends MediaPickerProps {
  selectToSend: RNFS.ReadDirItem | undefined;
  setSelectToSend: (selectToSend: RNFS.ReadDirItem | undefined) => void;
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

const MediaPicker = ({ visible, setVisible, setSelectToSend }: filesSelect) => {
  const [loading, setLoading] = useState(true);
  const { colorScheme } = useTheme();
  const [files, setFiles] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category>(
    categories[0]
  );
  const [selected, setSeleted] = useState<any>();

  useEffect(() => {
    const loadFiles = async () => {
      setLoading(true);
      const restrictedDirs = [
        "/storage/emulated/0/Android/data",
        "/storage/emulated/0/Android/obb",
      ];

      const fetchFiles = async (directory: string) => {
        try {
          if (restrictedDirs.includes(directory)) return [];

          const items = await RNFS.readDir(directory);
          if (!Array.isArray(items)) return [];

          let allFiles: any[] = [];

          for (const item of items) {
            if (
              item.isFile() &&
              selectedCategory.extensions.some((ext) => item.name.endsWith(ext))
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
        setFiles(fetchedFiles);
      } catch (error) {
        console.error("Error fetching files:", error);
      }

      setLoading(false);
    };

    loadFiles();
  }, [selectedCategory]);

  const styles = MediaPickerStyles(colorScheme);

  const handleSelection = () => {
    setVisible(false);
    setSelectToSend(selected);
  };

  return (
    <BottomSheet
      visible={visible}
      onRequestClose={() => setVisible(false)}
      height={550}
    >
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
            <Text style={styles.categoryText}>{category.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator color={Colors[colorScheme].tint} size={50} />
        </View>
      ) : (
        <ScrollView
          style={{ marginTop: 10 }}
          contentContainerStyle={styles.files}
          showsVerticalScrollIndicator={false}
        >
          {files.length > 0 ? (
            files.map((file) => (
              <TouchableOpacity
                onPress={() => {
                  selected?.path != file.path
                    ? setSeleted(file)
                    : setSeleted(undefined);
                }}
                key={file.path}
                style={[
                  styles.fileItem,
                  {
                    backgroundColor:
                      selected?.path == file.path
                        ? Colors[colorScheme].tint
                        : Colors[colorScheme].itemBackground,
                  },
                ]}
              >
                <Image src={`file://${file.path}`} height={40} width={40} />
                <Text style={styles.fileName}>{file.name}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={{ color: "#bbb", fontSize: 14 }}>No files Found</Text>
          )}
        </ScrollView>
      )}
      <TouchableOpacity
        onPress={handleSelection}
        disabled={!selected}
        style={{
          backgroundColor: Colors[colorScheme].tint,
          boxShadow: `0px 0px 20px ${Colors[colorScheme].tint}`,
          padding: 15,
          borderRadius: 20,
          width: "70%",
          marginTop: 10,
          opacity: !selected ? 0.5 : 1,
        }}
      >
        <Text
          style={{
            color: Colors[colorScheme].text,
            fontSize: 20,
            textAlign: "center",
          }}
        >
          Send
        </Text>
      </TouchableOpacity>
    </BottomSheet>
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
    categoryText: {
      color: Colors[colorScheme].text,
      fontSize: 14,
      textAlign: "center",
    },
    files: {
      gap: 5,
      width: "100%",
    },
    fileItem: {
      borderRadius: 10,
      alignItems: "center",
      flexDirection: "row",
      width: "100%",
      padding: 10,
      gap: 10,
    },
    fileName: {
      color: Colors[colorScheme].text,
      fontSize: 15,
      overflow: "hidden",
      width: screenWidth - 100,
    },
  });
