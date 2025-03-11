import dgram from "dgram";
import { networkInterfaces } from "os";
import net from "net";
import fs from "fs";
import path from "path";

const UDP_PORT = 5001;
const TCP_PORT = 6000;
let discoveredDevices: { address: string; name: string; lastSeen: number }[] =
  [];

const SECRET_KEY = "DropShare_Auth";
let serverRunning = false;
let socket: dgram.Socket | null = null;
let discoveryInterval: NodeJS.Timeout | null = null;

const getLocalIPAddress = (): string => {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "0.0.0.0";
};

const getBroadcastIPAddress = (): string => {
  const localIP = getLocalIPAddress();
  if (localIP === "0.0.0.0") return "255.255.255.255";

  const parts = localIP.split(".").map(Number);
  parts[3] = 255;
  return parts.join(".");
};

export const startDeviceDiscovery = (
  onDeviceFound: (device: Device[]) => void,
  username: string,
) => {
  const DEVICE_NAME = username || "Dropshare_User";
  const socket = dgram.createSocket("udp4");
  const broadcastIp = getBroadcastIPAddress();
  const localIP = getLocalIPAddress();

  socket.on("error", (err) => {
    console.error("UDP Socket Error:", err);
    socket.close();
  });

  socket.bind(UDP_PORT, () => {
    socket.setBroadcast(true);
    console.log(
      `UDP Discovery started on ${UDP_PORT}, broadcasting to ${broadcastIp}`,
    );

    const sendDiscoveryRequest = () => {
      if (!socket) return;
      const message = JSON.stringify({
        type: "DISCOVERY_REQUEST",
        key: SECRET_KEY,
      });
      socket.send(
        Buffer.from(message),
        0,
        message.length,
        UDP_PORT,
        broadcastIp,
        (err) => {
          if (err) console.error("Error sending UDP message:", err);
        },
      );
    };

    setInterval(sendDiscoveryRequest, 5000);
  });

  socket.on("message", (msg, rinfo) => {
    try {
      const data = JSON.parse(msg.toString());
      if (rinfo.address === localIP) return;

      if (data.type === "DISCOVERY_REQUEST" && data.key === SECRET_KEY) {
        const response = JSON.stringify({
          type: "DISCOVERY_RESPONSE",
          name: DEVICE_NAME,
        });
        socket.send(
          Buffer.from(response),
          0,
          response.length,
          UDP_PORT,
          rinfo.address,
          (err) => {
            if (err) console.error("Error sending response:", err);
          },
        );
      } else if (data.type === "DISCOVERY_RESPONSE" && data.name) {
        const device = {
          address: rinfo.address,
          name: data.name,
          lastSeen: Date.now(),
        };

        if (!discoveredDevices.some((d) => d.address === device.address)) {
          discoveredDevices.push(device);
          console.log("Discovered device:", device);
          onDeviceFound([...discoveredDevices]);
        } else {
          discoveredDevices = discoveredDevices.map((d) =>
            d.address === device.address ? { ...d, lastSeen: Date.now() } : d,
          );
          onDeviceFound([...discoveredDevices]);
        }
      }
    } catch (error) {
      console.error("Invalid UDP message received:", error);
    }
  });

  setInterval(() => {
    const now = Date.now();
    discoveredDevices = discoveredDevices.filter(
      (d) => now - d.lastSeen < 15000,
    );
    onDeviceFound([...discoveredDevices]);
  }, 10000);
};

export const stopDeviceDiscovery = () => {
  if (!serverRunning) return;
  serverRunning = false;
  if (discoveryInterval) {
    clearInterval(discoveryInterval);
    discoveryInterval = null;
  }
  if (socket) {
    socket.close(() => {
      console.log("UDP Discovery stopped.");
      socket = null;
    });
  }
};

export const startTCPServer = () => {
  const server = net.createServer((socket) => {
    console.log(
      `Client connected: ${socket.remoteAddress}:${socket.remotePort}`,
    );

    const filePath = path.join(__dirname, "received_file"); // Change as needed
    const fileStream = fs.createWriteStream(filePath);

    socket.on("data", (chunk) => {
      fileStream.write(chunk);
      console.log("Receiving file...");
    });

    socket.on("end", () => {
      fileStream.end();
      console.log("File received successfully!");
    });

    socket.on("error", (err) => {
      console.error("TCP Server Error:", err);
    });
  });

  server.listen(TCP_PORT, "0.0.0.0", () => {
    console.log(`TCP Server started on port ${TCP_PORT}`);
  });

  return server;
};

export const sendFileToDevice = (deviceIp: string, filePath: string) => {
  const client = new net.Socket();

  client.connect(TCP_PORT, deviceIp, () => {
    console.log(`Connected to ${deviceIp}, sending file...`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(client);

    fileStream.on("end", () => {
      client.end();
      console.log("File sent successfully!");
    });
  });

  client.on("error", (err) => {
    console.error("TCP Client Error:", err);
  });
};
