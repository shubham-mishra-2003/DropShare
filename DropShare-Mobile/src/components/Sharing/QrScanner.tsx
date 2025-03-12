import { View, Text, ActivityIndicator } from "react-native";
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

export interface QRProps {
  visible: boolean;
}

const QRScanner: React.FC<QRProps> = ({ visible }) => {
  const [codeFound, setCodeFound] = useState(false);
  const { colorScheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const device = useCameraDevice("back");

  useEffect(() => {
    const checkPermission = async () => {
      const camerPermission = await Camera.requestCameraPermission();
      setHasPermission(camerPermission === "granted");
    };
    checkPermission().then(() => setLoading(false));
  }, [visible]);

  const handleScan = (data: any) => {
    const [connectionData, deviceName] = data.replace("tcp://", "").split("|");
    const [host, port] = connectionData?.split(":");
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

  return (
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
            codeScanner={codeScanner}
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
  );
};

export default QRScanner;
