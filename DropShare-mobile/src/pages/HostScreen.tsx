import {
  View,
  Text,
  StyleSheet,
  Image,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  FlatList,
  BackHandler,
} from "react-native";
import React, { FC, useEffect, useState } from "react";
import { screenWidth } from "../utils/Constants";
import { Colors } from "../constants/Colors";
import { useTheme } from "../hooks/ThemeProvider";
import { icons, images } from "../assets";
import Icon from "../components/Icon";
import BreakerText from "../components/ui/BreakerText";
import LottieView from "lottie-react-native";
import QRGenerator from "../components/Sharing/QrGenerator";
import { goBack, navigate, resetAndNavigate } from "../utils/NavigationUtil";
import { useNetwork } from "../service/NetworkProvider";
import LinearGradient from "react-native-linear-gradient";
import StyledText from "../components/ui/StyledText";
import { ShareScreenStyles } from "../constants/Styles";

const HostScreen: FC = () => {
  const [isScanner, setIsScanner] = useState(false);
  const { colorScheme } = useTheme();
  const styles = ShareScreenStyles(colorScheme);
  const { startHosting, devices, stopHosting, kickClient, isHostConnected } =
    useNetwork();

  const backAction = () => {
    stopHosting();
    resetAndNavigate("home");
    return true;
  };

  useEffect(() => {
    startHosting();
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    if (isHostConnected) {
      navigate("connectionscreen");
    }
  }, [isHostConnected]);

  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      colors={Colors[colorScheme].linearGradientColors}
      style={styles.container}
    >
      <ScrollView style={{ flex: 1, width: "100%" }}>
        <TouchableOpacity onPress={backAction} style={styles.backButton}>
          <Icon source={icons.back} height={20} width={20} filter={1} />
        </TouchableOpacity>
        <View style={styles.mainContainer}>
          <View style={styles.infoContainer}>
            <Icon source={images.logo} height={70} width={70} filter={0} />
            <StyledText
              fontSize={26}
              fontWeight="bold"
              style={{
                color: Colors[colorScheme].text,
                textAlign: "center",
              }}
              text="Searching for nearby devices"
            />
            <StyledText
              fontSize={24}
              fontWeight="bold"
              style={{
                color: Colors[colorScheme].text,
                textAlign: "center",
              }}
              text="Ensure the devices are connected to your hotspot network or same wifi"
            />
          </View>

          {isHostConnected && devices.length > 0 ? (
            <ScrollView
              contentContainerStyle={{
                gap: 10,
                height: screenWidth - 40,
                width: screenWidth - 40,
              }}
            >
              <StyledText
                text="Connected devices"
                fontSize={20}
                fontWeight="medium"
              />
              {devices.map((device) => (
                <View
                  key={device.ip}
                  style={{
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexDirection: "row",
                    padding: 15,
                    backgroundColor: Colors[colorScheme].transparent,
                    borderRadius: 20,
                  }}
                >
                  <StyledText fontWeight="regular">
                    {device.name} <StyledText text={device.ip} />
                  </StyledText>
                  <TouchableOpacity onPress={() => kickClient(device.ip)}>
                    <Icon
                      source={icons.cross}
                      filter={1}
                      height={20}
                      width={20}
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.animationContainer}>
              <View style={styles.lottieContainer}>
                <LottieView
                  style={styles.lottie}
                  source={require("../assets/animations/scan.json")}
                  autoPlay
                  loop={true}
                  hardwareAccelerationAndroid
                />
              </View>
              <Image source={images.logo} style={styles.profileImage} />
            </View>
          )}
          <BreakerText text="or" />
          <TouchableOpacity
            style={styles.qrButton}
            onPress={() =>
              devices.length > 0
                ? navigate("connection")
                : setIsScanner(!isScanner)
            }
          >
            <Icon height={30} width={30} source={icons.QR} filter={1} />
            <StyledText
              text={devices.length > 0 ? "Connect" : "Show QR"}
              fontSize={24}
              fontWeight="bold"
            />
          </TouchableOpacity>
        </View>
        <QRGenerator
          setVisible={() => setIsScanner(false)}
          visible={isScanner}
        />
        {/* <StatusBar
          backgroundColor={Colors[colorScheme].background}
          barStyle={"default"}
        /> */}
      </ScrollView>
    </LinearGradient>
  );
};

export default HostScreen;
