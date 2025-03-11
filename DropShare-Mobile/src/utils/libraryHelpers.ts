import { launchImageLibrary, Asset } from "react-native-image-picker";
// import DocumentPicker, {
//   DocumentPickerResponse,
// } from "react-native-document-picker";
import { Alert, Linking, PermissionsAndroid, Platform } from "react-native";
import { Toast } from "../components/Toasts";

type MediaPickedCallback = (media: Asset) => void;
// type FilePickedCallback = (file: DocumentPickerResponse[]) => void;

export const pickImage = (onMediaPickedUp: MediaPickedCallback) => {
  launchImageLibrary(
    {
      mediaType: "photo",
      quality: 1,
      includeBase64: false,
    },
    (response: any) => {
      if (response.didCancel) {
        console.log("User canceled image picker");
      } else if (response.errorCode) {
        console.log("ImagePicker Error: ", response.errorMessage);
      } else {
        const { assets } = response;
        if (assets && assets.length > 0) {
          const selectedImage = assets[0];
          onMediaPickedUp(selectedImage);
        }
      }
    }
  );
};

export const pickDocument = (onFilePickedUp: FilePickedCallback) => {
  DocumentPicker.pick({
    type: [DocumentPicker.types.allFiles],
  })
    .then((res: any) => {
      onFilePickedUp(res[0]);
    })
    .catch((err: any) => {
      if (DocumentPicker.isCancel(err)) {
        console.log("User canceled document picker");
      } else {
        console.log("DocumentPicker Error: ", err);
      }
    });
};

export const checkFilePermissions = async () => {
  if (Platform.OS === "android") {
    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      ]);

      const readGranted =
        granted[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] ===
        "granted";
      const writeGranted =
        granted[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] ===
        "granted";

      if (readGranted && writeGranted) {
        Toast("Permissions granted");
        return true;
      } else {
        Toast("Permissions denied");
        return false;
      }
    } catch (err) {
      console.error("Error checking permissions:", err);
      return false;
    }
    // } else if (Platform.OS === "ios") {
    //   try {
    //     const result = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
    //     if (result === RESULTS.GRANTED) {
    //       console.log("STORAGE PERMISSION GRANTED ✅");
    //     } else {
    //       console.log("STORAGE PERMISSION DENIED ❌");
    //     }
    //   } catch (error) {
    //     console.error("Error requesting permission:", error);
    //   }
  } else {
    return false;
  }
};
