import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    PermissionsAndroid,
    Platform,
    Alert,
    Linking,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import RNFS from 'react-native-fs';
import { navigate } from '../utils/NavigationUtil';
import { filesStyle } from '../constants/Styles';
import { useTheme } from '../hooks/ThemeProvider';
import { Colors } from '../constants/Colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const HomeScreen = () => {
    const { colorScheme } = useTheme();
    const styles = filesStyle(colorScheme);

    const [storage, setStorage] = useState({ used: 0, total: 0 });
    const [fileCounts, setFileCounts] = useState({
        Photos: 0, Videos: 0, Audio: 0, Documents: 0, APKs: 0, Archives: 0, Apps: 0,
    });

    const categories = [
        { name: 'Photos', icon: 'image', color: '#4A90E2', type: ['jpg', 'png', 'jpeg', 'gif', 'webp'] },
        { name: 'Videos', icon: 'video', color: '#8B5CF6', type: ['mp4', 'mkv', 'mov', 'avi'] },
        { name: 'Audio', icon: 'music', color: '#E67E22', type: ['mp3', 'wav', 'aac', 'ogg'] },
        { name: 'Documents', icon: 'file-document', color: '#3498DB', type: ['pdf', 'docx', 'xlsx', 'pptx', 'txt'] },
        { name: 'APKs', icon: 'android', color: '#27AE60', type: ['apk'] },
        { name: 'Archives', icon: 'archive', color: '#8D6E63', type: ['zip', 'rar', '7z', 'tar'] },
        { name: 'Apps', icon: 'apps', color: '#3D6F62', type: [] },
    ];

    const fetchFiles = async () => {
        try {
            if (!RNFS.ExternalStorageDirectoryPath) {
                console.error('❌ External storage path is undefined!');
                return;
            }

            const files = await RNFS.readDir(RNFS.ExternalStorageDirectoryPath);
            console.log('📂 Found Files:', files);

            if (!files.length) {
                console.warn('⚠️ No files found!');
                return;
            }

            const counts = { Photos: 0, Videos: 0, Audio: 0, Documents: 0, APKs: 0, Archives: 0, Apps: 0 };

            files.forEach((file) => {
                const ext = file.name?.split('.').pop()?.toLowerCase() ?? '';
                categories.forEach((cat) => {
                    if (cat.type.includes(ext)) {
                        counts[cat.name as keyof typeof counts]++;
                    }
                });
            });

            console.log('📊 File Counts:', counts);
            setFileCounts({ ...counts });
        } catch (error) {
            console.error('❌ Error reading files:', error);
        }
    };

    const fetchStorageDetails = async () => {
        try {
            const total = await DeviceInfo.getTotalDiskCapacity() / (1024 ** 3);
            const free = await DeviceInfo.getFreeDiskStorage() / (1024 ** 3);
            const used = total - free;

            setStorage({
                used: parseFloat(used.toFixed(1)),
                total: parseFloat(total.toFixed(1)),
            });
        } catch (error) {
            console.error('❌ Error fetching storage details:', error);
        }
    };

    const checkPermissions = async () => {
        if (Platform.OS === 'android') {
            const readPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
            const writePermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
            const managePermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.MANAGE_EXTERNAL_STORAGE);

            console.log('🔍 Permissions:', { readPermission, writePermission, managePermission });
        }
    };

    const requestStoragePermission = useCallback(async () => {
        if (Platform.OS === 'android') {
            const readPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
            const writePermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
            const managePermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.MANAGE_EXTERNAL_STORAGE);

            if (readPermission && writePermission && managePermission) {
                console.log('✅ All permissions already granted!');
                fetchStorageDetails();
                fetchFiles();
                return;
            }

            try {
                const granted = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
                    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
                    PermissionsAndroid.PERMISSIONS.MANAGE_EXTERNAL_STORAGE,
                ]);

                if (
                    granted['android.permission.READ_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED &&
                    granted['android.permission.WRITE_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED
                ) {
                    fetchStorageDetails();
                    fetchFiles();
                } else {
                    Alert.alert(
                        'Permission Required',
                        'Storage access is needed. Enable it in app settings.',
                        [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Open Settings', onPress: () => Linking.openSettings() }
                        ]
                    );
                }
            } catch (error) {
                console.error('❌ Permission request error:', error);
            }
        } else {
            fetchStorageDetails();
            fetchFiles();
        }
    }, []);

    useEffect(() => {
        checkPermissions();
        requestStoragePermission();
    }, [requestStoragePermission]);

    return (
        <View style={styles.mainView}>
            <Text style={styles.heading}>Files</Text>
            <View style={styles.inputView}>
                <TextInput
                    placeholder="Search"
                    style={styles.input}
                    placeholderTextColor={Colors[colorScheme].fog}
                />
            </View>

            <View style={styles.card}>
                <Text style={styles.cardText}>Device storage</Text>
                <View style={styles.storageInfo}>
                    <Text style={styles.remainingStorage}>
                        {storage.used} GB | <Text style={styles.totalStorage}>{storage.total} GB</Text>
                    </Text>
                    <View style={styles.Bar}>
                        <View style={{ width: storage.total > 0 ? `${(storage.used / storage.total) * 100}%` : '0%', height: 20, borderRadius: 50, backgroundColor: Colors[colorScheme].tint }} />
                    </View>
                </View>
            </View>

            <View style={styles.categoriesContainer}>
                {categories.map((item) => (
                    <TouchableOpacity
                        key={item.name}
                        style={styles.categoryCard}
                        onPress={() => navigate('FilesList', { category: item.name })}
                    >
                        <Icon name={item.icon} size={30} color={item.color} />
                        <Text style={styles.categoryText}>{item.name}</Text>
                        <Text style={styles.categoryText}>{fileCounts[item.name as keyof typeof fileCounts] ?? 0}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

export default HomeScreen;
