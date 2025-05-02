import React, { useState, useEffect, useRef } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  BackHandler,
} from "react-native";
import { ProgressBar } from "@react-native-community/progress-bar-android";
import { useNetwork } from "../service/NetworkProvider";
import RNFS from "react-native-fs";
import { Colors } from "../constants/Colors";
import { useTheme } from "../hooks/ThemeProvider";
import MediaPicker from "../components/MediaPicker";
import StyledText from "../components/ui/StyledText";
import LinearGradient from "react-native-linear-gradient";
import { navigate, resetAndNavigate } from "../utils/NavigationUtil";
import DropShareModal from "../components/ui/Modal";
import MessageView from "../components/MessageView";
import Icon from "../components/Icon";
import { icons } from "../assets";
import { Toast } from "../components/Toasts";
import { formatFileSize } from "../utils/FileSystemUtil";
import BreakerText from "../components/ui/BreakerText";

const ClientConnection: React.FC = () => {
  const { colorScheme } = useTheme();
  const {
    devices,
    sendFiles,
    disconnect,
    stopClient,
    isHost,
    kickClient,
    transferProgress,
    isHostConnected,
    isClientConnected,
  } = useNetwork();
  const [selectToSend, setSelectToSend] = useState<RNFS.ReadDirItem[]>([]);
  const [messageView, setMessageView] = useState(false);

  const styles = createStyles(colorScheme);

  const handleSendFiles = async () => {
    for (const file of selectToSend) {
      await sendFiles([{ filePath: file.path }]);
    }
    setSelectToSend([]);
  };

  const BackClick = () => {
    stopClient();
    resetAndNavigate("home");
    return true;
  };

  const backPressCount = useRef(0);
  useEffect(() => {
    const backAction = () => {
      if (backPressCount.current === 0) {
        backPressCount.current += 1;
        Toast("You will be disconnected and may effect transfer");
        setTimeout(() => {
          backPressCount.current = 0;
        }, 2000);
        return true;
      }
      if (backPressCount.current === 1) {
        BackHandler.addEventListener("hardwareBackPress", BackClick);
      }
      return true;
    };
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );
    return () => backHandler.remove();
  }, []);

  // const [transfers, setTransfers] = useState<TransferProgress[]>([
  //   {
  //     fileId: "1",
  //     fileName: "document.pdf",
  //     transferredBytes: 5 * 1024,
  //     fileSize: 10 * 1024,
  //     speed: formatFileSize(1024),
  //     status: "Sending",
  //   },
  //   {
  //     fileId: "2",
  //     fileName: "photo.jpg",
  //     transferredBytes: 5 * 1024,
  //     fileSize: 12.5 * 1024,
  //     speed: formatFileSize(512),
  //     status: "Receiving",
  //   },
  //   {
  //     fileId: "3",
  //     fileName: "video.mp4",
  //     transferredBytes: 5 * 1024,
  //     fileSize: 10 * 1024,
  //     speed: formatFileSize(2048),
  //     status: "Sending",
  //   },
  //   {
  //     fileId: "4",
  //     fileName: "video.mp4",
  //     transferredBytes: 5 * 1024,
  //     fileSize: 10 * 1024,
  //     speed: formatFileSize(2048),
  //     status: "Sending",
  //   },
  //   {
  //     fileId: "5",
  //     fileName: "video.mp4",
  //     transferredBytes: 5 * 1024,
  //     fileSize: 10 * 1024,
  //     speed: formatFileSize(2048),
  //     status: "Completed",
  //   },
  // ]);

  useEffect(() => {
    if (isHost) {
      if (!isHostConnected) {
        resetAndNavigate("home");
      }
    } else {
      if (!isClientConnected) {
        resetAndNavigate("home");
      }
    }
  });

  const renderTransferItem = ({ item }: { item: TransferProgress }) => {
    const percentage =
      item.fileSize > 0 ? (item.transferredBytes / item.fileSize) * 100 : 0;

    return (
      <View style={styles.transferInfo}>
        <StyledText
          fontSize={18}
          fontWeight="bold"
          isEllipsis
          style={{ width: "90%" }}
        >
          {item.fileName}
        </StyledText>
        <View style={styles.transferDetails}>
          <StyledText fontSize={16} fontWeight="bold" isEllipsis>
            {item.status} • {formatFileSize(item.transferredBytes)}
          </StyledText>
          <StyledText fontSize={14} fontWeight="bold">
            Speed: {item.speed}
          </StyledText>
        </View>
        {item.status != "Completed" && (
          <ProgressBar
            styleAttr="Horizontal"
            animating={true}
            indeterminate={false}
            progress={percentage / 100}
            color={Colors[colorScheme].tint}
            style={styles.progressBar}
          />
        )}
      </View>
    );
  };

  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      colors={Colors[colorScheme].linearGradientColors}
      style={styles.container}
    >
      <StyledText
        fontSize={30}
        fontWeight="bold"
        style={{ textAlign: "center" }}
        text={isHost ? "Host DashBoard" : "Client Dashboard"}
      />
      <View style={styles.mainContent}>
        <BreakerText
          fontSize={24}
          text={isHost ? "Connected Clients :" : "Connected to :"}
        />
        <View>
          <FlatList
            keyExtractor={(item) => item.ip}
            data={devices}
            scrollEnabled={true}
            style={{
              backgroundColor: Colors[colorScheme].transparent,
              borderRadius: 20,
              maxHeight: 130,
            }}
            contentContainerStyle={{ gap: 5, padding: 10 }}
            renderItem={(device) => (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 10,
                  paddingVertical: 15,
                  paddingHorizontal: 15,
                  backgroundColor: Colors[colorScheme].transparent,
                  borderRadius: 20,
                  borderWidth: 2,
                  borderColor: Colors[colorScheme].itemBackground,
                }}
              >
                <StyledText
                  fontSize={20}
                  fontWeight="bold"
                  isEllipsis
                  text={device.item.name}
                  style={{ width: "65%" }}
                />
                <TouchableOpacity
                  onPress={() => {
                    isHost ? kickClient(device.item.ip) : disconnect();
                  }}
                  style={{
                    padding: 10,
                    backgroundColor: "red",
                    borderRadius: 20,
                  }}
                >
                  <StyledText text="Disconnect" />
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
        <BreakerText text="Files Transfer List" fontSize={20} />
        <FlatList
          data={transferProgress}
          style={{
            flex: 1,
            backgroundColor: Colors[colorScheme].transparent,
            borderRadius: 20,
            marginVertical: 5,
          }}
          keyExtractor={(item) => item.fileId}
          renderItem={renderTransferItem}
          ListEmptyComponent={
            <StyledText style={styles.noData}>
              No files Transfered yet
            </StyledText>
          }
          scrollEnabled={true}
          contentContainerStyle={{
            gap: 5,
            padding: 10,
          }}
        />
      </View>
      <View
        style={{
          paddingHorizontal: 20,
          gap: 10,
          flexDirection: "row",
          marginTop: 10,
          justifyContent: "space-around",
          alignItems: "center",
        }}
      >
        {selectToSend.length > 0 && (
          <TouchableOpacity style={styles.sendButton} onPress={handleSendFiles}>
            <StyledText text="Send" fontSize={20} fontWeight="bold" />
          </TouchableOpacity>
        )}
        <MediaPicker
          selectToSend={selectToSend}
          setSelectToSend={setSelectToSend}
        />
      </View>
      <TouchableOpacity
        style={styles.messageButton}
        onPress={() => setMessageView(true)}
        accessibilityLabel="Open messages"
      >
        <Icon source={icons.message} filter={1} height={30} width={30} />
      </TouchableOpacity>
      <DropShareModal
        visible={messageView}
        onRequestClose={() => setMessageView(false)}
      >
        <MessageView setMessageView={setMessageView} />
      </DropShareModal>
    </LinearGradient>
  );
};

const createStyles = (colorScheme: "light" | "dark") =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors[colorScheme].background,
      paddingTop: 50,
      paddingBottom: 30,
    },
    mainContent: {
      paddingHorizontal: 20,
      justifyContent: "space-between",
      flex: 1,
    },
    subtitle: {
      marginTop: 20,
      marginBottom: 10,
      textAlign: "center",
    },
    connectionStatus: {
      backgroundColor: Colors[colorScheme].itemBackground,
      padding: 10,
      borderRadius: 8,
      marginBottom: 10,
      alignItems: "center",
    },
    transferCard: {
      backgroundColor: Colors[colorScheme].itemBackground,
      padding: 10,
      borderRadius: 8,
      marginVertical: 5,
      flexDirection: "row",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 1,
    },
    transferInfo: {
      flex: 1,
      backgroundColor: Colors[colorScheme].transparent,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: Colors[colorScheme].itemBackground,
      padding: 10,
      gap: 10,
    },
    transferDetails: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 5,
      width: "100%",
    },
    progressBar: {
      marginTop: 10,
      height: 10,
      borderRadius: 10,
    },
    noData: {
      color: Colors[colorScheme].text + "80",
      fontSize: 14,
      textAlign: "center",
      marginVertical: 10,
    },
    messageButton: {
      position: "absolute",
      bottom: 75,
      right: 20,
      backgroundColor: Colors[colorScheme].tint,
      borderRadius: 30,
      padding: 12,
      elevation: 5,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    sendButton: {
      padding: 15,
      backgroundColor: Colors[colorScheme].tint,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      width: "45%",
    },
  });

export default ClientConnection;
