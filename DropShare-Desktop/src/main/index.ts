import { app, shell, BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import { getWindowsDrives } from "../renderer/src/utils/getDrives";
import { getFiles } from "../renderer/src/utils/getFiles";
import {
  connectToHost,
  getTCPState,
  sendFiles,
  startHost,
} from "../renderer/src/utils/tcpServer";

let mainWindow: BrowserWindow | null = null;
let maximizeToggle = false;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minHeight: 600,
    minWidth: 500,
    minimizable: true,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

ipcMain.on("minimize", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on("maximize", () => {
  if (mainWindow) {
    if (maximizeToggle) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    maximizeToggle = !maximizeToggle;
  }
});

ipcMain.on("close", () => {
  app.quit();
});

ipcMain.handle("get-drives", async () => {
  return await getWindowsDrives();
});

ipcMain.handle("get-files", async (_, drive) => {
  return await getFiles(drive);
});

ipcMain.on("start-host", async (event, port) => {
  await startHost(port);
  event.reply("host-started", getTCPState());
});

ipcMain.on("connect-to-host", async (event, hostIP, port) => {
  await connectToHost(hostIP, port);
  event.reply("host-connected", getTCPState());
});

ipcMain.on("send-files", async (event, filePaths) => {
  await sendFiles(filePaths);
  event.reply("files-sent", getTCPState());
});

ipcMain.handle("get-tcp-state", async () => {
  return getTCPState();
});

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.dropshare");

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
