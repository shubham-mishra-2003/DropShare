import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
} from "react-native";
import React, { useState, useEffect, useRef } from "react";
import LinearGradient from "react-native-linear-gradient";
import { Colors } from "../constants/Colors";
import { useTheme } from "../hooks/ThemeProvider";
import Icon from "./Icon";
import { icons } from "../assets";
import StyledText from "./ui/StyledText";
import { useNetwork } from "../service/NetworkProvider";
import { getLocalIPAddress } from "../utils/NetworkUtils";

interface processedMessages extends message {
  isSelf: boolean;
}
const MessageView = ({
  setMessageView,
}: {
  setMessageView: (value: boolean) => void;
}) => {
  const { colorScheme } = useTheme();
  const { sendMessage, messages } = useNetwork();
  const styles = messageScreenStyles(colorScheme);
  const [message, setMessage] = useState("");
  const [focused, setFocused] = useState(false);
  const [processedMessages, setProcessedMessages] = useState<
    processedMessages[]
  >([]);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const processMessages = async () => {
      const localIp = await getLocalIPAddress();
      const updatedMessages = messages.map((msg) => ({
        ...msg,
        isSelf: msg.ip === localIp,
      }));
      setProcessedMessages(updatedMessages);
    };

    processMessages();
  }, [messages]);

  useEffect(() => {
    if (flatListRef.current && processedMessages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [processedMessages, focused]);

  const handleSendMessage = () => {
    if (message.trim()) {
      sendMessage(message);
      setMessage("");
    }
  };

  const renderMessages = ({ item }: { item: processedMessages }) => {
    return (
      <View
        style={[
          styles.messageCard,
          {
            alignSelf: item.isSelf ? "flex-end" : "flex-start",
            borderBottomRightRadius: item.isSelf ? 5 : 20,
            borderBottomLeftRadius: item.isSelf ? 20 : 5,
          },
        ]}
      >
        <View
          style={{
            backgroundColor: Colors[colorScheme].itemBackground,
            borderLeftWidth: item.isSelf ? 0 : 2,
            borderRightWidth: item.isSelf ? 2 : 0,
            borderColor: Colors[colorScheme].tint,
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 20,
          }}
        >
          <StyledText
            style={{ textAlign: item.isSelf ? "right" : "left" }}
            fontSize={14}
            text={item.name}
          />
        </View>
        <View style={{ padding: 10 }}>
          <StyledText
            style={{ textAlign: item.isSelf ? "right" : "left" }}
            fontSize={17}
            text={item.message}
          />
        </View>
      </View>
    );
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
      </View>
      <View style={styles.messageContainer}>
        <FlatList
          ref={flatListRef}
          data={processedMessages}
          scrollEnabled
          contentContainerStyle={{ gap: 15, padding: 15 }}
          renderItem={renderMessages}
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
      flex: 1,
      paddingBottom: 15,
    },
    header: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 20,
    },
    headerButton: {
      position: "absolute",
      padding: 10,
      left: 10,
    },
    messageContainer: {
      flex: 1,
      borderRadius: 10,
    },
    messageCard: {
      backgroundColor: Colors[colorScheme].transparent,
      width: "auto",
      maxWidth: "80%",
      borderRadius: 20,
      overflow: "hidden",
      padding: 5,
      borderWidth: 2,
      borderColor: Colors[colorScheme].itemBackground,
    },
    inputContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 10,
      borderRadius: 10,
      backgroundColor: Colors[colorScheme].transparent,
      borderWidth: 1,
      marginHorizontal: 10,
    },
  });
