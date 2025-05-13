import dgram from "react-native-udp";
import {
  getLocalIPAddress,
  getBroadcastIPAddress,
} from "../utils/NetworkUtils";
import { Buffer } from "buffer";
import { Logger } from "../utils/Logger";
import { ERROR_CODES } from "../utils/Error";
import TCPSocket from "react-native-tcp-socket";
import { Sharing } from "./Sharing";

const UDP_PORT = 5000;
const TCP_PORT = 6000;
const MAX_CLIENTS = 5;
const APP_ID = "Dropshare_shubham-mishra";

type UdpSocket = ReturnType<typeof dgram.createSocket>;
interface ConnectedSocket extends TCPSocket.Socket {}

let connectedSockets: ConnectedSocket[] = [];
let isServerRunning = false;
let udpSocket: UdpSocket | null = null;
let server: TCPSocket.Server | null = null;
let clientSocket: TCPSocket.Socket | null = null;

export const HostServer = () => {
  const { receiveFile } = Sharing("host");

  async function startHostServer(
    username: string,
    setDevices: React.Dispatch<React.SetStateAction<Device[]>>,
    setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Server | null>>,
    setMessages: React.Dispatch<React.SetStateAction<message[]>>,
    setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
    setIsHostConnected: React.Dispatch<React.SetStateAction<boolean>>,
    setTransferProgress?: React.Dispatch<
      React.SetStateAction<TransferProgress[]>
    >
  ): Promise<void> {
    if (isServerRunning) {
      Logger.info("Host server already running, skipping start.");
      return;
    }
    isServerRunning = true;

    try {
      const ip = await getLocalIPAddress();
      const broadcastAddr = await getBroadcastIPAddress();
      Logger.info(
        `Host started on IP: ${ip}, Broadcasting to: ${broadcastAddr}`
      );

      udpSocket = dgram.createSocket({ type: "udp4" });
      udpSocket.bind(UDP_PORT);

      udpSocket.once("listening", () => {
        Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
        udpSocket!.setBroadcast(true);
        const broadcastInterval = setInterval(() => {
          const message = JSON.stringify({
            appId: APP_ID,
            role: "Host",
            ip,
            name: username,
          });
          udpSocket!.send(
            Buffer.from(message),
            0,
            message.length,
            UDP_PORT,
            broadcastAddr,
            (err) => {
              if (err) Logger.error("UDP Send Error", err);
            }
          );
        }, 2000);

        udpSocket!.on("close", () => clearInterval(broadcastInterval));
      });

      udpSocket.on("error", (err: Error) => {
        Logger.error("UDP Socket Error", err);
        isServerRunning = false;
        udpSocket?.close();
        udpSocket = null;
      });

      server = new TCPSocket.Server();
      server.on("connection", (socket: ConnectedSocket) => {
        if (connectedSockets.length >= MAX_CLIENTS) {
          socket.write(
            Buffer.from(`ERROR:${ERROR_CODES.MAX_CLIENTS_REACHED}\n`)
          );
          socket.destroy();
          Logger.warn("Max clients reached, rejecting new connection");
          return;
        }

        Logger.info(`Client connected: ${socket.remoteAddress}`);
        setIsHostConnected(true);
        connectedSockets.push(socket);
        setSocket(server);
        socket.once("data", (data) => {
          try {
            const message = data.toString();
            if (message.startsWith("USERNAME:")) {
              const clientUsername = message.replace("USERNAME:", "").trim();
              setDevices((prev) => [
                ...prev.filter((d) => d.ip !== socket.remoteAddress),
                {
                  ip: socket.remoteAddress || "Unknown",
                  name: clientUsername || "Unknown",
                  role: "Client",
                },
              ]);
            } else {
              Logger.warn(
                `Unexpected initial message from ${socket.remoteAddress}: ${message}`
              );
              setIsHostConnected(false);
            }
          } catch (err) {
            Logger.error("Error processing client username", err);
            setDevices((prev) => [
              ...prev.filter((d) => d.ip !== socket.remoteAddress),
              {
                ip: socket.remoteAddress || "Unknown",
                name: "Unknown",
                role: "Client",
              },
            ]);
            setIsHostConnected(false);
          }
          socket.on("data", (data) => {
            receiveFile({
              socket,
              data,
              setMessages,
              setReceivedFiles,
              connectedSockets,
              setTransferProgress,
            });
          });
        });

        socket.on("close", () => {
          Logger.info(`Client disconnected: ${socket.remoteAddress}`);
          connectedSockets = connectedSockets.filter((s) => s !== socket);
          setDevices((prev) =>
            prev.filter((d) => d.ip !== socket.remoteAddress)
          );
          setIsHostConnected(connectedSockets.length > 0);
        });

        socket.on("error", (err) => {
          Logger.error(`Host Socket Error for ${socket.remoteAddress}`, err);
        });
      });

      server.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
        Logger.info(`Host TCP server running on port ${TCP_PORT}`);
      });

      server.on("error", (err) => {
        Logger.error("Server Error", err);
        stopHostServer();
      });

      server.on("close", () => {
        Logger.info("Host TCP server closed");
        isServerRunning = false;
      });
    } catch (err) {
      Logger.error("Failed to start host server", err);
      isServerRunning = false;
      stopHostServer();
    }
  }

  function stopHostServer(): void {
    Logger.info("Stopping host server...");
    connectedSockets.forEach((socket) => socket.destroy());
    connectedSockets = [];
    if (server) {
      server.close();
      server = null;
      Logger.info("Host TCP server stopped");
    }
    if (udpSocket) {
      udpSocket.close();
      udpSocket = null;
      Logger.info("Host UDP socket closed");
    }
    isServerRunning = false;
  }

  function kickClient(clientIp: string): void {
    connectedSockets.forEach((socket) => {
      if (socket.remoteAddress === clientIp) {
        socket.destroy();
      }
    });
  }

  return {
    startHostServer,
    stopHostServer,
    kickClient,
    connectedSockets,
  };
};

export const ClientServer = () => {
  const { receiveFile } = Sharing("client");

  async function startClientDiscovery(
    setDevices: React.Dispatch<React.SetStateAction<Device[]>>
  ): Promise<void> {
    try {
      const localIP = await getLocalIPAddress();
      Logger.info("Client Discovery Started...");

      udpSocket = dgram.createSocket({ type: "udp4" });
      udpSocket.bind(UDP_PORT);

      udpSocket.on("listening", () => {
        Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
        udpSocket!.setBroadcast(true);
      });

      udpSocket.on("message", (msg: Buffer, rinfo) => {
        try {
          const data = JSON.parse(msg.toString());
          if (data.appId !== APP_ID) {
            return;
          }
          if (data.ip !== localIP && data.role === "Host") {
            setDevices((prev) => [
              ...prev.filter((device) => device.ip !== data.ip),
              {
                ip: data.ip,
                name: data.name || "Unknown Host",
                role: "Host",
              },
            ]);
          }
        } catch (error) {
          Logger.error("Error parsing UDP message", error);
        }
      });

      udpSocket.on("error", (err: Error) => {
        Logger.error("UDP Socket Error", err);
        stopClientDiscovery();
      });
    } catch (err) {
      Logger.error("Failed to start client discovery", err);
      stopClientDiscovery();
    }
  }

  function stopClientDiscovery(): void {
    Logger.info("Stopping client discovery...");
    if (udpSocket) {
      udpSocket.close();
      udpSocket = null;
      Logger.info("UDP socket closed");
    }
  }

  async function connectToHost(
    ip: string,
    username: string,
    setConnected: React.Dispatch<React.SetStateAction<boolean>>,
    setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
    setMessages: React.Dispatch<React.SetStateAction<message[]>>,
    setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
    setTransferProgress?: React.Dispatch<
      React.SetStateAction<TransferProgress[]>
    >
  ): Promise<void> {
    Logger.info(`Connecting to host at ${ip}...`);
    const client = new TCPSocket.Socket();
    clientSocket = client;

    client.on("connect", () => {
      Logger.info("Connected to host!");
      setConnected(true);
      setSocket(client);
      client.write(Buffer.from(`USERNAME:${username}\n`));
    });

    client.on("data", (data: string | Buffer) => {
      receiveFile({
        socket: client,
        data,
        ip,
        setMessages,
        setReceivedFiles,
        setTransferProgress,
      });
    });

    client.on("close", () => {
      Logger.info("Disconnected from host");
      disconnectFromHost(
        setConnected,
        setSocket,
        setMessages,
        setReceivedFiles,
        setTransferProgress
      );
    });

    client.on("error", (err) => {
      Logger.error("Client Socket Error", err);
      disconnectFromHost(
        setConnected,
        setSocket,
        setMessages,
        setReceivedFiles,
        setTransferProgress
      );
    });

    client.connect({ port: TCP_PORT, host: ip });
  }

  function disconnectFromHost(
    setConnected: React.Dispatch<React.SetStateAction<boolean>>,
    setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
    setMessages: React.Dispatch<React.SetStateAction<message[]>>,
    setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
    setTransferProgress?: React.Dispatch<
      React.SetStateAction<TransferProgress[]>
    >
  ): void {
    Logger.info("Disconnecting from host...");
    if (clientSocket) {
      clientSocket.end();
      clientSocket = null;
      Logger.info("Client socket closed");
    }
    setConnected(false);
    setSocket(null);
    setMessages([]);
    setReceivedFiles([]);
    setTransferProgress?.([]);
    Logger.info("Disconnected from host");
  }

  function stopClientServer(): void {
    if (clientSocket) {
      clientSocket.end();
      clientSocket = null;
      Logger.info("Client server stopped");
    }
  }

  return {
    startClientDiscovery,
    connectToHost,
    disconnectFromHost,
    stopClientServer,
  };
};
