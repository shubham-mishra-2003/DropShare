import React, { createContext, useContext, useState, useEffect } from "react";
import {
  startHostServer,
  sendHostMessage,
  sendHostFile,
  sendMultipleHostFiles,
  stopHostServer,
  kickClient,
} from "../service/HostServer";
import {
  startClientDiscovery,
  connectToHost,
  sendMessage,
  sendFile,
  sendMultipleFiles,
  stopClientDiscovery,
  disconnectFromHost,
} from "../service/ClientServer";
import { Buffer } from "buffer";
import useUsername from "../hooks/useUsername";
import { Logger } from "../utils/Logger";
import TCPSocket from "react-native-tcp-socket";
import { Vibration } from "react-native";

interface NetworkContextType {
  devices: Device[];
  socket: TCPSocket.Server | TCPSocket.Socket | null;
  messages: string[];
  receivedFiles: string[];
  sentFiles: { id: number; name: string; size: number }[];
  isConnected: boolean;
  isHost: boolean;
  startHosting: () => void;
  startClient: () => void;
  connectToHostIp: (ip: string) => void;
  sendMessage: (message: string) => void;
  sendFile: (filePath: string, fileData: Buffer) => void;
  sendMultipleFiles: (files: { filePath: string; fileData: Buffer }[]) => void;
  disconnect: () => void;
  stopHosting: () => void;
  kickClient: (clientIp: string) => void;
  stopClientDiscovery: () => void;
  disconnectFromHost: () => void;
  transferProgress: TransferProgress[];
}
const NetworkContext = createContext<NetworkContextType | undefined>(undefined);
export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [socket, setSocket] = useState<
    TCPSocket.Server | TCPSocket.Socket | null
  >(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [receivedFiles, setReceivedFiles] = useState<string[]>([]);
  const [sentFiles, setSentFiles] = useState<
    { id: number; name: string; size: number }[]
  >([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [transferProgress, setTransferProgress] = useState<TransferProgress[]>(
    []
  );
  const { username } = useUsername();

  const startHosting = () => {
    setIsHost(true);
    startHostServer(
      username,
      setDevices,
      setSocket as React.Dispatch<
        React.SetStateAction<TCPSocket.Server | null>
      >,
      setMessages,
      setReceivedFiles,
      setTransferProgress
    ).then(() => {
      Vibration.vibrate(100);
      Logger.toast("Started hosting", "info");
    });
  };

  const startClient = () => {
    setIsHost(false);
    startClientDiscovery(setDevices).then(() => {
      Vibration.vibrate(100);
      Logger.toast("Started client discovery", "info");
    });
  };

  const connectToHostIp = (ip: string) => {
    connectToHost(
      ip,
      username,
      setIsConnected,
      setSocket as React.Dispatch<
        React.SetStateAction<TCPSocket.Socket | null>
      >,
      setMessages,
      setReceivedFiles,
      setTransferProgress
    ).then(() => {
      Vibration.vibrate(100);
      Logger.toast(`Connected to host ${ip}`, "info");
    });
  };

  const sendMessageHandler = (message: string) => {
    if (!socket) {
      Logger.toast("No active socket to send message", "error");
      return;
    }
    if (isHost) {
      sendHostMessage(socket as TCPSocket.Server, message, username);
    } else {
      sendMessage(socket as TCPSocket.Socket, message, username);
    }
    setMessages((prev) => [
      ...prev,
      `${isHost ? "Host" : "Client"}: ${message}`,
    ]);
  };

  const sendFileHandler = async (filePath: string, fileData: Buffer) => {
    if (!socket) {
      Logger.toast("No active socket to send file", "error");
      return;
    }
    const fileName = filePath.split("/").pop() || "unknown";
    if (isHost) {
      await sendHostFile(
        socket as TCPSocket.Server,
        filePath,
        fileData,
        username,
        setTransferProgress
      );
    } else {
      await sendFile(
        socket as TCPSocket.Socket,
        filePath,
        fileData,
        username,
        setTransferProgress
      );
    }
    setSentFiles((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: fileName,
        size: fileData.length,
      },
    ]);
    Logger.toast(`Sent file ${fileName}`, "info");
  };

  const sendMultipleFilesHandler = async (
    files: { filePath: string; fileData: Buffer }[]
  ) => {
    if (!socket) {
      Logger.toast("No active socket to send files", "error");
      return;
    }
    if (isHost) {
      await sendMultipleHostFiles(
        socket as TCPSocket.Server,
        files,
        username,
        setTransferProgress
      );
    } else {
      await sendMultipleFiles(
        socket as TCPSocket.Socket,
        files,
        username,
        setTransferProgress
      );
    }
    setSentFiles((prev) => [
      ...prev,
      ...files.map(({ filePath, fileData }) => ({
        id: Date.now(),
        name: filePath.split("/").pop() || "unknown",
        size: fileData.length,
      })),
    ]);
    Logger.toast(`Sent ${files.length} files`, "info");
  };

  const disconnect = () => {
    if (isHost) {
      stopHosting();
    } else {
      disconnectFromHostHandler();
    }
  };

  const stopHosting = () => {
    stopHostServer();
    setSocket(null);
    setIsHost(false);
    setDevices([]);
    setMessages([]);
    setReceivedFiles([]);
    setSentFiles([]);
    setTransferProgress([]);
    Logger.toast("Host server stopped", "info");
  };

  const kickClientHandler = (clientIp: string) => {
    if (isHost) {
      kickClient(clientIp);
      setDevices((prev) => prev.filter((d) => d.ip !== clientIp));
      Logger.info(`Kicked client ${clientIp} via NetworkProvider`);
      Logger.toast(`Kicked client ${clientIp}`, "info");
    }
  };

  const stopClientDiscoveryHandler = () => {
    stopClientDiscovery();
    setDevices([]);
    Logger.toast("Client discovery stopped", "info");
  };

  const disconnectFromHostHandler = () => {
    disconnectFromHost(
      setIsConnected,
      setSocket as React.Dispatch<
        React.SetStateAction<TCPSocket.Socket | null>
      >,
      setMessages,
      setReceivedFiles,
      setTransferProgress
    );
    Logger.toast("Disconnected from host", "info");
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const value: NetworkContextType = {
    devices,
    socket,
    messages,
    receivedFiles,
    sentFiles,
    isConnected,
    isHost,
    startHosting,
    startClient,
    connectToHostIp,
    sendMessage: sendMessageHandler,
    sendFile: sendFileHandler,
    sendMultipleFiles: sendMultipleFilesHandler,
    disconnect,
    stopHosting,
    kickClient: kickClientHandler,
    stopClientDiscovery: stopClientDiscoveryHandler,
    disconnectFromHost: disconnectFromHostHandler,
    transferProgress,
  };

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
};

export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
};
