// import CryptoJS from "crypto-js";
// import forge from "node-forge";
// import { Buffer } from "buffer";

// export interface AESKeyPair {
//   key: string;
//   iv: string;
// }

// export async function generateAESKey(): Promise<AESKeyPair> {
//   console.log("Generating AES key...");
//   try {
//     const key = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
//     const iv = CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
//     console.log(
//       "AES key generated:",
//       key.slice(0, 10) + "...",
//       "IV:",
//       iv.slice(0, 10) + "..."
//     );
//     return { key, iv };
//   } catch (error) {
//     console.error("Failed to generate AES key:", error);
//     throw new Error("AES key generation failed");
//   }
// }

// export async function generateRSAKeyPair(): Promise<{
//   publicKey: string;
//   privateKey: string;
// }> {
//   console.log("Generating RSA key pair...");
//   return new Promise((resolve, reject) => {
//     forge.pki.rsa.generateKeyPair({ bits: 2048 }, (err, keypair) => {
//       if (err) {
//         console.error("RSA key generation failed:", err);
//         return reject(err);
//       }
//       const result = {
//         publicKey: forge.pki.publicKeyToPem(keypair.publicKey),
//         privateKey: forge.pki.privateKeyToPem(keypair.privateKey),
//       };
//       console.log("RSA keys generated:", result.publicKey.slice(0, 50) + "...");
//       resolve(result);
//     });
//   });
// }

// export async function encryptAESKeyWithRSA(
//   aesKey: string,
//   publicKeyPem: string
// ): Promise<Buffer> {
//   console.log("Encrypting AES key with RSA...");
//   try {
//     const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
//     const encrypted = publicKey.encrypt(aesKey, "RSA-OAEP");
//     const buffer = Buffer.from(forge.util.encode64(encrypted), "base64");
//     console.log("AES key encrypted, length:", buffer.length);
//     return buffer;
//   } catch (error) {
//     console.error("Failed to encrypt AES key with RSA:", error);
//     throw error;
//   }
// }

// export async function decryptAESKeyWithRSA(
//   encryptedKey: Buffer,
//   privateKeyPem: string
// ): Promise<string> {
//   console.log(
//     "Decrypting AES key with RSA, encrypted length:",
//     encryptedKey.length
//   );
//   try {
//     const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
//     const encryptedBase64 = encryptedKey.toString("base64");
//     const decoded = forge.util.decode64(encryptedBase64);
//     const decrypted = privateKey.decrypt(decoded, "RSA-OAEP");
//     console.log("AES key decrypted successfully");
//     return decrypted;
//   } catch (error) {
//     console.error("Failed to decrypt AES key with RSA:", error);
//     throw error;
//   }
// }

// export async function encryptData(
//   data: Buffer,
//   key: string,
//   iv: string
// ): Promise<Buffer> {
//   console.log("Encrypting data, length:", data.length);
//   try {
//     const encrypted = CryptoJS.AES.encrypt(
//       data.toString("base64"),
//       CryptoJS.enc.Hex.parse(key),
//       {
//         iv: CryptoJS.enc.Hex.parse(iv),
//         mode: CryptoJS.mode.CBC,
//         padding: CryptoJS.pad.Pkcs7,
//       }
//     );
//     const result = Buffer.from(
//       encrypted.ciphertext.toString(CryptoJS.enc.Hex),
//       "hex"
//     );
//     console.log("Data encrypted, length:", result.length);
//     return result;
//   } catch (error) {
//     console.error("Failed to encrypt data:", error);
//     throw error;
//   }
// }

// export async function decryptData(
//   data: Buffer,
//   key: string,
//   iv: string
// ): Promise<Buffer> {
//   console.log("Decrypting data, length:", data.length);
//   try {
//     const cipherText = CryptoJS.enc.Hex.parse(data.toString("hex"));
//     const decrypted = CryptoJS.AES.decrypt(
//       CryptoJS.lib.CipherParams.create({ ciphertext: cipherText }),
//       CryptoJS.enc.Hex.parse(key),
//       {
//         iv: CryptoJS.enc.Hex.parse(iv),
//         mode: CryptoJS.mode.CBC,
//         padding: CryptoJS.pad.Pkcs7,
//       }
//     );
//     const result = Buffer.from(
//       decrypted.toString(CryptoJS.enc.Base64),
//       "base64"
//     );
//     console.log("Data decrypted, length:", result.length);
//     return result;
//   } catch (error) {
//     console.error("Failed to decrypt data:", error);
//     throw error;
//   }
// }

// import "react-native-get-random-values";
// import CryptoJS from "crypto-js";
// import forge from "node-forge";
// import { Buffer } from "buffer";
// import { Logger } from "../utils/Logger";
// import { DropShareError, ERROR_CODES } from "../utils/Error";

// const crypto = global.crypto || (global as any).msCrypto;

// export interface AESKeyPair {
//   key: string;
//   iv: string;
// }

// export async function generateAESKey(): Promise<AESKeyPair> {
//   try {
//     const keyArray = new Uint8Array(32);
//     const ivArray = new Uint8Array(16);
//     crypto.getRandomValues(keyArray);
//     crypto.getRandomValues(ivArray);
//     const key = Buffer.from(keyArray).toString("hex");
//     const iv = Buffer.from(ivArray).toString("hex");
//     Logger.info("AES key generated successfully");
//     return { key, iv };
//   } catch (error) {
//     Logger.error("Failed to generate AES key with getRandomValues", error);
//     try {
//       const key = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
//       const iv = CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
//       Logger.warn("Using CryptoJS fallback for AES key generation");
//       return { key, iv };
//     } catch (fallbackError) {
//       Logger.error("Fallback AES key generation failed", fallbackError);
//       throw new DropShareError(
//         ERROR_CODES.ENCRYPTION_FAILED,
//         "Failed to generate AES key"
//       );
//     }
//   }
// }

// export async function generateRSAKeyPair(): Promise<{
//   publicKey: string;
//   privateKey: string;
// }> {
//   Logger.info("Generating RSA key pair...");
//   return new Promise((resolve, reject) => {
//     forge.pki.rsa.generateKeyPair({ bits: 2048 }, (err, keypair) => {
//       if (err) {
//         Logger.error("RSA key generation failed", err);
//         return reject(
//           new DropShareError(
//             ERROR_CODES.ENCRYPTION_FAILED,
//             "RSA key generation failed"
//           )
//         );
//       }
//       const result = {
//         publicKey: forge.pki.publicKeyToPem(keypair.publicKey),
//         privateKey: forge.pki.privateKeyToPem(keypair.privateKey),
//       };
//       Logger.info("RSA keys generated");
//       resolve(result);
//     });
//   });
// }

// export async function encryptAESKeyWithRSA(
//   aesKey: string,
//   publicKeyPem: string
// ): Promise<Buffer> {
//   try {
//     const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
//     const encrypted = publicKey.encrypt(aesKey, "RSA-OAEP");
//     const buffer = Buffer.from(forge.util.encode64(encrypted), "base64");
//     Logger.info("AES key encrypted with RSA");
//     return buffer;
//   } catch (error) {
//     Logger.error("Failed to encrypt AES key with RSA", error);
//     throw new DropShareError(
//       ERROR_CODES.ENCRYPTION_FAILED,
//       "Failed to encrypt AES key"
//     );
//   }
// }

// export async function decryptAESKeyWithRSA(
//   encryptedKey: Buffer,
//   privateKeyPem: string
// ): Promise<string> {
//   try {
//     const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
//     const encryptedBase64 = encryptedKey.toString("base64");
//     const decoded = forge.util.decode64(encryptedBase64);
//     const decrypted = privateKey.decrypt(decoded, "RSA-OAEP");
//     Logger.info("AES key decrypted successfully");
//     return decrypted;
//   } catch (error) {
//     Logger.error("Failed to decrypt AES key with RSA", error);
//     throw new DropShareError(
//       ERROR_CODES.DECRYPTION_FAILED,
//       "Failed to decrypt AES key"
//     );
//   }
// }

// export async function encryptData(
//   data: Buffer,
//   key: string,
//   iv: string
// ): Promise<Buffer> {
//   try {
//     const encrypted = CryptoJS.AES.encrypt(
//       data.toString("base64"),
//       CryptoJS.enc.Hex.parse(key),
//       {
//         iv: CryptoJS.enc.Hex.parse(iv),
//         mode: CryptoJS.mode.CBC,
//         padding: CryptoJS.pad.Pkcs7,
//       }
//     );
//     const result = Buffer.from(
//       encrypted.ciphertext.toString(CryptoJS.enc.Hex),
//       "hex"
//     );
//     Logger.info("Data encrypted");
//     return result;
//   } catch (error) {
//     Logger.error("Failed to encrypt data", error);
//     throw new DropShareError(
//       ERROR_CODES.ENCRYPTION_FAILED,
//       "Failed to encrypt data"
//     );
//   }
// }

// export async function decryptData(
//   data: Buffer,
//   key: string,
//   iv: string
// ): Promise<Buffer> {
//   try {
//     const cipherText = CryptoJS.enc.Hex.parse(data.toString("hex"));
//     const decrypted = CryptoJS.AES.decrypt(
//       CryptoJS.lib.CipherParams.create({ ciphertext: cipherText }),
//       CryptoJS.enc.Hex.parse(key),
//       {
//         iv: CryptoJS.enc.Hex.parse(iv),
//         mode: CryptoJS.mode.CBC,
//         padding: CryptoJS.pad.Pkcs7,
//       }
//     );
//     const result = Buffer.from(
//       decrypted.toString(CryptoJS.enc.Base64),
//       "base64"
//     );
//     Logger.info("Data decrypted");
//     return result;
//   } catch (error) {
//     Logger.error("Failed to decrypt data", error);
//     throw new DropShareError(
//       ERROR_CODES.DECRYPTION_FAILED,
//       "Failed to decrypt data"
//     );
//   }
// }

// import "react-native-get-random-values";
// import CryptoJS from "crypto-js";
// import forge from "node-forge";
// import { Buffer } from "buffer";
// import { Logger } from "../utils/Logger";
// import { DropShareError, ERROR_CODES } from "../utils/Error";

// const crypto = global.crypto || (global as any).msCrypto;

// export interface AESKeyPair {
//   key: string;
//   iv: string;
// }

// export async function generateAESKey(): Promise<AESKeyPair> {
//   try {
//     const keyArray = new Uint8Array(32);
//     const ivArray = new Uint8Array(16);
//     crypto.getRandomValues(keyArray);
//     crypto.getRandomValues(ivArray);
//     const key = Buffer.from(keyArray).toString("hex");
//     const iv = Buffer.from(ivArray).toString("hex");
//     Logger.info(
//       `Generated AES key: ${key.slice(0, 10)}..., IV: ${iv.slice(0, 10)}...`
//     );
//     return { key, iv };
//   } catch (error) {
//     Logger.error("Failed to generate AES key with getRandomValues", error);
//     try {
//       const key = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
//       const iv = CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
//       Logger.warn(
//         `Fallback AES key: ${key.slice(0, 10)}..., IV: ${iv.slice(0, 10)}...`
//       );
//       return { key, iv };
//     } catch (fallbackError) {
//       Logger.error("Fallback AES key generation failed", fallbackError);
//       throw new DropShareError(
//         ERROR_CODES.ENCRYPTION_FAILED,
//         `Failed to generate AES key: ${
//           fallbackError instanceof Error ? fallbackError.message : "Unknown error"
//         }`
//       );
//     }
//   }
// }

// export async function generateRSAKeyPair(): Promise<{
//   publicKey: string;
//   privateKey: string;
// }> {
//   Logger.info("Generating RSA key pair...");
//   return new Promise((resolve, reject) => {
//     forge.pki.rsa.generateKeyPair({ bits: 2048 }, (err, keypair) => {
//       if (err) {
//         Logger.error("RSA key generation failed", err);
//         return reject(
//           new DropShareError(
//             ERROR_CODES.ENCRYPTION_FAILED,
//             `RSA key generation failed: ${err.message || "Unknown error"}`
//           )
//         );
//       }
//       const result = {
//         publicKey: forge.pki.publicKeyToPem(keypair.publicKey),
//         privateKey: forge.pki.privateKeyToPem(keypair.privateKey),
//       };
//       Logger.info("RSA keys generated successfully");
//       resolve(result);
//     });
//   });
// }

// export async function encryptAESKeyWithRSA(
//   aesKey: string,
//   publicKeyPem: string
// ): Promise<Buffer> {
//   try {
//     const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
//     const encrypted = publicKey.encrypt(aesKey, "RSA-OAEP");
//     const buffer = Buffer.from(forge.util.encode64(encrypted), "base64");
//     Logger.info(
//       `Encrypted AES key with RSA: ${buffer.toString("base64").slice(0, 20)}...`
//     );
//     return buffer;
//   } catch (error) {
//     Logger.error("Failed to encrypt AES key with RSA", error);
//     throw new DropShareError(
//       ERROR_CODES.ENCRYPTION_FAILED,
//       `Failed to encrypt AES key: ${
//         error instanceof Error ? error.message : "Unknown error"
//       }`
//     );
//   }
// }

// export async function decryptAESKeyWithRSA(
//   encryptedKey: Buffer,
//   privateKeyPem: string
// ): Promise<string> {
//   try {
//     const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
//     const encryptedBase64 = encryptedKey.toString("base64");
//     const decoded = forge.util.decode64(encryptedBase64);
//     const decrypted = privateKey.decrypt(decoded, "RSA-OAEP");
//     Logger.info(`Decrypted AES key: ${decrypted.slice(0, 10)}...`);
//     return decrypted;
//   } catch (error) {
//     Logger.error("Failed to decrypt AES key with RSA", error);
//     throw new DropShareError(
//       ERROR_CODES.DECRYPTION_FAILED,
//       `Failed to decrypt AES key: ${
//         error instanceof Error ? error.message : "Unknown error"
//       }`
//     );
//   }
// }

// export async function encryptData(
//   data: Buffer,
//   key: string,
//   iv: string
// ): Promise<Buffer> {
//   try {
//     Logger.info(
//       `Encrypting data (length: ${data.length}) with key: ${key.slice(
//         0,
//         10
//       )}..., IV: ${iv.slice(0, 10)}...`
//     );
//     const encrypted = CryptoJS.AES.encrypt(
//       data.toString("base64"),
//       CryptoJS.enc.Hex.parse(key),
//       {
//         iv: CryptoJS.enc.Hex.parse(iv),
//         mode: CryptoJS.mode.CBC,
//         padding: CryptoJS.pad.Pkcs7,
//       }
//     );
//     const result = Buffer.from(
//       encrypted.ciphertext.toString(CryptoJS.enc.Hex),
//       "hex"
//     );
//     Logger.info(
//       `Encrypted data: ${result.toString("hex").slice(0, 20)}... (${
//         result.length
//       } bytes)`
//     );
//     return result;
//   } catch (error) {
//     Logger.error("Failed to encrypt data", error);
//     throw new DropShareError(
//       ERROR_CODES.ENCRYPTION_FAILED,
//       `Failed to encrypt data: ${
//         error instanceof Error ? error.message : "Unknown error"
//       }`
//     );
//   }
// }

// export async function decryptData(
//   data: Buffer,
//   key: string,
//   iv: string
// ): Promise<Buffer> {
//   try {
//     Logger.info(
//       `Decrypting data (length: ${data.length}) with key: ${key.slice(
//         0,
//         10
//       )}..., IV: ${iv.slice(0, 10)}...`
//     );
//     const cipherText = CryptoJS.enc.Hex.parse(data.toString("hex"));
//     const decrypted = CryptoJS.AES.decrypt(
//       CryptoJS.lib.CipherParams.create({ ciphertext: cipherText }),
//       CryptoJS.enc.Hex.parse(key),
//       {
//         iv: CryptoJS.enc.Hex.parse(iv),
//         mode: CryptoJS.mode.CBC,
//         padding: CryptoJS.pad.Pkcs7,
//       }
//     );
//     const result = Buffer.from(
//       decrypted.toString(CryptoJS.enc.Base64),
//       "base64"
//     );
//     Logger.info(
//       `Decrypted data: ${result.toString("hex").slice(0, 20)}... (${
//         result.length
//       } bytes)`
//     );
//     return result;
//   } catch (error) {
//     Logger.error("Failed to decrypt data", error);
//     throw new DropShareError(
//       ERROR_CODES.DECRYPTION_FAILED,
//       `Failed to decrypt data: ${
//         error instanceof Error ? error.message : "Unknown error"
//       }`
//     );
//   }
// }

// import "react-native-get-random-values";
// import CryptoJS from "crypto-js";
// import forge from "node-forge";
// import { Buffer } from "buffer";
// import { Logger } from "../utils/Logger";
// import { DropShareError, ERROR_CODES } from "../utils/Error";

// const crypto = global.crypto || (global as any).msCrypto;

// export interface AESKeyPair {
//   key: string;
//   iv: string;
// }

// export async function generateAESKey(): Promise<AESKeyPair> {
//   try {
//     const keyArray = new Uint8Array(32);
//     const ivArray = new Uint8Array(16);
//     crypto.getRandomValues(keyArray);
//     crypto.getRandomValues(ivArray);
//     const key = Buffer.from(keyArray).toString("hex");
//     const iv = Buffer.from(ivArray).toString("hex");
//     Logger.info(
//       `Generated AES key: ${key.slice(0, 10)}..., IV: ${iv.slice(0, 10)}...`
//     );
//     return { key, iv };
//   } catch (error) {
//     Logger.error("Failed to generate AES key with getRandomValues", error);
//     try {
//       const key = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
//       const iv = CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
//       Logger.warn(
//         `Fallback AES key: ${key.slice(0, 10)}..., IV: ${iv.slice(0, 10)}...`
//       );
//       return { key, iv };
//     } catch (fallbackError) {
//       Logger.error("Fallback AES key generation failed", fallbackError);
//       throw new DropShareError(
//         ERROR_CODES.ENCRYPTION_FAILED,
//         `Failed to generate AES key: ${
//           fallbackError instanceof Error
//             ? fallbackError.message
//             : "Unknown error"
//         }`
//       );
//     }
//   }
// }

// export async function generateRSAKeyPair(timeoutMs = 30000): Promise<{
//   publicKey: string;
//   privateKey: string;
// }> {
//   Logger.info("Starting RSA key pair generation...");
//   try {
//     const keyPairPromise = new Promise<{
//       publicKey: string;
//       privateKey: string;
//     }>((resolve, reject) => {
//       forge.pki.rsa.generateKeyPair({ bits: 1024 }, (err, keypair) => {
//         if (err) {
//           Logger.error("RSA key generation failed", err);
//           return reject(
//             new DropShareError(
//               ERROR_CODES.ENCRYPTION_FAILED,
//               `RSA key generation failed: ${err.message || "Unknown error"}`
//             )
//           );
//         }
//         const result = {
//           publicKey: forge.pki.publicKeyToPem(keypair.publicKey),
//           privateKey: forge.pki.privateKeyToPem(keypair.privateKey),
//         };
//         Logger.info("RSA keys generated successfully");
//         resolve(result);
//       });
//     });

//     const timeoutPromise = new Promise<never>((_, reject) =>
//       setTimeout(
//         () =>
//           reject(
//             new DropShareError(
//               ERROR_CODES.ENCRYPTION_FAILED,
//               "RSA key generation timed out"
//             )
//           ),
//         timeoutMs
//       )
//     );

//     const result = await Promise.race([keyPairPromise, timeoutPromise]);
//     Logger.info("RSA key pair generation completed");
//     return result;
//   } catch (error) {
//     Logger.error("Error in RSA key pair generation", error);
//     throw DropShareError.from(
//       error,
//       ERROR_CODES.ENCRYPTION_FAILED,
//       `RSA key generation failed: ${
//         error instanceof Error ? error.message : "Unknown error"
//       }`
//     );
//   }
// }

// export async function encryptAESKeyWithRSA(
//   aesKey: string,
//   publicKeyPem: string
// ): Promise<Buffer> {
//   try {
//     Logger.info("Encrypting AES key with RSA...");
//     const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
//     const encrypted = publicKey.encrypt(aesKey, "RSA-OAEP");
//     const buffer = Buffer.from(forge.util.encode64(encrypted), "base64");
//     Logger.info(
//       `Encrypted AES key with RSA: ${buffer.toString("base64").slice(0, 20)}...`
//     );
//     return buffer;
//   } catch (error) {
//     Logger.error("Failed to encrypt AES key with RSA", error);
//     throw new DropShareError(
//       ERROR_CODES.ENCRYPTION_FAILED,
//       `Failed to encrypt AES key: ${
//         error instanceof Error ? error.message : "Unknown error"
//       }`
//     );
//   }
// }

// export async function decryptAESKeyWithRSA(
//   encryptedKey: Buffer,
//   privateKeyPem: string
// ): Promise<string> {
//   try {
//     Logger.info("Decrypting AES key with RSA...");
//     const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
//     const encryptedBase64 = encryptedKey.toString("base64");
//     const decoded = forge.util.decode64(encryptedBase64);
//     const decrypted = privateKey.decrypt(decoded, "RSA-OAEP");
//     Logger.info(`Decrypted AES key: ${decrypted.slice(0, 10)}...`);
//     return decrypted;
//   } catch (error) {
//     Logger.error("Failed to decrypt AES key with RSA", error);
//     throw new DropShareError(
//       ERROR_CODES.DECRYPTION_FAILED,
//       `Failed to decrypt AES key: ${
//         error instanceof Error ? error.message : "Unknown error"
//       }`
//     );
//   }
// }

// export async function encryptData(
//   data: Buffer,
//   key: string,
//   iv: string
// ): Promise<Buffer> {
//   try {
//     Logger.info(
//       `Encrypting data (length: ${data.length}) with key: ${key.slice(
//         0,
//         10
//       )}..., IV: ${iv.slice(0, 10)}...`
//     );
//     const encrypted = CryptoJS.AES.encrypt(
//       data.toString("base64"),
//       CryptoJS.enc.Hex.parse(key),
//       {
//         iv: CryptoJS.enc.Hex.parse(iv),
//         mode: CryptoJS.mode.CBC,
//         padding: CryptoJS.pad.Pkcs7,
//       }
//     );
//     const result = Buffer.from(
//       encrypted.ciphertext.toString(CryptoJS.enc.Hex),
//       "hex"
//     );
//     Logger.info(
//       `Encrypted data: ${result.toString("hex").slice(0, 20)}... (${
//         result.length
//       } bytes)`
//     );
//     return result;
//   } catch (error) {
//     Logger.error("Failed to encrypt data", error);
//     throw new DropShareError(
//       ERROR_CODES.ENCRYPTION_FAILED,
//       `Failed to encrypt data: ${
//         error instanceof Error ? error.message : "Unknown error"
//       }`
//     );
//   }
// }

// export async function decryptData(
//   data: Buffer,
//   key: string,
//   iv: string
// ): Promise<Buffer> {
//   try {
//     Logger.info(
//       `Decrypting data (length: ${data.length}) with key: ${key.slice(
//         0,
//         10
//       )}..., IV: ${iv.slice(0, 10)}...`
//     );
//     const cipherText = CryptoJS.enc.Hex.parse(data.toString("hex"));
//     const decrypted = CryptoJS.AES.decrypt(
//       CryptoJS.lib.CipherParams.create({ ciphertext: cipherText }),
//       CryptoJS.enc.Hex.parse(key),
//       {
//         iv: CryptoJS.enc.Hex.parse(iv),
//         mode: CryptoJS.mode.CBC,
//         padding: CryptoJS.pad.Pkcs7,
//       }
//     );
//     const result = Buffer.from(
//       decrypted.toString(CryptoJS.enc.Base64),
//       "base64"
//     );
//     Logger.info(
//       `Decrypted data: ${result.toString("hex").slice(0, 20)}... (${
//         result.length
//       } bytes)`
//     );
//     return result;
//   } catch (error) {
//     Logger.error("Failed to decrypt data", error);
//     throw new DropShareError(
//       ERROR_CODES.DECRYPTION_FAILED,
//       `Failed to decrypt data: ${
//         error instanceof Error ? error.message : "Unknown error"
//       }`
//     );
//   }
// }

import "react-native-get-random-values";
import CryptoJS from "crypto-js";
import forge from "node-forge";
import { Buffer } from "buffer";
import { Logger } from "../utils/Logger";
import { DropShareError, ERROR_CODES } from "../utils/Error";
import ReactNativeBlobUtil from "react-native-blob-util";

const crypto = global.crypto || (global as any).msCrypto;

export interface AESKeyPair {
  key: string;
  iv: string;
}

export async function generateAESKey(): Promise<AESKeyPair> {
  try {
    const keyArray = new Uint8Array(32);
    const ivArray = new Uint8Array(16);
    crypto.getRandomValues(keyArray);
    crypto.getRandomValues(ivArray);
    const key = Buffer.from(keyArray).toString("hex");
    const iv = Buffer.from(ivArray).toString("hex");
    Logger.info(
      `Generated AES key: ${key.slice(0, 10)}..., IV: ${iv.slice(0, 10)}...`
    );
    return { key, iv };
  } catch (error) {
    Logger.error("Failed to generate AES key with getRandomValues", error);
    try {
      const key = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
      const iv = CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
      Logger.warn(
        `Fallback AES key: ${key.slice(0, 10)}..., IV: ${iv.slice(0, 10)}...`
      );
      return { key, iv };
    } catch (fallbackError) {
      Logger.error("Fallback AES key generation failed", fallbackError);
      throw new DropShareError(
        ERROR_CODES.ENCRYPTION_FAILED,
        `Failed to generate AES key: ${
          fallbackError instanceof Error
            ? fallbackError.message
            : "Unknown error"
        }`
      );
    }
  }
}

export async function generateRSAKeyPair(timeoutMs = 30000): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  Logger.info("Starting RSA key pair generation...");
  try {
    const keyPairPromise = new Promise<{
      publicKey: string;
      privateKey: string;
    }>((resolve, reject) => {
      forge.pki.rsa.generateKeyPair({ bits: 1024 }, (err, keypair) => {
        if (err) {
          Logger.error("RSA key generation failed", err);
          return reject(
            new DropShareError(
              ERROR_CODES.ENCRYPTION_FAILED,
              `RSA key generation failed: ${err.message || "Unknown error"}`
            )
          );
        }
        const result = {
          publicKey: forge.pki.publicKeyToPem(keypair.publicKey),
          privateKey: forge.pki.privateKeyToPem(keypair.privateKey),
        };
        Logger.info("RSA keys generated successfully");
        resolve(result);
      });
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new DropShareError(
              ERROR_CODES.ENCRYPTION_FAILED,
              "RSA key generation timed out"
            )
          ),
        timeoutMs
      )
    );

    const result = await Promise.race([keyPairPromise, timeoutPromise]);
    Logger.info("RSA key pair generation completed");
    return result;
  } catch (error) {
    Logger.error("Error in RSA key pair generation", error);
    throw DropShareError.from(
      error,
      ERROR_CODES.ENCRYPTION_FAILED,
      `RSA key generation failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function encryptAESKeyWithRSA(
  aesKey: string,
  publicKeyPem: string
): Promise<Buffer> {
  try {
    Logger.info("Encrypting AES key with RSA...");
    const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
    const aesKeyBinary = forge.util.hexToBytes(aesKey);
    const encrypted = publicKey.encrypt(aesKeyBinary, "RSA-OAEP");
    const buffer = Buffer.from(forge.util.encode64(encrypted), "base64");
    Logger.info(
      `Encrypted AES key with RSA: ${buffer.toString("base64").slice(0, 20)}...`
    );
    return buffer;
  } catch (error) {
    Logger.error("Failed to encrypt AES key with RSA", error);
    throw new DropShareError(
      ERROR_CODES.ENCRYPTION_FAILED,
      `Failed to encrypt AES key: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function decryptAESKeyWithRSA(
  encryptedKey: Buffer,
  privateKeyPem: string
): Promise<string> {
  try {
    Logger.info("Decrypting AES key with RSA...");
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
    const encryptedBase64 = encryptedKey.toString("base64");
    const decoded = forge.util.decode64(encryptedBase64);
    const decrypted = privateKey.decrypt(decoded, "RSA-OAEP");
    const decryptedHex = forge.util.bytesToHex(decrypted);
    Logger.info(`Decrypted AES key: ${decryptedHex.slice(0, 10)}...`);
    return decryptedHex;
  } catch (error) {
    Logger.error("Failed to decrypt AES key with RSA", error);
    throw new DropShareError(
      ERROR_CODES.DECRYPTION_FAILED,
      `Failed to decrypt AES key: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// Stream-based encryption function using react-native-blob-util
export async function encryptFileStream(
  filePath: string,
  key: string,
  iv: string,
  outputPath: string
): Promise<void> {
  try {
    Logger.info(
      `Streaming encryption for file ${filePath} with key: ${key.slice(
        0,
        10
      )}..., IV: ${iv.slice(0, 10)}...`
    );

    // Create output file
    await ReactNativeBlobUtil.fs.writeFile(outputPath, "", "base64");

    // Open read stream
    return new Promise<void>((resolve, reject) => {
      const stream = ReactNativeBlobUtil.fs.readStream(
        filePath,
        "base64",
        64 * 1024
      ); // 64KB buffer

      stream
        .then((readStream) => {
          readStream.open();

          readStream.onData(async (chunk: string | number[]) => {
            try {
              const chunkStr =
                typeof chunk === "string"
                  ? chunk
                  : Buffer.from(chunk).toString("base64");
              const buffer = Buffer.from(chunkStr, "base64");
              const wordArray = CryptoJS.enc.Latin1.parse(
                buffer.toString("binary")
              );
              const encrypted = CryptoJS.AES.encrypt(
                wordArray,
                CryptoJS.enc.Hex.parse(key),
                {
                  mode: CryptoJS.mode.CBC,
                  padding: CryptoJS.pad.Pkcs7,
                  iv: CryptoJS.enc.Hex.parse(iv),
                }
              );
              const encryptedBuffer = Buffer.from(
                encrypted.ciphertext.toString(CryptoJS.enc.Base64),
                "base64"
              );
              await ReactNativeBlobUtil.fs.appendFile(
                outputPath,
                encryptedBuffer.toString("base64"),
                "base64"
              );
              Logger.debug(
                `Encrypted chunk of ${buffer.length} bytes for ${filePath}`
              );
            } catch (error) {
              readStream.closed = true;
              reject(
                new DropShareError(
                  ERROR_CODES.ENCRYPTION_FAILED,
                  `Failed to encrypt chunk: ${
                    error instanceof Error ? error.message : "Unknown error"
                  }`
                )
              );
            }
          });

          readStream.onEnd(async () => {
            try {
              Logger.info(`Completed streaming encryption for ${filePath}`);
              resolve();
            } catch (error) {
              reject(
                new DropShareError(
                  ERROR_CODES.ENCRYPTION_FAILED,
                  `Failed to finalize encryption: ${
                    error instanceof Error ? error.message : "Unknown error"
                  }`
                )
              );
            }
          });

          readStream.onError((error: Error) => {
            Logger.error("Stream error during encryption", error);
            reject(
              new DropShareError(
                ERROR_CODES.ENCRYPTION_FAILED,
                `Stream error: ${error.message || "Unknown error"}`
              )
            );
          });
        })
        .catch((error) => {
          reject(
            new DropShareError(
              ERROR_CODES.ENCRYPTION_FAILED,
              `Failed to create read stream: ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            )
          );
        });
    });
  } catch (error) {
    Logger.error("Failed to encrypt file stream", error);
    throw new DropShareError(
      ERROR_CODES.ENCRYPTION_FAILED,
      `Failed to encrypt file: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// Stream-based decryption function using react-native-blob-util
export async function decryptFileStream(
  encryptedFilePath: string,
  key: string,
  iv: string,
  outputPath: string
): Promise<void> {
  try {
    Logger.info(
      `Streaming decryption for file ${encryptedFilePath} with key: ${key.slice(
        0,
        10
      )}..., IV: ${iv.slice(0, 10)}...`
    );

    // Create output file
    await ReactNativeBlobUtil.fs.writeFile(outputPath, "", "base64");

    // Open read stream
    return new Promise<void>((resolve, reject) => {
      const stream = ReactNativeBlobUtil.fs.readStream(
        encryptedFilePath,
        "base64",
        64 * 1024
      ); // 64KB buffer

      stream
        .then((readStream) => {
          readStream.open();

          readStream.onData(async (chunk: string | number[]) => {
            try {
              const chunkStr =
                typeof chunk === "string"
                  ? chunk
                  : Buffer.from(chunk).toString("base64");
              const buffer = Buffer.from(chunkStr, "base64");
              const cipherParams = CryptoJS.lib.CipherParams.create({
                ciphertext: CryptoJS.enc.Base64.parse(
                  buffer.toString("base64")
                ),
              });
              const decrypted = CryptoJS.AES.decrypt(
                cipherParams,
                CryptoJS.enc.Hex.parse(key),
                {
                  mode: CryptoJS.mode.CBC,
                  padding: CryptoJS.pad.Pkcs7,
                  iv: CryptoJS.enc.Hex.parse(iv),
                }
              );
              const decryptedBuffer = Buffer.from(
                decrypted.toString(CryptoJS.enc.Latin1),
                "binary"
              );
              await ReactNativeBlobUtil.fs.appendFile(
                outputPath,
                decryptedBuffer.toString("base64"),
                "base64"
              );
              Logger.debug(
                `Decrypted chunk of ${buffer.length} bytes for ${encryptedFilePath}`
              );
            } catch (error) {
              readStream.closed = true;
              reject(
                new DropShareError(
                  ERROR_CODES.DECRYPTION_FAILED,
                  `Failed to decrypt chunk: ${
                    error instanceof Error ? error.message : "Unknown error"
                  }`
                )
              );
            }
          });

          readStream.onEnd(async () => {
            try {
              Logger.info(
                `Completed streaming decryption for ${encryptedFilePath}`
              );
              resolve();
            } catch (error) {
              reject(
                new DropShareError(
                  ERROR_CODES.DECRYPTION_FAILED,
                  `Failed to finalize decryption: ${
                    error instanceof Error ? error.message : "Unknown error"
                  }`
                )
              );
            }
          });

          readStream.onError((error: Error) => {
            Logger.error("Stream error during decryption", error);
            reject(
              new DropShareError(
                ERROR_CODES.DECRYPTION_FAILED,
                `Stream error: ${error.message || "Unknown error"}`
              )
            );
          });
        })
        .catch((error) => {
          reject(
            new DropShareError(
              ERROR_CODES.DECRYPTION_FAILED,
              `Failed to create read stream: ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            )
          );
        });
    });
  } catch (error) {
    Logger.error("Failed to decrypt file stream", error);
    throw new DropShareError(
      ERROR_CODES.DECRYPTION_FAILED,
      `Failed to decrypt file: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
