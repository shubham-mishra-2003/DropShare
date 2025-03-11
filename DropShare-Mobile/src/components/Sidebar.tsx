import React from "react";
import {
  Animated,
  Text,
  View,
  TouchableWithoutFeedback,
  Pressable,
} from "react-native";
import { sidebarStyles } from "../constants/Styles";
import { useTheme } from "../hooks/ThemeProvider";
import Icon from "./Icon";
import { icons, images } from "../assets";
import { navigate } from "../utils/NavigationUtil";

interface sidebarProps {
  slideAnim: Animated.Value;
  toggleSidebar: () => void;
}

const Sidebar = ({ slideAnim, toggleSidebar }: sidebarProps) => {
  const { colorScheme } = useTheme();
  const styles = sidebarStyles(colorScheme);
  const sidebarOptions = [
    { title: "Bin", icon: icons.bin, function: "bin" },
    { title: "Settings", icon: icons.setting, function: "setting" },
    { title: "Help and feedback", icon: icons.help, function: "help" },
  ];

  return (
    <View style={styles.view}>
      <TouchableWithoutFeedback onPress={toggleSidebar}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>
      <Animated.View
        style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}
      >
        <View style={styles.logo}>
          <Icon source={images.logo} height={35} width={35} filter={0} />
          <Text style={styles.logoText}>DropShare</Text>
        </View>
        <View style={styles.optionsContainer}>
          {sidebarOptions.map((options, index) => (
            <Pressable
              onPress={() => {
                navigate(options.function);
                toggleSidebar();
              }}
              key={index}
              style={styles.options}
            >
              <Icon source={options.icon} height={20} width={20} filter={1} />
              <Text style={styles.optionsText}>{options.title}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.footer}>
          <Pressable style={styles.footerButton}>
            <Text style={styles.footerText}>About Us</Text>
          </Pressable>
          <View style={styles.dot} />
          <Pressable style={styles.footerButton}>
            <Text style={styles.footerText}>Privacy policy</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
};

export default Sidebar;
