import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
} from "react-native";
import React, { useState } from "react";
import LinearGradient from "react-native-linear-gradient";
import { Colors } from "../constants/Colors";
import { useTheme } from "../hooks/ThemeProvider";
import Icon from "./Icon";
import { icons, images } from "../assets";
import StyledText from "./ui/StyledText";
import { useNetwork } from "../service/NetworkProvider";
import { getIpAddress } from "react-native-device-info";
import {
  getBroadcastIPAddress,
  getLocalIPAddress,
} from "../utils/NetworkUtils";

const MessageView = ({
  setMessageView,
}: {
  setMessageView: (value: boolean) => void;
}) => {
  const { colorScheme } = useTheme();
  const { disconnect, sendMessage, devices, messages } = useNetwork();
  const styles = messageScreenStyles(colorScheme);
  const [message, setMessage] = useState("");
  const [focused, setFocused] = useState(false);

  const getDeviceIp = async () => {
    const deviceIp = await getLocalIPAddress();
    return deviceIp;
  };

  const deviceIp = getDeviceIp();

  const handleDisconnect = () => {
    setMessageView(false);
    disconnect();
  };

  const handleSendMessage = () => {
    if (message.trim()) {
      sendMessage(message);
      setMessage("");
    }
  };

  const isSelf = (ip: Promise<string>) => {
    if (ip !== deviceIp) {
      return true;
    } else {
      return false;
    }
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
          onPress={() => setMessageView(false)}
        >
          <Icon source={icons.back} filter={1} height={20} width={20} />
        </TouchableOpacity>
        <StyledText
          fontSize={22}
          isEllipsis
          fontWeight="bold"
          text="Messages"
        />
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleDisconnect}
        >
          <Icon source={icons.disConnect} filter={1} height={20} width={25} />
        </TouchableOpacity>
      </View>
      <View style={styles.messageContainer}>
        <FlatList
          data={messages}
          contentContainerStyle={{ gap: 10, flex: 1 }}
          keyExtractor={(_, index) => index.toString()}
          renderItem={({ item, index }) => (
            <View
              key={index}
              style={[
                styles.messageCard,
                {
                  alignSelf: devices.find(
                    async (device) => device.ip === (await deviceIp)
                  )
                    ? "flex-end"
                    : "flex-start",
                },
              ]}
            >
              <StyledText fontSize={16} text={item.text} />
            </View>
          )}
          ListEmptyComponent={
            <StyledText
              fontSize={16}
              style={{ textAlign: "center", marginTop: 10 }}
              fontWeight="medium"
              text="No Conversations Yet"
            />
          }
        />
      </View>
      <View
        style={[
          styles.inputContainer,
          {
            borderColor: focused
              ? Colors[colorScheme].tint
              : Colors[colorScheme].itemBackground,
          },
        ]}
      >
        <TextInput
          placeholder="Type a message"
          value={message}
          onChangeText={setMessage}
          placeholderTextColor={Colors[colorScheme].text}
          style={{
            flex: 1,
            padding: 10,
            color: Colors[colorScheme].text,
            fontSize: 16,
            fontFamily: "DancingScript-Bold",
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <TouchableOpacity
          style={{
            padding: 10,
            backgroundColor: Colors[colorScheme].tint,
            borderRadius: 30,
          }}
          onPress={handleSendMessage}
        >
          <Icon source={icons.send} filter={1} height={25} width={25} />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
};

export default MessageView;

const messageScreenStyles = (colorScheme: "dark" | "light") =>
  StyleSheet.create({
    main: {
      padding: 15,
      flex: 1,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    headerButton: {
      padding: 10,
    },
    messageContainer: {
      flex: 1,
      borderRadius: 10,
      padding: 10,
    },
    messageCard: {
      padding: 22,
      backgroundColor: Colors[colorScheme].transparent,
      width: "auto",
      maxWidth: "80%",
      borderRadius: 30,
    },
    messageText: {
      fontSize: 16,
    },
    deviceContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    inputContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 10,
      borderRadius: 10,
      backgroundColor: Colors[colorScheme].transparent,
      borderWidth: 1,
    },
  });
