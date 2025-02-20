import React, {useEffect, useRef} from 'react';
import {Animated, StatusBar, Text, View} from 'react-native';
import {loadingStyles} from '../constants/Styles';
import {images} from '../assets/assets';
import {useTheme} from '../hooks/ThemeProvider';

const Loading = () => {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const rotateAnimation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }),
    );
    rotateAnimation.start();

    return () => rotateAnimation.stop();
  }, [rotation]);

  const rotationInterpolation = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const {colorScheme} = useTheme();

  const styles = loadingStyles(colorScheme);

  return (
    <View style={styles.container}>
      <Animated.Image
        source={images.loading}
        style={[styles.image, {transform: [{rotate: rotationInterpolation}]}]}
      />
      <StatusBar />
      <Text style={styles.text}>DropShare</Text>
    </View>
  );
};

export default Loading;
