import React, { useState } from "react";
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
import { Colors } from "../constants/Colors";
import { navigate } from "../utils/NavigationUtil";
import useCurrentPath from "../hooks/useCurrentPath";
import { searchFiles } from "../db/dropshareDb";
import RNFS from "react-native-fs";

const SearchComponent = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredFiles, setFilteredFiles] = useState<any[]>([]);

  const handleSearch = async (text: string) => {
    setSearchQuery(text);

    if (!text.trim()) {
      setFilteredFiles([]);
      return;
    }

    // Query the database using AI-powered search
    searchFiles(text, (results) => {
      setFilteredFiles(results);
    });
  };

  const { colorScheme } = useTheme();
  const styles = filesStyle(colorScheme);
  const { setCurrentPath } = useCurrentPath(RNFS.ExternalStorageDirectoryPath);

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
                <Text style={{ color: "#bbb" }}>{item.path}</Text>
                {item.tags && (
                  <Text style={{ color: "#8e44ad", fontSize: 12 }}>
                    📌 Tags: {item.tags}
                  </Text>
                )}
                {item.content_summary && (
                  <Text style={{ color: "#2c3e50", fontSize: 12 }}>
                    📝 {item.content_summary.slice(0, 100)}...
                  </Text>
                )}
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
