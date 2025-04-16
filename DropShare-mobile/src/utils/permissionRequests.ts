import {
  PermissionsAndroid,
  Alert,
  Platform,
  Permission,
  Linking,
} from "react-native";
import { NativeModules } from "react-native";

const { StoragePermission } = NativeModules;

async function checkAllFilesAccess() {
  console.log("Checking MANAGE_EXTERNAL_STORAGE");
  if (Platform.OS === "android" && Number(Platform.Version) >= 30) {
    try {
      const result = await StoragePermission.checkAllFilesAccess();
      return result;
    } catch (error) {
      return false;
    }
  }
  console.log("Skipping MANAGE_EXTERNAL_STORAGE (not Android 11+)");
  return true;
}

async function requestAllFilesAccess() {
  console.log("Requesting MANAGE_EXTERNAL_STORAGE");
  if (Platform.OS === "android" && Number(Platform.Version) >= 30) {
    try {
      await StoragePermission.requestAllFilesAccess();
      console.log("Navigated to settings for MANAGE_EXTERNAL_STORAGE");
      return true;
    } catch (error) {
      console.error("Error requesting MANAGE_EXTERNAL_STORAGE:", error);
      return false;
    }
  }
  console.log("Skipping MANAGE_EXTERNAL_STORAGE request (not Android 11+)");
  return true;
}

export async function requestPermissions() {
  console.log("Starting requestPermissions");
  try {
    const permissions: Permission[] = [];
    if (Number(Platform.Version) >= 33) {
      console.log("Targeting Android 13+ permissions");
      permissions.push(
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
      );
    } else if (Number(Platform.Version) >= 30) {
      console.log("Targeting Android 11/12 permissions");
      permissions.push(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
      );
    } else {
      console.log("Targeting Android < 11 permissions");
      permissions.push(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
      );
    }

    console.log("Requesting permissions:", permissions);
    const granted = await PermissionsAndroid.requestMultiple(permissions);

    const deniedPermissions = Object.entries(granted)
      .filter(([_, value]) => value !== PermissionsAndroid.RESULTS.GRANTED)
      .map(([key]) => key);

    if (deniedPermissions.length > 0) {
      console.log("Denied permissions:", deniedPermissions);
      Alert.alert(
        "Permissions Required",
        `The following permissions were denied:\n\n${deniedPermissions.join(
          "\n"
        )}\n\nThese are required to save and share files. Please enable them in settings.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open Settings",
            onPress: () => Linking.openSettings(),
          },
        ]
      );
      return false;
    }
    console.log("All Scoped Storage permissions granted");
    if (Number(Platform.Version) >= 30) {
      const hasAllFilesAccess = await checkAllFilesAccess();
      if (!hasAllFilesAccess) {
        console.log("Showing All Files Access prompt");
        return new Promise((resolve) => {
          Alert.alert(
            "All Files Access",
            "For full file management (like Files by Google), allow access to all files. This is optional but enhances functionality.",
            [
              {
                text: "Not Now",
                style: "cancel",
                onPress: () => {
                  console.log("User chose Not Now");
                  Alert.alert(
                    "Scoped Storage Active",
                    "Files will be saved in a specific directory (e.g., Downloads).",
                    [{ text: "OK", onPress: () => resolve(true) }]
                  );
                },
              },
              {
                text: "Allow",
                onPress: async () => {
                  console.log("User chose Allow");
                  const navigated = await requestAllFilesAccess();
                  if (navigated) {
                    Alert.alert(
                      "Action Required",
                      "Please enable 'Allow access to manage all files' in settings, then return to the app.",
                      [{ text: "OK", onPress: () => resolve(false) }]
                    );
                  } else {
                    console.log("Navigation to settings failed");
                    resolve(false);
                  }
                },
              },
            ]
          );
        });
      }
    }
    return true;
  } catch (error) {
    console.error("Error in requestPermissions:", error);
    return false;
  }
}

export async function verifyAllFilesAccess() {
  const hasAccess = await checkAllFilesAccess();
  return hasAccess;
}
