import React, { useEffect, useRef, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { enableScreens } from "react-native-screens";
import Loading from "./components/Loading";
import { navigate, navigationRef } from "./utils/NavigationUtil";
import SharingScreen from "./pages/FileSharingScreen";
import SettingsPage from "./pages/SettingPage";
import { Animated, StatusBar, TouchableOpacity, View } from "react-native";
import Sidebar from "./components/Sidebar";
import { logoHeadStyles } from "./constants/Styles";
import { useTheme } from "./hooks/ThemeProvider";
import { screenWidth } from "./utils/Constants";
import { Colors } from "./constants/Colors";
import Home from "./pages/HomePage";

import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import FileViewer from "./components/FileManager/FileViewer";
import FilesList from "./components/FileManager/FilesList";
import StorageList from "./components/FileManager/StorageList";
import FileSharingScreen from "./pages/FileSharingScreen";
import RecievedFile from "./components/FileManager/RecievedFile";
import StorageScreen from "./pages/StorageScreen";

enableScreens();

const RootLayout = () => {
  const { colorScheme } = useTheme();
  const styles = logoHeadStyles(colorScheme);
  const [visible, setVisible] = useState(false);

  const slideAnim = useRef(new Animated.Value(-screenWidth)).current;

  const toggleSidebar = () => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: -screenWidth,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    } else {
      setVisible(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };
  const [loading, setLoading] = useState(true);
  const Stack = createNativeStackNavigator();

  useEffect(() => {
    setLoading(false);
  }, []);

  if (loading) {
    return <Loading />;
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.main}>
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator
            initialRouteName="home"
            screenOptions={{
              headerShown: false,
              animation: "slide_from_right",
              animationDuration: 1,
            }}
          >
            <Stack.Screen name="home">
              {() => <Home toggleSidebar={toggleSidebar} />}
            </Stack.Screen>
            <Stack.Screen name="setting" component={SettingsPage} />
            <Stack.Screen name="sharing" component={FileSharingScreen} />
            <Stack.Screen name="fileslist" component={FilesList} />
            <Stack.Screen name="storage" component={StorageList} />
            <Stack.Screen name="recieved" component={RecievedFile} />
            <Stack.Screen name="fileviewer">
              {() => <FileViewer />}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar
          backgroundColor={Colors[colorScheme].itemBackground}
          barStyle={colorScheme === "light" ? "dark-content" : "light-content"}
        />
        {visible && (
          <Sidebar slideAnim={slideAnim} toggleSidebar={toggleSidebar} />
        )}
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};

export default RootLayout;
