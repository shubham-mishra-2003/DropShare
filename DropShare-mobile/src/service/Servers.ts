// // // // import dgram from "react-native-udp";
// // // // import {
// // // //   getLocalIPAddress,
// // // //   getBroadcastIPAddress,
// // // // } from "../utils/NetworkUtils";
// // // // import { Buffer } from "buffer";
// // // // import { Logger } from "../utils/Logger";
// // // // import { ERROR_CODES } from "../utils/Error";
// // // // import TCPSocket from "react-native-tcp-socket";
// // // // import { HostSharing } from "./HostSharing";
// // // // import { ClientSharing } from "./ClientSharing";

// // // // const UDP_PORT = 5000;
// // // // const TCP_PORT = 6000;
// // // // const MAX_CLIENTS = 5;

// // // // type UdpSocket = ReturnType<typeof dgram.createSocket>;
// // // // interface ConnectedSocket extends TCPSocket.Socket {}

// // // // let connectedSockets: ConnectedSocket[] = [];
// // // // let isServerRunning = false;
// // // // let udpSocket: UdpSocket | null = null;
// // // // let server: TCPSocket.Server | null = null;
// // // // let clientSocket: TCPSocket.Socket | null = null;

// // // // export const HostServer = () => {
// // // //   let setDevicesRef: React.Dispatch<React.SetStateAction<Device[]>> | null =
// // // //     null;

// // // //   async function startHostServer(
// // // //     username: string,
// // // //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// // // //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>,
// // // //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Server | null>>,
// // // //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// // // //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// // // //     setTransferProgress?: React.Dispatch<
// // // //       React.SetStateAction<TransferProgress[]>
// // // //     >
// // // //   ): Promise<void> {
// // // //     if (isServerRunning) {
// // // //       Logger.info("Host server already running, skipping start.");
// // // //       return;
// // // //     }
// // // //     isServerRunning = true;
// // // //     setDevicesRef = setDevices;

// // // //     try {
// // // //       const ip = await getLocalIPAddress();
// // // //       const broadcastAddr = await getBroadcastIPAddress();
// // // //       Logger.info(
// // // //         `Host started on IP: ${ip}, Broadcasting to: ${broadcastAddr}`
// // // //       );

// // // //       udpSocket = dgram.createSocket({ type: "udp4" });
// // // //       udpSocket.bind(UDP_PORT);

// // // //       udpSocket.once("listening", () => {
// // // //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// // // //         udpSocket!.setBroadcast(true);
// // // //         const broadcastInterval = setInterval(() => {
// // // //           const message = JSON.stringify({ role: "Host", ip, name: username });
// // // //           udpSocket!.send(
// // // //             Buffer.from(message),
// // // //             0,
// // // //             message.length,
// // // //             UDP_PORT,
// // // //             broadcastAddr,
// // // //             (err) => {
// // // //               if (err) Logger.error("UDP Send Error", err);
// // // //             }
// // // //           );
// // // //         }, 2000);

// // // //         udpSocket!.on("close", () => clearInterval(broadcastInterval));
// // // //       });

// // // //       udpSocket.on("error", (err: Error) => {
// // // //         Logger.error("UDP Socket Error", err);
// // // //         isServerRunning = false;
// // // //         udpSocket?.close();
// // // //         udpSocket = null;
// // // //       });

// // // //       server = new TCPSocket.Server();
// // // //       server.on("connection", (socket: ConnectedSocket) => {
// // // //         setConnected(true);
// // // //         if (connectedSockets.length >= MAX_CLIENTS) {
// // // //           socket.write(
// // // //             Buffer.from(`ERROR:${ERROR_CODES.MAX_CLIENTS_REACHED}\n`)
// // // //           );
// // // //           socket.destroy();
// // // //           Logger.warn("Max clients reached, rejecting new connection");
// // // //           return;
// // // //         }

// // // //         Logger.info(`Client connected: ${socket.remoteAddress}`);
// // // //         connectedSockets.push(socket);
// // // //         setSocket(server);
// // // //         setDevices((prev) => [
// // // //           ...prev.filter((d) => d.ip !== socket.remoteAddress),
// // // //           {
// // // //             ip: socket.remoteAddress || "Unknown",
// // // //             name: "Unknown",
// // // //             role: "Client",
// // // //           },
// // // //         ]);

// // // //         socket.on("data", (data) => {
// // // //           const { receiveFileInHost } = HostSharing();
// // // //           try {
// // // //             const message = data.toString().trim();
// // // //             if (message.startsWith("{")) {
// // // //               const parsed = JSON.parse(message);
// // // //               if (parsed.type === "init" && parsed.name) {
// // // //                 setDevices((prev) =>
// // // //                   prev.map((d) =>
// // // //                     d.ip === socket.remoteAddress
// // // //                       ? { ...d, name: parsed.name }
// // // //                       : d
// // // //                   )
// // // //                 );
// // // //                 Logger.info(
// // // //                   `Client ${socket.remoteAddress} identified as ${parsed.name}`
// // // //                 );
// // // //                 return;
// // // //               }
// // // //             }
// // // //             receiveFileInHost({
// // // //               data,
// // // //               ip: socket.remoteAddress || "Unknown",
// // // //               setMessages,
// // // //               setReceivedFiles,
// // // //               socket,
// // // //               setTransferProgress,
// // // //             });
// // // //           } catch (error) {
// // // //             Logger.error("Error processing client data", error);
// // // //             receiveFileInHost({
// // // //               data,
// // // //               ip: socket.remoteAddress || "Unknown",
// // // //               setMessages,
// // // //               setReceivedFiles,
// // // //               socket,
// // // //               setTransferProgress,
// // // //             });
// // // //           }
// // // //         });

// // // //         socket.on("close", () => {
// // // //           Logger.info(`Client disconnected: ${socket.remoteAddress}`);
// // // //           connectedSockets = connectedSockets.filter((s) => s !== socket);
// // // //           setDevices((prev) =>
// // // //             prev.filter((d) => d.ip !== socket.remoteAddress)
// // // //           );
// // // //         });

// // // //         socket.on("error", (err) => {
// // // //           Logger.error(`Host Socket Error for ${socket.remoteAddress}`, err);
// // // //         });
// // // //       });

// // // //       server.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
// // // //         Logger.info(`Host TCP server running on port ${TCP_PORT}`);
// // // //       });

// // // //       server.on("error", (err) => {
// // // //         Logger.error("Server Error", err);
// // // //         stopHostServer();
// // // //       });

// // // //       server.on("close", () => {
// // // //         Logger.info("Host TCP server closed");
// // // //         isServerRunning = false;
// // // //       });
// // // //     } catch (err) {
// // // //       Logger.error("Failed to start host server", err);
// // // //       isServerRunning = false;
// // // //       stopHostServer();
// // // //     }
// // // //   }

// // // //   function stopHostServer(): void {
// // // //     Logger.info("Stopping host server...");
// // // //     connectedSockets.forEach((socket) => socket.destroy());
// // // //     connectedSockets = [];
// // // //     if (server) {
// // // //       server.close();
// // // //       server = null;
// // // //       Logger.info("Host TCP server stopped");
// // // //     }
// // // //     if (udpSocket) {
// // // //       udpSocket.close();
// // // //       udpSocket = null;
// // // //       Logger.info("Host UDP socket closed");
// // // //     }
// // // //     isServerRunning = false;
// // // //     setDevicesRef = null;
// // // //   }

// // // //   function kickClient(
// // // //     clientIp: string,
// // // //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>
// // // //   ): void {
// // // //     const socketsToKick = connectedSockets.filter(
// // // //       (socket) => socket.remoteAddress === clientIp
// // // //     );
// // // //     if (socketsToKick.length === 0) {
// // // //       Logger.warn(`No client found with IP: ${clientIp}`);
// // // //       return;
// // // //     }

// // // //     socketsToKick.forEach((socket) => {
// // // //       Logger.info(`Kicking client: ${clientIp}`);
// // // //       socket.destroy();
// // // //     });

// // // //     connectedSockets = connectedSockets.filter(
// // // //       (socket) => socket.remoteAddress !== clientIp
// // // //     );
// // // //     setDevices((prev) => prev.filter((d) => d.ip !== clientIp));
// // // //     Logger.info(
// // // //       `Client ${clientIp} removed from connected sockets and devices`
// // // //     );
// // // //   }

// // // //   return {
// // // //     startHostServer,
// // // //     stopHostServer,
// // // //     kickClient,
// // // //   };
// // // // };

// // // // export const ClientServer = () => {
// // // //   async function startClientDiscovery(
// // // //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>
// // // //   ): Promise<void> {
// // // //     try {
// // // //       const localIP = await getLocalIPAddress();
// // // //       Logger.info("Client Discovery Started...");

// // // //       udpSocket = dgram.createSocket({ type: "udp4" });
// // // //       udpSocket.bind(UDP_PORT);

// // // //       udpSocket.on("listening", () => {
// // // //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// // // //         udpSocket!.setBroadcast(true);
// // // //       });

// // // //       udpSocket.on("message", (msg: Buffer, rinfo) => {
// // // //         try {
// // // //           const data = JSON.parse(msg.toString());
// // // //           if (data.ip !== localIP && data.role === "Host") {
// // // //             setDevices((prev) => [
// // // //               ...prev.filter((device) => device.ip !== data.ip),
// // // //               {
// // // //                 ip: data.ip,
// // // //                 name: data.name || "Unknown",
// // // //                 role: "Host",
// // // //               },
// // // //             ]);
// // // //             Logger.info(`Discovered host: ${data.ip} (${data.name})`);
// // // //           }
// // // //         } catch (error) {
// // // //           Logger.error("Error parsing UDP message", error);
// // // //         }
// // // //       });

// // // //       udpSocket.on("error", (err: Error) => {
// // // //         Logger.error("UDP Socket Error", err);
// // // //         stopClientDiscovery();
// // // //       });
// // // //     } catch (err) {
// // // //       Logger.error("Failed to start client discovery", err);
// // // //       stopClientDiscovery();
// // // //     }
// // // //   }

// // // //   function stopClientDiscovery(): void {
// // // //     Logger.info("Stopping client discovery...");
// // // //     if (udpSocket) {
// // // //       udpSocket.close();
// // // //       udpSocket = null;
// // // //       Logger.info("UDP socket closed");
// // // //     }
// // // //   }

// // // //   async function connectToHost(
// // // //     ip: string,
// // // //     username: string,
// // // //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// // // //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// // // //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// // // //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// // // //     setTransferProgress?: React.Dispatch<
// // // //       React.SetStateAction<TransferProgress[]>
// // // //     >
// // // //   ): Promise<void> {
// // // //     Logger.info(`Connecting to host at ${ip}...`);
// // // //     const client = new TCPSocket.Socket();
// // // //     clientSocket = client;

// // // //     client.on("connect", () => {
// // // //       Logger.info("Connected to host!");
// // // //       setConnected(true);
// // // //       setSocket(client);
// // // //       const initMessage = JSON.stringify({ type: "init", name: username });
// // // //       client.write(Buffer.from(initMessage + "\n"));
// // // //     });

// // // //     client.on("data", (data: string | Buffer) => {
// // // //       const { receiveFileInClient } = ClientSharing();
// // // //       receiveFileInClient({
// // // //         client,
// // // //         data,
// // // //         ip,
// // // //         setMessages,
// // // //         setReceivedFiles,
// // // //         setTransferProgress,
// // // //       });
// // // //     });

// // // //     client.on("close", () => {
// // // //       Logger.info("Disconnected from host");
// // // //       disconnectFromHost(
// // // //         setConnected,
// // // //         setSocket,
// // // //         setMessages,
// // // //         setReceivedFiles,
// // // //         setTransferProgress
// // // //       );
// // // //     });

// // // //     client.on("error", (err) => {
// // // //       Logger.error("Client Socket Error", err);
// // // //       disconnectFromHost(
// // // //         setConnected,
// // // //         setSocket,
// // // //         setMessages,
// // // //         setReceivedFiles,
// // // //         setTransferProgress
// // // //       );
// // // //     });

// // // //     client.connect({ port: TCP_PORT, host: ip });
// // // //   }

// // // //   function disconnectFromHost(
// // // //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// // // //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// // // //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// // // //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// // // //     setTransferProgress?: React.Dispatch<
// // // //       React.SetStateAction<TransferProgress[]>
// // // //     >
// // // //   ): void {
// // // //     Logger.info("Disconnecting from host...");
// // // //     if (clientSocket) {
// // // //       clientSocket.end();
// // // //       clientSocket = null;
// // // //       Logger.info("Client socket closed");
// // // //     }
// // // //     setConnected(false);
// // // //     setSocket(null);
// // // //     setMessages([]);
// // // //     setReceivedFiles([]);
// // // //     setTransferProgress?.([]);
// // // //     Logger.info("Disconnected from host");
// // // //   }

// // // //   function stopClientServer(): void {
// // // //     if (clientSocket) {
// // // //       clientSocket.end();
// // // //       clientSocket = null;
// // // //       Logger.info("Client server stopped");
// // // //     }
// // // //   }

// // // //   return {
// // // //     startClientDiscovery,
// // // //     connectToHost,
// // // //     disconnectFromHost,
// // // //     stopClientServer,
// // // //   };
// // // // };

// // // // import dgram from "react-native-udp";
// // // // import {
// // // //   getLocalIPAddress,
// // // //   getBroadcastIPAddress,
// // // // } from "../utils/NetworkUtils";
// // // // import { Buffer } from "buffer";
// // // // import { Logger } from "../utils/Logger";
// // // // import { ERROR_CODES } from "../utils/Error";
// // // // import TCPSocket from "react-native-tcp-socket";
// // // // import { HostSharing } from "./HostSharing";
// // // // import { ClientSharing } from "./ClientSharing";

// // // // const UDP_PORT = 5000;
// // // // const TCP_PORT = 6000;
// // // // const MAX_CLIENTS = 5;

// // // // type UdpSocket = ReturnType<typeof dgram.createSocket>;
// // // // interface ConnectedSocket extends TCPSocket.Socket {}

// // // // let connectedSockets: ConnectedSocket[] = []; // Single source of truth for connected clients
// // // // let isServerRunning = false;
// // // // let udpSocket: UdpSocket | null = null;
// // // // let server: TCPSocket.Server | null = null;
// // // // let clientSocket: TCPSocket.Socket | null = null;

// // // // export const HostServer = () => {
// // // //   let setDevicesRef: React.Dispatch<React.SetStateAction<Device[]>> | null = null;

// // // //   async function startHostServer(
// // // //     username: string,
// // // //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// // // //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>,
// // // //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Server | null>>,
// // // //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// // // //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// // // //     setTransferProgress?: React.Dispatch<
// // // //       React.SetStateAction<TransferProgress[]>
// // // //     >
// // // //   ): Promise<void> {
// // // //     if (isServerRunning) {
// // // //       Logger.info("Host server already running, skipping start.");
// // // //       return;
// // // //     }
// // // //     isServerRunning = true;
// // // //     setDevicesRef = setDevices;

// // // //     try {
// // // //       const ip = await getLocalIPAddress();
// // // //       const broadcastAddr = await getBroadcastIPAddress();
// // // //       Logger.info(
// // // //         `Host started on IP: ${ip}, Broadcasting to: ${broadcastAddr}`
// // // //       );

// // // //       udpSocket = dgram.createSocket({ type: "udp4" });
// // // //       udpSocket.bind(UDP_PORT);

// // // //       udpSocket.once("listening", () => {
// // // //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// // // //         udpSocket!.setBroadcast(true);
// // // //         const broadcastInterval = setInterval(() => {
// // // //           const message = JSON.stringify({ role: "Host", ip, name: username });
// // // //           udpSocket!.send(
// // // //             Buffer.from(message),
// // // //             0,
// // // //             message.length,
// // // //             UDP_PORT,
// // // //             broadcastAddr,
// // // //             (err) => {
// // // //               if (err) Logger.error("UDP Send Error", err);
// // // //             }
// // // //           );
// // // //         }, 2000);

// // // //         udpSocket!.on("close", () => clearInterval(broadcastInterval));
// // // //       });

// // // //       udpSocket.on("error", (err: Error) => {
// // // //         Logger.error("UDP Socket Error", err);
// // // //         isServerRunning = false;
// // // //         udpSocket?.close();
// // // //         udpSocket = null;
// // // //       });

// // // //       server = new TCPSocket.Server();
// // // //       server.on("connection", (socket: ConnectedSocket) => {
// // // //         setConnected(true);
// // // //         if (connectedSockets.length >= MAX_CLIENTS) {
// // // //           socket.write(
// // // //             Buffer.from(`ERROR:${ERROR_CODES.MAX_CLIENTS_REACHED}\n`)
// // // //           );
// // // //           socket.destroy();
// // // //           Logger.warn("Max clients reached, rejecting new connection");
// // // //           return;
// // // //         }

// // // //         Logger.info(`Client connected: ${socket.remoteAddress}`);
// // // //         connectedSockets.push(socket); // Add to global connectedSockets
// // // //         setSocket(server);
// // // //         setDevices((prev) => [
// // // //           ...prev.filter((d) => d.ip !== socket.remoteAddress),
// // // //           {
// // // //             ip: socket.remoteAddress || "Unknown",
// // // //             name: "Unknown",
// // // //             role: "Client",
// // // //           },
// // // //         ]);

// // // //         socket.on("data", (data) => {
// // // //           const { receiveFileInHost } = HostSharing();
// // // //           try {
// // // //             const message = data.toString().trim();
// // // //             if (message.startsWith("{")) {
// // // //               const parsed = JSON.parse(message);
// // // //               if (parsed.type === "init" && parsed.name) {
// // // //                 setDevices((prev) =>
// // // //                   prev.map((d) =>
// // // //                     d.ip === socket.remoteAddress
// // // //                       ? { ...d, name: parsed.name }
// // // //                       : d
// // // //                   )
// // // //                 );
// // // //                 Logger.info(
// // // //                   `Client ${socket.remoteAddress} identified as ${parsed.name}`
// // // //                 );
// // // //                 return;
// // // //               }
// // // //             }
// // // //             receiveFileInHost({
// // // //               data,
// // // //               ip: socket.remoteAddress || "Unknown",
// // // //               setMessages,
// // // //               setReceivedFiles,
// // // //               socket,
// // // //               setTransferProgress,
// // // //             });
// // // //           } catch (error) {
// // // //             Logger.error("Error processing client data", error);
// // // //             receiveFileInHost({
// // // //               data,
// // // //               ip: socket.remoteAddress || "Unknown",
// // // //               setMessages,
// // // //               setReceivedFiles,
// // // //               socket,
// // // //               setTransferProgress,
// // // //             });
// // // //           }
// // // //         });

// // // //         socket.on("close", () => {
// // // //           Logger.info(`Client disconnected: ${socket.remoteAddress}`);
// // // //           connectedSockets = connectedSockets.filter((s) => s !== socket); // Remove from global connectedSockets
// // // //           setDevices((prev) =>
// // // //             prev.filter((d) => d.ip !== socket.remoteAddress)
// // // //           );
// // // //         });

// // // //         socket.on("error", (err) => {
// // // //           Logger.error(`Host Socket Error for ${socket.remoteAddress}`, err);
// // // //         });
// // // //       });

// // // //       server.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
// // // //         Logger.info(`Host TCP server running on port ${TCP_PORT}`);
// // // //       });

// // // //       server.on("error", (err) => {
// // // //         Logger.error("Server Error", err);
// // // //         stopHostServer();
// // // //       });

// // // //       server.on("close", () => {
// // // //         Logger.info("Host TCP server closed");
// // // //         isServerRunning = false;
// // // //       });
// // // //     } catch (err) {
// // // //       Logger.error("Failed to start host server", err);
// // // //       isServerRunning = false;
// // // //       stopHostServer();
// // // //     }
// // // //   }

// // // //   function stopHostServer(): void {
// // // //     Logger.info("Stopping host server...");
// // // //     connectedSockets.forEach((socket) => socket.destroy());
// // // //     connectedSockets = []; // Clear global connectedSockets
// // // //     if (server) {
// // // //       server.close();
// // // //       server = null;
// // // //       Logger.info("Host TCP server stopped");
// // // //     }
// // // //     if (udpSocket) {
// // // //       udpSocket.close();
// // // //       udpSocket = null;
// // // //       Logger.info("Host UDP socket closed");
// // // //     }
// // // //     isServerRunning = false;
// // // //     setDevicesRef = null;
// // // //   }

// // // //   function kickClient(
// // // //     clientIp: string,
// // // //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>
// // // //   ): void {
// // // //     const socketsToKick = connectedSockets.filter(
// // // //       (socket) => socket.remoteAddress === clientIp
// // // //     );
// // // //     if (socketsToKick.length === 0) {
// // // //       Logger.warn(`No client found with IP: ${clientIp}`);
// // // //       return;
// // // //     }

// // // //     socketsToKick.forEach((socket) => {
// // // //       Logger.info(`Kicking client: ${clientIp}`);
// // // //       socket.destroy();
// // // //     });

// // // //     connectedSockets = connectedSockets.filter(
// // // //       (socket) => socket.remoteAddress !== clientIp
// // // //     ); // Update global connectedSockets
// // // //     setDevices((prev) => prev.filter((d) => d.ip !== clientIp));
// // // //     Logger.info(
// // // //       `Client ${clientIp} removed from connected sockets and devices`
// // // //     );
// // // //   }

// // // //   return {
// // // //     startHostServer,
// // // //     stopHostServer,
// // // //     kickClient,
// // // //     connectedSockets, // Expose connectedSockets for use in HostSharing
// // // //   };
// // // // };

// // // // export const ClientServer = () => {
// // // //   async function startClientDiscovery(
// // // //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>
// // // //   ): Promise<void> {
// // // //     try {
// // // //       const localIP = await getLocalIPAddress();
// // // //       Logger.info("Client Discovery Started...");

// // // //       udpSocket = dgram.createSocket({ type: "udp4" });
// // // //       udpSocket.bind(UDP_PORT);

// // // //       udpSocket.on("listening", () => {
// // // //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// // // //         udpSocket!.setBroadcast(true);
// // // //       });

// // // //       udpSocket.on("message", (msg: Buffer, rinfo) => {
// // // //         try {
// // // //           const data = JSON.parse(msg.toString());
// // // //           if (data.ip !== localIP && data.role === "Host") {
// // // //             setDevices((prev) => [
// // // //               ...prev.filter((device) => device.ip !== data.ip),
// // // //               {
// // // //                 ip: data.ip,
// // // //                 name: data.name || "Unknown",
// // // //                 role: "Host",
// // // //               },
// // // //             ]);
// // // //             Logger.info(`Discovered host: ${data.ip} (${data.name})`);
// // // //           }
// // // //         } catch (error) {
// // // //           Logger.error("Error parsing UDP message", error);
// // // //         }
// // // //       });

// // // //       udpSocket.on("error", (err: Error) => {
// // // //         Logger.error("UDP Socket Error", err);
// // // //         stopClientDiscovery();
// // // //       });
// // // //     } catch (err) {
// // // //       Logger.error("Failed to start client discovery", err);
// // // //       stopClientDiscovery();
// // // //     }
// // // //   }

// // // //   function stopClientDiscovery(): void {
// // // //     Logger.info("Stopping client discovery...");
// // // //     if (udpSocket) {
// // // //       udpSocket.close();
// // // //       udpSocket = null;
// // // //       Logger.info("UDP socket closed");
// // // //     }
// // // //   }

// // // //   async function connectToHost(
// // // //     ip: string,
// // // //     username: string,
// // // //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// // // //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// // // //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// // // //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// // // //     setTransferProgress?: React.Dispatch<
// // // //       React.SetStateAction<TransferProgress[]>
// // // //     >
// // // //   ): Promise<void> {
// // // //     Logger.info(`Connecting to host at ${ip}...`);
// // // //     const client = new TCPSocket.Socket();
// // // //     clientSocket = client;

// // // //     client.on("connect", () => {
// // // //       Logger.info("Connected to host!");
// // // //       setConnected(true);
// // // //       setSocket(client);
// // // //       const initMessage = JSON.stringify({ type: "init", name: username });
// // // //       client.write(Buffer.from(initMessage + "\n"));
// // // //     });

// // // //     client.on("data", (data: string | Buffer) => {
// // // //       const { receiveFileInClient } = ClientSharing();
// // // //       receiveFileInClient({
// // // //         client,
// // // //         data,
// // // //         ip,
// // // //         setMessages,
// // // //         setReceivedFiles,
// // // //         setTransferProgress,
// // // //       });
// // // //     });

// // // //     client.on("close", () => {
// // // //       Logger.info("Disconnected from host");
// // // //       disconnectFromHost(
// // // //         setConnected,
// // // //         setSocket,
// // // //         setMessages,
// // // //         setReceivedFiles,
// // // //         setTransferProgress
// // // //       );
// // // //     });

// // // //     client.on("error", (err) => {
// // // //       Logger.error("Client Socket Error", err);
// // // //       disconnectFromHost(
// // // //         setConnected,
// // // //         setSocket,
// // // //         setMessages,
// // // //         setReceivedFiles,
// // // //         setTransferProgress
// // // //       );
// // // //     });

// // // //     client.connect({ port: TCP_PORT, host: ip });
// // // //   }

// // // //   function disconnectFromHost(
// // // //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// // // //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// // // //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// // // //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// // // //     setTransferProgress?: React.Dispatch<
// // // //       React.SetStateAction<TransferProgress[]>
// // // //     >
// // // //   ): void {
// // // //     Logger.info("Disconnecting from host...");
// // // //     if (clientSocket) {
// // // //       clientSocket.end();
// // // //       clientSocket = null;
// // // //       Logger.info("Client socket closed");
// // // //     }
// // // //     setConnected(false);
// // // //     setSocket(null);
// // // //     setMessages([]);
// // // //     setReceivedFiles([]);
// // // //     setTransferProgress?.([]);
// // // //     Logger.info("Disconnected from host");
// // // //   }

// // // //   function stopClientServer(): void {
// // // //     if (clientSocket) {
// // // //       clientSocket.end();
// // // //       clientSocket = null;
// // // //       Logger.info("Client server stopped");
// // // //     }
// // // //   }

// // // //   return {
// // // //     startClientDiscovery,
// // // //     connectToHost,
// // // //     disconnectFromHost,
// // // //     stopClientServer,
// // // //   };
// // // // };

// // // // import dgram from "react-native-udp";
// // // // import {
// // // //   getLocalIPAddress,
// // // //   getBroadcastIPAddress,
// // // // } from "../utils/NetworkUtils";
// // // // import { Buffer } from "buffer";
// // // // import { Logger } from "../utils/Logger";
// // // // import { ERROR_CODES } from "../utils/Error";
// // // // import TCPSocket from "react-native-tcp-socket";
// // // // import { } from "./Sharing"

// // // // const UDP_PORT = 5000;
// // // // const TCP_PORT = 6000;
// // // // const MAX_CLIENTS = 5;

// // // // type UdpSocket = ReturnType<typeof dgram.createSocket>;
// // // // interface ConnectedSocket extends TCPSocket.Socket {}

// // // // let connectedSockets: ConnectedSocket[] = [];
// // // // let isServerRunning = false;
// // // // let udpSocket: UdpSocket | null = null;
// // // // let server: TCPSocket.Server | null = null;
// // // // let clientSocket: TCPSocket.Socket | null = null;

// // // // export const HostServer = () => {
// // // //   async function startHostServer(
// // // //     username: string,
// // // //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>,
// // // //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Server | null>>,
// // // //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// // // //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// // // //     setTransferProgress?: React.Dispatch<
// // // //       React.SetStateAction<TransferProgress[]>
// // // //     >
// // // //   ): Promise<void> {
// // // //     if (isServerRunning) {
// // // //       Logger.info("Host server already running, skipping start.");
// // // //       return;
// // // //     }
// // // //     isServerRunning = true;

// // // //     try {
// // // //       const ip = await getLocalIPAddress();
// // // //       const broadcastAddr = await getBroadcastIPAddress();
// // // //       Logger.info(
// // // //         `Host started on IP: ${ip}, Broadcasting to: ${broadcastAddr}`
// // // //       );

// // // //       udpSocket = dgram.createSocket({ type: "udp4" });
// // // //       udpSocket.bind(UDP_PORT);

// // // //       udpSocket.once("listening", () => {
// // // //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// // // //         udpSocket!.setBroadcast(true);
// // // //         const broadcastInterval = setInterval(() => {
// // // //           const message = JSON.stringify({ role: "Host", ip, name: username });
// // // //           udpSocket!.send(
// // // //             Buffer.from(message),
// // // //             0,
// // // //             message.length,
// // // //             UDP_PORT,
// // // //             broadcastAddr,
// // // //             (err) => {
// // // //               if (err) Logger.error("UDP Send Error", err);
// // // //             }
// // // //           );
// // // //         }, 2000);

// // // //         udpSocket!.on("close", () => clearInterval(broadcastInterval));
// // // //       });

// // // //       udpSocket.on("error", (err: Error) => {
// // // //         Logger.error("UDP Socket Error", err);
// // // //         isServerRunning = false;
// // // //         udpSocket?.close();
// // // //         udpSocket = null;
// // // //       });

// // // //       server = new TCPSocket.Server();
// // // //       server.on("connection", (socket: ConnectedSocket) => {
// // // //         if (connectedSockets.length >= MAX_CLIENTS) {
// // // //           socket.write(
// // // //             Buffer.from(`ERROR:${ERROR_CODES.MAX_CLIENTS_REACHED}\n`)
// // // //           );
// // // //           socket.destroy();
// // // //           Logger.warn("Max clients reached, rejecting new connection");
// // // //           return;
// // // //         }

// // // //         Logger.info(`Client connected: ${socket.remoteAddress}`);
// // // //         connectedSockets.push(socket);
// // // //         setSocket(server);
// // // //         setDevices((prev) => [
// // // //           ...prev.filter((d) => d.ip !== socket.remoteAddress),
// // // //           {
// // // //             ip: socket.remoteAddress || "Unknown",
// // // //             name: "Unknown",
// // // //             role: "Client",
// // // //           },
// // // //         ]);

// // // //         socket.on("data", (data) => {
// // // //           const { receiveFileInHost } = HostSharing();
// // // //           receiveFileInHost({
// // // //             data,
// // // //             setMessages,
// // // //             setReceivedFiles,
// // // //             socket,
// // // //             setTransferProgress,
// // // //           });
// // // //         });

// // // //         socket.on("close", () => {
// // // //           Logger.info(`Client disconnected: ${socket.remoteAddress}`);
// // // //           connectedSockets = connectedSockets.filter((s) => s !== socket);
// // // //           setDevices((prev) =>
// // // //             prev.filter((d) => d.ip !== socket.remoteAddress)
// // // //           );
// // // //         });

// // // //         socket.on("error", (err) => {
// // // //           Logger.error(`Host Socket Error for ${socket.remoteAddress}`, err);
// // // //         });
// // // //       });

// // // //       server.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
// // // //         Logger.info(`Host TCP server running on port ${TCP_PORT}`);
// // // //       });

// // // //       server.on("error", (err) => {
// // // //         Logger.error("Server Error", err);
// // // //         stopHostServer();
// // // //       });

// // // //       server.on("close", () => {
// // // //         Logger.info("Host TCP server closed");
// // // //         isServerRunning = false;
// // // //       });
// // // //     } catch (err) {
// // // //       Logger.error("Failed to start host server", err);
// // // //       isServerRunning = false;
// // // //       stopHostServer();
// // // //     }
// // // //   }

// // // //   function stopHostServer(): void {
// // // //     Logger.info("Stopping host server...");
// // // //     connectedSockets.forEach((socket) => socket.destroy());
// // // //     connectedSockets = [];
// // // //     if (server) {
// // // //       server.close();
// // // //       server = null;
// // // //       Logger.info("Host TCP server stopped");
// // // //     }
// // // //     if (udpSocket) {
// // // //       udpSocket.close();
// // // //       udpSocket = null;
// // // //       Logger.info("Host UDP socket closed");
// // // //     }
// // // //     isServerRunning = false;
// // // //   }

// // // //   function kickClient(clientIp: string): void {
// // // //     connectedSockets.forEach((socket) => {
// // // //       if (socket.remoteAddress === clientIp) {
// // // //         socket.destroy();
// // // //       }
// // // //     });
// // // //   }

// // // //   return {
// // // //     startHostServer,
// // // //     stopHostServer,
// // // //     kickClient,
// // // //   };
// // // // };

// // // // export const ClientServer = () => {
// // // //   async function startClientDiscovery(
// // // //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>
// // // //   ): Promise<void> {
// // // //     try {
// // // //       const localIP = await getLocalIPAddress();
// // // //       Logger.info("Client Discovery Started...");

// // // //       udpSocket = dgram.createSocket({ type: "udp4" });
// // // //       udpSocket.bind(UDP_PORT);

// // // //       udpSocket.on("listening", () => {
// // // //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// // // //         udpSocket!.setBroadcast(true);
// // // //       });

// // // //       udpSocket.on("message", (msg: Buffer, rinfo) => {
// // // //         try {
// // // //           const data = JSON.parse(msg.toString());
// // // //           if (data.ip !== localIP && data.role === "Host") {
// // // //             setDevices((prev) => [
// // // //               ...prev.filter((device) => device.ip !== data.ip),
// // // //               {
// // // //                 ip: data.ip,
// // // //                 name: rinfo.name,
// // // //                 role: "Host",
// // // //               },
// // // //             ]);
// // // //             // Logger.info(`Discovered host: ${data.ip} (${data.name})`);
// // // //           }
// // // //         } catch (error) {
// // // //           Logger.error("Error parsing UDP message", error);
// // // //         }
// // // //       });

// // // //       udpSocket.on("error", (err: Error) => {
// // // //         Logger.error("UDP Socket Error", err);
// // // //         stopClientDiscovery();
// // // //       });
// // // //     } catch (err) {
// // // //       Logger.error("Failed to start client discovery", err);
// // // //       stopClientDiscovery();
// // // //     }
// // // //   }

// // // //   function stopClientDiscovery(): void {
// // // //     Logger.info("Stopping client discovery...");
// // // //     if (udpSocket) {
// // // //       udpSocket.close();
// // // //       udpSocket = null;
// // // //       Logger.info("UDP socket closed");
// // // //     }
// // // //   }

// // // //   async function connectToHost(
// // // //     ip: string,
// // // //     username: string,
// // // //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// // // //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// // // //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// // // //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// // // //     setTransferProgress?: React.Dispatch<
// // // //       React.SetStateAction<TransferProgress[]>
// // // //     >
// // // //   ): Promise<void> {
// // // //     Logger.info(`Connecting to host at ${ip}...`);
// // // //     const client = new TCPSocket.Socket();
// // // //     clientSocket = client;

// // // //     client.on("connect", () => {
// // // //       Logger.info("Connected to host!");
// // // //       setConnected(true);
// // // //       setSocket(client);
// // // //     });

// // // //     client.on("data", (data: string | Buffer) => {
// // // //       const { receiveFileInClient } = ClientSharing();
// // // //       receiveFileInClient({
// // // //         client,
// // // //         data,
// // // //         ip,
// // // //         setMessages,
// // // //         setReceivedFiles,
// // // //         setTransferProgress,
// // // //       });
// // // //     });

// // // //     client.on("close", () => {
// // // //       Logger.info("Disconnected from host");
// // // //       disconnectFromHost(
// // // //         setConnected,
// // // //         setSocket,
// // // //         setMessages,
// // // //         setReceivedFiles,
// // // //         setTransferProgress
// // // //       );
// // // //     });

// // // //     client.on("error", (err) => {
// // // //       Logger.error("Client Socket Error", err);
// // // //       disconnectFromHost(
// // // //         setConnected,
// // // //         setSocket,
// // // //         setMessages,
// // // //         setReceivedFiles,
// // // //         setTransferProgress
// // // //       );
// // // //     });

// // // //     client.connect({ port: TCP_PORT, host: ip });
// // // //   }

// // // //   function disconnectFromHost(
// // // //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// // // //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// // // //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// // // //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// // // //     setTransferProgress?: React.Dispatch<
// // // //       React.SetStateAction<TransferProgress[]>
// // // //     >
// // // //   ): void {
// // // //     Logger.info("Disconnecting from host...");
// // // //     if (clientSocket) {
// // // //       clientSocket.end();
// // // //       clientSocket = null;
// // // //       Logger.info("Client socket closed");
// // // //     }
// // // //     setConnected(false);
// // // //     setSocket(null);
// // // //     setMessages([]);
// // // //     setReceivedFiles([]);
// // // //     setTransferProgress?.([]);
// // // //     Logger.info("Disconnected from host");
// // // //   }

// // // //   function stopClientServer(): void {
// // // //     if (clientSocket) {
// // // //       clientSocket.end();
// // // //       clientSocket = null;
// // // //       Logger.info("Client server stopped");
// // // //     }
// // // //   }
// // // //   return {
// // // //     startClientDiscovery,
// // // //     connectToHost,
// // // //     disconnectFromHost,
// // // //     stopClientServer,
// // // //   };
// // // // };

// // // // import dgram from "react-native-udp";
// // // // import {
// // // //   getLocalIPAddress,
// // // //   getBroadcastIPAddress,
// // // // } from "../utils/NetworkUtils";
// // // // import { Buffer } from "buffer";
// // // // import { Logger } from "../utils/Logger";
// // // // import { ERROR_CODES } from "../utils/Error";
// // // // import TCPSocket from "react-native-tcp-socket";
// // // // import { HostSharing } from "./HostSharing";
// // // // import { ClientSharing } from "./ClientSharing";

// // // // const UDP_PORT = 5000;
// // // // const TCP_PORT = 6000;
// // // // const MAX_CLIENTS = 5;
// // // // const APP_ID = "Dropshare_shubham-mishra";

// // // // type UdpSocket = ReturnType<typeof dgram.createSocket>;
// // // // interface ConnectedSocket extends TCPSocket.Socket {}

// // // // let connectedSockets: ConnectedSocket[] = [];
// // // // let isServerRunning = false;
// // // // let udpSocket: UdpSocket | null = null;
// // // // let server: TCPSocket.Server | null = null;
// // // // let clientSocket: TCPSocket.Socket | null = null;

// // // // export const HostServer = () => {
// // // //   async function startHostServer(
// // // //     username: string,
// // // //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>,
// // // //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Server | null>>,
// // // //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// // // //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// // // //     setTransferProgress?: React.Dispatch<
// // // //       React.SetStateAction<TransferProgress[]>
// // // //     >
// // // //   ): Promise<void> {
// // // //     if (isServerRunning) {
// // // //       Logger.info("Host server already running, skipping start.");
// // // //       return;
// // // //     }
// // // //     isServerRunning = true;

// // // //     try {
// // // //       const ip = await getLocalIPAddress();
// // // //       const broadcastAddr = await getBroadcastIPAddress();
// // // //       Logger.info(
// // // //         `Host started on IP: ${ip}, Broadcasting to: ${broadcastAddr}`
// // // //       );

// // // //       udpSocket = dgram.createSocket({ type: "udp4" });
// // // //       udpSocket.bind(UDP_PORT);

// // // //       udpSocket.once("listening", () => {
// // // //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// // // //         udpSocket!.setBroadcast(true);
// // // //         const broadcastInterval = setInterval(() => {
// // // //           const message = JSON.stringify({
// // // //             appId: APP_ID,
// // // //             role: "Host",
// // // //             ip,
// // // //             name: username,
// // // //           });
// // // //           udpSocket!.send(
// // // //             Buffer.from(message),
// // // //             0,
// // // //             message.length,
// // // //             UDP_PORT,
// // // //             broadcastAddr,
// // // //             (err) => {
// // // //               if (err) Logger.error("UDP Send Error", err);
// // // //             }
// // // //           );
// // // //         }, 2000);

// // // //         udpSocket!.on("close", () => clearInterval(broadcastInterval));
// // // //       });

// // // //       udpSocket.on("error", (err: Error) => {
// // // //         Logger.error("UDP Socket Error", err);
// // // //         isServerRunning = false;
// // // //         udpSocket?.close();
// // // //         udpSocket = null;
// // // //       });

// // // //       server = new TCPSocket.Server();
// // // //       server.on("connection", (socket: ConnectedSocket) => {
// // // //         if (connectedSockets.length >= MAX_CLIENTS) {
// // // //           socket.write(
// // // //             Buffer.from(`ERROR:${ERROR_CODES.MAX_CLIENTS_REACHED}\n`)
// // // //           );
// // // //           socket.destroy();
// // // //           Logger.warn("Max clients reached, rejecting new connection");
// // // //           return;
// // // //         }

// // // //         Logger.info(`Client connected: ${socket.remoteAddress}`);
// // // //         connectedSockets.push(socket);
// // // //         setSocket(server);
// // // //         socket.once("data", (data) => {
// // // //           try {
// // // //             const message = data.toString();
// // // //             if (message.startsWith("USERNAME:")) {
// // // //               const clientUsername = message.replace("USERNAME:", "").trim();
// // // //               setDevices((prev) => [
// // // //                 ...prev.filter((d) => d.ip !== socket.remoteAddress),
// // // //                 {
// // // //                   ip: socket.remoteAddress || "Unknown",
// // // //                   name: clientUsername || "Unknown",
// // // //                   role: "Client",
// // // //                 },
// // // //               ]);
// // // //             } else {
// // // //               Logger.warn(
// // // //                 `Unexpected initial message from ${socket.remoteAddress}: ${message}`
// // // //               );
// // // //             }
// // // //           } catch (err) {
// // // //             Logger.error("Error processing client username", err);
// // // //             setDevices((prev) => [
// // // //               ...prev.filter((d) => d.ip !== socket.remoteAddress),
// // // //               {
// // // //                 ip: socket.remoteAddress || "Unknown",
// // // //                 name: "Unknown",
// // // //                 role: "Client",
// // // //               },
// // // //             ]);
// // // //           }
// // // //           socket.on("data", (data) => {
// // // //             const { receiveFileInHost } = HostSharing();
// // // //             receiveFileInHost({
// // // //               data,
// // // //               setMessages,
// // // //               setReceivedFiles,
// // // //               socket,
// // // //               connectedSockets,
// // // //               setTransferProgress,
// // // //             });
// // // //           });
// // // //         });

// // // //         socket.on("close", () => {
// // // //           Logger.info(`Client disconnected: ${socket.remoteAddress}`);
// // // //           connectedSockets = connectedSockets.filter((s) => s !== socket);
// // // //           setDevices((prev) =>
// // // //             prev.filter((d) => d.ip !== socket.remoteAddress)
// // // //           );
// // // //         });

// // // //         socket.on("error", (err) => {
// // // //           Logger.error(`Host Socket Error for ${socket.remoteAddress}`, err);
// // // //         });
// // // //       });

// // // //       server.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
// // // //         Logger.info(`Host TCP server running on port ${TCP_PORT}`);
// // // //       });

// // // //       server.on("error", (err) => {
// // // //         Logger.error("Server Error", err);
// // // //         stopHostServer();
// // // //       });

// // // //       server.on("close", () => {
// // // //         Logger.info("Host TCP server closed");
// // // //         isServerRunning = false;
// // // //       });
// // // //     } catch (err) {
// // // //       Logger.error("Failed to start host server", err);
// // // //       isServerRunning = false;
// // // //       stopHostServer();
// // // //     }
// // // //   }

// // // //   function stopHostServer(): void {
// // // //     Logger.info("Stopping host server...");
// // // //     connectedSockets.forEach((socket) => socket.destroy());
// // // //     connectedSockets = [];
// // // //     if (server) {
// // // //       server.close();
// // // //       server = null;
// // // //       Logger.info("Host TCP server stopped");
// // // //     }
// // // //     if (udpSocket) {
// // // //       udpSocket.close();
// // // //       udpSocket = null;
// // // //       Logger.info("Host UDP socket closed");
// // // //     }
// // // //     isServerRunning = false;
// // // //   }

// // // //   function kickClient(clientIp: string): void {
// // // //     connectedSockets.forEach((socket) => {
// // // //       if (socket.remoteAddress === clientIp) {
// // // //         socket.destroy();
// // // //       }
// // // //     });
// // // //   }

// // // //   return {
// // // //     startHostServer,
// // // //     stopHostServer,
// // // //     kickClient,
// // // //     connectedSockets,
// // // //   };
// // // // };

// // // // export const ClientServer = () => {
// // // //   async function startClientDiscovery(
// // // //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>
// // // //   ): Promise<void> {
// // // //     try {
// // // //       const localIP = await getLocalIPAddress();
// // // //       Logger.info("Client Discovery Started...");

// // // //       udpSocket = dgram.createSocket({ type: "udp4" });
// // // //       udpSocket.bind(UDP_PORT);

// // // //       udpSocket.on("listening", () => {
// // // //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// // // //         udpSocket!.setBroadcast(true);
// // // //       });

// // // //       udpSocket.on("message", (msg: Buffer, rinfo) => {
// // // //         try {
// // // //           const data = JSON.parse(msg.toString());
// // // //           if (data.appId !== APP_ID) {
// // // //             return;
// // // //           }
// // // //           if (data.ip !== localIP && data.role === "Host") {
// // // //             setDevices((prev) => [
// // // //               ...prev.filter((device) => device.ip !== data.ip),
// // // //               {
// // // //                 ip: data.ip,
// // // //                 name: data.name || "Unknown Host",
// // // //                 role: "Host",
// // // //               },
// // // //             ]);
// // // //           }
// // // //         } catch (error) {
// // // //           Logger.error("Error parsing UDP message", error);
// // // //         }
// // // //       });

// // // //       udpSocket.on("error", (err: Error) => {
// // // //         Logger.error("UDP Socket Error", err);
// // // //         stopClientDiscovery();
// // // //       });
// // // //     } catch (err) {
// // // //       Logger.error("Failed to start client discovery", err);
// // // //       stopClientDiscovery();
// // // //     }
// // // //   }

// // // //   function stopClientDiscovery(): void {
// // // //     Logger.info("Stopping client discovery...");
// // // //     if (udpSocket) {
// // // //       udpSocket.close();
// // // //       udpSocket = null;
// // // //       Logger.info("UDP socket closed");
// // // //     }
// // // //   }

// // // //   async function connectToHost(
// // // //     ip: string,
// // // //     username: string,
// // // //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// // // //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// // // //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// // // //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// // // //     setTransferProgress?: React.Dispatch<
// // // //       React.SetStateAction<TransferProgress[]>
// // // //     >
// // // //   ): Promise<void> {
// // // //     Logger.info(`Connecting to host at ${ip}...`);
// // // //     const client = new TCPSocket.Socket();
// // // //     clientSocket = client;

// // // //     client.on("connect", () => {
// // // //       Logger.info("Connected to host!");
// // // //       setConnected(true);
// // // //       setSocket(client);
// // // //       client.write(Buffer.from(`USERNAME:${username}\n`));
// // // //     });

// // // //     client.on("data", (data: string | Buffer) => {
// // // //       const { receiveFileInClient } = ClientSharing();
// // // //       receiveFileInClient({
// // // //         client,
// // // //         data,
// // // //         ip,
// // // //         setMessages,
// // // //         setReceivedFiles,
// // // //         connectedSockets,
// // // //         setTransferProgress,
// // // //       });
// // // //     });

// // // //     client.on("close", () => {
// // // //       Logger.info("Disconnected from host");
// // // //       disconnectFromHost(
// // // //         setConnected,
// // // //         setSocket,
// // // //         setMessages,
// // // //         setReceivedFiles,
// // // //         setTransferProgress
// // // //       );
// // // //     });

// // // //     client.on("error", (err) => {
// // // //       Logger.error("Client Socket Error", err);
// // // //       disconnectFromHost(
// // // //         setConnected,
// // // //         setSocket,
// // // //         setMessages,
// // // //         setReceivedFiles,
// // // //         setTransferProgress
// // // //       );
// // // //     });

// // // //     client.connect({ port: TCP_PORT, host: ip });
// // // //   }

// // // //   function disconnectFromHost(
// // // //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// // // //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// // // //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// // // //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// // // //     setTransferProgress?: React.Dispatch<
// // // //       React.SetStateAction<TransferProgress[]>
// // // //     >
// // // //   ): void {
// // // //     Logger.info("Disconnecting from host...");
// // // //     if (clientSocket) {
// // // //       clientSocket.end();
// // // //       clientSocket = null;
// // // //       Logger.info("Client socket closed");
// // // //     }
// // // //     setConnected(false);
// // // //     setSocket(null);
// // // //     setMessages([]);
// // // //     setReceivedFiles([]);
// // // //     setTransferProgress?.([]);
// // // //     Logger.info("Disconnected from host");
// // // //   }

// // // //   function stopClientServer(): void {
// // // //     if (clientSocket) {
// // // //       clientSocket.end();
// // // //       clientSocket = null;
// // // //       Logger.info("Client server stopped");
// // // //     }
// // // //   }

// // // //   return {
// // // //     startClientDiscovery,
// // // //     connectToHost,
// // // //     disconnectFromHost,
// // // //     stopClientServer,
// // // //   };
// // // // };

// // // // new testing previous works well
// // // import dgram from "react-native-udp";
// // // import {
// // //   getLocalIPAddress,
// // //   getBroadcastIPAddress,
// // // } from "../utils/NetworkUtils";
// // // import { Buffer } from "buffer";
// // // import { Logger } from "../utils/Logger";
// // // import { ERROR_CODES } from "../utils/Error";
// // // import TCPSocket from "react-native-tcp-socket";
// // // import { HostSharing } from "./HostSharing";
// // // import { ClientSharing } from "./ClientSharing";

// // // const UDP_PORT = 5000;
// // // const TCP_PORT = 6000;
// // // const MAX_CLIENTS = 5;
// // // const APP_ID = "Dropshare_shubham-mishra";

// // // interface Device {
// // //   ip: string;
// // //   name: string;
// // //   role: "Host" | "Client";
// // // }

// // // interface TransferProgress {
// // //   fileId: string;
// // //   fileName: string;
// // //   progress: string;
// // //   speed: string;
// // //   percentage: number;
// // //   error?: string;
// // // }

// // // type UdpSocket = ReturnType<typeof dgram.createSocket>;
// // // interface ConnectedSocket extends TCPSocket.Socket {}

// // // let connectedSockets: ConnectedSocket[] = [];
// // // let isServerRunning = false;
// // // let udpSocket: UdpSocket | null = null;
// // // let server: TCPSocket.Server | null = null;
// // // let clientSocket: TCPSocket.Socket | null = null;

// // // export const HostServer = () => {
// // //   const { cleanupTransfer: cleanupHostTransfer } = HostSharing();

// // //   async function startHostServer(
// // //     username: string,
// // //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>,
// // //     setIsHostConnected: React.Dispatch<React.SetStateAction<boolean>>,
// // //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Server | null>>,
// // //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// // //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// // //     setTransferProgress?: React.Dispatch<
// // //       React.SetStateAction<TransferProgress[]>
// // //     >
// // //   ): Promise<void> {
// // //     if (isServerRunning) {
// // //       Logger.info("Host server already running, skipping start.");
// // //       return;
// // //     }
// // //     isServerRunning = true;

// // //     try {
// // //       const ip = await getLocalIPAddress();
// // //       const broadcastAddr = await getBroadcastIPAddress();
// // //       Logger.info(
// // //         `Host started on IP: ${ip}, Broadcasting to: ${broadcastAddr}`
// // //       );

// // //       udpSocket = dgram.createSocket({ type: "udp4" });
// // //       udpSocket.bind(UDP_PORT);

// // //       udpSocket.once("listening", () => {
// // //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// // //         udpSocket!.setBroadcast(true);
// // //         const broadcastInterval = setInterval(() => {
// // //           const message = JSON.stringify({
// // //             appId: APP_ID,
// // //             role: "Host",
// // //             ip,
// // //             name: username,
// // //           });
// // //           udpSocket!.send(
// // //             Buffer.from(message),
// // //             0,
// // //             message.length,
// // //             UDP_PORT,
// // //             broadcastAddr,
// // //             (err) => {
// // //               if (err) Logger.error("UDP Send Error", err);
// // //             }
// // //           );
// // //         }, 2000);

// // //         udpSocket!.on("close", () => clearInterval(broadcastInterval));
// // //       });

// // //       udpSocket.on("error", (err: Error) => {
// // //         Logger.error("UDP Socket Error", err);
// // //         isServerRunning = false;
// // //         udpSocket?.close();
// // //         udpSocket = null;
// // //       });

// // //       server = new TCPSocket.Server();
// // //       server.on("connection", (socket: ConnectedSocket) => {
// // //         if (connectedSockets.length >= MAX_CLIENTS) {
// // //           socket.write(
// // //             Buffer.from(`ERROR:${ERROR_CODES.MAX_CLIENTS_REACHED}\n`)
// // //           );
// // //           socket.destroy();
// // //           Logger.warn("Max clients reached, rejecting new connection");
// // //           return;
// // //         }

// // //         Logger.info(`Client connected: ${socket.remoteAddress}`);
// // //         connectedSockets.push(socket);
// // //         setSocket(server);
// // //         setIsHostConnected(true);
// // //         socket.once("data", (data: Buffer | string) => {
// // //           try {
// // //             const message =
// // //               typeof data === "string" ? data : data.toString("utf8");
// // //             if (message.startsWith("USERNAME:")) {
// // //               const clientUsername = message.replace("USERNAME:", "").trim();
// // //               setDevices((prev) => [
// // //                 ...prev.filter((d) => d.ip !== socket.remoteAddress),
// // //                 {
// // //                   ip: socket.remoteAddress || "Unknown",
// // //                   name: clientUsername || "Unknown",
// // //                   role: "Client",
// // //                 },
// // //               ]);
// // //             } else {
// // //               Logger.warn(
// // //                 `Unexpected initial message from ${socket.remoteAddress}: ${message}`
// // //               );
// // //             }
// // //           } catch (err) {
// // //             Logger.error("Error processing client username", err);
// // //             setDevices((prev) => [
// // //               ...prev.filter((d) => d.ip !== socket.remoteAddress),
// // //               {
// // //                 ip: socket.remoteAddress || "Unknown",
// // //                 name: "Unknown",
// // //                 role: "Client",
// // //               },
// // //             ]);
// // //           }
// // //           socket.on("data", (data: Buffer | string) => {
// // //             const { receiveFileInHost } = HostSharing();
// // //             receiveFileInHost({
// // //               data,
// // //               setMessages,
// // //               setReceivedFiles,
// // //               socket,
// // //               connectedSockets,
// // //               setTransferProgress,
// // //             });
// // //           });
// // //         });

// // //         socket.on("close", () => {
// // //           Logger.info(`Client disconnected: ${socket.remoteAddress}`);
// // //           connectedSockets = connectedSockets.filter((s) => s !== socket);
// // //           setDevices((prev) =>
// // //             prev.filter((d) => d.ip !== socket.remoteAddress)
// // //           );
// // //         });

// // //         socket.on("error", (err) => {
// // //           Logger.error(`Host Socket Error for ${socket.remoteAddress}`, err);
// // //         });
// // //       });

// // //       server.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
// // //         Logger.info(`Host TCP server running on port ${TCP_PORT}`);
// // //       });

// // //       server.on("error", (err) => {
// // //         Logger.error("Server Error", err);
// // //         stopHostServer();
// // //       });

// // //       server.on("close", () => {
// // //         Logger.info("Host TCP server closed");
// // //         isServerRunning = false;
// // //       });
// // //     } catch (err) {
// // //       Logger.error("Failed to start host server", err);
// // //       isServerRunning = false;
// // //       stopHostServer();
// // //     }
// // //   }

// // //   function stopHostServer(): void {
// // //     Logger.info("Stopping host server...");
// // //     connectedSockets.forEach((socket) => socket.destroy());
// // //     connectedSockets = [];
// // //     if (server) {
// // //       server.close();
// // //       server = null;
// // //       Logger.info("Host TCP server stopped");
// // //     }
// // //     if (udpSocket) {
// // //       udpSocket.close();
// // //       udpSocket = null;
// // //       Logger.info("Host UDP socket closed");
// // //     }
// // //     isServerRunning = false;
// // //     cleanupHostTransfer();
// // //   }

// // //   function kickClient(clientIp: string): void {
// // //     connectedSockets.forEach((socket) => {
// // //       if (socket.remoteAddress === clientIp) {
// // //         socket.destroy();
// // //       }
// // //     });
// // //     connectedSockets = connectedSockets.filter(
// // //       (socket) => socket.remoteAddress !== clientIp
// // //     );
// // //   }

// // //   return {
// // //     startHostServer,
// // //     stopHostServer,
// // //     kickClient,
// // //     connectedSockets,
// // //   };
// // // };

// // // export const ClientServer = () => {
// // //   const { cleanupTransfer: cleanupClientTransfer } = ClientSharing();

// // //   async function startClientDiscovery(
// // //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>
// // //   ): Promise<void> {
// // //     try {
// // //       const localIP = await getLocalIPAddress();
// // //       Logger.info("Client Discovery Started...");

// // //       udpSocket = dgram.createSocket({ type: "udp4" });
// // //       udpSocket.bind(UDP_PORT);

// // //       udpSocket.on("listening", () => {
// // //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// // //         udpSocket!.setBroadcast(true);
// // //       });

// // //       udpSocket.on("message", (msg: Buffer, rinfo) => {
// // //         try {
// // //           const data = JSON.parse(msg.toString());
// // //           if (data.appId !== APP_ID) {
// // //             return;
// // //           }
// // //           if (data.ip !== localIP && data.role === "Host") {
// // //             setDevices((prev) => [
// // //               ...prev.filter((device) => device.ip !== data.ip),
// // //               {
// // //                 ip: data.ip,
// // //                 name: data.name || "Unknown Host",
// // //                 role: "Host",
// // //               },
// // //             ]);
// // //           }
// // //         } catch (error) {
// // //           Logger.error("Error parsing UDP message", error);
// // //         }
// // //       });

// // //       udpSocket.on("error", (err: Error) => {
// // //         Logger.error("UDP Socket Error", err);
// // //         stopClientDiscovery();
// // //       });
// // //     } catch (err) {
// // //       Logger.error("Failed to start client discovery", err);
// // //       stopClientDiscovery();
// // //     }
// // //   }

// // //   function stopClientDiscovery(): void {
// // //     Logger.info("Stopping client discovery...");
// // //     if (udpSocket) {
// // //       udpSocket.close();
// // //       udpSocket = null;
// // //       Logger.info("UDP socket closed");
// // //     }
// // //   }

// // //   async function connectToHost(
// // //     ip: string,
// // //     username: string,
// // //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// // //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// // //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// // //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// // //     setTransferProgress?: React.Dispatch<
// // //       React.SetStateAction<TransferProgress[]>
// // //     >
// // //   ): Promise<void> {
// // //     Logger.info(`Connecting to host at ${ip}...`);
// // //     const client = new TCPSocket.Socket();
// // //     clientSocket = client;

// // //     client.on("connect", () => {
// // //       Logger.info("Connected to host!");
// // //       setConnected(true);
// // //       setSocket(client);
// // //       connectedSockets = [client];
// // //       client.write(Buffer.from(`USERNAME:${username}\n`));
// // //     });

// // //     client.on("data", (data: Buffer | string) => {
// // //       const { receiveFileInClient } = ClientSharing();
// // //       receiveFileInClient({
// // //         client,
// // //         data,
// // //         ip,
// // //         setMessages,
// // //         setReceivedFiles,
// // //         connectedSockets,
// // //         setTransferProgress,
// // //       });
// // //     });

// // //     client.on("close", () => {
// // //       Logger.info("Disconnected from host");
// // //       disconnectFromHost(
// // //         setConnected,
// // //         setSocket,
// // //         setMessages,
// // //         setReceivedFiles,
// // //         setTransferProgress
// // //       );
// // //     });

// // //     client.on("error", (err) => {
// // //       Logger.error("Client Socket Error", err);
// // //       disconnectFromHost(
// // //         setConnected,
// // //         setSocket,
// // //         setMessages,
// // //         setReceivedFiles,
// // //         setTransferProgress
// // //       );
// // //     });

// // //     client.connect({ port: TCP_PORT, host: ip });
// // //   }

// // //   function disconnectFromHost(
// // //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// // //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// // //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// // //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// // //     setTransferProgress?: React.Dispatch<
// // //       React.SetStateAction<TransferProgress[]>
// // //     >
// // //   ): void {
// // //     Logger.info("Disconnecting from host...");
// // //     if (clientSocket) {
// // //       clientSocket.end();
// // //       clientSocket = null;
// // //       Logger.info("Client socket closed");
// // //     }
// // //     setConnected(false);
// // //     setSocket(null);
// // //     setMessages([]);
// // //     setReceivedFiles([]);
// // //     setTransferProgress?.([]);
// // //     connectedSockets = [];
// // //     cleanupClientTransfer();
// // //     Logger.info("Disconnected from host");
// // //   }

// // //   function stopClientServer(): void {
// // //     stopClientDiscovery();
// // //     if (clientSocket) {
// // //       clientSocket.end();
// // //       clientSocket = null;
// // //       Logger.info("Client server stopped");
// // //     }
// // //     connectedSockets = [];
// // //     cleanupClientTransfer();
// // //   }

// // //   return {
// // //     startClientDiscovery,
// // //     stopClientDiscovery,
// // //     connectToHost,
// // //     disconnectFromHost,
// // //     stopClientServer,
// // //   };
// // // };

// // // 10mb
// // // import dgram from "react-native-udp";
// // // import {
// // //   getLocalIPAddress,
// // //   getBroadcastIPAddress,
// // // } from "../utils/NetworkUtils";
// // // import { Buffer } from "buffer";
// // // import { Logger } from "../utils/Logger";
// // // import { ERROR_CODES } from "../utils/Error";
// // // import TCPSocket from "react-native-tcp-socket";
// // // import { HostSharing } from "./HostSharing";
// // // import { ClientSharing } from "./ClientSharing";

// // // const UDP_PORT = 5000;
// // // const TCP_PORT = 6000;
// // // const MAX_CLIENTS = 5;

// // // type UdpSocket = ReturnType<typeof dgram.createSocket>;
// // // interface ConnectedSocket extends TCPSocket.Socket {}

// // // let connectedSockets: ConnectedSocket[] = [];
// // // let isServerRunning = false;
// // // let udpSocket: UdpSocket | null = null;
// // // let server: TCPSocket.Server | null = null;
// // // let clientSocket: TCPSocket.Socket | null = null;

// // // export const HostServer = () => {
// // //   let setDevicesRef: React.Dispatch<React.SetStateAction<Device[]>> | null =
// // //     null;

// // //   async function startHostServer(
// // //     username: string,
// // //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// // //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>,
// // //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Server | null>>,
// // //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// // //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// // //     setTransferProgress?: React.Dispatch<
// // //       React.SetStateAction<TransferProgress[]>
// // //     >
// // //   ): Promise<void> {
// // //     if (isServerRunning) {
// // //       Logger.info("Host server already running, skipping start.");
// // //       return;
// // //     }
// // //     isServerRunning = true;
// // //     setDevicesRef = setDevices;

// // //     try {
// // //       const ip = await getLocalIPAddress();
// // //       const broadcastAddr = await getBroadcastIPAddress();
// // //       Logger.info(
// // //         `Host started on IP: ${ip}, Broadcasting to: ${broadcastAddr}`
// // //       );

// // //       udpSocket = dgram.createSocket({ type: "udp4" });
// // //       udpSocket.bind(UDP_PORT);

// // //       udpSocket.once("listening", () => {
// // //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// // //         udpSocket!.setBroadcast(true);
// // //         const broadcastInterval = setInterval(() => {
// // //           const message = JSON.stringify({ role: "Host", ip, name: username });
// // //           udpSocket!.send(
// // //             Buffer.from(message),
// // //             0,
// // //             message.length,
// // //             UDP_PORT,
// // //             broadcastAddr,
// // //             (err) => {
// // //               if (err) Logger.error("UDP Send Error", err);
// // //             }
// // //           );
// // //         }, 2000);

// // //         udpSocket!.on("close", () => clearInterval(broadcastInterval));
// // //       });

// // //       udpSocket.on("error", (err: Error) => {
// // //         Logger.error("UDP Socket Error", err);
// // //         isServerRunning = false;
// // //         udpSocket?.close();
// // //         udpSocket = null;
// // //       });

// // //       server = new TCPSocket.Server();
// // //       server.on("connection", (socket: ConnectedSocket) => {
// // //         setConnected(true);
// // //         if (connectedSockets.length >= MAX_CLIENTS) {
// // //           socket.write(
// // //             Buffer.from(`ERROR:${ERROR_CODES.MAX_CLIENTS_REACHED}\n`)
// // //           );
// // //           socket.destroy();
// // //           Logger.warn("Max clients reached, rejecting new connection");
// // //           return;
// // //         }

// // //         Logger.info(`Client connected: ${socket.remoteAddress}`);
// // //         connectedSockets.push(socket);
// // //         setSocket(server);
// // //         setDevices((prev) => [
// // //           ...prev.filter((d) => d.ip !== socket.remoteAddress),
// // //           {
// // //             ip: socket.remoteAddress || "Unknown",
// // //             name: "Unknown",
// // //             role: "Client",
// // //           },
// // //         ]);

// // //         socket.on("data", (data) => {
// // //           const { receiveFileInHost } = HostSharing();
// // //           try {
// // //             const message = data.toString().trim();
// // //             if (message.startsWith("{")) {
// // //               const parsed = JSON.parse(message);
// // //               if (parsed.type === "init" && parsed.name) {
// // //                 setDevices((prev) =>
// // //                   prev.map((d) =>
// // //                     d.ip === socket.remoteAddress
// // //                       ? { ...d, name: parsed.name }
// // //                       : d
// // //                   )
// // //                 );
// // //                 Logger.info(
// // //                   `Client ${socket.remoteAddress} identified as ${parsed.name}`
// // //                 );
// // //                 return;
// // //               }
// // //             }
// // //             receiveFileInHost({
// // //               data,
// // //               ip: socket.remoteAddress || "Unknown",
// // //               setMessages,
// // //               setReceivedFiles,
// // //               socket,
// // //               setTransferProgress,
// // //             });
// // //           } catch (error) {
// // //             Logger.error("Error processing client data", error);
// // //             receiveFileInHost({
// // //               data,
// // //               ip: socket.remoteAddress || "Unknown",
// // //               setMessages,
// // //               setReceivedFiles,
// // //               socket,
// // //               setTransferProgress,
// // //             });
// // //           }
// // //         });

// // //         socket.on("close", () => {
// // //           Logger.info(`Client disconnected: ${socket.remoteAddress}`);
// // //           connectedSockets = connectedSockets.filter((s) => s !== socket);
// // //           setDevices((prev) =>
// // //             prev.filter((d) => d.ip !== socket.remoteAddress)
// // //           );
// // //         });

// // //         socket.on("error", (err) => {
// // //           Logger.error(`Host Socket Error for ${socket.remoteAddress}`, err);
// // //         });
// // //       });

// // //       server.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
// // //         Logger.info(`Host TCP server running on port ${TCP_PORT}`);
// // //       });

// // //       server.on("error", (err) => {
// // //         Logger.error("Server Error", err);
// // //         stopHostServer();
// // //       });

// // //       server.on("close", () => {
// // //         Logger.info("Host TCP server closed");
// // //         isServerRunning = false;
// // //       });
// // //     } catch (err) {
// // //       Logger.error("Failed to start host server", err);
// // //       isServerRunning = false;
// // //       stopHostServer();
// // //     }
// // //   }

// // //   function stopHostServer(): void {
// // //     Logger.info("Stopping host server...");
// // //     connectedSockets.forEach((socket) => socket.destroy());
// // //     connectedSockets = [];
// // //     if (server) {
// // //       server.close();
// // //       server = null;
// // //       Logger.info("Host TCP server stopped");
// // //     }
// // //     if (udpSocket) {
// // //       udpSocket.close();
// // //       udpSocket = null;
// // //       Logger.info("Host UDP socket closed");
// // //     }
// // //     isServerRunning = false;
// // //     setDevicesRef = null;
// // //   }

// // //   function kickClient(
// // //     clientIp: string,
// // //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>
// // //   ): void {
// // //     const socketsToKick = connectedSockets.filter(
// // //       (socket) => socket.remoteAddress === clientIp
// // //     );
// // //     if (socketsToKick.length === 0) {
// // //       Logger.warn(`No client found with IP: ${clientIp}`);
// // //       return;
// // //     }

// // //     socketsToKick.forEach((socket) => {
// // //       Logger.info(`Kicking client: ${clientIp}`);
// // //       socket.destroy();
// // //     });

// // //     connectedSockets = connectedSockets.filter(
// // //       (socket) => socket.remoteAddress !== clientIp
// // //     );
// // //     setDevices((prev) => prev.filter((d) => d.ip !== clientIp));
// // //     Logger.info(
// // //       `Client ${clientIp} removed from connected sockets and devices`
// // //     );
// // //   }

// // //   return {
// // //     startHostServer,
// // //     stopHostServer,
// // //     kickClient,
// // //   };
// // // };

// // // export const ClientServer = () => {
// // //   async function startClientDiscovery(
// // //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>
// // //   ): Promise<void> {
// // //     try {
// // //       const localIP = await getLocalIPAddress();
// // //       Logger.info("Client Discovery Started...");

// // //       udpSocket = dgram.createSocket({ type: "udp4" });
// // //       udpSocket.bind(UDP_PORT);

// // //       udpSocket.on("listening", () => {
// // //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// // //         udpSocket!.setBroadcast(true);
// // //       });

// // //       udpSocket.on("message", (msg: Buffer, rinfo) => {
// // //         try {
// // //           const data = JSON.parse(msg.toString());
// // //           if (data.ip !== localIP && data.role === "Host") {
// // //             setDevices((prev) => [
// // //               ...prev.filter((device) => device.ip !== data.ip),
// // //               {
// // //                 ip: data.ip,
// // //                 name: data.name || "Unknown",
// // //                 role: "Host",
// // //               },
// // //             ]);
// // //             Logger.info(`Discovered host: ${data.ip} (${data.name})`);
// // //           }
// // //         } catch (error) {
// // //           Logger.error("Error parsing UDP message", error);
// // //         }
// // //       });

// // //       udpSocket.on("error", (err: Error) => {
// // //         Logger.error("UDP Socket Error", err);
// // //         stopClientDiscovery();
// // //       });
// // //     } catch (err) {
// // //       Logger.error("Failed to start client discovery", err);
// // //       stopClientDiscovery();
// // //     }
// // //   }

// // //   function stopClientDiscovery(): void {
// // //     Logger.info("Stopping client discovery...");
// // //     if (udpSocket) {
// // //       udpSocket.close();
// // //       udpSocket = null;
// // //       Logger.info("UDP socket closed");
// // //     }
// // //   }

// // //   async function connectToHost(
// // //     ip: string,
// // //     username: string,
// // //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// // //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// // //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// // //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// // //     setTransferProgress?: React.Dispatch<
// // //       React.SetStateAction<TransferProgress[]>
// // //     >
// // //   ): Promise<void> {
// // //     Logger.info(`Connecting to host at ${ip}...`);
// // //     const client = new TCPSocket.Socket();
// // //     clientSocket = client;

// // //     client.on("connect", () => {
// // //       Logger.info("Connected to host!");
// // //       setConnected(true);
// // //       setSocket(client);
// // //       const initMessage = JSON.stringify({ type: "init", name: username });
// // //       client.write(Buffer.from(initMessage + "\n"));
// // //     });

// // //     client.on("data", (data: string | Buffer) => {
// // //       const { receiveFileInClient } = ClientSharing();
// // //       receiveFileInClient({
// // //         client,
// // //         data,
// // //         ip,
// // //         setMessages,
// // //         setReceivedFiles,
// // //         setTransferProgress,
// // //       });
// // //     });

// // //     client.on("close", () => {
// // //       Logger.info("Disconnected from host");
// // //       disconnectFromHost(
// // //         setConnected,
// // //         setSocket,
// // //         setMessages,
// // //         setReceivedFiles,
// // //         setTransferProgress
// // //       );
// // //     });

// // //     client.on("error", (err) => {
// // //       Logger.error("Client Socket Error", err);
// // //       disconnectFromHost(
// // //         setConnected,
// // //         setSocket,
// // //         setMessages,
// // //         setReceivedFiles,
// // //         setTransferProgress
// // //       );
// // //     });

// // //     client.connect({ port: TCP_PORT, host: ip });
// // //   }

// // //   function disconnectFromHost(
// // //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// // //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// // //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// // //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// // //     setTransferProgress?: React.Dispatch<
// // //       React.SetStateAction<TransferProgress[]>
// // //     >
// // //   ): void {
// // //     Logger.info("Disconnecting from host...");
// // //     if (clientSocket) {
// // //       clientSocket.end();
// // //       clientSocket = null;
// // //       Logger.info("Client socket closed");
// // //     }
// // //     setConnected(false);
// // //     setSocket(null);
// // //     setMessages([]);
// // //     setReceivedFiles([]);
// // //     setTransferProgress?.([]);
// // //     Logger.info("Disconnected from host");
// // //   }

// // //   function stopClientServer(): void {
// // //     if (clientSocket) {
// // //       clientSocket.end();
// // //       clientSocket = null;
// // //       Logger.info("Client server stopped");
// // //     }
// // //   }

// // //   return {
// // //     startClientDiscovery,
// // //     connectToHost,
// // //     disconnectFromHost,
// // //     stopClientServer,
// // //   };
// // // };

// // // import dgram from "react-native-udp";
// // // import {
// // //   getLocalIPAddress,
// // //   getBroadcastIPAddress,
// // // } from "../utils/NetworkUtils";
// // // import { Buffer } from "buffer";
// // // import { Logger } from "../utils/Logger";
// // // import { ERROR_CODES } from "../utils/Error";
// // // import TCPSocket from "react-native-tcp-socket";
// // // import { HostSharing } from "./HostSharing";
// // // import { ClientSharing } from "./ClientSharing";

// // // const UDP_PORT = 5000;
// // // const TCP_PORT = 6000;
// // // const MAX_CLIENTS = 5;

// // // type UdpSocket = ReturnType<typeof dgram.createSocket>;
// // // interface ConnectedSocket extends TCPSocket.Socket {}

// // // let connectedSockets: ConnectedSocket[] = []; // Single source of truth for connected clients
// // // let isServerRunning = false;
// // // let udpSocket: UdpSocket | null = null;
// // // let server: TCPSocket.Server | null = null;
// // // let clientSocket: TCPSocket.Socket | null = null;

// // // export const HostServer = () => {
// // //   let setDevicesRef: React.Dispatch<React.SetStateAction<Device[]>> | null = null;

// // //   async function startHostServer(
// // //     username: string,
// // //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// // //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>,
// // //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Server | null>>,
// // //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// // //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// // //     setTransferProgress?: React.Dispatch<
// // //       React.SetStateAction<TransferProgress[]>
// // //     >
// // //   ): Promise<void> {
// // //     if (isServerRunning) {
// // //       Logger.info("Host server already running, skipping start.");
// // //       return;
// // //     }
// // //     isServerRunning = true;
// // //     setDevicesRef = setDevices;

// // //     try {
// // //       const ip = await getLocalIPAddress();
// // //       const broadcastAddr = await getBroadcastIPAddress();
// // //       Logger.info(
// // //         `Host started on IP: ${ip}, Broadcasting to: ${broadcastAddr}`
// // //       );

// // //       udpSocket = dgram.createSocket({ type: "udp4" });
// // //       udpSocket.bind(UDP_PORT);

// // //       udpSocket.once("listening", () => {
// // //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// // //         udpSocket!.setBroadcast(true);
// // //         const broadcastInterval = setInterval(() => {
// // //           const message = JSON.stringify({ role: "Host", ip, name: username });
// // //           udpSocket!.send(
// // //             Buffer.from(message),
// // //             0,
// // //             message.length,
// // //             UDP_PORT,
// // //             broadcastAddr,
// // //             (err) => {
// // //               if (err) Logger.error("UDP Send Error", err);
// // //             }
// // //           );
// // //         }, 2000);

// // //         udpSocket!.on("close", () => clearInterval(broadcastInterval));
// // //       });

// // //       udpSocket.on("error", (err: Error) => {
// // //         Logger.error("UDP Socket Error", err);
// // //         isServerRunning = false;
// // //         udpSocket?.close();
// // //         udpSocket = null;
// // //       });

// // //       server = new TCPSocket.Server();
// // //       server.on("connection", (socket: ConnectedSocket) => {
// // //         setConnected(true);
// // //         if (connectedSockets.length >= MAX_CLIENTS) {
// // //           socket.write(
// // //             Buffer.from(`ERROR:${ERROR_CODES.MAX_CLIENTS_REACHED}\n`)
// // //           );
// // //           socket.destroy();
// // //           Logger.warn("Max clients reached, rejecting new connection");
// // //           return;
// // //         }

// // //         Logger.info(`Client connected: ${socket.remoteAddress}`);
// // //         connectedSockets.push(socket); // Add to global connectedSockets
// // //         setSocket(server);
// // //         setDevices((prev) => [
// // //           ...prev.filter((d) => d.ip !== socket.remoteAddress),
// // //           {
// // //             ip: socket.remoteAddress || "Unknown",
// // //             name: "Unknown",
// // //             role: "Client",
// // //           },
// // //         ]);

// // //         socket.on("data", (data) => {
// // //           const { receiveFileInHost } = HostSharing();
// // //           try {
// // //             const message = data.toString().trim();
// // //             if (message.startsWith("{")) {
// // //               const parsed = JSON.parse(message);
// // //               if (parsed.type === "init" && parsed.name) {
// // //                 setDevices((prev) =>
// // //                   prev.map((d) =>
// // //                     d.ip === socket.remoteAddress
// // //                       ? { ...d, name: parsed.name }
// // //                       : d
// // //                   )
// // //                 );
// // //                 Logger.info(
// // //                   `Client ${socket.remoteAddress} identified as ${parsed.name}`
// // //                 );
// // //                 return;
// // //               }
// // //             }
// // //             receiveFileInHost({
// // //               data,
// // //               ip: socket.remoteAddress || "Unknown",
// // //               setMessages,
// // //               setReceivedFiles,
// // //               socket,
// // //               setTransferProgress,
// // //             });
// // //           } catch (error) {
// // //             Logger.error("Error processing client data", error);
// // //             receiveFileInHost({
// // //               data,
// // //               ip: socket.remoteAddress || "Unknown",
// // //               setMessages,
// // //               setReceivedFiles,
// // //               socket,
// // //               setTransferProgress,
// // //             });
// // //           }
// // //         });

// // //         socket.on("close", () => {
// // //           Logger.info(`Client disconnected: ${socket.remoteAddress}`);
// // //           connectedSockets = connectedSockets.filter((s) => s !== socket); // Remove from global connectedSockets
// // //           setDevices((prev) =>
// // //             prev.filter((d) => d.ip !== socket.remoteAddress)
// // //           );
// // //         });

// // //         socket.on("error", (err) => {
// // //           Logger.error(`Host Socket Error for ${socket.remoteAddress}`, err);
// // //         });
// // //       });

// // //       server.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
// // //         Logger.info(`Host TCP server running on port ${TCP_PORT}`);
// // //       });

// // //       server.on("error", (err) => {
// // //         Logger.error("Server Error", err);
// // //         stopHostServer();
// // //       });

// // //       server.on("close", () => {
// // //         Logger.info("Host TCP server closed");
// // //         isServerRunning = false;
// // //       });
// // //     } catch (err) {
// // //       Logger.error("Failed to start host server", err);
// // //       isServerRunning = false;
// // //       stopHostServer();
// // //     }
// // //   }

// // //   function stopHostServer(): void {
// // //     Logger.info("Stopping host server...");
// // //     connectedSockets.forEach((socket) => socket.destroy());
// // //     connectedSockets = []; // Clear global connectedSockets
// // //     if (server) {
// // //       server.close();
// // //       server = null;
// // //       Logger.info("Host TCP server stopped");
// // //     }
// // //     if (udpSocket) {
// // //       udpSocket.close();
// // //       udpSocket = null;
// // //       Logger.info("Host UDP socket closed");
// // //     }
// // //     isServerRunning = false;
// // //     setDevicesRef = null;
// // //   }

// // //   function kickClient(
// // //     clientIp: string,
// // //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>
// // //   ): void {
// // //     const socketsToKick = connectedSockets.filter(
// // //       (socket) => socket.remoteAddress === clientIp
// // //     );
// // //     if (socketsToKick.length === 0) {
// // //       Logger.warn(`No client found with IP: ${clientIp}`);
// // //       return;
// // //     }

// // //     socketsToKick.forEach((socket) => {
// // //       Logger.info(`Kicking client: ${clientIp}`);
// // //       socket.destroy();
// // //     });

// // //     connectedSockets = connectedSockets.filter(
// // //       (socket) => socket.remoteAddress !== clientIp
// // //     ); // Update global connectedSockets
// // //     setDevices((prev) => prev.filter((d) => d.ip !== clientIp));
// // //     Logger.info(
// // //       `Client ${clientIp} removed from connected sockets and devices`
// // //     );
// // //   }

// // //   return {
// // //     startHostServer,
// // //     stopHostServer,
// // //     kickClient,
// // //     connectedSockets, // Expose connectedSockets for use in HostSharing
// // //   };
// // // };

// // // export const ClientServer = () => {
// // //   async function startClientDiscovery(
// // //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>
// // //   ): Promise<void> {
// // //     try {
// // //       const localIP = await getLocalIPAddress();
// // //       Logger.info("Client Discovery Started...");

// // //       udpSocket = dgram.createSocket({ type: "udp4" });
// // //       udpSocket.bind(UDP_PORT);

// // //       udpSocket.on("listening", () => {
// // //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// // //         udpSocket!.setBroadcast(true);
// // //       });

// // //       udpSocket.on("message", (msg: Buffer, rinfo) => {
// // //         try {
// // //           const data = JSON.parse(msg.toString());
// // //           if (data.ip !== localIP && data.role === "Host") {
// // //             setDevices((prev) => [
// // //               ...prev.filter((device) => device.ip !== data.ip),
// // //               {
// // //                 ip: data.ip,
// // //                 name: data.name || "Unknown",
// // //                 role: "Host",
// // //               },
// // //             ]);
// // //             Logger.info(`Discovered host: ${data.ip} (${data.name})`);
// // //           }
// // //         } catch (error) {
// // //           Logger.error("Error parsing UDP message", error);
// // //         }
// // //       });

// // //       udpSocket.on("error", (err: Error) => {
// // //         Logger.error("UDP Socket Error", err);
// // //         stopClientDiscovery();
// // //       });
// // //     } catch (err) {
// // //       Logger.error("Failed to start client discovery", err);
// // //       stopClientDiscovery();
// // //     }
// // //   }

// // //   function stopClientDiscovery(): void {
// // //     Logger.info("Stopping client discovery...");
// // //     if (udpSocket) {
// // //       udpSocket.close();
// // //       udpSocket = null;
// // //       Logger.info("UDP socket closed");
// // //     }
// // //   }

// // //   async function connectToHost(
// // //     ip: string,
// // //     username: string,
// // //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// // //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// // //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// // //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// // //     setTransferProgress?: React.Dispatch<
// // //       React.SetStateAction<TransferProgress[]>
// // //     >
// // //   ): Promise<void> {
// // //     Logger.info(`Connecting to host at ${ip}...`);
// // //     const client = new TCPSocket.Socket();
// // //     clientSocket = client;

// // //     client.on("connect", () => {
// // //       Logger.info("Connected to host!");
// // //       setConnected(true);
// // //       setSocket(client);
// // //       const initMessage = JSON.stringify({ type: "init", name: username });
// // //       client.write(Buffer.from(initMessage + "\n"));
// // //     });

// // //     client.on("data", (data: string | Buffer) => {
// // //       const { receiveFileInClient } = ClientSharing();
// // //       receiveFileInClient({
// // //         client,
// // //         data,
// // //         ip,
// // //         setMessages,
// // //         setReceivedFiles,
// // //         setTransferProgress,
// // //       });
// // //     });

// // //     client.on("close", () => {
// // //       Logger.info("Disconnected from host");
// // //       disconnectFromHost(
// // //         setConnected,
// // //         setSocket,
// // //         setMessages,
// // //         setReceivedFiles,
// // //         setTransferProgress
// // //       );
// // //     });

// // //     client.on("error", (err) => {
// // //       Logger.error("Client Socket Error", err);
// // //       disconnectFromHost(
// // //         setConnected,
// // //         setSocket,
// // //         setMessages,
// // //         setReceivedFiles,
// // //         setTransferProgress
// // //       );
// // //     });

// // //     client.connect({ port: TCP_PORT, host: ip });
// // //   }

// // //   function disconnectFromHost(
// // //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// // //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// // //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// // //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// // //     setTransferProgress?: React.Dispatch<
// // //       React.SetStateAction<TransferProgress[]>
// // //     >
// // //   ): void {
// // //     Logger.info("Disconnecting from host...");
// // //     if (clientSocket) {
// // //       clientSocket.end();
// // //       clientSocket = null;
// // //       Logger.info("Client socket closed");
// // //     }
// // //     setConnected(false);
// // //     setSocket(null);
// // //     setMessages([]);
// // //     setReceivedFiles([]);
// // //     setTransferProgress?.([]);
// // //     Logger.info("Disconnected from host");
// // //   }

// // //   function stopClientServer(): void {
// // //     if (clientSocket) {
// // //       clientSocket.end();
// // //       clientSocket = null;
// // //       Logger.info("Client server stopped");
// // //     }
// // //   }

// // //   return {
// // //     startClientDiscovery,
// // //     connectToHost,
// // //     disconnectFromHost,
// // //     stopClientServer,
// // //   };
// // // };

// // // import dgram from "react-native-udp";
// // // import {
// // //   getLocalIPAddress,
// // //   getBroadcastIPAddress,
// // // } from "../utils/NetworkUtils";
// // // import { Buffer } from "buffer";
// // // import { Logger } from "../utils/Logger";
// // // import { ERROR_CODES } from "../utils/Error";
// // // import TCPSocket from "react-native-tcp-socket";
// // // import { } from "./Sharing"

// // // const UDP_PORT = 5000;
// // // const TCP_PORT = 6000;
// // // const MAX_CLIENTS = 5;

// // // type UdpSocket = ReturnType<typeof dgram.createSocket>;
// // // interface ConnectedSocket extends TCPSocket.Socket {}

// // // let connectedSockets: ConnectedSocket[] = [];
// // // let isServerRunning = false;
// // // let udpSocket: UdpSocket | null = null;
// // // let server: TCPSocket.Server | null = null;
// // // let clientSocket: TCPSocket.Socket | null = null;

// // // export const HostServer = () => {
// // //   async function startHostServer(
// // //     username: string,
// // //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>,
// // //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Server | null>>,
// // //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// // //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// // //     setTransferProgress?: React.Dispatch<
// // //       React.SetStateAction<TransferProgress[]>
// // //     >
// // //   ): Promise<void> {
// // //     if (isServerRunning) {
// // //       Logger.info("Host server already running, skipping start.");
// // //       return;
// // //     }
// // //     isServerRunning = true;

// // //     try {
// // //       const ip = await getLocalIPAddress();
// // //       const broadcastAddr = await getBroadcastIPAddress();
// // //       Logger.info(
// // //         `Host started on IP: ${ip}, Broadcasting to: ${broadcastAddr}`
// // //       );

// // //       udpSocket = dgram.createSocket({ type: "udp4" });
// // //       udpSocket.bind(UDP_PORT);

// // //       udpSocket.once("listening", () => {
// // //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// // //         udpSocket!.setBroadcast(true);
// // //         const broadcastInterval = setInterval(() => {
// // //           const message = JSON.stringify({ role: "Host", ip, name: username });
// // //           udpSocket!.send(
// // //             Buffer.from(message),
// // //             0,
// // //             message.length,
// // //             UDP_PORT,
// // //             broadcastAddr,
// // //             (err) => {
// // //               if (err) Logger.error("UDP Send Error", err);
// // //             }
// // //           );
// // //         }, 2000);

// // //         udpSocket!.on("close", () => clearInterval(broadcastInterval));
// // //       });

// // //       udpSocket.on("error", (err: Error) => {
// // //         Logger.error("UDP Socket Error", err);
// // //         isServerRunning = false;
// // //         udpSocket?.close();
// // //         udpSocket = null;
// // //       });

// // //       server = new TCPSocket.Server();
// // //       server.on("connection", (socket: ConnectedSocket) => {
// // //         if (connectedSockets.length >= MAX_CLIENTS) {
// // //           socket.write(
// // //             Buffer.from(`ERROR:${ERROR_CODES.MAX_CLIENTS_REACHED}\n`)
// // //           );
// // //           socket.destroy();
// // //           Logger.warn("Max clients reached, rejecting new connection");
// // //           return;
// // //         }

// // //         Logger.info(`Client connected: ${socket.remoteAddress}`);
// // //         connectedSockets.push(socket);
// // //         setSocket(server);
// // //         setDevices((prev) => [
// // //           ...prev.filter((d) => d.ip !== socket.remoteAddress),
// // //           {
// // //             ip: socket.remoteAddress || "Unknown",
// // //             name: "Unknown",
// // //             role: "Client",
// // //           },
// // //         ]);

// // //         socket.on("data", (data) => {
// // //           const { receiveFileInHost } = HostSharing();
// // //           receiveFileInHost({
// // //             data,
// // //             setMessages,
// // //             setReceivedFiles,
// // //             socket,
// // //             setTransferProgress,
// // //           });
// // //         });

// // //         socket.on("close", () => {
// // //           Logger.info(`Client disconnected: ${socket.remoteAddress}`);
// // //           connectedSockets = connectedSockets.filter((s) => s !== socket);
// // //           setDevices((prev) =>
// // //             prev.filter((d) => d.ip !== socket.remoteAddress)
// // //           );
// // //         });

// // //         socket.on("error", (err) => {
// // //           Logger.error(`Host Socket Error for ${socket.remoteAddress}`, err);
// // //         });
// // //       });

// // //       server.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
// // //         Logger.info(`Host TCP server running on port ${TCP_PORT}`);
// // //       });

// // //       server.on("error", (err) => {
// // //         Logger.error("Server Error", err);
// // //         stopHostServer();
// // //       });

// // //       server.on("close", () => {
// // //         Logger.info("Host TCP server closed");
// // //         isServerRunning = false;
// // //       });
// // //     } catch (err) {
// // //       Logger.error("Failed to start host server", err);
// // //       isServerRunning = false;
// // //       stopHostServer();
// // //     }
// // //   }

// // //   function stopHostServer(): void {
// // //     Logger.info("Stopping host server...");
// // //     connectedSockets.forEach((socket) => socket.destroy());
// // //     connectedSockets = [];
// // //     if (server) {
// // //       server.close();
// // //       server = null;
// // //       Logger.info("Host TCP server stopped");
// // //     }
// // //     if (udpSocket) {
// // //       udpSocket.close();
// // //       udpSocket = null;
// // //       Logger.info("Host UDP socket closed");
// // //     }
// // //     isServerRunning = false;
// // //   }

// // //   function kickClient(clientIp: string): void {
// // //     connectedSockets.forEach((socket) => {
// // //       if (socket.remoteAddress === clientIp) {
// // //         socket.destroy();
// // //       }
// // //     });
// // //   }

// // //   return {
// // //     startHostServer,
// // //     stopHostServer,
// // //     kickClient,
// // //   };
// // // };

// // // export const ClientServer = () => {
// // //   async function startClientDiscovery(
// // //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>
// // //   ): Promise<void> {
// // //     try {
// // //       const localIP = await getLocalIPAddress();
// // //       Logger.info("Client Discovery Started...");

// // //       udpSocket = dgram.createSocket({ type: "udp4" });
// // //       udpSocket.bind(UDP_PORT);

// // //       udpSocket.on("listening", () => {
// // //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// // //         udpSocket!.setBroadcast(true);
// // //       });

// // //       udpSocket.on("message", (msg: Buffer, rinfo) => {
// // //         try {
// // //           const data = JSON.parse(msg.toString());
// // //           if (data.ip !== localIP && data.role === "Host") {
// // //             setDevices((prev) => [
// // //               ...prev.filter((device) => device.ip !== data.ip),
// // //               {
// // //                 ip: data.ip,
// // //                 name: rinfo.name,
// // //                 role: "Host",
// // //               },
// // //             ]);
// // //             // Logger.info(`Discovered host: ${data.ip} (${data.name})`);
// // //           }
// // //         } catch (error) {
// // //           Logger.error("Error parsing UDP message", error);
// // //         }
// // //       });

// // //       udpSocket.on("error", (err: Error) => {
// // //         Logger.error("UDP Socket Error", err);
// // //         stopClientDiscovery();
// // //       });
// // //     } catch (err) {
// // //       Logger.error("Failed to start client discovery", err);
// // //       stopClientDiscovery();
// // //     }
// // //   }

// // //   function stopClientDiscovery(): void {
// // //     Logger.info("Stopping client discovery...");
// // //     if (udpSocket) {
// // //       udpSocket.close();
// // //       udpSocket = null;
// // //       Logger.info("UDP socket closed");
// // //     }
// // //   }

// // //   async function connectToHost(
// // //     ip: string,
// // //     username: string,
// // //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// // //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// // //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// // //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// // //     setTransferProgress?: React.Dispatch<
// // //       React.SetStateAction<TransferProgress[]>
// // //     >
// // //   ): Promise<void> {
// // //     Logger.info(`Connecting to host at ${ip}...`);
// // //     const client = new TCPSocket.Socket();
// // //     clientSocket = client;

// // //     client.on("connect", () => {
// // //       Logger.info("Connected to host!");
// // //       setConnected(true);
// // //       setSocket(client);
// // //     });

// // //     client.on("data", (data: string | Buffer) => {
// // //       const { receiveFileInClient } = ClientSharing();
// // //       receiveFileInClient({
// // //         client,
// // //         data,
// // //         ip,
// // //         setMessages,
// // //         setReceivedFiles,
// // //         setTransferProgress,
// // //       });
// // //     });

// // //     client.on("close", () => {
// // //       Logger.info("Disconnected from host");
// // //       disconnectFromHost(
// // //         setConnected,
// // //         setSocket,
// // //         setMessages,
// // //         setReceivedFiles,
// // //         setTransferProgress
// // //       );
// // //     });

// // //     client.on("error", (err) => {
// // //       Logger.error("Client Socket Error", err);
// // //       disconnectFromHost(
// // //         setConnected,
// // //         setSocket,
// // //         setMessages,
// // //         setReceivedFiles,
// // //         setTransferProgress
// // //       );
// // //     });

// // //     client.connect({ port: TCP_PORT, host: ip });
// // //   }

// // //   function disconnectFromHost(
// // //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// // //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// // //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// // //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// // //     setTransferProgress?: React.Dispatch<
// // //       React.SetStateAction<TransferProgress[]>
// // //     >
// // //   ): void {
// // //     Logger.info("Disconnecting from host...");
// // //     if (clientSocket) {
// // //       clientSocket.end();
// // //       clientSocket = null;
// // //       Logger.info("Client socket closed");
// // //     }
// // //     setConnected(false);
// // //     setSocket(null);
// // //     setMessages([]);
// // //     setReceivedFiles([]);
// // //     setTransferProgress?.([]);
// // //     Logger.info("Disconnected from host");
// // //   }

// // //   function stopClientServer(): void {
// // //     if (clientSocket) {
// // //       clientSocket.end();
// // //       clientSocket = null;
// // //       Logger.info("Client server stopped");
// // //     }
// // //   }
// // //   return {
// // //     startClientDiscovery,
// // //     connectToHost,
// // //     disconnectFromHost,
// // //     stopClientServer,
// // //   };
// // // };

// // import dgram from "react-native-udp";
// // import {
// //   getLocalIPAddress,
// //   getBroadcastIPAddress,
// // } from "../utils/NetworkUtils";
// // import { Buffer } from "buffer";
// // import { Logger } from "../utils/Logger";
// // import { ERROR_CODES } from "../utils/Error";
// // import TCPSocket from "react-native-tcp-socket";
// // import { ClientSharing, HostSharing } from "./Sharing";

// // const UDP_PORT = 5000;
// // const TCP_PORT = 6000;
// // const MAX_CLIENTS = 5;
// // const APP_ID = "Dropshare_shubham-mishra";

// // type UdpSocket = ReturnType<typeof dgram.createSocket>;
// // interface ConnectedSocket extends TCPSocket.Socket {}

// // let connectedSockets: ConnectedSocket[] = [];
// // let isServerRunning = false;
// // let udpSocket: UdpSocket | null = null;
// // let server: TCPSocket.Server | null = null;
// // let clientSocket: TCPSocket.Socket | null = null;

// // export const HostServer = () => {
// //   async function startHostServer(
// //     username: string,
// //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>,
// //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Server | null>>,
// //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// //     setIsHostConnected: React.Dispatch<React.SetStateAction<boolean>>,
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): Promise<void> {
// //     if (isServerRunning) {
// //       Logger.info("Host server already running, skipping start.");
// //       return;
// //     }
// //     isServerRunning = true;

// //     try {
// //       const ip = await getLocalIPAddress();
// //       const broadcastAddr = await getBroadcastIPAddress();
// //       Logger.info(
// //         `Host started on IP: ${ip}, Broadcasting to: ${broadcastAddr}`
// //       );

// //       udpSocket = dgram.createSocket({ type: "udp4" });
// //       udpSocket.bind(UDP_PORT);

// //       udpSocket.once("listening", () => {
// //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// //         udpSocket!.setBroadcast(true);
// //         const broadcastInterval = setInterval(() => {
// //           const message = JSON.stringify({
// //             appId: APP_ID,
// //             role: "Host",
// //             ip,
// //             name: username,
// //           });
// //           udpSocket!.send(
// //             Buffer.from(message),
// //             0,
// //             message.length,
// //             UDP_PORT,
// //             broadcastAddr,
// //             (err) => {
// //               if (err) Logger.error("UDP Send Error", err);
// //             }
// //           );
// //         }, 2000);

// //         udpSocket!.on("close", () => clearInterval(broadcastInterval));
// //       });

// //       udpSocket.on("error", (err: Error) => {
// //         Logger.error("UDP Socket Error", err);
// //         isServerRunning = false;
// //         udpSocket?.close();
// //         udpSocket = null;
// //       });

// //       server = new TCPSocket.Server();
// //       server.on("connection", (socket: ConnectedSocket) => {
// //         if (connectedSockets.length >= MAX_CLIENTS) {
// //           socket.write(
// //             Buffer.from(`ERROR:${ERROR_CODES.MAX_CLIENTS_REACHED}\n`)
// //           );
// //           socket.destroy();
// //           Logger.warn("Max clients reached, rejecting new connection");
// //           return;
// //         }

// //         Logger.info(`Client connected: ${socket.remoteAddress}`);
// //         connectedSockets.push(socket);
// //         setIsHostConnected(true);
// //         setSocket(server);
// //         socket.once("data", (data) => {
// //           try {
// //             const message = data.toString();
// //             if (message.startsWith("USERNAME:")) {
// //               const clientUsername = message.replace("USERNAME:", "").trim();
// //               setDevices((prev) => [
// //                 ...prev.filter((d) => d.ip !== socket.remoteAddress),
// //                 {
// //                   ip: socket.remoteAddress || "Unknown",
// //                   name: clientUsername || "Unknown",
// //                   role: "Client",
// //                 },
// //               ]);
// //             } else {
// //               Logger.warn(
// //                 `Unexpected initial message from ${socket.remoteAddress}: ${message}`
// //               );
// //             }
// //           } catch (err) {
// //             Logger.error("Error processing client username", err);
// //             setDevices((prev) => [
// //               ...prev.filter((d) => d.ip !== socket.remoteAddress),
// //               {
// //                 ip: socket.remoteAddress || "Unknown",
// //                 name: "Unknown",
// //                 role: "Client",
// //               },
// //             ]);
// //           }
// //           socket.on("data", (data) => {
// //             const { receiveFileInHost } = HostSharing();
// //             receiveFileInHost({
// //               data,
// //               setMessages,
// //               setReceivedFiles,
// //               socket,
// //               connectedSockets,
// //               setTransferProgress,
// //             });
// //           });
// //         });

// //         socket.on("close", () => {
// //           Logger.info(`Client disconnected: ${socket.remoteAddress}`);
// //           setIsHostConnected(false);
// //           connectedSockets = connectedSockets.filter((s) => s !== socket);
// //           setDevices((prev) =>
// //             prev.filter((d) => d.ip !== socket.remoteAddress)
// //           );
// //         });

// //         socket.on("error", (err) => {
// //           Logger.error(`Host Socket Error for ${socket.remoteAddress}`, err);
// //         });
// //       });

// //       server.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
// //         Logger.info(`Host TCP server running on port ${TCP_PORT}`);
// //       });

// //       server.on("error", (err) => {
// //         Logger.error("Server Error", err);
// //         stopHostServer();
// //       });

// //       server.on("close", () => {
// //         Logger.info("Host TCP server closed");
// //         isServerRunning = false;
// //       });
// //     } catch (err) {
// //       Logger.error("Failed to start host server", err);
// //       isServerRunning = false;
// //       stopHostServer();
// //     }
// //   }

// //   function stopHostServer(): void {
// //     Logger.info("Stopping host server...");
// //     connectedSockets.forEach((socket) => socket.destroy());
// //     connectedSockets = [];
// //     if (server) {
// //       server.close();
// //       server = null;
// //       Logger.info("Host TCP server stopped");
// //     }
// //     if (udpSocket) {
// //       udpSocket.close();
// //       udpSocket = null;
// //       Logger.info("Host UDP socket closed");
// //     }
// //     isServerRunning = false;
// //   }

// //   function kickClient(clientIp: string): void {
// //     connectedSockets.forEach((socket) => {
// //       if (socket.remoteAddress === clientIp) {
// //         socket.destroy();
// //       }
// //     });
// //   }

// //   return {
// //     startHostServer,
// //     stopHostServer,
// //     kickClient,
// //     connectedSockets,
// //   };
// // };

// // export const ClientServer = () => {
// //   async function startClientDiscovery(
// //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>
// //   ): Promise<void> {
// //     try {
// //       const localIP = await getLocalIPAddress();
// //       Logger.info("Client Discovery Started...");

// //       udpSocket = dgram.createSocket({ type: "udp4" });
// //       udpSocket.bind(UDP_PORT);

// //       udpSocket.on("listening", () => {
// //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// //         udpSocket!.setBroadcast(true);
// //       });

// //       udpSocket.on("message", (msg: Buffer, rinfo) => {
// //         try {
// //           const data = JSON.parse(msg.toString());
// //           if (data.appId !== APP_ID) {
// //             return;
// //           }
// //           if (data.ip !== localIP && data.role === "Host") {
// //             setDevices((prev) => [
// //               ...prev.filter((device) => device.ip !== data.ip),
// //               {
// //                 ip: data.ip,
// //                 name: data.name || "Unknown Host",
// //                 role: "Host",
// //               },
// //             ]);
// //           }
// //         } catch (error) {
// //           Logger.error("Error parsing UDP message", error);
// //         }
// //       });

// //       udpSocket.on("error", (err: Error) => {
// //         Logger.error("UDP Socket Error", err);
// //         stopClientDiscovery();
// //       });
// //     } catch (err) {
// //       Logger.error("Failed to start client discovery", err);
// //       stopClientDiscovery();
// //     }
// //   }

// //   function stopClientDiscovery(): void {
// //     Logger.info("Stopping client discovery...");
// //     if (udpSocket) {
// //       udpSocket.close();
// //       udpSocket = null;
// //       Logger.info("UDP socket closed");
// //     }
// //   }

// //   async function connectToHost(
// //     ip: string,
// //     username: string,
// //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): Promise<void> {
// //     Logger.info(`Connecting to host at ${ip}...`);
// //     const client = new TCPSocket.Socket();
// //     clientSocket = client;

// //     client.on("connect", () => {
// //       Logger.info("Connected to host!");
// //       setConnected(true);
// //       setSocket(client);
// //       client.write(Buffer.from(`USERNAME:${username}\n`));
// //     });

// //     client.on("data", (data: string | Buffer) => {
// //       const { receiveFileInClient } = ClientSharing();
// //       receiveFileInClient({
// //         client,
// //         data,
// //         ip,
// //         setMessages,
// //         setReceivedFiles,
// //         connectedSockets,
// //         setTransferProgress,
// //       });
// //     });

// //     client.on("close", () => {
// //       Logger.info("Disconnected from host");
// //       disconnectFromHost(
// //         setConnected,
// //         setSocket,
// //         setMessages,
// //         setReceivedFiles,
// //         setTransferProgress
// //       );
// //     });

// //     client.on("error", (err) => {
// //       Logger.error("Client Socket Error", err);
// //       disconnectFromHost(
// //         setConnected,
// //         setSocket,
// //         setMessages,
// //         setReceivedFiles,
// //         setTransferProgress
// //       );
// //     });

// //     client.connect({ port: TCP_PORT, host: ip });
// //   }

// //   function disconnectFromHost(
// //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): void {
// //     Logger.info("Disconnecting from host...");
// //     if (clientSocket) {
// //       clientSocket.end();
// //       clientSocket = null;
// //       Logger.info("Client socket closed");
// //     }
// //     setConnected(false);
// //     setSocket(null);
// //     setMessages([]);
// //     setReceivedFiles([]);
// //     setTransferProgress?.([]);
// //     Logger.info("Disconnected from host");
// //   }

// //   function stopClientServer(): void {
// //     if (clientSocket) {
// //       clientSocket.end();
// //       clientSocket = null;
// //       Logger.info("Client server stopped");
// //     }
// //   }

// //   return {
// //     startClientDiscovery,
// //     connectToHost,
// //     disconnectFromHost,
// //     stopClientServer,
// //   };
// // };

// // import dgram from "react-native-udp";
// // import {
// //   getLocalIPAddress,
// //   getBroadcastIPAddress,
// // } from "../utils/NetworkUtils";
// // import { Buffer } from "buffer";
// // import { Logger } from "../utils/Logger";
// // import { ERROR_CODES } from "../utils/Error";
// // import TCPSocket from "react-native-tcp-socket";
// // import { HostSharing } from "./HostSharing";
// // import { ClientSharing } from "./ClientSharing";

// // const UDP_PORT = 5000;
// // const TCP_PORT = 6000;
// // const MAX_CLIENTS = 5;

// // type UdpSocket = ReturnType<typeof dgram.createSocket>;
// // interface ConnectedSocket extends TCPSocket.Socket {}

// // let connectedSockets: ConnectedSocket[] = [];
// // let isServerRunning = false;
// // let udpSocket: UdpSocket | null = null;
// // let server: TCPSocket.Server | null = null;
// // let clientSocket: TCPSocket.Socket | null = null;

// // export const HostServer = () => {
// //   let setDevicesRef: React.Dispatch<React.SetStateAction<Device[]>> | null =
// //     null;

// //   async function startHostServer(
// //     username: string,
// //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>,
// //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Server | null>>,
// //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): Promise<void> {
// //     if (isServerRunning) {
// //       Logger.info("Host server already running, skipping start.");
// //       return;
// //     }
// //     isServerRunning = true;
// //     setDevicesRef = setDevices;

// //     try {
// //       const ip = await getLocalIPAddress();
// //       const broadcastAddr = await getBroadcastIPAddress();
// //       Logger.info(
// //         `Host started on IP: ${ip}, Broadcasting to: ${broadcastAddr}`
// //       );

// //       udpSocket = dgram.createSocket({ type: "udp4" });
// //       udpSocket.bind(UDP_PORT);

// //       udpSocket.once("listening", () => {
// //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// //         udpSocket!.setBroadcast(true);
// //         const broadcastInterval = setInterval(() => {
// //           const message = JSON.stringify({ role: "Host", ip, name: username });
// //           udpSocket!.send(
// //             Buffer.from(message),
// //             0,
// //             message.length,
// //             UDP_PORT,
// //             broadcastAddr,
// //             (err) => {
// //               if (err) Logger.error("UDP Send Error", err);
// //             }
// //           );
// //         }, 2000);

// //         udpSocket!.on("close", () => clearInterval(broadcastInterval));
// //       });

// //       udpSocket.on("error", (err: Error) => {
// //         Logger.error("UDP Socket Error", err);
// //         isServerRunning = false;
// //         udpSocket?.close();
// //         udpSocket = null;
// //       });

// //       server = new TCPSocket.Server();
// //       server.on("connection", (socket: ConnectedSocket) => {
// //         setConnected(true);
// //         if (connectedSockets.length >= MAX_CLIENTS) {
// //           socket.write(
// //             Buffer.from(`ERROR:${ERROR_CODES.MAX_CLIENTS_REACHED}\n`)
// //           );
// //           socket.destroy();
// //           Logger.warn("Max clients reached, rejecting new connection");
// //           return;
// //         }

// //         Logger.info(`Client connected: ${socket.remoteAddress}`);
// //         connectedSockets.push(socket);
// //         setSocket(server);
// //         setDevices((prev) => [
// //           ...prev.filter((d) => d.ip !== socket.remoteAddress),
// //           {
// //             ip: socket.remoteAddress || "Unknown",
// //             name: "Unknown",
// //             role: "Client",
// //           },
// //         ]);

// //         socket.on("data", (data) => {
// //           const { receiveFileInHost } = HostSharing();
// //           try {
// //             const message = data.toString().trim();
// //             if (message.startsWith("{")) {
// //               const parsed = JSON.parse(message);
// //               if (parsed.type === "init" && parsed.name) {
// //                 setDevices((prev) =>
// //                   prev.map((d) =>
// //                     d.ip === socket.remoteAddress
// //                       ? { ...d, name: parsed.name }
// //                       : d
// //                   )
// //                 );
// //                 Logger.info(
// //                   `Client ${socket.remoteAddress} identified as ${parsed.name}`
// //                 );
// //                 return;
// //               }
// //             }
// //             receiveFileInHost({
// //               data,
// //               ip: socket.remoteAddress || "Unknown",
// //               setMessages,
// //               setReceivedFiles,
// //               socket,
// //               setTransferProgress,
// //             });
// //           } catch (error) {
// //             Logger.error("Error processing client data", error);
// //             receiveFileInHost({
// //               data,
// //               ip: socket.remoteAddress || "Unknown",
// //               setMessages,
// //               setReceivedFiles,
// //               socket,
// //               setTransferProgress,
// //             });
// //           }
// //         });

// //         socket.on("close", () => {
// //           Logger.info(`Client disconnected: ${socket.remoteAddress}`);
// //           connectedSockets = connectedSockets.filter((s) => s !== socket);
// //           setDevices((prev) =>
// //             prev.filter((d) => d.ip !== socket.remoteAddress)
// //           );
// //         });

// //         socket.on("error", (err) => {
// //           Logger.error(`Host Socket Error for ${socket.remoteAddress}`, err);
// //         });
// //       });

// //       server.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
// //         Logger.info(`Host TCP server running on port ${TCP_PORT}`);
// //       });

// //       server.on("error", (err) => {
// //         Logger.error("Server Error", err);
// //         stopHostServer();
// //       });

// //       server.on("close", () => {
// //         Logger.info("Host TCP server closed");
// //         isServerRunning = false;
// //       });
// //     } catch (err) {
// //       Logger.error("Failed to start host server", err);
// //       isServerRunning = false;
// //       stopHostServer();
// //     }
// //   }

// //   function stopHostServer(): void {
// //     Logger.info("Stopping host server...");
// //     connectedSockets.forEach((socket) => socket.destroy());
// //     connectedSockets = [];
// //     if (server) {
// //       server.close();
// //       server = null;
// //       Logger.info("Host TCP server stopped");
// //     }
// //     if (udpSocket) {
// //       udpSocket.close();
// //       udpSocket = null;
// //       Logger.info("Host UDP socket closed");
// //     }
// //     isServerRunning = false;
// //     setDevicesRef = null;
// //   }

// //   function kickClient(
// //     clientIp: string,
// //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>
// //   ): void {
// //     const socketsToKick = connectedSockets.filter(
// //       (socket) => socket.remoteAddress === clientIp
// //     );
// //     if (socketsToKick.length === 0) {
// //       Logger.warn(`No client found with IP: ${clientIp}`);
// //       return;
// //     }

// //     socketsToKick.forEach((socket) => {
// //       Logger.info(`Kicking client: ${clientIp}`);
// //       socket.destroy();
// //     });

// //     connectedSockets = connectedSockets.filter(
// //       (socket) => socket.remoteAddress !== clientIp
// //     );
// //     setDevices((prev) => prev.filter((d) => d.ip !== clientIp));
// //     Logger.info(
// //       `Client ${clientIp} removed from connected sockets and devices`
// //     );
// //   }

// //   return {
// //     startHostServer,
// //     stopHostServer,
// //     kickClient,
// //   };
// // };

// // export const ClientServer = () => {
// //   async function startClientDiscovery(
// //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>
// //   ): Promise<void> {
// //     try {
// //       const localIP = await getLocalIPAddress();
// //       Logger.info("Client Discovery Started...");

// //       udpSocket = dgram.createSocket({ type: "udp4" });
// //       udpSocket.bind(UDP_PORT);

// //       udpSocket.on("listening", () => {
// //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// //         udpSocket!.setBroadcast(true);
// //       });

// //       udpSocket.on("message", (msg: Buffer, rinfo) => {
// //         try {
// //           const data = JSON.parse(msg.toString());
// //           if (data.ip !== localIP && data.role === "Host") {
// //             setDevices((prev) => [
// //               ...prev.filter((device) => device.ip !== data.ip),
// //               {
// //                 ip: data.ip,
// //                 name: data.name || "Unknown",
// //                 role: "Host",
// //               },
// //             ]);
// //             Logger.info(`Discovered host: ${data.ip} (${data.name})`);
// //           }
// //         } catch (error) {
// //           Logger.error("Error parsing UDP message", error);
// //         }
// //       });

// //       udpSocket.on("error", (err: Error) => {
// //         Logger.error("UDP Socket Error", err);
// //         stopClientDiscovery();
// //       });
// //     } catch (err) {
// //       Logger.error("Failed to start client discovery", err);
// //       stopClientDiscovery();
// //     }
// //   }

// //   function stopClientDiscovery(): void {
// //     Logger.info("Stopping client discovery...");
// //     if (udpSocket) {
// //       udpSocket.close();
// //       udpSocket = null;
// //       Logger.info("UDP socket closed");
// //     }
// //   }

// //   async function connectToHost(
// //     ip: string,
// //     username: string,
// //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): Promise<void> {
// //     Logger.info(`Connecting to host at ${ip}...`);
// //     const client = new TCPSocket.Socket();
// //     clientSocket = client;

// //     client.on("connect", () => {
// //       Logger.info("Connected to host!");
// //       setConnected(true);
// //       setSocket(client);
// //       const initMessage = JSON.stringify({ type: "init", name: username });
// //       client.write(Buffer.from(initMessage + "\n"));
// //     });

// //     client.on("data", (data: string | Buffer) => {
// //       const { receiveFileInClient } = ClientSharing();
// //       receiveFileInClient({
// //         client,
// //         data,
// //         ip,
// //         setMessages,
// //         setReceivedFiles,
// //         setTransferProgress,
// //       });
// //     });

// //     client.on("close", () => {
// //       Logger.info("Disconnected from host");
// //       disconnectFromHost(
// //         setConnected,
// //         setSocket,
// //         setMessages,
// //         setReceivedFiles,
// //         setTransferProgress
// //       );
// //     });

// //     client.on("error", (err) => {
// //       Logger.error("Client Socket Error", err);
// //       disconnectFromHost(
// //         setConnected,
// //         setSocket,
// //         setMessages,
// //         setReceivedFiles,
// //         setTransferProgress
// //       );
// //     });

// //     client.connect({ port: TCP_PORT, host: ip });
// //   }

// //   function disconnectFromHost(
// //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): void {
// //     Logger.info("Disconnecting from host...");
// //     if (clientSocket) {
// //       clientSocket.end();
// //       clientSocket = null;
// //       Logger.info("Client socket closed");
// //     }
// //     setConnected(false);
// //     setSocket(null);
// //     setMessages([]);
// //     setReceivedFiles([]);
// //     setTransferProgress?.([]);
// //     Logger.info("Disconnected from host");
// //   }

// //   function stopClientServer(): void {
// //     if (clientSocket) {
// //       clientSocket.end();
// //       clientSocket = null;
// //       Logger.info("Client server stopped");
// //     }
// //   }

// //   return {
// //     startClientDiscovery,
// //     connectToHost,
// //     disconnectFromHost,
// //     stopClientServer,
// //   };
// // };

// // import dgram from "react-native-udp";
// // import {
// //   getLocalIPAddress,
// //   getBroadcastIPAddress,
// // } from "../utils/NetworkUtils";
// // import { Buffer } from "buffer";
// // import { Logger } from "../utils/Logger";
// // import { ERROR_CODES } from "../utils/Error";
// // import TCPSocket from "react-native-tcp-socket";
// // import { HostSharing } from "./HostSharing";
// // import { ClientSharing } from "./ClientSharing";

// // const UDP_PORT = 5000;
// // const TCP_PORT = 6000;
// // const MAX_CLIENTS = 5;

// // type UdpSocket = ReturnType<typeof dgram.createSocket>;
// // interface ConnectedSocket extends TCPSocket.Socket {}

// // let connectedSockets: ConnectedSocket[] = []; // Single source of truth for connected clients
// // let isServerRunning = false;
// // let udpSocket: UdpSocket | null = null;
// // let server: TCPSocket.Server | null = null;
// // let clientSocket: TCPSocket.Socket | null = null;

// // export const HostServer = () => {
// //   let setDevicesRef: React.Dispatch<React.SetStateAction<Device[]>> | null = null;

// //   async function startHostServer(
// //     username: string,
// //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>,
// //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Server | null>>,
// //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): Promise<void> {
// //     if (isServerRunning) {
// //       Logger.info("Host server already running, skipping start.");
// //       return;
// //     }
// //     isServerRunning = true;
// //     setDevicesRef = setDevices;

// //     try {
// //       const ip = await getLocalIPAddress();
// //       const broadcastAddr = await getBroadcastIPAddress();
// //       Logger.info(
// //         `Host started on IP: ${ip}, Broadcasting to: ${broadcastAddr}`
// //       );

// //       udpSocket = dgram.createSocket({ type: "udp4" });
// //       udpSocket.bind(UDP_PORT);

// //       udpSocket.once("listening", () => {
// //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// //         udpSocket!.setBroadcast(true);
// //         const broadcastInterval = setInterval(() => {
// //           const message = JSON.stringify({ role: "Host", ip, name: username });
// //           udpSocket!.send(
// //             Buffer.from(message),
// //             0,
// //             message.length,
// //             UDP_PORT,
// //             broadcastAddr,
// //             (err) => {
// //               if (err) Logger.error("UDP Send Error", err);
// //             }
// //           );
// //         }, 2000);

// //         udpSocket!.on("close", () => clearInterval(broadcastInterval));
// //       });

// //       udpSocket.on("error", (err: Error) => {
// //         Logger.error("UDP Socket Error", err);
// //         isServerRunning = false;
// //         udpSocket?.close();
// //         udpSocket = null;
// //       });

// //       server = new TCPSocket.Server();
// //       server.on("connection", (socket: ConnectedSocket) => {
// //         setConnected(true);
// //         if (connectedSockets.length >= MAX_CLIENTS) {
// //           socket.write(
// //             Buffer.from(`ERROR:${ERROR_CODES.MAX_CLIENTS_REACHED}\n`)
// //           );
// //           socket.destroy();
// //           Logger.warn("Max clients reached, rejecting new connection");
// //           return;
// //         }

// //         Logger.info(`Client connected: ${socket.remoteAddress}`);
// //         connectedSockets.push(socket); // Add to global connectedSockets
// //         setSocket(server);
// //         setDevices((prev) => [
// //           ...prev.filter((d) => d.ip !== socket.remoteAddress),
// //           {
// //             ip: socket.remoteAddress || "Unknown",
// //             name: "Unknown",
// //             role: "Client",
// //           },
// //         ]);

// //         socket.on("data", (data) => {
// //           const { receiveFileInHost } = HostSharing();
// //           try {
// //             const message = data.toString().trim();
// //             if (message.startsWith("{")) {
// //               const parsed = JSON.parse(message);
// //               if (parsed.type === "init" && parsed.name) {
// //                 setDevices((prev) =>
// //                   prev.map((d) =>
// //                     d.ip === socket.remoteAddress
// //                       ? { ...d, name: parsed.name }
// //                       : d
// //                   )
// //                 );
// //                 Logger.info(
// //                   `Client ${socket.remoteAddress} identified as ${parsed.name}`
// //                 );
// //                 return;
// //               }
// //             }
// //             receiveFileInHost({
// //               data,
// //               ip: socket.remoteAddress || "Unknown",
// //               setMessages,
// //               setReceivedFiles,
// //               socket,
// //               setTransferProgress,
// //             });
// //           } catch (error) {
// //             Logger.error("Error processing client data", error);
// //             receiveFileInHost({
// //               data,
// //               ip: socket.remoteAddress || "Unknown",
// //               setMessages,
// //               setReceivedFiles,
// //               socket,
// //               setTransferProgress,
// //             });
// //           }
// //         });

// //         socket.on("close", () => {
// //           Logger.info(`Client disconnected: ${socket.remoteAddress}`);
// //           connectedSockets = connectedSockets.filter((s) => s !== socket); // Remove from global connectedSockets
// //           setDevices((prev) =>
// //             prev.filter((d) => d.ip !== socket.remoteAddress)
// //           );
// //         });

// //         socket.on("error", (err) => {
// //           Logger.error(`Host Socket Error for ${socket.remoteAddress}`, err);
// //         });
// //       });

// //       server.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
// //         Logger.info(`Host TCP server running on port ${TCP_PORT}`);
// //       });

// //       server.on("error", (err) => {
// //         Logger.error("Server Error", err);
// //         stopHostServer();
// //       });

// //       server.on("close", () => {
// //         Logger.info("Host TCP server closed");
// //         isServerRunning = false;
// //       });
// //     } catch (err) {
// //       Logger.error("Failed to start host server", err);
// //       isServerRunning = false;
// //       stopHostServer();
// //     }
// //   }

// //   function stopHostServer(): void {
// //     Logger.info("Stopping host server...");
// //     connectedSockets.forEach((socket) => socket.destroy());
// //     connectedSockets = []; // Clear global connectedSockets
// //     if (server) {
// //       server.close();
// //       server = null;
// //       Logger.info("Host TCP server stopped");
// //     }
// //     if (udpSocket) {
// //       udpSocket.close();
// //       udpSocket = null;
// //       Logger.info("Host UDP socket closed");
// //     }
// //     isServerRunning = false;
// //     setDevicesRef = null;
// //   }

// //   function kickClient(
// //     clientIp: string,
// //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>
// //   ): void {
// //     const socketsToKick = connectedSockets.filter(
// //       (socket) => socket.remoteAddress === clientIp
// //     );
// //     if (socketsToKick.length === 0) {
// //       Logger.warn(`No client found with IP: ${clientIp}`);
// //       return;
// //     }

// //     socketsToKick.forEach((socket) => {
// //       Logger.info(`Kicking client: ${clientIp}`);
// //       socket.destroy();
// //     });

// //     connectedSockets = connectedSockets.filter(
// //       (socket) => socket.remoteAddress !== clientIp
// //     ); // Update global connectedSockets
// //     setDevices((prev) => prev.filter((d) => d.ip !== clientIp));
// //     Logger.info(
// //       `Client ${clientIp} removed from connected sockets and devices`
// //     );
// //   }

// //   return {
// //     startHostServer,
// //     stopHostServer,
// //     kickClient,
// //     connectedSockets, // Expose connectedSockets for use in HostSharing
// //   };
// // };

// // export const ClientServer = () => {
// //   async function startClientDiscovery(
// //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>
// //   ): Promise<void> {
// //     try {
// //       const localIP = await getLocalIPAddress();
// //       Logger.info("Client Discovery Started...");

// //       udpSocket = dgram.createSocket({ type: "udp4" });
// //       udpSocket.bind(UDP_PORT);

// //       udpSocket.on("listening", () => {
// //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// //         udpSocket!.setBroadcast(true);
// //       });

// //       udpSocket.on("message", (msg: Buffer, rinfo) => {
// //         try {
// //           const data = JSON.parse(msg.toString());
// //           if (data.ip !== localIP && data.role === "Host") {
// //             setDevices((prev) => [
// //               ...prev.filter((device) => device.ip !== data.ip),
// //               {
// //                 ip: data.ip,
// //                 name: data.name || "Unknown",
// //                 role: "Host",
// //               },
// //             ]);
// //             Logger.info(`Discovered host: ${data.ip} (${data.name})`);
// //           }
// //         } catch (error) {
// //           Logger.error("Error parsing UDP message", error);
// //         }
// //       });

// //       udpSocket.on("error", (err: Error) => {
// //         Logger.error("UDP Socket Error", err);
// //         stopClientDiscovery();
// //       });
// //     } catch (err) {
// //       Logger.error("Failed to start client discovery", err);
// //       stopClientDiscovery();
// //     }
// //   }

// //   function stopClientDiscovery(): void {
// //     Logger.info("Stopping client discovery...");
// //     if (udpSocket) {
// //       udpSocket.close();
// //       udpSocket = null;
// //       Logger.info("UDP socket closed");
// //     }
// //   }

// //   async function connectToHost(
// //     ip: string,
// //     username: string,
// //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): Promise<void> {
// //     Logger.info(`Connecting to host at ${ip}...`);
// //     const client = new TCPSocket.Socket();
// //     clientSocket = client;

// //     client.on("connect", () => {
// //       Logger.info("Connected to host!");
// //       setConnected(true);
// //       setSocket(client);
// //       const initMessage = JSON.stringify({ type: "init", name: username });
// //       client.write(Buffer.from(initMessage + "\n"));
// //     });

// //     client.on("data", (data: string | Buffer) => {
// //       const { receiveFileInClient } = ClientSharing();
// //       receiveFileInClient({
// //         client,
// //         data,
// //         ip,
// //         setMessages,
// //         setReceivedFiles,
// //         setTransferProgress,
// //       });
// //     });

// //     client.on("close", () => {
// //       Logger.info("Disconnected from host");
// //       disconnectFromHost(
// //         setConnected,
// //         setSocket,
// //         setMessages,
// //         setReceivedFiles,
// //         setTransferProgress
// //       );
// //     });

// //     client.on("error", (err) => {
// //       Logger.error("Client Socket Error", err);
// //       disconnectFromHost(
// //         setConnected,
// //         setSocket,
// //         setMessages,
// //         setReceivedFiles,
// //         setTransferProgress
// //       );
// //     });

// //     client.connect({ port: TCP_PORT, host: ip });
// //   }

// //   function disconnectFromHost(
// //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): void {
// //     Logger.info("Disconnecting from host...");
// //     if (clientSocket) {
// //       clientSocket.end();
// //       clientSocket = null;
// //       Logger.info("Client socket closed");
// //     }
// //     setConnected(false);
// //     setSocket(null);
// //     setMessages([]);
// //     setReceivedFiles([]);
// //     setTransferProgress?.([]);
// //     Logger.info("Disconnected from host");
// //   }

// //   function stopClientServer(): void {
// //     if (clientSocket) {
// //       clientSocket.end();
// //       clientSocket = null;
// //       Logger.info("Client server stopped");
// //     }
// //   }

// //   return {
// //     startClientDiscovery,
// //     connectToHost,
// //     disconnectFromHost,
// //     stopClientServer,
// //   };
// // };

// // import dgram from "react-native-udp";
// // import {
// //   getLocalIPAddress,
// //   getBroadcastIPAddress,
// // } from "../utils/NetworkUtils";
// // import { Buffer } from "buffer";
// // import { Logger } from "../utils/Logger";
// // import { ERROR_CODES } from "../utils/Error";
// // import TCPSocket from "react-native-tcp-socket";
// // import { } from "./Sharing"

// // const UDP_PORT = 5000;
// // const TCP_PORT = 6000;
// // const MAX_CLIENTS = 5;

// // type UdpSocket = ReturnType<typeof dgram.createSocket>;
// // interface ConnectedSocket extends TCPSocket.Socket {}

// // let connectedSockets: ConnectedSocket[] = [];
// // let isServerRunning = false;
// // let udpSocket: UdpSocket | null = null;
// // let server: TCPSocket.Server | null = null;
// // let clientSocket: TCPSocket.Socket | null = null;

// // export const HostServer = () => {
// //   async function startHostServer(
// //     username: string,
// //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>,
// //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Server | null>>,
// //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): Promise<void> {
// //     if (isServerRunning) {
// //       Logger.info("Host server already running, skipping start.");
// //       return;
// //     }
// //     isServerRunning = true;

// //     try {
// //       const ip = await getLocalIPAddress();
// //       const broadcastAddr = await getBroadcastIPAddress();
// //       Logger.info(
// //         `Host started on IP: ${ip}, Broadcasting to: ${broadcastAddr}`
// //       );

// //       udpSocket = dgram.createSocket({ type: "udp4" });
// //       udpSocket.bind(UDP_PORT);

// //       udpSocket.once("listening", () => {
// //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// //         udpSocket!.setBroadcast(true);
// //         const broadcastInterval = setInterval(() => {
// //           const message = JSON.stringify({ role: "Host", ip, name: username });
// //           udpSocket!.send(
// //             Buffer.from(message),
// //             0,
// //             message.length,
// //             UDP_PORT,
// //             broadcastAddr,
// //             (err) => {
// //               if (err) Logger.error("UDP Send Error", err);
// //             }
// //           );
// //         }, 2000);

// //         udpSocket!.on("close", () => clearInterval(broadcastInterval));
// //       });

// //       udpSocket.on("error", (err: Error) => {
// //         Logger.error("UDP Socket Error", err);
// //         isServerRunning = false;
// //         udpSocket?.close();
// //         udpSocket = null;
// //       });

// //       server = new TCPSocket.Server();
// //       server.on("connection", (socket: ConnectedSocket) => {
// //         if (connectedSockets.length >= MAX_CLIENTS) {
// //           socket.write(
// //             Buffer.from(`ERROR:${ERROR_CODES.MAX_CLIENTS_REACHED}\n`)
// //           );
// //           socket.destroy();
// //           Logger.warn("Max clients reached, rejecting new connection");
// //           return;
// //         }

// //         Logger.info(`Client connected: ${socket.remoteAddress}`);
// //         connectedSockets.push(socket);
// //         setSocket(server);
// //         setDevices((prev) => [
// //           ...prev.filter((d) => d.ip !== socket.remoteAddress),
// //           {
// //             ip: socket.remoteAddress || "Unknown",
// //             name: "Unknown",
// //             role: "Client",
// //           },
// //         ]);

// //         socket.on("data", (data) => {
// //           const { receiveFileInHost } = HostSharing();
// //           receiveFileInHost({
// //             data,
// //             setMessages,
// //             setReceivedFiles,
// //             socket,
// //             setTransferProgress,
// //           });
// //         });

// //         socket.on("close", () => {
// //           Logger.info(`Client disconnected: ${socket.remoteAddress}`);
// //           connectedSockets = connectedSockets.filter((s) => s !== socket);
// //           setDevices((prev) =>
// //             prev.filter((d) => d.ip !== socket.remoteAddress)
// //           );
// //         });

// //         socket.on("error", (err) => {
// //           Logger.error(`Host Socket Error for ${socket.remoteAddress}`, err);
// //         });
// //       });

// //       server.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
// //         Logger.info(`Host TCP server running on port ${TCP_PORT}`);
// //       });

// //       server.on("error", (err) => {
// //         Logger.error("Server Error", err);
// //         stopHostServer();
// //       });

// //       server.on("close", () => {
// //         Logger.info("Host TCP server closed");
// //         isServerRunning = false;
// //       });
// //     } catch (err) {
// //       Logger.error("Failed to start host server", err);
// //       isServerRunning = false;
// //       stopHostServer();
// //     }
// //   }

// //   function stopHostServer(): void {
// //     Logger.info("Stopping host server...");
// //     connectedSockets.forEach((socket) => socket.destroy());
// //     connectedSockets = [];
// //     if (server) {
// //       server.close();
// //       server = null;
// //       Logger.info("Host TCP server stopped");
// //     }
// //     if (udpSocket) {
// //       udpSocket.close();
// //       udpSocket = null;
// //       Logger.info("Host UDP socket closed");
// //     }
// //     isServerRunning = false;
// //   }

// //   function kickClient(clientIp: string): void {
// //     connectedSockets.forEach((socket) => {
// //       if (socket.remoteAddress === clientIp) {
// //         socket.destroy();
// //       }
// //     });
// //   }

// //   return {
// //     startHostServer,
// //     stopHostServer,
// //     kickClient,
// //   };
// // };

// // export const ClientServer = () => {
// //   async function startClientDiscovery(
// //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>
// //   ): Promise<void> {
// //     try {
// //       const localIP = await getLocalIPAddress();
// //       Logger.info("Client Discovery Started...");

// //       udpSocket = dgram.createSocket({ type: "udp4" });
// //       udpSocket.bind(UDP_PORT);

// //       udpSocket.on("listening", () => {
// //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// //         udpSocket!.setBroadcast(true);
// //       });

// //       udpSocket.on("message", (msg: Buffer, rinfo) => {
// //         try {
// //           const data = JSON.parse(msg.toString());
// //           if (data.ip !== localIP && data.role === "Host") {
// //             setDevices((prev) => [
// //               ...prev.filter((device) => device.ip !== data.ip),
// //               {
// //                 ip: data.ip,
// //                 name: rinfo.name,
// //                 role: "Host",
// //               },
// //             ]);
// //             // Logger.info(`Discovered host: ${data.ip} (${data.name})`);
// //           }
// //         } catch (error) {
// //           Logger.error("Error parsing UDP message", error);
// //         }
// //       });

// //       udpSocket.on("error", (err: Error) => {
// //         Logger.error("UDP Socket Error", err);
// //         stopClientDiscovery();
// //       });
// //     } catch (err) {
// //       Logger.error("Failed to start client discovery", err);
// //       stopClientDiscovery();
// //     }
// //   }

// //   function stopClientDiscovery(): void {
// //     Logger.info("Stopping client discovery...");
// //     if (udpSocket) {
// //       udpSocket.close();
// //       udpSocket = null;
// //       Logger.info("UDP socket closed");
// //     }
// //   }

// //   async function connectToHost(
// //     ip: string,
// //     username: string,
// //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): Promise<void> {
// //     Logger.info(`Connecting to host at ${ip}...`);
// //     const client = new TCPSocket.Socket();
// //     clientSocket = client;

// //     client.on("connect", () => {
// //       Logger.info("Connected to host!");
// //       setConnected(true);
// //       setSocket(client);
// //     });

// //     client.on("data", (data: string | Buffer) => {
// //       const { receiveFileInClient } = ClientSharing();
// //       receiveFileInClient({
// //         client,
// //         data,
// //         ip,
// //         setMessages,
// //         setReceivedFiles,
// //         setTransferProgress,
// //       });
// //     });

// //     client.on("close", () => {
// //       Logger.info("Disconnected from host");
// //       disconnectFromHost(
// //         setConnected,
// //         setSocket,
// //         setMessages,
// //         setReceivedFiles,
// //         setTransferProgress
// //       );
// //     });

// //     client.on("error", (err) => {
// //       Logger.error("Client Socket Error", err);
// //       disconnectFromHost(
// //         setConnected,
// //         setSocket,
// //         setMessages,
// //         setReceivedFiles,
// //         setTransferProgress
// //       );
// //     });

// //     client.connect({ port: TCP_PORT, host: ip });
// //   }

// //   function disconnectFromHost(
// //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): void {
// //     Logger.info("Disconnecting from host...");
// //     if (clientSocket) {
// //       clientSocket.end();
// //       clientSocket = null;
// //       Logger.info("Client socket closed");
// //     }
// //     setConnected(false);
// //     setSocket(null);
// //     setMessages([]);
// //     setReceivedFiles([]);
// //     setTransferProgress?.([]);
// //     Logger.info("Disconnected from host");
// //   }

// //   function stopClientServer(): void {
// //     if (clientSocket) {
// //       clientSocket.end();
// //       clientSocket = null;
// //       Logger.info("Client server stopped");
// //     }
// //   }
// //   return {
// //     startClientDiscovery,
// //     connectToHost,
// //     disconnectFromHost,
// //     stopClientServer,
// //   };
// // };

// import dgram from "react-native-udp";
// import {
//   getLocalIPAddress,
//   getBroadcastIPAddress,
// } from "../utils/NetworkUtils";
// import { Buffer } from "buffer";
// import { Logger } from "../utils/Logger";
// import { ERROR_CODES } from "../utils/Error";
// import TCPSocket from "react-native-tcp-socket";
// import { HostSharing } from "./HostSharing";
// import { ClientSharing } from "./ClientSharing";

// const UDP_PORT = 5000;
// const TCP_PORT = 6000;
// const MAX_CLIENTS = 5;
// const APP_ID = "Dropshare_shubham-mishra";

// type UdpSocket = ReturnType<typeof dgram.createSocket>;
// interface ConnectedSocket extends TCPSocket.Socket {}

// let connectedSockets: ConnectedSocket[] = [];
// let isServerRunning = false;
// let udpSocket: UdpSocket | null = null;
// let server: TCPSocket.Server | null = null;
// let clientSocket: TCPSocket.Socket | null = null;

// export const HostServer = () => {
//   async function startHostServer(
//     username: string,
//     setDevices: React.Dispatch<React.SetStateAction<Device[]>>,
//     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Server | null>>,
//     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
//     setIsHostConnected: React.Dispatch<React.SetStateAction<boolean>>,
//     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     if (isServerRunning) {
//       Logger.info("Host server already running, skipping start.");
//       return;
//     }
//     isServerRunning = true;

//     try {
//       const ip = await getLocalIPAddress();
//       const broadcastAddr = await getBroadcastIPAddress();
//       Logger.info(
//         `Host started on IP: ${ip}, Broadcasting to: ${broadcastAddr}`
//       );

//       udpSocket = dgram.createSocket({ type: "udp4" });
//       udpSocket.bind(UDP_PORT);

//       udpSocket.once("listening", () => {
//         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
//         udpSocket!.setBroadcast(true);
//         const broadcastInterval = setInterval(() => {
//           const message = JSON.stringify({
//             appId: APP_ID,
//             role: "Host",
//             ip,
//             name: username,
//           });
//           udpSocket!.send(
//             Buffer.from(message),
//             0,
//             message.length,
//             UDP_PORT,
//             broadcastAddr,
//             (err) => {
//               if (err) Logger.error("UDP Send Error", err);
//             }
//           );
//         }, 2000);

//         udpSocket!.on("close", () => clearInterval(broadcastInterval));
//       });

//       udpSocket.on("error", (err: Error) => {
//         Logger.error("UDP Socket Error", err);
//         isServerRunning = false;
//         udpSocket?.close();
//         udpSocket = null;
//       });

//       server = new TCPSocket.Server();
//       server.on("connection", (socket: ConnectedSocket) => {
//         if (connectedSockets.length >= MAX_CLIENTS) {
//           socket.write(
//             Buffer.from(`ERROR:${ERROR_CODES.MAX_CLIENTS_REACHED}\n`)
//           );
//           socket.destroy();
//           Logger.warn("Max clients reached, rejecting new connection");
//           return;
//         }

//         Logger.info(`Client connected: ${socket.remoteAddress}`);
//         connectedSockets.push(socket);
//         setIsHostConnected(true);
//         setSocket(server);
//         socket.once("data", (data) => {
//           try {
//             const message = data.toString();
//             if (message.startsWith("USERNAME:")) {
//               const clientUsername = message.replace("USERNAME:", "").trim();
//               setDevices((prev) => [
//                 ...prev.filter((d) => d.ip !== socket.remoteAddress),
//                 {
//                   ip: socket.remoteAddress || "Unknown",
//                   name: clientUsername || "Unknown",
//                   role: "Client",
//                 },
//               ]);
//             } else {
//               Logger.warn(
//                 `Unexpected initial message from ${socket.remoteAddress}: ${message}`
//               );
//             }
//           } catch (err) {
//             Logger.error("Error processing client username", err);
//             setDevices((prev) => [
//               ...prev.filter((d) => d.ip !== socket.remoteAddress),
//               {
//                 ip: socket.remoteAddress || "Unknown",
//                 name: "Unknown",
//                 role: "Client",
//               },
//             ]);
//           }
//           socket.on("data", (data) => {
//             const { receiveFileInHost } = HostSharing();
//             receiveFileInHost({
//               data,
//               setMessages,
//               setReceivedFiles,
//               socket,
//               connectedSockets,
//               setTransferProgress,
//             });
//           });
//         });

//         socket.on("close", () => {
//           Logger.info(`Client disconnected: ${socket.remoteAddress}`);
//           connectedSockets = connectedSockets.filter((s) => s !== socket);
//           setDevices((prev) =>
//             prev.filter((d) => d.ip !== socket.remoteAddress)
//           );
//           setIsHostConnected(false);
//         });

//         socket.on("error", (err) => {
//           Logger.error(`Host Socket Error for ${socket.remoteAddress}`, err);
//         });
//       });

//       server.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
//         Logger.info(`Host TCP server running on port ${TCP_PORT}`);
//       });

//       server.on("error", (err) => {
//         Logger.error("Server Error", err);
//         stopHostServer();
//       });

//       server.on("close", () => {
//         Logger.info("Host TCP server closed");
//         isServerRunning = false;
//       });
//     } catch (err) {
//       Logger.error("Failed to start host server", err);
//       isServerRunning = false;
//       stopHostServer();
//     }
//   }

//   function stopHostServer(): void {
//     Logger.info("Stopping host server...");
//     connectedSockets.forEach((socket) => socket.destroy());
//     connectedSockets = [];
//     if (server) {
//       server.close();
//       server = null;
//       Logger.info("Host TCP server stopped");
//     }
//     if (udpSocket) {
//       udpSocket.close();
//       udpSocket = null;
//       Logger.info("Host UDP socket closed");
//     }
//     isServerRunning = false;
//   }

//   function kickClient(clientIp: string): void {
//     connectedSockets.forEach((socket) => {
//       if (socket.remoteAddress === clientIp) {
//         socket.destroy();
//       }
//     });
//   }

//   return {
//     startHostServer,
//     stopHostServer,
//     kickClient,
//     connectedSockets,
//   };
// };

// export const ClientServer = () => {
//   async function startClientDiscovery(
//     setDevices: React.Dispatch<React.SetStateAction<Device[]>>
//   ): Promise<void> {
//     try {
//       const localIP = await getLocalIPAddress();
//       Logger.info("Client Discovery Started...");

//       udpSocket = dgram.createSocket({ type: "udp4" });
//       udpSocket.bind(UDP_PORT);

//       udpSocket.on("listening", () => {
//         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
//         udpSocket!.setBroadcast(true);
//       });

//       udpSocket.on("message", (msg: Buffer, rinfo) => {
//         try {
//           const data = JSON.parse(msg.toString());
//           if (data.appId !== APP_ID) {
//             return;
//           }
//           if (data.ip !== localIP && data.role === "Host") {
//             setDevices((prev) => [
//               ...prev.filter((device) => device.ip !== data.ip),
//               {
//                 ip: data.ip,
//                 name: data.name || "Unknown Host",
//                 role: "Host",
//               },
//             ]);
//           }
//         } catch (error) {
//           Logger.error("Error parsing UDP message", error);
//         }
//       });

//       udpSocket.on("error", (err: Error) => {
//         Logger.error("UDP Socket Error", err);
//         stopClientDiscovery();
//       });
//     } catch (err) {
//       Logger.error("Failed to start client discovery", err);
//       stopClientDiscovery();
//     }
//   }

//   function stopClientDiscovery(): void {
//     Logger.info("Stopping client discovery...");
//     if (udpSocket) {
//       udpSocket.close();
//       udpSocket = null;
//       Logger.info("UDP socket closed");
//     }
//   }

//   async function connectToHost(
//     ip: string,
//     username: string,
//     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
//     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
//     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
//     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     Logger.info(`Connecting to host at ${ip}...`);
//     const client = new TCPSocket.Socket();
//     clientSocket = client;

//     client.on("connect", () => {
//       Logger.info("Connected to host!");
//       setConnected(true);
//       setSocket(client);
//       client.write(Buffer.from(`USERNAME:${username}\n`));
//     });

//     client.on("data", (data: string | Buffer) => {
//       const { receiveFileInClient } = ClientSharing();
//       receiveFileInClient({
//         client,
//         data,
//         ip,
//         setMessages,
//         setReceivedFiles,
//         connectedSockets,
//         setTransferProgress,
//       });
//     });

//     client.on("close", () => {
//       Logger.info("Disconnected from host");
//       disconnectFromHost(
//         setConnected,
//         setSocket,
//         setMessages,
//         setReceivedFiles,
//         setTransferProgress
//       );
//     });

//     client.on("error", (err) => {
//       Logger.error("Client Socket Error", err);
//       disconnectFromHost(
//         setConnected,
//         setSocket,
//         setMessages,
//         setReceivedFiles,
//         setTransferProgress
//       );
//     });

//     client.connect({ port: TCP_PORT, host: ip });
//   }

//   function disconnectFromHost(
//     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
//     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
//     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
//     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): void {
//     Logger.info("Disconnecting from host...");
//     if (clientSocket) {
//       clientSocket.end();
//       clientSocket = null;
//       Logger.info("Client socket closed");
//     }
//     setConnected(false);
//     setSocket(null);
//     setMessages([]);
//     setReceivedFiles([]);
//     setTransferProgress?.([]);
//     Logger.info("Disconnected from host");
//   }

//   function stopClientServer(): void {
//     if (clientSocket) {
//       clientSocket.end();
//       clientSocket = null;
//       Logger.info("Client server stopped");
//     }
//   }

//   return {
//     startClientDiscovery,
//     connectToHost,
//     disconnectFromHost,
//     stopClientServer,
//   };
// };

// // ClientSharing.ts
// // import {
// //   calculateDynamicChunkDivision,
// //   checkTransferLimits,
// // } from "../utils/NetworkUtils";
// // import RNFS from "react-native-fs";
// // import { Buffer } from "buffer";
// // import { Logger } from "../utils/Logger";
// // import { DropShareError, ERROR_CODES } from "../utils/Error";
// // import TCPSocket from "react-native-tcp-socket";
// // import { ChunkStorage } from "./ChunkStorage";
// // import CryptoJS from "crypto-js";

// // // Interfaces
// // interface FileHeader {
// //   protocolVersion: string;
// //   name: string;
// //   size: number;
// //   sender: string;
// //   fileId: string;
// //   totalChunks: number;
// //   chunkSize: number;
// // }

// // interface ClientReceiveProps {
// //   ip: string;
// //   client: TCPSocket.Socket;
// //   data: string | Buffer;
// //   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
// //   connectedSockets: TCPSocket.Socket[];
// //   setMessages: React.Dispatch<React.SetStateAction<string[]>>;
// //   setTransferProgress?: React.Dispatch<
// //     React.SetStateAction<TransferProgress[]>
// //   >;
// // }

// // const fileTransfers = new Map<string, FileTransfer>();
// // let buffer = Buffer.alloc(0);
// // let receivingFile = false;
// // let fileId = "";
// // let lastLoggedChunkIndex: number | null = null;

// // const MAX_RETRIES = 3;
// // const ACK_TIMEOUT = 60000; // 60s for slower networks
// // const PROTOCOL_VERSION = "1.0";
// // const MAX_CONCURRENT_CHUNKS = 5;
// // const MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10 MB

// // export const ClientSharing = () => {
// //   async function sendFile(
// //     socket: TCPSocket.Socket,
// //     fileName: string,
// //     filePath: string,
// //     username: string,
// //     fileId: string,
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): Promise<void> {
// //     const chunkStorage = ChunkStorage.getInstance();
// //     let transfer: FileTransfer = {
// //       fileId,
// //       fileName,
// //       fileSize: 0,
// //       deviceName: username,
// //       senderIp: socket.localAddress || "unknown",
// //       chunks: [],
// //       receivedBytes: 0,
// //       startTime: Date.now(),
// //       totalChunks: 0,
// //       chunkSize: 0,
// //       totalSize: 0,
// //       chunkHashes: [],
// //       aesKey: undefined,
// //       iv: undefined,
// //       status: "Sending",
// //       progress: 0,
// //       lastChunkIndex: -1,
// //       completedChunks: new Set(),
// //     };
// //     fileTransfers.set(fileId, transfer);

// //     try {
// //       const stat = await RNFS.stat(filePath);
// //       const fileSize = stat.size;
// //       const { chunkSize, numChunks: totalChunks } =
// //         calculateDynamicChunkDivision(fileSize);

// //       transfer = {
// //         ...transfer,
// //         fileSize,
// //         totalChunks,
// //         chunkSize,
// //         totalSize: fileSize,
// //         chunks: new Array(totalChunks).fill(undefined),
// //         chunkHashes: new Array(totalChunks).fill(""),
// //       };
// //       fileTransfers.set(fileId, transfer);

// //       let retries = 0;
// //       while (retries < MAX_RETRIES) {
// //         try {
// //           if (retries > 0) {
// //             await new Promise<void>((resolve, reject) => {
// //               const timeout = setTimeout(() => {
// //                 reject(
// //                   new DropShareError(
// //                     ERROR_CODES.NETWORK_ERROR,
// //                     `Timeout waiting for ACK_RESET (attempt ${retries + 1})`
// //                   )
// //                 );
// //               }, ACK_TIMEOUT);
// //               socket.once("data", (data) => {
// //                 clearTimeout(timeout);
// //                 const message = data.toString();
// //                 Logger.info(`Received for ACK_RESET: ${message}`);
// //                 if (message.startsWith(`ACK_RESET:${fileId}`)) {
// //                   resolve();
// //                 } else {
// //                   reject(
// //                     new DropShareError(
// //                       ERROR_CODES.INVALID_HEADER,
// //                       `Invalid ACK_RESET response: ${message}`
// //                     )
// //                   );
// //                 }
// //               });
// //               socket.write(Buffer.from(`RESET:${fileId}\n`));
// //               Logger.info(`Sent RESET for ${fileId}`);
// //             });
// //           }

// //           let availableChunks: number[] = [];
// //           await new Promise<void>((resolve, reject) => {
// //             const timeout = setTimeout(() => {
// //               reject(
// //                 new DropShareError(
// //                   ERROR_CODES.NETWORK_ERROR,
// //                   `Timeout waiting for ACK_FILE (attempt ${retries + 1})`
// //                 )
// //               );
// //             }, ACK_TIMEOUT);
// //             socket.once("data", (data) => {
// //               clearTimeout(timeout);
// //               const message = data.toString();
// //               Logger.info(`Received for ACK_FILE: ${message}`);
// //               if (message.startsWith(`ACK_FILE:${fileId}:`)) {
// //                 availableChunks = JSON.parse(message.split(":")[2]) || [];
// //                 resolve();
// //               } else if (message.startsWith(`ACK_FILE:${fileId}`)) {
// //                 resolve();
// //               } else {
// //                 reject(
// //                   new DropShareError(
// //                     ERROR_CODES.INVALID_HEADER,
// //                     `Invalid ACK_FILE response: ${message}`
// //                   )
// //                 );
// //               }
// //             });
// //             const header: FileHeader = {
// //               protocolVersion: PROTOCOL_VERSION,
// //               name: fileName,
// //               size: fileSize,
// //               sender: username,
// //               fileId,
// //               totalChunks,
// //               chunkSize,
// //             };
// //             socket.write(Buffer.from(`FILE:${JSON.stringify(header)}\n\n`));
// //             Logger.info(`Sent header for ${fileId}: ${JSON.stringify(header)}`);
// //           });

// //           const pendingChunks = Array.from(
// //             { length: totalChunks },
// //             (_, i) => i
// //           ).filter((i) => !availableChunks.includes(i));
// //           let sentBytes = availableChunks.reduce(
// //             (sum, i) => sum + Math.min(chunkSize, fileSize - i * chunkSize),
// //             0
// //           );

// //           const sendChunk = async (chunkIndex: number): Promise<void> => {
// //             const start = chunkIndex * chunkSize;
// //             const actualChunkSize = Math.min(chunkSize, fileSize - start);
// //             const chunk = await RNFS.read(
// //               filePath,
// //               actualChunkSize,
// //               start,
// //               "base64"
// //             );
// //             const chunkBuffer = Buffer.from(chunk, "base64");
// //             const chunkHash = CryptoJS.SHA256(
// //               CryptoJS.enc.Base64.parse(chunk)
// //             ).toString(CryptoJS.enc.Hex);
// //             transfer.chunkHashes[chunkIndex] = chunkHash;
// //             fileTransfers.set(fileId, transfer);

// //             await new Promise<void>((resolve, reject) => {
// //               const timeout = setTimeout(() => {
// //                 reject(
// //                   new DropShareError(
// //                     ERROR_CODES.NETWORK_ERROR,
// //                     `Timeout waiting for ACK_CHUNK:${chunkIndex} (attempt ${
// //                       retries + 1
// //                     })`
// //                   )
// //                 );
// //               }, ACK_TIMEOUT);
// //               socket.once("data", (data) => {
// //                 clearTimeout(timeout);
// //                 const message = data.toString();
// //                 Logger.info(`Received for ACK_CHUNK:${chunkIndex}: ${message}`);
// //                 if (message.startsWith(`ACK_CHUNK:${fileId}:${chunkIndex}`)) {
// //                   resolve();
// //                 } else if (message.startsWith("ERROR:")) {
// //                   reject(
// //                     new DropShareError(
// //                       ERROR_CODES.NETWORK_ERROR,
// //                       `Receiver error: ${message}`
// //                     )
// //                   );
// //                 } else {
// //                   reject(
// //                     new DropShareError(
// //                       ERROR_CODES.INVALID_HEADER,
// //                       `Invalid ACK_CHUNK response: ${message}`
// //                     )
// //                   );
// //                 }
// //               });
// //               const chunkHeader = Buffer.from(
// //                 `CHUNK:${JSON.stringify({
// //                   fileId,
// //                   chunkIndex,
// //                   chunkSize: actualChunkSize,
// //                   chunkHash,
// //                 })}\n\n`
// //               );
// //               socket.write(Buffer.concat([chunkHeader, Buffer.from(chunk)]));
// //               Logger.info(
// //                 `Sent chunk ${chunkIndex}/${totalChunks} for ${fileId} (${actualChunkSize} bytes, hash: ${chunkHash})`
// //               );
// //             });

// //             sentBytes += chunk.length; // Use base64-encoded size
// //             const percentage = (sentBytes / ((fileSize * 4) / 3)) * 100; // Adjust for base64
// //             const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
// //             const speed = (sentBytes / elapsedTime / 1024 / 1024).toFixed(2);

// //             transfer.receivedBytes = sentBytes;
// //             transfer.progress = percentage;
// //             transfer.lastChunkIndex = chunkIndex;
// //             transfer.completedChunks.add(chunkIndex);
// //             fileTransfers.set(fileId, transfer);

// //             setTransferProgress?.((prev) => [
// //               ...prev.filter((p) => p.fileId !== fileId),
// //               {
// //                 fileId,
// //                 fileName,
// //                 progress: `${(sentBytes / (1024 * 1024)).toFixed(2)}/${(
// //                   (fileSize * 4) /
// //                   3 /
// //                   (1024 * 1024)
// //                 ).toFixed(2)} MB`,
// //                 speed: `${speed} MB/s`,
// //                 percentage,
// //               },
// //             ]);
// //           };

// //           const queue = pendingChunks.slice();
// //           const activePromises: Promise<void>[] = [];
// //           while (queue.length > 0 || activePromises.length > 0) {
// //             while (
// //               queue.length > 0 &&
// //               activePromises.length < MAX_CONCURRENT_CHUNKS
// //             ) {
// //               const chunkIndex = queue.shift()!;
// //               activePromises.push(sendChunk(chunkIndex));
// //             }
// //             try {
// //               await Promise.race(activePromises);
// //             } catch (error) {
// //               Logger.warn(`Chunk send failed: ${error}`);
// //             }
// //             activePromises.splice(
// //               0,
// //               activePromises.length,
// //               ...activePromises.filter((p) => p !== Promise.resolve())
// //             );
// //           }
// //           await Promise.all(activePromises);

// //           await new Promise<void>((resolve, reject) => {
// //             const timeout = setTimeout(() => {
// //               reject(
// //                 new DropShareError(
// //                   ERROR_CODES.NETWORK_ERROR,
// //                   `Timeout waiting for ACK_COMPLETE (attempt ${retries + 1})`
// //                 )
// //               );
// //             }, ACK_TIMEOUT);
// //             socket.once("data", (data) => {
// //               clearTimeout(timeout);
// //               const message = data.toString();
// //               Logger.info(`Received for ACK_COMPLETE: ${message}`);
// //               if (message.startsWith(`ACK_COMPLETE:${fileId}`)) {
// //                 transfer.status = "Completed";
// //                 transfer.endTime = Date.now();
// //                 transfer.progress = 100;
// //                 fileTransfers.set(fileId, transfer);
// //                 const elapsedTime =
// //                   (Date.now() - transfer.startTime) / 1000 || 1;
// //                 const speed = (
// //                   (fileSize * 4) /
// //                   3 /
// //                   elapsedTime /
// //                   1024 /
// //                   1024
// //                 ).toFixed(2);
// //                 setTransferProgress?.((prev) => [
// //                   ...prev.filter((p) => p.fileId !== fileId),
// //                   {
// //                     fileId,
// //                     fileName,
// //                     progress: `${((fileSize * 4) / 3 / (1024 * 1024)).toFixed(
// //                       2
// //                     )}/${((fileSize * 4) / 3 / (1024 * 1024)).toFixed(2)} MB`,
// //                     speed: `${speed} MB/s`,
// //                     percentage: 100,
// //                   },
// //                 ]);
// //                 resolve();
// //               } else if (message.startsWith("ERROR:")) {
// //                 reject(
// //                   new DropShareError(
// //                     ERROR_CODES.NETWORK_ERROR,
// //                     `Receiver error: ${message}`
// //                   )
// //                 );
// //               } else {
// //                 reject(
// //                   new DropShareError(
// //                     ERROR_CODES.NETWORK_ERROR,
// //                     `Invalid ACK_COMPLETE response: ${message}`
// //                   )
// //                 );
// //               }
// //             });
// //           });
// //           break;
// //         } catch (error) {
// //           retries++;
// //           if (retries === MAX_RETRIES) {
// //             throw error;
// //           }
// //           Logger.warn(`Retrying file send for ${fileId} after error: ${error}`);
// //           await new Promise((resolve) => setTimeout(resolve, 2000));
// //         }
// //       }
// //     } catch (error) {
// //       const err = DropShareError.from(
// //         error,
// //         ERROR_CODES.NETWORK_ERROR,
// //         `Transfer failed: ${
// //           error instanceof Error ? error.message : "Unknown error"
// //         }`
// //       );
// //       transfer.status = "Failed";
// //       transfer.error = err.message;
// //       fileTransfers.set(fileId, transfer);
// //       setTransferProgress?.((prev) => [
// //         ...prev.filter((p) => p.fileId !== fileId),
// //         {
// //           fileId,
// //           fileName,
// //           progress: `${(transfer.receivedBytes / (1024 * 1024)).toFixed(2)}/${(
// //             (transfer.totalSize * 4) /
// //             3 /
// //             (1024 * 1024)
// //           ).toFixed(2)} MB`,
// //           speed: "0 MB/s",
// //           percentage: transfer.progress,
// //           error: err.message,
// //         },
// //       ]);
// //       Logger.error(`Failed to send file ${fileName}`, error);
// //       throw err;
// //     } finally {
// //       if (transfer.status === "Completed" || transfer.status === "Failed") {
// //         await chunkStorage.clearChunks(fileId);
// //         fileTransfers.delete(fileId);
// //       }
// //     }
// //   }

// //   async function sendFilesInClient(
// //     socket: TCPSocket.Socket | null,
// //     files: { filePath: string }[],
// //     username: string,
// //     connectedSockets: TCPSocket.Socket[],
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): Promise<void> {
// //     if (!socket) {
// //       Logger.toast("No active socket to send files", "error");
// //       throw new DropShareError(ERROR_CODES.NETWORK_ERROR, "No active socket");
// //     }

// //     for (const { filePath } of files) {
// //       const fileName = filePath.split("/").pop() ?? "unknown";
// //       const fileId = `${username}_${fileName}_${Date.now()}`;
// //       await sendFile(
// //         socket,
// //         fileName,
// //         filePath,
// //         username,
// //         fileId,
// //         setTransferProgress
// //       );
// //       Logger.info(`Sent file: ${fileName} from ${username}`);
// //     }
// //   }

// //   function sendMessageInClient(
// //     socket: TCPSocket.Socket | null,
// //     message: string,
// //     username: string,
// //     connectedSockets: TCPSocket.Socket[]
// //   ): void {
// //     if (!socket) {
// //       Logger.toast("No active socket to send message", "error");
// //       return;
// //     }
// //     socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
// //     Logger.info(`Sent MSG: ${message}`);
// //   }

// //   async function receiveFileInClient({
// //     client,
// //     data,
// //     ip,
// //     setMessages,
// //     setReceivedFiles,
// //     setTransferProgress,
// //   }: ClientReceiveProps): Promise<void> {
// //     const chunkStorage = ChunkStorage.getInstance();
// //     try {
// //       if (buffer.length > MAX_BUFFER_SIZE) {
// //         Logger.error("Buffer size exceeded, clearing buffer");
// //         buffer = Buffer.alloc(0);
// //         throw new DropShareError(
// //           ERROR_CODES.NETWORK_ERROR,
// //           "Buffer size exceeded"
// //         );
// //       }
// //       buffer = Buffer.concat([
// //         buffer,
// //         typeof data === "string" ? Buffer.from(data) : data,
// //       ]);
// //       Logger.info(
// //         `Received ${data.length} bytes, buffer now ${buffer.length} bytes`
// //       );

// //       while (buffer.length > 0) {
// //         const dataStr = buffer.toString();

// //         if (dataStr.startsWith("RESET:")) {
// //           const messageEnd = buffer.indexOf(Buffer.from("\n"));
// //           if (messageEnd === -1) {
// //             Logger.info(`Incomplete RESET from host, waiting...`);
// //             return;
// //           }
// //           const resetFileId = dataStr.slice(6, messageEnd);
// //           Logger.info(`Received RESET for fileId ${resetFileId}`);
// //           if (resetFileId === fileId || !fileId) {
// //             receivingFile = false;
// //             fileTransfers.delete(resetFileId);
// //             await chunkStorage.clearChunks(resetFileId);
// //             fileId = "";
// //           }
// //           client.write(Buffer.from(`ACK_RESET:${resetFileId}\n`));
// //           buffer = buffer.slice(messageEnd + 1);
// //           continue;
// //         }

// //         if (receivingFile) {
// //           if (dataStr.startsWith("CHUNK:")) {
// //             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
// //             if (headerEnd === -1) {
// //               Logger.info(`Incomplete CHUNK header from host, waiting...`);
// //               return;
// //             }
// //             const headerStr = buffer.slice(6, headerEnd).toString();
// //             let chunkData: {
// //               fileId: string;
// //               chunkIndex: number;
// //               chunkSize: number;
// //               chunkHash: string;
// //             };
// //             try {
// //               chunkData = JSON.parse(headerStr);
// //             } catch (error) {
// //               Logger.error(
// //                 `Failed to parse CHUNK header for fileId ${fileId}: ${headerStr}`,
// //                 error
// //               );
// //               throw new DropShareError(
// //                 ERROR_CODES.INVALID_HEADER,
// //                 "Invalid chunk header"
// //               );
// //             }

// //             const chunkSize = chunkData.chunkSize;
// //             const chunkStart = headerEnd + 2;
// //             const expectedBase64Length = Math.ceil((chunkSize * 4) / 3);
// //             const minBase64Length = expectedBase64Length - 2;
// //             const maxBase64Length = expectedBase64Length + 2;
// //             const chunkEnd = chunkStart + expectedBase64Length;

// //             if (buffer.length < chunkEnd) {
// //               if (lastLoggedChunkIndex !== chunkData.chunkIndex) {
// //                 Logger.info(
// //                   `Waiting for base64 chunk data for ${
// //                     chunkData.fileId
// //                   } (chunkIndex: ${
// //                     chunkData.chunkIndex
// //                   }, expected ${expectedBase64Length} bytes, received ${
// //                     buffer.length - chunkStart
// //                   } bytes)`
// //                 );
// //                 lastLoggedChunkIndex = chunkData.chunkIndex;
// //               }
// //               return;
// //             }

// //             let base64Chunk = buffer.slice(chunkStart, chunkEnd).toString();
// //             const actualBase64Length = base64Chunk.length;

// //             if (
// //               actualBase64Length < minBase64Length ||
// //               actualBase64Length > maxBase64Length
// //             ) {
// //               Logger.error(
// //                 `Base64 length mismatch for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}): expected ${expectedBase64Length} (±2), received ${actualBase64Length}`
// //               );
// //               throw new DropShareError(
// //                 ERROR_CODES.CORRUPTED_CHUNK,
// //                 `Base64 length mismatch: expected ${expectedBase64Length} (±2), received ${actualBase64Length}`
// //               );
// //             }

// //             let chunk: Buffer;
// //             try {
// //               chunk = Buffer.from(base64Chunk, "base64");
// //               if (
// //                 chunk.length !== chunkSize &&
// //                 chunk.length !== chunkSize - 1 &&
// //                 chunk.length !== chunkSize - 2
// //               ) {
// //                 Logger.error(
// //                   `Chunk size mismatch for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}): expected ${chunkSize}, received ${chunk.length}`
// //                 );
// //                 throw new DropShareError(
// //                   ERROR_CODES.CORRUPTED_CHUNK,
// //                   `Chunk size mismatch: expected ${chunkSize}, received ${chunk.length}`
// //                 );
// //               }
// //               const receivedHash = CryptoJS.SHA256(
// //                 CryptoJS.enc.Base64.parse(base64Chunk)
// //               ).toString(CryptoJS.enc.Hex);
// //               if (receivedHash !== chunkData.chunkHash) {
// //                 Logger.error(
// //                   `Hash mismatch for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}): expected ${chunkData.chunkHash}, received ${receivedHash}`
// //                 );
// //                 throw new DropShareError(
// //                   ERROR_CODES.CORRUPTED_CHUNK,
// //                   `Hash mismatch for chunk ${chunkData.chunkIndex}`
// //                 );
// //               }
// //               Logger.info(
// //                 `Verified hash for chunk ${chunkData.chunkIndex} of ${chunkData.fileId}: ${chunkData.chunkHash}`
// //               );
// //             } catch (error) {
// //               Logger.error(
// //                 `Failed to decode or verify base64 chunk for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex})`,
// //                 error
// //               );
// //               throw new DropShareError(
// //                 ERROR_CODES.CORRUPTED_CHUNK,
// //                 "Invalid base64 chunk data or hash"
// //               );
// //             }

// //             Logger.info(
// //               `Processed chunk ${chunkData.chunkIndex}/${
// //                 fileTransfers.get(chunkData.fileId)?.totalChunks
// //               } for ${
// //                 chunkData.fileId
// //               } (chunkSize: ${chunkSize}, base64 length: ${actualBase64Length}, decoded length: ${
// //                 chunk.length
// //               }, hash: ${chunkData.chunkHash})`
// //             );
// //             lastLoggedChunkIndex = null;

// //             await chunkStorage.storeChunk(
// //               chunkData.fileId,
// //               chunkData.chunkIndex,
// //               chunkSize,
// //               base64Chunk
// //             );

// //             const transfer = fileTransfers.get(chunkData.fileId);
// //             if (transfer) {
// //               transfer.chunks[chunkData.chunkIndex] = chunk;
// //               transfer.receivedBytes += chunk.length;
// //               transfer.progress =
// //                 (transfer.receivedBytes / transfer.totalSize) * 100;
// //               transfer.lastChunkIndex = chunkData.chunkIndex;
// //               transfer.completedChunks.add(chunkData.chunkIndex);
// //               transfer.chunkHashes[chunkData.chunkIndex] = chunkData.chunkHash;
// //               fileTransfers.set(chunkData.fileId, transfer);

// //               const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
// //               const speed = (
// //                 transfer.receivedBytes /
// //                 elapsedTime /
// //                 1024 /
// //                 1024
// //               ).toFixed(2);

// //               setTransferProgress?.((prev) => [
// //                 ...prev.filter((p) => p.fileId !== chunkData.fileId),
// //                 {
// //                   fileId: chunkData.fileId,
// //                   fileName: transfer.fileName,
// //                   progress: `${(transfer.receivedBytes / (1024 * 1024)).toFixed(
// //                     2
// //                   )}/${(transfer.totalSize / (1024 * 1024)).toFixed(2)} MB`,
// //                   speed: `${speed} MB/s`,
// //                   percentage: transfer.progress,
// //                 },
// //               ]);

// //               client.write(
// //                 Buffer.from(
// //                   `ACK_CHUNK:${chunkData.fileId}:${chunkData.chunkIndex}\n`
// //                 )
// //               );
// //               Logger.info(
// //                 `Sent ACK_CHUNK for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex})`
// //               );
// //               buffer = buffer.slice(chunkEnd);
// //               Logger.info(`Buffer sliced, remaining: ${buffer.length} bytes`);

// //               if (transfer.completedChunks.size === transfer.totalChunks) {
// //                 const finalPath = await chunkStorage.assembleFile(
// //                   chunkData.fileId,
// //                   transfer.totalChunks,
// //                   transfer.fileName
// //                 );
// //                 setReceivedFiles((prev) => [...prev, finalPath]);
// //                 Logger.info(
// //                   `Received and saved file: ${finalPath} from ${transfer.deviceName}`
// //                 );
// //                 transfer.status = "Completed";
// //                 transfer.endTime = Date.now();
// //                 client.write(Buffer.from(`ACK_COMPLETE:${chunkData.fileId}\n`));
// //                 fileTransfers.delete(chunkData.fileId);
// //                 receivingFile = false;
// //                 fileId = "";
// //               }
// //             }
// //           } else if (dataStr.startsWith("FILE:") && fileId) {
// //             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
// //             if (headerEnd === -1) {
// //               Logger.info(
// //                 `Incomplete retransmission FILE header from host, waiting...`
// //               );
// //               return;
// //             }
// //             const headerStr = buffer.slice(5, headerEnd).toString();
// //             let headerData: FileHeader;
// //             try {
// //               headerData = JSON.parse(headerStr);
// //             } catch (error) {
// //               Logger.error(
// //                 `Failed to parse retransmission FILE header: ${headerStr}`,
// //                 error
// //               );
// //               throw new DropShareError(
// //                 ERROR_CODES.INVALID_HEADER,
// //                 "Invalid file header"
// //               );
// //             }

// //             if (headerData.fileId === fileId) {
// //               Logger.info(
// //                 `Detected retransmission for fileId ${fileId}, resetting state`
// //               );
// //               receivingFile = false;
// //               fileTransfers.delete(fileId);
// //               await chunkStorage.clearChunks(fileId);
// //               await initializeFileTransfer(
// //                 headerData,
// //                 client,
// //                 setTransferProgress
// //               );
// //               const availableChunks = await chunkStorage.getAvailableChunks(
// //                 fileId
// //               );
// //               client.write(
// //                 Buffer.from(
// //                   `ACK_FILE:${fileId}:${JSON.stringify(availableChunks)}\n`
// //                 )
// //               );
// //               buffer = buffer.slice(headerEnd + 2);
// //               receivingFile = true;
// //             } else {
// //               Logger.warn(
// //                 `Unexpected FILE header for different fileId ${headerData.fileId} while processing ${fileId}`
// //               );
// //               buffer = Buffer.alloc(0);
// //               return;
// //             }
// //           } else {
// //             Logger.warn(
// //               `Unexpected data while receiving file for ${fileId}: ${dataStr.slice(
// //                 0,
// //                 50
// //               )}...`
// //             );
// //             buffer = Buffer.alloc(0);
// //             return;
// //           }
// //         } else {
// //           if (dataStr.startsWith("FILE:")) {
// //             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
// //             if (headerEnd === -1) {
// //               Logger.info(`Incomplete FILE header from host, waiting...`);
// //               return;
// //             }
// //             const headerStr = buffer.slice(5, headerEnd).toString();
// //             let headerData: FileHeader;
// //             try {
// //               headerData = JSON.parse(headerStr);
// //             } catch (error) {
// //               Logger.error(`Failed to parse FILE header: ${headerStr}`, error);
// //               throw new DropShareError(
// //                 ERROR_CODES.INVALID_HEADER,
// //                 "Invalid file header"
// //               );
// //             }

// //             await initializeFileTransfer(
// //               headerData,
// //               client,
// //               setTransferProgress
// //             );
// //             const availableChunks = await chunkStorage.getAvailableChunks(
// //               headerData.fileId
// //             );
// //             client.write(
// //               Buffer.from(
// //                 `ACK_FILE:${headerData.fileId}:${JSON.stringify(
// //                   availableChunks
// //                 )}\n`
// //               )
// //             );
// //             buffer = buffer.slice(headerEnd + 2);
// //             receivingFile = true;
// //           } else if (dataStr.startsWith("MSG:")) {
// //             const messageEnd = buffer.indexOf(Buffer.from("\n"));
// //             if (messageEnd === -1) {
// //               Logger.info(`Incomplete MSG from host, waiting...`);
// //               return;
// //             }
// //             const message = buffer.slice(4, messageEnd).toString();
// //             setMessages((prev) => [...prev, `Host (${ip}): ${message}`]);
// //             buffer = buffer.slice(messageEnd + 1);
// //           } else if (
// //             dataStr.startsWith("ACK_FILE:") ||
// //             dataStr.startsWith("ACK_COMPLETE:") ||
// //             dataStr.startsWith("ACK_CHUNK:")
// //           ) {
// //             const messageEnd = buffer.indexOf(Buffer.from("\n"));
// //             if (messageEnd === -1) {
// //               Logger.info(
// //                 `Incomplete ${dataStr.slice(0, 10)} from host, waiting...`
// //               );
// //               return;
// //             }
// //             Logger.info(`Processed ${dataStr.slice(0, messageEnd)}`);
// //             buffer = buffer.slice(messageEnd + 1);
// //           } else {
// //             Logger.warn(`Invalid data from host: ${dataStr.slice(0, 50)}...`);
// //             client.write(
// //               Buffer.from(
// //                 `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
// //               )
// //             );
// //             buffer = Buffer.alloc(0);
// //           }
// //         }
// //       }
// //     } catch (error) {
// //       Logger.error(`Error processing data from host`, error);
// //       const err = DropShareError.from(
// //         error,
// //         ERROR_CODES.NETWORK_ERROR,
// //         "Data processing failed"
// //       );
// //       client.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
// //       buffer = Buffer.alloc(0);
// //       receivingFile = false;
// //       fileTransfers.delete(fileId);
// //       await chunkStorage.clearChunks(fileId);
// //       fileId = "";
// //       lastLoggedChunkIndex = null;
// //       setTransferProgress?.((prev) => [
// //         ...prev.filter((p) => p.fileId !== fileId),
// //         {
// //           fileId,
// //           fileName: fileTransfers.get(fileId)?.fileName || "unknown",
// //           progress: "0/0 MB",
// //           speed: "0 MB/s",
// //           percentage: 0,
// //           error: err.message,
// //         },
// //       ]);
// //     }
// //   }

// //   async function initializeFileTransfer(
// //     headerData: FileHeader,
// //     socket: TCPSocket.Socket,
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): Promise<void> {
// //     const chunkStorage = ChunkStorage.getInstance();
// //     if (headerData.protocolVersion !== PROTOCOL_VERSION) {
// //       Logger.error(
// //         `Protocol version mismatch for ${headerData.fileId}: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
// //       );
// //       socket.write(
// //         Buffer.from(
// //           `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
// //         )
// //       );
// //       buffer = Buffer.alloc(0);
// //       throw new DropShareError(
// //         ERROR_CODES.INVALID_HEADER,
// //         `Protocol version mismatch: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
// //       );
// //     }

// //     fileId = headerData.fileId;
// //     const fileName = headerData.name;
// //     const fileSize = headerData.size;
// //     const deviceName = headerData.sender || "Unknown";
// //     const totalChunks = headerData.totalChunks;
// //     const chunkSize = headerData.chunkSize;

// //     if (!fileName || !fileSize || !fileId || !totalChunks || !chunkSize) {
// //       throw new DropShareError(
// //         ERROR_CODES.INVALID_HEADER,
// //         "Missing file name, size, ID, total chunks, or chunk size"
// //       );
// //     }

// //     const { chunkSize: calculatedChunkSize } =
// //       calculateDynamicChunkDivision(fileSize);
// //     if (chunkSize !== calculatedChunkSize) {
// //       Logger.error(
// //         `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${chunkSize}`
// //       );
// //       throw new DropShareError(
// //         ERROR_CODES.INVALID_HEADER,
// //         `Chunk size mismatch: expected ${calculatedChunkSize}, received ${chunkSize}`
// //       );
// //     }

// //     if (!checkTransferLimits(fileSize, fileTransfers)) {
// //       socket.write(
// //         Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
// //       );
// //       Logger.toast(`Transfer limit exceeded for ${fileName}`, "error");
// //       buffer = Buffer.alloc(0);
// //       throw new DropShareError(
// //         ERROR_CODES.TRANSFER_LIMIT_EXCEEDED,
// //         `Transfer limit exceeded for ${fileName}`
// //       );
// //     }

// //     const availableChunks = await chunkStorage.getAvailableChunks(fileId);
// //     const transfer: FileTransfer = {
// //       fileId,
// //       fileName,
// //       fileSize,
// //       deviceName,
// //       senderIp: socket.remoteAddress || "unknown",
// //       chunks: new Array(totalChunks).fill(undefined),
// //       receivedBytes: availableChunks.reduce(
// //         (sum, i) => sum + Math.min(chunkSize, fileSize - i * chunkSize),
// //         0
// //       ),
// //       startTime: Date.now(),
// //       totalChunks,
// //       chunkSize,
// //       totalSize: fileSize,
// //       chunkHashes: new Array(totalChunks).fill(""),
// //       aesKey: undefined,
// //       iv: undefined,
// //       status: "Receiving",
// //       progress: (availableChunks.length / totalChunks) * 100,
// //       lastChunkIndex: -1,
// //       completedChunks: new Set(availableChunks),
// //     };
// //     fileTransfers.set(fileId, transfer);
// //   }

// //   return {
// //     sendFilesInClient,
// //     sendMessageInClient,
// //     receiveFileInClient,
// //   };
// // };

// // HostSharing.ts
// // import {
// //   calculateDynamicChunkDivision,
// //   checkTransferLimits,
// // } from "../utils/NetworkUtils";
// // import RNFS from "react-native-fs";
// // import { Buffer } from "buffer";
// // import { Logger } from "../utils/Logger";
// // import { DropShareError, ERROR_CODES } from "../utils/Error";
// // import TCPSocket from "react-native-tcp-socket";
// // import { ChunkStorage } from "./ChunkStorage";
// // import CryptoJS from "crypto-js";

// // // Interfaces
// // interface FileHeader {
// //   protocolVersion: string;
// //   name: string;
// //   size: number;
// //   sender: string;
// //   fileId: string;
// //   totalChunks: number;
// //   chunkSize: number;
// // }

// // interface HostReceiveProps {
// //   socket: TCPSocket.Socket;
// //   data: string | Buffer;
// //   setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>;
// //   setMessages: React.Dispatch<React.SetStateAction<string[]>>;
// //   connectedSockets: TCPSocket.Socket[];
// //   setTransferProgress?: React.Dispatch<
// //     React.SetStateAction<TransferProgress[]>
// //   >;
// // }

// // const fileTransfers = new Map<string, FileTransfer>();
// // let buffer = Buffer.alloc(0);
// // let receivingFile = false;
// // let fileId = "";
// // let lastLoggedChunkIndex: number | null = null;

// // const MAX_RETRIES = 3;
// // const ACK_TIMEOUT = 60000; // 60s for slower networks
// // const PROTOCOL_VERSION = "1.0";
// // const MAX_CONCURRENT_CHUNKS = 5;
// // const MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10 MB

// // export const HostSharing = () => {
// //   async function sendFile(
// //     socket: TCPSocket.Socket,
// //     fileName: string,
// //     filePath: string,
// //     deviceName: string,
// //     fileId: string,
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): Promise<void> {
// //     const chunkStorage = ChunkStorage.getInstance();
// //     let transfer: FileTransfer = {
// //       fileId,
// //       fileName,
// //       fileSize: 0,
// //       deviceName,
// //       senderIp: socket.localAddress || "unknown",
// //       chunks: [],
// //       receivedBytes: 0,
// //       startTime: Date.now(),
// //       totalChunks: 0,
// //       chunkSize: 0,
// //       totalSize: 0,
// //       chunkHashes: [],
// //       aesKey: undefined,
// //       iv: undefined,
// //       status: "Sending",
// //       progress: 0,
// //       lastChunkIndex: -1,
// //       completedChunks: new Set(),
// //     };
// //     fileTransfers.set(fileId, transfer);

// //     try {
// //       const stat = await RNFS.stat(filePath);
// //       const fileSize = stat.size;
// //       const { chunkSize, numChunks: totalChunks } =
// //         calculateDynamicChunkDivision(fileSize);

// //       transfer = {
// //         ...transfer,
// //         fileSize,
// //         totalChunks,
// //         chunkSize,
// //         totalSize: fileSize,
// //         chunks: new Array(totalChunks).fill(undefined),
// //         chunkHashes: new Array(totalChunks).fill(""),
// //       };
// //       fileTransfers.set(fileId, transfer);

// //       let retries = 0;
// //       while (retries < MAX_RETRIES) {
// //         try {
// //           if (retries > 0) {
// //             await new Promise<void>((resolve, reject) => {
// //               const timeout = setTimeout(() => {
// //                 reject(
// //                   new DropShareError(
// //                     ERROR_CODES.NETWORK_ERROR,
// //                     `Timeout waiting for ACK_RESET (attempt ${retries + 1})`
// //                   )
// //                 );
// //               }, ACK_TIMEOUT);
// //               socket.once("data", (data) => {
// //                 clearTimeout(timeout);
// //                 const message = data.toString();
// //                 Logger.info(`Received for ACK_RESET: ${message}`);
// //                 if (message.startsWith(`ACK_RESET:${fileId}`)) {
// //                   resolve();
// //                 } else {
// //                   reject(
// //                     new DropShareError(
// //                       ERROR_CODES.INVALID_HEADER,
// //                       `Invalid ACK_RESET response: ${message}`
// //                     )
// //                   );
// //                 }
// //               });
// //               socket.write(Buffer.from(`RESET:${fileId}\n`));
// //               Logger.info(`Sent RESET for ${fileId}`);
// //             });
// //           }

// //           let availableChunks: number[] = [];
// //           await new Promise<void>((resolve, reject) => {
// //             const timeout = setTimeout(() => {
// //               reject(
// //                 new DropShareError(
// //                   ERROR_CODES.NETWORK_ERROR,
// //                   `Timeout waiting for ACK_FILE (attempt ${retries + 1})`
// //                 )
// //               );
// //             }, ACK_TIMEOUT);
// //             socket.once("data", (data) => {
// //               clearTimeout(timeout);
// //               const message = data.toString();
// //               Logger.info(`Received for ACK_FILE: ${message}`);
// //               if (message.startsWith(`ACK_FILE:${fileId}:`)) {
// //                 availableChunks = JSON.parse(message.split(":")[2]) || [];
// //                 resolve();
// //               } else if (message.startsWith(`ACK_FILE:${fileId}`)) {
// //                 resolve();
// //               } else {
// //                 reject(
// //                   new DropShareError(
// //                     ERROR_CODES.INVALID_HEADER,
// //                     `Invalid ACK_FILE response: ${message}`
// //                   )
// //                 );
// //               }
// //             });
// //             const header: FileHeader = {
// //               protocolVersion: PROTOCOL_VERSION,
// //               name: fileName,
// //               size: fileSize,
// //               sender: deviceName,
// //               fileId,
// //               totalChunks,
// //               chunkSize,
// //             };
// //             socket.write(Buffer.from(`FILE:${JSON.stringify(header)}\n\n`));
// //             Logger.info(`Sent header for ${fileId}: ${JSON.stringify(header)}`);
// //           });

// //           const pendingChunks = Array.from(
// //             { length: totalChunks },
// //             (_, i) => i
// //           ).filter((i) => !availableChunks.includes(i));
// //           let sentBytes = availableChunks.reduce(
// //             (sum, i) => sum + Math.min(chunkSize, fileSize - i * chunkSize),
// //             0
// //           );

// //           const sendChunk = async (chunkIndex: number): Promise<void> => {
// //             const start = chunkIndex * chunkSize;
// //             const actualChunkSize = Math.min(chunkSize, fileSize - start);
// //             const chunk = await RNFS.read(
// //               filePath,
// //               actualChunkSize,
// //               start,
// //               "base64"
// //             );
// //             const chunkBuffer = Buffer.from(chunk, "base64");
// //             const chunkHash = CryptoJS.SHA256(
// //               CryptoJS.enc.Base64.parse(chunk)
// //             ).toString(CryptoJS.enc.Hex);
// //             transfer.chunkHashes[chunkIndex] = chunkHash;
// //             fileTransfers.set(fileId, transfer);

// //             await new Promise<void>((resolve, reject) => {
// //               const timeout = setTimeout(() => {
// //                 reject(
// //                   new DropShareError(
// //                     ERROR_CODES.NETWORK_ERROR,
// //                     `Timeout waiting for ACK_CHUNK:${chunkIndex} (attempt ${
// //                       retries + 1
// //                     })`
// //                   )
// //                 );
// //               }, ACK_TIMEOUT);
// //               socket.once("data", (data) => {
// //                 clearTimeout(timeout);
// //                 const message = data.toString();
// //                 Logger.info(`Received for ACK_CHUNK:${chunkIndex}: ${message}`);
// //                 if (message.startsWith(`ACK_CHUNK:${fileId}:${chunkIndex}`)) {
// //                   resolve();
// //                 } else if (message.startsWith("ERROR:")) {
// //                   reject(
// //                     new DropShareError(
// //                       ERROR_CODES.NETWORK_ERROR,
// //                       `Receiver error: ${message}`
// //                     )
// //                   );
// //                 } else {
// //                   reject(
// //                     new DropShareError(
// //                       ERROR_CODES.INVALID_HEADER,
// //                       `Invalid ACK_CHUNK response: ${message}`
// //                     )
// //                   );
// //                 }
// //               });
// //               const chunkHeader = Buffer.from(
// //                 `CHUNK:${JSON.stringify({
// //                   fileId,
// //                   chunkIndex,
// //                   chunkSize: actualChunkSize,
// //                   chunkHash,
// //                 })}\n\n`
// //               );
// //               socket.write(Buffer.concat([chunkHeader, Buffer.from(chunk)]));
// //               Logger.info(
// //                 `Sent chunk ${chunkIndex}/${totalChunks} for ${fileId} (${actualChunkSize} bytes, hash: ${chunkHash})`
// //               );
// //             });

// //             sentBytes += chunk.length; // Use base64-encoded size
// //             const percentage = (sentBytes / ((fileSize * 4) / 3)) * 100; // Adjust for base64
// //             const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
// //             const speed = (sentBytes / elapsedTime / 1024 / 1024).toFixed(2);

// //             transfer.receivedBytes = sentBytes;
// //             transfer.progress = percentage;
// //             transfer.lastChunkIndex = chunkIndex;
// //             transfer.completedChunks.add(chunkIndex);
// //             fileTransfers.set(fileId, transfer);

// //             setTransferProgress?.((prev) => [
// //               ...prev.filter((p) => p.fileId !== fileId),
// //               {
// //                 fileId,
// //                 fileName,
// //                 progress: `${(sentBytes / (1024 * 1024)).toFixed(2)}/${(
// //                   (fileSize * 4) /
// //                   3 /
// //                   (1024 * 1024)
// //                 ).toFixed(2)} MB`,
// //                 speed: `${speed} MB/s`,
// //                 percentage,
// //               },
// //             ]);
// //           };

// //           const queue = pendingChunks.slice();
// //           const activePromises: Promise<void>[] = [];
// //           while (queue.length > 0 || activePromises.length > 0) {
// //             while (
// //               queue.length > 0 &&
// //               activePromises.length < MAX_CONCURRENT_CHUNKS
// //             ) {
// //               const chunkIndex = queue.shift()!;
// //               activePromises.push(sendChunk(chunkIndex));
// //             }
// //             try {
// //               await Promise.race(activePromises);
// //             } catch (error) {
// //               Logger.warn(`Chunk send failed: ${error}`);
// //             }
// //             activePromises.splice(
// //               0,
// //               activePromises.length,
// //               ...activePromises.filter((p) => p !== Promise.resolve())
// //             );
// //           }
// //           await Promise.all(activePromises);

// //           await new Promise<void>((resolve, reject) => {
// //             const timeout = setTimeout(() => {
// //               reject(
// //                 new DropShareError(
// //                   ERROR_CODES.NETWORK_ERROR,
// //                   `Timeout waiting for ACK_COMPLETE (attempt ${retries + 1})`
// //                 )
// //               );
// //             }, ACK_TIMEOUT);
// //             socket.once("data", (data) => {
// //               clearTimeout(timeout);
// //               const message = data.toString();
// //               Logger.info(`Received for ACK_COMPLETE: ${message}`);
// //               if (message.startsWith(`ACK_COMPLETE:${fileId}`)) {
// //                 transfer.status = "Completed";
// //                 transfer.endTime = Date.now();
// //                 transfer.progress = 100;
// //                 fileTransfers.set(fileId, transfer);
// //                 const elapsedTime =
// //                   (Date.now() - transfer.startTime) / 1000 || 1;
// //                 const speed = (
// //                   (fileSize * 4) /
// //                   3 /
// //                   elapsedTime /
// //                   1024 /
// //                   1024
// //                 ).toFixed(2);
// //                 setTransferProgress?.((prev) => [
// //                   ...prev.filter((p) => p.fileId !== fileId),
// //                   {
// //                     fileId,
// //                     fileName,
// //                     progress: `${((fileSize * 4) / 3 / (1024 * 1024)).toFixed(
// //                       2
// //                     )}/${((fileSize * 4) / 3 / (1024 * 1024)).toFixed(2)} MB`,
// //                     speed: `${speed} MB/s`,
// //                     percentage: 100,
// //                   },
// //                 ]);
// //                 resolve();
// //               } else if (message.startsWith("ERROR:")) {
// //                 reject(
// //                   new DropShareError(
// //                     ERROR_CODES.NETWORK_ERROR,
// //                     `Receiver error: ${message}`
// //                   )
// //                 );
// //               } else {
// //                 reject(
// //                   new DropShareError(
// //                     ERROR_CODES.NETWORK_ERROR,
// //                     `Invalid ACK_COMPLETE response: ${message}`
// //                   )
// //                 );
// //               }
// //             });
// //           });
// //           break;
// //         } catch (error) {
// //           retries++;
// //           if (retries === MAX_RETRIES) {
// //             throw error;
// //           }
// //           Logger.warn(`Retrying file send for ${fileId} after error: ${error}`);
// //           await new Promise((resolve) => setTimeout(resolve, 2000));
// //         }
// //       }
// //     } catch (error) {
// //       const err = DropShareError.from(
// //         error,
// //         ERROR_CODES.NETWORK_ERROR,
// //         `Transfer failed: ${
// //           error instanceof Error ? error.message : "Unknown error"
// //         }`
// //       );
// //       transfer.status = "Failed";
// //       transfer.error = err.message;
// //       fileTransfers.set(fileId, transfer);
// //       setTransferProgress?.((prev) => [
// //         ...prev.filter((p) => p.fileId !== fileId),
// //         {
// //           fileId,
// //           fileName,
// //           progress: `${(transfer.receivedBytes / (1024 * 1024)).toFixed(2)}/${(
// //             (transfer.totalSize * 4) /
// //             3 /
// //             (1024 * 1024)
// //           ).toFixed(2)} MB`,
// //           speed: "0 MB/s",
// //           percentage: transfer.progress,
// //           error: err.message,
// //         },
// //       ]);
// //       Logger.error(`Error in file transfer for ${fileName}`, error);
// //       throw err;
// //     } finally {
// //       if (transfer.status === "Completed" || transfer.status === "Failed") {
// //         await chunkStorage.clearChunks(fileId);
// //         fileTransfers.delete(fileId);
// //       }
// //     }
// //   }

// //   async function receiveFileInHost({
// //     data,
// //     setMessages,
// //     setReceivedFiles,
// //     socket,
// //     connectedSockets,
// //     setTransferProgress,
// //   }: HostReceiveProps): Promise<void> {
// //     const chunkStorage = ChunkStorage.getInstance();
// //     try {
// //       if (buffer.length > MAX_BUFFER_SIZE) {
// //         Logger.error("Buffer size exceeded, clearing buffer");
// //         buffer = Buffer.alloc(0);
// //         throw new DropShareError(
// //           ERROR_CODES.NETWORK_ERROR,
// //           "Buffer size exceeded"
// //         );
// //       }
// //       buffer = Buffer.concat([
// //         buffer,
// //         typeof data === "string" ? Buffer.from(data) : data,
// //       ]);
// //       Logger.info(
// //         `Received ${data.length} bytes, buffer now ${buffer.length} bytes`
// //       );

// //       while (buffer.length > 0) {
// //         const dataStr = buffer.toString();

// //         if (dataStr.startsWith("RESET:")) {
// //           const messageEnd = buffer.indexOf(Buffer.from("\n"));
// //           if (messageEnd === -1) {
// //             Logger.info(
// //               `Incomplete RESET from ${
// //                 socket.remoteAddress ?? "unknown"
// //               }, waiting...`
// //             );
// //             return;
// //           }
// //           const resetFileId = dataStr.slice(6, messageEnd);
// //           Logger.info(`Received RESET for fileId ${resetFileId}`);
// //           if (resetFileId === fileId || !fileId) {
// //             receivingFile = false;
// //             fileTransfers.delete(resetFileId);
// //             await chunkStorage.clearChunks(resetFileId);
// //             fileId = "";
// //           }
// //           socket.write(Buffer.from(`ACK_RESET:${resetFileId}\n`));
// //           buffer = buffer.slice(messageEnd + 1);
// //           continue;
// //         }

// //         if (receivingFile) {
// //           if (dataStr.startsWith("CHUNK:")) {
// //             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
// //             if (headerEnd === -1) {
// //               Logger.info(`Incomplete CHUNK header from client, waiting...`);
// //               return;
// //             }
// //             const headerStr = buffer.slice(6, headerEnd).toString();
// //             let chunkData: {
// //               fileId: string;
// //               chunkIndex: number;
// //               chunkSize: number;
// //               chunkHash: string;
// //             };
// //             try {
// //               chunkData = JSON.parse(headerStr);
// //             } catch (error) {
// //               Logger.error(
// //                 `Failed to parse CHUNK header for fileId ${fileId}: ${headerStr}`,
// //                 error
// //               );
// //               throw new DropShareError(
// //                 ERROR_CODES.INVALID_HEADER,
// //                 "Invalid chunk header"
// //               );
// //             }

// //             const chunkSize = chunkData.chunkSize;
// //             const chunkStart = headerEnd + 2;
// //             const expectedBase64Length = Math.ceil((chunkSize * 4) / 3);
// //             const minBase64Length = expectedBase64Length - 2;
// //             const maxBase64Length = expectedBase64Length + 2;
// //             const chunkEnd = chunkStart + expectedBase64Length;

// //             if (buffer.length < chunkEnd) {
// //               if (lastLoggedChunkIndex !== chunkData.chunkIndex) {
// //                 Logger.info(
// //                   `Waiting for base64 chunk data for ${
// //                     chunkData.fileId
// //                   } (chunkIndex: ${
// //                     chunkData.chunkIndex
// //                   }, expected ${expectedBase64Length} bytes, received ${
// //                     buffer.length - chunkStart
// //                   } bytes)`
// //                 );
// //                 lastLoggedChunkIndex = chunkData.chunkIndex;
// //               }
// //               return;
// //             }

// //             let base64Chunk = buffer.slice(chunkStart, chunkEnd).toString();
// //             const actualBase64Length = base64Chunk.length;

// //             if (
// //               actualBase64Length < minBase64Length ||
// //               actualBase64Length > maxBase64Length
// //             ) {
// //               Logger.error(
// //                 `Base64 length mismatch for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}): expected ${expectedBase64Length} (±2), received ${actualBase64Length}`
// //               );
// //               throw new DropShareError(
// //                 ERROR_CODES.CORRUPTED_CHUNK,
// //                 `Base64 length mismatch: expected ${expectedBase64Length} (±2), received ${actualBase64Length}`
// //               );
// //             }

// //             let chunk: Buffer;
// //             try {
// //               chunk = Buffer.from(base64Chunk, "base64");
// //               if (
// //                 chunk.length !== chunkSize &&
// //                 chunk.length !== chunkSize - 1 &&
// //                 chunk.length !== chunkSize - 2
// //               ) {
// //                 Logger.error(
// //                   `Chunk size mismatch for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}): expected ${chunkSize}, received ${chunk.length}`
// //                 );
// //                 throw new DropShareError(
// //                   ERROR_CODES.CORRUPTED_CHUNK,
// //                   `Chunk size mismatch: expected ${chunkSize}, received ${chunk.length}`
// //                 );
// //               }
// //               const receivedHash = CryptoJS.SHA256(
// //                 CryptoJS.enc.Base64.parse(base64Chunk)
// //               ).toString(CryptoJS.enc.Hex);
// //               if (receivedHash !== chunkData.chunkHash) {
// //                 Logger.error(
// //                   `Hash mismatch for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex}): expected ${chunkData.chunkHash}, received ${receivedHash}`
// //                 );
// //                 throw new DropShareError(
// //                   ERROR_CODES.CORRUPTED_CHUNK,
// //                   `Hash mismatch for chunk ${chunkData.chunkIndex}`
// //                 );
// //               }
// //               Logger.info(
// //                 `Verified hash for chunk ${chunkData.chunkIndex} of ${chunkData.fileId}: ${chunkData.chunkHash}`
// //               );
// //             } catch (error) {
// //               Logger.error(
// //                 `Failed to decode or verify base64 chunk for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex})`,
// //                 error
// //               );
// //               throw new DropShareError(
// //                 ERROR_CODES.CORRUPTED_CHUNK,
// //                 "Invalid base64 chunk data or hash"
// //               );
// //             }

// //             Logger.info(
// //               `Processed chunk ${chunkData.chunkIndex}/${
// //                 fileTransfers.get(chunkData.fileId)?.totalChunks
// //               } for ${
// //                 chunkData.fileId
// //               } (${chunkSize} bytes, base64 length: ${actualBase64Length}, decoded length: ${
// //                 chunk.length
// //               }, hash: ${chunkData.chunkHash})`
// //             );
// //             lastLoggedChunkIndex = null;

// //             await chunkStorage.storeChunk(
// //               chunkData.fileId,
// //               chunkData.chunkIndex,
// //               chunkSize,
// //               base64Chunk
// //             );

// //             const transfer = fileTransfers.get(chunkData.fileId);
// //             if (transfer) {
// //               transfer.chunks[chunkData.chunkIndex] = chunk;
// //               transfer.receivedBytes += chunk.length;
// //               transfer.progress =
// //                 (transfer.receivedBytes / transfer.totalSize) * 100;
// //               transfer.lastChunkIndex = chunkData.chunkIndex;
// //               transfer.completedChunks.add(chunkData.chunkIndex);
// //               transfer.chunkHashes[chunkData.chunkIndex] = chunkData.chunkHash;
// //               fileTransfers.set(chunkData.fileId, transfer);

// //               const elapsedTime = (Date.now() - transfer.startTime) / 1000 || 1;
// //               const speed = (
// //                 transfer.receivedBytes /
// //                 elapsedTime /
// //                 1024 /
// //                 1024
// //               ).toFixed(2);

// //               setTransferProgress?.((prev) => [
// //                 ...prev.filter((p) => p.fileId !== chunkData.fileId),
// //                 {
// //                   fileId: chunkData.fileId,
// //                   fileName: transfer.fileName,
// //                   progress: `${(transfer.receivedBytes / (1024 * 1024)).toFixed(
// //                     2
// //                   )}/${(transfer.totalSize / (1024 * 1024)).toFixed(2)} MB`,
// //                   speed: `${speed} MB/s`,
// //                   percentage: transfer.progress,
// //                 },
// //               ]);

// //               socket.write(
// //                 Buffer.from(
// //                   `ACK_CHUNK:${chunkData.fileId}:${chunkData.chunkIndex}\n`
// //                 )
// //               );
// //               Logger.info(
// //                 `Sent ACK_CHUNK for ${chunkData.fileId} (chunkIndex: ${chunkData.chunkIndex})`
// //               );
// //               buffer = buffer.slice(chunkEnd);
// //               Logger.info(`Buffer sliced, remaining: ${buffer.length} bytes`);

// //               if (transfer.completedChunks.size === transfer.totalChunks) {
// //                 const finalPath = await chunkStorage.assembleFile(
// //                   chunkData.fileId,
// //                   transfer.totalChunks,
// //                   transfer.fileName
// //                 );
// //                 setReceivedFiles((prev) => [...prev, finalPath]);
// //                 Logger.info(
// //                   `Received and saved file: ${finalPath} from ${transfer.deviceName}`
// //                 );
// //                 transfer.status = "Completed";
// //                 transfer.endTime = Date.now();
// //                 socket.write(Buffer.from(`ACK_COMPLETE:${chunkData.fileId}\n`));
// //                 fileTransfers.delete(chunkData.fileId);
// //                 receivingFile = false;
// //                 fileId = "";
// //               }
// //             }
// //           } else if (dataStr.startsWith("FILE:") && fileId) {
// //             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
// //             if (headerEnd === -1) {
// //               Logger.info(
// //                 `Incomplete retransmission FILE header from ${
// //                   socket.remoteAddress ?? "unknown"
// //                 }, waiting...`
// //               );
// //               return;
// //             }
// //             const headerStr = buffer.slice(5, headerEnd).toString();
// //             let headerData: FileHeader;
// //             try {
// //               headerData = JSON.parse(headerStr);
// //             } catch (error) {
// //               Logger.error(
// //                 `Failed to parse retransmission FILE header: ${headerStr}`,
// //                 error
// //               );
// //               throw new DropShareError(
// //                 ERROR_CODES.INVALID_HEADER,
// //                 "Invalid file header"
// //               );
// //             }

// //             if (headerData.fileId === fileId) {
// //               Logger.info(
// //                 `Detected retransmission for fileId ${fileId}, resetting state`
// //               );
// //               receivingFile = false;
// //               fileTransfers.delete(fileId);
// //               await chunkStorage.clearChunks(fileId);
// //               await initializeFileTransfer(
// //                 headerData,
// //                 socket,
// //                 setTransferProgress
// //               );
// //               const availableChunks = await chunkStorage.getAvailableChunks(
// //                 fileId
// //               );
// //               socket.write(
// //                 Buffer.from(
// //                   `ACK_FILE:${fileId}:${JSON.stringify(availableChunks)}\n`
// //                 )
// //               );
// //               buffer = buffer.slice(headerEnd + 2);
// //               receivingFile = true;
// //             } else {
// //               Logger.warn(
// //                 `Unexpected FILE header for different fileId ${headerData.fileId} while processing ${fileId}`
// //               );
// //               buffer = Buffer.alloc(0);
// //               return;
// //             }
// //           } else {
// //             Logger.warn(
// //               `Unexpected data while receiving file for ${fileId}: ${dataStr.slice(
// //                 0,
// //                 50
// //               )}...`
// //             );
// //             buffer = Buffer.alloc(0);
// //             return;
// //           }
// //         } else {
// //           if (dataStr.startsWith("FILE:")) {
// //             const headerEnd = buffer.indexOf(Buffer.from("\n\n"));
// //             if (headerEnd === -1) {
// //               Logger.info(
// //                 `Incomplete FILE header from ${
// //                   socket.remoteAddress ?? "unknown"
// //                 }, waiting...`
// //               );
// //               return;
// //             }
// //             const headerStr = buffer.slice(5, headerEnd).toString();
// //             let headerData: FileHeader;
// //             try {
// //               headerData = JSON.parse(headerStr);
// //             } catch (error) {
// //               Logger.error(`Failed to parse FILE header: ${headerStr}`, error);
// //               throw new DropShareError(
// //                 ERROR_CODES.INVALID_HEADER,
// //                 "Invalid file header"
// //               );
// //             }

// //             await initializeFileTransfer(
// //               headerData,
// //               socket,
// //               setTransferProgress
// //             );
// //             const availableChunks = await chunkStorage.getAvailableChunks(
// //               headerData.fileId
// //             );
// //             socket.write(
// //               Buffer.from(
// //                 `ACK_FILE:${headerData.fileId}:${JSON.stringify(
// //                   availableChunks
// //                 )}\n`
// //               )
// //             );
// //             buffer = buffer.slice(headerEnd + 2);
// //             receivingFile = true;
// //           } else if (dataStr.startsWith("MSG:")) {
// //             const messageEnd = buffer.indexOf(Buffer.from("\n"));
// //             if (messageEnd === -1) {
// //               Logger.info(
// //                 `Incomplete MSG from ${
// //                   socket.remoteAddress ?? "unknown"
// //                 }, waiting...`
// //               );
// //               return;
// //             }
// //             const message = buffer.slice(4, messageEnd).toString();
// //             setMessages((prev) => [
// //               ...prev,
// //               `${socket.remoteAddress ?? "unknown"}: ${message}`,
// //             ]);
// //             connectedSockets
// //               .filter((s) => s !== socket)
// //               .forEach((s) => {
// //                 s.write(Buffer.from(`MSG:${message}\n`));
// //                 Logger.info(`Forwarded MSG to ${s.remoteAddress ?? "unknown"}`);
// //               });
// //             buffer = buffer.slice(messageEnd + 1);
// //           } else if (
// //             dataStr.startsWith("ACK_FILE:") ||
// //             dataStr.startsWith("ACK_COMPLETE:") ||
// //             dataStr.startsWith("ACK_CHUNK:")
// //           ) {
// //             const messageEnd = buffer.indexOf(Buffer.from("\n"));
// //             if (messageEnd === -1) {
// //               Logger.info(
// //                 `Incomplete ${dataStr.slice(0, 10)} from ${
// //                   socket.remoteAddress ?? "unknown"
// //                 }, waiting...`
// //               );
// //               return;
// //             }
// //             Logger.info(`Processed ${dataStr.slice(0, messageEnd)}`);
// //             buffer = buffer.slice(messageEnd + 1);
// //           } else {
// //             Logger.warn(
// //               `Invalid data from ${
// //                 socket.remoteAddress ?? "unknown"
// //               }: ${dataStr.slice(0, 50)}...`
// //             );
// //             socket.write(
// //               Buffer.from(
// //                 `ERROR:${ERROR_CODES.INVALID_HEADER}:Invalid protocol\n`
// //               )
// //             );
// //             buffer = Buffer.alloc(0);
// //           }
// //         }
// //       }
// //     } catch (error) {
// //       Logger.error(
// //         `Error processing data from ${socket.remoteAddress ?? "unknown"}`,
// //         error
// //       );
// //       const err = DropShareError.from(
// //         error,
// //         ERROR_CODES.NETWORK_ERROR,
// //         "Data processing failed"
// //       );
// //       socket.write(Buffer.from(`ERROR:${err.code}:${err.message}\n`));
// //       buffer = Buffer.alloc(0);
// //       receivingFile = false;
// //       fileTransfers.delete(fileId);
// //       await chunkStorage.clearChunks(fileId);
// //       fileId = "";
// //       lastLoggedChunkIndex = null;
// //       setTransferProgress?.((prev) => [
// //         ...prev.filter((p) => p.fileId !== fileId),
// //         {
// //           fileId,
// //           fileName: fileTransfers.get(fileId)?.fileName || "unknown",
// //           progress: "0/0 MB",
// //           speed: "0 MB/s",
// //           percentage: 0,
// //           error: err.message,
// //         },
// //       ]);
// //     }
// //   }

// //   async function sendHostFile(
// //     server: TCPSocket.Server | null,
// //     filePath: string,
// //     username: string,
// //     connectedSockets: TCPSocket.Socket[],
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): Promise<void> {
// //     if (!server || connectedSockets.length === 0) {
// //       Logger.toast("No connected clients to send file", "error");
// //       throw new DropShareError(
// //         ERROR_CODES.NETWORK_ERROR,
// //         "No connected clients"
// //       );
// //     }

// //     const fileName = filePath.split("/").pop() ?? "unknown";
// //     const fileId = `${Date.now()}-${fileName}`;

// //     try {
// //       await Promise.all(
// //         connectedSockets.map((socket) =>
// //           sendFile(
// //             socket,
// //             fileName,
// //             filePath,
// //             username,
// //             fileId,
// //             setTransferProgress
// //           )
// //         )
// //       );
// //       Logger.info(`Sent file: ${fileName} from ${username} to all clients`);
// //       Logger.toast(`Sent file ${fileName}`, "info");
// //     } catch (error) {
// //       Logger.error(`Failed to send file ${fileName}`, error);
// //       throw error;
// //     }
// //   }

// //   async function sendFilesInHost(
// //     server: TCPSocket.Server | null,
// //     files: { filePath: string }[],
// //     username: string,
// //     connectedSockets: TCPSocket.Socket[],
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): Promise<void> {
// //     if (!server || connectedSockets.length === 0) {
// //       Logger.toast("No connected clients to send files", "error");
// //       throw new DropShareError(
// //         ERROR_CODES.NETWORK_ERROR,
// //         "No connected clients"
// //       );
// //     }

// //     for (const { filePath } of files) {
// //       await sendHostFile(
// //         server,
// //         filePath,
// //         username,
// //         connectedSockets,
// //         setTransferProgress
// //       );
// //       Logger.info(`Sent file: ${filePath.split("/").pop()} from ${username}`);
// //     }
// //   }

// //   function sendMessageInHost(
// //     message: string,
// //     username: string,
// //     connectedSockets: TCPSocket.Socket[]
// //   ): void {
// //     if (connectedSockets.length === 0) {
// //       Logger.toast("No connected clients to send message", "error");
// //       return;
// //     }

// //     connectedSockets.forEach((socket) => {
// //       socket.write(Buffer.from(`MSG:${username}: ${message}\n`));
// //       Logger.info(
// //         `Sent MSG to ${socket.remoteAddress ?? "unknown"}: ${message}`
// //       );
// //     });
// //   }

// //   async function initializeFileTransfer(
// //     headerData: FileHeader,
// //     socket: TCPSocket.Socket,
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): Promise<void> {
// //     const chunkStorage = ChunkStorage.getInstance();
// //     if (headerData.protocolVersion !== PROTOCOL_VERSION) {
// //       Logger.error(
// //         `Protocol version mismatch for ${headerData.fileId}: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
// //       );
// //       socket.write(
// //         Buffer.from(
// //           `ERROR:${ERROR_CODES.INVALID_HEADER}:Protocol version mismatch\n`
// //         )
// //       );
// //       buffer = Buffer.alloc(0);
// //       throw new DropShareError(
// //         ERROR_CODES.INVALID_HEADER,
// //         `Protocol version mismatch: expected ${PROTOCOL_VERSION}, received ${headerData.protocolVersion}`
// //       );
// //     }

// //     fileId = headerData.fileId;
// //     const fileName = headerData.name;
// //     const fileSize = headerData.size;
// //     const deviceName = headerData.sender || "Unknown";
// //     const totalChunks = headerData.totalChunks;
// //     const chunkSize = headerData.chunkSize;

// //     if (!fileName || !fileSize || !fileId || !totalChunks || !chunkSize) {
// //       throw new DropShareError(
// //         ERROR_CODES.INVALID_HEADER,
// //         "Missing file name, size, ID, total chunks, or chunk size"
// //       );
// //     }

// //     const { chunkSize: calculatedChunkSize } =
// //       calculateDynamicChunkDivision(fileSize);
// //     if (chunkSize !== calculatedChunkSize) {
// //       Logger.error(
// //         `Chunk size mismatch for ${fileId}: expected ${calculatedChunkSize}, received ${chunkSize}`
// //       );
// //       throw new DropShareError(
// //         ERROR_CODES.INVALID_HEADER,
// //         `Chunk size mismatch: expected ${calculatedChunkSize}, received ${chunkSize}`
// //       );
// //     }

// //     if (!checkTransferLimits(fileSize, fileTransfers)) {
// //       socket.write(
// //         Buffer.from(`ERROR:${ERROR_CODES.TRANSFER_LIMIT_EXCEEDED}\n`)
// //       );
// //       Logger.toast(`Transfer limit exceeded for ${fileName}`, "error");
// //       buffer = Buffer.alloc(0);
// //       throw new DropShareError(
// //         ERROR_CODES.TRANSFER_LIMIT_EXCEEDED,
// //         `Transfer limit exceeded for ${fileName}`
// //       );
// //     }

// //     const availableChunks = await chunkStorage.getAvailableChunks(fileId);
// //     const transfer: FileTransfer = {
// //       fileId,
// //       fileName,
// //       fileSize,
// //       deviceName,
// //       senderIp: socket.remoteAddress || "unknown",
// //       chunks: new Array(totalChunks).fill(undefined),
// //       receivedBytes: availableChunks.reduce(
// //         (sum, i) => sum + Math.min(chunkSize, fileSize - i * chunkSize),
// //         0
// //       ),
// //       startTime: Date.now(),
// //       totalChunks,
// //       chunkSize,
// //       totalSize: fileSize,
// //       chunkHashes: new Array(totalChunks).fill(""),
// //       aesKey: undefined,
// //       iv: undefined,
// //       status: "Receiving",
// //       progress: (availableChunks.length / totalChunks) * 100,
// //       lastChunkIndex: -1,
// //       completedChunks: new Set(availableChunks),
// //     };
// //     fileTransfers.set(fileId, transfer);
// //   }

// //   return {
// //     sendFilesInHost,
// //     sendMessageInHost,
// //     receiveFileInHost,
// //   };
// // };

// // ChunkStorage.ts
// // import SQLite from "react-native-sqlite-storage";
// // import RNFS from "react-native-fs";
// // import { Logger } from "../utils/Logger";
// // import { DropShareError, ERROR_CODES } from "../utils/Error";
// // import { TEMP_CHUNKS_PATH, SAVE_PATH } from "../utils/FileSystemUtil";

// // SQLite.enablePromise(true);

// // interface ChunkInfo {
// //   fileId: string;
// //   chunkIndex: number;
// //   chunkSize: number;
// //   tempPath: string;
// // }

// // export class ChunkStorage {
// //   private db: SQLite.SQLiteDatabase | null = null;
// //   private static instance: ChunkStorage;

// //   private constructor() {}

// //   public static getInstance(): ChunkStorage {
// //     if (!ChunkStorage.instance) {
// //       ChunkStorage.instance = new ChunkStorage();
// //     }
// //     return ChunkStorage.instance;
// //   }

// //   async initialize(): Promise<void> {
// //     try {
// //       this.db = await SQLite.openDatabase({
// //         name: "chunkStorage.db",
// //         location: "default",
// //       });
// //       await this.db.executeSql(`
// //         CREATE TABLE IF NOT EXISTS chunks (
// //           fileId TEXT,
// //           chunkIndex INTEGER,
// //           chunkSize INTEGER,
// //           tempPath TEXT,
// //           PRIMARY KEY (fileId, chunkIndex)
// //         )
// //       `);
// //       Logger.info("ChunkStorage database initialized");
// //     } catch (error) {
// //       Logger.error("Failed to initialize ChunkStorage database", error);
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_WRITE_ERROR,
// //         "Failed to initialize database"
// //       );
// //     }
// //   }

// //   async storeChunk(
// //     fileId: string,
// //     chunkIndex: number,
// //     chunkSize: number,
// //     base64Data: string
// //   ): Promise<void> {
// //     if (!this.db) {
// //       await this.initialize();
// //     }
// //     const tempPath = `${TEMP_CHUNKS_PATH}/${fileId}_${chunkIndex}`;
// //     try {
// //       if (!(await RNFS.exists(TEMP_CHUNKS_PATH))) {
// //         await RNFS.mkdir(TEMP_CHUNKS_PATH);
// //       }
// //       await RNFS.writeFile(tempPath, base64Data, "base64");
// //       await this.db!.executeSql(
// //         "INSERT OR REPLACE INTO chunks (fileId, chunkIndex, chunkSize, tempPath) VALUES (?, ?, ?, ?)",
// //         [fileId, chunkIndex, chunkSize, tempPath]
// //       );
// //       Logger.info(`Stored chunk ${chunkIndex} for fileId ${fileId}`);
// //     } catch (error) {
// //       Logger.error(
// //         `Failed to store chunk ${chunkIndex} for fileId ${fileId}`,
// //         error
// //       );
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_WRITE_ERROR,
// //         `Failed to store chunk: ${
// //           error instanceof Error ? error.message : "Unknown error"
// //         }`
// //       );
// //     }
// //   }

// //   async getChunk(
// //     fileId: string,
// //     chunkIndex: number
// //   ): Promise<ChunkInfo | null> {
// //     if (!this.db) {
// //       await this.initialize();
// //     }
// //     try {
// //       const [results] = await this.db!.executeSql(
// //         "SELECT * FROM chunks WHERE fileId = ? AND chunkIndex = ?",
// //         [fileId, chunkIndex]
// //       );
// //       if (results.rows.length > 0) {
// //         const row = results.rows.item(0);
// //         return {
// //           fileId: row.fileId,
// //           chunkIndex: row.chunkIndex,
// //           chunkSize: row.chunkSize,
// //           tempPath: row.tempPath,
// //         };
// //       }
// //       return null;
// //     } catch (error) {
// //       Logger.error(
// //         `Failed to retrieve chunk ${chunkIndex} for fileId ${fileId}`,
// //         error
// //       );
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_ERROR,
// //         `Failed to retrieve chunk: ${
// //           error instanceof Error ? error.message : "Unknown error"
// //         }`
// //       );
// //     }
// //   }

// //   async getAvailableChunks(fileId: string): Promise<number[]> {
// //     if (!this.db) {
// //       await this.initialize();
// //     }
// //     try {
// //       const [results] = await this.db!.executeSql(
// //         "SELECT chunkIndex FROM chunks WHERE fileId = ? ORDER BY chunkIndex",
// //         [fileId]
// //       );
// //       const chunkIndices: number[] = [];
// //       for (let i = 0; i < results.rows.length; i++) {
// //         chunkIndices.push(results.rows.item(i).chunkIndex);
// //       }
// //       return chunkIndices;
// //     } catch (error) {
// //       Logger.error(
// //         `Failed to retrieve available chunks for fileId ${fileId}`,
// //         error
// //       );
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_ERROR,
// //         `Failed to retrieve available chunks: ${
// //           error instanceof Error ? error.message : "Unknown error"
// //         }`
// //       );
// //     }
// //   }

// //   async assembleFile(
// //     fileId: string,
// //     totalChunks: number,
// //     fileName: string
// //   ): Promise<string> {
// //     if (!this.db) {
// //       await this.initialize();
// //     }
// //     try {
// //       const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
// //       const finalPath = `${SAVE_PATH}/${sanitizedFileName}`;
// //       if (!(await RNFS.exists(SAVE_PATH))) {
// //         await RNFS.mkdir(SAVE_PATH);
// //       }
// //       await RNFS.writeFile(finalPath, "", "base64");
// //       for (let i = 0; i < totalChunks; i++) {
// //         const chunkInfo = await this.getChunk(fileId, i);
// //         if (!chunkInfo) {
// //           throw new DropShareError(
// //             ERROR_CODES.CORRUPTED_CHUNK,
// //             `Missing chunk ${i} for fileId ${fileId}`
// //           );
// //         }
// //         const base64Data = await RNFS.readFile(chunkInfo.tempPath, "base64");
// //         await RNFS.appendFile(finalPath, base64Data, "base64");
// //         await RNFS.unlink(chunkInfo.tempPath);
// //         await this.db!.executeSql(
// //           "DELETE FROM chunks WHERE fileId = ? AND chunkIndex = ?",
// //           [fileId, i]
// //         );
// //       }
// //       Logger.info(`Assembled file ${fileName} at ${finalPath}`);
// //       return finalPath;
// //     } catch (error) {
// //       Logger.error(
// //         `Failed to assemble file ${fileName} for fileId ${fileId}`,
// //         error
// //       );
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_WRITE_ERROR,
// //         `Failed to assemble file: ${
// //           error instanceof Error ? error.message : "Unknown error"
// //         }`
// //       );
// //     }
// //   }

// //   async clearChunks(fileId: string): Promise<void> {
// //     if (!this.db) {
// //       await this.initialize();
// //     }
// //     try {
// //       const [results] = await this.db!.executeSql(
// //         "SELECT tempPath FROM chunks WHERE fileId = ?",
// //         [fileId]
// //       );
// //       for (let i = 0; i < results.rows.length; i++) {
// //         const tempPath = results.rows.item(i).tempPath;
// //         if (await RNFS.exists(tempPath)) {
// //           await RNFS.unlink(tempPath);
// //         }
// //       }
// //       await this.db!.executeSql("DELETE FROM chunks WHERE fileId = ?", [
// //         fileId,
// //       ]);
// //       Logger.info(`Cleared chunks for fileId ${fileId}`);
// //     } catch (error) {
// //       Logger.error(`Failed to clear chunks for fileId ${fileId}`, error);
// //       throw new DropShareError(
// //         ERROR_CODES.DATABASE_WRITE_ERROR,
// //         `Failed to clear chunks: ${
// //           error instanceof Error ? error.message : "Unknown error"
// //         }`
// //       );
// //     }
// //   }
// // }

// // NetworkProvider.tsx
// // import React, { createContext, useContext, useState, useEffect } from "react";
// // import { HostServer, ClientServer } from "./Servers";
// // import useUsername from "../hooks/useUsername";
// // import { Logger } from "../utils/Logger";
// // import TCPSocket from "react-native-tcp-socket";
// // import { Vibration } from "react-native";

// // import { HostSharing } from "./HostSharing";
// // import { ClientSharing } from "./ClientSharing";

// // interface TransferProgress {
// //   fileId: string;
// //   fileName: string;
// //   progress: string;
// //   speed: string;
// //   percentage: number;
// //   error?: string;
// // }

// // interface NetworkContextType {
// //   devices: Device[];
// //   socket: TCPSocket.Server | TCPSocket.Socket | null;
// //   messages: string[];
// //   receivedFiles: string[];
// //   sentFiles: { id: number; name: string; size: number }[];
// //   isHostConnected: boolean;
// //   isClientConnected: boolean;
// //   isHost: boolean;
// //   startHosting: () => void;
// //   startClient: () => void;
// //   connectToHostIp: (ip: string) => void;
// //   sendMessage: (message: string) => void;
// //   sendFiles: (files: { filePath: string }[]) => void;
// //   disconnect: () => void;
// //   stopHosting: () => void;
// //   kickClient: (clientIp: string) => void;
// //   stopClient: () => void;
// //   disconnectFromHost: () => void;
// //   transferProgress: TransferProgress[];
// // }

// // const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

// // export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({
// //   children,
// // }) => {
// //   const [devices, setDevices] = useState<Device[]>([]);
// //   const [socket, setSocket] = useState<
// //     TCPSocket.Server | TCPSocket.Socket | null
// //   >(null);
// //   const [messages, setMessages] = useState<string[]>([]);
// //   const [receivedFiles, setReceivedFiles] = useState<string[]>([]);
// //   const [sentFiles, setSentFiles] = useState<
// //     { id: number; name: string; size: number }[]
// //   >([]);
// //   const [isHostConnected, setIsHostConnected] = useState(false);
// //   const [isClientConnected, setIsClientConnected] = useState(false);
// //   const [isHost, setIsHost] = useState(false);
// //   const [transferProgress, setTransferProgress] = useState<TransferProgress[]>(
// //     []
// //   );
// //   const { username } = useUsername();
// //   const { sendMessageInHost, sendFilesInHost } = HostSharing();
// //   const { sendFilesInClient, sendMessageInClient } = ClientSharing();
// //   const { startHostServer, stopHostServer, kickClient, connectedSockets } =
// //     HostServer();
// //   const {
// //     startClientDiscovery,
// //     stopClientServer,
// //     connectToHost,
// //     disconnectFromHost,
// //   } = ClientServer();

// //   const startHosting = () => {
// //     setIsHost(true);
// //     startHostServer(
// //       username,
// //       setDevices,
// //       setSocket as React.Dispatch<
// //         React.SetStateAction<TCPSocket.Server | null>
// //       >,
// //       setMessages,
// //       setIsHostConnected,
// //       setReceivedFiles,
// //       setTransferProgress
// //     ).then(() => {
// //       Vibration.vibrate(100);
// //       Logger.toast("Started hosting", "info");
// //     });
// //   };

// //   const startClient = () => {
// //     setIsHost(false);
// //     startClientDiscovery(setDevices).then(() => {
// //       Vibration.vibrate(100);
// //       Logger.toast("Started client discovery", "info");
// //     });
// //   };

// //   const connectToHostIp = (ip: string) => {
// //     connectToHost(
// //       ip,
// //       username,
// //       setIsClientConnected,
// //       setSocket as React.Dispatch<
// //         React.SetStateAction<TCPSocket.Socket | null>
// //       >,
// //       setMessages,
// //       setReceivedFiles,
// //       setTransferProgress
// //     ).then(() => {
// //       Vibration.vibrate(100);
// //       Logger.toast(`Connected to host ${ip}`, "info");
// //     });
// //   };

// //   const sendMessageHandler = (message: string) => {
// //     if (!socket) {
// //       Logger.toast("No active socket to send message", "error");
// //       return;
// //     }
// //     if (isHost) {
// //       sendMessageInHost(message, username, connectedSockets);
// //     } else {
// //       sendMessageInClient(
// //         socket as TCPSocket.Socket,
// //         message,
// //         username,
// //         connectedSockets
// //       );
// //     }
// //     setMessages((prev) => [
// //       ...prev,
// //       `${isHost ? "Host" : "Client"}: ${message}`,
// //     ]);
// //   };

// //   const sendFilesHandler = async (files: { filePath: string }[]) => {
// //     if (!socket) {
// //       Logger.toast("No active socket to send files", "error");
// //       return;
// //     }
// //     if (isHost) {
// //       await sendFilesInHost(
// //         socket as TCPSocket.Server,
// //         files,
// //         username,
// //         connectedSockets,
// //         setTransferProgress
// //       );
// //     } else {
// //       await sendFilesInClient(
// //         socket as TCPSocket.Socket,
// //         files,
// //         username,
// //         connectedSockets,
// //         setTransferProgress
// //       );
// //     }
// //     setSentFiles((prev) => [
// //       ...prev,
// //       ...files.map(({ filePath }) => ({
// //         id: Date.now(),
// //         name: filePath.split("/").pop() || "unknown",
// //         size: 0, // Size not available without RNFS.stat; consider adding if needed
// //       })),
// //     ]);
// //     Logger.toast(`Sent ${files.length} files`, "info");
// //   };

// //   const disconnect = () => {
// //     if (isHost) {
// //       stopHosting();
// //     } else {
// //       disconnectFromHostHandler();
// //     }
// //   };

// //   const stopHosting = () => {
// //     stopHostServer();
// //     setSocket(null);
// //     setIsHost(false);
// //     setDevices([]);
// //     setMessages([]);
// //     setReceivedFiles([]);
// //     setSentFiles([]);
// //     setTransferProgress([]);
// //     Logger.toast("Host server stopped", "info");
// //   };

// //   const kickClientHandler = (clientIp: string) => {
// //     if (isHost) {
// //       kickClient(clientIp);
// //       setDevices((prev) => prev.filter((d) => d.ip !== clientIp));
// //       Logger.info(`Kicked client ${clientIp} via NetworkProvider`);
// //       Logger.toast(`Kicked client ${clientIp}`, "info");
// //     }
// //   };

// //   const stopClientHandler = () => {
// //     stopClientServer();
// //     setDevices([]);
// //     Logger.toast("Client discovery stopped", "info");
// //   };

// //   const disconnectFromHostHandler = () => {
// //     disconnectFromHost(
// //       setIsClientConnected,
// //       setSocket as React.Dispatch<
// //         React.SetStateAction<TCPSocket.Socket | null>
// //       >,
// //       setMessages,
// //       setReceivedFiles,
// //       setTransferProgress
// //     );
// //     Logger.toast("Disconnected from host", "info");
// //   };

// //   useEffect(() => {
// //     return () => {
// //       disconnect();
// //     };
// //   }, []);

// //   const value: NetworkContextType = {
// //     devices,
// //     socket,
// //     messages,
// //     receivedFiles,
// //     sentFiles,
// //     isHostConnected,
// //     isClientConnected,
// //     isHost,
// //     startHosting,
// //     startClient,
// //     connectToHostIp,
// //     sendMessage: sendMessageHandler,
// //     sendFiles: sendFilesHandler,
// //     disconnect,
// //     stopHosting,
// //     kickClient: kickClientHandler,
// //     stopClient: stopClientHandler,
// //     disconnectFromHost: disconnectFromHostHandler,
// //     transferProgress,
// //   };

// //   return (
// //     <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
// //   );
// // };

// // export const useNetwork = (): NetworkContextType => {
// //   const context = useContext(NetworkContext);
// //   if (!context) {
// //     throw new Error("useNetwork must be used within a NetworkProvider");
// //   }
// //   return context;
// // };

// // Servers.ts ( not to be changed just for your reference)
// // import dgram from "react-native-udp";
// // import {
// //   getLocalIPAddress,
// //   getBroadcastIPAddress,
// // } from "../utils/NetworkUtils";
// // import { Buffer } from "buffer";
// // import { Logger } from "../utils/Logger";
// // import { ERROR_CODES } from "../utils/Error";
// // import TCPSocket from "react-native-tcp-socket";
// // import { HostSharing } from "./HostSharing";
// // import { ClientSharing } from "./ClientSharing";

// // const UDP_PORT = 5000;
// // const TCP_PORT = 6000;
// // const MAX_CLIENTS = 5;
// // const APP_ID = "Dropshare_shubham-mishra";

// // type UdpSocket = ReturnType<typeof dgram.createSocket>;
// // interface ConnectedSocket extends TCPSocket.Socket {}

// // let connectedSockets: ConnectedSocket[] = [];
// // let isServerRunning = false;
// // let udpSocket: UdpSocket | null = null;
// // let server: TCPSocket.Server | null = null;
// // let clientSocket: TCPSocket.Socket | null = null;

// // export const HostServer = () => {
// //   async function startHostServer(
// //     username: string,
// //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>,
// //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Server | null>>,
// //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// //     setIsHostConnected: React.Dispatch<React.SetStateAction<boolean>>,
// //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): Promise<void> {
// //     if (isServerRunning) {
// //       Logger.info("Host server already running, skipping start.");
// //       return;
// //     }
// //     isServerRunning = true;

// //     try {
// //       const ip = await getLocalIPAddress();
// //       const broadcastAddr = await getBroadcastIPAddress();
// //       Logger.info(
// //         `Host started on IP: ${ip}, Broadcasting to: ${broadcastAddr}`
// //       );

// //       udpSocket = dgram.createSocket({ type: "udp4" });
// //       udpSocket.bind(UDP_PORT);

// //       udpSocket.once("listening", () => {
// //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// //         udpSocket!.setBroadcast(true);
// //         const broadcastInterval = setInterval(() => {
// //           const message = JSON.stringify({
// //             appId: APP_ID,
// //             role: "Host",
// //             ip,
// //             name: username,
// //           });
// //           udpSocket!.send(
// //             Buffer.from(message),
// //             0,
// //             message.length,
// //             UDP_PORT,
// //             broadcastAddr,
// //             (err) => {
// //               if (err) Logger.error("UDP Send Error", err);
// //             }
// //           );
// //         }, 2000);

// //         udpSocket!.on("close", () => clearInterval(broadcastInterval));
// //       });

// //       udpSocket.on("error", (err: Error) => {
// //         Logger.error("UDP Socket Error", err);
// //         isServerRunning = false;
// //         udpSocket?.close();
// //         udpSocket = null;
// //       });

// //       server = new TCPSocket.Server();
// //       server.on("connection", (socket: ConnectedSocket) => {
// //         if (connectedSockets.length >= MAX_CLIENTS) {
// //           socket.write(
// //             Buffer.from(`ERROR:${ERROR_CODES.MAX_CLIENTS_REACHED}\n`)
// //           );
// //           socket.destroy();
// //           Logger.warn("Max clients reached, rejecting new connection");
// //           return;
// //         }

// //         Logger.info(`Client connected: ${socket.remoteAddress}`);
// //         connectedSockets.push(socket);
// //         setIsHostConnected(true);
// //         setSocket(server);
// //         socket.once("data", (data) => {
// //           try {
// //             const message = data.toString();
// //             if (message.startsWith("USERNAME:")) {
// //               const clientUsername = message.replace("USERNAME:", "").trim();
// //               setDevices((prev) => [
// //                 ...prev.filter((d) => d.ip !== socket.remoteAddress),
// //                 {
// //                   ip: socket.remoteAddress || "Unknown",
// //                   name: clientUsername || "Unknown",
// //                   role: "Client",
// //                 },
// //               ]);
// //             } else {
// //               Logger.warn(
// //                 `Unexpected initial message from ${socket.remoteAddress}: ${message}`
// //               );
// //             }
// //           } catch (err) {
// //             Logger.error("Error processing client username", err);
// //             setDevices((prev) => [
// //               ...prev.filter((d) => d.ip !== socket.remoteAddress),
// //               {
// //                 ip: socket.remoteAddress || "Unknown",
// //                 name: "Unknown",
// //                 role: "Client",
// //               },
// //             ]);
// //           }
// //           socket.on("data", (data) => {
// //             const { receiveFileInHost } = HostSharing();
// //             receiveFileInHost({
// //               data,
// //               setMessages,
// //               setReceivedFiles,
// //               socket,
// //               connectedSockets,
// //               setTransferProgress,
// //             });
// //           });
// //         });

// //         socket.on("close", () => {
// //           Logger.info(`Client disconnected: ${socket.remoteAddress}`);
// //           connectedSockets = connectedSockets.filter((s) => s !== socket);
// //           setDevices((prev) =>
// //             prev.filter((d) => d.ip !== socket.remoteAddress)
// //           );
// //           setIsHostConnected(false);
// //         });

// //         socket.on("error", (err) => {
// //           Logger.error(`Host Socket Error for ${socket.remoteAddress}`, err);
// //         });
// //       });

// //       server.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
// //         Logger.info(`Host TCP server running on port ${TCP_PORT}`);
// //       });

// //       server.on("error", (err) => {
// //         Logger.error("Server Error", err);
// //         stopHostServer();
// //       });

// //       server.on("close", () => {
// //         Logger.info("Host TCP server closed");
// //         isServerRunning = false;
// //       });
// //     } catch (err) {
// //       Logger.error("Failed to start host server", err);
// //       isServerRunning = false;
// //       stopHostServer();
// //     }
// //   }

// //   function stopHostServer(): void {
// //     Logger.info("Stopping host server...");
// //     connectedSockets.forEach((socket) => socket.destroy());
// //     connectedSockets = [];
// //     if (server) {
// //       server.close();
// //       server = null;
// //       Logger.info("Host TCP server stopped");
// //     }
// //     if (udpSocket) {
// //       udpSocket.close();
// //       udpSocket = null;
// //       Logger.info("Host UDP socket closed");
// //     }
// //     isServerRunning = false;
// //   }

// //   function kickClient(clientIp: string): void {
// //     connectedSockets.forEach((socket) => {
// //       if (socket.remoteAddress === clientIp) {
// //         socket.destroy();
// //       }
// //     });
// //   }

// //   return {
// //     startHostServer,
// //     stopHostServer,
// //     kickClient,
// //     connectedSockets,
// //   };
// // };

// // export const ClientServer = () => {
// //   async function startClientDiscovery(
// //     setDevices: React.Dispatch<React.SetStateAction<Device[]>>
// //   ): Promise<void> {
// //     try {
// //       const localIP = await getLocalIPAddress();
// //       Logger.info("Client Discovery Started...");

// //       udpSocket = dgram.createSocket({ type: "udp4" });
// //       udpSocket.bind(UDP_PORT);

// //       udpSocket.on("listening", () => {
// //         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
// //         udpSocket!.setBroadcast(true);
// //       });

// //       udpSocket.on("message", (msg: Buffer, rinfo) => {
// //         try {
// //           const data = JSON.parse(msg.toString());
// //           if (data.appId !== APP_ID) {
// //             return;
// //           }
// //           if (data.ip !== localIP && data.role === "Host") {
// //             setDevices((prev) => [
// //               ...prev.filter((device) => device.ip !== data.ip),
// //               {
// //                 ip: data.ip,
// //                 name: data.name || "Unknown Host",
// //                 role: "Host",
// //               },
// //             ]);
// //           }
// //         } catch (error) {
// //           Logger.error("Error parsing UDP message", error);
// //         }
// //       });

// //       udpSocket.on("error", (err: Error) => {
// //         Logger.error("UDP Socket Error", err);
// //         stopClientDiscovery();
// //       });
// //     } catch (err) {
// //       Logger.error("Failed to start client discovery", err);
// //       stopClientDiscovery();
// //     }
// //   }

// //   function stopClientDiscovery(): void {
// //     Logger.info("Stopping client discovery...");
// //     if (udpSocket) {
// //       udpSocket.close();
// //       udpSocket = null;
// //       Logger.info("UDP socket closed");
// //     }
// //   }

// //   async function connectToHost(
// //     ip: string,
// //     username: string,
// //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): Promise<void> {
// //     Logger.info(`Connecting to host at ${ip}...`);
// //     const client = new TCPSocket.Socket();
// //     clientSocket = client;

// //     client.on("connect", () => {
// //       Logger.info("Connected to host!");
// //       setConnected(true);
// //       setSocket(client);
// //       client.write(Buffer.from(`USERNAME:${username}\n`));
// //     });

// //     client.on("data", (data: string | Buffer) => {
// //       const { receiveFileInClient } = ClientSharing();
// //       receiveFileInClient({
// //         client,
// //         data,
// //         ip,
// //         setMessages,
// //         setReceivedFiles,
// //         connectedSockets,
// //         setTransferProgress,
// //       });
// //     });

// //     client.on("close", () => {
// //       Logger.info("Disconnected from host");
// //       disconnectFromHost(
// //         setConnected,
// //         setSocket,
// //         setMessages,
// //         setReceivedFiles,
// //         setTransferProgress
// //       );
// //     });

// //     client.on("error", (err) => {
// //       Logger.error("Client Socket Error", err);
// //       disconnectFromHost(
// //         setConnected,
// //         setSocket,
// //         setMessages,
// //         setReceivedFiles,
// //         setTransferProgress
// //       );
// //     });

// //     client.connect({ port: TCP_PORT, host: ip });
// //   }

// //   function disconnectFromHost(
// //     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
// //     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
// //     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
// //     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
// //     setTransferProgress?: React.Dispatch<
// //       React.SetStateAction<TransferProgress[]>
// //     >
// //   ): void {
// //     Logger.info("Disconnecting from host...");
// //     if (clientSocket) {
// //       clientSocket.end();
// //       clientSocket = null;
// //       Logger.info("Client socket closed");
// //     }
// //     setConnected(false);
// //     setSocket(null);
// //     setMessages([]);
// //     setReceivedFiles([]);
// //     setTransferProgress?.([]);
// //     Logger.info("Disconnected from host");
// //   }

// //   function stopClientServer(): void {
// //     if (clientSocket) {
// //       clientSocket.end();
// //       clientSocket = null;
// //       Logger.info("Client server stopped");
// //     }
// //   }

// //   return {
// //     startClientDiscovery,
// //     connectToHost,
// //     disconnectFromHost,
// //     stopClientServer,
// //   };
// // };

// // working without proper chunkstorage (for single chunk)

// import dgram from "react-native-udp";
// import {
//   getLocalIPAddress,
//   getBroadcastIPAddress,
// } from "../utils/NetworkUtils";
// import { Buffer } from "buffer";
// import { Logger } from "../utils/Logger";
// import { ERROR_CODES } from "../utils/Error";
// import TCPSocket from "react-native-tcp-socket";
// import { ClientSharing, HostSharing } from "./Sharing";

// const UDP_PORT = 5000;
// const TCP_PORT = 6000;
// const MAX_CLIENTS = 5;
// const APP_ID = "Dropshare_shubham-mishra";

// type UdpSocket = ReturnType<typeof dgram.createSocket>;
// interface ConnectedSocket extends TCPSocket.Socket {}

// let connectedSockets: ConnectedSocket[] = [];
// let isServerRunning = false;
// let udpSocket: UdpSocket | null = null;
// let server: TCPSocket.Server | null = null;
// let clientSocket: TCPSocket.Socket | null = null;

// export const HostServer = () => {
//   async function startHostServer(
//     username: string,
//     setDevices: React.Dispatch<React.SetStateAction<Device[]>>,
//     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Server | null>>,
//     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
//     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
//     setIsHostConnected: React.Dispatch<React.SetStateAction<boolean>>,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     if (isServerRunning) {
//       Logger.info("Host server already running, skipping start.");
//       return;
//     }
//     isServerRunning = true;

//     try {
//       const ip = await getLocalIPAddress();
//       const broadcastAddr = await getBroadcastIPAddress();
//       Logger.info(
//         `Host started on IP: ${ip}, Broadcasting to: ${broadcastAddr}`
//       );

//       udpSocket = dgram.createSocket({ type: "udp4" });
//       udpSocket.bind(UDP_PORT);

//       udpSocket.once("listening", () => {
//         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
//         udpSocket!.setBroadcast(true);
//         const broadcastInterval = setInterval(() => {
//           const message = JSON.stringify({
//             appId: APP_ID,
//             role: "Host",
//             ip,
//             name: username,
//           });
//           udpSocket!.send(
//             Buffer.from(message),
//             0,
//             message.length,
//             UDP_PORT,
//             broadcastAddr,
//             (err) => {
//               if (err) Logger.error("UDP Send Error", err);
//             }
//           );
//         }, 2000);

//         udpSocket!.on("close", () => clearInterval(broadcastInterval));
//       });

//       udpSocket.on("error", (err: Error) => {
//         Logger.error("UDP Socket Error", err);
//         isServerRunning = false;
//         udpSocket?.close();
//         udpSocket = null;
//       });

//       server = new TCPSocket.Server();
//       server.on("connection", (socket: ConnectedSocket) => {
//         if (connectedSockets.length >= MAX_CLIENTS) {
//           socket.write(
//             Buffer.from(`ERROR:${ERROR_CODES.MAX_CLIENTS_REACHED}\n`)
//           );
//           socket.destroy();
//           Logger.warn("Max clients reached, rejecting new connection");
//           return;
//         }

//         Logger.info(`Client connected: ${socket.remoteAddress}`);
//         setIsHostConnected(true);
//         connectedSockets.push(socket);
//         setSocket(server);
//         socket.once("data", (data) => {
//           try {
//             const message = data.toString();
//             if (message.startsWith("USERNAME:")) {
//               const clientUsername = message.replace("USERNAME:", "").trim();
//               setDevices((prev) => [
//                 ...prev.filter((d) => d.ip !== socket.remoteAddress),
//                 {
//                   ip: socket.remoteAddress || "Unknown",
//                   name: clientUsername || "Unknown",
//                   role: "Client",
//                 },
//               ]);
//             } else {
//               Logger.warn(
//                 `Unexpected initial message from ${socket.remoteAddress}: ${message}`
//               );
//               setIsHostConnected(false);
//             }
//           } catch (err) {
//             Logger.error("Error processing client username", err);
//             setDevices((prev) => [
//               ...prev.filter((d) => d.ip !== socket.remoteAddress),
//               {
//                 ip: socket.remoteAddress || "Unknown",
//                 name: "Unknown",
//                 role: "Client",
//               },
//             ]);
//             setIsHostConnected(false);
//           }
//           socket.on("data", (data) => {
//             const { receiveFileInHost } = HostSharing();
//             receiveFileInHost({
//               data,
//               setMessages,
//               setReceivedFiles,
//               socket,
//               connectedSockets,
//               setTransferProgress,
//             });
//           });
//         });

//         socket.on("close", () => {
//           Logger.info(`Client disconnected: ${socket.remoteAddress}`);
//           connectedSockets = connectedSockets.filter((s) => s !== socket);
//           setDevices((prev) =>
//             prev.filter((d) => d.ip !== socket.remoteAddress)
//           );
//           setIsHostConnected(false);
//         });

//         socket.on("error", (err) => {
//           Logger.error(`Host Socket Error for ${socket.remoteAddress}`, err);
//         });
//       });

//       server.listen({ port: TCP_PORT, host: "0.0.0.0" }, () => {
//         Logger.info(`Host TCP server running on port ${TCP_PORT}`);
//       });

//       server.on("error", (err) => {
//         Logger.error("Server Error", err);
//         stopHostServer();
//       });

//       server.on("close", () => {
//         Logger.info("Host TCP server closed");
//         isServerRunning = false;
//       });
//     } catch (err) {
//       Logger.error("Failed to start host server", err);
//       isServerRunning = false;
//       stopHostServer();
//     }
//   }

//   function stopHostServer(): void {
//     Logger.info("Stopping host server...");
//     connectedSockets.forEach((socket) => socket.destroy());
//     connectedSockets = [];
//     if (server) {
//       server.close();
//       server = null;
//       Logger.info("Host TCP server stopped");
//     }
//     if (udpSocket) {
//       udpSocket.close();
//       udpSocket = null;
//       Logger.info("Host UDP socket closed");
//     }
//     isServerRunning = false;
//   }

//   function kickClient(clientIp: string): void {
//     connectedSockets.forEach((socket) => {
//       if (socket.remoteAddress === clientIp) {
//         socket.destroy();
//       }
//     });
//   }

//   return {
//     startHostServer,
//     stopHostServer,
//     kickClient,
//     connectedSockets,
//   };
// };

// export const ClientServer = () => {
//   async function startClientDiscovery(
//     setDevices: React.Dispatch<React.SetStateAction<Device[]>>
//   ): Promise<void> {
//     try {
//       const localIP = await getLocalIPAddress();
//       Logger.info("Client Discovery Started...");

//       udpSocket = dgram.createSocket({ type: "udp4" });
//       udpSocket.bind(UDP_PORT);

//       udpSocket.on("listening", () => {
//         Logger.info(`UDP Socket bound to port ${UDP_PORT}`);
//         udpSocket!.setBroadcast(true);
//       });

//       udpSocket.on("message", (msg: Buffer, rinfo) => {
//         try {
//           const data = JSON.parse(msg.toString());
//           if (data.appId !== APP_ID) {
//             return;
//           }
//           if (data.ip !== localIP && data.role === "Host") {
//             setDevices((prev) => [
//               ...prev.filter((device) => device.ip !== data.ip),
//               {
//                 ip: data.ip,
//                 name: data.name || "Unknown Host",
//                 role: "Host",
//               },
//             ]);
//           }
//         } catch (error) {
//           Logger.error("Error parsing UDP message", error);
//         }
//       });

//       udpSocket.on("error", (err: Error) => {
//         Logger.error("UDP Socket Error", err);
//         stopClientDiscovery();
//       });
//     } catch (err) {
//       Logger.error("Failed to start client discovery", err);
//       stopClientDiscovery();
//     }
//   }

//   function stopClientDiscovery(): void {
//     Logger.info("Stopping client discovery...");
//     if (udpSocket) {
//       udpSocket.close();
//       udpSocket = null;
//       Logger.info("UDP socket closed");
//     }
//   }

//   async function connectToHost(
//     ip: string,
//     username: string,
//     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
//     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
//     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
//     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): Promise<void> {
//     Logger.info(`Connecting to host at ${ip}...`);
//     const client = new TCPSocket.Socket();
//     clientSocket = client;

//     client.on("connect", () => {
//       Logger.info("Connected to host!");
//       setConnected(true);
//       setSocket(client);
//       client.write(Buffer.from(`USERNAME:${username}\n`));
//     });

//     client.on("data", (data: string | Buffer) => {
//       const { receiveFileInClient } = ClientSharing();
//       receiveFileInClient({
//         client,
//         data,
//         ip,
//         setMessages,
//         setReceivedFiles,
//         connectedSockets,
//         setTransferProgress,
//       });
//     });

//     client.on("close", () => {
//       Logger.info("Disconnected from host");
//       disconnectFromHost(
//         setConnected,
//         setSocket,
//         setMessages,
//         setReceivedFiles,
//         setTransferProgress
//       );
//     });

//     client.on("error", (err) => {
//       Logger.error("Client Socket Error", err);
//       disconnectFromHost(
//         setConnected,
//         setSocket,
//         setMessages,
//         setReceivedFiles,
//         setTransferProgress
//       );
//     });

//     client.connect({ port: TCP_PORT, host: ip });
//   }

//   function disconnectFromHost(
//     setConnected: React.Dispatch<React.SetStateAction<boolean>>,
//     setSocket: React.Dispatch<React.SetStateAction<TCPSocket.Socket | null>>,
//     setMessages: React.Dispatch<React.SetStateAction<string[]>>,
//     setReceivedFiles: React.Dispatch<React.SetStateAction<string[]>>,
//     setTransferProgress?: React.Dispatch<
//       React.SetStateAction<TransferProgress[]>
//     >
//   ): void {
//     Logger.info("Disconnecting from host...");
//     if (clientSocket) {
//       clientSocket.end();
//       clientSocket = null;
//       Logger.info("Client socket closed");
//     }
//     setConnected(false);
//     setSocket(null);
//     setMessages([]);
//     setReceivedFiles([]);
//     setTransferProgress?.([]);
//     Logger.info("Disconnected from host");
//   }

//   function stopClientServer(): void {
//     if (clientSocket) {
//       clientSocket.end();
//       clientSocket = null;
//       Logger.info("Client server stopped");
//     }
//   }

//   return {
//     startClientDiscovery,
//     connectToHost,
//     disconnectFromHost,
//     stopClientServer,
//   };
// };

// non unified

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
    setMessages: React.Dispatch<React.SetStateAction<string[]>>,
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
