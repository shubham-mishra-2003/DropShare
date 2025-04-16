import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
} from "react-native";
import { useTheme } from "../hooks/ThemeProvider";
import Icon from "./Icon";
import { icons } from "../assets";
import { Colors } from "../constants/Colors";
import { navigate } from "../utils/NavigationUtil";
import useCurrentPath from "../hooks/useCurrentPath";
import { searchFiles } from "../db/dropshareDb";
import RNFS from "react-native-fs";
import BreakerText from "./ui/BreakerText";
import { fileType } from "../utils/FileSystemUtil";
import LinearGradient from "react-native-linear-gradient";
import StyledText from "./ui/StyledText";

const SearchComponent = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredFiles, setFilteredFiles] = useState<any[]>([]);

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setFilteredFiles([]);
      return;
    }
    searchFiles(text, (results) => {
      setFilteredFiles(results);
    });
  };

  const { colorScheme } = useTheme();
  const { setCurrentPath } = useCurrentPath(RNFS.ExternalStorageDirectoryPath);

  const handleDirectoryRouting = (path: string) => {
    setCurrentPath(path);
    navigate("storage");
  };

  const quichSearch = [
    {
      id: 1,
      title: "Image",
      function: () => handleSearch("Image"),
      color: "#4287f5",
    },
    {
      id: 2,
      title: "Video",
      function: () => handleSearch("Video"),
      color: "#ffa759",
    },
    {
      id: 3,
      title: "Audio",
      function: () => handleSearch("Audio"),
      color: "#8969ff",
    },
    {
      id: 4,
      title: "Document",
      function: () => handleSearch("Document"),
      color: "#19e0ff",
    },
  ];

  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      colors={Colors[colorScheme].linearGradientColors}
      style={{
        flex: 1,
        backgroundColor: Colors[colorScheme].background,
      }}
    >
      <View style={{ paddingHorizontal: 10, paddingTop: 10, gap: 10 }}>
        <View
          style={{
            flexDirection: "row",
            backgroundColor: Colors[colorScheme].itemBackground,
            alignItems: "center",
            gap: 5,
            paddingHorizontal: 10,
            borderRadius: 20,
            height: 45,
          }}
        >
          <Icon source={icons.search} height={20} width={20} filter={0.7} />
          <TextInput
            placeholder="Search files or folders"
            placeholderTextColor={colorScheme == "dark" ? "#bbb" : "#666666"}
            style={{
              color: Colors[colorScheme].text,
              fontWeight: "bold",
              flex: 1,
              fontSize: 20,
              textAlignVertical: "bottom",
              height: "100%",
              fontFamily: "WinkySans-BoldItalic",
            }}
            value={searchQuery}
            onChangeText={handleSearch}
            autoFocus={true}
          />
        </View>
        <FlatList
          data={quichSearch}
          contentContainerStyle={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-evenly",
          }}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={item.function}
              style={{
                padding: 5,
                backgroundColor: Colors[colorScheme].transparent,
                borderWidth: 2,
                borderColor: item.color,
                borderRadius: 20,
                width: 80,
                height: 34,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <StyledText
                fontWeight="bold"
                style={{
                  color: item.color,
                }}
                fontSize={14}
              >
                {item.title}
              </StyledText>
            </TouchableOpacity>
          )}
        />
      </View>
      <BreakerText text="search results" />
      {searchQuery.trim() && (
        <FlatList
          data={filteredFiles}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ gap: 7, paddingBottom: 10 }}
          style={{ paddingHorizontal: 10 }}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => {
            let filetype = fileType(item);
            return (
              <TouchableOpacity
                key={item.path}
                onPress={() => navigate("fileviewer", { item })}
                style={{
                  backgroundColor: Colors[colorScheme].transparent,
                  padding: 10,
                  borderRadius: 20,
                  overflow: "hidden",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  height: 75,
                }}
              >
                {filetype == "image" && (
                  <Image
                    source={{ uri: `file://${item.path}` }}
                    height={50}
                    width={50}
                    style={{
                      width: 60,
                      height: 60,
                      resizeMode: "cover",
                      borderRadius: 7,
                    }}
                  />
                )}
                {filetype == "video" && (
                  <Image
                    source={{ uri: `file://${item.path}` }}
                    height={50}
                    width={50}
                    style={{
                      width: 60,
                      height: 60,
                      resizeMode: "cover",
                      borderRadius: 7,
                    }}
                  />
                )}
                {filetype == "audio" && (
                  <Icon
                    source={icons.audio}
                    filter={1}
                    height={35}
                    width={30}
                  />
                )}
                {filetype == "pdf" && (
                  <Icon
                    source={icons.document}
                    filter={1}
                    height={35}
                    width={30}
                  />
                )}
                {filetype == "" && (
                  <Icon
                    source={icons.folder}
                    filter={1}
                    height={45}
                    width={40}
                  />
                )}
                <View>
                  <StyledText
                    fontSize={14}
                    fontWeight="bold"
                    style={{
                      width: 250,
                    }}
                  >
                    {item.name}
                  </StyledText>
                  {item.tags && (
                    <StyledText
                      fontWeight="medium"
                      style={{ color: "#8e44ad", fontSize: 12 }}
                    >
                      📌 Tags: {item.tags}
                    </StyledText>
                  )}
                  {item.content_summary && (
                    <StyledText
                      fontWeight="medium"
                      style={{ color: "#8e44ad", fontSize: 12 }}
                    >
                      📌 {item.content_summary.slice(0, 100)}...
                    </StyledText>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <StyledText
              fontWeight="bold"
              style={{
                textAlign: "center",
                padding: 10,
                color: "#bbb",
                fontSize: 18,
              }}
              text={`No files found matching "${searchQuery}"`}
            />
          }
        />
      )}
    </LinearGradient>
  );
};

export default SearchComponent;
