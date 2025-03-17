import { StyleSheet, View } from "react-native";
import React from "react";
import DropShareModal from "./Modal";
import { useTheme } from "../../hooks/ThemeProvider";
import { Colors } from "../../constants/Colors";

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
        <View style={styles.container}>
          <View style={styles.line}></View>
          {children}
        </View>
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
    line: {
      position: "absolute",
      top: 10,
      width: 40,
      height: 5,
      backgroundColor: "#bbb",
      borderRadius: 50,
    },
    container: {
      width: "100%",
      height: height,
      backgroundColor: Colors[colorScheme].background,
      borderTopLeftRadius: 40,
      borderTopRightRadius: 40,
      borderTopWidth: 2,
      borderLeftWidth: 2,
      borderRightWidth: 2,
      borderColor: "#fff",
      padding: 10,
      justifyContent: "center",
      alignItems: "center",
      paddingTop: 30
    },
  });
