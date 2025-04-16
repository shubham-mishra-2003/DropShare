// import { ToastAndroid } from "react-native";

// export class Logger {
//   static info(message: string): void {
//     console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
//   }

//   static error(message: string, error?: unknown): void {
//     const errorMsg =
//       error instanceof Error ? error.message : String(error) || "Unknown error";
//     const stack = error instanceof Error ? error.stack : undefined;
//     console.error(
//       `[ERROR] ${new Date().toISOString()} - ${message} ${errorMsg}`,
//       { stack }
//     );
//     if (typeof ToastAndroid !== "undefined") {
//       ToastAndroid.showWithGravity(
//         `Error: ${message} - ${errorMsg}`,
//         ToastAndroid.SHORT,
//         ToastAndroid.CENTER
//       );
//     }
//   }

//   static warn(message: string): void {
//     console.warn(`[WARN] ${new Date().toISOString()} - ${message}`);
//   }

//   static toast(message: string, type: "info" | "warn" | "error"): void {
//     if (typeof ToastAndroid !== "undefined") {
//       ToastAndroid.showWithGravity(
//         `[${type.toUpperCase()}] ${message}`,
//         ToastAndroid.SHORT,
//         ToastAndroid.CENTER
//       );
//       console.log(
//         `[TOAST:${type.toUpperCase()}] ${new Date().toISOString()} - ${message}`
//       );
//     }
//   }
// }

export class Logger {
  static info(message: string): void {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
  }

  static error(message: string, error?: unknown): void {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error);
  }

  static warn(message: string): void {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`);
  }

  static toast(message: string, type: "info" | "error" | "warn"): void {
    console.log(`[TOAST:${type.toUpperCase()}] ${message}`);
  }
}
