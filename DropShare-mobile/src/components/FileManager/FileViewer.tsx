// import React, { useRef, useState, useEffect, useCallback } from "react";
// import {
//   View,
//   FlatList,
//   Image,
//   Dimensions,
//   Text,
//   TouchableOpacity,
//   StyleSheet,
//   ActivityIndicator,
//   Animated,
// } from "react-native";
// import Video from "react-native-video";
// import Pdf from "react-native-pdf";
// import { RouteProp, useRoute } from "@react-navigation/native";
// import { useTheme } from "../../hooks/ThemeProvider";
// import { FilesViewerStyles } from "../../constants/Styles";
// import { goBack } from "../../utils/NavigationUtil";
// import Header from "../ui/Header";
// import { icons } from "../../assets";
// import useSelectFile from "../../hooks/useSelectFile";
// import Icon from "../Icon";
// import { Gesture, GestureDetector } from "react-native-gesture-handler";
// import LinearGradient from "react-native-linear-gradient";
// import { Colors } from "../../constants/Colors";
// import StyledText from "../ui/StyledText";

// type RootStackParamList = {
//   FileViewer: { files: any[]; currentIndex: number };
// };

// const { width, height } = Dimensions.get("window");

// const sanitizeFile = (file: any) => ({
//   ...file,
//   path: file.path,
//   name: file.name,
//   mtime: file.mtime instanceof Date ? file.mtime.toISOString() : file.mtime,
// });

// const FileViewer: React.FC = () => {
//   const route = useRoute<RouteProp<RootStackParamList, "FileViewer">>();
//   const { files: rawFiles, currentIndex } = route.params;
//   const files = rawFiles.map(sanitizeFile);
//   const { setSelectedFiles } = useSelectFile();
//   const { colorScheme } = useTheme();
//   const styles = FilesViewerStyles(colorScheme);
//   const localStyle = localStyles(colorScheme);
//   const flatListRef = useRef<FlatList>(null);
//   const pdfRef = useRef<Pdf>(null);
//   const [currentFileIndex, setCurrentFileIndex] = useState(currentIndex);
//   const [isLoading, setIsLoading] = useState(false);
//   const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

//   const scale = useRef(new Animated.Value(1)).current;
//   const translateX = useRef(new Animated.Value(0)).current;
//   const translateY = useRef(new Animated.Value(0)).current;
//   const [savedScale, setSavedScale] = useState(1);
//   const [savedTranslateX, setSavedTranslateX] = useState(0);
//   const [savedTranslateY, setSavedTranslateY] = useState(0);

//   useEffect(() => {
//     console.log("FileViewer params:", {
//       filesLength: files?.length,
//       currentIndex,
//     });
//   }, [files, currentIndex]);

//   useEffect(() => {
//     if (!files || files.length === 0) {
//       console.log("No files provided, navigating back");
//       goBack();
//     }
//   }, [files]);

//   useEffect(() => {
//     setIsLoading(true);
//     if (loadingTimeoutRef.current) {
//       clearTimeout(loadingTimeoutRef.current);
//     }
//     loadingTimeoutRef.current = setTimeout(() => {
//       setIsLoading(false);
//       console.log(
//         "Loading timeout triggered for file index:",
//         currentFileIndex
//       );
//     }, 8000);

//     scale.setValue(1);
//     translateX.setValue(0);
//     translateY.setValue(0);
//     setSavedScale(1);
//     setSavedTranslateX(0);
//     setSavedTranslateY(0);

//     return () => {
//       if (loadingTimeoutRef.current) {
//         clearTimeout(loadingTimeoutRef.current);
//       }
//     };
//   }, [currentFileIndex]);

//   if (!files || files.length === 0) {
//     return null;
//   }

//   const currentFile = files[currentFileIndex];
//   const filePath = currentFile.path.startsWith("file://")
//     ? currentFile.path
//     : `file://${currentFile.path}`;
//   const fileExtension = currentFile.name.split(".").pop()?.toLowerCase();
//   const isImage = ["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(
//     fileExtension || ""
//   );
//   const isVideo = ["mp4", "mov", "avi", "mkv", "webm"].includes(
//     fileExtension || ""
//   );
//   const isAudio = ["mp3", "wav", "aac", "ogg", "m4a"].includes(
//     fileExtension || ""
//   );
//   const isPdf = fileExtension === "pdf";

//   const onClose = () => {
//     console.log("Closing FileViewer");
//     goBack();
//     setSelectedFiles([]);
//   };

//   const pinchGesture = Gesture.Pinch()
//     .onUpdate((event) => {
//       const newScale = savedScale * event.scale;
//       scale.setValue(newScale);
//     })
//     .onEnd(() => {
//       const currentScale = savedScale * (scale as any)._value;
//       setSavedScale(currentScale);
//       if (currentScale < 1) {
//         Animated.spring(scale, {
//           toValue: 1,
//           useNativeDriver: true,
//         }).start(() => setSavedScale(1));
//         Animated.spring(translateX, {
//           toValue: 0,
//           useNativeDriver: true,
//         }).start(() => setSavedTranslateX(0));
//         Animated.spring(translateY, {
//           toValue: 0,
//           useNativeDriver: true,
//         }).start(() => setSavedTranslateY(0));
//       }
//     });

//   const panGesture = Gesture.Pan()
//     .enabled(savedScale > 1)
//     .onUpdate((event) => {
//       if (savedScale > 1) {
//         translateX.setValue(savedTranslateX + event.translationX / savedScale);
//         translateY.setValue(savedTranslateY + event.translationY / savedScale);
//       }
//     })
//     .onEnd(() => {
//       setSavedTranslateX((translateX as any)._value);
//       setSavedTranslateY((translateY as any)._value);
//     });

//   const composedGestures = Gesture.Simultaneous(pinchGesture, panGesture);

//   const animatedStyle = {
//     transform: [{ scale }, { translateX }, { translateY }],
//   };

//   const renderItem = useCallback(
//     ({ item, index }: { item: any; index: number }) => {
//       const itemPath = item.path.startsWith("file://")
//         ? item.path
//         : `file://${item.path}`;
//       const itemExtension = item.name.split(".").pop()?.toLowerCase();
//       const isItemImage = ["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(
//         itemExtension || ""
//       );
//       const isItemVideo = ["mp4", "mov", "avi", "mkv", "webm"].includes(
//         itemExtension || ""
//       );
//       const isItemAudio = ["mp3", "wav", "aac", "ogg", "m4a"].includes(
//         itemExtension || ""
//       );
//       const isItemPdf = itemExtension === "pdf";

//       if (Math.abs(index - currentFileIndex) > 1) {
//         return <View style={localStyle.itemContainer} />;
//       }

//       return (
//         <LinearGradient
//           start={{ x: 0, y: 0 }}
//           end={{ x: 1, y: 1 }}
//           colors={Colors[colorScheme].linearGradientColors}
//           style={localStyle.itemContainer}
//         >
//           {isLoading && index === currentFileIndex && (
//             <ActivityIndicator
//               size="large"
//               color={Colors[colorScheme].tint}
//               style={localStyle.loader}
//             />
//           )}
//           {(isItemImage || isItemVideo || isItemPdf) && (
//             <GestureDetector gesture={composedGestures}>
//               <Animated.View style={[localStyle.mediaContainer, animatedStyle]}>
//                 {isItemImage && (
//                   <Image
//                     source={{ uri: itemPath }}
//                     style={localStyle.media}
//                     resizeMode="contain"
//                     onError={() => {
//                       setIsLoading(false);
//                       if (loadingTimeoutRef.current) {
//                         clearTimeout(loadingTimeoutRef.current);
//                       }
//                     }}
//                     onLoad={() => {
//                       setIsLoading(false);
//                       if (loadingTimeoutRef.current) {
//                         clearTimeout(loadingTimeoutRef.current);
//                       }
//                     }}
//                   />
//                 )}
//                 {isItemVideo && (
//                   <Video
//                     source={{ uri: itemPath }}
//                     style={localStyle.media}
//                     controls
//                     resizeMode="contain"
//                     onError={() => {
//                       setIsLoading(false);
//                       if (loadingTimeoutRef.current) {
//                         clearTimeout(loadingTimeoutRef.current);
//                       }
//                     }}
//                     onLoad={() => {
//                       setIsLoading(false);
//                       if (loadingTimeoutRef.current) {
//                         clearTimeout(loadingTimeoutRef.current);
//                       }
//                     }}
//                     paused={index !== currentFileIndex}
//                     bufferConfig={{
//                       minBufferMs: 300,
//                       maxBufferMs: 600,
//                       bufferForPlaybackMs: 150,
//                       bufferForPlaybackAfterRebufferMs: 300,
//                     }}
//                     maxBitRate={1000000}
//                     useTextureView={false}
//                     playInBackground={false}
//                   />
//                 )}
//                 {isItemPdf && (
//                   <Pdf
//                     ref={pdfRef}
//                     source={{ uri: itemPath, cache: false }}
//                     style={localStyle.media}
//                     enablePaging
//                     onError={() => {
//                       setIsLoading(false);
//                       if (loadingTimeoutRef.current) {
//                         clearTimeout(loadingTimeoutRef.current);
//                       }
//                     }}
//                     onLoadComplete={() => {
//                       setIsLoading(false);
//                       if (loadingTimeoutRef.current) {
//                         clearTimeout(loadingTimeoutRef.current);
//                       }
//                     }}
//                     onLoadProgress={(percent) => {
//                       setIsLoading(percent < 1);
//                     }}
//                     onPageChanged={() => {
//                       setIsLoading(false);
//                     }}
//                   />
//                 )}
//               </Animated.View>
//             </GestureDetector>
//           )}
//           {isItemAudio && (
//             <View style={localStyle.audioContainer}>
//               <Icon source={icons.audio} filter={1} height={100} width={100} />
//               <Video
//                 source={{ uri: itemPath }}
//                 controls
//                 style={localStyle.audioPlayer}
//                 onError={() => {
//                   setIsLoading(false);
//                   if (loadingTimeoutRef.current) {
//                     clearTimeout(loadingTimeoutRef.current);
//                   }
//                 }}
//                 onLoad={() => {
//                   setIsLoading(false);
//                   if (loadingTimeoutRef.current) {
//                     clearTimeout(loadingTimeoutRef.current);
//                   }
//                 }}
//                 paused={index !== currentFileIndex}
//                 bufferConfig={{
//                   minBufferMs: 1000,
//                   maxBufferMs: 2000,
//                   bufferForPlaybackMs: 500,
//                   bufferForPlaybackAfterRebufferMs: 1000,
//                 }}
//               />
//             </View>
//           )}
//           {!isItemImage && !isItemVideo && !isItemAudio && !isItemPdf && (
//             <View style={localStyle.unsupportedContainer}>
//               <StyledText style={localStyle.unsupportedText}>
//                 Unsupported file type: {item.name}
//               </StyledText>
//             </View>
//           )}
//         </LinearGradient>
//       );
//     },
//     [currentFileIndex, isLoading, composedGestures]
//   );

//   const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
//     if (viewableItems.length > 0) {
//       const newIndex = viewableItems[0].index;
//       if (newIndex !== null && newIndex !== undefined) {
//         setCurrentFileIndex(newIndex);
//       }
//     }
//   }).current;

//   useEffect(() => {
//     const preloadItems = () => {
//       const preloadIndices = [
//         currentFileIndex - 1,
//         currentFileIndex,
//         currentFileIndex + 1,
//       ].filter((index) => index >= 0 && index < files.length);

//       preloadIndices.forEach((index) => {
//         const file = files[index];
//         const itemPath = file.path.startsWith("file://")
//           ? file.path
//           : `file://${file.path}`;
//         const itemExtension = file.name.split(".").pop()?.toLowerCase();
//         if (
//           ["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(
//             itemExtension || ""
//           )
//         ) {
//           Image.prefetch(itemPath);
//         }
//       });
//     };

//     preloadItems();
//   }, [currentFileIndex, files]);

//   return (
//     <LinearGradient
//       start={{ x: 0, y: 0 }}
//       end={{ x: 1, y: 1 }}
//       colors={Colors[colorScheme].linearGradientColors}
//       style={styles.container}
//     >
//       <View
//         style={{
//           flexDirection: "row",
//           alignItems: "center",
//           justifyContent: "space-between",
//           padding: 10,
//           backgroundColor: Colors[colorScheme].background,
//         }}
//       >
//         <TouchableOpacity onPress={goBack} style={{ padding: 10 }}>
//           <Icon source={icons.back} filter={1} height={20} width={20} />
//         </TouchableOpacity>
//         <StyledText
//           isEllipsis
//           text={currentFile.name}
//           fontSize={20}
//           fontWeight="bold"
//           style={{ textAlign: "center", width: "70%" }}
//         />
//         <TouchableOpacity style={{ padding: 10 }}>
//           <Icon source={icons.options} filter={1} height={20} width={20} />
//         </TouchableOpacity>
//       </View>
//       <FlatList
//         ref={flatListRef}
//         data={files}
//         renderItem={renderItem}
//         horizontal
//         style={{ flex: 1 }}
//         contentContainerStyle={{ height: "100%" }}
//         pagingEnabled
//         showsHorizontalScrollIndicator={false}
//         initialScrollIndex={currentIndex}
//         getItemLayout={(data, index) => ({
//           length: width,
//           offset: width * index,
//           index,
//         })}
//         onViewableItemsChanged={onViewableItemsChanged}
//         viewabilityConfig={{
//           itemVisiblePercentThreshold: 50,
//         }}
//         keyExtractor={(item) => item.path}
//         initialNumToRender={3}
//         maxToRenderPerBatch={3}
//         windowSize={3}
//       />
//     </LinearGradient>
//   );
// };

// const localStyles = (colorScheme: "light" | "dark") =>
//   StyleSheet.create({
//     itemContainer: {
//       width,
//       height: height - 100,
//       justifyContent: "center",
//       alignItems: "center",
//     },
//     mediaContainer: {
//       width: "100%",
//       height: "100%",
//     },
//     media: {
//       width: "100%",
//       height: "100%",
//     },
//     audioContainer: {
//       flex: 1,
//       justifyContent: "center",
//       alignItems: "center",
//     },
//     audioPlayer: {
//       width: width - 40,
//       height: 60,
//     },
//     unsupportedContainer: {
//       flex: 1,
//       justifyContent: "center",
//       alignItems: "center",
//     },
//     unsupportedText: {
//       color: Colors[colorScheme].text,
//       fontSize: 18,
//       textAlign: "center",
//     },
//     navigationButtons: {
//       position: "absolute",
//       bottom: 20,
//       flexDirection: "row",
//       justifyContent: "space-between",
//       width: "100%",
//       paddingHorizontal: 20,
//     },
//     navButton: {
//       backgroundColor: "rgba(0, 0, 0, 0.5)",
//       padding: 10,
//       borderRadius: 5,
//     },
//     navButtonText: {
//       color: "#fff",
//       fontSize: 16,
//     },
//     disabledButton: {
//       opacity: 0.5,
//     },
//     loader: {
//       position: "absolute",
//       zIndex: 1,
//     },
//   });

// export default FileViewer;

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  FlatList,
  Image,
  Dimensions,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
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
import Icon from "../Icon";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import LinearGradient from "react-native-linear-gradient";
import { Colors } from "../../constants/Colors";
import StyledText from "../ui/StyledText";

type RootStackParamList = {
  FileViewer: { files: any[]; currentIndex: number };
};

const { width, height } = Dimensions.get("window");

const sanitizeFile = (file: any) => {
  // Ensure file is an array for consistency
  const fileArray = Array.isArray(file) ? file : [file];
  return fileArray.map((f) => ({
    ...f,
    path: f.path || "",
    name: f.name || "Unknown",
    mtime:
      f.mtime instanceof Date
        ? f.mtime.toISOString()
        : f.mtime || new Date().toISOString(),
  }));
};

const FileViewer: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, "FileViewer">>();
  const { files: rawFiles, currentIndex } = route.params;
  const files = sanitizeFile(rawFiles);
  const { setSelectedFiles } = useSelectFile();
  const { colorScheme } = useTheme();
  const styles = FilesViewerStyles(colorScheme);
  const localStyle = localStyles(colorScheme);
  const flatListRef = useRef<FlatList>(null);
  const pdfRef = useRef<Pdf>(null);
  const [currentFileIndex, setCurrentFileIndex] = useState(
    Math.min(currentIndex, files.length - 1)
  );
  const [isLoading, setIsLoading] = useState(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const [savedScale, setSavedScale] = useState(1);
  const [savedTranslateX, setSavedTranslateX] = useState(0);
  const [savedTranslateY, setSavedTranslateY] = useState(0);

  useEffect(() => {
    console.log("FileViewer params:", {
      filesLength: files?.length,
      currentIndex,
    });
  }, [files, currentIndex]);

  useEffect(() => {
    if (!files || files.length === 0) {
      console.log("No files provided, navigating back");
      goBack();
    }
  }, [files]);

  useEffect(() => {
    setIsLoading(true);
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    loadingTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      console.log(
        "Loading timeout triggered for file index:",
        currentFileIndex
      );
    }, 8000);

    scale.setValue(1);
    translateX.setValue(0);
    translateY.setValue(0);
    setSavedScale(1);
    setSavedTranslateX(0);
    setSavedTranslateY(0);

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [currentFileIndex]);

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

  const onClose = () => {
    console.log("Closing FileViewer");
    goBack();
    setSelectedFiles([]);
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const newScale = savedScale * event.scale;
      scale.setValue(newScale);
    })
    .onEnd(() => {
      const currentScale = savedScale * (scale as any)._value;
      setSavedScale(currentScale);
      if (currentScale < 1) {
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
        }).start(() => setSavedScale(1));
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start(() => setSavedTranslateX(0));
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start(() => setSavedTranslateY(0));
      }
    });

  const panGesture = Gesture.Pan()
    .enabled(savedScale > 1)
    .onUpdate((event) => {
      if (savedScale > 1) {
        translateX.setValue(savedTranslateX + event.translationX / savedScale);
        translateY.setValue(savedTranslateY + event.translationY / savedScale);
      }
    })
    .onEnd(() => {
      setSavedTranslateX((translateX as any)._value);
      setSavedTranslateY((translateY as any)._value);
    });

  const composedGestures = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedStyle = {
    transform: [{ scale }, { translateX }, { translateY }],
  };

  const renderItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
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

      if (files.length > 1 && Math.abs(index - currentFileIndex) > 1) {
        return <View style={localStyle.itemContainer} />;
      }

      return (
        <LinearGradient
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          colors={Colors[colorScheme].linearGradientColors}
          style={localStyle.itemContainer}
        >
          {isLoading && index === currentFileIndex && (
            <ActivityIndicator
              size="large"
              color={Colors[colorScheme].tint}
              style={localStyle.loader}
            />
          )}
          {(isItemImage || isItemVideo || isItemPdf) && (
            <GestureDetector gesture={composedGestures}>
              <Animated.View style={[localStyle.mediaContainer, animatedStyle]}>
                {isItemImage && (
                  <Image
                    source={{ uri: itemPath }}
                    style={localStyle.media}
                    resizeMode="contain"
                    onError={() => {
                      setIsLoading(false);
                      if (loadingTimeoutRef.current) {
                        clearTimeout(loadingTimeoutRef.current);
                      }
                    }}
                    onLoad={() => {
                      setIsLoading(false);
                      if (loadingTimeoutRef.current) {
                        clearTimeout(loadingTimeoutRef.current);
                      }
                    }}
                  />
                )}
                {isItemVideo && (
                  <Video
                    source={{ uri: itemPath }}
                    style={localStyle.media}
                    controls
                    resizeMode="contain"
                    onError={() => {
                      setIsLoading(false);
                      if (loadingTimeoutRef.current) {
                        clearTimeout(loadingTimeoutRef.current);
                      }
                    }}
                    onLoad={() => {
                      setIsLoading(false);
                      if (loadingTimeoutRef.current) {
                        clearTimeout(loadingTimeoutRef.current);
                      }
                    }}
                    paused={index !== currentFileIndex}
                    bufferConfig={{
                      minBufferMs: 300,
                      maxBufferMs: 600,
                      bufferForPlaybackMs: 150,
                      bufferForPlaybackAfterRebufferMs: 300,
                    }}
                    maxBitRate={1000000}
                    useTextureView={false}
                    playInBackground={false}
                  />
                )}
                {isItemPdf && (
                  <Pdf
                    ref={pdfRef}
                    source={{ uri: itemPath, cache: false }}
                    style={localStyle.media}
                    enablePaging
                    onError={() => {
                      setIsLoading(false);
                      if (loadingTimeoutRef.current) {
                        clearTimeout(loadingTimeoutRef.current);
                      }
                    }}
                    onLoadComplete={() => {
                      setIsLoading(false);
                      if (loadingTimeoutRef.current) {
                        clearTimeout(loadingTimeoutRef.current);
                      }
                    }}
                    onLoadProgress={(percent) => {
                      setIsLoading(percent < 1);
                    }}
                    onPageChanged={() => {
                      setIsLoading(false);
                    }}
                  />
                )}
              </Animated.View>
            </GestureDetector>
          )}
          {isItemAudio && (
            <View style={localStyle.audioContainer}>
              <Icon source={icons.audio} filter={1} height={100} width={100} />
              <Video
                source={{ uri: itemPath }}
                controls
                style={localStyle.audioPlayer}
                onError={() => {
                  setIsLoading(false);
                  if (loadingTimeoutRef.current) {
                    clearTimeout(loadingTimeoutRef.current);
                  }
                }}
                onLoad={() => {
                  setIsLoading(false);
                  if (loadingTimeoutRef.current) {
                    clearTimeout(loadingTimeoutRef.current);
                  }
                }}
                paused={index !== currentFileIndex}
                bufferConfig={{
                  minBufferMs: 1000,
                  maxBufferMs: 2000,
                  bufferForPlaybackMs: 500,
                  bufferForPlaybackAfterRebufferMs: 1000,
                }}
              />
            </View>
          )}
          {!isItemImage && !isItemVideo && !isItemAudio && !isItemPdf && (
            <View style={localStyle.unsupportedContainer}>
              <StyledText style={localStyle.unsupportedText}>
                Unsupported file type: {item.name}
              </StyledText>
            </View>
          )}
        </LinearGradient>
      );
    },
    [currentFileIndex, isLoading, composedGestures, files.length, colorScheme]
  );

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0 && files.length > 1) {
      const newIndex = viewableItems[0].index;
      if (newIndex !== null && newIndex !== undefined) {
        setCurrentFileIndex(newIndex);
      }
    }
  }).current;

  useEffect(() => {
    const preloadItems = () => {
      const preloadIndices = [
        currentFileIndex - 1,
        currentFileIndex,
        currentFileIndex + 1,
      ].filter((index) => index >= 0 && index < files.length);

      preloadIndices.forEach((index) => {
        const file = files[index];
        const itemPath = file.path.startsWith("file://")
          ? file.path
          : `file://${file.path}`;
        const itemExtension = file.name.split(".").pop()?.toLowerCase();
        if (
          ["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(
            itemExtension || ""
          )
        ) {
          Image.prefetch(itemPath);
        }
      });
    };

    preloadItems();
  }, [currentFileIndex, files]);

  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      colors={Colors[colorScheme].linearGradientColors}
      style={styles.container}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 10,
          backgroundColor: Colors[colorScheme].background,
        }}
      >
        <TouchableOpacity onPress={goBack} style={{ padding: 10 }}>
          <Icon source={icons.back} filter={1} height={20} width={20} />
        </TouchableOpacity>
        <StyledText
          isEllipsis
          text={currentFile.name}
          fontSize={20}
          fontWeight="bold"
          style={{ textAlign: "center", width: "70%" }}
        />
        <TouchableOpacity style={{ padding: 10 }}>
          <Icon source={icons.options} filter={1} height={20} width={20} />
        </TouchableOpacity>
      </View>
      <FlatList
        ref={flatListRef}
        data={files}
        renderItem={renderItem}
        horizontal
        style={{ flex: 1 }}
        contentContainerStyle={{ height: "100%" }}
        pagingEnabled={files.length > 1}
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={files.length > 1 ? currentIndex : 0}
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
        initialNumToRender={files.length > 1 ? 3 : 1}
        maxToRenderPerBatch={files.length > 1 ? 3 : 1}
        windowSize={files.length > 1 ? 3 : 1}
      />
    </LinearGradient>
  );
};

const localStyles = (colorScheme: "light" | "dark") =>
  StyleSheet.create({
    itemContainer: {
      width,
      height: height - 100,
      justifyContent: "center",
      alignItems: "center",
    },
    mediaContainer: {
      width: "100%",
      height: "100%",
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
      color: Colors[colorScheme].text,
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
    loader: {
      position: "absolute",
      zIndex: 1,
    },
  });

export default FileViewer;
