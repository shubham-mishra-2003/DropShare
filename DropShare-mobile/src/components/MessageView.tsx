import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from "react-native";
import React, { useState } from "react";
import LinearGradient from "react-native-linear-gradient";
import { Colors } from "../constants/Colors";
import { useTheme } from "../hooks/ThemeProvider";
import Icon from "./Icon";
import { icons, images } from "../assets";
import StyledText from "./ui/StyledText";
import { useNetwork } from "../service/NetworkProvider";

const MessageView = ({
  setMessageView,
}: {
  setMessageView: (value: boolean) => void;
}) => {
  const { colorScheme } = useTheme();
  const styles = messageScreenStyles(colorScheme);
  const { disconnect, devices, messages, sendMessage } = useNetwork();
  const [message, setMessage] = useState("");

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
          renderItem={({ item, index }) => (
            <View key={index}>
              <StyledText text={item} />
            </View>
          )}
        />
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
  });
