import React, { useEffect, useState } from "react";
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

const HostTest: React.FC = () => {
  const { colorScheme } = useTheme();
  const {
    devices,
    messages,
    receivedFiles,
    startHosting,
    sendMessage,
    sendFile,
    isHost,
    // stopHosting,
    // removeClient,
  } = useNetwork();
  const [message, setMessage] = useState("");
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectToSend, setSelectToSend] = useState<RNFS.ReadDirItem[]>([]);

  const styles = createStyles(colorScheme);

  const handleSendMessage = () => {
    if (message.trim()) {
      sendMessage(message);
      setMessage("");
    }
  };

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
      <Text style={styles.title}>Host Dashboard</Text>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity style={styles.button} onPress={startHosting}>
          <Text style={styles.buttonText}>Start Hosting</Text>
        </TouchableOpacity>
        <>
          <Text style={styles.subtitle}>Connected Devices</Text>
          <FlatList
            data={devices}
            keyExtractor={(item, index) => `${item.ip}-${index}`}
            renderItem={({ item, index }) => (
              <View key={index} style={styles.card}>
                <Text style={styles.cardText}>
                  {item.name} ({item.ip})
                </Text>
                {/* <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeClient(item.ip)}
                  >
                    <Text style={styles.buttonText}>Remove</Text>
                  </TouchableOpacity> */}
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.noData}>No devices connected</Text>
            }
            scrollEnabled={false}
          />
          <Text style={styles.subtitle}>Messages</Text>
          <FlatList
            data={messages}
            keyExtractor={(_, index) => index.toString()}
            renderItem={({ item, index }) => (
              <View key={index} style={styles.messageCard}>
                <Text style={styles.messageText}>{item}</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.noData}>No messages</Text>}
            scrollEnabled={false}
          />
          <Text style={styles.subtitle}>Received Files</Text>
          <FlatList
            data={receivedFiles}
            keyExtractor={(item, index) => `${item}-${index}`}
            renderItem={({ item, index }) => (
              <View key={index} style={styles.fileCard}>
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
        </>
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
          <Text style={styles.buttonText}>Send Selected Files</Text>
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
    stopButton: {
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
    removeButton: {
      backgroundColor: "orange",
      paddingVertical: 8,
      paddingHorizontal: 15,
      borderRadius: 8,
      marginTop: 5,
    },
    buttonText: {
      color: Colors[colorScheme].background,
      fontSize: 16,
      fontWeight: "600",
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
    cardText: { color: Colors[colorScheme].text, fontSize: 16 },
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
    messageText: { color: Colors[colorScheme].text, fontSize: 14 },
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
    fileText: { color: Colors[colorScheme].text, fontSize: 14 },
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

export default HostTest;
