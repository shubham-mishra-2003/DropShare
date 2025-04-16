import { StyleSheet, Text, View } from "react-native";
import React, { FC } from "react";
import { Colors } from "../../constants/Colors";
import { useTheme } from "../../hooks/ThemeProvider";
import StyledText from "./StyledText";

const BreakerText: FC<{ text: string; fontSize?: number }> = ({
  text,
  fontSize = 20,
}) => {
  const { colorScheme } = useTheme();
  const styles = BreakerStyles(colorScheme);
  return (
    <View style={styles.main}>
      <View style={styles.horizontalLine} />
      <StyledText fontWeight="bold" fontSize={fontSize}>
        {text}
      </StyledText>
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
      marginVertical: 10,
      gap: 5,
      padding: 10,
    },
    horizontalLine: {
      flex: 1,
      height: 2,
      backgroundColor: Colors[colorScheme].tint,
      opacity: 0.6,
      borderRadius: 30,
    },
  });
