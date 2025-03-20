import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

const api = {
  handleMinimize: () => ipcRenderer.send("minimize"),
  handleMaximize: () => ipcRenderer.send("maximize"),
  handleClose: () => ipcRenderer.send("close"),
  getDrives: () => ipcRenderer.invoke("get-drives"),
  getFiles: (drive: string) => ipcRenderer.invoke("get-files", drive),
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", {
      ...electronAPI,
      ...api,
    });
    contextBridge.exposeInMainWorld("tcp", {
      startHost: (port: number) => ipcRenderer.send("start-host", port),
      connectToHost: (hostIP: string, port: number) =>
        ipcRenderer.send("connect-to-host", hostIP, port),
      sendFiles: (filePaths: string[]) =>
        ipcRenderer.send("send-files", filePaths),
      getTCPState: () => ipcRenderer.invoke("get-tcp-state"),
      onHostStarted: (callback: Function) =>
        ipcRenderer.on("host-started", (_event, data) => callback(data)),
      onHostConnected: (callback: Function) =>
        ipcRenderer.on("host-connected", (_event, data) => callback(data)),
      onFilesSent: (callback: Function) =>
        ipcRenderer.on("files-sent", (_event, data) => callback(data)),
    });
  } catch (error) {
    console.error("Error exposing API:", error);
  }
} else {
  // @ts-ignore
  window.electron = { __dirname, ...electronAPI, ...api };
}
