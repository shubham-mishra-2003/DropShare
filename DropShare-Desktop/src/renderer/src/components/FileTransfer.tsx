import React, { useState, useEffect } from "react";
import useUsername from "../hooks/useUsername";

const FileTransfer = () => {
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [devices, setDevices] = useState<{ address: string; name: string }[]>(
    [],
  );
  const [selectedDevice, setSelectedDevice] = useState<{
    address: string;
    name: string;
  } | null>(null);
  const { username } = useUsername();

  useEffect(() => {
    const fetchDevices = async () => {
      window.electron.getFoundDevices().then((devices) => setDevices(devices));
    };
    fetchDevices();
  }, []);

  const handleStartDiscovery = () => {
    setIsDiscovering(true);
    window.electron.startDiscovery(username).then(() => {
      console.log("Discovery started with username:", username);
    });
  };

  return (
    <div>
      <h2>Nearby Devices</h2>
      <button
        className="cursor-pointer p-3 bg-green-500 rounded-2xl"
        onClick={handleStartDiscovery}
        disabled={isDiscovering}
      >
        {isDiscovering ? "Discovering..." : "Start Discovery"}
      </button>
      <button
        className="cursor-pointer p-3 bg-red-500 rounded-2xl ml-2"
        disabled={!isDiscovering}
      >
        Stop Discovery
      </button>

      {devices.length > 0 ? (
        <ul>
          {devices.map((device) => (
            <li
              key={device.address}
              onClick={() => setSelectedDevice(device)}
              style={{
                cursor: "pointer",
                fontWeight:
                  selectedDevice?.address === device.address
                    ? "bold"
                    : "normal",
              }}
            >
              {device.name} - {device.address}
            </li>
          ))}
        </ul>
      ) : (
        "No Devices found nearby"
      )}
    </div>
  );
};

export default FileTransfer;
