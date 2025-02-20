import { StyleSheet } from 'react-native';
import { Colors } from './Colors';

export const splashScreenStyles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 250,
    height: 250,
  },
  splashText: {
    marginTop: 20,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
});

export const headerStyles = (colorScheme: 'light' | 'dark') =>
  StyleSheet.create({
    header: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      backgroundColor: Colors[colorScheme].background,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 60,
    },
    iconContainer: {
      padding: 10,
      borderRadius: 10,
      position: 'absolute',
      justifyContent: 'center',
      alignItems: 'center',
      left: 5,
    },
    logo: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      flex: 1,
    },
    image: {
      height: 50,
      width: 50,
    },
    text: {
      fontSize: 20,
      color: Colors[colorScheme].text,
    },
  });

export const logoHeadStyles = (colorScheme: 'light' | 'dark') =>
  StyleSheet.create({
    main: {
      flex: 1,
      backgroundColor: Colors[colorScheme].background,
    },
  });

export const tabBarStyles = (colorScheme: 'light' | 'dark') =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      paddingBottom: 10,
    },
    view: {
      flex: 1,
      padding: 15,
    },
    bar: {
      flexDirection: 'row',
      borderRadius: 35,
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingLeft: 5,
      paddingRight: 5,
      backgroundColor: Colors[colorScheme].background,
      gap: 20,
      boxShadow: `0px 0px 20px ${Colors[colorScheme].tint}`,
    },
    barSwitch: {
      position: 'relative',
      justifyContent: 'center',
      alignItems: 'center',
      flex: 1,
      padding: 10,
      gap: 5,
    },
    indicator: {
      position: 'absolute',
      top: 5,
      left: 5,
      right: 5,
      bottom: 5,
      width: 'auto',
      backgroundColor: Colors[colorScheme].tint,
      borderRadius: 30,
    },
    label: {
      color: Colors[colorScheme].text,
    },
    image: {
      height: 30,
      width: 35,
      filter: colorScheme === 'dark' ? 'invert(1)' : 'invert(0)',
    },
  });

export const filesStyle = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  mainView: {
    flex: 1,
    padding: 10,
    gap: 20,
  },
  heading: {
    fontSize: 40,
    color: Colors[colorScheme].text,
  },
  inputView: {
    flexDirection: 'row',
    backgroundColor: Colors[colorScheme].itemBackground,
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    height: 45,
  },
  input: {
    color: Colors[colorScheme].text,
    fontWeight: 'bold',
    flex: 1,
    fontSize: 17,
  },
  card: {
    padding: 15,
    backgroundColor: Colors[colorScheme].itemBackground,
    borderRadius: 10,
    height: 170,
    justifyContent: 'space-between',
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
    backgroundColor: Colors[colorScheme].fog,
  },
  totalStorage: {
    fontSize: 28,
    color: Colors[colorScheme].text,
  },
  Bar: {
    backgroundColor: Colors[colorScheme].background,
    height: 20,
    borderRadius: 50,
  },
  categoriesContainer: {
    flex: 1,
    gap: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
  },
  categoryCard: {
    height: 100,
    width: 100,
    borderRadius: 15,
    backgroundColor: Colors[colorScheme].itemBackground,
    justifyContent: 'space-between',
    padding: 10,
    alignItems: 'center',
    flexDirection: 'column',
  },
  categoryText: {
    fontSize: 12,
    color: Colors[colorScheme].text,
  },
});

export const loadingStyles = (colorScheme: 'light' | 'dark') =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
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

export const ModeSwitchStyles = (colorScheme: 'light' | 'dark') =>
  StyleSheet.create({
    button: {
      borderWidth: 1.5,
      borderRadius: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 4,
      backgroundColor: Colors[colorScheme].background,
      borderColor: Colors[colorScheme].fog,
      position: 'absolute',
      right: 5,
    },
    image: {
      filter: colorScheme === 'dark' ? 'invert(1)' : 'invert(0)',
      height: 20,
      width: 20,
    },
    dropdown: {
      backgroundColor: Colors[colorScheme].background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: Colors[colorScheme].fog,
      position: 'absolute',
      top: 45,
      right: 0,
      zIndex: 100,
      elevation: 100,
      padding: 4,
      gap: 5,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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

export const FilesIconStyles = (colorScheme: 'light' | 'dark') =>
  StyleSheet.create({
    view: {
      flex: 1,
      backgroundColor: Colors[colorScheme].fog,
      borderRadius: 10,
      padding: 10,
      gap: 10,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 35,
    },
    card: {
      padding: 10,
      borderRadius: 10,
      borderColor: Colors[colorScheme].fog,
      borderWidth: 2,
      gap: 10,
      justifyContent: 'center',
      alignItems: 'center',
      height: 95,
      width: 95,
    },
    icon: {
      height: 30,
      width: 30,
      filter: colorScheme === 'dark' ? 'invert(1)' : '',
    },
    title: {
      color: Colors[colorScheme].text,
      fontSize: 12,
      fontWeight: 'bold',
    },
  });

export const IconsStyles = (
  colorScheme: 'light' | 'dark',
  width: number,
  height: number,
  filter: number,
) =>
  StyleSheet.create({
    icon: {
      height: height,
      width: width,
      filter: colorScheme === 'dark' ? `invert(${filter})` : '',
    },
  });

export const sidebarStyles = (colorScheme: 'light' | 'dark') =>
  StyleSheet.create({
    view: {
      flex: 1,
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    },
    text: {
      fontSize: 20,
    },
    sidebar: {
      position: 'absolute',
      top: 0,
      left: 0,
      height: '100%',
      width: '80%',
      backgroundColor: Colors[colorScheme].itemBackground,
      justifyContent: 'center',
      zIndex: 100,
      borderTopEndRadius: 20,
      borderEndEndRadius: 20,
      paddingBottom: 15,
      paddingTop: 7,
    },
    overlay: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    logo: {
      alignItems: 'center',
      gap: 10,
      padding: 10,
      flexDirection: 'row',
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
      alignItems: 'flex-start',
    },
    options: {
      gap: 20,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors[colorScheme].background,
      width: '100%',
      padding: 12,
      borderRadius: 10,
    },
    optionsText: {
      fontFamily: 'sans-serif',
      fontSize: 15,
      color: Colors[colorScheme].text,
    },
    footer: {
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    footerButton: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    footerText: {
      color: Colors[colorScheme].fog,
      fontSize: 13,
    },
    dot: {
      height: 10,
      width: 10,
      borderRadius: '50%',
      backgroundColor: Colors[colorScheme].fog,
    },
  });
