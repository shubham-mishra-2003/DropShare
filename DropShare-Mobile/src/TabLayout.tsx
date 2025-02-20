import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import SharingScreen from './pages/SharingPage';
import FilesScreen from './pages/HomePage';
import {useTheme} from './hooks/ThemeProvider';
import {tabBarStyles} from './constants/Styles';
import {icons} from './assets/assets';

const TabLayout = () => {
  const [activeTab, setActiveTab] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const {colorScheme} = useTheme();
  const {width} = Dimensions.get('window');

  const styles = tabBarStyles(colorScheme);

  const screenData: {
    title: string;
    icon: any;
    component: JSX.Element;
  }[] = [
    {
      title: 'Files',
      icon: icons.folder,
      component: <FilesScreen />,
    },
    {
      title: 'Share',
      icon: icons.share,
      component: <SharingScreen />,
    },
  ];

  const handleTabClick = (index: number) => {
    if (index !== activeTab) {
      const direction = index > activeTab ? -1 : 1;

      Animated.timing(translateX, {
        toValue: direction * width,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setActiveTab(index);

        translateX.setValue(-direction * width);

        Animated.timing(translateX, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
          style={{flex: 1}}>
          <ScrollView
            contentContainerStyle={{flexGrow: 1}}
            keyboardShouldPersistTaps="handled">
            <Animated.View style={{transform: [{translateX}]}}>
              <View style={styles.view}>{screenData[activeTab].component}</View>
            </Animated.View>
          </ScrollView>
          <View style={styles.bar}>
            {screenData.map((tab, index) => (
              <TouchableOpacity
                style={styles.barSwitch}
                key={index}
                onPress={() => handleTabClick(index)}>
                {activeTab === index && (
                  <Animated.View
                    style={[styles.indicator, {transform: [{translateX}]}]}
                  />
                )}
                <Image
                  source={tab.icon}
                  height={30}
                  width={30}
                  style={styles.image}
                />
                <Text
                  style={[
                    styles.label,
                    {fontWeight: activeTab == index ? 'bold' : 'normal'},
                  ]}>
                  {tab.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
};

export default TabLayout;
