import { Modal, Text, TextInput, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import RNFS from "react-native-fs";

import { useTheme } from "../../hooks/ThemeProvider";
import { FilesListStyles } from "../../constants/Styles";
import { Toast } from "../Toasts";
import DropShareModal from "../ui/Modal";
import StyledText from "../ui/StyledText";

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
        Toast("Namae the folder first");
      } else if (folderExists) {
        Toast(`Folder "${folderName}" already exists.`);
      } else {
        await RNFS.mkdir(newFolder);
        Toast(`Folder "${folderName}" created successfully.`);
        setCreateVisible(false);
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
    <DropShareModal visible={createVisible} onRequestClose={() => closeModal()}>
      <View style={styles.modal}>
        <View style={styles.editContainer}>
          <TextInput
            value={folderName}
            onChangeText={(text) => setFolderName(text)}
            style={styles.input}
            placeholderTextColor="#bbb"
            placeholder="Enter file name"
          />
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={() => closeModal()}>
              <StyledText
                text="Cancel"
                fontSize={22}
                style={styles.modalbutton}
                fontWeight="bold"
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleCreate()}>
              <StyledText
                text="Create"
                fontSize={22}
                style={styles.modalbutton}
                fontWeight="bold"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </DropShareModal>
  );
};

export default CreateFolder;
