import { useState } from "react";
import RNFS from 'react-native-fs'

const useCurrentPath = () => {
    const [currentPath, setCurrentPath] = useState(RNFS.ExternalStorageDirectoryPath);

    return { currentPath, setCurrentPath };
};

export default useCurrentPath;
