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

import CryptoJS from "crypto-js";
import { Buffer } from "buffer";
import "react-native-get-random-values";

export async function generateAESKey(): Promise<{ key: string; iv: string }> {
  const key = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
  const iv = CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
  return { key, iv };
}

export async function encryptData(
  data: Buffer,
  key: string,
  iv: string
): Promise<Buffer> {
  const parsedKey = CryptoJS.enc.Hex.parse(key);
  const parsedIv = CryptoJS.enc.Hex.parse(iv);
  const encrypted = CryptoJS.AES.encrypt(
    CryptoJS.enc.Base64.parse(data.toString("base64")),
    parsedKey,
    { iv: parsedIv }
  );
  return Buffer.from(
    encrypted.ciphertext.toString(CryptoJS.enc.Base64),
    "base64"
  );
}

export async function decryptData(
  data: Buffer,
  key: string,
  iv: string
): Promise<Buffer> {
  const parsedKey = CryptoJS.enc.Hex.parse(key);
  const parsedIv = CryptoJS.enc.Hex.parse(iv);
  const ciphertext = CryptoJS.enc.Base64.parse(data.toString("base64"));
  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext: ciphertext } as CryptoJS.lib.CipherParams,
    parsedKey,
    { iv: parsedIv }
  );
  return Buffer.from(decrypted.toString(CryptoJS.enc.Base64), "base64");
}
