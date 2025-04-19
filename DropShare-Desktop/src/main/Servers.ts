import dgram from "dgram";
import { Server, Socket } from "net";
import { Buffer } from "buffer";
import { getBroadcastIPAddress, getLocalIPAddress } from "../renderer/src/utils/NetworkUtils";

const UDP_PORT = 5000;
const TCP_PORT = 6000;
const MAX_CLIENTS = 5;
const APP_IDENTIFIER = "DropShare_Electron";

let connectedSockets: Socket[] = [];
let isServerRunning = false;
let udpSocket: dgram.Socket | null = null;
let tcpServer: Server | null = null;

export const HostServer = () => {
  async function startHostServer(
    username: string,
    setDevices: (devices: Device[]) => void,
    setSocket: (server: Server | null) => void,
    setMessages: (messages: string[]) => void,
    setReceivedFiles: (files: string[]) => void,
    setTransferProgress?: (progress: TransferProgress[]) => void
  ): Promise<void> {
    if (isServerRunning) {
      console.log("🔵 Host server already running, skipping start.");
      return;
    }
    isServerRunning = true;

    try {
      const ip = await getLocalIPAddress();
      const broadcastAddr = await getBroadcastIPAddress();
      console.log(`🔵 Host started on IP: ${ip}, Broadcasting to: ${broadcastAddr}`);

      udpSocket = dgram.createSocket("udp4");
      udpSocket.bind(UDP_PORT);

      udpSocket.once("listening", () => {
        console.log(`🔗 UDP Socket bound to port ${UDP_PORT}`);
        udpSocket!.setBroadcast(true);
        const broadcastInterval = setInterval(() => {
          const message = JSON.stringify({
            role: "Host",
            ip,
            name: username,
            appId: APP_IDENTIFIER,
          });
          udpSocket!.send(message, UDP_PORT, broadcastAddr, (err) => {
            if (err) console.error("❌ UDP Send Error:", err.message);
          });
        }, 2000);
        udpSocket!.on("close", () => clearInterval(broadcastInterval));
      });

      udpSocket.on("error", (err) => {
        console.error("❌ UDP Socket Error:", err.message);
        isServerRunning = false;
        udpSocket?.close();
        udpSocket = null;
      });

      tcpServer = new Server((socket: Socket) => {
        if (connectedSockets.length >= MAX_CLIENTS) {
          socket.write(Buffer.from(`ERROR:MAX_CLIENTS_REACHED\n`));
          socket.destroy();
          console.warn("Max clients reached, rejecting new connection");
          return;
        }

        console.log(`✅ Client connected: ${socket.remoteAddress}`);
        connectedSockets.push(socket);
        setSocket(tcpServer);
        setDevices([
          ...connectedSockets.map((s) => ({
            ip: s.remoteAddress || "Unknown",
            name: "Unknown",
            role: "Client" as const,
          })),
        ]);

        socket.on("data", (data: Buffer) => {
          const { receiveFileInHost } = HostSharing();
          receiveFileInHost({
            data,
            setMessages,
            setReceivedFiles,
            socket,
            setTransferProgress,
          });
        });

        socket.on("close", () => {
          console.log(`🔌 Client disconnected: ${socket.remoteAddress}`);
          connectedSockets = connectedSockets.filter((s) => s !== socket);
          setDevices(
            connectedSockets.map((s) => ({
              ip: s.remoteAddress || "Unknown",
              name: "Unknown",
              role: "Client" as const,
            }))
          );
        });

        socket.on("error", (err) => {
          console.error(`❌ Host Socket Error for ${socket.remoteAddress}:`, err.message);
        });
      });

      tcpServer.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
        console.log(`🚀 Host TCP server running on port ${TCP_PORT}`);
      });

      tcpServer.on("error", (err) => {
        console.error("❌ Server Error:", err.message);
        stopHostServer();
      });

      tcpServer.on("close", () => {
        console.log("🔌 Host TCP server closed");
        isServerRunning = false;
        // emitToRenderer("disconnected", null);

      });
    } catch (err) {
      console.error("Failed to start host server:", err);
      isServerRunning = false;
      stopHostServer();
    }
  }

  function stopHostServer(): void {
    console.log("Stopping host server...");
    connectedSockets.forEach((socket) => socket.destroy());
    connectedSockets = [];
    if (tcpServer) {
      tcpServer.close();
      tcpServer = null;
      console.log("Host TCP server stopped");
    }
    if (udpSocket) {
      udpSocket.close();
      udpSocket = null;
      console.log("Host UDP socket closed");
    }
    isServerRunning = false;
  }

  function kickClient(clientIp: string): void {
    connectedSockets.forEach((socket) => {
      if (socket.remoteAddress === clientIp) {
        socket.destroy();
      }
    });
    connectedSockets = connectedSockets.filter((s) => s.remoteAddress !== clientIp);
    emitToRenderer("update-devices", [
      ...connectedSockets.map((s) => ({
        ip: s.remoteAddress || "Unknown",
        name: "Unknown",
        role: "Client" as const,
      })),
    ]);
  }

  return {
    startHostServer,
    stopHostServer,
    kickClient,
  };
};