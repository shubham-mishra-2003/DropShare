// import React, { createContext, useContext, useState, useEffect } from "react";
// import { HostServer, ClientServer } from "./Servers";
// import { Buffer } from "buffer";
// import useUsername from "../hooks/useUsername";
// import { Logger } from "../utils/Logger";
// import TCPSocket from "react-native-tcp-socket";
// import { Vibration } from "react-native";
// import { ClientSharing, HostSharing } from "./ClientSharing";

// interface NetworkContextType {
//   devices: Device[];
//   socket: TCPSocket.Server | TCPSocket.Socket | null;
//   messages: string[];
//   receivedFiles: string[];
//   sentFiles: { id: number; name: string; size: number }[];
//   isHostConnected: boolean;
//   isClientConnected: boolean;
//   isHost: boolean;
//   startHosting: () => void;
//   startClient: () => void;
//   connectToHostIp: (ip: string) => void;
//   sendMessage: (message: string) => void;
//   sendFiles: (files: { filePath: string; fileData: Buffer }[]) => void;
//   disconnect: () => void;
//   stopHosting: () => void;
//   kickClient: (clientIp: string) => void;
//   stopClient: () => void;
//   disconnectFromHost: () => void;
//   transferProgress: TransferProgress[];
// }
// const NetworkContext = createContext<NetworkContextType | undefined>(undefined);
// export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({
//   children,
// }) => {
//   const [devices, setDevices] = useState<Device[]>([]);
//   const [socket, setSocket] = useState<
//     TCPSocket.Server | TCPSocket.Socket | null
//   >(null);
//   const [messages, setMessages] = useState<string[]>([]);
//   const [receivedFiles, setReceivedFiles] = useState<string[]>([]);
//   const [sentFiles, setSentFiles] = useState<
//     { id: number; name: string; size: number }[]
//   >([]);
//   const [isHostConnected, setIsHostConnected] = useState(false);
//   const [isClientConnected, setIsClientConnected] = useState(false);
//   const [isHost, setIsHost] = useState(false);
//   const [transferProgress, setTransferProgress] = useState<TransferProgress[]>(
//     []
//   );
//   const { sendMessageInHost, sendFilesInHost } = HostSharing();
//   const { sendFilesInClient, sendMessageInClient } = ClientSharing();
//   const { startHostServer, stopHostServer, kickClient, connectedSockets } =
//     HostServer();
//   const {
//     startClientDiscovery,
//     stopClientServer,
//     connectToHost,
//     disconnectFromHost,
//   } = ClientServer();

//   const { username } = useUsername();

//   const startHosting = () => {
//     setIsHost(true);
//     startHostServer(
//       username,
//       setIsHostConnected,
//       setDevices,
//       setSocket as React.Dispatch<
//         React.SetStateAction<TCPSocket.Server | null>
//       >,
//       setMessages,
//       setReceivedFiles,
//       setTransferProgress
//     ).then(() => {
//       Vibration.vibrate(100);
//       Logger.toast("Started hosting", "info");
//     });
//   };

//   const startClient = () => {
//     setIsHost(false);
//     startClientDiscovery(setDevices).then(() => {
//       Vibration.vibrate(100);
//       Logger.toast("Started client discovery", "info");
//     });
//   };

//   const connectToHostIp = (ip: string) => {
//     connectToHost(
//       ip,
//       username,
//       setIsClientConnected,
//       setSocket as React.Dispatch<
//         React.SetStateAction<TCPSocket.Socket | null>
//       >,
//       setMessages,
//       setReceivedFiles,
//       setTransferProgress
//     ).then(() => {
//       Vibration.vibrate(100);
//       Logger.toast(`Connected to host ${ip}`, "info");
//     });
//   };

//   const sendMessageHandler = (message: string) => {
//     if (!socket) {
//       Logger.toast("No active socket to send message", "error");
//       return;
//     }
//     if (isHost) {
//       sendMessageInHost(message, username);
//     } else {
//       sendMessageInClient(socket as TCPSocket.Socket, message, username);
//     }
//     setMessages((prev) => [
//       ...prev,
//       `${isHost ? "Host" : "Client"}: ${message}`,
//     ]);
//   };

//   const sendFilesHandler = async (
//     files: { filePath: string; fileData: Buffer }[]
//   ) => {
//     if (!socket) {
//       Logger.toast("No active socket to send files", "error");
//       return;
//     }
//     if (isHost) {
//       await sendFilesInHost(
//         socket as TCPSocket.Server,
//         files,
//         username,
//         // connectedSockets,
//         setTransferProgress
//       );
//     } else {
//       await sendFilesInClient(
//         socket as TCPSocket.Socket,
//         files,
//         username,
//         setTransferProgress
//       );
//     }
//     setSentFiles((prev) => [
//       ...prev,
//       ...files.map(({ filePath, fileData }) => ({
//         id: Date.now(),
//         name: filePath.split("/").pop() || "unknown",
//         size: fileData.length,
//       })),
//     ]);
//     Logger.toast(`Sent ${files.length} files`, "info");
//   };

//   const disconnect = () => {
//     if (isHost) {
//       stopHosting();
//     } else {
//       disconnectFromHostHandler();
//     }
//   };

//   const stopHosting = () => {
//     stopHostServer();
//     setSocket(null);
//     setIsHost(false);
//     setDevices([]);
//     setMessages([]);
//     setReceivedFiles([]);
//     setSentFiles([]);
//     setTransferProgress([]);
//     Logger.toast("Host server stopped", "info");
//   };

//   const kickClientHandler = (clientIp: string) => {
//     if (isHost) {
//       kickClient(clientIp, setDevices);
//       setDevices((prev) => prev.filter((d) => d.ip !== clientIp));
//       Logger.info(`Kicked client ${clientIp} via NetworkProvider`);
//       Logger.toast(`Kicked client ${clientIp}`, "info");
//     }
//   };

//   const stopClientHandler = () => {
//     stopClientServer();
//     setDevices([]);
//     Logger.toast("Client discovery stopped", "info");
//   };

//   const disconnectFromHostHandler = () => {
//     disconnectFromHost(
//       setIsClientConnected,
//       setSocket as React.Dispatch<
//         React.SetStateAction<TCPSocket.Socket | null>
//       >,
//       setMessages,
//       setReceivedFiles,
//       setTransferProgress
//     );
//     Logger.toast("Disconnected from host", "info");
//   };

//   useEffect(() => {
//     return () => {
//       disconnect();
//     };
//   }, []);

//   const value: NetworkContextType = {
//     devices,
//     socket,
//     messages,
//     receivedFiles,
//     sentFiles,
//     isHostConnected,
//     isClientConnected,
//     isHost,
//     startHosting,
//     startClient,
//     connectToHostIp,
//     sendMessage: sendMessageHandler,
//     sendFiles: sendFilesHandler,
//     disconnect,
//     stopHosting,
//     kickClient: kickClientHandler,
//     stopClient: stopClientHandler,
//     disconnectFromHost: disconnectFromHostHandler,
//     transferProgress,
//   };

//   return (
//     <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
//   );
// };

// export const useNetwork = (): NetworkContextType => {
//   const context = useContext(NetworkContext);
//   if (!context) {
//     throw new Error("useNetwork must be used within a NetworkProvider");
//   }
//   return context;
// };

import React, { createContext, useContext, useState, useEffect } from "react";
import { HostServer, ClientServer } from "../service/Servers";
import { Buffer } from "buffer";
import useUsername from "../hooks/useUsername";
import { Logger } from "../utils/Logger";
import TCPSocket from "react-native-tcp-socket";
import { Vibration } from "react-native";
import { ClientSharing, HostSharing } from "./Sharing";

interface NetworkContextType {
  devices: Device[];
  socket: TCPSocket.Server | TCPSocket.Socket | null;
  messages: string[];
  receivedFiles: string[];
  sentFiles: { id: number; name: string; size: number }[];
  isHostConnected: boolean;
  isClientConnected: boolean;
  isHost: boolean;
  startHosting: () => void;
  startClient: () => void;
  connectToHostIp: (ip: string) => void;
  sendMessage: (message: string) => void;
  sendFiles: (files: { filePath: string; fileData: Buffer }[]) => void;
  disconnect: () => void;
  stopHosting: () => void;
  kickClient: (clientIp: string) => void;
  stopClient: () => void;
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
  const [isHostConnected, setIsHostConnected] = useState(false);
  const [isClientConnected, setIsClientConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [transferProgress, setTransferProgress] = useState<TransferProgress[]>(
    []
  );
  const { username } = useUsername();
  const { sendMessageInHost, sendFilesInHost } = HostSharing();
  const { sendFilesInClient, sendMessageInClient } = ClientSharing();
  const { startHostServer, stopHostServer, kickClient, connectedSockets } = HostServer();
  const {
    startClientDiscovery,
    stopClientServer,
    connectToHost,
    disconnectFromHost,
  } = ClientServer();

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
      setIsClientConnected,
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
      sendMessageInHost(message, username, connectedSockets);
    } else {
      sendMessageInClient(socket as TCPSocket.Socket, message, username, connectedSockets);
    }
    setMessages((prev) => [
      ...prev,
      `${isHost ? "Host" : "Client"}: ${message}`,
    ]);
  };

  const sendFilesHandler = async (
    files: { filePath: string; fileData: Buffer }[]
  ) => {
    if (!socket) {
      Logger.toast("No active socket to send files", "error");
      return;
    }
    if (isHost) {
      await sendFilesInHost(
        socket as TCPSocket.Server,
        files,
        username,
        connectedSockets,
        setTransferProgress
      );
    } else {
      await sendFilesInClient(
        socket as TCPSocket.Socket,
        files,
        username,
        connectedSockets,
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

  const stopClientHandler = () => {
    stopClientServer();
    setDevices([]);
    Logger.toast("Client discovery stopped", "info");
  };

  const disconnectFromHostHandler = () => {
    disconnectFromHost(
      setIsClientConnected,
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
    isHostConnected,
    isClientConnected,
    isHost,
    startHosting,
    startClient,
    connectToHostIp,
    sendMessage: sendMessageHandler,
    sendFiles: sendFilesHandler,
    disconnect,
    stopHosting,
    kickClient: kickClientHandler,
    stopClient: stopClientHandler,
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
