import { StyleSheet, TouchableWithoutFeedback, View } from "react-native";
import React from "react";
import DropShareModal from "./Modal";
import { useTheme } from "../../hooks/ThemeProvider";
import { Colors } from "../../constants/Colors";
import LinearGradient from "react-native-linear-gradient";

interface bottomSheerProps {
  children: React.ReactNode;
  visible: boolean;
  onRequestClose?: () => void;
  height?: number;
}

const BottomSheet = ({
  children,
  visible,
  onRequestClose,
  height = 300,
}: bottomSheerProps) => {
  const { colorScheme } = useTheme();
  const styles = bottomSheetStyles(colorScheme, height);

  return (
    <DropShareModal visible={visible} onRequestClose={onRequestClose}>
      <View style={styles.overlay}>
        <LinearGradient
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          colors={Colors[colorScheme].linearGradientColors}
          style={styles.container}
        >
          {children}
        </LinearGradient>
      </View>
    </DropShareModal>
  );
};

export default BottomSheet;

const bottomSheetStyles = (colorScheme: "dark" | "light", height: number) =>
  StyleSheet.create({
    overlay: {
      position: "absolute",
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      justifyContent: "flex-end",
    },
    container: {
      width: "100%",
      height: height,
      backgroundColor:
        colorScheme == "dark"
          ? "rgba(0, 0, 0, 0.9)"
          : "rgba(255, 255, 255, 0.8)",
      borderTopLeftRadius: 40,
      borderTopRightRadius: 40,
      borderTopWidth: 2,
      borderLeftWidth: 2,
      borderRightWidth: 2,
      borderColor: "#fff",
      padding: 10,
      justifyContent: "center",
      alignItems: "center",
      paddingTop: 30,
    },
  });
