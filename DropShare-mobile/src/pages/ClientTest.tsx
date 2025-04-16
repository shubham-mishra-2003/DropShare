import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useNetwork } from "../service/NetworkProvider";
import RNFS from "react-native-fs";
import { Buffer } from "buffer";
import { Colors } from "../constants/Colors";
import { useTheme } from "../hooks/ThemeProvider";
import MediaPicker from "../components/MediaPicker";
import StyledText from "../components/ui/StyledText";

const MAX_CONCURRENT_FILES = 15;
const MAX_TOTAL_SIZE = 5 * 1024 * 1024 * 1024; // 5GB

const calculateChunkSize = (fileSize: number): number => {
  if (fileSize <= 1024 * 1024) return 16 * 1024; // <1MB: 16KB
  if (fileSize <= 10 * 1024 * 1024) return 64 * 1024; // 1MB–10MB: 64KB
  if (fileSize <= 100 * 1024 * 1024) return 1024 * 1024; // 10MB–100MB: 1MB
  return 4 * 1024 * 1024; // >100MB: 4MB
};

interface TransferStatus {
  fileId: string;
  fileName: string;
  totalChunks: number;
  receivedChunks: number;
  status: "Sending" | "Receiving" | "Completed" | "Failed";
}

const ClientTest: React.FC = () => {
  const { colorScheme } = useTheme();
  const {
    devices,
    messages,
    receivedFiles,
    startClient,
    connectToHostIp,
    sendMessage,
    sendFile,
    isConnected,
    disconnect,
    sendMultipleFiles,
  } = useNetwork();
  const [message, setMessage] = useState("");
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectToSend, setSelectToSend] = useState<RNFS.ReadDirItem[]>([]);
  const [localProgress, setLocalProgress] = useState<TransferStatus[]>([]);

  const styles = createStyles(colorScheme);

  const handleSendMessage = () => {
    if (message.trim()) {
      sendMessage(message);
      setMessage("");
    }
  };

  // const handleSendFiles = async () => {
  //   if (selectToSend.length > MAX_CONCURRENT_FILES) {
  //     console.log(
  //       `❌ Cannot send ${selectToSend.length} files; max ${MAX_CONCURRENT_FILES}`
  //     );
  //     return;
  //   }

  //   let totalSize = 0;
  //   for (const file of selectToSend) {
  //     const stat = await RNFS.stat(file.path);
  //     totalSize += stat.size;
  //     if (stat.size > MAX_TOTAL_SIZE) {
  //       console.log(`❌ File ${file.name} exceeds 5GB limit`);
  //       return;
  //     }
  //   }
  //   if (totalSize > MAX_TOTAL_SIZE) {
  //     console.log("❌ Total file size exceeds 5GB limit");
  //     return;
  //   }

  //   const filesMetadata = await Promise.all(
  //     selectToSend.map(async (file) => {
  //       const stat = await RNFS.stat(file.path);
  //       const fileSize = stat.size;
  //       const chunkSize = calculateChunkSize(fileSize);
  //       const totalChunks = Math.ceil(fileSize / chunkSize);
  //       const fileId = `${file.name}-${Date.now()}`;
  //       return {
  //         fileId,
  //         fileName: file.name,
  //         fileSize,
  //         chunkSize,
  //         totalChunks,
  //       };
  //     })
  //   );

  //   const header = Buffer.from(
  //     JSON.stringify({
  //       fileCount: selectToSend.length,
  //       files: filesMetadata,
  //     })
  //   );

  //   await sendFile("HEADER", header);

  //   for (const file of selectToSend) {
  //     const stat = await RNFS.stat(file.path);
  //     const fileSize = stat.size;
  //     const chunkSize = calculateChunkSize(fileSize);
  //     const totalChunks = Math.ceil(fileSize / chunkSize);
  //     const fileId = `${file.name}-${Date.now()}`;

  //     setLocalProgress((prev) => [
  //       ...prev,
  //       {
  //         fileId,
  //         fileName: file.name,
  //         totalChunks,
  //         receivedChunks: 0,
  //         status: "Sending",
  //       },
  //     ]);

  //     let offset = 0;
  //     let chunkIndex = 0;
  //     while (offset < fileSize) {
  //       const chunk = await RNFS.read(file.path, chunkSize, offset, "base64");
  //       const buffer = Buffer.from(chunk, "base64");
  //       const chunkHeader = Buffer.from(
  //         JSON.stringify({ fileId, chunkIndex, totalChunks })
  //       );
  //       const chunkData = Buffer.concat([
  //         Buffer.from("CHUNK:"),
  //         chunkHeader,
  //         Buffer.from("\n\n"),
  //         buffer,
  //       ]);
  //       await sendFile(`${file.path}-chunk-${chunkIndex}`, chunkData);
  //       offset += chunkSize;
  //       chunkIndex++;
  //       setLocalProgress((prev) =>
  //         prev.map((p) =>
  //           p.fileId === fileId
  //             ? { ...p, receivedChunks: chunkIndex, status: "Sending" }
  //             : p
  //         )
  //       );
  //     }

  //     setLocalProgress((prev) =>
  //       prev.map((p) =>
  //         p.fileId === fileId ? { ...p, status: "Completed" } : p
  //       )
  //     );
  //   }

  //   setSelectToSend([]);
  //   setPickerVisible(false);
  // };

  const handleSendFiles = async () => {
    for (const file of selectToSend) {
      const fileData = await RNFS.readFile(file.path, "base64");
      const buffer = Buffer.from(fileData, "base64");
      await sendFile(file.path, buffer);
    }
    setSelectToSend([]);
    setPickerVisible(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Client Dashboard</Text>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {isConnected && devices.length > 0 ? (
          <View style={styles.connectionStatus}>
            <StyledText style={styles.statusText}>
              Connected to "{devices[0]?.name}" ({devices[0]?.ip})
            </StyledText>
          </View>
        ) : (
          <StyledText style={styles.statusText}>Disconnected</StyledText>
        )}
        {!isConnected ? (
          <>
            <TouchableOpacity style={styles.button} onPress={startClient}>
              <StyledText style={styles.buttonText}>Discover Hosts</StyledText>
            </TouchableOpacity>
            <Text style={styles.subtitle}>Available Hosts</Text>
            <FlatList
              data={devices.filter((d) => d.role === "Host")}
              keyExtractor={(item) => item.ip}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => connectToHostIp(item.ip)}
                >
                  <Text style={styles.cardText}>
                    {item.name} ({item.ip})
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.noData}>No hosts found</Text>
              }
              scrollEnabled={false}
            />
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>Messages</Text>
            <FlatList
              data={messages}
              keyExtractor={(_, index) => index.toString()}
              renderItem={({ item }) => (
                <View style={styles.messageCard}>
                  <Text style={styles.messageText}>{item}</Text>
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.noData}>No messages</Text>
              }
              scrollEnabled={false}
            />
            <Text style={styles.subtitle}>File Transfers</Text>
            <FlatList
              data={[...localProgress]}
              keyExtractor={(item) => item.fileId}
              renderItem={({ item }) => (
                <View style={styles.transferCard}>
                  <Text style={styles.transferText}>
                    {item.fileName} - {item.progress} ({item.receivedChunks}/
                    {item.totalChunks} chunks)
                  </Text>
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.noData}>No active transfers</Text>
              }
              scrollEnabled={false}
            />
            <Text style={styles.subtitle}>Received Files</Text>
            <FlatList
              data={receivedFiles}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <View style={styles.fileCard}>
                  <Text style={styles.fileText}>{item.split("/").pop()}</Text>
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.noData}>No files received</Text>
              }
              scrollEnabled={false}
            />
            <TextInput
              style={styles.input}
              value={message}
              onChangeText={setMessage}
              placeholder="Type a message..."
              placeholderTextColor={Colors[colorScheme].text + "80"}
            />
            <TouchableOpacity style={styles.button} onPress={handleSendMessage}>
              <Text style={styles.buttonText}>Send Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.button}
              onPress={() => setPickerVisible(true)}
            >
              <Text style={styles.buttonText}>Send Files</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.disconnectButton}
              onPress={disconnect}
            >
              <Text style={styles.buttonText}>Disconnect</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
      <MediaPicker
        visible={pickerVisible}
        setVisible={setPickerVisible}
        selectToSend={selectToSend}
        setSelectToSend={setSelectToSend}
      />
      {selectToSend.length > 0 && (
        <TouchableOpacity
          style={styles.sendFilesButton}
          onPress={handleSendFiles}
        >
          <StyledText style={styles.buttonText}>Send Selected Files</StyledText>
        </TouchableOpacity>
      )}
    </View>
  );
};

const createStyles = (colorScheme: "light" | "dark") =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors[colorScheme].background,
      paddingTop: 50,
    },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
    title: {
      fontSize: 28,
      fontWeight: "bold",
      color: Colors[colorScheme].text,
      textAlign: "center",
      marginBottom: 20,
    },
    subtitle: {
      fontSize: 20,
      fontWeight: "600",
      color: Colors[colorScheme].text,
      marginTop: 20,
      marginBottom: 10,
    },
    connectionStatus: {
      backgroundColor: Colors[colorScheme].itemBackground,
      padding: 10,
      borderRadius: 8,
      marginBottom: 10,
      alignItems: "center",
    },
    statusText: {
      fontSize: 16,
      color: Colors[colorScheme].text,
    },
    button: {
      backgroundColor: Colors[colorScheme].tint,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: "center",
      marginVertical: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    buttonText: {
      color: Colors[colorScheme].background,
      fontSize: 16,
      fontWeight: "600",
    },
    disconnectButton: {
      backgroundColor: "red",
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: "center",
      marginVertical: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    card: {
      backgroundColor: Colors[colorScheme].itemBackground,
      padding: 15,
      borderRadius: 10,
      marginVertical: 5,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    },
    cardText: {
      color: Colors[colorScheme].text,
      fontSize: 16,
    },
    messageCard: {
      backgroundColor: Colors[colorScheme].itemBackground,
      padding: 10,
      borderRadius: 8,
      marginVertical: 5,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 1,
    },
    messageText: {
      color: Colors[colorScheme].text,
      fontSize: 14,
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
    transferText: {
      color: Colors[colorScheme].text,
      fontSize: 14,
      flex: 1,
    },
    fileCard: {
      backgroundColor: Colors[colorScheme].itemBackground,
      padding: 10,
      borderRadius: 8,
      marginVertical: 5,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 1,
    },
    fileText: {
      color: Colors[colorScheme].text,
      fontSize: 14,
    },
    input: {
      backgroundColor: Colors[colorScheme].itemBackground,
      color: Colors[colorScheme].text,
      padding: 12,
      borderRadius: 8,
      marginVertical: 10,
      fontSize: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 1,
    },
    noData: {
      color: Colors[colorScheme].text + "80",
      fontSize: 14,
      textAlign: "center",
      marginVertical: 10,
    },
    sendFilesButton: {
      position: "absolute",
      bottom: 20,
      left: 20,
      right: 20,
      backgroundColor: Colors[colorScheme].tint,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
  });

export default ClientTest;
