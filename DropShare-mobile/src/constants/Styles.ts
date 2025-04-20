import { StyleSheet } from "react-native";
import { Colors } from "./Colors";
import { screenHeight, screenWidth } from "../utils/Constants";

export const splashScreenStyles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  logo: {
    width: 250,
    height: 250,
  },
  splashText: {
    marginTop: 20,
  },
});

export const headerStyles = (colorScheme: "light" | "dark") =>
  StyleSheet.create({
    header: {
      paddingHorizontal: 2,
      backgroundColor: Colors[colorScheme].background,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      minHeight: 60,
      width: "100%",
    },
    iconContainer: {
      position: "absolute",
      left: 5,
      zIndex: 10,
      padding: 10,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    logo: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      flex: 1,
      overflow: "hidden",
      gap: 5,
    },
    image: {
      height: 50,
      width: 50,
    },
    logoName: {
      fontSize: 24,
      color: Colors[colorScheme].text,
    },
    optionsContainer: {
      position: "absolute",
      top: 50,
      right: 10,
      backgroundColor: Colors[colorScheme].background,
      padding: 10,
      gap: 10,
      borderRadius: 20,
    },
    options: {
      backgroundColor: Colors[colorScheme].itemBackground,
      padding: 15,
      borderRadius: 20,
    },
  });

export const logoHeadStyles = (colorScheme: "light" | "dark") =>
  StyleSheet.create({
    main: {
      flex: 1,
      backgroundColor: Colors[colorScheme].background,
    },
  });

export const filesStyle = (colorScheme: "light" | "dark") =>
  StyleSheet.create({
    mainView: {
      flex: 1,
      justifyContent: "space-between",
    },
    inputView: {
      flexDirection: "row",
      backgroundColor: Colors[colorScheme].itemBackground,
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      borderRadius: 20,
      height: 45,
    },
    input: {
      flex: 1,
      fontSize: 20,
      textAlignVertical: "bottom",
      height: "100%",
    },
    card: {
      padding: 20,
      backgroundColor: Colors[colorScheme].transparent,
      borderRadius: 20,
      justifyContent: "space-between",
      gap: 15,
    },
    storageInfo: {
      gap: 10,
    },
    divider: {
      margin: 10,
      width: 2,
      backgroundColor: Colors[colorScheme].text,
    },
    Bar: {
      backgroundColor: Colors[colorScheme].itemBackground,
      height: 26,
      borderRadius: 50,
      overflow: "hidden",
    },
    categoriesContainer: {
      flex: 1,
      gap: 10,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      alignItems: "center",
    },
    categoryCard: {
      height: screenWidth / 3.5,
      width: screenWidth / 3.5,
      borderRadius: 15,
      backgroundColor: Colors[colorScheme].transparent,
      justifyContent: "space-between",
      padding: 10,
      alignItems: "center",
      flexDirection: "column",
    },
  });

export const loadingStyles = (colorScheme: "light" | "dark") =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 20,
      backgroundColor: Colors[colorScheme].background,
    },
    image: {
      height: 150,
      width: 160,
    },
    text: {
      color: Colors[colorScheme].text,
      fontSize: 25,
    },
  });

export const ModeSwitchStyles = (colorScheme: "light" | "dark") =>
  StyleSheet.create({
    button: {
      borderWidth: 1.5,
      borderRadius: 50,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: 4,
      backgroundColor: Colors[colorScheme].background,
      borderColor: Colors[colorScheme].tint,
    },
    image: {
      filter: colorScheme === "dark" ? "invert(1)" : "invert(0)",
      height: 20,
      width: 20,
    },
    dropdown: {
      backgroundColor: Colors[colorScheme].background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: Colors[colorScheme].border,
      position: "absolute",
      top: 50,
      right: 5,
      zIndex: 100,
      elevation: 100,
      padding: 5,
    },
    option: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 20,
      padding: 7,
      paddingHorizontal: 10,
      borderRadius: 10,
    },
  });

export const FilesIconStyles = (colorScheme: "light" | "dark") =>
  StyleSheet.create({
    view: {
      flex: 1,
      backgroundColor: Colors[colorScheme].border,
      borderRadius: 10,
      padding: 10,
      gap: 10,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 35,
    },
    card: {
      padding: 10,
      borderRadius: 10,
      borderColor: Colors[colorScheme].border,
      borderWidth: 2,
      gap: 10,
      justifyContent: "center",
      alignItems: "center",
      height: 95,
      width: 95,
    },
    icon: {
      height: 30,
      width: 30,
      filter: colorScheme === "dark" ? "invert(1)" : "",
    },
    title: {
      color: Colors[colorScheme].text,
      fontSize: 12,
      fontWeight: "bold",
    },
  });

export const IconsStyles = (
  colorScheme: "light" | "dark",
  width: number,
  height: number,
  filter: number
) =>
  StyleSheet.create({
    icon: {
      height: height,
      width: width,
      filter: colorScheme === "dark" ? `invert(${filter})` : "",
    },
  });

export const sidebarStyles = (colorScheme: "light" | "dark") =>
  StyleSheet.create({
    view: {
      flex: 1,
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    },
    text: {
      fontSize: 20,
    },
    sidebar: {
      position: "absolute",
      top: 0,
      left: 0,
      height: "100%",
      backgroundColor: Colors[colorScheme].background,
      justifyContent: "center",
      zIndex: 100,
      borderTopEndRadius: 20,
      borderEndEndRadius: 20,
    },
    overlay: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    logo: {
      alignItems: "center",
      gap: 10,
      padding: 10,
      flexDirection: "row",
      justifyContent: "center",
    },
    optionsContainer: {
      gap: 20,
      flex: 1,
      paddingHorizontal: 20,
      paddingVertical: 10,
      marginTop: 10,
      alignItems: "flex-start",
    },
    options: {
      gap: 20,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Colors[colorScheme].transparent,
      width: "100%",
      padding: 20,
      borderRadius: 32,
      borderWidth: 1,
      borderColor: Colors[colorScheme].tint,
    },
    footer: {
      flexDirection: "row",
      gap: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    footerButton: {
      justifyContent: "center",
      alignItems: "center",
    },
    dot: {
      height: 10,
      width: 10,
      borderRadius: "50%",
      backgroundColor: Colors[colorScheme].text,
    },
  });

export const FilesListStyles = (colorScheme: "light" | "dark") =>
  StyleSheet.create({
    view: {
      flex: 1,
      backgroundColor: Colors[colorScheme].background,
    },
    fileAddbtn: {
      backgroundColor: Colors[colorScheme].tint,
      position: "absolute",
      bottom: 35,
      right: 35,
      padding: 10,
      borderRadius: "50%",
      height: 55,
      width: 55,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#fff",
      boxShadow: `0px 0px 10px ${Colors[colorScheme].tint}`,
    },
    modal: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    editContainer: {
      backgroundColor: Colors[colorScheme].itemBackground,
      padding: 15,
      borderRadius: 30,
      gap: 10,
      width: "80%",
      justifyContent: "space-between",
      borderWidth: 2,
      borderColor: Colors[colorScheme].border,
      boxShadow: `0px 0px 5px ${Colors[colorScheme].tint}`,
    },
    input: {
      color: Colors[colorScheme].text,
      fontWeight: "bold",
      fontSize: 20,
      borderBottomWidth: 2,
      borderColor: Colors[colorScheme].text,
      borderRadius: 25,
      padding: 20,
      borderWidth: 1,
    },
    buttonContainer: {
      flexDirection: "row",
      gap: 10,
      alignItems: "center",
      justifyContent: "flex-end",
    },
    modalbutton: {
      color: Colors[colorScheme].text,
      backgroundColor: Colors[colorScheme].tint,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
      textAlign: "center",
    },
  });

export const FilesStyles = (colorScheme: "light" | "dark") =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors[colorScheme].background },
    scrollContainer: {
      flexGrow: 1,
    },
    filesView: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    fileItem: {
      width: "100%",
      height: 65,
      borderRadius: 10,
      backgroundColor: Colors[colorScheme].transparent,
      gap: 10,
      flexDirection: "row",
      padding: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    image: {
      resizeMode: "cover",
      borderRadius: 7,
      width: "18%",
      height: "100%",
    },
    textView: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      overflow: "hidden",
      gap: 10,
    },
    dynamicIcon: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      top: 0,
      backgroundColor: "rgba(0, 0, 0, 0.4)",
      justifyContent: "flex-end",
      alignItems: "flex-end",
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

export const FilesViewerStyles = (colorScheme: "light" | "dark") =>
  StyleSheet.create({
    container: {
      flex: 1,
      width: "100%",
    },
    fileName: {
      color: "#fff",
      fontSize: 16,
      width: 200,
    },
    content: {
      flex: 1,
      paddingBottom: 20,
    },
    image: {
      height: "100%",
      width: "100%",
      borderRadius: 10,
      resizeMode: "contain",
    },
    audioContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    audioImage: {
      width: "100%",
      height: "100%",
      tintColor: "#fff",
    },
    unsupportedText: {
      color: "#bbb",
      fontSize: 16,
      marginTop: 20,
    },
  });

export const nearByDevicesStyles = (colorScheme: "dark" | "light") =>
  StyleSheet.create({
    modalView: {
      flex: 1,
      alignItems: "center",
      justifyContent: "flex-start",
      gap: 5,
      width: "100%",
    },
    username: {
      fontSize: 20,
      color: Colors[colorScheme].text,
      textAlign: "center",
      marginTop: 10,
    },
    connectbtn: {
      padding: 15,
      borderRadius: 25,
      backgroundColor: Colors[colorScheme].tint,
      marginTop: 20,
    },
    logo: {
      height: 100,
      width: 100,
      marginTop: 20,
    },
    shareButton: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 15,
      backgroundColor: Colors[colorScheme].tint,
      padding: 15,
      borderRadius: 50,
      marginHorizontal: 40,
      marginVertical: 5,
    },
    shareText: {
      color: Colors[colorScheme].text,
      fontSize: 28,
    },
    deviceListView: {
      width: "100%",
      flex: 1,
      gap: 10,
      alignItems: "center",
      justifyContent: "space-between",
    },
    deviceList: {
      flexDirection: "row",
      padding: 20,
      borderRadius: 20,
      gap: 20,
      overflow: "hidden",
    },
    deviceName: {
      color: Colors[colorScheme].text,
      fontSize: 18,
    },
  });

export const connectionStyles = (colorScheme: "dark" | "light") =>
  StyleSheet.create({
    main: {
      flex: 1,
      padding: 15,
      gap: 10,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    headerButton: {
      padding: 10,
    },
    fileContainer: {
      flex: 1,
      backgroundColor: Colors[colorScheme].transparent,
      padding: 10,
      borderRadius: 20,
      height: 400,
    },
    sendReceiveContainer: {
      flexDirection: "row",
      justifyContent: "center",
    },
    selectedFileButtonContainer: {
      flexDirection: "row",
      gap: 10,
    },
    sendReceiveButton: {
      flexDirection: "row",
      gap: 5,
      padding: 10,
      borderRadius: 20,
      alignItems: "center",
      width: 140,
      height: 50,
      justifyContent: "center",
    },
    fileItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      padding: 10,
      backgroundColor: Colors[colorScheme].transparent,
      borderRadius: 10,
    },
    selectedFileContainer: {
      flex: 1,
      marginTop: 20,
      backgroundColor: Colors[colorScheme].transparent,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingBottom: 10,
      borderRadius: 20,
      height: 400,
    },
    selectedFileItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 10,
      backgroundColor: Colors[colorScheme].transparent,
      borderRadius: 10,
    },
    messageButton: {
      position: "absolute",
      bottom: 60,
      right: 20,
      padding: 15,
      backgroundColor: Colors[colorScheme].tint,
      borderRadius: 50,
      justifyContent: "center",
      alignItems: "center",
    },
  });

export const ClientScreenStyles = (colorScheme: "dark" | "light") =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors[colorScheme].background,
      padding: 10,
    },
    mainContainer: {
      flex: 1,
      alignItems: "center",
      gap: 5,
    },
    deviceDot: {
      position: "absolute",
      justifyContent: "center",
      alignItems: "center",
    },
    popup: {
      justifyContent: "center",
      alignItems: "center",
    },
    deviceImage: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: "#fff",
    },
    deviceText: {
      textAlign: "center",
      paddingVertical: 2,
      paddingHorizontal: 5,
      borderRadius: 10,
      maxWidth: 140,
    },
    animationContainer: {
      width: "100%",
      justifyContent: "center",
      alignItems: "center",
      height: screenWidth,
    },
    lottieContainer: {
      position: "absolute",
      zIndex: 4,
      width: "100%",
      height: "100%",
      alignSelf: "center",
    },
    lottie: {
      width: "100%",
      height: "100%",
    },
    profileImage: {
      height: 50,
      width: 50,
      resizeMode: "cover",
      borderRadius: 100,
      zIndex: 5,
      marginTop: 5,
    },
    qrButton: {
      backgroundColor: Colors[colorScheme].tint,
      padding: 15,
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
      borderRadius: 40,
      width: 200,
    },
    backButton: {
      position: "absolute",
      padding: 10,
    },
    infoContainer: {
      marginTop: 40,
      justifyContent: "center",
      alignItems: "center",
      gap: 10,
    },
    title: {
      color: Colors[colorScheme].text,
      fontSize: 20,
      textAlign: "center",
      fontWeight: "bold",
    },
    subtitle: {
      color: Colors[colorScheme].text,
      fontSize: 20,
      textAlign: "center",
      opacity: 0.6,
    },
  });

export const ShareScreenStyles = (colorScheme: "dark" | "light") =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors[colorScheme].background,
      padding: 10,
    },
    mainContainer: {
      flex: 1,
      alignItems: "center",
      gap: 5,
    },
    backButton: {
      position: "absolute",
      padding: 10,
    },
    infoContainer: {
      marginTop: 40,
      justifyContent: "center",
      alignItems: "center",
      gap: 10,
    },
    animationContainer: {
      width: "100%",
      justifyContent: "center",
      alignItems: "center",
      height: screenWidth,
    },
    lottieContainer: {
      position: "absolute",
      zIndex: 4,
      width: "100%",
      height: "100%",
      alignSelf: "center",
    },
    lottie: {
      width: "100%",
      height: "100%",
    },
    profileImage: {
      height: 50,
      width: 50,
      resizeMode: "cover",
      borderRadius: 100,
      zIndex: 5,
      marginTop: 5,
    },
    qrButton: {
      backgroundColor: Colors[colorScheme].tint,
      padding: 15,
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
      borderRadius: 40,
      width: 200,
      boxShadow: `0px 0px 20px ${Colors[colorScheme].tint}`,
    },
  });
