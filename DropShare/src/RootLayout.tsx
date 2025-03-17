import React, { useEffect, useRef, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { enableScreens } from "react-native-screens";
import { navigationRef } from "./utils/NavigationUtil";
import SettingsPage from "./pages/SettingPage";
import {
  Animated,
  Linking,
  PermissionsAndroid,
  Platform,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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
import ConnectionScreen from "./pages/ConnectionScreen";
import SendScreen from "./pages/SendScreen";
import ReceiveScreen from "./pages/ReceiveScreen";
import { TCPProvider } from "./service/TCPProvider";
import ReceivedFile from "./components/FileManager/ReceivedFile";

enableScreens();

const RootLayout = () => {
  const { colorScheme } = useTheme();
  const styles = logoHeadStyles(colorScheme);
  const [visible, setVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-screenWidth)).current;
  const Stack = createNativeStackNavigator();

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

  return (
    <TCPProvider>
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
              <Stack.Screen name="fileslist" component={FilesList} />
              <Stack.Screen name="storage" component={StorageList} />
              <Stack.Screen name="received" component={ReceivedFile} />
              <Stack.Screen name="fileviewer" component={FileViewer} />
              <Stack.Screen name="connection" component={ConnectionScreen} />
              <Stack.Screen name="sendscreen" component={SendScreen} />
              <Stack.Screen name="receivescreen" component={ReceiveScreen} />
            </Stack.Navigator>
          </NavigationContainer>
          <StatusBar
            backgroundColor={Colors[colorScheme].itemBackground}
            barStyle={
              colorScheme === "light" ? "dark-content" : "light-content"
            }
          />
          {visible && (
            <Sidebar slideAnim={slideAnim} toggleSidebar={toggleSidebar} />
          )}
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </TCPProvider>
  );
};

export default RootLayout;
