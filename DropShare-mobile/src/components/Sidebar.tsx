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
import LinearGradient from "react-native-linear-gradient";
import { Colors } from "../constants/Colors";
import StyledText from "./ui/StyledText";

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
        style={[
          styles.sidebar,
          { width: "80%", transform: [{ translateX: slideAnim }] },
        ]}
      >
        <LinearGradient
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          colors={Colors[colorScheme].linearGradientColors}
          style={[
            styles.sidebar,
            { width: "100%", paddingBottom: 15, paddingTop: 7 },
          ]}
        >
          <View style={styles.logo}>
            <Icon source={images.logo} height={35} width={35} filter={0} />
            <StyledText fontWeight="bold" fontSize={24}>
              DropShare
            </StyledText>
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
                <StyledText fontSize={18} fontWeight="bold">
                  {options.title}
                </StyledText>
              </Pressable>
            ))}
          </View>
          <View style={styles.footer}>
            <Pressable style={styles.footerButton}>
              <StyledText fontSize={22} fontWeight="bold">
                About Us
              </StyledText>
            </Pressable>
            <View style={styles.dot} />
            <Pressable style={styles.footerButton}>
              <StyledText fontSize={22} fontWeight="bold">
                Privacy policy
              </StyledText>
            </Pressable>
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
};

export default Sidebar;
