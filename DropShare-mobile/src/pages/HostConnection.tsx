// import {
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   StatusBar,
//   ScrollView,
//   Image,
// } from "react-native";
// import React, { FC, useEffect, useState } from "react";
// import { useTheme } from "../hooks/ThemeProvider";
// import { Colors } from "../constants/Colors";
// import Icon from "../components/Icon";
// import { icons, images } from "../assets";
// import MediaPicker from "../components/MediaPicker";
// import { formatFileSize } from "../utils/FileSystemUtil";
// import BreakerText from "../components/ui/BreakerText";
// import RNFS from "react-native-fs";
// import { Buffer } from "buffer";
// import { sendHostFile, sendHostMessage } from "../service/HostServer";
// import { resetAndNavigate } from "../utils/NavigationUtil";
// import { connectionStyles } from "./ClientConnection";
// import { Device } from "../utils/networkUtils";

// const HostConnection: FC = ({ route }: any) => {
//   const {
//     socket,
//     devices,
//     messages: initialMessages,
//     receivedFiles: initialReceivedFiles,
//   } = route.params;
//   const { colorScheme } = useTheme();
//   const [fileSelectorOpen, setFileSelectorOpen] = useState(false);
//   const styles = connectionStyles(colorScheme);

//   const [messages, setMessages] = useState<string[]>(initialMessages || []);
//   const [receivedFiles, setReceivedFiles] = useState<string[]>(
//     initialReceivedFiles || []
//   );
//   const [activeTab, setActiveTab] = useState<"Sent" | "Received">("Sent");
//   const [selectToSend, setSelectToSend] = useState<RNFS.ReadDirItem[]>([]);
//   const [sentFiles, setSentFiles] = useState<any[]>([]);

//   const handleSendFile = async () => {
//     if (!selectToSend.length || !socket) return;
//     try {
//       for (const file of selectToSend) {
//         const fileData = await RNFS.readFile(file.path, "base64");
//         const buffer = Buffer.from(fileData, "base64");
//         sendHostFile(socket, file.name, buffer);
//         setSentFiles((prev) => [
//           ...prev,
//           { id: Date.now(), name: file.name, size: buffer.length },
//         ]);
//       }
//       setSelectToSend([]); // Clear selection after sending
//     } catch (error) {
//       console.error("Error sending files:", error);
//     }
//   };

//   const handleSendMessage = () => {
//     if (socket) {
//       sendHostMessage(socket, "Hello from Host");
//       setMessages([...messages, "Hello from Host"]);
//     }
//   };

//   const handleDisconnect = () => {
//     if (socket) socket.close();
//     resetAndNavigate("home");
//   };

//   useEffect(() => {
//     if (selectToSend.length > 0) handleSendFile();
//   }, [selectToSend]);

//   return (
//     <View style={styles.main}>
//       <View style={styles.container}>
//         <View style={styles.header}>
//           <TouchableOpacity
//             style={styles.headerButton}
//             onPress={() => resetAndNavigate("home")}
//           >
//             <Icon source={icons.back} filter={1} height={20} width={20} />
//           </TouchableOpacity>
//           <View
//             style={{
//               flexDirection: "row",
//               gap: 5,
//               alignItems: "center",
//               justifyContent: "center",
//             }}
//           >
//             <Icon source={images.logo} height={40} width={40} filter={0} />
//             <Text style={{ color: Colors[colorScheme].text }}>DropShare</Text>
//           </View>
//           <TouchableOpacity
//             style={styles.headerButton}
//             onPress={handleDisconnect}
//           >
//             <Icon source={icons.disConnect} filter={1} height={20} width={25} />
//           </TouchableOpacity>
//         </View>
//         <View
//           style={{
//             gap: 5,
//             justifyContent: "center",
//             flexDirection: "row",
//             marginBottom: 20,
//           }}
//         >
//           <Text
//             style={{
//               color: Colors[colorScheme].text,
//               fontSize: 15,
//               fontWeight: "bold",
//             }}
//           >
//             Connected Clients:
//           </Text>
//           {devices.map((device: Device, index: number) => (
//             <Text
//               key={index}
//               style={{
//                 color: Colors[colorScheme].tint,
//                 fontSize: 15,
//                 fontWeight: "bold",
//               }}
//             >
//               {device.name} ({device.ip})
//             </Text>
//           ))}
//         </View>
//         <View style={styles.fileContainer}>
//           <View style={styles.sendReceiveContainer}>
//             <View style={styles.selectedFileButtonContainer}>
//               <TouchableOpacity
//                 onPress={() => setActiveTab("Sent")}
//                 style={[
//                   styles.sendReceiveButton,
//                   {
//                     backgroundColor:
//                       activeTab === "Sent"
//                         ? Colors[colorScheme].tint
//                         : Colors[colorScheme].background,
//                   },
//                 ]}
//               >
//                 <Icon source={icons.sent} height={25} width={25} filter={1} />
//                 <Text style={{ color: Colors[colorScheme].text }}>Sent</Text>
//               </TouchableOpacity>
//               <TouchableOpacity
//                 onPress={() => setActiveTab("Received")}
//                 style={[
//                   styles.sendReceiveButton,
//                   {
//                     backgroundColor:
//                       activeTab === "Received"
//                         ? Colors[colorScheme].tint
//                         : Colors[colorScheme].background,
//                   },
//                 ]}
//               >
//                 <Icon
//                   source={icons.received}
//                   height={25}
//                   width={25}
//                   filter={1}
//                 />
//                 <Text style={{ color: Colors[colorScheme].text }}>
//                   Received
//                 </Text>
//               </TouchableOpacity>
//             </View>
//           </View>
//           <BreakerText
//             text={activeTab === "Sent" ? "Sent files" : "Received files"}
//           />
//           {(activeTab === "Sent" ? sentFiles.length : receivedFiles.length) >
//           0 ? (
//             <ScrollView contentContainerStyle={styles.fileList}>
//               {(activeTab === "Sent" ? sentFiles : receivedFiles).map(
//                 (item: any) => (
//                   <View style={styles.fileItem} key={item.id}>
//                     <Text style={{ color: Colors[colorScheme].text }}>
//                       {item.name}
//                     </Text>
//                     <Text style={{ color: Colors[colorScheme].text }}>
//                       {formatFileSize(item.size)}
//                     </Text>
//                   </View>
//                 )
//               )}
//             </ScrollView>
//           ) : (
//             <View style={styles.noDataContainer}>
//               <Text style={{ color: Colors[colorScheme].text, marginTop: 10 }}>
//                 {activeTab === "Sent"
//                   ? "No files sent yet"
//                   : "No files received yet"}
//               </Text>
//             </View>
//           )}
//         </View>
//         <View style={styles.selectedFileContainer}>
//           <BreakerText text="selected files" />
//           {selectToSend ? (
//             <ScrollView contentContainerStyle={styles.fileList}>
//               {selectToSend.map((file) => (
//                 <View style={styles.selectedFileItem}>
//                   <View
//                     style={{
//                       flexDirection: "row",
//                       justifyContent: "center",
//                       alignItems: "center",
//                       gap: 5,
//                     }}
//                   >
//                     <Image
//                       src={`file://${file.path}`}
//                       height={40}
//                       width={40}
//                       resizeMode="cover"
//                     />
//                     <Text style={{ color: Colors[colorScheme].text }}>
//                       {file.name}
//                     </Text>
//                   </View>
//                   <Text style={{ color: Colors[colorScheme].text }}>
//                     {formatFileSize(file.size)}
//                   </Text>
//                 </View>
//               ))}
//             </ScrollView>
//           ) : (
//             <View style={{ flex: 1, alignItems: "center" }}>
//               <Text
//                 style={{
//                   color: Colors[colorScheme].text,
//                   textAlign: "center",
//                   marginTop: 10,
//                 }}
//               >
//                 No files Selected
//               </Text>
//             </View>
//           )}
//           <TouchableOpacity
//             onPress={handleSendFile}
//             style={{
//               backgroundColor: Colors[colorScheme].tint,
//               padding: 10,
//               borderRadius: 20,
//               width: "70%",
//             }}
//           >
//             <Text
//               style={{
//                 color: Colors[colorScheme].text,
//                 textAlign: "center",
//                 fontSize: 18,
//               }}
//             >
//               Send
//             </Text>
//           </TouchableOpacity>
//         </View>
//       </View>
//       <View style={{ justifyContent: "center", alignItems: "center" }}>
//         <TouchableOpacity
//           style={{
//             backgroundColor: Colors[colorScheme].tint,
//             paddingVertical: 10,
//             paddingHorizontal: 30,
//             borderRadius: 20,
//           }}
//           onPress={() => setFileSelectorOpen(true)}
//         >
//           <Text style={{ fontSize: 18, color: Colors[colorScheme].text }}>
//             Select Files
//           </Text>
//         </TouchableOpacity>
//       </View>
//       <MediaPicker
//         selectToSend={selectToSend}
//         setSelectToSend={setSelectToSend}
//         visible={fileSelectorOpen}
//         setVisible={() => setFileSelectorOpen(false)}
//       />
//       <StatusBar
//         backgroundColor={Colors[colorScheme].background}
//         barStyle="default"
//       />
//     </View>
//   );
// };

// export default HostConnection;

// HostConnection.tsx
import React, { FC, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  FlatList,
} from "react-native";
import { useTheme } from "../hooks/ThemeProvider";
import { Colors } from "../constants/Colors";
import Icon from "../components/Icon";
import { icons, images } from "../assets";
import MediaPicker from "../components/MediaPicker";
import { formatFileSize } from "../utils/FileSystemUtil";
import BreakerText from "../components/ui/BreakerText";
import RNFS from "react-native-fs";
import { Buffer } from "buffer";
import { resetAndNavigate } from "../utils/NavigationUtil";
import { useNetwork } from "../service/NetworkProvider";
import { connectionStyles } from "../constants/Styles";
import StyledText from "../components/ui/StyledText";
import LinearGradient from "react-native-linear-gradient";
import DropShareModal from "../components/ui/Modal";
import MessageView from "../components/MessageView";

const HostConnection: FC = () => {
  const { colorScheme } = useTheme();
  const styles = connectionStyles(colorScheme);
  const {
    devices,
    messages,
    receivedFiles,
    sentFiles,
    sendMessage,
    sendFiles,
    disconnect,
    isHost,
    isHostConnected,
    isClientConnected,
  } = useNetwork();

  const [fileSelectorOpen, setFileSelectorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"Sent" | "Received">("Sent");
  const [selectToSend, setSelectToSend] = useState<RNFS.ReadDirItem[]>([]);

  const handleSendFile = async () => {
    if (!selectToSend.length) return;
    try {
      for (const file of selectToSend) {
        const fileData = await RNFS.readFile(file.path, "base64");
        const buffer = Buffer.from(fileData, "base64");
        sendFiles([{ filePath: file.path, fileData: buffer }]);
      }
      setSelectToSend([]);
    } catch (error) {
      console.error("Error sending files:", error);
    }
  };

  const handleSendMessage = () => {
    sendMessage("Hello from Host");
  };

  const [messageView, setMessageView] = useState(false);

  useEffect(() => {
    if (isHost) {
      if (!isHostConnected) {
        resetAndNavigate("home");
      }
    } else {
      if (!isClientConnected) {
        resetAndNavigate("home");
      }
    }
  }, [isHostConnected, isClientConnected, isHost]);

  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      colors={Colors[colorScheme].linearGradientColors}
      style={styles.main}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => resetAndNavigate("home")}
        >
          <Icon source={icons.back} filter={1} height={20} width={20} />
        </TouchableOpacity>
        <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
          <Icon source={images.logo} height={40} width={40} filter={0} />
          <StyledText fontSize={20} fontWeight="bold" text="DropShare" />
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={disconnect}>
          <Icon source={icons.disConnect} filter={1} height={20} width={25} />
        </TouchableOpacity>
      </View>
      <View
        style={{
          gap: 10,
          justifyContent: "space-between",
          flexDirection: isHost ? "column" : "row",
          alignItems: isHost ? "flex-start" : "center",
        }}
      >
        <StyledText
          fontSize={29}
          fontWeight="bold"
          text={isHost ? "Connected Clients : " : "Connected to : "}
        />
        <FlatList
          data={devices}
          renderItem={({ item }) => (
            <StyledText
              style={{ textAlign: "center" }}
              key={item.ip}
              fontSize={20}
              fontWeight="bold"
            >
              {item.name}
            </StyledText>
          )}
        />
        {isHost && (
          <FlatList
            data={devices}
            scrollEnabled
            style={{ height: 150 }}
            contentContainerStyle={{ gap: 5 }}
            renderItem={({ item }) => (
              <View
                key={item.ip}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  width: "100%",
                  alignItems: "center",
                  gap: 5,
                  padding: 10,
                  backgroundColor: Colors[colorScheme].itemBackground,
                  borderRadius: 20,
                }}
              >
                <StyledText
                  style={{ textAlign: "center" }}
                  key={item.ip}
                  fontSize={20}
                  fontWeight="bold"
                >
                  {item.name}
                </StyledText>
                <TouchableOpacity
                  style={{
                    padding: 5,
                    backgroundColor: Colors[colorScheme].transparent,
                    borderRadius: 50,
                  }}
                >
                  <Icon
                    filter={1}
                    height={20}
                    width={20}
                    source={icons.cross}
                  />
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>
      <ScrollView scrollEnabled showsHorizontalScrollIndicator={false}>
        {sentFiles.length > 0 ||
          (receivedFiles.length > 0 && (
            <View style={styles.fileContainer}>
              <View style={styles.sendReceiveContainer}>
                <View style={styles.selectedFileButtonContainer}>
                  <TouchableOpacity
                    onPress={() => setActiveTab("Sent")}
                    style={[
                      styles.sendReceiveButton,
                      {
                        backgroundColor:
                          activeTab === "Sent"
                            ? Colors[colorScheme].tint
                            : Colors[colorScheme].background,
                      },
                    ]}
                  >
                    <Icon
                      source={icons.sent}
                      height={25}
                      width={25}
                      filter={1}
                    />
                    <StyledText text="Sent" fontSize={18} fontWeight="bold" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setActiveTab("Received")}
                    style={[
                      styles.sendReceiveButton,
                      {
                        backgroundColor:
                          activeTab === "Received"
                            ? Colors[colorScheme].tint
                            : Colors[colorScheme].background,
                      },
                    ]}
                  >
                    <Icon
                      source={icons.received}
                      height={25}
                      width={25}
                      filter={1}
                    />
                    <StyledText
                      text="Recieved"
                      fontSize={18}
                      fontWeight="bold"
                    />
                  </TouchableOpacity>
                </View>
              </View>
              <BreakerText
                text={activeTab === "Sent" ? "Sent files" : "Received files"}
              />
              {(activeTab === "Sent"
                ? sentFiles.length
                : receivedFiles.length) > 0 ? (
                <View style={{ gap: 3 }}>
                  {(activeTab === "Sent" ? sentFiles : receivedFiles).map(
                    (item: any) => (
                      <ScrollView style={styles.fileItem} key={item.id}>
                        <StyledText
                          text={item.name}
                          fontSize={16}
                          fontWeight="bold"
                        />
                        <StyledText
                          text={formatFileSize(item.size)}
                          fontSize={16}
                          fontWeight="bold"
                        />
                      </ScrollView>
                    )
                  )}
                </View>
              ) : (
                <StyledText
                  fontSize={20}
                  fontWeight="bold"
                  style={{ textAlign: "center" }}
                  text={
                    activeTab === "Sent"
                      ? "No files sent yet"
                      : "No files received yet"
                  }
                />
              )}
            </View>
          ))}
        {selectToSend.length > 0 && (
          <View style={styles.selectedFileContainer}>
            <BreakerText text="selected files" />
            {selectToSend.length > 0 ? (
              <FlatList
                scrollEnabled
                contentContainerStyle={{ gap: 5, flex: 1 }}
                data={selectToSend}
                renderItem={({ item }) => (
                  <View style={styles.selectedFileItem} key={item.path}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Image
                        src={`file://${item.path}`}
                        height={40}
                        width={40}
                        resizeMode="cover"
                      />
                      <StyledText
                        text={item.name}
                        fontSize={16}
                        fontWeight="semi-bold"
                      />
                    </View>
                    <StyledText
                      text={formatFileSize(item.size)}
                      fontSize={20}
                      fontWeight="semi-bold"
                    />
                  </View>
                )}
              />
            ) : (
              <View style={{ flex: 1, alignItems: "center" }}>
                <StyledText
                  fontSize={20}
                  fontWeight="bold"
                  style={{
                    textAlign: "center",
                  }}
                  text="No files Selected"
                />
              </View>
            )}
          </View>
        )}
      </ScrollView>
      <View
        style={{
          justifyContent: "space-evenly",
          alignItems: "center",
          flexDirection: "row",
          gap: 15,
        }}
      >
        {selectToSend.length > 0 && (
          <TouchableOpacity
            style={{
              backgroundColor: Colors[colorScheme].tint,
              paddingVertical: 10,
              width: "40%",
              borderRadius: 20,
            }}
            onPress={() => handleSendFile()}
          >
            <StyledText
              text="Send"
              style={{ textAlign: "center" }}
              fontSize={22}
              fontWeight="bold"
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={{
            backgroundColor: Colors[colorScheme].tint,
            paddingVertical: 10,
            width: "40%",
            borderRadius: 20,
          }}
          onPress={() => setFileSelectorOpen(true)}
        >
          <StyledText
            text="Select to send"
            style={{ textAlign: "center" }}
            fontSize={22}
            fontWeight="bold"
          />
        </TouchableOpacity>
      </View>
      <MediaPicker
        selectToSend={selectToSend}
        setSelectToSend={setSelectToSend}
        visible={fileSelectorOpen}
        setVisible={() => setFileSelectorOpen(false)}
      />
      <TouchableOpacity
        style={styles.messageButton}
        onPress={() => setMessageView(true)}
      >
        <Icon source={icons.message} filter={1} height={30} width={30} />
      </TouchableOpacity>
      <DropShareModal
        visible={messageView}
        onRequestClose={() => setMessageView(false)}
      >
        <MessageView setMessageView={setMessageView} />
      </DropShareModal>
    </LinearGradient>
  );
};

export default HostConnection;
