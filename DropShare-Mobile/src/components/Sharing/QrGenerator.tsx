import { View, Text, ActivityIndicator, ScrollView } from "react-native";
import React, { useEffect, useState } from "react";
import QRCode from "react-native-qrcode-svg";
import { useTheme } from "../../hooks/ThemeProvider";
import { Colors } from "../../constants/Colors";
import { QRProps } from "../Modals/QrScanner";

const QRGenerator: React.FC<QRProps> = ({ visible }) => {
  const [qrValue, setQRValue] = useState("Shubham mishra");
  const { colorScheme } = useTheme();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (qrValue) {
      setTimeout(() => {
        setLoading(false);
      }, 3000);
      return;
    }
    return;
  }, [visible]);

  return (
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
            Ask the device to scan this QR to establish connection
          </Text>
        </>
      )}
    </View>
  );
};

export default QRGenerator;
