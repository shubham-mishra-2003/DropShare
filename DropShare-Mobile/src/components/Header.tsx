import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import Icon from './Icon';
import { icons, images } from '../assets/assets';
import ThemeSwitch from './ThemeSwitch';
import { headerStyles } from '../constants/Styles';
import { useTheme } from '../hooks/ThemeProvider';

interface headerProps {
  onPress: () => void;
  page: any
}

const Header = ({ onPress, page = 'home' }: headerProps) => {
  const { colorScheme } = useTheme();
  const styles = headerStyles(colorScheme);

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.iconContainer} onPress={onPress}>
        <Icon source={page === 'home' ? icons.menu : icons.back} height={20} width={20} filter={1} />
      </TouchableOpacity>
      <View style={styles.logo}>
        {page === 'home' && (
          <Image
            source={images.logo}
            height={50}
            width={50}
            style={styles.image}
          />
        )}
        <Text style={styles.text}>{page === 'home' ? 'DropShare' : page}</Text>
        {page === 'Settings' && <ThemeSwitch />}
      </View>
    </View>
  );
};

export default Header;
