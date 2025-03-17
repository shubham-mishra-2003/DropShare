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
import { Colors } from "../../constants/Colors";
import { useTheme } from "../../hooks/ThemeProvider";
import Header from "../Header";
import { goBack, navigate } from "../../utils/NavigationUtil";
import useSelectFile from "../../hooks/useSelectFile";
import { FilesStyles } from "../../constants/Styles";
import { formatFileSize } from "../../utils/FileSystemUtil";
import { Toast } from "../Toasts";

const ReceivedFile = () => {
  const path = `${RNFS.ExternalStorageDirectoryPath}/Android/media/com.Dropshare/received`;
  const [receivedFiles, setReceivedFiles] = useState<RNFS.ReadDirItem[]>([]);
  const { colorScheme } = useTheme();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fetchFiles = async () => {
      const folderExists = await RNFS.exists(path);
      if (!folderExists) {
        RNFS.mkdir(path);
      } else {
        RNFS.readDir(path)
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
    <View
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
                      navigate("fileviewer", { file });
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
    </View>
  );
};

export default ReceivedFile;
