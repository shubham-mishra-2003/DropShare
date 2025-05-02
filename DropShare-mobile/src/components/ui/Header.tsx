import React, { useState } from "react";
import { FlatList, Image, Text, TouchableOpacity, View } from "react-native";
import Icon from "../Icon";
import { icons, images } from "../../assets";
import ThemeSwitch from "../ThemeSwitch";
import { headerStyles } from "../../constants/Styles";
import { useTheme } from "../../hooks/ThemeProvider";
import { fileOperations } from "../../utils/FileSystemUtil";
import StyledText from "./StyledText";

interface HeaderProps {
  onPress?: () => void;
  page?: string;
  menu?: boolean;
  filePath?: string;
}

const Header: React.FC<HeaderProps> = ({
  onPress,
  page = "home",
  menu = false,
}) => {
  const [showOptions, setShowOptions] = useState(false);
  const { colorScheme } = useTheme();
  const styles = headerStyles(colorScheme);
  const { handleCopy, handleDelete, handleInfo, handleMove, handleMoveToSafe } =
    fileOperations();

  const options = [
    { title: "Copy", action: handleCopy },
    { title: "Move", action: handleMove },
    { title: "Delete", action: handleDelete },
    { title: "Move to Safe", action: handleMoveToSafe },
    { title: "Info", action: handleInfo },
  ];

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.iconContainer} onPress={onPress}>
        <Icon
          source={page === "home" ? icons.menu : icons.back}
          height={20}
          width={22}
          filter={1}
        />
      </TouchableOpacity>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          flex: 1,
          overflow: "hidden",
          gap: 5,
        }}
      >
        {page === "home" ? (
          <View style={styles.logo}>
            <Image
              source={images.logo}
              style={styles.image}
              resizeMode="contain"
            />
            <StyledText fontWeight="bold" text="DropShare" fontSize={25} />
          </View>
        ) : (
          <StyledText fontWeight="bold" text={page} fontSize={16} />
        )}
      </View>
      <View style={{ display: menu ? "flex" : "none", position: "relative" }}>
        <TouchableOpacity
          style={{ padding: 10 }}
          onPress={() => setShowOptions(!showOptions)}
        >
          <Icon source={icons.options} height={20} width={20} filter={1} />
        </TouchableOpacity>
        {showOptions && (
          <View
            style={{
              position: "absolute",
              top: 40,
              right: 0,
              backgroundColor: colorScheme === "dark" ? "#333" : "#fff",
              borderRadius: 8,
              elevation: 4,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              zIndex: 1000,
              width: 150,
            }}
          >
            <FlatList
              data={options}
              keyExtractor={(item) => item.title}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{
                    padding: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: colorScheme === "dark" ? "#444" : "#ddd",
                  }}
                  onPress={() => item.action}
                >
                  <StyledText
                    style={{
                      color: colorScheme === "dark" ? "#fff" : "#000",
                      fontSize: 16,
                    }}
                    text={item.title}
                  />
                </TouchableOpacity>
              )}
            />
          </View>
        )}
        {page === "Settings" && <ThemeSwitch />}
      </View>
    </View>
  );
};

export default Header;
