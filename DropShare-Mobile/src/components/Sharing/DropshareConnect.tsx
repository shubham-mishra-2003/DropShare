import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useState } from "react";

import useUsername from "../../hooks/useUsername";
import { nearByDevicesStyles } from "../../constants/Styles";
import { useTheme } from "../../hooks/ThemeProvider";
import Icon from "../Icon";
import { icons, images } from "../../assets";
import BottomSheet from "../ui/BottomSheet";
import { Colors } from "../../constants/Colors";
import { navigate } from "../../utils/NavigationUtil";
import QRGenerator from "./QrGenerator";
import QRScanner from "./QrScanner";

const DropshareConnect = () => {
  const [openConnect, setOpenConnect] = useState(false);
  const [openHostSheet, setOpenHostSheet] = useState(false);
  const [openConnectSheet, setOpenConnectSheet] = useState(false);
  const { username } = useUsername();
  const { colorScheme } = useTheme();
  const styles = nearByDevicesStyles(colorScheme);

  return (
    <>
      <TouchableOpacity
        onPress={() => {
          setOpenConnect(true);
        }}
        style={styles.shareButton}
      >
        <Icon source={icons.share} height={25} width={25} filter={1} />
        <Text style={styles.shareText}>Share</Text>
      </TouchableOpacity>
      <BottomSheet
        visible={openConnect}
        onRequestClose={() => {
          setOpenConnect(false);
        }}
      >
        <View style={styles.modalView}>
          <Image
            source={images.logo}
            alt="Dropshare"
            height={100}
            width={100}
            style={styles.logo}
          />
          <Text style={styles.username}>Display name: {username}</Text>
          <TouchableOpacity
            onPress={() => {
              setOpenConnect(false);
              navigate("setting");
            }}
          >
            <Text
              style={{
                color: Colors[colorScheme].tint,
                textDecorationLine: "underline",
                fontSize: 18,
                textAlign: "center",
              }}
            >
              Change display name
            </Text>
          </TouchableOpacity>
          <View
            style={{
              marginTop: 10,
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 7,
            }}
          >
            <TouchableOpacity
              style={{
                backgroundColor: Colors[colorScheme].itemBackground,
                width: "48%",
                borderRadius: 20,
                height: 50,
                justifyContent: "center",
              }}
              onPress={() => {
                setOpenHostSheet(true);
                setOpenConnect(false);
              }}
            >
              <Text
                style={{
                  color: "#00aff0",
                  fontSize: 16,
                  textAlign: "center",
                  fontWeight: "bold",
                }}
              >
                Host Connection
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setOpenConnectSheet(true);
                setOpenConnect(false);
              }}
              style={{
                backgroundColor: Colors[colorScheme].itemBackground,
                width: "48%",
                borderRadius: 20,
                height: 50,
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: Colors[colorScheme].tint,
                  fontSize: 16,
                  textAlign: "center",
                  fontWeight: "bold",
                }}
              >
                Connect
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>
      <BottomSheet
        visible={openHostSheet}
        onRequestClose={() => setOpenHostSheet(false)}
        height={400}
      >
        <QRGenerator visible={openHostSheet} />
      </BottomSheet>
      <BottomSheet
        visible={openConnectSheet}
        onRequestClose={() => setOpenConnectSheet(false)}
        height={550}
      >
        <QRScanner visible={openHostSheet} />
      </BottomSheet>
    </>
  );
};

export default DropshareConnect;
