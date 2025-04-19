import dgram from "react-native-udp";
import {
  getLocalIPAddress,
  getBroadcastIPAddress,
} from "../utils/NetworkUtils";
import { Buffer } from "buffer";
import { Logger } from "../utils/Logger";
import { ERROR_CODES } from "../utils/Error";
import TCPSocket from "react-native-tcp-socket";
import { HostSharing } from "./HostSharing";
import { ClientSharing } from "./ClientSharing";

const UDP_PORT = 5000;
const TCP_PORT = 6000;
const MAX_CLIENTS = 5;

type UdpSocket = ReturnType<typeof dgram.createSocket>;
interface ConnectedSocket extends TCPSocket.Socket {}

let connectedSockets: ConnectedSocket[] = [];
let isServerRunning = false;
let udpSocket: UdpSocket | null = null;
let server: TCPSocket.Server | null = null;
let clientSocket: TCPSocket.Socket | null = null;

export const HostServer = () => {
  let setDevicesRef: React.Dispatch<React.SetStateAction<Device[]>> | null =
    null;

  async function startHostServer(
    username: string,
    setConnected: React.Dispatch<React.SetStateAction<boolean>>,
    setDevices: React.Dispatch<React.SetStateAction<Device[]>>,
    setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Server | null>>,
    setMessages: React.Dispatch<React.SetStateAction<string[]>>,
    setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
    setTransferProgress?: React.Dispatch<
      React.SetStateAction<TransferProgress[]>
    >,
  ): Promise<void> {
    if (isServerRunning) {
      Logger.info("Host server already running, skipping start.");
      return;
    }
    isServerRunning = true;
    setDevicesRef = setDevices;

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
          const message = JSON.stringify({ role: "Host", ip, name: username });
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
        setConnected(true);
        if (connectedSockets.length >= MAX_CLIENTS) {
          socket.write(
            Buffer.from(`ERROR:${ERROR_CODES.MAX_CLIENTS_REACHED}\n`)
          );
          socket.destroy();
          Logger.warn("Max clients reached, rejecting new connection");
          return;
        }

        Logger.info(`Client connected: ${socket.remoteAddress}`);
        connectedSockets.push(socket);
        setSocket(server);
        setDevices((prev) => [
          ...prev.filter((d) => d.ip !== socket.remoteAddress),
          {
            ip: socket.remoteAddress || "Unknown",
            name: "Unknown",
            role: "Client",
          },
        ]);

        socket.on("data", (data) => {
          const { receiveFileInHost } = HostSharing();
          try {
            const message = data.toString().trim();
            if (message.startsWith("{")) {
              const parsed = JSON.parse(message);
              if (parsed.type === "init" && parsed.name) {
                setDevices((prev) =>
                  prev.map((d) =>
                    d.ip === socket.remoteAddress
                      ? { ...d, name: parsed.name }
                      : d
                  )
                );
                Logger.info(
                  `Client ${socket.remoteAddress} identified as ${parsed.name}`
                );
                return;
              }
            }
            receiveFileInHost({
              data,
              ip: socket.remoteAddress || "Unknown",
              setMessages,
              setReceivedFiles,
              socket,
              setTransferProgress,
            });
          } catch (error) {
            Logger.error("Error processing client data", error);
            receiveFileInHost({
              data,
              ip: socket.remoteAddress || "Unknown",
              setMessages,
              setReceivedFiles,
              socket,
              setTransferProgress,
            });
          }
        });

        socket.on("close", () => {
          Logger.info(`Client disconnected: ${socket.remoteAddress}`);
          connectedSockets = connectedSockets.filter((s) => s !== socket);
          setDevices((prev) =>
            prev.filter((d) => d.ip !== socket.remoteAddress)
          );
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
    setDevicesRef = null;
  }

  function kickClient(clientIp: string): void {
    if (!setDevicesRef) {
      Logger.warn("Cannot kick client: setDevices not initialized");
      return;
    }

    const socketsToKick = connectedSockets.filter(
      (socket) => socket.remoteAddress === clientIp
    );
    if (socketsToKick.length === 0) {
      Logger.warn(`No client found with IP: ${clientIp}`);
      return;
    }

    socketsToKick.forEach((socket) => {
      Logger.info(`Kicking client: ${clientIp}`);
      socket.destroy();
    });

    connectedSockets = connectedSockets.filter(
      (socket) => socket.remoteAddress !== clientIp
    );
    setDevicesRef((prev) => prev.filter((d) => d.ip !== clientIp));
    Logger.info(
      `Client ${clientIp} removed from connected sockets and devices`
    );
  }

  return {
    startHostServer,
    stopHostServer,
    kickClient,
  };
};

export const ClientServer = () => {
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
          if (data.ip !== localIP && data.role === "Host") {
            setDevices((prev) => [
              ...prev.filter((device) => device.ip !== data.ip),
              {
                ip: data.ip,
                name: data.name || "Unknown",
                role: "Host",
              },
            ]);
            Logger.info(`Discovered host: ${data.ip} (${data.name})`);
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
    setMessages: React.Dispatch<React.SetStateAction<string[]>>,
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
      const initMessage = JSON.stringify({ type: "init", name: username });
      client.write(Buffer.from(initMessage + "\n"));
    });

    client.on("data", (data: string | Buffer) => {
      const { receiveFileInClient } = ClientSharing();
      receiveFileInClient({
        client,
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
    setMessages: React.Dispatch<React.SetStateAction<string[]>>,
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
