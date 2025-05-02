import React from "react";
import { StyleSheet, View } from "react-native";
import Header from "../components/ui/Header";
import { useTheme } from "../hooks/ThemeProvider";
import { Colors } from "../constants/Colors";
import { SafeAreaView } from "react-native-safe-area-context";
import HomeContent from "../components/HomeContent";

interface homeProps {
  toggleSidebar: () => void;
}

const Home = ({ toggleSidebar }: homeProps) => {
  const { colorScheme } = useTheme();
  const styles = StyleSheet.create({
    mainView: {
      flex: 1,
      backgroundColor: Colors[colorScheme].background,
    },
  });

  return (
    <View style={styles.mainView}>
      <Header page="home" onPress={toggleSidebar} />
      <HomeContent />
    </View>
  );
};

export default Home;
