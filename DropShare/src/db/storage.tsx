import { MMKV } from "react-native-mmkv";

export const storage = new MMKV({
  id: "dropshare-storage",
  encryptionKey: "dropshare-auth",
});

export const mmkvStorage = {
    setItem: (key: string, value: string)
}
wz