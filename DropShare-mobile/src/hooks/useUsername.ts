import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DeviceInfo from "react-native-device-info";
import { Toast } from "../components/Toasts";
import { Vibration } from "react-native";

const useUsername = () => {
  const name = DeviceInfo.getDeviceNameSync();
  const [username, setUsername] = useState<string>(name);

  const loadUsername = async () => {
    try {
      const storedUsername = await AsyncStorage.getItem("username");
      if (storedUsername) setUsername(storedUsername);
    } catch (error) {
      Toast("Error loading username");
    }
  };

  useEffect(() => {
    loadUsername();
  }, []);

  const saveUsername = async (newUsername: string) => {
    try {
      await AsyncStorage.setItem("username", newUsername);
      setUsername(newUsername);
      Toast(`Username saved: ${newUsername}`);
      Vibration.vibrate(100);
    } catch (error) {
      Toast("Error saving username");
      throw error;
    }
  };

  return { username, saveUsername, loadUsername };
};

export default useUsername;
