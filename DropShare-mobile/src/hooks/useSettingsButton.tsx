import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface Settings {
  showHiddenFiles: boolean;
  enableSmartSearch: boolean;
  [key: string]: boolean;
}

const useSettingsButton = () => {
  const defaultSettings: Settings = {
    showHiddenFiles: false,
    enableSmartSearch: false,
  };

  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedSettings = await AsyncStorage.getItem("appSettings");
        if (storedSettings) {
          setSettings(JSON.parse(storedSettings));
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };
    loadSettings();
  }, [settings]);

  const toggleSetting = async (settingKey: keyof Settings) => {
    try {
      const newSettings = {
        ...settings,
        [settingKey]: !settings[settingKey],
      };
      await AsyncStorage.setItem("appSettings", JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  const getSetting = (settingKey: keyof Settings) => settings[settingKey];

  return { settings, toggleSetting, getSetting };
};

export default useSettingsButton;
