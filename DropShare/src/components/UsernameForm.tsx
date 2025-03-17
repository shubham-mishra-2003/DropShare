import React, { useState } from "react";
import { View, TextInput, Button, StyleSheet } from "react-native";
import useUsername from "../hooks/useUsername";

const UsernameForm = () => {
  const [inputValue, setInputValue] = useState("");
  const { saveUsername } = useUsername();

  const handleSubmit = () => {
    if (inputValue.trim()) {
      saveUsername(inputValue.trim());
      setInputValue("");
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Enter username"
        value={inputValue}
        onChangeText={setInputValue}
      />
      <Button title="Submit" onPress={handleSubmit} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
});

export default UsernameForm;
