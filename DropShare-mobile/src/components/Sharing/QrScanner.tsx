import { View, ActivityIndicator, TouchableOpacity } from "react-native";
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
import StyledText from "../ui/StyledText";
import { useNetwork } from "../../service/NetworkProvider";

interface QRScannerProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ visible, setVisible }) => {
  const [codeFound, setCodeFound] = useState(false);
  const { colorScheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const device = useCameraDevice("back");

  const { startClient, connectToHostIp, isConnected } = useNetwork();

  useEffect(() => {
    const checkPermission = async () => {
      const camerPermission = await Camera.requestCameraPermission();
      setHasPermission(camerPermission === "granted");
    };
    checkPermission().then(() => setLoading(false));
    if (!loading && visible) {
      startClient();
    }
  }, [visible]);

  const handleScan = (data: any) => {
    const [connectionData] = data.replace("dropshare://", "").split("|");
    const [host, port] = connectionData?.split(":");
    connectToHostIp(host);
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
      height={700}
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
            <StyledText
              fontWeight="bold"
              style={{
                fontSize: 20,
                color: Colors[colorScheme].text,
                textAlign: "center",
              }}
              text="Camera not found or permission not granted"
            />
          </View>
        ) : (
          <>
            <Camera
              isActive={true}
              device={device}
              style={{ width: "100%", height: 400 }}
              codeScanner={codeScanner}
            />
            <StyledText
              fontWeight="bold"
              style={{
                fontSize: 20,
                color: Colors[colorScheme].text,
                textAlign: "center",
              }}
              text="Ensure you are in same wifi network"
            />
            <StyledText
              fontWeight="bold"
              style={{
                fontSize: 22,
                color: Colors[colorScheme].text,
                textAlign: "center",
              }}
              text="Ask the device to show their QR to establish connection"
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
