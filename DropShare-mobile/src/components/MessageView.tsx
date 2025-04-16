import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from "react-native";
import React from "react";
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
  const { disconnect, devices } = useNetwork();
  const handleDisconnect = () => {
    setMessageView(false);
    disconnect();
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
        <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
          <Icon source={images.logo} height={40} width={40} filter={0} />
          <StyledText fontSize={20} fontWeight="bold" text="DropShare" />
        </View>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleDisconnect}
        >
          <Icon source={icons.disConnect} filter={1} height={20} width={25} />
        </TouchableOpacity>
      </View>
      <View>
        <FlatList
          data={devices}
          renderItem={({ item }) => <StyledText text={item.name} />}
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
  });
