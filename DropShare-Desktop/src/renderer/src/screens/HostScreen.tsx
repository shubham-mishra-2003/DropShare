import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "../hooks/ThemeProvider";
import { useNetwork } from "../hooks/NetworkProvider";
import Lottie from "lottie-web";
import AnimationData from "../../src/assets/animations/scan.json";
import { images } from "../assets";
import Header from "../components/Header";

const HostScreen: React.FC = () => {
  const { colorScheme } = useTheme();
  const {
    devices,
    messages,
    receivedFiles,
    startHosting,
    sendMessage,
    sendFile,
    // stopHosting,
  } = useNetwork();
  const [message, setMessage] = useState("");
  const lottieContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lottieContainer.current) {
      Lottie.loadAnimation({
        container: lottieContainer.current,
        renderer: "svg",
        loop: true,
        autoplay: true,
        animationData: AnimationData,
      });
    }
    return () => Lottie.destroy();
  }, []);

  const handleSendMessage = () => {
    if (message.trim()) {
      sendMessage(message);
      setMessage("");
    }
  };

  const handleSendFile = async () => {
    const result = await window.electron.selectFile();
    if (result) {
      const { filePath, fileData } = result;
      sendFile(filePath, fileData);
    }
  };

  return (
    <div className="min-h-screen p-0 flex flex-col items-center">
      <Header icon={true} title="Host Dashboard" backButton={stopHosting} />
      <div className="flex gap-10 justify-center items-center">
        <button
          onClick={() => startHosting()}
          className="px-6 py-3 cursor-pointer bg-blue-500/80 text-white rounded-full shadow-lg hover:bg-blue-600/80 transition-all backdrop-blur-sm"
        >
          Start Hosting
        </button>
      </div>
      <div className="w-full max-w-3xl space-y-8">
        <section>
          <h2
            className={`text-2xl font-semibold mb-4 ${colorScheme === "dark" ? "text-white" : "text-gray-800"}`}
          >
            Connected Devices
          </h2>
          <div className="space-y-4">
            {devices.length ? (
              devices.map((device) => (
                <div
                  key={device.ip}
                  className="p-4 rounded-xl shadow-md bg-white/10 backdrop-blur-md border border-gray-200/20 flex justify-between items-center"
                >
                  <span
                    className={`${colorScheme === "dark" ? "text-gray-200" : "text-gray-700"}`}
                  >
                    {device.name} ({device.ip})
                  </span>
                </div>
              ))
            ) : (
              <p
                className={`${colorScheme === "dark" ? "text-gray-400" : "text-gray-500"}`}
              >
                No devices connected yet
              </p>
            )}
          </div>
        </section>

        <div className="h-full w-full flex justify-center items-center">
          <div className="lottie-container" ref={lottieContainer}></div>
          <img src={images.logo} className="profile-image" alt="Logo" />
        </div>

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
          </div>
          <button
            onClick={handleSendFile}
            className="mt-4 px-6 py-3 bg-green-500/80 text-white rounded-full shadow-md hover:bg-green-600/80 transition-all backdrop-blur-sm"
          >
            Send File
          </button>
        </section>
      </div>
    </div>
  );
};

export default HostScreen;
