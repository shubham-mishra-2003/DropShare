import { ToastAndroid } from "react-native";
export class Logger {
  static info(message: string): void {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
  }
  static error(message: string, error?: unknown): void {
    let errorMsg: string;
    try {
      errorMsg =
        error instanceof Error
          ? error.message
          : JSON.stringify(error, null, 2) || "Unknown error";
    } catch {
      errorMsg = String(error) || "Unknown error";
    }
    const stack = error instanceof Error ? error.stack : undefined;
    const truncatedMsg =
      errorMsg.length > 100 ? `${errorMsg.slice(0, 97)}...` : errorMsg;
    console.error(
      `[ERROR] ${new Date().toISOString()} - ${message}: ${truncatedMsg}`,
      stack ? { stack } : {}
    );
    if (typeof ToastAndroid !== "undefined") {
      ToastAndroid.showWithGravity(
        `Error: ${message} - ${truncatedMsg}`,
        ToastAndroid.SHORT,
        ToastAndroid.CENTER
      );
    }
  }
  static warn(message: string): void {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`);
  }
  static debug(message: string): void {
    console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`);
  }
  static toast(message: string, type: "info" | "warn" | "error"): void {
    if (typeof ToastAndroid !== "undefined") {
      const truncatedMsg =
        message.length > 50 ? `${message.slice(0, 47)}...` : message;
      ToastAndroid.showWithGravity(
        `[${type.toUpperCase()}] ${truncatedMsg}`,
        ToastAndroid.SHORT,
        ToastAndroid.CENTER
      );
      console.log(
        `[TOAST:${type.toUpperCase()}] ${new Date().toISOString()} - ${message}`
      );
    }
  }
}
