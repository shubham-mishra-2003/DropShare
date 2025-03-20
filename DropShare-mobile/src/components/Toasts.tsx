import { Alert } from "react-native";
import { ToastAndroid } from "react-native";
import { Platform } from "react-native";

export const Toast = (message: string) => {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert(message);
  }
};
