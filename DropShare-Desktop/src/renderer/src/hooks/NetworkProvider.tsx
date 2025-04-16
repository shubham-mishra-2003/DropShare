// import React, { createContext, useContext, useState, useEffect } from "react";
// import {
//   startHostServer,
//   sendHostMessage,
//   sendHostFile,
// } from "../service/HostServer";
// import {
//   startClientDiscovery,
//   connectToHost,
//   sendMessage,
//   sendFile,
// } from "../service/ClientServer";
// import { Buffer } from "buffer";
// import useUsername from "../hooks/useUsername";

// interface NetworkContextType {
//   devices: Device[];
//   socket: any;
//   messages: string[];
//   receivedFiles: string[];
//   sentFiles: any[];
//   isConnected: boolean;
//   isHost: boolean;
//   startHosting: () => void;
//   startClient: () => void;
//   connectToHostIp: (ip: string) => void;
//   sendMessage: (message: string) => void;
//   sendFile: (filePath: string, fileData: Buffer) => void;
//   disconnect: () => void;
// }

// const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

// export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({
//   children,
// }) => {
//   const [devices, setDevices] = useState<Device[]>([]);
//   const [socket, setSocket] = useState<any>(null);
//   const [messages, setMessages] = useState<string[]>([]);
//   const [receivedFiles, setReceivedFiles] = useState<string[]>([]);
//   const [sentFiles, setSentFiles] = useState<any[]>([]);
//   const [isConnected, setIsConnected] = useState(false);
//   const [isHost, setIsHost] = useState(false);
//   const { username } = useUsername();

//   const startHosting = () => {
//     setIsHost(true);
//     startHostServer(
//       username,
//       setDevices,
//       setSocket,
//       setMessages,
//       setReceivedFiles
//     );
//   };

//   const startClient = () => {
//     setIsHost(false);
//     startClientDiscovery(setDevices);
//   };

//   const connectToHostIp = (ip: string) => {
//     connectToHost(
//       ip,
//       username,
//       setIsConnected,
//       setSocket,
//       setMessages,
//       setReceivedFiles
//     );
//   };

//   const sendMessageHandler = (message: string) => {
//     if (!socket) return;
//     if (isHost) {
//       sendHostMessage(socket, username, message);
//     } else {
//       sendMessage(socket, message, username);
//     }
//     setMessages((prev) => [
//       ...prev,
//       `${isHost ? "Host" : "Client"}: ${message}`,
//     ]);
//   };

//   const sendFileHandler = async (filePath: string, fileData: Buffer) => {
//     if (!socket) return;
//     const fileName = filePath.split("/").pop() || "unknown";
//     if (isHost) {
//       sendHostFile(socket, filePath, fileData, username);
//     } else {
//       sendFile(socket, filePath, fileData, username);
//     }
//     setSentFiles((prev) => [
//       ...prev,
//       {
//         id: Date.now(),
//         name: fileName,
//         size: fileData.length,
//       },
//     ]);
//   };

//   const disconnect = () => {
//     if (socket) {
//       socket.close();
//     }
//     setSocket(null);
//     setIsConnected(false);
//     setDevices([]);
//     setMessages([]);
//     setReceivedFiles([]);
//     setSentFiles([]);
//   };

//   useEffect(() => {
//     return () => {
//       if (socket) {
//         socket.close();
//       }
//     };
//   }, [socket]);

//   const value = {
//     devices,
//     socket,
//     messages,
//     receivedFiles,
//     sentFiles,
//     isConnected,
//     isHost,
//     startHosting,
//     startClient,
//     connectToHostIp,
//     sendMessage: sendMessageHandler,
//     sendFile: sendFileHandler,
//     disconnect,
//   };

//   return (
//     <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
//   );
// };

// export const useNetwork = () => {
//   const context = useContext(NetworkContext);
//   if (!context) {
//     throw new Error("useNetwork must be used within a NetworkProvider");
//   }
//   return context;
// };

// // working till now

import React, { createContext, useContext, useState, useEffect } from "react";
import { Buffer } from "buffer";
import useUsername from "../hooks/useUsername";
import { MAX_CONCURRENT_FILES, MAX_TOTAL_SIZE } from "../utils/NetworkUtils";
import net from "net";

interface SentFile {
  id: number;
  name: string;
  size: number;
}

interface ReceivedFile {
  path: string;
  originalName: string;
}

interface NetworkContextType {
  devices: Device[];
  socket: net.Socket | net.Server | null;
  messages: string[];
  receivedFiles: ReceivedFile[];
  sentFiles: SentFile[];
  isConnected: boolean;
  isHost: boolean;
  transferProgress: TransferProgress;
  startHosting: () => void;
  startClient: () => void;
  connectToHostIp: (ip: string) => void;
  sendMessage: (message: string) => void;
  sendFile: (filePath: string, fileData: Buffer) => void;
  disconnect: () => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [socket, setSocket] = useState<net.Socket | net.Server | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [receivedFiles, setReceivedFiles] = useState<string[]>([]);
  const [sentFiles, setSentFiles] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [transferProgress, setTransferProgress] = useState<TransferProgress>(
    {},
  );
  const { username } = useUsername();

  const startHosting = () => {
    setIsHost(true);
    window.electron
      .startHostServer(
        username,
        setDevices,
        setSocket,
        setMessages,
        setReceivedFiles,
        setTransferProgress,
      )
      .catch((err) => {
        console.error("Failed to start host server:", err);
        setIsHost(false);
      });
  };

  const startClient = () => {
    setIsHost(false);
    window.electron.startClientDiscovery(username, setDevices);
  };

  const connectToHostIp = (ip: string) => {
    window.electron
      .connectToHost(
        ip,
        username,
        setIsConnected,
        setSocket,
        setMessages,
        setReceivedFiles,
        setTransferProgress,
      )
      .catch((err) => {
        console.error("Failed to connect to host:", err);
        setIsConnected(false);
      });
  };

  const sendMessage = (message: string) => {
    if (!socket) {
      console.warn("No socket available to send message");
      return;
    }
    if (isHost) {
      window.electron
        .sendHostMessage(message, username)
        .then(() => {
          setMessages((prev) => [...prev, `Host: ${message}`]);
        })
        .catch((err) => {
          console.error("Failed to send host message:", err);
        });
    } else {
      window.electron
        .sendMessage(socket as net.Socket, message, username)
        .then(() => {
          setMessages((prev) => [...prev, `Client: ${message}`]);
        })
        .catch((err) => {
          console.error("Failed to send client message:", err);
        });
    }
  };

  const sendFile = async (filePath: string, fileData: Buffer) => {
    if (!socket) {
      console.warn("No socket available to send file");
      return;
    }

    const fileName = filePath.split("/").pop() || "unknown";
    const fileSize = fileData.length;

    // Enforce limits
    if (sentFiles.length >= MAX_CONCURRENT_FILES) {
      console.log("❌ Limit exceeded: Max 15 files at a time");
      return;
    }
    const totalSize =
      sentFiles.reduce((sum, file) => sum + file.size, 0) + fileSize;
    if (totalSize > MAX_TOTAL_SIZE) {
      console.log("❌ Limit exceeded: Max 5GB total size");
      return;
    }

    try {
      if (isHost) {
        await window.electron.sendHostFile(
          filePath,
          fileData,
          username,
          setTransferProgress,
        );
      } else {
        await window.electron.sendFile(
          socket as net.Socket,
          filePath,
          fileData,
          username,
          setTransferProgress,
        );
      }
      setSentFiles((prev) => [
        ...prev,
        { id: Date.now(), name: fileName, size: fileData.length },
      ]);
    } catch (err) {
      console.error("Failed to send file:", err);
    }
  };

  const disconnect = () => {
    if (socket) {
      try {
        if (isHost) {
          window.electron.stopHosting();
        } else {
          window.electron.disconnectClient();
        }
      } catch (err) {
        console.error("Error during disconnect:", err);
      }
    }
    setSocket(null);
    setIsConnected(false);
    setIsHost(false);
    setDevices([]);
    setMessages([]);
    setReceivedFiles([]);
    setSentFiles([]);
    setTransferProgress({});
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
    transferProgress,
    startHosting,
    startClient,
    connectToHostIp,
    sendMessage,
    sendFile,
    disconnect,
  };

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
};
