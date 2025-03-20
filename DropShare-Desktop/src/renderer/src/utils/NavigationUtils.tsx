import os from "os";

export interface Device {
  address: string;
  name: string;
}

export const getLocalIPAddress = () => {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    if (iface) {
      for (const config of iface) {
        if (config.family === "IPv4" && !config.internal) {
          return config.address;
        }
      }
    }
  }
  return "0.0.0.0";
};

export const setLastBlockTo255 = (ip: string): string => {
  const parts = ip.split(".").map(Number);
  parts[3] = 255;
  return parts.join(".");
};

export const getBroadcastIPAddress = async (): Promise<string | null> => {
  try {
    const ip = getLocalIPAddress();
    return setLastBlockTo255(ip || "255.255.255.255");
  } catch (error) {
    console.error("Error getting broadcast address:", error);
    return null;
  }
};
