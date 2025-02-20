import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import Header from '../components/Header';
import { useTheme } from '../hooks/ThemeProvider';
import HomeScreen from '../components/Files';
import { Colors } from '../constants/Colors';

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
    <SafeAreaView style={styles.mainView}>
      <Header page="home" onPress={toggleSidebar} />
      <HomeScreen />
    </SafeAreaView>
  );
};

export default Home;