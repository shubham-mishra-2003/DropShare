import React, {
  createContext,
  FC,
  useCallback,
  useContext,
  useState,
} from "react";
import "react-native-get-random-values";
import { useChunkStore } from "../db/chunkStorage";
import TcpSocket from "react-native-tcp-socket";
import useUsername from "../hooks/useUsername";
import RNFS from "react-native-fs";
import { Buffer } from "buffer";
import { v4 as uuidv4 } from "uuid";
import { produce } from "immer";
import { receiveChunkAck, receiveFileAck, sendChunkAck } from "./TCPUtils";
import { Alert, Platform } from "react-native";

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

const options = {
  keystore: require("../tls_certs/server-keystore.p12"),
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

  const { username } = useUsername();

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

  const startServer = useCallback(
    (port: number) => {
      if (server) {
        console.log("Server running already...");
        return;
      }

      const newServer = TcpSocket.createTLSServer(options, (socket) => {
        console.log("ClientConnected: ", socket.address());

        setServerSocket(socket);
        socket.setNoDelay(true);
        socket.readableHighWaterMark = 1024 * 1024 * 1;
        socket.writableHighWaterMark = 1024 * 1024 * 1;

        socket.on("data", async (data) => {
          const parsedData = JSON.parse(data?.toString());
          if (parsedData?.event === "connect") {
            setIsConnected(true);
            setConnectedDevices(parsedData?.deviceName);
          }
          if (parsedData.event === "file_ack") {
            receiveFileAck(parsedData?.file, socket, setReceivedFiles);
          }
          if (parsedData.event === "send_chunk_ack") {
            sendChunkAck(
              parsedData?.chunkNo,
              socket,
              setTotalSentBytes,
              setSentFiles
            );
          }
          if (parsedData.event === "receive_chunk_ack") {
            receiveChunkAck(
              parsedData?.chunk,
              parsedData?.chunkNo,
              socket,
              setTotalReceivedBytes,
              generateFile
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
        console.log(`server running on ${address?.address}:${address?.port}`);
      });

      newServer.on("error", (error) => console.log("server error: ", error));
      setServer(newServer);
    },
    [server]
  );

  const connectToServer = useCallback(
    (host: string, port: number, deviceName = username) => {
      const newClient = TcpSocket.connectTLS(
        {
          host,
          port,
          cert: true,
          ca: require("../tls_certs/server-cert.pem"),
        },
        () => {
          setIsConnected(true);
          setConnectedDevices(deviceName);
          newClient.write(
            JSON.stringify({ event: "connect", deviceName: deviceName })
          );
        }
      );

      newClient.setNoDelay(true);
      newClient.readableHighWaterMark = 1024 * 1024 * 1;
      newClient.writableHighWaterMark = 1024 * 1024 * 1;

      newClient.on("data", async (data) => {
        const parsedData = JSON.parse(data?.toString());

        if (parsedData.event === "file_ack") {
          receiveFileAck(parsedData?.file, newClient, setReceivedFiles);
        }
        if (parsedData.event === "send_chunk_ack") {
          sendChunkAck(
            parsedData?.chunkNo,
            newClient,
            setTotalSentBytes,
            setSentFiles
          );
        }
        if (parsedData.event === "receive_chunk_ack") {
          receiveChunkAck(
            parsedData?.chunk,
            parsedData?.chunkNo,
            newClient,
            setTotalReceivedBytes,
            generateFile
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
    []
  );

  const generateFile = async () => {
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
      const platformPath = `${RNFS.ExternalStorageDirectoryPath}/Android/media/com.Dropshare/received`;
      const filePath = `${platformPath}/${chunkStore.name}`;

      await RNFS.writeFile(
        filePath,
        combinedChunks?.toString("base64"),
        "base64"
      );

      setReceivedFiles((prevFiles: any) =>
        produce(prevFiles, (draftFiles: any) => {
          const fileIndex = draftFiles?.findIndex(
            (f: any) => f.id === chunkStore.id
          );
          if (fileIndex !== -1) {
            draftFiles[fileIndex] = {
              ...draftFiles[fileIndex],
              uri: filePath,
              available: true,
            };
          }
        })
      );
      console.log("File saved", filePath);
      resetChunkStore();
    } catch (error) {
      console.log("Error in combining the chunks or saving the file", error);
    }
  };

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
    [client, server]
  );

  const sendFilesAck = async (file: any, type: "image" | "file") => {
    if (currentChunkSet != null) {
      Alert.alert("Wait for the current file to be sent");
      return;
    }
    const normalizedPath =
      Platform.OS === "ios" ? file?.uri?.replace("file://", "") : file?.uri;
    const fileData = await RNFS.readFile(normalizedPath, "base64");
    const buffer = Buffer.from(fileData, "base64");
    const ChunkSize = 1024 * 8;

    let totalChunks = 0;
    let offSet = 0;
    let chunkArray = [];

    while (offSet < buffer.length) {
      const chunk = buffer.slice(offSet, offSet + ChunkSize);
      totalChunks += 1;
      chunkArray.push(chunk);
      offSet += chunk.length;
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
      })
    );

    const socket = client || serverSocket;
    if (!socket) return;

    try {
      console.log("File acknowledge done");
      socket.write(JSON.stringify({ event: "file_ack", file: rawData }));
    } catch (error) {
      console.log("Error sending...", error);
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
