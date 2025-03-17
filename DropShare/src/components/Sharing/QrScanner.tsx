import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../hooks/ThemeProvider";
import { Colors } from "../../constants/Colors";
import {
  Camera,
  CodeScanner,
  useCameraDevice,
} from "react-native-vision-camera";
import Icon from "../Icon";
import { icons } from "../../assets";
import BottomSheet from "../ui/BottomSheet";
import BreakerText from "../ui/BreakerText";
import { navigate } from "../../utils/NavigationUtil";
import { useTCP } from "../../service/TCPProvider";
import useUsername from "../../hooks/useUsername";

interface QRScannerProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

const QRScanner: React.FC<QRScannerProps> = ({
  visible = false,
  setVisible,
}) => {
  const [codeFound, setCodeFound] = useState(false);
  const { colorScheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const device = useCameraDevice("back");
  const { username } = useUsername();

  const { connectToServer, isConnected } = useTCP();

  useEffect(() => {
    const checkPermission = async () => {
      const camerPermission = await Camera.requestCameraPermission();
      setHasPermission(camerPermission === "granted");
    };
    checkPermission().then(() => setLoading(false));
  }, [visible]);

  const handleScan = (data: any) => {
    const [connectionData, deviceName] = data
      .replace("tcp://", "")
      .split("|");
    const [host, port] = connectionData?.split(":");
    connectToServer(host, parseInt(port, 10), deviceName);
  };

  const codeScanner = useMemo<CodeScanner>(
    () => ({
      codeTypes: ["qr", "codabar"],
      onCodeScanned: (codes) => {
        if (!codeFound) {
          return;
        }
        console.log(`Scanned ${codes?.length} codes!`);
        if (codes?.length > 0) {
          const scannedData = codes[0].value;
          setCodeFound(true);
          handleScan(scannedData);
        }
      },
    }),
    [codeFound]
  );

  useEffect(() => {
    if (isConnected) {
      setVisible(false);
      navigate("connection");
    }
  }, [isConnected]);

  return (
    <BottomSheet
      visible={visible}
      onRequestClose={() => setVisible(false)}
      height={680}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-start",
          alignItems: "center",
          gap: 20,
          width: "100%",
        }}
      >
        {loading ? (
          <ActivityIndicator size={30} color={Colors[colorScheme].tint} />
        ) : !device || !hasPermission ? (
          <View
            style={{ justifyContent: "center", alignItems: "center", gap: 20 }}
          >
            <Icon source={icons.cameraOff} height={80} width={80} filter={1} />
            <Text
              style={{
                fontSize: 20,
                color: Colors[colorScheme].text,
                textAlign: "center",
              }}
            >
              Camera not found or permission not granted
            </Text>
          </View>
        ) : (
          <>
            <Camera
              isActive={true}
              device={device}
              style={{ width: "100%", height: 400 }}
            />
            <Text
              style={{
                color: Colors[colorScheme].text,
                fontSize: 16,
                textAlign: "center",
              }}
            >
              Ensure you are in same wifi network
            </Text>
            <Text
              style={{
                color: Colors[colorScheme].text,
                fontSize: 22,
                textAlign: "center",
              }}
            >
              Ask the device to show their QR to establish connection
            </Text>
          </>
        )}
      </View>
      <View
        style={{
          gap: 10,
          width: "100%",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <BreakerText text="or" />
        <TouchableOpacity
          onPress={() => {
            navigate("sendscreen");
            setVisible(false);
          }}
          style={{
            backgroundColor: Colors[colorScheme].tint,
            padding: 15,
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "row",
            gap: 10,
            borderRadius: 40,
            width: 250,
            boxShadow: `0px 0px 20px ${Colors[colorScheme].tint}`,
          }}
        >
          <Text style={{ fontSize: 20, color: Colors[colorScheme].text }}>
            Search by network
          </Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
};

export default QRScanner;
