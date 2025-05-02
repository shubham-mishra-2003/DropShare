import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
} from "react-native";
import { Colors } from "../../constants/Colors";
import { useTheme } from "../../hooks/ThemeProvider";
import Icon from "../Icon";
import { icons } from "../../assets";
import StyledText from "../ui/StyledText";
import { goBack } from "../../utils/NavigationUtil";
import { fileOperations } from "../../utils/FileSystemUtil";
import useSelectFile from "../../hooks/useSelectFile";
import RNFS from "react-native-fs";
import { useEffect, useRef, useState } from "react";
import DropShareModal from "../ui/Modal";

const FilesHeader = ({
  heading,
  showOptions,
  setShowOptions,
  onPressInput = goBack,
}: {
  heading: string;
  showOptions?: boolean;
  setShowOptions?: (showOptions: boolean) => void;
  onPressInput?: () => void;
}) => {
  const { handleCopy, handleDelete, handleInfo, handleMove, handleMoveToSafe } =
    fileOperations();
  const [showMenu, setShowMenu] = useState(false);
  const [newName, setNewName] = useState("");
  const { selectedFiles, setSelectedFiles } = useSelectFile();
  const [showDropShareModal, setShowDropShareModal] = useState(false);

  const options = [
    {
      title: "Copy",
      action: () => {},
      //   handleCopy({
      //     selectedFiles,
      //     setSelectedFiles,
      //     destinationPath: RNFS.ExternalStorageDirectoryPath,
      //   }),
    },
    {
      title: "Move",
      action: () => {},
      //   handleMove({
      //     selectedFiles,
      //     setSelectedFiles,
      //     destinationPath: RNFS.ExternalStorageDirectoryPath,
      //   }),
    },
    {
      title: "Delete",
      action: () => {},
      // action: () => handleDelete({ selectedFiles, setSelectedFiles }),
    },
    {
      title: "Rename",
      action: () => {
        setShowDropShareModal(true);
        setShowOptions?.(false);
      },
    },
    {
      title: "Move to Safe",
      action: () => {},
      // handleMoveToSafe({
      //   selectedFiles,
      //   setSelectedFiles,
      // }),
    },
    {
      title: "Info",
      action: () => {},
    },
  ];

  const { colorScheme } = useTheme();
  const styles = FilesHeaderStyles(colorScheme);
  return (
    <View
      style={{
        padding: 10,
        backgroundColor: Colors[colorScheme].background,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <TouchableOpacity
        style={{ padding: 5, position: "absolute", left: 15 }}
        onPress={onPressInput}
      >
        <Icon filter={1} height={20} width={20} source={icons.back} />
      </TouchableOpacity>
      <StyledText
        style={{ alignSelf: "center" }}
        text={heading}
        fontWeight="bold"
        fontSize={24}
      />
      {showOptions && (
        <TouchableOpacity
          style={{ padding: 5, position: "absolute", right: 15 }}
          onPress={() => setShowMenu(!showMenu)}
        >
          <Icon filter={1} height={20} width={20} source={icons.options} />
        </TouchableOpacity>
      )}
      {showMenu && (
        <View style={styles.optionsContainer}>
          {options.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={{
                padding: 20,
                backgroundColor: Colors[colorScheme].background,
                borderRadius: 50,
                borderWidth: 2,
                borderColor: Colors[colorScheme].border,
              }}
              onPress={() => {
                item.action();
                setShowOptions?.(false);
              }}
            >
              <StyledText
                style={{
                  color: colorScheme === "dark" ? "#fff" : "#000",
                  fontSize: 18,
                  textAlign: "center",
                }}
                text={item.title}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <DropShareModal
        visible={showDropShareModal}
        animationType="fade"
        onRequestClose={() => setShowDropShareModal(false)}
      >
        <View
          style={{
            justifyContent: "center",
            alignItems: "center",
            flex: 1,
          }}
        >
          <View style={styles.modalContainer}>
            <StyledText text="Rename" fontWeight="bold" fontSize={24} />
            <TextInput
              style={{
                width: "100%",
                borderWidth: 1,
                borderColor: Colors[colorScheme].tint,
                padding: 10,
                paddingHorizontal: 20,
                borderRadius: 50,
                color: Colors[colorScheme].text,
                fontSize: 18,
                fontWeight: "bold",
                height: 60,
              }}
              placeholder="Enter new name"
              placeholderTextColor={Colors[colorScheme].text}
              value={newName}
              onChangeText={(text) => setNewName(text)}
            />
            <View
              style={{
                gap: 10,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "flex-end",
                width: "100%",
              }}
            >
              <TouchableOpacity
                style={{
                  backgroundColor: Colors[colorScheme].tint,
                  paddingHorizontal: 25,
                  paddingVertical: 10,
                  borderRadius: 50,
                }}
                onPress={() => {
                  setShowDropShareModal(false);
                }}
              >
                <StyledText text="Cancel" fontWeight="bold" fontSize={20} />
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor: Colors[colorScheme].tint,
                  paddingHorizontal: 25,
                  paddingVertical: 10,
                  borderRadius: 50,
                }}
              >
                <StyledText text="Rename" fontWeight="bold" fontSize={20} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </DropShareModal>
    </View>
  );
};

export default FilesHeader;

const FilesHeaderStyles = (colorScheme: "light" | "dark") =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: Colors[colorScheme].background,
    },
    left: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    optionsContainer: {
      position: "absolute",
      top: 60,
      right: 15,
      backgroundColor: Colors[colorScheme].itemBackground,
      borderRadius: 20,
      zIndex: 1000,
      width: 230,
      padding: 10,
      gap: 5,
    },
    modalContainer: {
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
      borderRadius: 20,
      backgroundColor: Colors[colorScheme].background,
      borderWidth: 2,
      borderColor: Colors[colorScheme].border,
      width: "85%",
      gap: 20,
    },
  });
