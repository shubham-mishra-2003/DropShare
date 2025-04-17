import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useEffect, useState } from "react";
import RNFS from "react-native-fs";
import { Colors } from "../../constants/Colors";
import { useTheme } from "../../hooks/ThemeProvider";
import Header from "../ui/Header";
import { goBack, navigate } from "../../utils/NavigationUtil";
import useSelectFile from "../../hooks/useSelectFile";
import { FilesStyles } from "../../constants/Styles";
import { formatFileSize, savePath } from "../../utils/FileSystemUtil";
import { Toast } from "../Toasts";
import LinearGradient from "react-native-linear-gradient";

const ReceivedFile = () => {
  const [receivedFiles, setReceivedFiles] = useState<RNFS.ReadDirItem[]>([]);
  const { colorScheme } = useTheme();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fetchFiles = async () => {
      const folderExists = await RNFS.exists(savePath);
      if (!folderExists) {
        RNFS.mkdir(savePath);
      } else {
        RNFS.readDir(savePath)
          .then((receivedFile) => {
            setReceivedFiles(receivedFile);
            setLoading(false);
          })
          .catch((error) => Toast(error));
      }
    };
    fetchFiles();
  }, []);

  const styles = FilesStyles(colorScheme);
  const { selectedFiles, setSelectedFiles } = useSelectFile();

  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      colors={Colors[colorScheme].linearGradientColors}
      style={{
        flex: 1,
        backgroundColor: Colors[colorScheme].background,
        width: "100%",
      }}
    >
      <Header page="Received" onPress={goBack} />
      {loading ? (
        <ActivityIndicator color={Colors[colorScheme].tint} size="large" />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {receivedFiles.length == 0 ? (
            <Text
              style={{
                fontSize: 15,
                fontWeight: "bold",
                textAlign: "center",
                color: "#bbb",
                marginTop: 20,
              }}
            >
              No files found in the Folder
            </Text>
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
                  onLongPress={() =>
                    setSelectedFiles((prev) => [...prev, file])
                  }
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
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </LinearGradient>
  );
};

export default ReceivedFile;
