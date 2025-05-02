import {
  View,
  ActivityIndicator,
  TouchableOpacity,
  Vibration,
  Alert,
} from "react-native";
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
  const { startHosting, isHostConnected, stopHosting } = useNetwork();
  const { username } = useUsername();

  const modalClose = () => {
    if (!isHostConnected) {
      stopHosting();
    }
    setVisible(false);
  };

  useEffect(() => {
    const startHostingAndSetQr = async () => {
      try {
        setLoading(true);
        await startHosting();
        const ip = await getLocalIPAddress();
        if (!ip) {
          throw new Error("No IP address found");
        }
        const qrData = `dropshare://${ip}:${username}`;
        console.log("Generated QR Value:", qrData);
        setQrValue(qrData);
      } catch (error) {
        console.error("Failed to generate QR code:", error);
        Alert.alert(
          "Error",
          "Failed to retrieve IP address. Ensure you are connected to a Wi-Fi network.",
          [{ text: "OK", onPress: modalClose }]
        );
      } finally {
        setLoading(false);
      }
    };

    if (visible) {
      startHostingAndSetQr();
    }
    if (isHostConnected) {
      navigate("connectionscreen");
    }
  }, [visible, isHostConnected]);

  return (
    <BottomSheet visible={visible} onRequestClose={modalClose} height={500}>
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
        ) : !qrValue ? (
          <View
            style={{ justifyContent: "center", alignItems: "center", gap: 20 }}
          >
            <StyledText
              fontWeight="bold"
              style={{
                fontSize: 20,
                color: Colors[colorScheme].text,
                textAlign: "center",
              }}
              text="Unable to generate QR code. Please check your network."
            />
          </View>
        ) : (
          <>
            <View
              style={{
                width: "100%",
                height: 200,
                justifyContent: "center",
                alignItems: "center",
                overflow: "hidden",
                borderRadius: 20,
                marginTop: 20,
              }}
            >
              <QRCode
                value={qrValue}
                size={200}
                logoSize={60}
                logoMargin={5}
                logoBorderRadius={50}
                logo={require("../../assets/images/dropshareLogo.png")}
                backgroundColor={Colors[colorScheme].background}
                color={Colors[colorScheme].text}
              />
            </View>
            <StyledText
              fontWeight="bold"
              style={{
                color: Colors[colorScheme].text,
                fontSize: 18,
                textAlign: "center",
              }}
              text="Ensure you are on the same Wi-Fi network"
            />
            <StyledText
              fontWeight="bold"
              style={{
                color: Colors[colorScheme].text,
                fontSize: 22,
                textAlign: "center",
              }}
              text="Ask another device to scan this QR code to connect"
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
