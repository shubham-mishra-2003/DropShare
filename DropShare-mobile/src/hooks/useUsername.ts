import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DeviceInfo from "react-native-device-info";

const useUsername = () => {
  const name = DeviceInfo.getDeviceNameSync()
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
  };

  return { username, saveUsername };
};

export default useUsername;
