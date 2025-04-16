// import {
//   ActivityIndicator,
//   Image,
//   ScrollView,
//   StyleSheet,
//   Text,
//   TouchableOpacity,
//   View,
// } from "react-native";
// import React, { useEffect, useState } from "react";
// import RNFS from "react-native-fs";
// import { icons } from "../assets";
// import BottomSheet from "./ui/BottomSheet";
// import { Colors } from "../constants/Colors";
// import { useTheme } from "../hooks/ThemeProvider";
// import { screenWidth } from "../utils/Constants";

// interface Category {
//   name: string;
//   icon: any;
//   color: string;
//   extensions: string[];
// }

// interface MediaPickerProps {
//   visible: boolean;
//   setVisible: (visible: boolean) => void;
//   selectToSend: RNFS.ReadDirItem[];
//   setSelectToSend: React.Dispatch<React.SetStateAction<RNFS.ReadDirItem[]>>; // Updated type
// }

// const categories: Category[] = [
//   {
//     name: "Photos",
//     icon: icons.photo,
//     color: "#4A90E2",
//     extensions: [".jpg", ".jpeg", ".png"],
//   },
//   {
//     name: "Videos",
//     icon: icons.video,
//     color: "#8B5CF6",
//     extensions: [".mp4", ".mkv", ".avi"],
//   },
//   {
//     name: "Audio",
//     icon: icons.audio,
//     color: "#E67E22",
//     extensions: [".mp3", ".wav", ".flac"],
//   },
//   {
//     name: "Documents",
//     icon: icons.document,
//     color: "#3498DB",
//     extensions: [".pdf", ".docx", ".txt"],
//   },
// ];

// const MediaPicker = ({
//   visible,
//   setVisible,
//   selectToSend,
//   setSelectToSend,
// }: MediaPickerProps) => {
//   const [loading, setLoading] = useState(true);
//   const { colorScheme } = useTheme();
//   const [files, setFiles] = useState<RNFS.ReadDirItem[]>([]);
//   const [selectedCategory, setSelectedCategory] = useState<Category>(
//     categories[0]
//   );

//   useEffect(() => {
//     const loadFiles = async () => {
//       setLoading(true);
//       const restrictedDirs = [
//         "/storage/emulated/0/Android/data",
//         "/storage/emulated/0/Android/obb",
//       ];

//       const fetchFiles = async (
//         directory: string
//       ): Promise<RNFS.ReadDirItem[]> => {
//         try {
//           if (restrictedDirs.includes(directory)) return [];
//           const items = await RNFS.readDir(directory);
//           if (!Array.isArray(items)) return [];

//           let allFiles: RNFS.ReadDirItem[] = [];
//           for (const item of items) {
//             if (
//               item.isFile() &&
//               selectedCategory.extensions.some((ext) => item.name.endsWith(ext))
//             ) {
//               allFiles.push(item);
//             } else if (item.isDirectory()) {
//               const subFiles = await fetchFiles(item.path);
//               allFiles = [...allFiles, ...subFiles];
//             }
//           }
//           return allFiles;
//         } catch (error) {
//           console.error(`Error reading directory ${directory}:`, error);
//           return [];
//         }
//       };

//       const rootPath = RNFS.ExternalStorageDirectoryPath;
//       if (!rootPath) {
//         console.error("ExternalStorageDirectoryPath is null or undefined");
//         setLoading(false);
//         return;
//       }

//       try {
//         const fetchedFiles = await fetchFiles(rootPath);
//         setFiles(fetchedFiles);
//       } catch (error) {
//         console.error("Error fetching files:", error);
//         setFiles([]);
//       } finally {
//         setLoading(false);
//       }
//     };

//     loadFiles();
//   }, [selectedCategory]);

//   const styles = MediaPickerStyles(colorScheme);

//   const toggleFileSelection = (file: RNFS.ReadDirItem) => {
//     setSelectToSend((prevSelected: RNFS.ReadDirItem[]) =>
//       prevSelected.some((f) => f.path === file.path)
//         ? prevSelected.filter((f) => f.path !== file.path)
//         : [...prevSelected, file]
//     );
//   };

//   const handleSelection = () => {
//     setVisible(false);
//   };

//   return (
//     <BottomSheet
//       visible={visible}
//       onRequestClose={() => setVisible(false)}
//       height={550}
//     >
//       <View style={styles.categoryTabs}>
//         {categories.map((category) => (
//           <TouchableOpacity
//             key={category.name}
//             style={[
//               styles.categoryButton,
//               selectedCategory.name === category.name &&
//                 styles.selectedCategory,
//             ]}
//             onPress={() => setSelectedCategory(category)}
//           >
//             <Text style={styles.categoryText}>{category.name}</Text>
//           </TouchableOpacity>
//         ))}
//       </View>

//       {loading ? (
//         <View style={styles.loadingContainer}>
//           <ActivityIndicator color={Colors[colorScheme].tint} size={50} />
//         </View>
//       ) : (
//         <ScrollView
//           style={{ marginTop: 10 }}
//           contentContainerStyle={styles.files}
//           showsVerticalScrollIndicator={false}
//         >
//           {files.length > 0 ? (
//             files.map((file) => (
//               <TouchableOpacity
//                 key={file.path}
//                 style={[
//                   styles.fileItem,
//                   {
//                     backgroundColor: selectToSend.some(
//                       (f) => f.path === file.path
//                     )
//                       ? Colors[colorScheme].tint
//                       : Colors[colorScheme].itemBackground,
//                   },
//                 ]}
//                 onPress={() => toggleFileSelection(file)}
//               >
//                 <Image
//                   source={{ uri: `file://${file.path}` }}
//                   style={{ height: 40, width: 40 }}
//                 />
//                 <Text style={styles.fileName}>{file.name}</Text>
//               </TouchableOpacity>
//             ))
//           ) : (
//             <Text style={styles.noFilesText}>No files found</Text>
//           )}
//         </ScrollView>
//       )}

//       <TouchableOpacity
//         onPress={handleSelection}
//         disabled={selectToSend.length === 0}
//         style={[
//           styles.sendButton,
//           { opacity: selectToSend.length === 0 ? 0.5 : 1 },
//         ]}
//       >
//         <Text style={styles.sendButtonText}>
//           Send {selectToSend.length} Files
//         </Text>
//       </TouchableOpacity>
//     </BottomSheet>
//   );
// };

// export default MediaPicker;

// const MediaPickerStyles = (colorScheme: "dark" | "light") =>
//   StyleSheet.create({
//     categoryTabs: {
//       flexDirection: "row",
//       justifyContent: "space-between",
//       width: "100%",
//       gap: 5,
//     },
//     categoryButton: {
//       paddingVertical: 8,
//       borderRadius: 5,
//       backgroundColor: Colors[colorScheme].itemBackground,
//       paddingHorizontal: 10,
//     },
//     selectedCategory: {
//       backgroundColor: Colors[colorScheme].tint,
//     },
//     categoryText: {
//       color: Colors[colorScheme].text,
//       fontSize: 14,
//       textAlign: "center",
//     },
//     files: {
//       gap: 5,
//       width: "100%",
//     },
//     fileItem: {
//       borderRadius: 10,
//       alignItems: "center",
//       flexDirection: "row",
//       width: "100%",
//       padding: 10,
//       gap: 10,
//     },
//     fileName: {
//       color: Colors[colorScheme].text,
//       fontSize: 15,
//       overflow: "hidden",
//       width: screenWidth - 100,
//     },
//     loadingContainer: {
//       flex: 1,
//       justifyContent: "center",
//       alignItems: "center",
//     },
//     noFilesText: {
//       color: "#bbb",
//       fontSize: 14,
//       textAlign: "center",
//     },
//     sendButton: {
//       backgroundColor: Colors[colorScheme].tint,
//       padding: 15,
//       borderRadius: 20,
//       width: "70%",
//       marginTop: 10,
//       alignSelf: "center",
//     },
//     sendButtonText: {
//       color: Colors[colorScheme].text,
//       fontSize: 20,
//       textAlign: "center",
//     },
//   });

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

const MediaPicker = ({
  visible,
  setVisible,
  selectToSend,
  setSelectToSend,
}: MediaPickerProps) => {
  const [loading, setLoading] = useState(true);
  const { colorScheme } = useTheme();
  const [files, setFiles] = useState<RNFS.ReadDirItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category>(
    categories[0]
  );

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

          let allFiles: RNFS.ReadDirItem[] = [];
          for (const item of items) {
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
        setFiles(fetchedFiles);
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
    <BottomSheet visible={visible} onRequestClose={handleClose} height={550}>
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
        <View style={styles.loadingContainer}>
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
                key={file.path}
                style={[
                  styles.fileItem,
                  {
                    backgroundColor: selectToSend.some(
                      (f) => f.path === file.path
                    )
                      ? Colors[colorScheme].tint
                      : Colors[colorScheme].itemBackground,
                  },
                ]}
                onPress={() => toggleFileSelection(file)}
              >
                <Image
                  source={{ uri: `file://${file.path}` }}
                  style={{ height: 40, width: 40 }}
                />
                <Text style={styles.fileName}>{file.name}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.noFilesText}>No files found</Text>
          )}
        </ScrollView>
      )}

      <TouchableOpacity
        onPress={handleSelection}
        disabled={selectToSend.length === 0}
        style={[
          styles.sendButton,
          { opacity: selectToSend.length === 0 ? 0.5 : 1 },
        ]}
      >
        <Text style={styles.sendButtonText}>
          Send {selectToSend.length} Files
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
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    noFilesText: {
      color: "#bbb",
      fontSize: 14,
      textAlign: "center",
    },
    sendButton: {
      backgroundColor: Colors[colorScheme].tint,
      padding: 15,
      borderRadius: 20,
      width: "70%",
      marginTop: 10,
      alignSelf: "center",
    },
    sendButtonText: {
      color: Colors[colorScheme].text,
      fontSize: 20,
      textAlign: "center",
    },
  });
