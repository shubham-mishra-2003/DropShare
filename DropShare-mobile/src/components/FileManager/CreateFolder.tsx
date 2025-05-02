import {
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import React, { useState } from "react";
import RNFS from "react-native-fs";

import { useTheme } from "../../hooks/ThemeProvider";
import { FilesListStyles } from "../../constants/Styles";
import { Toast } from "../Toasts";
import DropShareModal from "../ui/Modal";
import StyledText from "../ui/StyledText";
import { Colors } from "../../constants/Colors";

interface FileCreateProps {
  createVisible: boolean;
  setCreateVisible: (value: boolean) => void;
  path: string;
}

const CreateFolder = ({
  createVisible,
  setCreateVisible,
  path,
}: FileCreateProps) => {
  const { colorScheme } = useTheme();
  const styles = FilesListStyles(colorScheme);
  const [folderName, setFolderName] = useState("");

  const handleCreate = async () => {
    try {
      const newFolder = `${path}/${folderName}`;
      const folderExists = await RNFS.exists(newFolder);
      if (folderName == "") {
        Toast("Name the folder first");
      } else if (folderExists) {
        Toast(`Folder "${folderName}" already exists.`);
      } else {
        await RNFS.mkdir(newFolder);
        Toast(`Folder "${folderName}" created successfully.`);
        setCreateVisible(false);
        setFolderName("");
        Vibration.vibrate(50);
      }
    } catch (error) {
      Toast(`Error creating folder: ${error}`);
    }
  };

  const closeModal = () => {
    setCreateVisible(false);
    setFolderName("");
  };

  return (
    <DropShareModal
      animationType="fade"
      visible={createVisible}
      onRequestClose={() => closeModal()}
    >
      <View style={{ justifyContent: "center", alignItems: "center", flex: 1 }}>
        <View style={styles.modal}>
          <StyledText text="Create Folder" fontWeight="bold" fontSize={24} />
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
            placeholder="Enter folder name"
            placeholderTextColor={Colors[colorScheme].text}
            value={folderName}
            onChangeText={(text) => setFolderName(text)}
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
                closeModal();
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
              onPress={() => {
                handleCreate();
              }}
            >
              <StyledText text="Create" fontWeight="bold" fontSize={20} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </DropShareModal>
  );
};

export default CreateFolder;
