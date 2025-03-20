import React, { useState } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import Icon from "./Icon";
import { icons, images } from "../assets";
import ThemeSwitch from "./ThemeSwitch";
import { headerStyles } from "../constants/Styles";
import { useTheme } from "../hooks/ThemeProvider";
import { optionsList } from "../constants/optionsList";
import useSelectFile from "../hooks/useSelectFile";

interface headerProps {
  onPress?: () => void;
  page: string;
  menu?: boolean;
  filePath?: string;
}

const Header = ({
  onPress,
  page = "home",
  menu,
  filePath = "",
}: headerProps) => {
  const [showOptions, setShowOptions] = useState(false);
  const { colorScheme } = useTheme();
  const styles = headerStyles(colorScheme);
  const { selectedFiles } = useSelectFile();

  const options = optionsList({ filePath, selectedFiles });

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.iconContainer} onPress={onPress}>
        <Icon
          source={page === "home" ? icons.menu : icons.back}
          height={20}
          width={20}
          filter={1}
        />
      </TouchableOpacity>
      <View style={styles.logo}>
        {page === "home" && (
          <Image
            source={images.logo}
            height={50}
            width={50}
            style={styles.image}
          />
        )}
        <Text style={styles.text}>{page === "home" ? "DropShare" : page}</Text>
        {page === "Settings" && <ThemeSwitch />}
      </View>
      <TouchableOpacity
        style={[
          styles.iconContainer,
          { position: "relative", opacity: menu ? 1 : 0 },
        ]}
        onPress={() => setShowOptions(!showOptions)}
      >
        <Icon source={icons.options} height={20} width={20} filter={1} />
      </TouchableOpacity>
      <View
        style={[
          styles.optionsContainer,
          { top: showOptions ? 50 : -1000, zIndex: 50 },
        ]}
      >
        {options.map((option) => (
          <TouchableOpacity
            key={option.title}
            style={styles.options}
            onPress={() => option.function()}
          >
            <Text style={styles.text}>{option.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

export default Header;
