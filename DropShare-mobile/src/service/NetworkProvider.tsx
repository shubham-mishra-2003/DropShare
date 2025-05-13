// import React, {
//   createContext,
//   useContext,
//   useState,
//   useEffect,
//   useCallback,
// } from "react";
// import { HostServer, ClientServer } from "../service/Servers";
// import useUsername from "../hooks/useUsername";
// import { Logger } from "../utils/Logger";
// import TCPSocket from "react-native-tcp-socket";
// import { Vibration } from "react-native";
// import { Sharing } from "./Sharing";
// import { getLocalIPAddress } from "../utils/NetworkUtils";

// interface NetworkContextType {
//   devices: Device[];
//   socket: TCPSocket.Server | TCPSocket.Socket | null;
//   messages: message[];
//   receivedFiles: string[];
//   isHostConnected: boolean;
//   isClientConnected: boolean;
//   isHost: boolean;
//   startHosting: () => void;
//   startClient: () => void;
//   connectToHostIp: (ip: string) => void;
//   sendMessage: (message: string) => void;
//   sendFiles: (files: { filePath: string }[]) => void;
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
//   const [messages, setMessages] = useState<message[]>([]);
//   const [receivedFiles, setReceivedFiles] = useState<string[]>([]);
//   const [isHostConnected, setIsHostConnected] = useState(false);
//   const [isClientConnected, setIsClientConnected] = useState(false);
//   const [isHost, setIsHost] = useState(false);
//   const [transferProgress, setTransferProgress] = useState<TransferProgress[]>(
//     []
//   );
//   const { username, loadUsername } = useUsername();

//   useCallback(() => {
//     loadUsername();
//   }, [loadUsername]);

//   const { sendMessage, sendFiles } = Sharing(isHost ? "host" : "client");
//   const { startHostServer, stopHostServer, kickClient, connectedSockets } =
//     HostServer();
//   const {
//     startClientDiscovery,
//     stopClientServer,
//     connectToHost,
//     disconnectFromHost,
//   } = ClientServer();

//   const startHosting = () => {
//     setIsHost(true);
//     startHostServer(
//       username,
//       setDevices,
//       setSocket as React.Dispatch<
//         React.SetStateAction<TCPSocket.Server | null>
//       >,
//       setMessages,
//       setReceivedFiles,
//       setIsHostConnected,
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

//   const sendMessageHandler = async (message: string) => {
//     const ip = await getLocalIPAddress();
//     if (!socket) {
//       Logger.toast("No active socket to send message", "error");
//       return;
//     }
//     sendMessage(
//       isHost ? connectedSockets : (socket as TCPSocket.Socket),
//       message,
//       username,
//       connectedSockets,
//       ip
//     );
//     setMessages((prev) => [
//       ...prev,
//       {
//         ip: ip,
//         message: message,
//         name: username,
//       },
//     ]);
//   };

//   const sendFilesHandler = async (files: { filePath: string }[]) => {
//     if (!socket) {
//       Logger.toast("No active socket to send files", "error");
//       return;
//     }
//     try {
//       await sendFiles(
//         isHost ? connectedSockets : (socket as TCPSocket.Socket),
//         files,
//         username,
//         connectedSockets,
//         setTransferProgress
//       );
//       Logger.toast(`Sent ${files.length} file(s)`, "info");
//     } catch (error) {
//       Logger.error("Failed to send files", error);
//       Logger.toast("Failed to send files", "error");
//     }
//   };

//   const disconnect = () => {
//     if (isHost) {
//       stopHosting();
//     } else {
//       disconnectFromHost(
//         setIsClientConnected,
//         setSocket as React.Dispatch<
//           React.SetStateAction<TCPSocket.Socket | null>
//         >,
//         setMessages,
//         setReceivedFiles,
//         setTransferProgress
//       );
//     }
//     setSocket(null);
//     setDevices([]);
//     setIsHostConnected(false);
//     setIsClientConnected(false);
//     setTransferProgress([]);
//   };

//   const stopHosting = () => {
//     stopHostServer();
//     setSocket(null);
//     setDevices([]);
//     setIsHostConnected(false);
//     setIsHost(false);
//     setTransferProgress([]);
//     Logger.toast("Stopped hosting", "info");
//   };

//   const stopClient = () => {
//     stopClientServer();
//     setDevices([]);
//     setIsClientConnected(false);
//     setTransferProgress([]);
//     Logger.toast("Stopped client discovery", "info");
//   };

//   const kickClientHandler = (clientIp: string) => {
//     kickClient(clientIp);
//     setDevices((prev) => prev.filter((device) => device.ip !== clientIp));
//     Logger.toast(`Kicked client ${clientIp}`, "info");
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
//     setSocket(null);
//     setIsClientConnected(false);
//     setDevices([]);
//     setTransferProgress([]);
//     Logger.toast("Disconnected from host", "info");
//   };

//   useEffect(() => {
//     return () => {
//       if (socket) {
//         if (isHost) {
//           stopHostServer();
//         } else {
//           disconnectFromHost(
//             setIsClientConnected,
//             setSocket as React.Dispatch<
//               React.SetStateAction<TCPSocket.Socket | null>
//             >,
//             setMessages,
//             setReceivedFiles,
//             setTransferProgress
//           );
//         }
//       }
//     };
//   }, [socket, isHost]);

//   return (
//     <NetworkContext.Provider
//       value={{
//         devices,
//         socket,
//         messages,
//         receivedFiles,
//         isHostConnected,
//         isClientConnected,
//         isHost,
//         startHosting,
//         startClient,
//         connectToHostIp,
//         sendMessage: sendMessageHandler,
//         sendFiles: sendFilesHandler,
//         disconnect,
//         stopHosting,
//         kickClient: kickClientHandler,
//         stopClient,
//         disconnectFromHost: disconnectFromHostHandler,
//         transferProgress,
//       }}
//     >
//       {children}
//     </NetworkContext.Provider>
//   );
// };

// export const useNetwork = () => {
//   const context = useContext(NetworkContext);
//   if (!context) {
//     throw new Error("useNetwork must be used within a NetworkProvider");
//   }
//   return context;
// };

// // pause and resume mechanism
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { HostServer, ClientServer } from "../service/Servers";
import useUsername from "../hooks/useUsername";
import { Logger } from "../utils/Logger";
import TCPSocket from "react-native-tcp-socket";
import { Vibration } from "react-native";
import { Sharing } from "./Sharing";
import { getLocalIPAddress } from "../utils/NetworkUtils";

interface NetworkContextType {
  devices: Device[];
  socket: TCPSocket.Server | TCPSocket.Socket | null;
  messages: message[];
  receivedFiles: string[];
  isHostConnected: boolean;
  isClientConnected: boolean;
  isHost: boolean;
  startHosting: () => void;
  startClient: () => void;
  connectToHostIp: (ip: string) => void;
  sendMessage: (message: string) => void;
  sendFiles: (files: { filePath: string }[]) => void;
  disconnect: () => void;
  stopHosting: () => void;
  kickClient: (clientIp: string) => void;
  stopClient: () => void;
  disconnectFromHost: () => void;
  transferProgress: TransferProgress[];
  pauseTransfer: (fileId: string) => void;
  resumeTransfer: (fileId: string) => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [socket, setSocket] = useState<
    TCPSocket.Server | TCPSocket.Socket | null
  >(null);
  const [messages, setMessages] = useState<message[]>([]);
  const [receivedFiles, setReceivedFiles] = useState<string[]>([]);
  const [isHostConnected, setIsHostConnected] = useState(false);
  const [isClientConnected, setIsClientConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [transferProgress, setTransferProgress] = useState<TransferProgress[]>(
    []
  );
  const { username, loadUsername } = useUsername();

  useCallback(() => {
    loadUsername();
  }, [loadUsername]);

  const { sendMessage, sendFiles, pauseTransfer, resumeTransfer } = Sharing(
    isHost ? "host" : "client"
  );
  const { startHostServer, stopHostServer, kickClient, connectedSockets } =
    HostServer();
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
      setIsHostConnected,
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

  const sendMessageHandler = async (message: string) => {
    const ip = await getLocalIPAddress();
    if (!socket) {
      Logger.toast("No active socket to send message", "error");
      return;
    }
    sendMessage(
      isHost ? connectedSockets : (socket as TCPSocket.Socket),
      message,
      username,
      connectedSockets,
      ip
    );
    setMessages((prev) => [
      ...prev,
      {
        ip: ip,
        message: message,
        name: username,
      },
    ]);
  };

  const sendFilesHandler = async (files: { filePath: string }[]) => {
    if (!socket) {
      Logger.toast("No active socket to send files", "error");
      return;
    }
    try {
      await sendFiles(
        isHost ? connectedSockets : (socket as TCPSocket.Socket),
        files,
        username,
        connectedSockets,
        setTransferProgress
      );
      Logger.toast(`Sent ${files.length} file(s)`, "info");
    } catch (error) {
      Logger.error("Failed to send files", error);
      Logger.toast("Failed to send files", "error");
    }
  };

  const pauseTransferHandler = async (fileId: string) => {
    try {
      await pauseTransfer(fileId, setTransferProgress);
      Logger.toast(`Paused transfer ${fileId}`, "info");
    } catch (error) {
      Logger.error(`Failed to pause transfer ${fileId}`, error);
      Logger.toast("Failed to pause transfer", "error");
    }
  };

  const resumeTransferHandler = async (fileId: string) => {
    try {
      await resumeTransfer(fileId, setTransferProgress);
      Logger.toast(`Resumed transfer ${fileId}`, "info");
    } catch (error) {
      Logger.error(`Failed to resume transfer ${fileId}`, error);
      Logger.toast("Failed to resume transfer", "error");
    }
  };

  const disconnect = () => {
    if (isHost) {
      stopHosting();
    } else {
      disconnectFromHost(
        setIsClientConnected,
        setSocket as React.Dispatch<
          React.SetStateAction<TCPSocket.Socket | null>
        >,
        setMessages,
        setReceivedFiles,
        setTransferProgress
      );
    }
    setSocket(null);
    setDevices([]);
    setIsHostConnected(false);
    setIsClientConnected(false);
    setTransferProgress([]);
  };

  const stopHosting = () => {
    stopHostServer();
    setSocket(null);
    setDevices([]);
    setIsHostConnected(false);
    setIsHost(false);
    setTransferProgress([]);
    Logger.toast("Stopped hosting", "info");
  };

  const stopClient = () => {
    stopClientServer();
    setDevices([]);
    setIsClientConnected(false);
    setTransferProgress([]);
    Logger.toast("Stopped client discovery", "info");
  };

  const kickClientHandler = (clientIp: string) => {
    kickClient(clientIp);
    setDevices((prev) => prev.filter((device) => device.ip !== clientIp));
    Logger.toast(`Kicked client ${clientIp}`, "info");
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
    setSocket(null);
    setIsClientConnected(false);
    setDevices([]);
    setTransferProgress([]);
    Logger.toast("Disconnected from host", "info");
  };

  useEffect(() => {
    return () => {
      if (socket) {
        if (isHost) {
          stopHostServer();
        } else {
          disconnectFromHost(
            setIsClientConnected,
            setSocket as React.Dispatch<
              React.SetStateAction<TCPSocket.Socket | null>
            >,
            setMessages,
            setReceivedFiles,
            setTransferProgress
          );
        }
      }
    };
  }, [socket, isHost]);

  return (
    <NetworkContext.Provider
      value={{
        devices,
        socket,
        messages,
        receivedFiles,
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
        stopClient,
        disconnectFromHost: disconnectFromHostHandler,
        transferProgress,
        pauseTransfer: pauseTransferHandler,
        resumeTransfer: resumeTransferHandler,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
};
