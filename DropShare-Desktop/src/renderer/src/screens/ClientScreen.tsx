import React, { useState, useEffect } from "react";
import { useTheme } from "../hooks/ThemeProvider";
import { useNetwork } from "../hooks/NetworkProvider";

const ClientScreen: React.FC = () => {
  const { colorScheme } = useTheme();
  const {
    devices,
    messages,
    receivedFiles,
    connectToHostIp,
    sendMessage,
    sendFile,
    startClient,
    isConnected,
    disconnect,
    stopHosting,
  } = useNetwork();
  const [message, setMessage] = useState("");

  useEffect(() => {
    console.log("ClientScreen: Devices updated:", devices);
  }, [devices]);

  console.log("ClientScreen: Rendering with devices:", devices);

  const handleSendMessage = () => {
    if (message.trim()) {
      sendMessage(message);
      setMessage("");
    }
  };

  const handleSendFile = async () => {
    const file = await window.electron.selectFile();
    if (file) sendFile(file.filePath, file.fileData);
  };

  return (
    <div className="min-h-screen p-6 flex flex-col items-center">
      <h1
        className={`text-4xl font-extrabold mb-8 ${colorScheme === "dark" ? "text-white" : "text-gray-900"} drop-shadow-lg`}
      >
        Client Dashboard
      </h1>
      <button onClick={stopHosting}>Stop discovery</button>
      {!isConnected ? (
        <div className="w-full max-w-3xl space-y-8">
          <button
            onClick={() => startClient()}
            className="px-6 py-3 bg-blue-500/80 text-white rounded-full shadow-md hover:bg-blue-600/80 transition-all backdrop-blur-sm"
          >
            Discover Hosts
          </button>
          <section>
            <h2
              className={`text-2xl font-semibold mb-4 ${colorScheme === "dark" ? "text-white" : "text-gray-800"}`}
            >
              Available Hosts
            </h2>
            <div className="space-y-4">
              {devices.filter((d) => d.role === "Host").length ? (
                devices
                  .filter((d) => d.role === "Host")
                  .map((device) => (
                    <button
                      key={device.ip}
                      onClick={() => {
                        connectToHostIp(device.ip);
                        console.log("Found: ", device.ip);
                      }}
                      className="p-4 rounded-xl shadow-md bg-white/10 backdrop-blur-md border border-gray-200/20 cursor-pointer hover:bg-white/20 transition-all"
                    >
                      <span
                        className={`${colorScheme === "dark" ? "text-gray-200" : "text-gray-700"}`}
                      >
                        {device.name} ({device.ip})
                      </span>
                    </button>
                  ))
              ) : (
                <p
                  className={`${colorScheme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                >
                  No hosts found
                </p>
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="w-full max-w-3xl space-y-8">
          <section>
            <h2
              className={`text-2xl font-semibold mb-4 ${colorScheme === "dark" ? "text-white" : "text-gray-800"}`}
            >
              Messages
            </h2>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {messages.length ? (
                messages.map((msg, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-white/10 backdrop-blur-md border border-gray-200/20"
                  >
                    <span
                      className={`${colorScheme === "dark" ? "text-gray-200" : "text-gray-700"} text-sm`}
                    >
                      {msg}
                    </span>
                  </div>
                ))
              ) : (
                <p
                  className={`${colorScheme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                >
                  No messages
                </p>
              )}
            </div>
            <div className="mt-4 flex items-center space-x-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                className={`flex-1 p-3 rounded-lg bg-white/10 backdrop-blur-md border border-gray-200/20 ${colorScheme === "dark" ? "text-white placeholder-gray-400" : "text-gray-900 placeholder-gray-500"} focus:outline-none`}
              />
              <button
                onClick={handleSendMessage}
                className="px-4 py-2 bg-blue-500/80 text-white rounded-full shadow-md hover:bg-blue-600/80 transition-all backdrop-blur-sm"
              >
                Send
              </button>
            </div>
          </section>

          <section>
            <h2
              className={`text-2xl font-semibold mb-4 ${colorScheme === "dark" ? "text-white" : "text-gray-800"}`}
            >
              Received Files
            </h2>
            <div className="space-y-4">
              {receivedFiles.length ? (
                receivedFiles.map((file, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-white/10 backdrop-blur-md border border-gray-200/20"
                  >
                    <span
                      className={`${colorScheme === "dark" ? "text-gray-200" : "text-gray-700"} text-sm`}
                    >
                      {file.split(/[\\/]/).pop()}
                    </span>
                  </div>
                ))
              ) : (
                <p
                  className={`${colorScheme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                >
                  No files received
                </p>
              )}
              {/* {transferProgress && (
                <div className="p-3 rounded-lg bg-white/10 backdrop-blur-md border border-gray-200/20">
                  <span
                    className={`${colorScheme === "dark" ? "text-gray-200" : "text-gray-700"} text-sm`}
                  >
                    {transferProgress.fileName}: {transferProgress.progress} @{" "}
                    {transferProgress.speed}
                  </span>
                </div>
              )} */}
            </div>
            <button
              onClick={handleSendFile}
              className="mt-4 px-6 py-3 bg-green-500/80 text-white rounded-full shadow-md hover:bg-green-600/80 transition-all backdrop-blur-sm"
            >
              Send File
            </button>
          </section>

          <button
            onClick={disconnect}
            className="px-6 py-3 bg-red-500/80 text-white rounded-full shadow-md hover:bg-red-600/80 transition-all backdrop-blur-sm"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export default ClientScreen;
