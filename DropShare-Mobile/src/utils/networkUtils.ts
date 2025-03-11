import React from "react";
import dgram from "react-native-udp";
import { Platform } from "react-native";
import DeviceInfo from "react-native-device-info";
import { NetworkInfo } from "react-native-network-info";
import { Buffer } from "buffer";
import { Toast } from "../components/Toasts";
import net from "react-native-tcp-socket";
import RNFS from "react-native-fs"


if (typeof global.Buffer === "undefined") {
  global.Buffer = Buffer;
}

const UDP_PORT = 5001;
const TCP_PORT = 6000;
const SECRET_KEY = "DropShare_Auth";

export interface Device {
  address: string;
  name: string;
}

interface RemoteInfo {
  address: string;
  family: string;
  port: number;
  size: number;
}

let socket: any = null;

const getLocalIPAddress = async (): Promise<string> => {
  try {
    const localIP = await NetworkInfo.getIPV4Address();
    return localIP || "0.0.0.0";
  } catch (error) {
    console.error("Error getting local IP:", error);
    return "0.0.0.0";
  }
};

const setLastBlockTo255 = (ip: string): string => {
  const parts = ip.split(".").map(Number);
  parts[3] = 255;
  return parts.join(".");
};

const getBroadcastIPAddress = async (): Promise<string | null> => {
  try {
    const ip = await DeviceInfo.getIpAddress();
    const iosIp = await NetworkInfo.getBroadcast();
    return setLastBlockTo255(
      (Platform.OS === "ios" ? iosIp : ip) || "255.255.255.255"
    );
  } catch (error) {
    console.error("Error getting broadcast address:", error);
    return null;
  }
};

const startUdpDiscovery = async (
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>,
  username: string
) => {
  if (socket) {
    console.warn("Device discovery already running.");
    return;
  }
  socket = dgram.createSocket({ type: "udp4", reusePort: true });
  const broadcastIp = await getBroadcastIPAddress();
  const localIP = await getLocalIPAddress();

  if (!broadcastIp || localIP === "0.0.0.0") {
    console.error("Failed to get broadcast address or local IP");
    return;
  }

  socket.bind(UDP_PORT, () => {
    socket.setBroadcast(true);
    setInterval(() => {
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
        (err: any) => {
          if (err) console.error("Error sending UDP message:", err);
        }
      );
    }, 5000);
  });

  socket.on("message", async (msg: Buffer, rinfo: RemoteInfo) => {
    const localIP = await getLocalIPAddress();
    if (rinfo.address === localIP) return;

    try {
      const data = JSON.parse(msg.toString());
      if (data.type === "DISCOVERY_REQUEST" && data.key === SECRET_KEY) {
        socket.send(
          Buffer.from(
            JSON.stringify({ type: "DISCOVERY_RESPONSE", name: username })
          ),
          0,
          UDP_PORT,
          rinfo.address,
          (err: any) => err && console.error("Error sending response:", err)
        );
      } else if (data.type === "DISCOVERY_RESPONSE" && data.name) {
        const device: Device = { address: rinfo.address, name: data.name };
        setDevices((prevDevices) => {
          if (!prevDevices.some((d) => d.address === device.address)) {
            return [...prevDevices, device];
          }
          return prevDevices;
        });
      }
    } catch (error) {
      console.error("Invalid UDP message received:", error);
    }
  });

  socket.on("error", (err: Error) => {
    console.error("Socket error:", err);
    stopDeviceDiscovery();
  });
};

export const startDeviceDiscovery = async (setDevices: React.Dispatch<React.SetStateAction<Device[]>>,
  username: string) => {
  try {
    await startUdpDiscovery(setDevices, username);
  } catch (error) {
    console.error("Error starting device discovery:", error);
  }
};

export const stopDeviceDiscovery = () => {
  if (socket) {
    socket.close();
    socket = null;
    Toast("Device discovery stopped.");
  }
};

export const startTCPServer = () => {
  const server = net.createServer((socket) => {
    console.log(`Client connected: ${socket.remoteAddress}:${socket.remotePort}`);
    const filePath = `${RNFS.DocumentDirectoryPath}/received_file`;
    socket.on("data", async (data) => {
      try {
        await RNFS.appendFile(filePath, data.toString("base64"), "base64");
        console.log("Chunk received and written.");
      } catch (error) {
        console.error("Error writing file:", error);
      }
    });
    socket.on("close", () => {
      console.log("Connection closed");
      Toast("File received successfully!");
    });
    socket.on("error", (err) => {
      console.error("Server error:", err);
    });
  });
  server.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
    console.log(`TCP Server started on port ${TCP_PORT}`);
  });
  return server;
};
