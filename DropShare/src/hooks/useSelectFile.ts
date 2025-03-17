import { useState } from "react";
import RNFS from 'react-native-fs'

const useSelectFile = () => {
    const [selectedFiles, setSelectedFiles] = useState<RNFS.ReadDirItem[]>([]);

    return { selectedFiles, setSelectedFiles };
};

export default useSelectFile;
