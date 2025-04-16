// ClientScreen.tsx
import React, { FC, useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { screenWidth } from "../utils/Constants";
import { Colors } from "../constants/Colors";
import { useTheme } from "../hooks/ThemeProvider";
import { icons, images } from "../assets";
import Icon from "../components/Icon";
import BreakerText from "../components/ui/BreakerText";
import LottieView from "lottie-react-native";
import { goBack, navigate } from "../utils/NavigationUtil";
import QRScanner from "../components/Sharing/QrScanner";
import { useNetwork } from "../service/NetworkProvider";
import { ClientScreenStyles } from "../constants/Styles";
import StyledText from "../components/ui/StyledText";
import LinearGradient from "react-native-linear-gradient";

const ClientScreen: FC = () => {
  const [isScanner, setIsScanner] = useState(false);
  const { colorScheme } = useTheme();
  const styles = ClientScreenStyles(colorScheme);
  const {
    devices,
    isConnected,
    startClient,
    connectToHostIp,
    messages,
    receivedFiles,
  } = useNetwork();

  const [nearbyDevices, setNearbyDevices] = useState<any[]>([]);

  useEffect(() => {
    startClient();
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

  const handleConnect = (ip: string) => {
    connectToHostIp(ip);
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
        scale: new Animated.Value(0),
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

  // useEffect(() => {
  //   if (isConnected) {
  //     navigate("clientConnection", { messages, receivedFiles });
  //   }
  // }, [isConnected]);

  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      colors={Colors[colorScheme].linearGradientColors}
      style={styles.container}
    >
      <ScrollView style={{ flex: 1, width: "100%" }}>
        <TouchableOpacity onPress={() => goBack()} style={styles.backButton}>
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
                  // style={[
                  //   styles.deviceDot,
                  //   {
                  //     transform: [{ scale: device.scale }],
                  //     left: screenWidth / 2.33 + device.position.x,
                  //     top: screenWidth / 2.2 + device.position.y,
                  //   },
                  // ]}
                  key={device.id}
                >
                  <TouchableOpacity
                    onPress={() => handleConnect(device.ip)}
                    style={styles.popup}
                  >
                    <Image source={device.image} style={styles.deviceImage} />
                    <Text style={styles.deviceText}>{device.ip}</Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
              {nearbyDevices.map((device) => (
                <TouchableOpacity
                  key={device.ip}
                  onPress={() => connectToHostIp(device.ip)}
                >
                  <StyledText text={device.ip} fontWeight="bold" />
                </TouchableOpacity>
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
