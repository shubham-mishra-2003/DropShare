import {
  View,
  ActivityIndicator,
  TouchableOpacity,
  Vibration,
  Alert,
} from "react-native";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useTheme } from "../../hooks/ThemeProvider";
import { Colors } from "../../constants/Colors";
import {
  Camera,
  CodeScanner,
  useCameraDevice,
  useCameraPermission,
  Code,
} from "react-native-vision-camera";
import Icon from "../Icon";
import { icons } from "../../assets";
import BottomSheet from "../ui/BottomSheet";
import BreakerText from "../ui/BreakerText";
import { navigate } from "../../utils/NavigationUtil";
import StyledText from "../ui/StyledText";
import { useNetwork } from "../../service/NetworkProvider";
import { Toast } from "../Toasts";

interface QRScannerProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ visible, setVisible }) => {
  const [codeFound, setCodeFound] = useState(false);
  const [lastScannedData, setLastScannedData] = useState<string | null>(null);
  const { colorScheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();
  const { startClient, connectToHostIp, isConnected, stopClient } = useNetwork();

  useEffect(() => {
    const initialize = async () => {
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) {
          Alert.alert(
            "Permission Denied",
            "Camera permission is required to scan QR codes.",
            [{ text: "OK", onPress: () => setVisible(false) }]
          );
          return;
        }
      }
      setLoading(false);
    };
    if (visible) {
      setCodeFound(false);
      setLastScannedData(null);
      initialize();
      startClient();
    }
  }, [visible, hasPermission, requestPermission]);

  const resetScan = useCallback(() => {
    setCodeFound(false);
    setLastScannedData(null);
  }, [visible]);

  const isValidScannedData = (data: string) => {
    const prefix = "dropshare://";
    console.log("Validating QR Code: ", data);
    if (!data.startsWith(prefix)) {
      return { isValid: false };
    }
    const ip = data.slice(prefix.length).split(":")[0];
    const deviceName = data.slice(prefix.length).split(":")[1];
    const ipRegex = /^(?:\d{1,3}\.){3}\d{1,3}$/;
    const isValid = ipRegex.test(ip);
    console.log("Validated QR Code: ", { isValid, ip, deviceName });
    return { isValid, ip, deviceName };
  };

  const handleScan = useCallback(
    (data: string) => {
      setLastScannedData(data);
      setCodeFound(true);
      console.log("Scanned QR Code:", data);
      const { isValid, ip, deviceName } = isValidScannedData(data);

      if (isValid && ip) {
        connectToHostIp(ip);
        Toast(`Connecting with : ${deviceName}`);
      } else {
        Alert.alert(
          "QR Code Scanned",
          "Only DropShare QR codes should be scanned",
          [{ text: "OK", onPress: resetScan }]
        );
      }
    },
    [lastScannedData, resetScan, connectToHostIp]
  );
  const codeScanner = useMemo<CodeScanner>(
    () => ({
      codeTypes: ["qr"],
      onCodeScanned: (codes: Code[]) => {
        if (codes.length > 0 && !codeFound) {
          const scannedData = codes[0].value;
          if (scannedData) {
            handleScan(scannedData);
          } else {
            resetScan();
          }
        }
      },
    }),
    [codeFound, handleScan, resetScan]
  );

  useEffect(() => {
    if (isConnected) {
      setVisible(false);
      navigate("connection").then(() => Vibration.vibrate(10));
    }
  }, [isConnected]);

  const modalClose = () => {
    if (!isConnected) {
      stopClient();
    }
    setVisible(false);
    resetScan();
  };

  return (
    <BottomSheet
      visible={visible}
      onRequestClose={modalClose}
      height={600}
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
        ) : !hasPermission ? (
          <View
            style={{ justifyContent: "center", alignItems: "center", gap: 20 }}
          >
            <Icon source={icons.cameraOff} height={80} width={80} filter={1} />
            <StyledText
              fontWeight="bold"
              style={{
                fontSize: 20,
                color: Colors[colorScheme].text,
                textAlign: "center",
              }}
              text="Camera permission not granted"
            />
          </View>
        ) : !device ? (
          <View
            style={{ justifyContent: "center", alignItems: "center", gap: 20 }}
          >
            <Icon source={icons.cameraOff} height={80} width={80} filter={1} />
            <StyledText
              fontWeight="bold"
              style={{
                fontSize: 20,
                color: Colors[colorScheme].text,
                textAlign: "center",
              }}
              text="No camera device found"
            />
          </View>
        ) : (
          <>
            <View
              style={{
                width: "80%",
                height: "80%",
                justifyContent: "center",
                alignItems: "center",
                overflow: "hidden",
                borderRadius: 20,
              }}
            >
              <Camera
                isActive={visible && hasPermission}
                device={device}
                style={{ width: "100%", height: "100%" }}
                codeScanner={codeScanner}
                torch="on"
              />
            </View>
            <StyledText
              fontWeight="bold"
              style={{
                fontSize: 20,
                color: Colors[colorScheme].text,
                textAlign: "center",
              }}
              text="Ensure you are on the same Wi-Fi network"
            />
            <StyledText
              fontWeight="bold"
              style={{
                fontSize: 22,
                color: Colors[colorScheme].text,
                textAlign: "center",
              }}
              text="Scan a DropShare QR code to connect"
            />
          </>
        )}
      </View>
      <View
        style={{
          width: "100%",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <BreakerText text="or" />
        <TouchableOpacity
          onPress={() => {
            navigate("clientscreen");
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
          <StyledText
            fontWeight="bold"
            fontSize={20}
            text="Search by network"
          />
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
};

export default QRScanner;
