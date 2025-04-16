import { Animated, StyleSheet } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { Colors } from "../constants/Colors";
import { splashScreenStyles } from "../constants/Styles";
import { images } from "../assets";
import StyledText from "./ui/StyledText";
import { useEffect, useRef } from "react";
import { useTheme } from "../hooks/ThemeProvider";

const SplashScreen = ({
  setIsSplashVisible,
}: {
  setIsSplashVisible: (value: boolean) => void;
}) => {
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        setIsSplashVisible(false);
      }, 500);
    });
  }, [scaleAnim, setIsSplashVisible]);

  const textStyle = {
    marginTop: 10,
  };

  const { colorScheme } = useTheme();

  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      colors={Colors[colorScheme].linearGradientColors}
      style={splashScreenStyles.splashContainer}
    >
      <Animated.Image
        source={images.logo}
        style={[splashScreenStyles.logo, { transform: [{ scale: scaleAnim }] }]}
      />
      <StyledText
        fontSize={30}
        style={textStyle}
        fontWeight="bold"
        text="Welcome to DropShare"
      />
    </LinearGradient>
  );
};

export default SplashScreen;
