import { StyleSheet, Text, View } from "react-native";
import React, { FC } from "react";
import { Colors } from "../../constants/Colors";
import { useTheme } from "../../hooks/ThemeProvider";

const BreakerText: FC<{ text: string }> = ({ text }) => {
  const { colorScheme } = useTheme();
  const styles = BreakerStyles(colorScheme);
  return (
    <View style={styles.main}>
      <View style={styles.horizontalLine} />
      <Text style={styles.text}>{text}</Text>
      <View style={styles.horizontalLine} />
    </View>
  );
};

export default BreakerText;

const BreakerStyles = (colorScheme: "dark" | "light") =>
  StyleSheet.create({
    main: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginHorizontal: 20,
      marginVertical: 5
    },
    horizontalLine: {
      flex: 1,
      height: 2,
      backgroundColor: Colors[colorScheme].tint,
      opacity: 0.6,
      borderRadius: 30
    },
    text: {
      marginHorizontal: 10,
      color: Colors[colorScheme].text,
      fontSize: 18,
      textAlign: "center",
      opacity: 0.7,
    },
  });
