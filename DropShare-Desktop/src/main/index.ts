import { app, shell, BrowserWindow, ipcMain, dialog } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import { getWindowsDrives } from "../renderer/src/utils/getDrives";
import { getFiles } from "../renderer/src/utils/getFiles";
import { readFile, writeFile } from "fs/promises";
import { startHostServer, sendHostMessage, sendHostFile } from "./HostServer";
import {
  connectToHost,
  sendFile,
  sendMessage,
  startClientDiscovery,
} from "./ClientServer";
import net from "net";

let mainWindow: BrowserWindow | null = null;
let maximizeToggle = false;
let hostServer: net.Server | null = null;
let clientSocket: net.Socket | null = null;
let discoveredDevices: Device[] = [];
let connectedDevices: Device[] = [];
let messages: string[] = [];
let receivedFiles: { path: string; originalName: string }[] = [];
let transferProgress: {
  [fileId: string]: { progress: string; speed: string; percentage: number };
} = {};

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
    icon: join(__dirname, "../../public/dropshareIcon.ico"),
    title: "DropShare",
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.on("ready-to-show", () => mainWindow?.show());
  mainWindow.on("page-title-updated", (event) => event.preventDefault());
  mainWindow.setTitle("DropShare");

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

// Window controls
ipcMain.on("minimize", () => mainWindow?.minimize());
ipcMain.on("maximize", () => {
  if (mainWindow) {
    maximizeToggle ? mainWindow.unmaximize() : mainWindow.maximize();
    maximizeToggle = !maximizeToggle;
  }
});
ipcMain.on("close", () => app.quit());

// File system handlers
ipcMain.handle("get-drives", async () => await getWindowsDrives());
ipcMain.handle(
  "get-files",
  async (_event, drive: string) => await getFiles(drive),
);
ipcMain.handle("select-file", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const filePath = result.filePaths[0];
  const fileData = await readFile(filePath);
  return { filePath, fileData };
});

// New handlers for "Save As" and "Open File"
ipcMain.handle(
  "save-file-as",
  async (_event, tempPath: string, originalName: string) => {
    if (!mainWindow) return { success: false };
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: originalName,
    });
    if (result.canceled || !result.filePath) return { success: false };
    const fileData = await readFile(tempPath);
    await writeFile(result.filePath, fileData);
    return { success: true, path: result.filePath };
  },
);

ipcMain.on("open-file", (_event, tempPath: string) => {
  shell.openPath(tempPath);
});

// Client discovery
ipcMain.handle("start-client-discovery", (_event) => {
  discoveredDevices = [];
  startClientDiscovery((devices) => {
    discoveredDevices = devices;
    mainWindow?.webContents.send("update-devices", discoveredDevices);
  });
  return { success: true };
});

ipcMain.on("stop-client-discovery", () => {
  discoveredDevices = [];
  mainWindow?.webContents.send("update-devices", discoveredDevices);
});

// Start hosting
ipcMain.handle("start-hosting", async (_event, username: string) => {
  connectedDevices = [];
  messages = [];
  receivedFiles = [];
  transferProgress = {};

  startHostServer(
    username,
    (devices) => {
      connectedDevices = devices;
      mainWindow?.webContents.send("update-devices", connectedDevices);
    },
    (server) => {
      hostServer = server;
    },
    (newMessages) => {
      messages =
        typeof newMessages === "function" ? newMessages(messages) : newMessages;
      mainWindow?.webContents.send("message-received", messages);
    },
    (newFiles) => {
      receivedFiles = newFiles.map(
        (file: { path: string; originalName: string }) => ({
          path: file.path,
          originalName: file.originalName,
        }),
      );
      mainWindow?.webContents.send("file-received", receivedFiles);
    },
    (progress) => {
      const fileId = Object.keys(progress)[0];
      transferProgress[fileId] = progress[fileId];
      mainWindow?.webContents.send("file-progress", transferProgress);
    },
  );
  return { success: true };
});

ipcMain.on("stop-hosting", () => {
  if (hostServer) {
    hostServer.close();
    hostServer = null;
    connectedDevices = [];
    messages = [];
    receivedFiles = [];
    transferProgress = {};
    mainWindow?.webContents.send("disconnected");
    mainWindow?.webContents.send("update-devices", connectedDevices);
    mainWindow?.webContents.send("message-received", messages);
    mainWindow?.webContents.send("file-received", receivedFiles);
    mainWindow?.webContents.send("file-progress", transferProgress);
  }
});

// Connect to host
ipcMain.handle(
  "connect-to-host",
  async (_event, ip: string, username: string) => {
    messages = [];
    receivedFiles = [];
    transferProgress = {};

    connectToHost(
      ip,
      username,
      (connected) => {
        mainWindow?.webContents.send("update-connection", connected);
      },
      (socket) => {
        clientSocket = socket;
      },
      (newMessages) => {
        messages =
          typeof newMessages === "function"
            ? newMessages(messages)
            : newMessages;
        mainWindow?.webContents.send("message-received", messages);
      },
      (newFiles) => {
        receivedFiles = newFiles.map(
          (file: { path: string; originalName: string }) => ({
            path: file.path,
            originalName: file.originalName,
          }),
        );
        mainWindow?.webContents.send("file-received", receivedFiles);
      },
      (progress) => {
        const fileId = Object.keys(progress)[0];
        transferProgress[fileId] = progress[fileId];
        mainWindow?.webContents.send("file-progress", transferProgress);
      },
    );
    return { success: true };
  },
);

ipcMain.on("disconnect-client", () => {
  if (clientSocket) {
    clientSocket.destroy();
    clientSocket = null;
    messages = [];
    receivedFiles = [];
    transferProgress = {};
    mainWindow?.webContents.send("disconnected");
    mainWindow?.webContents.send("message-received", messages);
    mainWindow?.webContents.send("file-received", receivedFiles);
    mainWindow?.webContents.send("file-progress", transferProgress);
  }
});

// Send message
ipcMain.on(
  "send-message",
  async (_event, message: string, username: string) => {
    if (hostServer) {
      sendHostMessage(message, username);
    } else if (clientSocket) {
      sendMessage(clientSocket, message, username);
    }
  },
);

// Send file
ipcMain.handle(
  "send-file",
  async (_event, filePath: string, fileData: Buffer, username: string) => {
    if (hostServer) {
      await sendHostFile(filePath, fileData, username, (progress) => {
        const fileId = filePath.split(/[\\/]/).pop() || "unknown";
        transferProgress[fileId] = {
          progress: progress.progress,
          speed: progress.speed,
          percentage: parseFloat(
            (
              (parseInt(progress.progress.split("/")[0]) /
                parseInt(progress.progress.split("/")[1])) *
              100
            ).toFixed(2),
          ),
        };
        mainWindow?.webContents.send("file-progress", transferProgress);
      });
    } else if (clientSocket) {
      await sendFile(clientSocket, filePath, fileData, username, (progress) => {
        const fileId = filePath.split(/[\\/]/).pop() || "unknown";
        transferProgress[fileId] = {
          progress: progress.progress,
          speed: progress.speed,
          percentage: parseFloat(
            (
              (parseInt(progress.progress.split("/")[0]) /
                parseInt(progress.progress.split("/")[1])) *
              100
            ).toFixed(2),
          ),
        };
        mainWindow?.webContents.send("file-progress", transferProgress);
      });
    }
    return { success: true };
  },
);

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.dropshare");
  app.on("browser-window-created", (_, window) =>
    optimizer.watchWindowShortcuts(window),
  );
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
