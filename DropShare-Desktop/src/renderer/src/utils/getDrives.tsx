import { exec } from "child_process";
import Toast from "../components/Toast";

export async function getWindowsDrives() {
  return new Promise<DriveInfo[]>((resolve, reject) => {
    exec(
      'powershell.exe "Get-WmiObject -Class Win32_LogicalDisk | Select-Object DeviceID, VolumeName, Size, FreeSpace | Format-List"',
      (error, stdout, stderr) => {
        if (error) {
          Toast({ message: `Error executing PowerShell command: ${error}`, type: 'error' });
          reject("Error fetching Windows drives");
          return;
        }
        if (stderr) {
          Toast({ message: `PowerShell stderr: ${stderr}`, type: 'error' });
          reject("Error fetching Windows drives");
          return;
        }

        Toast({ message: `PowerShell Output: stdout`, type: 'error' });

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
