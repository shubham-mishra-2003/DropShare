// ClientScreen.tsx
import React, { FC, useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Image,
  BackHandler,
} from "react-native";
import { Colors } from "../constants/Colors";
import { useTheme } from "../hooks/ThemeProvider";
import { icons, images } from "../assets";
import Icon from "../components/Icon";
import BreakerText from "../components/ui/BreakerText";
import LottieView from "lottie-react-native";
import { goBack, navigate, resetAndNavigate } from "../utils/NavigationUtil";
import QRScanner from "../components/Sharing/QrScanner";
import { useNetwork } from "../service/NetworkProvider";
import { ClientScreenStyles } from "../constants/Styles";
import StyledText from "../components/ui/StyledText";
import LinearGradient from "react-native-linear-gradient";
import { screenWidth } from "../utils/Constants";

const ClientScreen: FC = () => {
  const [isScanner, setIsScanner] = useState(false);
  const { colorScheme } = useTheme();
  const styles = ClientScreenStyles(colorScheme);
  const {
    devices,
    isClientConnected,
    startClient,
    connectToHostIp,
    messages,
    receivedFiles,
    stopClient,
  } = useNetwork();

  const [nearbyDevices, setNearbyDevices] = useState<any[]>([]);

  const backAction = () => {
    stopClient();
    resetAndNavigate("home");
    return true;
  };

  useEffect(() => {
    startClient();
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );
    return () => backHandler.remove();
  }, []);

  const getRandomPosition = (
    radius: number,
    existingPositions: { x: number; y: number }[] = [],
    minDistance: number
  ) => {
    let position: any;
    let isOverlapping;

    do {
      const angle = Math.random() * 360;
      const distance = Math.random() * (radius - 50) + 50;
      const x = distance * Math.cos((angle + Math.PI) / 180);
      const y = distance * Math.sin((angle + Math.PI) / 180);

      position = { x, y };
      isOverlapping = existingPositions.some((pos) => {
        const dx = pos.x - position.x;
        const dy = pos.y - position.y;
        return Math.sqrt(dx * dx + dy * dy) < minDistance;
      });
    } while (isOverlapping);

    return position;
  };

  useEffect(() => {
    setNearbyDevices(
      devices.map((device) => ({
        id: `${Date.now()}_${Math.random()}`,
        name: device.name,
        ip: device.ip,
        image: require("../assets/images/dropshareLogo.png"),
        position: getRandomPosition(
          150,
          nearbyDevices.map((d) => d.position),
          50
        ),
        scale: new Animated.Value(1),
      }))
    );
    nearbyDevices.forEach((device) => {
      Animated.timing(device.scale, {
        toValue: 1,
        duration: 1500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    });
  }, [devices]);

  useEffect(() => {
    if (isClientConnected) {
      navigate("clientConnection");
    }
  }, [isClientConnected]);

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
              text="Ensure the device is connected to host's hotspot network or same wifi"
            />
          </View>
          <View style={styles.animationContainer}>
            <View style={styles.lottieContainer}>
              <LottieView
                style={styles.lottie}
                source={require("../assets/animations/scanner.json")}
                autoPlay
                loop
                hardwareAccelerationAndroid
              />
              {nearbyDevices.map((device) => (
                <Animated.View
                  style={[
                    styles.deviceDot,
                    {
                      transform: [{ scale: device.scale }],
                      left: screenWidth / 2.5 + device.position.x,
                      top: screenWidth / 2.5 + device.position.y,
                    },
                  ]}
                  key={device.id}
                >
                  <TouchableOpacity
                    onPress={() => connectToHostIp(device.ip)}
                    style={styles.popup}
                  >
                    <Image source={device.image} style={styles.deviceImage} />
                    <StyledText
                      fontSize={12}
                      fontWeight="bold"
                      style={styles.deviceText}
                    >
                      {device.name}
                    </StyledText>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
            <Image source={images.logo} style={styles.profileImage} />
          </View>
          <BreakerText text="or" />
          <TouchableOpacity
            style={styles.qrButton}
            onPress={() => setIsScanner(!isScanner)}
          >
            <Icon height={30} width={30} source={icons.scanQR} filter={1} />
            <Text style={{ fontSize: 20, color: Colors[colorScheme].text }}>
              Scan QR
            </Text>
          </TouchableOpacity>
        </View>
        <QRScanner setVisible={() => setIsScanner(false)} visible={isScanner} />
      </ScrollView>
    </LinearGradient>
  );
};

export default ClientScreen;
