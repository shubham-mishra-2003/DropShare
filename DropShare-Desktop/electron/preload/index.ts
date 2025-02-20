import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

const api = {};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", {
      getDrives: () => ipcRenderer.invoke("get-drives"),
      getFiles: (drive: string) => ipcRenderer.invoke("get-files", drive),
      ...electronAPI,
      ...api,
    });
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore
  window.electron = { ...electronAPI, ...api };
}
