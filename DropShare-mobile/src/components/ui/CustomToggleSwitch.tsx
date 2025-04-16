import React, { useEffect } from "react";
import {
  StyleSheet,
  TouchableWithoutFeedback,
  Animated,
  View,
} from "react-native";
import { Colors } from "../../constants/Colors";
import { useTheme } from "../../hooks/ThemeProvider";
import StyledText from "./StyledText";

const CustomToggleSwitch = ({
  onToggle,
  value = false,
  title,
  subtitle,
}: {
  onToggle: (value: boolean) => void;
  value: boolean;
  title: string;
  subtitle?: string;
}) => {
  const size = 60;
  const { colorScheme } = useTheme();
  const animatedValue = React.useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(animatedValue, {
      toValue: value ? 1 : 0,
      speed: 15,
      bounciness: 20,
      useNativeDriver: true,
    }).start();
  }, [value, animatedValue]);

  const handleToggle = () => {
    if (onToggle) onToggle(!value);
  };

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [3, size - 30],
  });

  const styles = SwitchStyles(value, colorScheme);

  return (
    <TouchableWithoutFeedback onPress={handleToggle}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 10,
          paddingVertical: 20,
          backgroundColor: Colors[colorScheme].transparent,
          borderRadius: 20,
          // borderWidth: 1,
          // borderColor: Colors[colorScheme].border,
        }}
      >
        <View style={{ flexDirection: "column", gap: 5, width: "80%" }}>
          <StyledText fontSize={20} fontWeight="bold" text={title} />
          {subtitle && (
            <StyledText
              style={{ color: colorScheme === "light" ? "#3b414a" : "#a3b2c9" }}
              fontSize={16}
              fontWeight="medium"
              text={subtitle}
            />
          )}
        </View>
        <Animated.View
          style={[
            styles.container,
            {
              width: size,
              height: size * 0.55,
              borderRadius: size * 0.3,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.circle,
              {
                width: size * 0.45,
                height: size * 0.45,
                borderRadius: (size * 0.45) / 2,
                transform: [{ translateX }],
              },
            ]}
          ></Animated.View>
        </Animated.View>
      </View>
    </TouchableWithoutFeedback>
  );
};

const SwitchStyles = (value: boolean, colorScheme: "light" | "dark") =>
  StyleSheet.create({
    container: {
      justifyContent: "center",
      backgroundColor: value
        ? Colors[colorScheme].tint
        : Colors[colorScheme].transparent,
      borderColor: value
        ? Colors[colorScheme].tint
        : colorScheme === "light"
        ? "#99a6bd"
        : "#566173",
      borderWidth: 1,
    },
    circle: {
      backgroundColor: value
        ? Colors[colorScheme].itemBackground
        : colorScheme === "light"
        ? "#99a6bd"
        : "#566173",
      justifyContent: "center",
      alignItems: "center",
    },
  });

export default CustomToggleSwitch;
