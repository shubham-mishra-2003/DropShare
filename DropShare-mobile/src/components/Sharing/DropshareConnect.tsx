import { Image, TouchableOpacity, View } from "react-native";
import React, { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import useUsername from "../../hooks/useUsername";
import { nearByDevicesStyles } from "../../constants/Styles";
import { useTheme } from "../../hooks/ThemeProvider";
import Icon from "../Icon";
import { icons, images } from "../../assets";
import BottomSheet from "../ui/BottomSheet";
import { Colors } from "../../constants/Colors";
import QRGenerator from "./QrGenerator";
import QRScanner from "./QrScanner";
import StyledText from "../ui/StyledText";
import { navigate } from "../../utils/NavigationUtil";

const DropshareConnect = () => {
  const [openConnect, setOpenConnect] = useState(false);
  const [openHostSheet, setOpenHostSheet] = useState(false);
  const [openConnectSheet, setOpenConnectSheet] = useState(false);
  const { username, loadUsername } = useUsername();
  const { colorScheme } = useTheme();
  const styles = nearByDevicesStyles(colorScheme);

  useFocusEffect(
    useCallback(() => {
      loadUsername();
    }, [loadUsername])
  );

  return (
    <>
      <TouchableOpacity
        onPress={() => {
          setOpenConnect(true);
        }}
        style={styles.shareButton}
      >
        <Icon source={icons.share} height={25} width={25} filter={1} />
        <StyledText fontWeight="bold" style={styles.shareText}>
          Share
        </StyledText>
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
          <StyledText fontWeight="bold" style={styles.username}>
            Display name: {username || "DropShare User"}
          </StyledText>
          <TouchableOpacity
            onPress={() => {
              setOpenConnect(false);
              navigate("setting");
            }}
          >
            <StyledText
              fontWeight="bold"
              style={{
                color: Colors[colorScheme].tint,
                textDecorationLine: "underline",
                fontSize: 20,
                textAlign: "center",
              }}
              text="Change display name"
            />
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
                alignItems: "center",
              }}
              onPress={() => {
                setOpenHostSheet(true);
                setOpenConnect(false);
              }}
            >
              <StyledText
                fontWeight="bold"
                style={{
                  color: "#00aff0",
                  textAlign: "center",
                }}
                fontSize={24}
                text="Host connection"
              />
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
              <StyledText
                fontWeight="bold"
                style={{
                  color: Colors[colorScheme].tint,
                  fontSize: 26,
                  textAlign: "center",
                }}
                text="Connect"
              />
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>
      <QRGenerator visible={openHostSheet} setVisible={setOpenHostSheet} />
      <QRScanner visible={openConnectSheet} setVisible={setOpenConnectSheet} />
    </>
  );
};

export default DropshareConnect;
