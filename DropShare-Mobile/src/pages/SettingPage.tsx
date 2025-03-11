import React from "react";
import { Text, View } from "react-native";
import { goBack } from "../utils/NavigationUtil";
import Header from "../components/Header";
import UsernameForm from "../components/UsernameForm";

const SettingsPage = () => {
  return (
    <View>
      <Header page="Settings" onPress={goBack} />
      <Text>Setting</Text>
      <UsernameForm />
    </View>
  );
};

export default SettingsPage;
