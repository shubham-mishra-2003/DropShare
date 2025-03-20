import { launchImageLibrary, Asset } from 'react-native-image-picker';
import { PermissionsAndroid } from 'react-native';

type MediaPickedCallback = (media: Asset) => void;
type FilePickedCallback = (file: any) => void;

// export const pickImage = (onMediaPickedUp: MediaPickedCallback) => {
//   launchImageLibrary(
//     {
//       mediaType: 'photo',
//       quality: 1,
//       includeBase64: false,
//     },
//     (response: any) => {
//       if (response.didCancel) {
//         console.log('User canceled image picker');
//       } else if (response.errorCode) {
//         console.log('ImagePicker Error: ', response.errorMessage);
//       } else {
//         const { assets } = response;
//         if (assets && assets.length > 0) {
//           const selectedImage = assets[0];
//           onMediaPickedUp(selectedImage);
//         }
//       }
//     },
//   );
// };

// export const pickDocument = async (onFilePickedUp: FilePickedCallback) => {
//   try {
//     const [pickResult] = await pick();
//     onFilePickedUp(pickResult);
//   } catch (err: unknown) {
//     console.log(err);
//   }
// };

export const formatFileSize = (sizeInBytes: number): string => {
  if (sizeInBytes >= 1024 ** 3) {
    return (sizeInBytes / 1024 ** 3).toFixed(2) + ' GB';
  } else if (sizeInBytes >= 1024 ** 2) {
    return (sizeInBytes / 1024 ** 2).toFixed(2) + ' MB';
  } else if (sizeInBytes >= 1024) {
    return (sizeInBytes / 1024).toFixed(2) + ' KB';
  } else {
    return sizeInBytes + ' B';
  }
};