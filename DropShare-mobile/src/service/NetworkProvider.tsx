// import React, { createContext, useContext, useState, useEffect } from "react";
// import useUsername from "../hooks/useUsername";
// import { Logger } from "../utils/Logger";
// import TCPSocket from "react-native-tcp-socket";
// import { Vibration } from "react-native";
// import { ClientServer, HostServer } from "./Servers";

// import { HostSharing } from "./HostSharing";
// import { ClientSharing } from "./ClientSharing";

// interface TransferProgress {
//   fileId: string;
//   fileName: string;
//   progress: string;
//   speed: string;
//   percentage: number;
//   error?: string;
// }

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
//   const { username } = useUsername();
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

//   const startHosting = () => {
//     setIsHost(true);
//     startHostServer(
//       username,
//       setDevices,
//       setSocket as React.Dispatch<
//         React.SetStateAction<TCPSocket.Server | null>
//       >,
//       setMessages,
//       setIsHostConnected,
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
//       sendMessageInHost(message, username, connectedSockets);
//     } else {
//       sendMessageInClient(
//         socket as TCPSocket.Socket,
//         message,
//         username,
//         connectedSockets
//       );
//     }
//     setMessages((prev) => [
//       ...prev,
//       `${isHost ? "Host" : "Client"}: ${message}`,
//     ]);
//   };

//   const sendFilesHandler = async (files: { filePath: string }[]) => {
//     if (!socket) {
//       Logger.toast("No active socket to send files", "error");
//       return;
//     }
//     if (isHost) {
//       await sendFilesInHost(
//         socket as TCPSocket.Server,
//         files,
//         username,
//         connectedSockets,
//         setTransferProgress
//       );
//     } else {
//       await sendFilesInClient(
//         socket as TCPSocket.Socket,
//         files,
//         username,
//         connectedSockets,
//         setTransferProgress
//       );
//     }
//     setSentFiles((prev) => [
//       ...prev,
//       ...files.map(({ filePath }) => ({
//         id: Date.now(),
//         name: filePath.split("/").pop() || "unknown",
//         size: 0, // Size not available without RNFS.stat; consider adding if needed
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
//       kickClient(clientIp);
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

// import React, { createContext, useContext, useState, useEffect } from "react";
// import useUsername from "../hooks/useUsername";
// import { Logger } from "../utils/Logger";
// import TCPSocket from "react-native-tcp-socket";
// import { Vibration } from "react-native";
// import RNFS from "react-native-fs";
// import { ClientServer, HostServer } from "./Servers";
// import { HostSharing } from "./HostSharing";
// import { ClientSharing } from "./ClientSharing";
// import { DropShareError, ERROR_CODES } from "../utils/Error";

// interface TransferProgress {
//   fileId: string;
//   fileName: string;
//   progress: string;
//   speed: string;
//   percentage: number;
//   status: string;
//   error?: string;
// }

// interface Device {
//   ip: string;
//   // Add other device properties if defined in Servers
// }

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
//   const { username } = useUsername();
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

//   const startHosting = () => {
//     setIsHost(true);
//     startHostServer(
//       username,
//       setDevices,
//       setSocket as React.Dispatch<
//         React.SetStateAction<TCPSocket.Server | null>
//       >,
//       setMessages,
//       setIsHostConnected,
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
//     )
//       .then(() => {
//         Vibration.vibrate(100);
//         Logger.toast(`Connected to host ${ip}`, "info");
//       })
//       .catch((error) => {
//         Logger.error(`Failed to connect to host ${ip}`, error);
//         Logger.toast(`Failed to connect to host: ${error.message}`, "error");
//       });
//   };

//   const sendMessageHandler = (message: string) => {
//     if (!socket) {
//       Logger.toast("No active socket to send message", "error");
//       return;
//     }
//     if (isHost) {
//       sendMessageInHost(message, username, connectedSockets);
//     } else {
//       sendMessageInClient(
//         socket as TCPSocket.Socket,
//         message,
//         username,
//         connectedSockets
//       );
//     }
//     setMessages((prev) => [
//       ...prev,
//       `${isHost ? "Host" : "Client"} (${username}): ${message}`,
//     ]);
//   };

//   const sendFilesHandler = async (files: { filePath: string }[]) => {
//     if (!socket) {
//       Logger.toast("No active socket to send files", "error");
//       throw new DropShareError(ERROR_CODES.NETWORK_ERROR, "No active socket");
//     }
//     try {
//       const fileDetails = await Promise.all(
//         files.map(async ({ filePath }) => {
//           const stat = await RNFS.stat(filePath);
//           return {
//             id: Date.now() + Math.random(), // Unique ID
//             name: filePath.split("/").pop() || "unknown",
//             size: stat.size,
//           };
//         })
//       );

//       if (isHost) {
//         await sendFilesInHost(
//           socket as TCPSocket.Server,
//           files,
//           username,
//           connectedSockets,
//           setTransferProgress
//         );
//       } else {
//         await sendFilesInClient(
//           socket as TCPSocket.Socket,
//           files,
//           username,
//           connectedSockets,
//           setTransferProgress
//         );
//       }

//       setSentFiles((prev) => [...prev, ...fileDetails]);
//       Logger.toast(`Sent ${files.length} files`, "info");
//     } catch (error) {
//       const err = DropShareError.from(
//         error,
//         ERROR_CODES.NETWORK_ERROR,
//         `Failed to send files: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`
//       );
//       Logger.error("Failed to send files", error);
//       setTransferProgress((prev) => [
//         ...prev,
//         ...files.map(({ filePath }) => ({
//           fileId: `${username}_${filePath.split("/").pop() || "unknown"}`,
//           fileName: filePath.split("/").pop() || "unknown",
//           progress: "0/0 MB",
//           speed: "0 MB/s",
//           percentage: 0,
//           status: "Failed",
//           error: err.message,
//         })),
//       ]);
//       Logger.toast(`Failed to send files: ${err.message}`, "error");
//       throw err;
//     }
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
//     setIsHostConnected(false);
//     setDevices([]);
//     setMessages([]);
//     setReceivedFiles([]);
//     setSentFiles([]);
//     setTransferProgress([]);
//     Logger.toast("Host server stopped", "info");
//   };

//   const kickClientHandler = (clientIp: string) => {
//     if (isHost) {
//       kickClient(clientIp);
//       setDevices((prev) => prev.filter((d) => d.ip !== clientIp));
//       Logger.info(`Kicked client ${clientIp} via NetworkProvider`);
//       Logger.toast(`Kicked client ${clientIp}`, "info");
//     }
//   };

//   const stopClientHandler = () => {
//     stopClientServer();
//     setDevices([]);
//     setIsClientConnected(false);
//     setSocket(null);
//     setMessages([]);
//     setReceivedFiles([]);
//     setSentFiles([]);
//     setTransferProgress([]);
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
//     setSentFiles([]);
//     setDevices([]);
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

// import React, { createContext, useContext, useState, useEffect } from "react";
// import { HostServer, ClientServer } from "../service/Servers";
// import { Buffer } from "buffer";
// import useUsername from "../hooks/useUsername";
// import { Logger } from "../utils/Logger";
// import TCPSocket from "react-native-tcp-socket";
// import { Vibration } from "react-native";
// import { ClientSharing, HostSharing } from "./Sharing";

// interface TransferProgress {
//   fileId: string;
//   fileName: string;
//   progress: string;
//   speed: string;
//   percentage: number;
//   error?: string;
// }

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
//   const { username } = useUsername();
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

//   const sendMessageHandler = (message: string) => {
//     if (!socket) {
//       Logger.toast("No active socket to send message", "error");
//       return;
//     }
//     if (isHost) {
//       sendMessageInHost(message, username, connectedSockets);
//     } else {
//       sendMessageInClient(
//         socket as TCPSocket.Socket,
//         message,
//         username,
//         connectedSockets
//       );
//     }
//     setMessages((prev) => [
//       ...prev,
//       `${isHost ? "Host" : "Client"}: ${message}`,
//     ]);
//   };

//   const sendFilesHandler = async (files: { filePath: string }[]) => {
//     if (!socket) {
//       Logger.toast("No active socket to send files", "error");
//       return;
//     }
//     if (isHost) {
//       await sendFilesInHost(
//         socket as TCPSocket.Server,
//         files,
//         username,
//         connectedSockets,
//         setTransferProgress
//       );
//     } else {
//       await sendFilesInClient(
//         socket as TCPSocket.Socket,
//         files,
//         username,
//         connectedSockets,
//         setTransferProgress
//       );
//     }
//     setSentFiles((prev) => [
//       ...prev,
//       ...files.map(({ filePath }) => ({
//         id: Date.now(),
//         name: filePath.split("/").pop() || "unknown",
//         size: 0, // Size not available without RNFS.stat; consider adding if needed
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
//       kickClient(clientIp);
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

// import React, { createContext, useContext, useState, useEffect } from "react";
// import { HostServer, ClientServer } from "../service/Servers";
// import { Buffer } from "buffer";
// import useUsername from "../hooks/useUsername";
// import { Logger } from "../utils/Logger";
// import TCPSocket from "react-native-tcp-socket";
// import { Vibration } from "react-native";
// import { ClientSharing, HostSharing } from "./Sharing";

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
//   const { username } = useUsername();
//   const { sendMessageInHost, sendFilesInHost, receiveFileInHost } =
//     HostSharing();
//   const { sendFilesInClient, sendMessageInClient, receiveFileInClient } =
//     ClientSharing();
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

//   const sendMessage = (message: string) => {
//     if (!socket) {
//       Logger.toast("No active socket to send message", "error");
//       return;
//     }
//     if (isHost) {
//       sendMessageInHost(message, username, connectedSockets);
//     } else {
//       sendMessageInClient(
//         socket as TCPSocket.Socket,
//         message,
//         username,
//         connectedSockets
//       );
//     }
//     setMessages((prev) => [
//       ...prev,
//       `${isHost ? "Host" : "Client"}: ${message}`,
//     ]);
//   };

//   const sendFiles = async (files: { filePath: string }[]) => {
//     if (!socket) {
//       Logger.toast("No active socket to send files", "error");
//       return;
//     }
//     try {
//       if (isHost) {
//         await sendFilesInHost(
//           socket as TCPSocket.Server,
//           files,
//           username,
//           connectedSockets,
//           setTransferProgress
//         );
//       } else {
//         await sendFilesInClient(
//           socket as TCPSocket.Socket,
//           files,
//           username,
//           connectedSockets,
//           setTransferProgress
//         );
//       }
//       files.forEach((file, index) => {
//         setSentFiles((prev) => [
//           ...prev,
//           {
//             id: Date.now() + index,
//             name: file.filePath.split("/").pop() || "unknown",
//             size: 0, // Size could be fetched if needed
//           },
//         ]);
//       });
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
//         sentFiles,
//         isHostConnected,
//         isClientConnected,
//         isHost,
//         startHosting,
//         startClient,
//         connectToHostIp,
//         sendMessage,
//         sendFiles,
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

import React, { createContext, useContext, useState, useEffect } from "react";
import { HostServer, ClientServer } from "../service/Servers";
import useUsername from "../hooks/useUsername";
import { Logger } from "../utils/Logger";
import TCPSocket from "react-native-tcp-socket";
import { Vibration } from "react-native";
import { Sharing } from "./Sharing";

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
  sendFiles: (files: { filePath: string }[]) => void;
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
  const { sendMessage, sendFiles, receiveFile } = Sharing(
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

  const sendMessageHandler = (message: string) => {
    if (!socket) {
      Logger.toast("No active socket to send message", "error");
      return;
    }
    sendMessage(
      isHost ? connectedSockets : (socket as TCPSocket.Socket),
      message,
      username,
      connectedSockets
    );
    setMessages((prev) => [
      ...prev,
      `${isHost ? "Host" : "Client"}: ${message}`,
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
      files.forEach((file, index) => {
        setSentFiles((prev) => [
          ...prev,
          {
            id: Date.now() + index,
            name: file.filePath.split("/").pop() || "unknown",
            size: 0, // Size could be fetched if needed
          },
        ]);
      });
      Logger.toast(`Sent ${files.length} file(s)`, "info");
    } catch (error) {
      Logger.error("Failed to send files", error);
      Logger.toast("Failed to send files", "error");
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
        stopClient,
        disconnectFromHost: disconnectFromHostHandler,
        transferProgress,
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
