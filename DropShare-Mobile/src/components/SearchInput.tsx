import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from "react-native";
import { useTheme } from "../hooks/ThemeProvider";
import { filesStyle } from "../constants/Styles";
import Icon from "./Icon";
import { icons } from "../assets";
import { getFilesFromDatabase } from "../db/dropshareDb";
import RNFS from "react-native-fs";
import { Colors } from "../constants/Colors";
import { navigate } from "../utils/NavigationUtil";
import useCurrentPath from "../hooks/useCurrentPath";

const SearchComponent = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredFiles, setFilteredFiles] = useState<RNFS.ReadDirItem[]>([]);
  const [allFiles, setAllFiles] = useState<RNFS.ReadDirItem[]>([]);

  useEffect(() => {
    getFilesFromDatabase((files) => {
      setAllFiles(files);
    });
  }, []);

  const handleSearch = (text: string) => {
    setSearchQuery(text);

    if (!text.trim()) {
      setFilteredFiles([]);
      return;
    }

    const filtered = allFiles.filter((file) =>
      file.name.toLowerCase().includes(text.toLowerCase())
    );

    setFilteredFiles(filtered);
  };

  const { colorScheme } = useTheme();
  const styles = filesStyle(colorScheme);
  const { setCurrentPath } = useCurrentPath();
  const handleDirectoryRouting = (path: string) => {
    setCurrentPath(path);
    navigate("storage");
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: Colors[colorScheme].background,
        padding: 10,
      }}
    >
      <StatusBar
        backgroundColor={Colors[colorScheme].background}
        barStyle="default"
      />
      <View style={styles.inputView}>
        <Icon source={icons.search} height={20} width={20} filter={0.7} />
        <TextInput
          placeholder="Search files or folders"
          placeholderTextColor="#bbb"
          style={styles.input}
          value={searchQuery}
          onChangeText={handleSearch}
          autoFocus={true}
          keyboardAppearance="light"
        />
      </View>
      {searchQuery.trim() && (
        <ScrollView
          contentContainerStyle={{ padding: 10, gap: 10, flex: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {filteredFiles.length > 0 ? (
            filteredFiles.map((item) => (
              <TouchableOpacity
                key={item.path}
                onPress={() =>
                  item.isDirectory == 1
                    ? handleDirectoryRouting(item.path)
                    : navigate("fileviewer", { item })
                }
                style={{
                  backgroundColor: Colors[colorScheme].itemBackground,
                  padding: 10,
                  borderRadius: 20,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "bold",
                    color: Colors[colorScheme].text,
                  }}
                >
                  {item.name}
                </Text>
                <Text style={{ color: "#bbb" }}>
                  {item.isFile == 1 ? "File" : "Directory"}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={{ textAlign: "center", padding: 10, color: "#666" }}>
              No files found matching "{searchQuery}"
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default SearchComponent;
