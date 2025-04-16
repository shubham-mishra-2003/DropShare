// ClientConnection.tsx
import React, { FC, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
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
import { Toast } from "../components/Toasts";
import { connectionStyles } from "../constants/Styles";
import StyledText from "../components/ui/StyledText";

const ClientConnection: FC = () => {
  const { colorScheme } = useTheme();
  const styles = connectionStyles(colorScheme);
  const {
    messages,
    receivedFiles,
    sentFiles,
    sendMessage,
    sendFile,
    disconnect,
    isConnected,
    devices,
  } = useNetwork();

  const [fileSelectorOpen, setFileSelectorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"Sent" | "Received">("Sent");
  const [selectToSend, setSelectToSend] = useState<RNFS.ReadDirItem[]>([]);

  const handleSendFile = async () => {
    if (selectToSend.length < 0) {
      Toast("No files selected");
    }
    try {
      for (const file of selectToSend) {
        const fileData = await RNFS.readFile(file.path, "base64");
        const buffer = Buffer.from(fileData, "base64");
        sendFile(file.path, buffer);
      }
      setSelectToSend([]);
    } catch (error) {
      console.error("Error sending files:", error);
    }
  };

  const handleSendMessage = () => {
    sendMessage("Hello from Client");
  };

  // useEffect(() => {
  //   if (!isConnected) {
  //     resetAndNavigate("home");
  //   }
  // }, [isConnected]);

  return (
    <View style={styles.main}>
      <View>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => resetAndNavigate("home")}
          >
            <Icon source={icons.back} filter={1} height={20} width={20} />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
            <Icon source={images.logo} height={40} width={40} filter={0} />
            <StyledText fontSize={25} fontWeight="bold" text="DropShare" />
          </View>
          <TouchableOpacity style={styles.headerButton} onPress={disconnect}>
            <Icon source={icons.disConnect} filter={1} height={20} width={25} />
          </TouchableOpacity>
        </View>
        {devices.map((host) => (
          <StyledText
            fontSize={17}
            style={{ textAlign: "center", marginBottom: 10 }}
            key={host.ip}
          >
            Connected : {host.name}
          </StyledText>
        ))}
        <View style={styles.fileContainer}>
          <View style={styles.sendReceiveContainer}>
            <View style={styles.selectedFileButtonContainer}>
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
                <StyledText text="Sent" fontSize={22} fontWeight="bold" />
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
                <StyledText text="Recieved" fontSize={22} fontWeight="bold" />
              </TouchableOpacity>
            </View>
          </View>
          <BreakerText
            text={activeTab === "Sent" ? "Sent files" : "Received files"}
          />
          {(activeTab === "Sent" ? sentFiles.length : receivedFiles.length) >
          0 ? (
            <ScrollView
            // contentContainerStyle={styles.fileList}
            >
              {(activeTab === "Sent" ? sentFiles : receivedFiles).map(
                (item: any) => (
                  <View style={styles.selectedFileItem} key={item.path}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 55,
                        overflow: "hidden",
                        height: 35,
                      }}
                    >
                      <StyledText fontSize={14} fontWeight="semi-bold">
                        {item.name}
                      </StyledText>
                      <StyledText fontSize={14} fontWeight="semi-bold">
                        {formatFileSize(item.size)}
                      </StyledText>
                    </View>
                  </View>
                )
              )}
            </ScrollView>
          ) : (
            <StyledText
              style={{ textAlign: "center" }}
              fontSize={20}
              fontWeight="medium"
            >
              {activeTab === "Sent"
                ? "No files sent yet"
                : "No files received yet"}
            </StyledText>
          )}
        </View>
        <View style={styles.selectedFileContainer}>
          <BreakerText text="selected files" />
          {selectToSend.length > 0 ? (
            <ScrollView
            // contentContainerStyle={styles.fileList}
            >
              {selectToSend.map((file) => (
                <View style={styles.selectedFileItem} key={file.path}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: 5,
                      overflow: "hidden",
                      width: 220,
                    }}
                  >
                    <Image
                      src={`file://${file.path}`}
                      height={40}
                      width={40}
                      resizeMode="cover"
                    />
                    <StyledText fontSize={14} fontWeight="semi-bold">
                      {file.name}
                    </StyledText>
                  </View>
                  <StyledText fontSize={14} fontWeight="semi-bold">
                    {formatFileSize(file.size)}
                  </StyledText>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={{ flex: 1, alignItems: "center" }}>
              <StyledText
                text="No files selected"
                fontSize={20}
                fontWeight="semi-bold"
              />
            </View>
          )}
          <TouchableOpacity
            onPress={handleSendFile}
            style={{
              backgroundColor: Colors[colorScheme].tint,
              padding: 10,
              borderRadius: 20,
              width: "70%",
            }}
          >
            <StyledText
              style={{
                textAlign: "center",
                fontSize: 20,
              }}
              fontWeight="bold"
              text="Send"
            />
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ justifyContent: "center", alignItems: "center" }}>
        <TouchableOpacity
          style={{
            backgroundColor: Colors[colorScheme].tint,
            paddingVertical: 10,
            paddingHorizontal: 30,
            borderRadius: 20,
          }}
          onPress={() => setFileSelectorOpen(true)}
        >
          <StyledText
            style={{
              textAlign: "center",
              fontSize: 25,
            }}
            fontWeight="bold"
            text="Select Files"
          />
        </TouchableOpacity>
      </View>
      <MediaPicker
        selectToSend={selectToSend}
        setSelectToSend={setSelectToSend}
        visible={fileSelectorOpen}
        setVisible={() => setFileSelectorOpen(false)}
      />
    </View>
  );
};

export default ClientConnection;
