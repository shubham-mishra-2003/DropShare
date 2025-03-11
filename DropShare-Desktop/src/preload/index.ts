import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import path from "path";

const api = {
  joinPath: (...args: string[]) => path.join(...args),
  handleMinimize: () => ipcRenderer.send("minimize"),
  handleMaximize: () => ipcRenderer.send("maximize"),
  handleClose: () => ipcRenderer.send("close"),
  openFilePicker: () => ipcRenderer.invoke("open-file-picker"),
  startDiscovery: (username: string) => ipcRenderer.invoke("start-device-discovery", username),
  // onDeviceFound: (callback) => {
  //   ipcRenderer.on("device-discovered", (_, devicesList) => {
  //     console.log("Devices in Renderer:", devicesList);
  //     callback(devicesList);
  //   });
  // },
  getFoundDevices: () => ipcRenderer.invoke("found-devices"),
  getDrives: () => ipcRenderer.invoke("get-drives"),
  selectFile: () => ipcRenderer.invoke("select-file"),
  getFiles: (drive: string) => ipcRenderer.invoke("get-files", drive),
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", {
      ...electronAPI,
      ...api,
    });
  } catch (error) {
    console.error("Error exposing API:", error);
  }
} else {
  // @ts-ignore
  window.electron = { __dirname, ...electronAPI, ...api };
}
