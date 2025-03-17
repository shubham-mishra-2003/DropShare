import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Image,
} from "react-native";
import React, { FC, useEffect, useState } from "react";
import { useTCP } from "../service/TCPProvider";
import { resetAndNavigate } from "../utils/NavigationUtil";
import { useTheme } from "../hooks/ThemeProvider";
import { Colors } from "../constants/Colors";
import Icon from "../components/Icon";
import { icons, images } from "../assets";
import MediaPicker from "../components/MediaPicker";
import { formatFileSize } from "../utils/FileSystemUtil";
import BreakerText from "../components/ui/BreakerText";
import RNFS from "react-native-fs";

const ConnectionScreen: FC = () => {
  const { colorScheme } = useTheme();
  const [fileSelectorOpen, setFileSelectorOpen] = useState(false);
  const styles = connectionStyles(colorScheme);
  const {
    connectedDevices,
    disconnect,
    sendFilesAck,
    sentFiles,
    receivedFiles,
    totalReceivedBytes,
    totalSentBytes,
    isConnected,
  } = useTCP();

  const [activeTab, setActiveTab] = useState<"Sent" | "Received">("Sent");
  const [selectToSend, setSelectToSend] = useState<any>();

  const handleSend = async () => {
    if (!selectToSend) {
      console.warn("No file selected");
      return;
    }

    try {
      const fileData = await RNFS.readFile(selectToSend.path, "base64");
      console.log("Encoded file data:", fileData.substring(0, 50));

      sendFilesAck(
        {
          name: selectToSend.name,
          data: fileData,
        },
        "file"
      );
    } catch (error) {
      console.error("Error reading file:", error);
    }
  };

  useEffect(() => {
    if (!isConnected) {
      resetAndNavigate("home");
    }
  }, [isConnected]);

  return (
    <View style={styles.main}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => resetAndNavigate("home")}
          >
            <Icon source={icons.back} filter={1} height={20} width={20} />
          </TouchableOpacity>
          <View
            style={{
              flexDirection: "row",
              gap: 5,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon source={images.logo} height={40} width={40} filter={0} />
            <Text style={{ color: Colors[colorScheme].text }}>DropShare</Text>
          </View>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => disconnect()}
          >
            <Icon source={icons.disConnect} filter={1} height={20} width={25} />
          </TouchableOpacity>
        </View>
        <View
          style={{
            gap: 5,
            justifyContent: "center",
            flexDirection: "row",
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              color: Colors[colorScheme].text,
              fontSize: 15,
              fontWeight: "bold",
            }}
          >
            Connected With :
          </Text>
          <Text
            style={{
              color: Colors[colorScheme].tint,
              fontSize: 15,
              fontWeight: "bold",
            }}
          >
            {connectedDevices || "DropShare_Device"}
          </Text>
        </View>
        <View style={styles.fileContainer}>
          <View style={styles.sendReceiveContainer}>
            <View style={styles.selectedFileButtonContainer}>
              <TouchableOpacity
                onPress={() => setActiveTab("Sent")}
                style={[
                  styles.sendReceiveButton,
                  {
                    backgroundColor:
                      activeTab == "Sent"
                        ? Colors[colorScheme].tint
                        : Colors[colorScheme].background,
                  },
                ]}
              >
                <Icon source={icons.sent} height={25} width={25} filter={1} />
                <Text style={{ color: Colors[colorScheme].text }}>Sent</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab("Received")}
                style={[
                  styles.sendReceiveButton,
                  {
                    backgroundColor:
                      activeTab == "Received"
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
                <Text style={{ color: Colors[colorScheme].text }}>
                  Received
                </Text>
              </TouchableOpacity>
            </View>
            <View
              style={{
                flexDirection: "row",
                gap: 3,
                justifyContent: "flex-end",
                paddingHorizontal: 20,
              }}
            >
              <Text style={{ color: Colors[colorScheme].text, fontSize: 12 }}>
                {formatFileSize(
                  activeTab === "Sent" ? totalSentBytes : totalReceivedBytes
                ) || 0}
              </Text>

              <Text style={{ color: Colors[colorScheme].text, fontSize: 12 }}>
                /
              </Text>

              <Text style={{ color: Colors[colorScheme].text, fontSize: 12 }}>
                {activeTab == "Sent"
                  ? formatFileSize(
                      sentFiles?.reduce(
                        (total: number, file: any) => total + file.size,
                        0
                      )
                    )
                  : formatFileSize(
                      receivedFiles?.reduce(
                        (total: number, file: any) => total + file.size,
                        0
                      )
                    )}
              </Text>
            </View>
          </View>

          <BreakerText
            text={activeTab == "Sent" ? "Sent files" : "Received files"}
          />

          {(activeTab === "Sent" ? sentFiles?.length : receivedFiles?.length) >
          0 ? (
            <ScrollView contentContainerStyle={styles.fileList}>
              {(activeTab == "Sent" ? sentFiles : receivedFiles).map(
                (item: any) => (
                  <View style={styles.fileItem} key={item.id}>
                    <Text style={{ color: Colors[colorScheme].text }}>
                      {item.name}
                    </Text>
                    <Text style={{ color: Colors[colorScheme].text }}>
                      {formatFileSize(item.size)}
                    </Text>
                  </View>
                )
              )}
            </ScrollView>
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={{ color: Colors[colorScheme].text, marginTop: 10 }}>
                {activeTab === "Sent"
                  ? "No files sent yet"
                  : "No files received yet"}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.selectedFileContainer}>
          <BreakerText text="selected files" />
          {selectToSend ? (
            <ScrollView contentContainerStyle={styles.fileList}>
              <View style={styles.selectedFileItem}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Image
                    src={`file://${selectToSend?.path}`}
                    height={40}
                    width={40}
                    resizeMode="cover"
                  />
                  <Text style={{ color: Colors[colorScheme].text }}>
                    {selectToSend?.name}
                  </Text>
                </View>
                <Text style={{ color: Colors[colorScheme].text }}>
                  {formatFileSize(selectToSend?.size)}
                </Text>
              </View>
            </ScrollView>
          ) : (
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text
                style={{
                  color: Colors[colorScheme].text,
                  textAlign: "center",
                  marginTop: 10,
                }}
              >
                No files Selected
              </Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => handleSend()}
            style={{
              backgroundColor: Colors[colorScheme].tint,
              padding: 10,
              borderRadius: 20,
              width: "70%",
            }}
          >
            <Text
              style={{
                color: Colors[colorScheme].text,
                textAlign: "center",
                fontSize: 18,
              }}
            >
              Send
            </Text>
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
          <Text style={{ fontSize: 18, color: Colors[colorScheme].text }}>
            Select Files
          </Text>
        </TouchableOpacity>
      </View>
      <MediaPicker
        selectToSend={selectToSend}
        setSelectToSend={setSelectToSend}
        visible={fileSelectorOpen}
        setVisible={() => setFileSelectorOpen(false)}
      />
      <StatusBar
        backgroundColor={Colors[colorScheme].background}
        barStyle="default"
      />
    </View>
  );
};

export default ConnectionScreen;

const connectionStyles = (colorScheme: "dark" | "light") =>
  StyleSheet.create({
    main: {
      flex: 1,
      backgroundColor: Colors[colorScheme].background,
      justifyContent: "space-between",
      paddingHorizontal: 10,
      paddingBottom: 20,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
    },
    container: {
      gap: 10,
    },
    connectionContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: 10,
    },
    sendReceiveButton: {
      width: "50%",
      borderRadius: 20,
      padding: 10,
      gap: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    headerButton: {
      justifyContent: "center",
      alignItems: "center",
      height: 40,
      width: 40,
      borderRadius: 50,
      backgroundColor: Colors[colorScheme].itemBackground,
    },
    fileContainer: {
      backgroundColor: Colors[colorScheme].itemBackground,
      borderRadius: 20,
      padding: 10,
      height: 320,
      justifyContent: "center",
      alignItems: "center",
    },
    sendReceiveContainer: {},
    fileList: {
      gap: 10,
      paddingVertical: 10,
      alignItems: "center",
    },
    noDataContainer: {
      flex: 1,
      alignItems: "center",
    },
    fileItem: {
      alignItems: "center",
      flexDirection: "row",
      padding: 20,
      gap: 10,
      justifyContent: "space-between",
      backgroundColor: Colors[colorScheme].background,
      borderRadius: 15,
      width: "100%",
    },
    selectedFileContainer: {
      backgroundColor: Colors[colorScheme].itemBackground,
      borderRadius: 20,
      padding: 10,
      height: 250,
      justifyContent: "center",
      alignItems: "center",
    },
    selectedFileItem: {
      alignItems: "center",
      flexDirection: "row",
      padding: 12,
      gap: 10,
      justifyContent: "space-between",
      backgroundColor: Colors[colorScheme].background,
      borderRadius: 15,
      width: "100%",
    },
    selectedFileButtonContainer: {
      flexDirection: "row",
      alignItems: "center",
      padding: 10,
      justifyContent: "center",
      gap: 10,
    },
  });
