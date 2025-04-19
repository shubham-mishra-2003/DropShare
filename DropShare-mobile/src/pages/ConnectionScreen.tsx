// ConnectionScreen.tsx
import React, { FC, useState } from "react";
import {
  View,
  TouchableOpacity,
  FlatList,
  Image,
  ProgressBarAndroid,
  Platform,
} from "react-native";
import { useTheme } from "../hooks/ThemeProvider";
import { Colors } from "../constants/Colors";
import Icon from "../components/Icon";
import { icons, images } from "../assets";
import MediaPicker from "../components/MediaPicker";
import { formatFileSize } from "../utils/FileSystemUtil";
import BreakerText from "../components/ui/BreakerText";
import RNFS from "react-native-fs";
import { Buffer } from "buffer";
import { resetAndNavigate } from "../utils/NavigationUtil";
import { useNetwork } from "../service/NetworkProvider";
import { connectionStyles } from "../constants/Styles";
import StyledText from "../components/ui/StyledText";
import LinearGradient from "react-native-linear-gradient";
import DropShareModal from "../components/ui/Modal";
import MessageView from "../components/MessageView";

const ConnectionScreen: FC = () => {
  const { colorScheme } = useTheme();
  const styles = connectionStyles(colorScheme);
  const {
    devices,
    messages,
    receivedFiles,
    sentFiles,
    sendMessage,
    sendFiles,
    disconnect,
    isHost,
    isHostConnected,
    isClientConnected,
    kickClient,
  } = useNetwork();

  const [fileSelectorOpen, setFileSelectorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"Sent" | "Received">("Sent");
  const [selectToSend, setSelectToSend] = useState<RNFS.ReadDirItem[]>([]);
  const [messageView, setMessageView] = useState(false);
  const [transferProgress, setTransferProgress] = useState<{
    progress: string;
    speed: string;
    percentage: number;
  }>({ progress: "0/0 bytes", speed: "0 KB/s", percentage: 0 });

  // const handleSendFile = async () => {
  //   if (!selectToSend.length) return;
  //   try {
  //     for (const file of selectToSend) {
  //       const fileData = await RNFS.readFile(file.path, "base64");
  //       const buffer = Buffer.from(fileData, "base64");
  //       await sendFile(file.path, buffer, setTransferProgress);
  //     }
  //     setSelectToSend([]);
  //     setTransferProgress({
  //       progress: "0/0 bytes",
  //       speed: "0 KB/s",
  //       percentage: 0,
  //     });
  //   } catch (error) {
  //     console.error("Error sending files:", error);
  //   }
  // };

  const handleSendMessage = () => {
    sendMessage(`Hello from ${isHost ? "Host" : "Client"}`);
  };

  const handleDisconnect = () => {
    disconnect();
    resetAndNavigate("home");
  };

  const handleKickClient = () => {
    kickClient(devices[devices.length - 1].ip);
  };

  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      colors={Colors[colorScheme].linearGradientColors}
      style={styles.main}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleDisconnect}
        >
          <Icon source={icons.back} filter={1} height={20} width={20} />
        </TouchableOpacity>
        <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
          <Icon source={images.logo} height={40} width={40} filter={0} />
          <StyledText fontSize={24} fontWeight="bold" text="DropShare" />
        </View>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleDisconnect}
        >
          <Icon source={icons.disConnect} filter={1} height={20} width={25} />
        </TouchableOpacity>
      </View>

      <View style={{ padding: 15, gap: 10 }}>
        <StyledText
          fontSize={22}
          fontWeight="bold"
          text={isHost ? "Connected Clients" : "Connected Host"}
        />
        <FlatList
          data={devices}
          keyExtractor={(item) => item.ip}
          renderItem={({ item }) => (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 10,
                backgroundColor: Colors[colorScheme].itemBackground,
                borderRadius: 10,
              }}
            >
              <StyledText fontSize={18}>
                {item.name} ({item.ip})
              </StyledText>
              {isHost && (
                <TouchableOpacity onPress={() => kickClient(item.ip)}>
                  <Icon
                    source={icons.cross}
                    filter={1}
                    height={20}
                    width={20}
                  />
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      </View>

      {/* Files Section */}
      <FlatList
        data={[
          { key: "tabs" },
          {
            key: "files",
            data: activeTab === "Sent" ? sentFiles : receivedFiles,
          },
        ]}
        renderItem={({ item }) => {
          if (item.key === "tabs") {
            return (
              <View style={styles.sendReceiveContainer}>
                <TouchableOpacity
                  onPress={() => setActiveTab("Sent")}
                  style={[
                    styles.sendReceiveButton,
                    {
                      backgroundColor:
                        activeTab === "Sent"
                          ? Colors[colorScheme].tint
                          : Colors[colorScheme].background,
                    },
                  ]}
                >
                  <Icon source={icons.sent} height={25} width={25} filter={1} />
                  <StyledText text="Sent" fontSize={18} fontWeight="bold" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setActiveTab("Received")}
                  style={[
                    styles.sendReceiveButton,
                    {
                      backgroundColor:
                        activeTab === "Received"
                          ? Colors[colorScheme].tint
                          : Colors[colorScheme].background,
                    },
                  ]}
                >
                  <Icon
                    source={icons.received}
                    height={25}
                    width={25}
                    filter={1}
                  />
                  <StyledText text="Received" fontSize={18} fontWeight="bold" />
                </TouchableOpacity>
              </View>
            );
          }
          return (
            <View style={styles.fileContainer}>
              <BreakerText text={`${activeTab} Files`} />
              {/* {item.data.length > 0 ? (
                <FlatList
                  data={item.data}
                  keyExtractor={(file) => file.id || file}
                  renderItem={({ item: file }) => (
                    <View style={styles.fileItem}>
                      <StyledText
                        text={file.name || file.split("/").pop()}
                        fontSize={16}
                      />
                      <StyledText
                        text={formatFileSize(file.size || RNFS.stat(file).size)}
                        fontSize={16}
                      />
                    </View>
                  )}
                />
              ) : (
                <StyledText
                  text={`No files ${activeTab.toLowerCase()} yet`}
                  fontSize={18}
                  style={{ textAlign: "center" }}
                />
              )} */}
            </View>
          );
        }}
      />

      {/* Action Buttons */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-around",
          padding: 15,
        }}
      >
        {selectToSend.length > 0 && (
          <TouchableOpacity>
            <StyledText text="Send" fontSize={20} fontWeight="bold" />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => setFileSelectorOpen(true)}>
          <StyledText text="Select Files" fontSize={20} fontWeight="bold" />
        </TouchableOpacity>
      </View>

      {/* Message Button */}
      <TouchableOpacity
        style={styles.messageButton}
        onPress={() => setMessageView(true)}
      >
        <Icon source={icons.message} filter={1} height={30} width={30} />
      </TouchableOpacity>

      <MediaPicker
        selectToSend={selectToSend}
        setSelectToSend={setSelectToSend}
        visible={fileSelectorOpen}
        setVisible={() => setFileSelectorOpen(false)}
      />
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
