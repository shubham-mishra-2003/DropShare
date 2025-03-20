import { Platform } from "react-native";
import DeviceInfo from "react-native-device-info";
import { NetworkInfo } from "react-native-network-info";

export interface Device {
  address: string;
  name: string;
}

export const getLocalIPAddress = async (): Promise<string> => {
  try {
    const localIP = await NetworkInfo.getIPV4Address();
    return localIP || "0.0.0.0";
  } catch (error) {
    console.error("Error getting local IP:", error);
    return "0.0.0.0";
  }
};

export const setLastBlockTo255 = (ip: string): string => {
  const parts = ip.split(".").map(Number);
  parts[3] = 255;
  return parts.join(".");
};

export const getBroadcastIPAddress = async (): Promise<string | null> => {
  try {
    const ip = await DeviceInfo.getIpAddress();
    const iosIp = await NetworkInfo.getBroadcast();
    return setLastBlockTo255(
      (Platform.OS === "ios" ? iosIp : ip) || "255.255.255.255"
    );
  } catch (error) {
    console.error("Error getting broadcast address:", error);
    return null;
  }
};