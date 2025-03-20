import {
  View,
  Text,
  StyleSheet,
  Image,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
} from "react-native";
import React, { FC, useEffect, useState } from "react";
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
import { useTCP } from "../service/TCPProvider";
import dgram from "react-native-udp";
import useUsername from "../hooks/useUsername";
import { connectAndSendFile, discoverServer } from "../service/client-side";

const ClientScreen: FC = () => {
  const [isScanner, setIsScanner] = useState(false);
  const { colorScheme } = useTheme();
  const styles = sendStyles(colorScheme);
  const [nearbyDevices, setNearbyDevices] = useState<any>([]);
  const { connectToServer, isConnected } = useTCP();

  const { username } = useUsername();

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
        const dy = pos.y = position.y;
        return Math.sqrt(dx * dx + dy * dy) < minDistance;
      });
    } while (isOverlapping);

    return position;
  };

  const handleScan = (data: any) => {
    const [connectionData, deviceName = username] = data
      .replace("dropshare://", "")
      .split("|");
    const [host, port] = connectionData.split(":");
    connectToServer(host, parseInt(port, 10), deviceName);
  };

  const listenForDevices = async () => {
    const server = dgram.createSocket({ type: "udp4", reusePort: true });
    const port = 57143; //change karna hai
    server.bind(port, () => {
      console.log("Listening for nearby devices...");
    });

    server.on("message", (msg, rinfo) => {
      const [connectionData, otherDevice] = msg
        ?.toString()
        ?.replace("tcp://", "")
        ?.split("|");

      setNearbyDevices((prevDevices: any) => {
        const deviceExists = prevDevices?.some(
          (devices: any) => devices?.name === otherDevice
        );
        if (!deviceExists) {
          const newDevice = {
            id: `${Date.now()}_${Math.random()}`,
            name: otherDevice,
            image: require("../assets/images/dropshareLogo.png"),
            fullAddress: msg?.toString(),
            position: getRandomPosition(
              150,
              prevDevices?.map((d: { position: any }) => d.position),
              50
            ),
            scale: new Animated.Value(0),
          };
          Animated.timing(newDevice.scale, {
            toValue: 1,
            duration: 1500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }).start();

          return [...prevDevices || [], newDevice];
        }
        return prevDevices;
      });
    });
  };

  // useEffect(() => {
  //   if (isConnected) {
  //     navigate("connection");
  //   }
  // }, [isConnected]);

  // useEffect(() => {
  //   let udpServer: any;
  //   const setUpServer = async () => {
  //     udpServer = await listenForDevices();
  //   };
  //   setUpServer();

  //   return () => {
  //     if (udpServer) {
  //       udpServer.close(() => {
  //         console.log("UDP server closed");
  //       });
  //     }
  //     setNearbyDevices([]);
  //   };
  // }, []);

  useEffect(() => {
    discoverServer()
      .then((serverIP) => {
        console.log('Discovered Server IP:', serverIP);
        return connectAndSendFile('/path/to/image.jpg');
      })
      .then(() => {
        console.log('File transfer complete!');
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  })

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={{ flex: 1, width: "100%" }}>
        <TouchableOpacity onPress={() => goBack()} style={styles.backButton}>
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
                source={require("../assets/animations/scanner.json")}
                autoPlay
                loop={true}
                hardwareAccelerationAndroid
              />
              {nearbyDevices?.map((device: any) => (
                <Animated.View
                  style={[
                    styles.deviceDot,
                    {
                      transform: [{ scale: device.scale }],
                      left: screenWidth / 2.33 + device.position?.x,
                      top: screenWidth / 2.2 + device.position?.y,
                    },
                  ]}
                  key={device?.id}
                >
                  <TouchableOpacity
                    onPress={() => handleScan(device?.fullAddress)}
                    style={styles.popup}
                  >
                    <Image source={device.image} style={styles.deviceImage} />
                    <Text style={styles.deviceText}>{device.name}</Text>
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
        <StatusBar
          backgroundColor={Colors[colorScheme].background}
          barStyle={"default"}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

export default ClientScreen;

const sendStyles = (colorScheme: "dark" | "light") =>
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
      color: Colors[colorScheme].text,
      fontSize: 8,
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
