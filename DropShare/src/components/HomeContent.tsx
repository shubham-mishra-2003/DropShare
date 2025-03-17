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
import LinearGradient from "react-native-linear-gradient";
import DropshareConnect from "./Sharing/DropshareConnect";

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
      console.log("Fetching data on screen focus...");
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
    <View style={styles.mainView} key={Number(refresh)}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 10, gap: 15 }}
      >
        <Text style={styles.heading}>Files</Text>
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
          <Text style={styles.input}>Search files or folders</Text>
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
          <Text style={styles.cardText}>Device storage</Text>
          <View style={styles.storageInfo}>
            <Text style={styles.remainingStorage}>
              {storage.used} GB |{" "}
              <Text style={styles.totalStorage}>{storage.total} GB</Text>
            </Text>
            <View style={styles.Bar}>
              <View
                style={{
                  width: storage.usedPercentage,
                  height: "100%",
                  borderRadius: 50,
                  backgroundColor: Colors[colorScheme].tint,
                }}
              />
              <Text
                style={{
                  color: "#fff",
                  position: "absolute",
                  right: 20,
                  top: 3,
                  fontSize: 20,
                }}
              >
                Free: {storage.free.toFixed(2)} GB
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigate("received")}
          style={{
            backgroundColor: Colors[colorScheme].itemBackground,
            padding: 20,
            borderRadius: 20,
          }}
        >
          <Text
            style={{
              color: Colors[colorScheme].text,
              fontSize: 20,
              textAlign: "center",
            }}
          >
            Received
          </Text>
        </TouchableOpacity>
        <View style={styles.categoriesContainer}>
          {categories.map((item) => (
            <TouchableOpacity
              key={item.name}
              style={styles.categoryCard}
              onPress={() => navigate("fileslist", { category: item.name })}
            >
              <Text style={styles.categoryText}>{item.name}</Text>
              <Icon source={item.icon} height={20} width={20} filter={1} />
              <Text style={styles.categoryText}>{fileCounts[item.name]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <DropshareConnect />
    </View>
  );
};

export default HomeContent;
