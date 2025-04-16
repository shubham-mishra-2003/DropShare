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
import Header from "../ui/Header";
import { goBack, navigate } from "../../utils/NavigationUtil";
import useSelectFile from "../../hooks/useSelectFile";
import { FilesStyles } from "../../constants/Styles";
import { formatFileSize } from "../../utils/FileSystemUtil";
import { Toast } from "../Toasts";

const RecievedFile = () => {
  const path = `${RNFS.ExternalStorageDirectoryPath}/Dropshare`;
  const [recievedFiles, setRecievedFiles] = useState<RNFS.ReadDirItem[]>([]);
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
          .then((recievedFile) => {
            setRecievedFiles(recievedFile);
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
      <Header page="Recieved" onPress={goBack} />
      {loading ? (
        <ActivityIndicator color={Colors[colorScheme].tint} size="large" />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {recievedFiles.length == 0 ? (
            <Text
              style={{
                fontSize: 20,
                fontWeight: "bold",
                textAlign: "center",
                color: "#bbb",
              }}
            >
              No files in the Folder
            </Text>
          ) : (
            <View style={styles.filesView}>
              {recievedFiles.map((file) => (
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

export default RecievedFile;
