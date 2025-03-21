import { produce } from "immer";
import { Alert } from "react-native";
import { useChunkStore } from "../db/chunkStorage";
import { Buffer } from "buffer";
import { Toast } from "../components/Toasts";

export const receiveFileAck = async (
  data: any,
  socket: any,
  setReceivedFiles: any
) => {
  const { setChunkStore, chunkStore } = useChunkStore.getState();
  if (chunkStore) {
    Alert.alert("Ongoing file transfer, wait for one to be ended");
    return;
  }

  setReceivedFiles((prevData: any) =>
    produce(prevData, (draft: any) => {
      draft.push(data);
    })
  );

  setChunkStore({
    id: data?.id,
    totalChunks: data?.totalChunks,
    name: data?.name,
    size: data?.size,
    mimeType: data?.mimeType,
    chunkArray: [],
  });

  if (!socket) {
    console.log("Socket not available");
    return;
  }

  try {
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 10));
    console.log("File received, requesting first chunk...");
    socket.write(JSON.stringify({ event: "send_chunk_ack", chunkNo: 0 }));
  } catch (error) {
    console.error("Error requesting first chunk: ", error);
  }
};

export const sendChunkAck = async (
  chunkIndex: number,
  socket: any,
  setSentFiles: any,
  setTotalSentBytes: any
) => {
  const { currentChunkSet, resetCurrentChunkSet } = useChunkStore.getState();
  if (!currentChunkSet) {
    Alert.alert("No chunks to be sent");
    return;
  }

  if (!socket) {
    console.error("Socket not available");
    return;
  }

  const totalChunks = currentChunkSet?.totalChunks;

  try {
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 10));

    socket.write(
      JSON.stringify({
        event: "receive_chunk_ack",
        chunk: currentChunkSet.chunkArray[chunkIndex]?.toString("base64"),
        chunkNo: chunkIndex,
      })
    );

    setTotalSentBytes(
      (prev: number) => prev + currentChunkSet.chunkArray[chunkIndex]?.length
    );

    if (chunkIndex + 1 >= totalChunks) {
      console.log("All chunks sent successfully");
      setSentFiles((prevFiles: any) =>
        produce(prevFiles, (draftFiles: any) => {
          const fileIndex = draftFiles.findIndex(
            (f: any) => f.id === currentChunkSet.id
          );
          if (fileIndex !== -1) {
            draftFiles[fileIndex].available = true;
          }
        })
      );
      resetCurrentChunkSet();
    }
  } catch (error) {
    Toast(`Error sending chunk: ${error}`);
  }
};

export const receiveChunkAck = async (
  chunk: string,
  chunkNo: number,
  socket: any,
  setTotalReceivedBytes: any,
  generateFile: any
) => {
  const { chunkStore, resetChunkStore, setChunkStore } =
    useChunkStore.getState();

  if (!chunkStore) {
    console.log("Chunk store is full");
    return;
  }

  try {
    const bufferChunk = Buffer.from(chunk, "base64");
    const updatedChunkArray = [...(chunkStore.chunkArray || [])];
    updatedChunkArray[chunkNo] = bufferChunk;

    setChunkStore({ ...chunkStore, chunkArray: updatedChunkArray });
    setTotalReceivedBytes(
      (prevValue: number) => prevValue + bufferChunk.length
    );
  } catch (error) {
    console.log("Error updating chunk: ", error);
  }

  if (!socket) {
    console.log("Socket not available");
    return;
  }

  if (chunkNo + 1 === chunkStore.totalChunks) {
    console.log("All chunks received, generating file...");
    generateFile();
    resetChunkStore();
    return;
  }

  try {
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 10));
    console.log("Requesting next chunk", chunkNo + 1);
    socket.write(
      JSON.stringify({ event: "send_chunk_ack", chunkNo: chunkNo + 1 })
    );
  } catch (error) {
    Toast(`Error requesting next chunk: ${error}`);
  }
};
