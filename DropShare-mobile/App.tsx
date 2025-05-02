import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  BackHandler,
  Linking,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Toast } from "./src/components/Toasts";
import { ThemeProvider } from "./src/hooks/ThemeProvider";
import RootLayout from "./src/RootLayout";
import SplashScreen from "./src/components/SplashScreen";
import {
  requestPermissions,
  verifyAllFilesAccess,
} from "./src/utils/permissionRequests";

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [permissioned, setPermissioned] = useState(false);
  const [contentLoaded, setContentLoaded] = useState(false);
  const backPressCount = useRef(0);

  const initializeApp = useCallback(async () => {
    const minSplashDuration = 2200;
    const start = Date.now();
  
    try {
      await Promise.all([
        requestPermissions(),
        verifyAllFilesAccess().then((hasAccess) => setPermissioned(hasAccess)),
      ]);
    } catch (error) {
      console.error("Error initializing app:", error);
      Toast("Failed to initialize app permissions");
      setPermissioned(false);
    } finally {
      const elapsed = Date.now() - start;
      const remaining = minSplashDuration - elapsed;
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      setContentLoaded(true);
    }
  }, []);

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

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

  return (
    <ThemeProvider>
      <View style={{ flex: 1, width: "100%" }}>
        {permissioned ? (
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
            <TouchableOpacity onPress={initializeApp}>
              <Text
                style={{
                  fontSize: 20,
                  color: "#00aff0",
                  textDecorationLine: "underline",
                }}
              >
                Retry permissions
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {isLoading && (
          <SplashScreen
            contentLoaded={contentLoaded}
            onAnimationComplete={() => setIsLoading(false)}
          />
        )}
      </View>
    </ThemeProvider>
  );
}
