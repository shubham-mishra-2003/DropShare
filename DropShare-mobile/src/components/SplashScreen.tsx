import { Animated, StyleSheet, Easing } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { Colors } from "../constants/Colors";
import { splashScreenStyles } from "../constants/Styles";
import { images } from "../assets";
import StyledText from "./ui/StyledText";
import { useEffect, useRef } from "react";
import { useTheme } from "../hooks/ThemeProvider";

interface SplashScreenProps {
  contentLoaded: boolean;
  onAnimationComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({
  contentLoaded,
  onAnimationComplete,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const { colorScheme } = useTheme();

  // Map rotation values for a subtle effect (-5 to 5 degrees)
  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["-5deg", "5deg"],
  });

  useEffect(() => {
    const zoomInLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1400,
            easing: Easing.bezier(0.68, -0.55, 0.265, 1.55), // Custom bounce-like easing
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 1400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 0.7,
            duration: 1400,
            easing: Easing.bezier(0.68, -0.55, 0.265, 1.55),
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: 0,
            duration: 1400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    if (!contentLoaded) {
      zoomInLoop.start();
    } else {
      zoomInLoop.stop();
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => onAnimationComplete());
    }

    return () => zoomInLoop.stop();
  }, [contentLoaded, scaleAnim, opacityAnim, rotateAnim, onAnimationComplete]);

  return (
    <Animated.View
      style={{
        opacity: opacityAnim,
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      <LinearGradient
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        colors={Colors[colorScheme].linearGradientColors}
        style={splashScreenStyles.splashContainer}
      >
        <Animated.Image
          source={images.logo}
          style={[
            splashScreenStyles.logo,
            {
              transform: [{ scale: scaleAnim }, { rotate: rotation }],
            },
          ]}
          resizeMode="contain"
        />
        <StyledText
          fontSize={30}
          style={{ marginTop: 20 }}
          fontWeight="bold"
          text="Welcome to DropShare"
        />
      </LinearGradient>
    </Animated.View>
  );
};

export default SplashScreen;
