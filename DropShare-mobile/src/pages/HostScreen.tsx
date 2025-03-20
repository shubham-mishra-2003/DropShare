import {
  View,
  Text,
  StyleSheet,
  Image,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import React, { FC, useEffect, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { screenWidth } from "../utils/Constants";
import { Colors } from "../constants/Colors";
import { useTheme } from "../hooks/ThemeProvider";
import { icons, images } from "../assets";
import Icon from "../components/Icon";
import BreakerText from "../components/ui/BreakerText";
import LottieView from "lottie-react-native";
import QRGenerator from "../components/Sharing/QrGenerator";
import { goBack, navigate } from "../utils/NavigationUtil";
import { useTCP } from "../service/TCPProvider";
import useUsername from "../hooks/useUsername";
import {
  getBroadcastIPAddress,
  getLocalIPAddress,
} from "../utils/networkUtils";
import { Toast } from "../components/Toasts";
import dgram from "react-native-udp";

const HostScreen: FC = () => {
  const [qrValue, setQrValue] = useState("Shubham");
  const [isScanner, setIsScanner] = useState(false);
  const { colorScheme } = useTheme();
  const styles = HostStyles(colorScheme);
  const { startServer, server, isConnected } = useTCP();
  const intervalRef = useRef<number | null>(null);

  const { username } = useUsername();
  const deviceName = username;

  const startupServer = async () => {
    const ip = await getLocalIPAddress();
    const port = 4000;

    if (!server) {
      startServer(port);
    }
    setQrValue(`dropshare://${ip}:${port}|${deviceName}`);
    console.log(`Server started: ${ip}:${port}`);
  };

  const sendDiscoverySignal = async () => {
    const broadCastAddress = await getBroadcastIPAddress();
    const targetAddress = broadCastAddress || "255.255.255.255";
    const port = 57143;

    const client = dgram.createSocket({ type: "udp4", reusePort: true });

    client.bind(() => {
      try {
        if (Platform.OS == "ios") {
          client.setBroadcast(true);
        }
        client.send(
          `${qrValue}`,
          0,
          `${qrValue}`.length,
          port,
          targetAddress,
          (err) => {
            if (err) {
              console.log(`Error sending discovery signal ${err}`);
            } else {
              Toast(`${deviceName}: Discovery signal sent to ${targetAddress}`);
            }
            client.close();
          }
        );
      } catch (error) {
        Toast(`Failed to set broadcast or send ${error}`);
        client.close();
      }
    });
  };

  useEffect(() => {
    if (!qrValue) return;

    sendDiscoverySignal();
    intervalRef.current = setInterval(sendDiscoverySignal, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [qrValue]);

  const handleBack = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    goBack();
  };

  useEffect(() => {
    startupServer();
  }, []);

  useEffect(() => {
    if (isConnected) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      navigate("connection");
    }
  }, [isConnected]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={{ flex: 1, width: "100%" }}>
        <TouchableOpacity
          onPress={() => handleBack()}
          style={styles.backButton}
        >
          <Icon source={icons.back} height={20} width={20} filter={1} />
        </TouchableOpacity>
        <View style={styles.mainContainer}>
          <View style={styles.infoContainer}>
            <Icon source={images.logo} height={70} width={70} filter={0} />
            <Text
              style={{
                color: Colors[colorScheme].text,
                fontSize: 20,
                textAlign: "center",
                fontWeight: "bold",
              }}
            >
              Searching for nearby devices
            </Text>
            <Text
              style={{
                color: Colors[colorScheme].text,
                fontSize: 20,
                textAlign: "center",
                opacity: 0.6,
              }}
            >
              Ensure your device is connected to the host's hotspot network
            </Text>
          </View>
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
          <BreakerText text="or" />
          <TouchableOpacity
            style={styles.qrButton}
            onPress={() => setIsScanner(!isScanner)}
          >
            <Icon height={30} width={30} source={icons.QR} filter={1} />
            <Text style={{ fontSize: 20, color: Colors[colorScheme].text }}>
              Show QR
            </Text>
          </TouchableOpacity>
        </View>
        <QRGenerator
          setVisible={() => setIsScanner(false)}
          visible={isScanner}
        />
        <StatusBar
          backgroundColor={Colors[colorScheme].background}
          barStyle={"default"}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

export default HostScreen;

const HostStyles = (colorScheme: "dark" | "light") =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors[colorScheme].background,
      padding: 10,
    },
    mainContainer: {
      flex: 1,
      alignItems: "center",
      gap: 20,
    },
    deviceDot: {
      position: "absolute",
      justifyContent: "center",
      alignItems: "center",
    },
    popup: {
      justifyContent: "center",
      alignItems: "center",
      maxWidth: 120,
    },
    deviceImage: {
      width: 35,
      height: 35,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: "#fff",
    },
    deviceText: {
      textAlign: "center",
      paddingVertical: 2,
      paddingHorizontal: 5,
      borderRadius: 10,
      maxWidth: 140,
    },
    radarContainer: {
      position: "absolute",
      width: screenWidth,
      height: screenWidth,
      justifyContent: "center",
      alignItems: "center",
    },
    backButton: {
      position: "absolute",
      padding: 10,
    },
    infoContainer: {
      marginTop: 40,
      justifyContent: "center",
      alignItems: "center",
      gap: 10,
    },
    lottieContainer: {
      position: "absolute",
      zIndex: 4,
      width: "100%",
      height: "100%",
      alignSelf: "center",
    },
    lottie: {
      width: "100%",
      height: "100%",
    },
    animationContainer: {
      width: "100%",
      justifyContent: "center",
      alignItems: "center",
      height: screenWidth,
    },
    profileImage: {
      height: 50,
      width: 50,
      resizeMode: "cover",
      borderRadius: 100,
      zIndex: 5,
      marginTop: 5,
    },
    qrButton: {
      backgroundColor: Colors[colorScheme].tint,
      padding: 15,
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
      borderRadius: 40,
      width: 200,
      boxShadow: `0px 0px 20px ${Colors[colorScheme].tint}`,
    },
  });
