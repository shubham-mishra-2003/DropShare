import React, { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { navigate } from "../utils/NavigationUtil";
import { filesStyle } from "../constants/Styles";
import { useTheme } from "../hooks/ThemeProvider";
import { Colors } from "../constants/Colors";
import { icons } from "../assets";
import Icon from "./Icon";
import { getStorageInfo, getFileCounts } from "../utils/FileSystemUtil";
import SearchComponent from "./SearchInput";
import DropShareModal from "./ui/Modal";
import DropshareConnect from "./Sharing/DropshareConnect";
import LinearGradient from "react-native-linear-gradient";
import StyledText from "./ui/StyledText";

interface FileCounts {
  [key: string]: number;
}

interface Category {
  name: string;
  icon: any;
  color: string;
}

const HomeContent: React.FC = () => {
  const { colorScheme } = useTheme();
  const styles = filesStyle(colorScheme);
  const [refresh, setRefresh] = useState(false);
  const [fileCounts, setFileCounts] = useState<FileCounts>({});

  const [storage, setStorage] = useState({
    used: 0,
    total: 1,
    usedPercentage: 0,
    free: 1,
  });

  const fetchData = async () => {
    try {
      const storageInfo = await getStorageInfo();
      const fileCounts = await getFileCounts();
      let storagePercentage =
        storageInfo.total > 0
          ? (storageInfo.used / storageInfo.total) * 100
          : 0;

      let freeSpace = storageInfo.total - storageInfo.used;

      setStorage({
        used: storageInfo.used,
        total: storageInfo.total,
        usedPercentage: storagePercentage,
        free: freeSpace,
      });
      setFileCounts(fileCounts);
      setRefresh((prev) => !prev);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const categories: Category[] = [
    { name: "Photos", icon: icons.photo, color: "#4A90E2" },
    { name: "Videos", icon: icons.video, color: "#8B5CF6" },
    { name: "Audio", icon: icons.audio, color: "#E67E22" },
    { name: "Documents", icon: icons.document, color: "#3498DB" },
    { name: "APKs", icon: icons.app, color: "#27AE60" },
    { name: "Archives", icon: icons.archive, color: "#8D6E63" },
  ];

  const [search, setSearch] = useState(false);

  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      colors={Colors[colorScheme].linearGradientColors}
      style={styles.mainView}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 15 }}
      >
        <TouchableOpacity onPress={() => navigate("testhost")}>
          <StyledText fontSize={20} fontWeight="bold">
            Test Host
          </StyledText>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigate("testclient")}>
          <StyledText fontSize={20} fontWeight="bold">
            Test client
          </StyledText>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigate("hostConnection")}>
          <StyledText fontSize={25}>Host connection</StyledText>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigate("clientConnection")}>
          <StyledText fontSize={25}>Client connection</StyledText>
        </TouchableOpacity>
        <StyledText text="Files" fontWeight="bold" fontSize={55} />
        <TouchableOpacity
          onPress={() => setSearch(true)}
          style={{
            backgroundColor: Colors[colorScheme].transparent,
            borderRadius: 20,
            padding: 15,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Icon source={icons.search} height={20} width={20} filter={0.7} />
          <StyledText
            fontWeight="bold"
            style={styles.input}
            text="Search files or folders"
          />
        </TouchableOpacity>
        <DropShareModal
          visible={search}
          onRequestClose={() => setSearch(false)}
        >
          <SearchComponent />
        </DropShareModal>
        <TouchableOpacity
          onPress={() => navigate("storage")}
          style={styles.card}
        >
          <StyledText fontSize={25} text="Device Storage" fontWeight="bold" />
          <View style={styles.storageInfo}>
            <StyledText fontWeight="bold" fontSize={22}>
              {storage.used} GB |{" "}
              <StyledText fontWeight="bold" fontSize={26}>
                {storage.total} GB
              </StyledText>
            </StyledText>
            <View style={styles.Bar}>
              <View
                style={{
                  width: storage.usedPercentage * 3,
                  height: "100%",
                  borderRadius: 50,
                  backgroundColor: Colors[colorScheme].tint,
                }}
              />
            </View>
            <StyledText
              fontWeight="bold"
              fontSize={22}
              style={{ color: Colors[colorScheme].text }}
            >
              Free : {storage.free.toFixed(2)} GB
            </StyledText>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigate("received")}
          style={{
            backgroundColor: Colors[colorScheme].transparent,
            padding: 20,
            borderRadius: 20,
          }}
        >
          <StyledText
            fontWeight="bold"
            style={{ textAlign: "center" }}
            fontSize={24}
          >
            Received
          </StyledText>
        </TouchableOpacity>
        <View style={styles.categoriesContainer}>
          {categories.map((item) => (
            <TouchableOpacity
              key={item.name}
              style={styles.categoryCard}
              onPress={() =>
                navigate("fileslist", {
                  params: { category: item.name },
                })
              }
            >
              <StyledText text={item.name} fontWeight="bold" />
              <Icon source={item.icon} height={20} width={20} filter={1} />
              <StyledText fontWeight="bold">{fileCounts[item.name]}</StyledText>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <DropshareConnect />
    </LinearGradient>
  );
};

export default HomeContent;
