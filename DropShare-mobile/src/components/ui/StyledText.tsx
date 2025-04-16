import { StyleSheet, Text } from "react-native";
import React, { useEffect, useState } from "react";
import { useTheme } from "../../hooks/ThemeProvider";
import { Colors } from "../../constants/Colors";

interface StyledTextProps {
  text?: string;
  fontWeight?: "regular" | "bold" | "semi-bold" | "medium";
  style?: {};
  children?: React.ReactNode;
  fontSize?: number;
}

const StyledText = ({
  text,
  fontWeight = "regular",
  style,
  children,
  fontSize,
}: StyledTextProps) => {
  const { colorScheme } = useTheme();
  const styles = StylesTextStyles(fontWeight, colorScheme, fontSize);
  return (
    <Text allowFontScaling={false} style={[styles.text, style]}>
      {text || children}
    </Text>
  );
};

export default StyledText;

const StylesTextStyles = (
  fontWeight: "regular" | "bold" | "semi-bold" | "medium",
  colorScheme: "dark" | "light",
  fontSize?: number
) => {
  let fontFamily = "DancingScript-Regular";
  if (fontWeight === "bold") {
    fontFamily = "DancingScript-Bold";
  } else if (fontWeight === "semi-bold") {
    fontFamily = "DancingScript-SemiBold";
  } else if (fontWeight === "medium") {
    fontFamily = "DancingScript-SemiBold";
  } else {
    fontFamily = "DancingScript-Regular";
  }
  return StyleSheet.create({
    text: {
      fontFamily: fontFamily,
      color: Colors[colorScheme].text,
      fontSize: fontSize || 16,
      textAlignVertical: "center",
    },
  });
};
