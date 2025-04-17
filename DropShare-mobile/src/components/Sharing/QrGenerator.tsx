import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import React, { useEffect, useState } from "react";
import QRCode from "react-native-qrcode-svg";
import { useTheme } from "../../hooks/ThemeProvider";
import { Colors } from "../../constants/Colors";
import BottomSheet from "../ui/BottomSheet";
import BreakerText from "../ui/BreakerText";
import { navigate } from "../../utils/NavigationUtil";
import { getLocalIPAddress } from "../../utils/NetworkUtils";
import useUsername from "../../hooks/useUsername";
import StyledText from "../ui/StyledText";
import { useNetwork } from "../../service/NetworkProvider";

interface QRGeneratorProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

const QRGenerator: React.FC<QRGeneratorProps> = ({ visible, setVisible }) => {
  const { colorScheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [qrValue, setQrValue] = useState("");
  const { startHosting, isConnected } = useNetwork();
  const { username } = useUsername();
  const deviceName = username;

  const setUpServer = async () => {
    const ip = await getLocalIPAddress();
    const port = 4000;
    startHosting();
    setQrValue(`dropshare://${ip}:${port}|${deviceName}`);
    console.log(`Server started: ${ip}:${port}`);
    setLoading(false);
  };

  useEffect(() => {
    if (visible) {
      setUpServer();
    }
  });

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
      height={510}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          gap: 20,
        }}
      >
        {loading ? (
          <ActivityIndicator size={30} color={Colors[colorScheme].tint} />
        ) : (
          <>
            <QRCode
              value={qrValue}
              size={200}
              logoSize={70}
              logoBackgroundColor="#000"
              logoMargin={0}
              logoBorderRadius={50}
              logo={require("../../assets/images/dropshareLogo.png")}
            />
            <StyledText
              fontWeight="bold"
              style={{
                color: Colors[colorScheme].text,
                fontSize: 18,
                textAlign: "center",
              }}
              text="Ensure you are in same wifi network"
            />
            <StyledText
              fontWeight="bold"
              style={{
                color: Colors[colorScheme].text,
                fontSize: 22,
                textAlign: "center",
              }}
              text="Ask the device to scan this QR to establish connection"
            />
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
            navigate("hostscreen");
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
            style={{ fontSize: 20, color: Colors[colorScheme].text }}
            text="Search by network"
          />
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
};

export default QRGenerator;
