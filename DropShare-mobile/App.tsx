import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Linking,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Toast } from "./src/components/Toasts";
import { ThemeProvider } from "./src/hooks/ThemeProvider";
import { splashScreenStyles } from "./src/constants/Styles";
import { images } from "./src/assets";
import RootLayout from "./src/RootLayout";
import { requestStoragePermission } from "./src/utils/FileSystemUtil";

export default function App() {
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const [permissioned, setPermissioned] = useState(false);

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

  const backPressCount = useRef(0);
  useEffect(() => {
    const backAction = () => {
      if (backPressCount.current === 0) {
        backPressCount.current += 1;
        Toast("Press back again to exit");
        setTimeout(() => {
          backPressCount.current = 0;
        }, 2000);
        return true;
      }
      if (backPressCount.current === 1) {
        BackHandler.exitApp();
      }
      return true;
    };
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    requestStoragePermission().then(() => setPermissioned(true));
  }, []);

  return (
    <ThemeProvider>
      {isSplashVisible ? (
        <View style={splashScreenStyles.splashContainer}>
          <Animated.Image
            source={images.logo}
            style={[
              splashScreenStyles.logo,
              { transform: [{ scale: scaleAnim }] },
            ]}
          />
          <Text style={splashScreenStyles.splashText}>
            Welcome to DropShare
          </Text>
        </View>
      ) : permissioned ? (
        <RootLayout />
      ) : (
        <View
          style={{
            flex: 1,
            width: "100%",
            backgroundColor: "#000",
            justifyContent: "center",
            alignItems: "center",
            gap: 20,
          }}
        >
          <Text
            style={{
              fontSize: 25,
              color: "#fff",
              textAlign: "center",
            }}
          >
            We can't perform without your permissions
          </Text>
          <TouchableOpacity onPress={() => Linking.openSettings()}>
            <Text
              style={{
                fontSize: 20,
                color: "#00aff0",
                textDecorationLine: "underline",
              }}
            >
              Give permission
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ThemeProvider>
  );
}
