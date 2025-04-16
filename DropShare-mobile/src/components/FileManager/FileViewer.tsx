import React, { useRef, useState, useEffect } from "react";
import {
  View,
  FlatList,
  Image,
  Dimensions,
  Text,
  TouchableOpacity,
  Platform,
  StyleSheet,
} from "react-native";
import Video from "react-native-video";
import Pdf from "react-native-pdf";
import { RouteProp, useRoute } from "@react-navigation/native";
import { useTheme } from "../../hooks/ThemeProvider";
import { FilesViewerStyles } from "../../constants/Styles";
import { goBack } from "../../utils/NavigationUtil";
import Header from "../ui/Header";
import { icons } from "../../assets";
import useSelectFile from "../../hooks/useSelectFile";

type RootStackParamList = {
  FileViewer: { files: any[]; currentIndex: number };
};

const { width, height } = Dimensions.get("window");

const FileViewer: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, "FileViewer">>();
  const { files, currentIndex } = route.params;
  const { setSelectedFiles } = useSelectFile();
  const { colorScheme } = useTheme();
  const styles = FilesViewerStyles(colorScheme);
  const flatListRef = useRef<FlatList>(null);
  const [currentFileIndex, setCurrentFileIndex] = useState(currentIndex);

  useEffect(() => {
    console.log("FileViewer params:", { filesLength: files?.length, currentIndex });
  }, [files, currentIndex]);

  useEffect(() => {
    if (!files || files.length === 0) {
      console.log("No files provided, navigating back");
      goBack();
    }
  }, [files]);

  if (!files || files.length === 0) {
    return null;
  }

  const currentFile = files[currentFileIndex];
  const filePath = currentFile.path.startsWith("file://")
    ? currentFile.path
    : `file://${currentFile.path}`;
  const fileExtension = currentFile.name.split(".").pop()?.toLowerCase();
  const isImage = ["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(
    fileExtension || ""
  );
  const isVideo = ["mp4", "mov", "avi", "mkv", "webm"].includes(
    fileExtension || ""
  );
  const isAudio = ["mp3", "wav", "aac", "ogg", "m4a"].includes(
    fileExtension || ""
  );
  const isPdf = fileExtension === "pdf";

  // Log current file details
  useEffect(() => {
    console.log("Current file:", {
      path: filePath,
      extension: fileExtension,
      isImage,
      isVideo,
      isAudio,
      isPdf,
    });
  }, [currentFileIndex, filePath, fileExtension]);

  const onClose = () => {
    console.log("Closing FileViewer");
    goBack();
    setSelectedFiles([]);
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const itemPath = item.path.startsWith("file://")
      ? item.path
      : `file://${item.path}`;
    const itemExtension = item.name.split(".").pop()?.toLowerCase();
    const isItemImage = ["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(
      itemExtension || ""
    );
    const isItemVideo = ["mp4", "mov", "avi", "mkv", "webm"].includes(
      itemExtension || ""
    );
    const isItemAudio = ["mp3", "wav", "aac", "ogg", "m4a"].includes(
      itemExtension || ""
    );
    const isItemPdf = itemExtension === "pdf";

    // Log rendering details
    console.log("Rendering item:", {
      path: itemPath,
      extension: itemExtension,
      isImage: isItemImage,
      isVideo: isItemVideo,
      isAudio: isItemAudio,
      isPdf: isItemPdf,
      index,
      isActive: index === currentFileIndex,
    });

    return (
      <View style={localStyles.itemContainer}>
        {isItemImage && (
          <Image
            source={{ uri: itemPath }}
            style={localStyles.media}
            resizeMode="contain"
            onError={(e) => console.error("Image error:", JSON.stringify(e))}
            onLoad={() => console.log("Image loaded:", itemPath)}
          />
        )}
        {isItemVideo && (
          <Video
            source={{ uri: itemPath }}
            style={localStyles.media}
            controls
            resizeMode="contain"
            onError={(e) => console.error("Video error:", JSON.stringify(e))}
            onLoad={(data) => console.log("Video loaded:", JSON.stringify(data))}
            paused={index !== currentFileIndex}
          />
        )}
        {isItemAudio && (
          <View style={localStyles.audioContainer}>
            <Image
              source={icons.audio}
              style={localStyles.audioIcon}
              resizeMode="contain"
            />
            <Video
              source={{ uri: itemPath }}
              controls
              style={localStyles.audioPlayer}
              onError={(e) => console.error("Audio error:", JSON.stringify(e))}
              onLoad={(data) => console.log("Audio loaded:", JSON.stringify(data))}
              paused={index !== currentFileIndex}
            />
          </View>
        )}
        {isItemPdf && (
          <Pdf
            source={{ uri: itemPath, cache: false }}
            style={localStyles.media}
            onError={(e) => console.error("PDF error:", JSON.stringify(e))}
            onLoadComplete={(pages) =>
              console.log("PDF loaded, pages:", pages)
            }
          />
        )}
        {!isItemImage && !isItemVideo && !isItemAudio && !isItemPdf && (
          <View style={localStyles.unsupportedContainer}>
            <Text style={localStyles.unsupportedText}>
              Unsupported file type: {item.name}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      if (newIndex !== null && newIndex !== undefined) {
        console.log("Swiped to index:", newIndex);
        setCurrentFileIndex(newIndex);
      }
    }
  }).current;

  return (
    <View style={styles.container}>
      <Header
        onPress={onClose}
        menu
        page={currentFile.name}
        filePath={filePath}
      />
      <FlatList
        ref={flatListRef}
        data={files}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={currentIndex}
        getItemLayout={(data, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{
          itemVisiblePercentThreshold: 50,
        }}
        keyExtractor={(item) => item.path}
      />
      <View style={localStyles.navigationButtons}>
        <TouchableOpacity
          onPress={() => {
            if (currentFileIndex > 0) {
              flatListRef.current?.scrollToIndex({
                index: currentFileIndex - 1,
                animated: true,
              });
            }
          }}
          disabled={currentFileIndex === 0}
          style={[
            localStyles.navButton,
            currentFileIndex === 0 && localStyles.disabledButton,
          ]}
        >
          <Text style={localStyles.navButtonText}>Previous</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            if (currentFileIndex < files.length - 1) {
              flatListRef.current?.scrollToIndex({
                index: currentFileIndex + 1,
                animated: true,
              });
            }
          }}
          disabled={currentFileIndex === files.length - 1}
          style={[
            localStyles.navButton,
            currentFileIndex === files.length - 1 && localStyles.disabledButton,
          ]}
        >
          <Text style={localStyles.navButtonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const localStyles = StyleSheet.create({
  itemContainer: {
    width,
    height: height - 100,
    justifyContent: "center",
    alignItems: "center",
  },
  media: {
    width: "100%",
    height: "100%",
  },
  audioContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  audioIcon: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  audioPlayer: {
    width: width - 40,
    height: 60,
  },
  unsupportedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  unsupportedText: {
    color: "#fff",
    fontSize: 18,
    textAlign: "center",
  },
  navigationButtons: {
    position: "absolute",
    bottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 20,
  },
  navButton: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: 10,
    borderRadius: 5,
  },
  navButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default FileViewer;