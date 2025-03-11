import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import net from "react-native-tcp-socket";
import RNFS from "react-native-fs";
import { Colors } from "../constants/Colors";
import { useTheme } from "../hooks/ThemeProvider";
import { useRoute } from "@react-navigation/native";
import { Device } from "../utils/networkUtils";

const TCP_PORT = 6000;

const FileSharingScreen: React.FC = () => {
  const { colorScheme } = useTheme();
  const styles = Styles(colorScheme);

  const route = useRoute();
  const { selectedDevices } = route.params as { selectedDevices: Device[] };

  useEffect(() => {
    selectedDevices.forEach((device) => {
      sendFile(device.address);
    });
  }, []);

  const sendFile = async (ip: string) => {
    try {
      const filePath = RNFS.ExternalStorageDirectoryPath;
      const fileData = await RNFS.readFile(filePath, "base64");

      const client = net.createConnection({ host: ip, port: TCP_PORT }, () => {
        console.log("Connected to receiver:", ip);
        client.write(fileData);
        client.end();
      });

      client.on("error", (err) => {
        console.error("TCP Client Error:", err);
      });

      client.on("close", () => {
        console.log("Connection closed with", ip);
      });
    } catch (error) {
      console.error("Error sending file:", error);
    }
  };

  return (
    <View style={styles.main}>
      <Text style={styles.title}>Sharing Files...</Text>
      {selectedDevices.map((device) => (
        <View key={device.address} style={styles.deviceContainer}>
          <Text style={styles.name}>{device.name}</Text>
        </View>
      ))}
    </View>
  );
};

export default FileSharingScreen;

const Styles = (colorScheme: "dark" | "light") =>
  StyleSheet.create({
    main: {
      flex: 1,
      backgroundColor: Colors[colorScheme].background,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: 24,
      color: Colors[colorScheme].text,
      marginBottom: 20,
    },
    deviceContainer: {
      marginTop: 10,
      padding: 10,
      backgroundColor: Colors[colorScheme].itemBackground,
      borderRadius: 10,
    },
    name: {
      fontSize: 18,
      color: Colors[colorScheme].text,
    },
  });
