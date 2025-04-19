import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Vibration,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { goBack } from "../utils/NavigationUtil";
import Header from "../components/ui/Header";
import useSettingsButton from "../hooks/useSettingsButton";
import CustomToggleSwitch from "../components/ui/CustomToggleSwitch";
import LinearGradient from "react-native-linear-gradient";
import { Colors } from "../constants/Colors";
import { useTheme } from "../hooks/ThemeProvider";
import StyledText from "../components/ui/StyledText";
import useUsername from "../hooks/useUsername";
import BreakerText from "../components/ui/BreakerText";

const SettingsPage = () => {
  const { toggleSetting, getSetting } = useSettingsButton();
  const { colorScheme } = useTheme();
  const { username, saveUsername } = useUsername();
  const [inputValue, setInputValue] = useState(username);
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = () => {
    if (inputValue.trim()) {
      saveUsername(inputValue.trim()).then(() => Vibration.vibrate(50));
      setInputValue(username);
    }
  };

  const settingsList = [
    {
      title: "Show Hidden Files",
      key: "showHiddenFiles",
      value: getSetting("showHiddenFiles"),
      subtitle: "Show hidden files in the file system",
    },
    {
      title: "Enable Smart Search",
      key: "enableSmartSearch",
      value: getSetting("enableSmartSearch"),
      subtitle: "Get Smart Search results with in-device AI",
    },
  ];

  const handleSetting = (key: string) => {
    toggleSetting(key).then(() => Vibration.vibrate(50));
  };

  const styles = SettingsPageStyles(colorScheme, isFocused);

  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      colors={Colors[colorScheme].linearGradientColors}
      style={{ flex: 1 }}
    >
      <Header page="Settings" onPress={goBack} />
      <ScrollView
        scrollEnabled={true}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 15 }}
      >
        <View style={{ gap: 15 }}>
          <View style={{ gap: 5 }}>
            <BreakerText text="Change Username" fontSize={20} />
            <TextInput
              style={styles.input}
              placeholder="Enter username"
              value={inputValue}
              onChangeText={setInputValue}
              placeholderTextColor={Colors[colorScheme].text}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              autoFocus={false}
            />
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
            >
              <StyledText text="Submit" fontWeight="bold" fontSize={22} />
            </TouchableOpacity>
          </View>
          <View style={{ gap: 5 }}>
            <BreakerText text="Settings" fontSize={20} />
            {settingsList.map((setting) => (
              <CustomToggleSwitch
                subtitle={setting.subtitle}
                key={setting.key}
                title={setting.title}
                onToggle={() => handleSetting(setting.key)}
                value={getSetting(setting.key)}
              />
            ))}
          </View>
          <TouchableOpacity
            style={{
              paddingHorizontal: 20,
              paddingVertical: 15,
              borderRadius: 50,
              justifyContent: "center",
              backgroundColor: Colors[colorScheme].transparent,
              borderColor: colorScheme === "light" ? "#99a6bd" : "#566173",
              borderWidth: 1,
            }}
          >
            <StyledText text="Safe Folder" fontWeight="bold" fontSize={22} />
          </TouchableOpacity>
        </View>
      </ScrollView>
      <View style={{ padding: 15 }}>
        <StyledText
          text="Made with ❤️ by Shubham mishra"
          style={{ textAlign: "center" }}
          fontWeight="bold"
          fontSize={17}
        />
      </View>
    </LinearGradient>
  );
};

const SettingsPageStyles = (
  colorScheme: "light" | "dark",
  isFocused: boolean
) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    input: {
      padding: 22,
      marginBottom: 10,
      borderRadius: 50,
      fontFamily: "DancingScript-Bold",
      fontSize: 18,
      color: Colors[colorScheme].text,
      backgroundColor: Colors[colorScheme].transparent,
      borderWidth: 1,
      borderColor: isFocused
        ? Colors[colorScheme].tint
        : colorScheme === "light"
        ? "#99a6bd"
        : "#566173",
    },
    submitButton: {
      padding: 12,
      borderRadius: 50,
      backgroundColor: Colors[colorScheme].tint,
      alignItems: "center",
      justifyContent: "center",
    },
  });

export default SettingsPage;
