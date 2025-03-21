import dgram from "react-native-udp";
import TcpSocket from "react-native-tcp-socket";
import RNFS from "react-native-fs";
import { NetworkInfo } from "react-native-network-info";

const UDP_PORT = 5000;
const TCP_PORT = 6000;
const BROADCAST_ADDRESS = "255.255.255.255";

let serverIP = "";

const startUDPServerDiscovery = () => {
  const socket = dgram.createSocket({ type: "udp4", reusePort: true });

  NetworkInfo.getIPAddress().then((ip) => {
    serverIP = ip || "";
    socket.bind(UDP_PORT, () => {
      socket.setBroadcast(true);
      setInterval(() => {
        const message = `DISCOVERY:${serverIP}:${TCP_PORT}`;
        socket.send(
          message,
          0,
          message.length,
          UDP_PORT,
          BROADCAST_ADDRESS,
          (err) => {
            if (err) console.error("UDP Broadcast Error:", err);
          }
        );
      }, 3000);
    });

    console.log(`UDP Discovery Server running on ${serverIP}:${UDP_PORT}`);
  });

  return socket;
};

const startTCPServer = () => {
  const server = TcpSocket.createServer((socket) => {
    console.log("New TCP connection from:", socket.remoteAddress);

    let receivedData = "";

    socket.on("data", (data) => {
      receivedData += data.toString();
    });

    socket.on("close", async () => {
      console.log("File transfer completed");

      const savePath = `${RNFS.ExternalStorageDirectoryPath}/received_image.txt`;
      await RNFS.writeFile(savePath, receivedData, "base64");

      console.log("File saved at:", savePath);
    });

    socket.on("error", (error) => console.error("TCP Server Error:", error));
  });

  server.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
    console.log("TCP Server listening on port", TCP_PORT);
  });

  return server;
};

export { startUDPServerDiscovery, startTCPServer };
