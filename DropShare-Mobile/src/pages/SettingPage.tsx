import React from 'react';
import { Text, View } from 'react-native';
import { goBack } from '../utils/NavigationUtil';
import Header from '../components/Header';

const SettingsPage = () => {
  return (
    <View>
      <Header page="Settings" onPress={goBack} />
      <Text>Setting</Text>
    </View>
  );
};

export default SettingsPage;
