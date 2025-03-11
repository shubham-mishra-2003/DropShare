import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useState } from "react";
import {
  startDeviceDiscovery,
  stopDeviceDiscovery,
} from "../../utils/networkUtils";
import useUsername from "../../hooks/useUsername";
import { nearByDevicesStyles } from "../../constants/Styles";
import { useTheme } from "../../hooks/ThemeProvider";
import Icon from "../Icon";
import { icons, images } from "../../assets";
import BottomSheet from "../ui/BottomSheet";
import { Colors } from "../../constants/Colors";
import { navigate } from "../../utils/NavigationUtil";

interface Device {
  address: string;
  name: string;
}

const NearbyDevices = () => {
  const [openSheet, setOpenSheet] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const { username } = useUsername();
  const { colorScheme } = useTheme();
  const styles = nearByDevicesStyles(colorScheme);
  const [searching, setSearching] = useState(false);

  const [selectedDevices, setSelectedDevices] = useState<Device[]>([]);

  const handleStartDiscovery = async () => {
    setSearching(true);
    setDevices([]);
    await startDeviceDiscovery(setDevices, username);

    if (devices.length < 0) {
      setSearching(false);
    } else {
      setTimeout(() => {
        if (devices.length === 0) {
          setSearching(false);
          setDevices([]);
        }
      }, 5000);
    }
  };

  const handleClose = () => {
    setOpenSheet(false);
    setSelectedDevices([]);
    setSearching(false);
  };

  const isSelected = (device: Device) =>
    selectedDevices.some((d) => d.address === device.address);

  return (
    <>
      <TouchableOpacity
        onPress={() => {
          setOpenSheet(true);
          handleStartDiscovery();
        }}
        style={styles.shareButton}
      >
        <Icon source={icons.share} height={25} width={25} filter={1} />
        <Text style={styles.shareText}>Share</Text>
      </TouchableOpacity>
      <BottomSheet
        visible={openSheet}
        onRequestClose={() => {
          handleClose();
          stopDeviceDiscovery();
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
              handleClose();
              navigate("setting");
              stopDeviceDiscovery();
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
          <View style={{ marginTop: 5, flex: 1, width: "100%" }}>
            {searching ? (
              <ActivityIndicator
                size="large"
                color={Colors[colorScheme].tint}
              />
            ) : devices.length > 0 ? (
              <View style={styles.deviceListView}>
                <ScrollView
                  contentContainerStyle={{ gap: 10, padding: 10 }}
                  style={{ width: "100%", height: "100%" }}
                  showsVerticalScrollIndicator={false}
                >
                  {devices.map((device) => (
                    <TouchableOpacity
                      style={[
                        styles.deviceList,
                        {
                          backgroundColor: isSelected(device)
                            ? Colors[colorScheme].tint
                            : Colors[colorScheme].itemBackground,
                        },
                      ]}
                      key={device.address}
                      onPress={() => {
                        setSelectedDevices((prev) =>
                          prev.some((d) => d.address === device.address)
                            ? prev.filter((d) => d.address !== device.address)
                            : [...prev, device]
                        );
                      }}
                    >
                      <View style={{ opacity: isSelected(device) ? 1 : 0 }}>
                        <Icon
                          source={icons.check}
                          height={20}
                          width={20}
                          filter={1}
                        />
                      </View>
                      <Text style={styles.deviceName}>{device.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity
                  disabled={selectedDevices.length == 0}
                  style={{
                    padding: 20,
                    borderRadius: 20,
                    backgroundColor:
                      selectedDevices.length == 0
                        ? Colors[colorScheme].itemBackground
                        : Colors[colorScheme].tint,
                    width: "80%",
                    bottom: 0,
                  }}
                  onPress={() => {
                    handleClose();
                    navigate("sharing", { selectedDevices });
                  }}
                >
                  <Text
                    style={{
                      color: Colors[colorScheme].text,
                      fontSize: 18,
                      textAlign: "center",
                    }}
                  >
                    Connect
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ alignItems: "center", gap: 10 }}>
                <Text style={{ color: Colors[colorScheme].text, fontSize: 20 }}>
                  No Nearby Device Found
                </Text>
                <TouchableOpacity
                  style={{
                    padding: 20,
                    borderRadius: 20,
                    backgroundColor: Colors[colorScheme].tint,
                    width: "80%",
                  }}
                  onPress={() => handleStartDiscovery()}
                >
                  <Text
                    style={{
                      color: Colors[colorScheme].text,
                      fontSize: 18,
                      textAlign: "center",
                    }}
                  >
                    Retry
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </BottomSheet>
    </>
  );
};

export default NearbyDevices;
