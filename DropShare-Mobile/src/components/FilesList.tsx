import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Header from './Header';
import { goBack } from '../utils/NavigationUtil';

const FilesList = ({ route }) => {
    const { category } = route.params;

    return (
        <View style={styles.container}>
            <Header page={category} onPress={goBack} />
            <Text style={styles.text}>Files for: {category}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    text: { fontSize: 20, fontWeight: "bold" },
});

export default FilesList;
