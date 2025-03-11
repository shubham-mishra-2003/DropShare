import net from "net";
import fs from "fs";
import { exec } from "child_process";

const TCP_PORT = 5002;
const SAVE_DIR = "./Dropshare/";

export const startTCPServer = () => {
  if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR);

  const server = net.createServer((socket) => {
    let fileName = "";
    let fileStream: fs.WriteStream | null = null;

    socket.on("data", (data) => {
      if (!fileName) {
        fileName = data.toString().trim();
        fileStream = fs.createWriteStream(`${SAVE_DIR}${fileName}`);
      } else {
        fileStream?.write(data);
      }
    });

    socket.on("end", () => {
      fileStream?.end();
      console.log(`File received: ${fileName}`);
    });
  });

  server.on("error", (err) => {
    if ((err as any).code === "EADDRINUSE") {
      console.error(
        `Port ${TCP_PORT} is already in use. Attempting to free it...`,
      );
      releasePort(TCP_PORT, () => {
        console.log(`Retrying TCP Server on port ${TCP_PORT}...`);
        startTCPServer();
      });
    } else {
      console.error("TCP Server Error:", err);
    }
  });

  server.listen(TCP_PORT, () => {
    console.log(`✅ TCP Server listening on port ${TCP_PORT}`);
  });
};

const releasePort = (port: number, callback: () => void) => {
  exec(`netstat -ano | findstr :${port}`, (err, stdout) => {
    if (stdout) {
      const lines = stdout.split("\n");
      lines.forEach((line) => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== process.pid.toString()) {
          console.log(`🔴 Killing process using port ${port}: PID ${pid}`);
          exec(`taskkill /PID ${pid} /F`, (killErr) => {
            if (!killErr) {
              console.log(`✅ Successfully freed port ${port}`);
              callback();
            }
          });
        }
      });
    }
  });
};
