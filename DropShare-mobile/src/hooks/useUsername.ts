import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DeviceInfo from "react-native-device-info";
import { Toast } from "../components/Toasts";
import { Vibration } from "react-native";

const useUsername = () => {
  const name = DeviceInfo.getDeviceNameSync();
  const [username, setUsername] = useState<string>(name);

  useEffect(() => {
    const loadUsername = async () => {
      const storedUsername = await AsyncStorage.getItem("username");
      if (storedUsername) setUsername(storedUsername);
    };
    loadUsername();
  }, []);

  const saveUsername = async (newUsername: string) => {
    await AsyncStorage.setItem("username", newUsername);
    setUsername(newUsername);
    Toast(`Username saved ${newUsername}`);
    Vibration.vibrate(100);
  };

  return { username, saveUsername };
};

export default useUsername;
