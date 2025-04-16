import Toast from "../components/Toast";

export class Logger {
  static info(message: string): void {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
  }

  static error(message: string, error?: unknown): void {
    const errorMsg =
      error instanceof Error ? error.message : String(error) || "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error(
      `[ERROR] ${new Date().toISOString()} - ${message} ${errorMsg}`,
      { stack },
    );
    Toast({ message: `Error: ${message} - ${errorMsg}`, type: "error" });
  }

  static warn(message: string): void {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`);
  }

  static toast(message: string, type: "info" | "warn" | "error"): void {
    Toast({ message, type: type as "error" | "success" });
  }
}
