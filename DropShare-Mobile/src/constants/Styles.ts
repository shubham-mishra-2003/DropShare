import { StyleSheet } from "react-native";
import { Colors } from "./Colors";

export const splashScreenStyles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.dark.background,
  },
  logo: {
    width: 250,
    height: 250,
  },
  splashText: {
    marginTop: 20,
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFF",
  },
});

export const headerStyles = (colorScheme: "light" | "dark") =>
  StyleSheet.create({
    header: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      backgroundColor: Colors[colorScheme].itemBackground,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      minHeight: 60,
      width: '100%'
    },
    iconContainer: {
      padding: 10,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    logo: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      flex: 1,
    },
    image: {
      height: 50,
      width: 50,
    },
    headText: {
      fontSize: 20,
      color: Colors[colorScheme].text,
    },
    optionsContainer: {
      position: 'absolute',
      top: 50,
      right: 10,
      backgroundColor: Colors[colorScheme].background,
      padding: 10,
      gap: 10,
      borderRadius: 20
    },
    options: {
      backgroundColor: Colors[colorScheme].itemBackground,
      padding: 15,
      borderRadius: 20
    },
    text: {
      color: "#fff",
      fontSize: 16,
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
    heading: {
      fontSize: 40,
      color: Colors[colorScheme].text,
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
      color: Colors[colorScheme].text,
      fontWeight: "bold",
      flex: 1,
      fontSize: 17,
      textAlignVertical: 'bottom',
      height: '100%'
    },
    card: {
      padding: 15,
      backgroundColor: Colors[colorScheme].itemBackground,
      borderRadius: 20,
      height: 170,
      justifyContent: "space-between",
    },
    cardText: {
      color: Colors[colorScheme].text,
      fontSize: 25,
    },
    storageInfo: {
      gap: 10,
    },
    remainingStorage: {
      color: Colors[colorScheme].text,
      fontSize: 20,
    },
    divider: {
      margin: 10,
      width: 2,
      backgroundColor: Colors[colorScheme].text,
    },
    totalStorage: {
      fontSize: 28,
      color: Colors[colorScheme].text,
    },
    Bar: {
      backgroundColor: Colors[colorScheme].background,
      height: 26,
      borderRadius: 50,
      overflow: 'hidden'
    },
    categoriesContainer: {
      flex: 1,
      gap: 10,
      flexDirection: "row",
      flexWrap: "wrap",
      padding: 10,
    },
    categoryCard: {
      height: 100,
      width: 100,
      borderRadius: 15,
      backgroundColor: Colors[colorScheme].itemBackground,
      justifyContent: "space-between",
      padding: 10,
      alignItems: "center",
      flexDirection: "column",
    },
    categoryText: {
      fontSize: 12,
      color: Colors[colorScheme].text,
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
      borderColor: Colors[colorScheme].border,
      position: "absolute",
      right: 5,
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
      top: 45,
      right: 0,
      zIndex: 100,
      elevation: 100,
      padding: 4,
      gap: 5,
    },
    option: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 15,
      padding: 7,
      paddingHorizontal: 10,
      borderRadius: 10,
    },
    optionText: {
      fontSize: 16,
      color: Colors[colorScheme].text,
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
      width: "80%",
      backgroundColor: Colors[colorScheme].transparent,
      justifyContent: "center",
      zIndex: 100,
      borderTopEndRadius: 20,
      borderEndEndRadius: 20,
      paddingBottom: 15,
      paddingTop: 7,
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
    },
    logoText: {
      fontSize: 15,
      color: Colors[colorScheme].text,
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
      backgroundColor: Colors[colorScheme].background,
      width: "100%",
      padding: 12,
      borderRadius: 10,
    },
    optionsText: {
      fontFamily: "sans-serif",
      fontSize: 15,
      color: Colors[colorScheme].text,
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
    footerText: {
      color: Colors[colorScheme].text,
      fontSize: 13,
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
      justifyContent: 'center',
      alignItems: 'center'
    },
    editContainer: {
      backgroundColor: Colors[colorScheme].transparent,
      padding: 20,
      borderRadius: 20,
      gap: 20,
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
      borderRadius: 10,
      padding: 15,
      borderWidth: 1,
    },
    buttonContainer: {
      flexDirection: "row",
      gap: 20,
      alignItems: "center",
      justifyContent: "flex-end",
    },
    modalbutton: {
      color: Colors[colorScheme].text,
      fontSize: 18,
    },
  });


export const FilesStyles = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors[colorScheme].background },
  scrollContainer: {
    flexGrow: 1,
  },
  filesView: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    padding: 10,
  },
  fileItem: {
    width: 105,
    height: 105,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    backgroundColor: Colors[colorScheme].transparent,
    gap: 5,
    position: 'relative'
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: "cover",
    borderRadius: 7,
  },
  textView: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    padding: 5
  },
  text: {
    fontSize: 13,
    textAlign: "right",
    color: Colors[colorScheme].text,
    fontWeight: 'bold',
  },
  dynamicIcon: {
    position: 'absolute',
    right: -5,
    bottom: -5,
    backgroundColor: Colors[colorScheme].tint,
    padding: 5,
    borderRadius: '50%',
    justifyContent: 'center',
    alignItems: 'center'
  }
});


export const FilesViewerStyles = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    width: '100%'
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
    height: '100%',
    width: '100%',
    borderRadius: 10,
    resizeMode: 'contain'
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
})


export const nearByDevicesStyles = (colorScheme: "dark" | "light") => StyleSheet.create({
  modalView: {
    flex: 1,
    backgroundColor: Colors[colorScheme].background,
    alignItems: "center",
    gap: 5,
    width: '100%'
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
    padding: 20,
    borderRadius: 50,
    marginHorizontal: 35,
    marginVertical: 5
  },
  shareText: {
    color: Colors[colorScheme].text,
    fontSize: 24,
  },
  deviceListView: {
    width: '100%',
    flex: 1,
    gap: 10,
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  deviceList: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 20,
    gap: 20,
    overflow: 'hidden'
  },
  deviceName: {
    color: Colors[colorScheme].text,
    fontSize: 18,
  }
})