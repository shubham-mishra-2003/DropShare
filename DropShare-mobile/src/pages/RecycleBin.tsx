// import React, { useEffect, useState } from "react";
// import {
//   StyleSheet,
//   View,
//   FlatList,
//   TouchableOpacity,
//   Alert,
//   Modal,
//   Pressable,
//   ActivityIndicator,
//   Platform,
//   PermissionsAndroid,
// } from "react-native";
// import LinearGradient from "react-native-linear-gradient";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import RNFS from "react-native-fs";
// import { Colors } from "../constants/Colors";
// import { useTheme } from "../hooks/ThemeProvider";
// import Header from "../components/ui/Header";
// import StyledText from "../components/ui/StyledText";
// import Icon from "../components/Icon";
// import { icons } from "../assets";

// // Types for Recycle Bin items
// interface RecycleBinItem {
//   id: string;
//   name: string;
//   type: string;
//   deletedAt: string;
//   originalPath: string;
//   currentPath: string;
//   isTrashed: boolean; // Indicates if the file is marked as trashed by the system
// }

// // Recycle Bin directory in shared storage
// const RECYCLE_BIN_DIR = `${RNFS.ExternalStorageDirectoryPath}/MyApp/RecycleBin`;

// const RecycleBin = () => {
//   const { colorScheme } = useTheme();
//   const styles = RecycleBinStyles(colorScheme);
//   const [items, setItems] = useState<RecycleBinItem[]>([]);
//   const [selectedItems, setSelectedItems] = useState<string[]>([]);
//   const [modalVisible, setModalVisible] = useState(false);
//   const [activeItem, setActiveItem] = useState<RecycleBinItem | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [showTrashedOnly, setShowTrashedOnly] = useState(false); // Filter for trashed items

//   // Request storage permissions (Android)
//   const requestStoragePermission = async () => {
//     if (Platform.OS !== "android") return true;
//     try {
//       const granted = await PermissionsAndroid.requestMultiple([
//         PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
//         PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
//       ]);
//       return (
//         granted[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] ===
//           PermissionsAndroid.RESULTS.GRANTED &&
//         granted[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] ===
//           PermissionsAndroid.RESULTS.GRANTED
//       );
//     } catch (err) {
//       setError("Failed to request storage permissions");
//       return false;
//     }
//   };

//   // Initialize Recycle Bin directory
//   const initRecycleBinDir = async () => {
//     try {
//       const exists = await RNFS.exists(RECYCLE_BIN_DIR);
//       if (!exists) {
//         await RNFS.mkdir(RECYCLE_BIN_DIR);
//       }
//     } catch (err) {
//       setError("Failed to initialize recycle bin directory");
//     }
//   };

//   // Load items from AsyncStorage and scan shared storage
//   useEffect(() => {
//     const loadItems = async () => {
//       try {
//         setLoading(true);

//         // Request permissions
//         const hasPermission = await requestStoragePermission();
//         if (!hasPermission) {
//           setError("Storage permissions denied");
//           Alert.alert("Error", "Storage permissions are required");
//           return;
//         }

//         // Initialize recycle bin directory
//         await initRecycleBinDir();

//         // Load items from AsyncStorage
//         const storedItems = await AsyncStorage.getItem("recycleBin");
//         let recycleBinItems: RecycleBinItem[] = storedItems
//           ? JSON.parse(storedItems)
//           : [];

//         // Scan shared storage for trashed files
//         const trashedFiles = await scanSharedStorage();
//         recycleBinItems = [...recycleBinItems, ...trashedFiles];

//         setItems(recycleBinItems);
//       } catch (err) {
//         setError("Failed to load recycle bin items");
//         Alert.alert("Error", "Could not load recycle bin items");
//       } finally {
//         setLoading(false);
//       }
//     };
//     loadItems();
//   }, []);

//   // Scan shared storage for trashed files
//   const scanSharedStorage = async (): Promise<RecycleBinItem[]> => {
//     try {
//       const directories = [
//         `${RNFS.ExternalStorageDirectoryPath}/DCIM`,
//         `${RNFS.ExternalStorageDirectoryPath}/Pictures`,
//         `${RNFS.ExternalStorageDirectoryPath}/Documents`,
//       ];
//       let trashedFiles: RecycleBinItem[] = [];

//       for (const dir of directories) {
//         try {
//           const files = await RNFS.readDir(dir);
//           const filteredFiles = files
//             .filter(
//               (file) =>
//                 file.name.includes(".trashed") || // Simulate IS_TRASHED
//                 file.path.includes("/.Trash") || // Common trash folder
//                 file.name.startsWith("._") // Hidden files sometimes used for trash
//             )
//             .map((file) => ({
//               id: file.path,
//               name: file.name,
//               type:
//                 file.name.endsWith(".jpg") || file.name.endsWith(".png")
//                   ? "image"
//                   : "file",
//               deletedAt: new Date(file.mtime || Date.now()).toISOString(),
//               originalPath: file.path,
//               currentPath: file.path,
//               isTrashed: true, // Mark as trashed
//             }));
//           trashedFiles = [...trashedFiles, ...filteredFiles];
//         } catch (dirErr) {
//           console.warn(`Failed to scan directory ${dir}:`, dirErr);
//         }
//       }

//       /*
//        * Native Module Placeholder for Media Store with IS_TRASHED
//        * To properly query IS_TRASHED, implement a native module in Android:
//        * 1. Create a React Native module (e.g., TrashedFilesModule).
//        * 2. Use ContentResolver to query MediaStore.Files:
//        *    ```java
//        *    ContentResolver resolver = reactContext.getContentResolver();
//        *    Uri uri = MediaStore.Files.getContentUri("external");
//        *    String[] projection = { MediaStore.Files.FileColumns._ID, MediaStore.Files.FileColumns.DISPLAY_NAME, ... };
//        *    String selection = MediaStore.Files.FileColumns.IS_TRASHED + " = 1";
//        *    Cursor cursor = resolver.query(uri, projection, selection, null, null);
//        *    ```
//        * 3. Return results to JavaScript as a list of file objects.
//        * 4. Call the module from React Native:
//        *    ```javascript
//        *    const trashedFiles = await NativeModules.TrashedFilesModule.getTrashedFiles();
//        *    ```
//        * This would provide accurate trashed file detection for Android 11+.
//        */

//       return trashedFiles;
//     } catch (err) {
//       console.warn("Failed to scan shared storage:", err);
//       return [];
//     }
//   };

//   // Save items to AsyncStorage
//   useEffect(() => {
//     const saveItems = async () => {
//       try {
//         await AsyncStorage.setItem("recycleBin", JSON.stringify(items));
//       } catch (err) {
//         setError("Failed to save recycle bin items");
//       }
//     };
//     if (items.length > 0) {
//       saveItems();
//     }
//   }, [items]);

//   // Handle single tap (show action modal)
//   const handleItemPress = (item: RecycleBinItem) => {
//     if (selectedItems.length > 0) {
//       toggleSelection(item.id);
//     } else {
//       setActiveItem(item);
//       setModalVisible(true);
//     }
//   };

//   // Handle long press (start multi-selection)
//   const handleLongPress = (itemId: string) => {
//     toggleSelection(itemId);
//   };

//   // Toggle item selection
//   const toggleSelection = (itemId: string) => {
//     setSelectedItems((prev) =>
//       prev.includes(itemId)
//         ? prev.filter((id) => id !== itemId)
//         : [...prev, itemId]
//     );
//   };

//   // Restore single item
//   const restoreItem = async () => {
//     if (!activeItem) return;
//     try {
//       // Move file back to original path
//       await RNFS.moveFile(activeItem.currentPath, activeItem.originalPath);
//       setItems((prev) => prev.filter((item) => item.id !== activeItem.id));
//       setModalVisible(false);
//       Alert.alert("Success", `${activeItem.name} has been restored`);
//     } catch (err) {
//       setError("Failed to restore item");
//       Alert.alert("Error", "Could not restore item");
//     }
//   };

//   // Delete single item permanently
//   const deletePermanently = async () => {
//     if (!activeItem) return;
//     try {
//       // Delete file from storage
//       await RNFS.unlink(activeItem.currentPath);
//       setItems((prev) => prev.filter((item) => item.id !== activeItem.id));
//       setModalVisible(false);
//       Alert.alert("Success", `${activeItem.name} has been permanently deleted`);
//     } catch (err) {
//       setError("Failed to delete item");
//       Alert.alert("Error", "Could not delete item");
//     }
//   };

//   // Restore selected items
//   const restoreSelected = async () => {
//     try {
//       for (const itemId of selectedItems) {
//         const item = items.find((i) => i.id === itemId);
//         if (item) {
//           await RNFS.moveFile(item.currentPath, item.originalPath);
//         }
//       }
//       setItems((prev) =>
//         prev.filter((item) => !selectedItems.includes(item.id))
//       );
//       setSelectedItems([]);
//       Alert.alert("Success", "Selected items have been restored");
//     } catch (err) {
//       setError("Failed to restore selected items");
//       Alert.alert("Error", "Could not restore selected items");
//     }
//   };

//   // Delete selected items permanently
//   const deleteSelectedPermanently = async () => {
//     try {
//       for (const itemId of selectedItems) {
//         const item = items.find((i) => i.id === itemId);
//         if (item) {
//           await RNFS.unlink(item.currentPath);
//         }
//       }
//       setItems((prev) =>
//         prev.filter((item) => !selectedItems.includes(item.id))
//       );
//       setSelectedItems([]);
//       Alert.alert("Success", "Selected items have been permanently deleted");
//     } catch (err) {
//       setError("Failed to delete selected items");
//       Alert.alert("Error", "Could not delete selected items");
//     }
//   };

//   // Import files via SAF
//   //   const importFiles = async () => {
//   //     try {
//   //       const result = await DocumentPicker.pick({
//   //         type: [DocumentPicker.types.allFiles],
//   //         allowMultiSelection: true,
//   //       });
//   //       const newItems: RecycleBinItem[] = [];
//   //       for (const file of result) {
//   //         const newPath = `${RECYCLE_BIN_DIR}/${file.name}`;
//   //         await RNFS.copyFile(file.uri, newPath);
//   //         newItems.push({
//   //           id: file.uri,
//   //           name: file.name,
//   //           type: file.type || "file",
//   //           deletedAt: new Date().toISOString(),
//   //           originalPath: file.uri,
//   //           currentPath: newPath,
//   //           isTrashed: false, // Imported files are not system-trashed
//   //         });
//   //       }
//   //       setItems((prev) => [...prev, ...newItems]);
//   //       Alert.alert("Success", "Files imported to recycle bin");
//   //     } catch (err) {
//   //       if (!DocumentPicker.isCancel(err)) {
//   //         setError("Failed to import files");
//   //         Alert.alert("Error", "Could not import files");
//   //       }
//   //     }
//   //   };

//   // Toggle trashed filter
//   const toggleTrashedFilter = () => {
//     setShowTrashedOnly((prev) => !prev);
//   };

//   // Filter items based on trashed status
//   const filteredItems = showTrashedOnly
//     ? items.filter((item) => item.isTrashed)
//     : items;

//   // Render each item in the list
//   const renderItem = ({ item }: { item: RecycleBinItem }) => {
//     const isSelected = selectedItems.includes(item.id);
//     return (
//       <TouchableOpacity
//         style={[styles.itemContainer, isSelected && styles.selectedItem]}
//         onPress={() => handleItemPress(item)}
//         onLongPress={() => handleLongPress(item.id)}
//         activeOpacity={0.7}
//       >
//         <View style={styles.itemTextContainer}>
//           <StyledText style={styles.itemName}>{item.name}</StyledText>
//           <StyledText style={styles.itemDetails}>
//             Deleted: {new Date(item.deletedAt).toLocaleDateString()}
//           </StyledText>
//           <StyledText style={styles.itemDetails}>
//             Original: {item.originalPath}
//           </StyledText>
//           {item.isTrashed && (
//             <StyledText style={styles.trashedTag}>System Trashed</StyledText>
//           )}
//         </View>
//         {isSelected && (
//           <Icon filter={1} source={icons.check} height={20} width={20} />
//         )}
//       </TouchableOpacity>
//     );
//   };

//   return (
//     <LinearGradient
//       start={{ x: 0, y: 0 }}
//       end={{ x: 1, y: 1 }}
//       colors={Colors[colorScheme].linearGradientColors}
//       style={{ flex: 1 }}
//     >
//       <Header page="Recycle Bin" />
//       <View style={styles.container}>
//         <View style={styles.filterContainer}>
//           <TouchableOpacity
//             style={[
//               styles.filterButton,
//               showTrashedOnly && styles.filterButtonActive,
//             ]}
//             onPress={toggleTrashedFilter}
//           >
//             <StyledText
//               style={[
//                 styles.filterText,
//                 showTrashedOnly && styles.filterTextActive,
//               ]}
//             >
//               {showTrashedOnly ? "Show All" : "Show Trashed Only"}
//             </StyledText>
//           </TouchableOpacity>
//         </View>
//         {loading ? (
//           <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
//         ) : error ? (
//           <StyledText style={styles.errorText}>{error}</StyledText>
//         ) : filteredItems.length === 0 ? (
//           <StyledText style={styles.emptyText}>
//             {showTrashedOnly
//               ? "No trashed items found"
//               : "Recycle Bin is empty"}
//           </StyledText>
//         ) : (
//           <>
//             <FlatList
//               data={filteredItems}
//               renderItem={renderItem}
//               keyExtractor={(item) => item.id}
//               contentContainerStyle={styles.list}
//             />
//             {selectedItems.length > 0 && (
//               <View style={styles.selectionActions}>
//                 <TouchableOpacity
//                   style={styles.actionButton}
//                   onPress={restoreSelected}
//                 >
//                   <StyledText style={styles.actionText}>Restore</StyledText>
//                 </TouchableOpacity>
//                 <TouchableOpacity
//                   style={styles.actionButton}
//                   onPress={deleteSelectedPermanently}
//                 >
//                   <StyledText style={styles.actionText}>Delete</StyledText>
//                 </TouchableOpacity>
//               </View>
//             )}
//           </>
//         )}

//         {/* Floating Action Button to Import Files */}
//         <TouchableOpacity style={styles.fab}>
//           {/* <Icon filter={1} source={icons.add} height={20} width={20} /> */}
//         </TouchableOpacity>

//         {/* Action Modal */}
//         <Modal
//           animationType="fade"
//           transparent={true}
//           visible={modalVisible}
//           onRequestClose={() => setModalVisible(false)}
//         >
//           <View style={styles.modalOverlay}>
//             <View style={styles.modalContent}>
//               <StyledText style={styles.modalTitle}>
//                 {activeItem?.name}
//               </StyledText>
//               <TouchableOpacity
//                 style={styles.modalButton}
//                 onPress={restoreItem}
//               >
//                 <StyledText style={styles.modalButtonText}>Restore</StyledText>
//               </TouchableOpacity>
//               <TouchableOpacity
//                 style={styles.modalButton}
//                 onPress={deletePermanently}
//               >
//                 <StyledText style={styles.modalButtonText}>
//                   Delete Permanently
//                 </StyledText>
//               </TouchableOpacity>
//               <TouchableOpacity
//                 style={styles.modalButton}
//                 onPress={() => setModalVisible(false)}
//               >
//                 <StyledText style={styles.modalButtonText}>Cancel</StyledText>
//               </TouchableOpacity>
//             </View>
//           </View>
//         </Modal>
//       </View>
//     </LinearGradient>
//   );
// };

// export default RecycleBin;

// const RecycleBinStyles = (colorScheme: "dark" | "light") =>
//   StyleSheet.create({
//     container: {
//       flex: 1,
//       padding: 16,
//     },
//     list: {
//       paddingBottom: 16,
//     },
//     itemContainer: {
//       flexDirection: "row",
//       alignItems: "center",
//       backgroundColor: Colors[colorScheme].itemBackground,
//       padding: 12,
//       marginVertical: 4,
//       borderRadius: 8,
//       elevation: 2,
//     },
//     selectedItem: {
//       borderWidth: 2,
//       borderColor: Colors[colorScheme].tint,
//     },
//     itemTextContainer: {
//       flex: 1,
//       marginLeft: 12,
//     },
//     itemName: {
//       fontSize: 16,
//       fontWeight: "600",
//       color: Colors[colorScheme].text,
//     },
//     itemDetails: {
//       fontSize: 12,
//       color: Colors[colorScheme].tint,
//     },
//     trashedTag: {
//       fontSize: 12,
//       color: Colors[colorScheme].text,
//       fontWeight: "bold",
//     },
//     emptyText: {
//       fontSize: 16,
//       textAlign: "center",
//       marginTop: 50,
//       color: Colors[colorScheme].text,
//     },
//     errorText: {
//       fontSize: 16,
//       textAlign: "center",
//       marginTop: 50,
//       color: Colors[colorScheme].text,
//     },
//     selectionActions: {
//       flexDirection: "row",
//       justifyContent: "space-around",
//       padding: 16,
//       backgroundColor: Colors[colorScheme].background,
//       borderTopWidth: 1,
//       borderTopColor: Colors[colorScheme].border,
//     },
//     actionButton: {
//       padding: 12,
//       borderRadius: 8,
//       backgroundColor: Colors[colorScheme].tint,
//     },
//     actionText: {
//       color: Colors[colorScheme].background,
//       fontWeight: "600",
//     },
//     modalOverlay: {
//       flex: 1,
//       backgroundColor: "rgba(0,0,0,0.5)",
//       justifyContent: "center",
//       alignItems: "center",
//     },
//     modalContent: {
//       backgroundColor: Colors[colorScheme].background,
//       padding: 20,
//       borderRadius: 12,
//       width: "80%",
//       alignItems: "center",
//     },
//     modalTitle: {
//       fontSize: 18,
//       fontWeight: "600",
//       marginBottom: 20,
//       color: Colors[colorScheme].text,
//     },
//     modalButton: {
//       padding: 12,
//       width: "100%",
//       alignItems: "center",
//       marginVertical: 8,
//       borderRadius: 8,
//       backgroundColor: Colors[colorScheme].itemBackground,
//     },
//     modalButtonText: {
//       fontSize: 16,
//       color: Colors[colorScheme].text,
//     },
//     fab: {
//       position: "absolute",
//       bottom: 16,
//       right: 16,
//       backgroundColor: Colors[colorScheme].tint,
//       borderRadius: 28,
//       width: 56,
//       height: 56,
//       alignItems: "center",
//       justifyContent: "center",
//       elevation: 4,
//     },
//     filterContainer: {
//       flexDirection: "row",
//       justifyContent: "flex-end",
//       marginBottom: 16,
//     },
//     filterButton: {
//       paddingVertical: 8,
//       paddingHorizontal: 16,
//       borderRadius: 20,
//       backgroundColor: Colors[colorScheme].itemBackground,
//     },
//     filterButtonActive: {
//       backgroundColor: Colors[colorScheme].tint,
//     },
//     filterText: {
//       fontSize: 14,
//       color: Colors[colorScheme].text,
//     },
//     filterTextActive: {
//       color: Colors[colorScheme].background,
//       fontWeight: "600",
//     },
//   });
