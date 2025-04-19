import { Dimensions } from "react-native";

export const screenHeight = Dimensions.get("screen").height;
export const screenWidth = Dimensions.get("screen").width;

export const MAX_CLIENTS = 5;
export const UDP_PORT = 5000;
export const BROADCAST_INTERVAL = 2000;
export const ERROR_CODES = {
  MAX_CLIENTS_REACHED: "MAX_CLIENTS_REACHED",
  INVALID_IP_ADDRESS: "INVALID_IP_ADDRESS",
  CONNECTION_REFUSED: "CONNECTION_REFUSED",
  HOST_NOT_FOUND: "HOST_NOT_FOUND",
  TIMEOUT: "TIMEOUT",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
};

export const FILE_TYPES = {
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  PDF: "pdf",
};

export const FILE_EXTENSIONS = {
  [FILE_TYPES.IMAGE]: ["jpg", "jpeg", "png", "gif", "bmp", "tiff", "ico"],
  [FILE_TYPES.VIDEO]: ["mp4", "avi", "mov", "wmv", "flv", "mpeg", "mpg"],
  [FILE_TYPES.AUDIO]: ["mp3", "wav", "ogg", "m4a", "aac", "wma"],
  [FILE_TYPES.PDF]: ["pdf"],
};
