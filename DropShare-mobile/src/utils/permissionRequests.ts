import {
  PermissionsAndroid,
  Alert,
  Platform,
  Permission,
  Linking,
} from "react-native";

export async function requestPermissions() {
  try {
    const permissions: Permission[] = [];

    if (Number(Platform.Version) >= 33) {
      permissions.push(
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
      );
    } else {
      permissions.push(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
    }

    const granted = await PermissionsAndroid.requestMultiple(permissions);

    if (
      granted[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] ===
      PermissionsAndroid.RESULTS.GRANTED
    ) {
      granted[PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES] =
        PermissionsAndroid.RESULTS.GRANTED;
      granted[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO] =
        PermissionsAndroid.RESULTS.GRANTED;
      granted[PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO] =
        PermissionsAndroid.RESULTS.GRANTED;
    }

    const deniedPermissions = Object.entries(granted)
      .filter(([_, value]) => value !== PermissionsAndroid.RESULTS.GRANTED)
      .map(([key]) => key);

    if (deniedPermissions.length > 0) {
      Alert.alert(
        "Permissions Required",
        `The following permissions were denied:\n\n${deniedPermissions.join(
          "\n"
        )}\n\nThese are required for full functionality. Please enable them in settings.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open Settings",
            onPress: () => Linking.openSettings(),
          },
        ]
      );
    }
  } catch (error) {
    console.error("Error requesting permissions:", error);
  }
}
