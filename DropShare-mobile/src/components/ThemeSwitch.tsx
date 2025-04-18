import React, { useRef, useState } from "react";

import { View, TouchableOpacity, Image, Vibration } from "react-native";
import { useTheme } from "../hooks/ThemeProvider";
import { ModeSwitchStyles } from "../constants/Styles";
import { Colors } from "../constants/Colors";
import { icons } from "../assets";
import StyledText from "./ui/StyledText";

const modes = [
  { value: "system", label: "System", icon: icons.contrast },
  { value: "dark", label: "Dark", icon: icons.moon },
  { value: "light", label: "Light", icon: icons.sun },
] as const;

const ThemeSwitch = () => {
  const { colorScheme, setTheme, theme } = useTheme();
  const dropdownRef = useRef<View | null>(null);
  const styles = ModeSwitchStyles(colorScheme);
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const handleSelection = (value: (typeof modes)[number]["value"]) => {
    setTheme(value);
    setDropdownVisible(false);
    Vibration.vibrate(50);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          setDropdownVisible(!dropdownVisible);
        }}
      >
        <Image
          style={styles.image}
          source={colorScheme === "dark" ? icons.moon : icons.sun}
          height={20}
          width={20}
        />
      </TouchableOpacity>
      {dropdownVisible && (
        <View ref={dropdownRef} style={styles.dropdown}>
          {modes.map((mode) => (
            <TouchableOpacity
              key={mode.value}
              style={[
                styles.option,
                {
                  backgroundColor:
                    theme == mode.value ? Colors[colorScheme].tint : "",
                },
              ]}
              onPress={() => handleSelection(mode.value)}
            >
              <Image
                source={mode.icon}
                height={20}
                width={20}
                style={styles.image}
              />
              <StyledText fontSize={18} fontWeight="bold">
                {mode.label}
              </StyledText>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );
};

export default ThemeSwitch;
