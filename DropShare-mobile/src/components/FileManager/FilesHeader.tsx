import { View, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import { Colors } from "../../constants/Colors";
import { useTheme } from "../../hooks/ThemeProvider";
import Icon from "../Icon";
import { icons } from "../../assets";
import StyledText from "../ui/StyledText";
import { goBack } from "../../utils/NavigationUtil";
import { fileOperations } from "../../utils/FileSystemUtil";
import useSelectFile from "../../hooks/useSelectFile";
import RNFS from "react-native-fs";

const FilesHeader = ({
  heading,
  showOptions,
  setShowOptions,
}: {
  heading: string;
  showOptions: boolean;
  setShowOptions: (showOptions: boolean) => void;
}) => {
  const { handleCopy, handleDelete, handleInfo, handleMove, handleMoveToSafe } =
    fileOperations();

  const { selectedFiles, setSelectedFiles } = useSelectFile();

  const options = [
    {
      title: "Copy",
      action: () =>
        handleCopy({
          selectedFiles,
          setSelectedFiles,
          destinationPath: RNFS.ExternalStorageDirectoryPath,
        }),
    },
    {
      title: "Move",
      action: () =>
        handleMove({
          selectedFiles,
          setSelectedFiles,
          destinationPath: RNFS.ExternalStorageDirectoryPath,
        }),
    },
    {
      title: "Delete",
      action: () => handleDelete({ selectedFiles, setSelectedFiles }),
    },
    {
      title: "Move to Safe",
      action: () =>
        handleMoveToSafe({
          selectedFiles,
          setSelectedFiles,
        }),
    },
    {
      title: "Info",
      action: () => handleInfo({ selectedFiles, setSelectedFiles }),
    },
  ];

  const { colorScheme } = useTheme();
  const styles = FilesHeaderStyles(colorScheme);
  return (
    <View
      style={{
        padding: 15,
        backgroundColor: Colors[colorScheme].background,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <TouchableOpacity onPress={goBack}>
        <Icon filter={1} height={20} width={20} source={icons.back} />
      </TouchableOpacity>
      <StyledText text={heading} fontWeight="bold" fontSize={24} />
      <View>
        <TouchableOpacity
          style={{
            padding: 5,
            borderRadius: 10,
          }}
          onPress={() => setShowOptions(!showOptions)}
        >
          <Icon filter={1} height={20} width={20} source={icons.options} />
        </TouchableOpacity>
        <View style={{ display: showOptions ? "flex" : "none" }}>
          {showOptions && (
            <FlatList
              style={styles.optionsContainer}
              contentContainerStyle={{
                gap: 5,
              }}
              data={options}
              keyExtractor={(item) => item.title}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{
                    padding: 20,
                    backgroundColor: Colors[colorScheme].background,
                    borderRadius: 50,
                  }}
                  onPress={() => {
                    item.action();
                    setShowOptions(false);
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
              )}
            />
          )}
        </View>
      </View>
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
      top: 20,
      right: 0,
      backgroundColor: Colors[colorScheme].itemBackground,
      borderRadius: 20,
      elevation: 4,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      zIndex: 1000,
      width: 200,
      padding: 8,
      borderWidth: 1,
    },
  });
