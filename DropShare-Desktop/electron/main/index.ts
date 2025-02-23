import { app, shell, BrowserWindow, ipcMain } from "electron";
import path, { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { images } from "../../src/assets";
import { exec } from "child_process";
import fs from "fs";

// import * as mtp from "node-mtp";

const icon = images.logo;

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
    icon: path.join(__dirname, "/public/dropshare.ico"),
    autoHideMenuBar: true,
    ...(process.platform === "linux" ? { icon } : {}),
    frame: false,
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

ipcMain.on("manualMinimize", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on("manualMaximize", () => {
  if (mainWindow) {
    if (maximizeToggle) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    maximizeToggle = !maximizeToggle;
  }
});

ipcMain.on("manualClose", () => {
  app.quit();
});

async function getWindowsDrives() {
  return new Promise<DriveInfo[]>((resolve, reject) => {
    exec(
      'powershell.exe "Get-WmiObject -Class Win32_LogicalDisk | Select-Object DeviceID, VolumeName, Size, FreeSpace | Format-List"',
      (error, stdout, stderr) => {
        if (error || stderr) {
          reject("Error fetching Windows drives");
        }

        const drives: DriveInfo[] = [];
        const lines = stdout.split("\n").map((line) => line.trim());

        let driveInfo: Partial<DriveInfo> = {};

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          if (line.startsWith("DeviceID")) {
            if (driveInfo.drive) {
              drives.push({
                drive: driveInfo.drive,
                name: driveInfo.name || "No Label",
                total: driveInfo.total || 0,
                free: driveInfo.free || 0,
              });
            }

            driveInfo = { drive: line.split(":")[1]?.trim() };
          } else if (line.startsWith("VolumeName")) {
            driveInfo.name = line.split(":")[1]?.trim() || "No Label";
          } else if (line.startsWith("Size")) {
            driveInfo.total = parseInt(
              line.split(":")[1]?.trim()?.replace(",", "") || "0",
            );
          } else if (line.startsWith("FreeSpace")) {
            driveInfo.free = parseInt(
              line.split(":")[1]?.trim()?.replace(",", "") || "0",
            );
          }
        }

        if (driveInfo.drive) {
          drives.push({
            drive: driveInfo.drive,
            name: driveInfo.name || driveInfo.drive,
            total: driveInfo.total || 0,
            free: driveInfo.free || 0,
          });
        }

        if (drives.length > 0) {
          resolve(drives);
        } else {
          reject("No drives found");
        }
      },
    );
  });
}

async function getMacDrives() {
  return new Promise<
    { drive: string; name: string; total: number; free: number }[]
  >((resolve, reject) => {
    exec("diskutil list", (error, stdout, stderr) => {
      if (error || stderr) return reject("Error fetching macOS drives");

      const drives = stdout
        .split("\n")
        .map((line) => {
          const parts = line.trim().split(/\s+/);
          if (parts.length < 6) return null;

          const drive = parts[0];
          const name = parts.slice(1).join(" ");
          const total = Math.round(parseInt(parts[1]) / 1e6);
          const free = Math.round(parseInt(parts[3]) / 1e6);

          return {
            drive: drive,
            name: name,
            total,
            free,
          };
        })
        .filter(
          (
            drive,
          ): drive is {
            drive: string;
            name: string;
            total: number;
            free: number;
          } => drive !== null,
        );

      resolve(drives);
    });
  });
}

async function getLinuxDrives() {
  return new Promise<
    { drive: string; name: string; total: number; free: number }[]
  >((resolve, reject) => {
    exec(
      "lsblk -b -o NAME,SIZE,FSAVAIL,MOUNTPOINT,LABEL | grep '/'",
      (error, stdout, stderr) => {
        if (error || stderr) return reject("Error fetching Linux drives");

        const drives = stdout
          .split("\n")
          .map((line) => {
            const parts = line.trim().split(/\s+/);
            if (parts.length < 4) return null;

            const drive = `/dev/${parts[0]}`;
            const name = parts[3]; // The name is in the fourth column (LABEL)
            const total = Math.round(parseInt(parts[1]) / 1e9); // Convert bytes to GB
            const free = Math.round(parseInt(parts[2]) / 1e9);

            return {
              drive: drive,
              name: name,
              total,
              free,
            };
          })
          .filter(
            (
              drive,
            ): drive is {
              drive: string;
              name: string;
              total: number;
              free: number;
            } => drive !== null,
          );

        resolve(drives);
      },
    );
  });
}

ipcMain.handle("get-drives", async () => {
  const platform = process.platform;
  switch (platform) {
    case "win32":
      return getWindowsDrives();
    case "darwin":
      return getMacDrives();
    case "linux":
      return getLinuxDrives();
    default:
      return [];
  }
});

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

ipcMain.handle("get-files", async (_, drive: string): Promise<FileNode> => {
  if (!drive) {
    return { name: "Error", path: "", type: "directory", children: [] };
  }

  let absoluteDrive = /^[A-Z]$/i.test(drive) ? `${drive}:/` : drive;

  if (!path.isAbsolute(absoluteDrive)) {
    return { name: "Invalid Drive", path: "", type: "directory", children: [] };
  }

  function getDirectoryTree(dirPath: string): FileNode {
    let children: FileNode[] = [];

    try {
      const files = fs.readdirSync(dirPath, { withFileTypes: true });

      children = files
        .filter(
          (file) =>
            file.name !== "$RECYCLE.BIN" &&
            file.name !== "System Volume Information",
        )
        .map<FileNode>((file) => {
          const fullPath = path.join(dirPath, file.name);

          return {
            name: file.name,
            path: fullPath,
            type: file.isDirectory() ? "directory" : "file",
            children: file.isDirectory()
              ? (getDirectoryTree(fullPath).children ?? [])
              : undefined,
          };
        });
    } catch (error: any) {
      if (error.code !== "EPERM") {
        console.error(`Error reading directory: ${dirPath}`, error);
      }
    }

    return {
      name: path.basename(dirPath) || dirPath,
      path: dirPath,
      type: "directory",
      children: children ?? [],
    };
  }

  return getDirectoryTree(absoluteDrive);
});

// Handle MTP devices (phones, cameras, etc.)
// console.log("Checking if drive is an MTP device...");
// try {
//   mtp.connect();
//   const devices = mtp.getDevices();
//   if (devices.length === 0) {
//     Toast("No MTP devices found.");
//     return [];
//   }

//   console.log("Connected to MTP device:", devices[0].name);
//   const files = mtp.getFiles(devices[0].id).map((file) => file.name);
//   mtp.disconnect();
//   console.log(`Files in MTP device (${drive}):`, files);
//   return files;
// } catch (error) {
//   Toast("Error fetching files from MTP device:", error);
//   return [];
// }
// });

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
