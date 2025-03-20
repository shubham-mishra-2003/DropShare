import React, {
  createContext,
  FC,
  useCallback,
  useContext,
  useState,
} from "react";
import { useChunkStore } from "../db/chunkStorage";
import { Socket, createServer } from "net";
import fs from "fs";
import { Buffer } from "buffer";
import { v4 as uuidv4 } from "uuid";
import { produce } from "immer";
import Toast from "../components/Toast";
import {
  receiveChunkAck,
  receiveFileAck,
  sendChunkAck,
} from "../utils/TCPUtils";
import { ConnectionOptions, connect as tlsConnect } from "tls";
import path from "path";

interface TCPContextType {
  server: any;
  client: any;
  isConnected: boolean;
  connectedDevices: any;
  sentFiles: any;
  receivedFiles: any;
  totalSentBytes: number;
  totalReceivedBytes: number;
  startServer: (port: number) => void;
  connectToServer: (host: string, port: number, deviceName: string) => void;
  sendMessage: (message: string | Buffer) => void;
  sendFilesAck: (file: any, type: "file" | "image") => void;
  disconnect: () => void;
}

const TCPContext = createContext<TCPContextType | undefined>(undefined);

export const useTCP = (): TCPContextType => {
  const context = useContext(TCPContext);
  if (!context) {
    throw new Error("useTCP must be used within a TCPProvider");
  }
  return context;
};

export const TCPProvider: FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [server, setServer] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedDevices, setConnectedDevices] = useState<any>(null);
  const [serverSocket, setServerSocket] = useState<any>(null);
  const [sentFiles, setSentFiles] = useState<any>([]);
  const [receivedFiles, setReceivedFiles] = useState<any>(null);
  const [totalSentBytes, setTotalSentBytes] = useState<number>(0);
  const [totalReceivedBytes, setTotalReceivedBytes] = useState<number>(0);
  const { currentChunkSet, setCurrentChunkSet, setChunkStore } =
    useChunkStore();

  const disconnect = useCallback(() => {
    if (client) {
      client.destroy();
    }
    if (server) {
      server.close();
    }
    setReceivedFiles([]);
    setSentFiles([]);
    setCurrentChunkSet(null);
    setTotalReceivedBytes(0);
    setChunkStore(null);
    setIsConnected(false);
  }, [client, server]);

  const startServer = useCallback(() => {
    const port = 4000;
    if (server) {
      console.log("Server running already...");
      return;
    }
    const newServer = createServer((socket: Socket) => {
      console.log("Client Connected: ", socket.remoteAddress);
      setServerSocket(socket);
      socket.setNoDelay(true);

      socket.on("data", async (data) => {
        const parsedData = JSON.parse(data?.toString());
        if (parsedData?.event === "connect") {
          setIsConnected(true);
          setConnectedDevices({
            deviceName: parsedData?.deviceName,
            ip: socket.remoteAddress,
          });
        }
        if (parsedData.event === "file_ack") {
          receiveFileAck(parsedData?.file, socket, setReceivedFiles);
        }
        if (parsedData.event === "send_chunk_ack") {
          sendChunkAck(
            parsedData?.chunkNo,
            socket,
            setTotalSentBytes,
            setSentFiles,
          );
        }
        if (parsedData.event === "receive_chunk_ack") {
          receiveChunkAck(
            parsedData?.chunk,
            parsedData?.chunkNo,
            socket,
            setTotalReceivedBytes,
            generateFile,
          );
        }
      });

      socket.on("close", () => {
        console.log("Client Disconnected");
        setReceivedFiles([]);
        setSentFiles([]);
        setCurrentChunkSet(null);
        setTotalReceivedBytes(0);
        setChunkStore(null);
        setIsConnected(false);
        disconnect();
      });
      socket.on("error", (error) => console.error("Socket error: ", error));
    });

    newServer.listen({ port, host: "0.0.0.0" }, () => {
      const address = newServer.address();
      if (typeof address === "string") {
        console.log(`Server running on ${address}`);
      } else if (address && address.address && address.port) {
        console.log(`Server running on ${address.address}:${address.port}`);
      } else {
        console.error("Failed to retrieve server address.");
      }
    });

    newServer.on("error", (error) => console.log("server error: ", error));
    setServer(newServer);
  }, [server]);

  const connectToServer = useCallback(
    (host: string, port: number, deviceName: string) => {
      const tlsOptions: ConnectionOptions = {
        ca: fs.readFileSync("../tls_certs/server-cert.pem"),
        rejectUnauthorized: true,
      };

      const newClient = tlsConnect(port, host, tlsOptions, () => {
        setIsConnected(true);
        newClient.write(JSON.stringify({ event: "connect", deviceName }));
      });

      newClient.setNoDelay(true);

      newClient.on("data", async (data) => {
        const parsedData = JSON.parse(data?.toString());
        setConnectedDevices({
          deviceName: parsedData?.deviceName,
          ip: host,
        });

        if (parsedData.event === "file_ack") {
          receiveFileAck(parsedData?.file, newClient, setReceivedFiles);
        }
        if (parsedData.event === "send_chunk_ack") {
          sendChunkAck(
            parsedData?.chunkNo,
            newClient,
            setTotalSentBytes,
            setSentFiles,
          );
        }
        if (parsedData.event === "receive_chunk_ack") {
          receiveChunkAck(
            parsedData?.chunk,
            parsedData?.chunkNo,
            newClient,
            setTotalReceivedBytes,
            generateFile,
          );
        }
      });

      newClient.on("close", () => {
        console.log("Client Disconnected");
        setReceivedFiles([]);
        setSentFiles([]);
        setCurrentChunkSet(null);
        setTotalReceivedBytes(0);
        setChunkStore(null);
        setIsConnected(false);
        disconnect();
      });

      newClient.on("error", (error) => {
        console.log("Client error: ", error);
      });

      setClient(newClient);
    },
    [],
  );

  const generateFile = useCallback(async () => {
    const { chunkStore, resetChunkStore } = useChunkStore.getState();
    if (!chunkStore) {
      console.log("No chunks or files to process");
      return;
    }

    if (chunkStore?.totalChunks !== chunkStore.chunksArray.length) {
      console.log("Not all chunks have been received");
      return;
    }

    try {
      const combinedChunks = Buffer.concat(chunkStore.chunksArray);

      const platformPath = path.join(__dirname, "received");
      const filePath = path.join(platformPath, chunkStore.name);

      if (!fs.existsSync(platformPath)) {
        fs.mkdirSync(platformPath, { recursive: true });
      }

      await fs.promises.writeFile(filePath, combinedChunks);

      setReceivedFiles((prevFiles: any) =>
        produce(prevFiles, (draftFiles: any) => {
          const fileIndex = draftFiles?.findIndex(
            (f: any) => f.id === chunkStore.id,
          );
          if (fileIndex !== -1) {
            draftFiles[fileIndex] = {
              ...draftFiles[fileIndex],
              uri: filePath,
              available: true,
            };
          }
        }),
      );
      console.log("File saved", filePath);

      resetChunkStore();
    } catch (error) {
      console.log("Error in combining the chunks or saving the file", error);
    }
  }, []);

  const sendMessage = useCallback(
    (message: string | Buffer) => {
      if (client) {
        client.write(JSON.stringify(message));
        console.log("Sent from client", message);
      } else if (server) {
        serverSocket.write(JSON.stringify(message));
        console.log("Sent from server", message);
      } else {
        console.log("No client or server available");
      }
    },
    [client, server],
  );

  const sendFilesAck = async (file: any, type: "image" | "file") => {
    if (currentChunkSet != null) {
      Toast({
        type: "error",
        message: "Wait for the current file to be sent",
      });
      return;
    }

    try {
      const fileData = await fs.promises.readFile(file?.uri, {
        encoding: "base64",
      });
      const buffer = Buffer.from(fileData, "base64");

      const ChunkSize = 1024 * 8;
      let totalChunks = 0;
      let offset = 0;
      let chunkArray: Buffer[] = [];

      while (offset < buffer.length) {
        const chunk = buffer.slice(offset, offset + ChunkSize);
        totalChunks += 1;
        chunkArray.push(chunk);
        offset += chunk.length;
      }

      const rawData = {
        id: uuidv4(),
        name: type === "file" ? file?.name : file?.fileName,
        size: type === "file" ? file?.size : file?.fileSize,
        mimeType: type === "file" ? "file" : ".jpg",
        totalChunks,
      };

      setCurrentChunkSet({
        id: rawData?.id,
        chunkArray,
        totalChunks,
      });

      setSentFiles((prevData: any) =>
        produce(prevData, (draft: any) => {
          draft.push({ ...rawData, uri: file?.uri });
        }),
      );

      const socket = client || serverSocket;
      if (!socket) return;

      console.log("File acknowledge done");
      socket.write(JSON.stringify({ event: "file_ack", file: rawData }));
    } catch (error) {
      console.log("Error sending file acknowledgment:", error);
      Toast({
        type: "error",
        message: "Error sending file acknowledgment",
      });
    }
  };

  return (
    <TCPContext.Provider
      value={{
        server,
        client,
        isConnected,
        connectedDevices,
        sentFiles,
        sendMessage,
        sendFilesAck,
        receivedFiles,
        totalSentBytes,
        totalReceivedBytes,
        startServer,
        connectToServer,
        disconnect,
      }}
    >
      {children}
    </TCPContext.Provider>
  );
};
