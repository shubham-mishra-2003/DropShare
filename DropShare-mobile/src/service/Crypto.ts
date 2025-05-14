import Aes from "react-native-aes-crypto";
import { Buffer } from "buffer";
import { Logger } from "../utils/Logger";
import { DropShareError, ERROR_CODES } from "../utils/Error";

export interface EncryptionResult {
  encryptedData: Buffer;
  iv: Buffer;
  key: Buffer;
}

export class CryptoUtil {
  static async generateKeyAndIV(): Promise<{ key: Buffer; iv: Buffer }> {
    try {
      const keyBase64 = await Aes.randomKey(48);
      const ivBase64 = await Aes.randomKey(24);
      Logger.debug(
        `Raw key Base64: ${keyBase64.slice(0, 20)}... (length: ${
          keyBase64.length
        })`
      );
      Logger.debug(
        `Raw IV Base64: ${ivBase64.slice(0, 20)}... (length: ${
          ivBase64.length
        })`
      );

      const keyFull = Buffer.from(keyBase64, "base64");
      const ivFull = Buffer.from(ivBase64, "base64");
      Logger.debug(`Decoded key length: ${keyFull.length} bytes`);
      Logger.debug(`Decoded IV length: ${ivFull.length} bytes`);

      const key = keyFull.slice(0, 32);
      const iv = ivFull.slice(0, 16);

      if (keyFull.length < 32) {
        throw new Error(
          `Generated key too short: expected at least 32 bytes, got ${keyFull.length}`
        );
      }
      if (ivFull.length < 16) {
        throw new Error(
          `Generated IV too short: expected at least 16 bytes, got ${ivFull.length}`
        );
      }
      if (key.length !== 32) {
        throw new Error(
          `Truncated key length invalid: expected 32 bytes, got ${key.length}`
        );
      }
      if (iv.length !== 16) {
        throw new Error(
          `Truncated IV length invalid: expected 16 bytes, got ${iv.length}`
        );
      }

      const keyHex = key.toString("hex");
      const ivHex = iv.toString("hex");
      Logger.info(`Generated key hex: ${keyHex.slice(0, 20)}...`);
      Logger.info(`Generated IV hex: ${ivHex.slice(0, 20)}...`);

      return { key, iv };
    } catch (error) {
      Logger.error(`Failed to generate key and IV: ${error}`, error);
      throw new DropShareError(
        ERROR_CODES.ENCRYPTION_ERROR,
        `Key generation failed: ${error}`
      );
    }
  }

  static async encryptChunk(
    data: Buffer,
    key: Buffer,
    iv: Buffer
  ): Promise<EncryptionResult> {
    try {
      if (!data || data.length === 0) {
        throw new Error("Data buffer is empty or invalid");
      }
      if (key.length !== 32) {
        throw new Error(
          `Invalid key length: expected 32 bytes, got ${key.length}`
        );
      }
      if (iv.length !== 16) {
        throw new Error(
          `Invalid IV length: expected 16 bytes, got ${iv.length}`
        );
      }

      const keyHex = key.toString("hex");
      const ivHex = iv.toString("hex");

      Logger.info(
        `Encrypting chunk: data length=${data.length}, key=${keyHex.slice(
          0,
          10
        )}..., iv=${ivHex.slice(0, 10)}...`
      );

      const encryptedBase64 = await Aes.encrypt(
        data.toString("base64"),
        keyHex,
        ivHex,
        "aes-256-cbc"
      );
      const encryptedData = Buffer.from(encryptedBase64, "base64");

      if (encryptedData.length % 16 !== 0) {
        throw new Error(
          `Invalid encrypted data length: ${encryptedData.length} bytes`
        );
      }

      return {
        encryptedData,
        iv,
        key,
      };
    } catch (error) {
      Logger.error(`Encryption failed: ${error}`, error);
      throw new DropShareError(
        ERROR_CODES.ENCRYPTION_ERROR,
        `Chunk encryption failed: ${error}`
      );
    }
  }

  static async decryptChunk(
    encryptedData: Buffer,
    key: Buffer,
    iv: Buffer
  ): Promise<Buffer> {
    try {
      if (!encryptedData || encryptedData.length === 0) {
        throw new Error("Encrypted data buffer is empty or invalid");
      }
      if (key.length !== 32) {
        throw new Error(
          `Invalid key length: expected 32 bytes, got ${key.length}`
        );
      }
      if (iv.length !== 16) {
        throw new Error(
          `Invalid IV length: expected 16 bytes, got ${iv.length}`
        );
      }
      if (encryptedData.length % 16 !== 0) {
        throw new Error(
          `Invalid encrypted data length: ${encryptedData.length} bytes`
        );
      }

      const keyHex = key.toString("hex");
      const ivHex = iv.toString("hex");

      Logger.info(
        `Decrypting chunk: data length=${
          encryptedData.length
        }, key=${keyHex.slice(0, 10)}..., iv=${ivHex.slice(0, 10)}...`
      );

      const decryptedBase64 = await Aes.decrypt(
        encryptedData.toString("base64"),
        keyHex,
        ivHex,
        "aes-256-cbc"
      );
      return Buffer.from(decryptedBase64, "base64");
    } catch (error) {
      Logger.error(`Decryption failed: ${error}`, error);
      throw new DropShareError(
        ERROR_CODES.ENCRYPTION_ERROR,
        `Chunk decryption failed: ${error}`
      );
    }
  }
}
