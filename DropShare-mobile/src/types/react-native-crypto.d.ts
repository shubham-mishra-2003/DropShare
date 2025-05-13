import { Buffer } from "buffer";

declare module "react-native-crypto" {
  export function createHash(algorithm: string): {
    update(data: string | Buffer): any;
    digest(encoding: "hex" | "base64" | "binary"): string;
  };
  export function getRandomValues<T extends ArrayBufferView | null>(array: T): T;
}
