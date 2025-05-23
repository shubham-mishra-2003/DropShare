import React, { useState, useEffect, useRef } from "react";
import { View, FlatList, TouchableOpacity, BackHandler } from "react-native";
import { ProgressBar } from "@react-native-community/progress-bar-android";
import { useNetwork } from "../service/NetworkProvider";
import RNFS from "react-native-fs";
import { Colors } from "../constants/Colors";
import { useTheme } from "../hooks/ThemeProvider";
import MediaPicker from "../components/MediaPicker";
import StyledText from "../components/ui/StyledText";
import LinearGradient from "react-native-linear-gradient";
import { resetAndNavigate } from "../utils/NavigationUtil";
import DropShareModal from "../components/ui/Modal";
import MessageView from "../components/MessageView";
import Icon from "../components/Icon";
import { icons } from "../assets";
import { Toast } from "../components/Toasts";
import { formatFileSize } from "../utils/FileSystemUtil";
import BreakerText from "../components/ui/BreakerText";
import { ConnectionScreenStyles } from "../constants/Styles";
import { Logger } from "../utils/Logger";
import { getLocalIPAddress } from "../utils/NetworkUtils";

const ConnectionScreen: React.FC = () => {
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
    stopHosting,
    pauseTransfer,
    resumeTransfer,
    cancelTransfer,
  } = useNetwork();
  const [selectToSend, setSelectToSend] = useState<RNFS.ReadDirItem[]>([]);
  const [messageView, setMessageView] = useState(false);

  const styles = ConnectionScreenStyles(colorScheme);

  const handleSendFiles = async () => {
    for (const file of selectToSend) {
      await sendFiles([{ filePath: file.path }]);
    }
    setSelectToSend([]);
  };

  const BackClick = () => {
    disconnect();
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

  // const [transferProgress, setTransferProgress] = useState<TransferProgress[]>([
  //   {
  //     fileId: "1",
  //     fileName: "ADBC",
  //     fileSize: 1234,
  //     isPaused: false,
  //     speed: 123,
  //     status: "Cancelled",
  //     transferredBytes: 12344,
  //     pauseInitiator: "sender",
  //   },
  //   {
  //     fileId: "2",
  //     fileName: "ADBCED",
  //     fileSize: 12343,
  //     isPaused: true,
  //     speed: 1234,
  //     status: "Receiving",
  //     transferredBytes: 12344,
  //     pauseInitiator: "sender",
  //   },
  //   {
  //     fileId: "3",
  //     fileName: "ADBCED",
  //     fileSize: 12343,
  //     isPaused: true,
  //     speed: 1234,
  //     status: "Receiving",
  //     transferredBytes: 12344,
  //     pauseInitiator: "receiver",
  //   },
  //   {
  //     fileId: "4",
  //     fileName: "ADBCED",
  //     fileSize: 123,
  //     isPaused: true,
  //     speed: 224,
  //     status: "Sending",
  //     transferredBytes: 12344,
  //     pauseInitiator: "receiver",
  //   },
  // ]);

  useEffect(() => {
    if (isHost) {
      if (!isHostConnected) {
        resetAndNavigate("home").then(() => {
          stopHosting();
        });
      }
    } else {
      if (!isClientConnected) {
        resetAndNavigate("home").then(() => {
          stopClient();
        });
      }
    }
  });

  const [localIp, setLocalIp] = useState<string>("");
  useEffect(() => {
    getLocalIPAddress()
      .then((ip) => setLocalIp(ip))
      .catch((err) => {
        Logger.error("Failed to get local IP:", err);
        setLocalIp("unknown");
      });
  }, []);

  const renderTransferItem = ({ item }: { item: TransferProgress }) => {
    const percentage =
      item.fileSize > 0 ? (item.transferredBytes / item.fileSize) * 100 : 0;
    const isSender = localIp && item.senderIp === localIp;
    const canResume =
      item.isPaused &&
      (item.pausedBy
        ? item.pausedBy === (isSender ? "sender" : "receiver")
        : true);

    return (
      <View style={styles.transferInfo}>
        <View
          style={{
            flexDirection: "row",
            padding: 5,
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <StyledText
            fontSize={16}
            fontWeight="bold"
            isEllipsis
            style={{ width: "60%" }}
          >
            {item.fileName}
          </StyledText>
          {item.status != "Completed" && item.status != "Cancelled" && (
            <View style={{ flexDirection: "row", gap: 5 }}>
              <TouchableOpacity
                style={{
                  padding: 5,
                  opacity: canResume ? 1 : 0.5,
                  backgroundColor: Colors[colorScheme].tint,
                  borderRadius: 50,
                }}
                onPress={() => {
                  Logger.info(
                    `Render transfer ${item.fileId}: isSender=${isSender}, isPaused=${item.isPaused}, pauseInitiator=${item.pausedBy}, canResume=${canResume}`
                  );
                  item.isPaused
                    ? resumeTransfer(item.fileId)
                    : pauseTransfer(item.fileId);
                }}
                disabled={item.isPaused && !canResume}
              >
                <Icon
                  source={item.isPaused ? icons.resume : icons.pause}
                  filter={1}
                  height={22}
                  width={20}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  padding: 5,
                  backgroundColor: Colors[colorScheme].tint,
                  borderRadius: 50,
                }}
                onPress={() => cancelTransfer(item.fileId)}
              >
                <Icon source={icons.cross} filter={1} height={22} width={20} />
              </TouchableOpacity>
            </View>
          )}
        </View>
        <View style={styles.transferDetails}>
          <StyledText fontSize={12} fontWeight="bold" isEllipsis>
            {item.status} • {formatFileSize(item.transferredBytes)} / {""}
            {formatFileSize(item.fileSize)}
          </StyledText>
          <StyledText fontSize={12} fontWeight="bold">
            Speed: {formatFileSize(item.speed)}/s
          </StyledText>
        </View>
        {item.status != "Completed" && item.status != "Cancelled" && (
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
          fontSize={22}
          text={isHost ? "Connected Clients :" : "Connected to Host:"}
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
            contentContainerStyle={{ gap: 10, padding: 10 }}
            renderItem={(device) => (
              <View style={styles.devicesList}>
                <StyledText
                  fontSize={16}
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
            gap: 10,
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

export default ConnectionScreen;
