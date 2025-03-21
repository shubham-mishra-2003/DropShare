import { Image, Platform, Text, TouchableOpacity, View } from "react-native";
import RNFS from "react-native-fs";
import Video from "react-native-video";
import { RouteProp, useRoute } from "@react-navigation/native";
import useSelectFile from "../../hooks/useSelectFile";
import { useTheme } from "../../hooks/ThemeProvider";
import { FilesViewerStyles } from "../../constants/Styles";
import { goBack } from "../../utils/NavigationUtil";
import Header from "../Header";
import { icons } from "../../assets";
import { Toast } from "../Toasts";
import ReactNativeBlobUtil from "react-native-blob-util";

type RootStackParamList = {
  FileViewer: { file: RNFS.ReadDirItem };
};

const FileViewer = () => {
  const route = useRoute<RouteProp<RootStackParamList, "FileViewer">>();
  const file = route.params?.file;

  if (!file) return null;

  const filePath = `file://${file.path}`;
  const fileExtension = file.name.split(".").pop()?.toLowerCase();
  const isImage = ["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(
    fileExtension || ""
  );
  const isPdf = fileExtension === "pdf";
  const isVideo = ["mp4", "mov", "avi", "mkv", "webm"].includes(
    fileExtension || ""
  );
  const isAudio = ["mp3", "wav", "aac", "ogg", "m4a"].includes(
    fileExtension || ""
  );

  const { setSelectedFiles } = useSelectFile();

  const openPdf = async (filePath = file.path) => {
    try {
      if (Platform.OS === "ios") {
        ReactNativeBlobUtil.ios.openDocument(`file://${filePath}`);
      } else {
        ReactNativeBlobUtil.android
          .actionViewIntent(filePath, "*/*")
          .then(() => console.log("File opened.."))
          .catch((err) => console.log(err));
      }
    } catch (error) {
      console.log("Error opening PDF:", error);
    }
  };
  const { colorScheme } = useTheme();
  const styles = FilesViewerStyles(colorScheme);

  const onClose = () => {
    goBack();
    setSelectedFiles([]);
  };
  return (
    <View style={styles.container}>
      <Header
        onPress={() => onClose()}
        menu
        page={file.name}
        filePath={filePath}
      />
      <View style={styles.content}>
        {isImage && <Image source={{ uri: filePath }} style={styles.image} />}
        {isVideo && (
          <Video
            style={styles.image}
            controls
            resizeMode="contain"
            source={{ uri: filePath }}
          ></Video>
        )}
        {isAudio && (
          <View style={styles.audioContainer}>
            <Image source={icons.audio} style={styles.audioImage} />
            <Video source={{ uri: filePath }} controls />
          </View>
        )}
        {isPdf && (
          <TouchableOpacity onPress={() => openPdf()}>
            <Text style={{ color: "#fff" }}>Open pdf viewer</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default FileViewer;
