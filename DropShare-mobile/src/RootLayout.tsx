import React, { useEffect, useRef, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { enableScreens } from "react-native-screens";
import { navigationRef } from "./utils/NavigationUtil";
import { Animated, StatusBar } from "react-native";
import Sidebar from "./components/Sidebar";
import { logoHeadStyles } from "./constants/Styles";
import { useTheme } from "./hooks/ThemeProvider";
import { screenWidth } from "./utils/Constants";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import FileViewer from "./components/FileManager/FileViewer";
import FilesList from "./components/FileManager/FilesList";
import StorageList from "./components/FileManager/StorageList";
import ReceivedFile from "./components/FileManager/ReceivedFile";
import HostScreen from "./pages/HostScreen";
import ClientScreen from "./pages/ClientScreen";
import SettingsPage from "./pages/SettingsPage";
import Home from "./pages/HomePage";
import { NetworkProvider } from "./service/NetworkProvider";
import { startIndexing } from "./db/dropshareDb";
import { Colors } from "./constants/Colors";
import ConnectionScreen from "./pages/ConnectionScreen";
import { ChunkStorage } from "./service/ChunkStorage";

enableScreens();

const RootLayout = () => {
  const { colorScheme } = useTheme();
  const styles = logoHeadStyles(colorScheme);
  const [visible, setVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-screenWidth)).current;
  const Stack = createNativeStackNavigator();

  useEffect(() => {
    startIndexing(false);
    ChunkStorage.initialize();
  }, []);

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
    <NetworkProvider>
      <SafeAreaProvider>
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: Colors[colorScheme].background,
            margin: 0,
            padding: 0,
          }}
        >
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
                <Stack.Screen name="storage" component={StorageList} />
                <Stack.Screen name="received" component={ReceivedFile} />
                <Stack.Screen name="fileslist" component={FilesList} />
                <Stack.Screen name="fileviewer" component={FileViewer} />
                <Stack.Screen name="hostscreen" component={HostScreen} />
                <Stack.Screen name="clientscreen" component={ClientScreen} />
                <Stack.Screen
                  name="connectionscreen"
                  component={ConnectionScreen}
                />
              </Stack.Navigator>
            </NavigationContainer>
            <StatusBar
              backgroundColor={Colors[colorScheme].background}
              barStyle={
                colorScheme == "dark" ? "light-content" : "dark-content"
              }
            />
            {visible && (
              <Sidebar slideAnim={slideAnim} toggleSidebar={toggleSidebar} />
            )}
          </GestureHandlerRootView>
        </SafeAreaView>
      </SafeAreaProvider>
    </NetworkProvider>
  );
};

export default RootLayout;
