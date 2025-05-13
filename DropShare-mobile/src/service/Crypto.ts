// import { Buffer } from "buffer";
// import forge from "node-forge";
// import { Logger } from "../utils/Logger";
// import { DropShareError, ERROR_CODES } from "../utils/Error";

// import CryptoJS from "crypto-js";
// import "react-native-get-random-values";

// export class Crypto {
//   private static readonly AES_KEY_SIZE = 32; // 256 bits
//   private static readonly IV_SIZE = 16; // 128 bits
//   private static readonly RSA_KEY_SIZE = 1024; // Reduced for mobile performance

//   static async generateAESKey(): Promise<{ key: string; iv: string }> {
//     try {
//       const key = Buffer.from(
//         crypto.getRandomValues(new Uint8Array(this.AES_KEY_SIZE))
//       );
//       const iv = Buffer.from(
//         crypto.getRandomValues(new Uint8Array(this.IV_SIZE))
//       );
//       return {
//         key: key.toString("base64"),
//         iv: iv.toString("base64"),
//       };
//     } catch (error) {
//       Logger.error("Failed to generate AES key and IV", error);
//       throw new DropShareError(
//         ERROR_CODES.ENCRYPTION_FAILED,
//         "AES key generation failed"
//       );
//     }
//   }

//   static async generateRSAKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
//     return new Promise((resolve, reject) => {
//       try {
//         setImmediate(() => {
//           const keyPair = forge.pki.rsa.generateKeyPair(this.RSA_KEY_SIZE);
//           const publicKey = forge.pki.publicKeyToPem(keyPair.publicKey);
//           const privateKey = forge.pki.privateKeyToPem(keyPair.privateKey);
//           resolve({ publicKey, privateKey });
//         });
//       } catch (error) {
//         Logger.error("Failed to generate RSA key pair", error);
//         reject(
//           new DropShareError(
//             ERROR_CODES.ENCRYPTION_FAILED,
//             "RSA key generation failed"
//           )
//         );
//       }
//     });
//   }

//   static encryptAESKeyWithRSA(aesKey: string, rsaPublicKey: string): string {
//     try {
//       const publicKey = forge.pki.publicKeyFromPem(rsaPublicKey);
//       const encrypted = publicKey.encrypt(aesKey, "RSA-OAEP");
//       return Buffer.from(encrypted).toString("base64");
//     } catch (error) {
//       Logger.error(`Failed to encrypt AES key with RSA public key`, error);
//       throw new DropShareError(
//         ERROR_CODES.ENCRYPTION_FAILED,
//         "RSA encryption of AES key failed"
//       );
//     }
//   }

//   static decryptAESKeyWithRSA(
//     encryptedKey: string,
//     rsaPrivateKey: string
//   ): string {
//     try {
//       const privateKey = forge.pki.privateKeyFromPem(rsaPrivateKey);
//       const encrypted = Buffer.from(encryptedKey, "base64").toString("binary");
//       const decrypted = privateKey.decrypt(encrypted, "RSA-OAEP");
//       return decrypted;
//     } catch (error) {
//       Logger.error(`Failed to decrypt AES key with RSA private key`, error);
//       throw new DropShareError(
//         ERROR_CODES.ENCRYPTION_FAILED,
//         "RSA decryption of AES key failed"
//       );
//     }
//   }

//   static encryptChunk(chunk: Buffer, aesKey: string, iv: string): Buffer {
//     try {
//       const key = CryptoJS.enc.Base64.parse(aesKey);
//       const ivParsed = CryptoJS.enc.Base64.parse(iv);
//       const chunkWordArray = CryptoJS.lib.WordArray.create(chunk);
//       const encrypted = CryptoJS.AES.encrypt(chunkWordArray, key, {
//         iv: ivParsed,
//         mode: CryptoJS.mode.CBC,
//         padding: CryptoJS.pad.Pkcs7,
//       });
//       return Buffer.from(
//         encrypted.ciphertext.toString(CryptoJS.enc.Base64),
//         "base64"
//       );
//     } catch (error) {
//       Logger.error(`Failed to encrypt chunk with AES key ${aesKey}`, error);
//       throw new DropShareError(
//         ERROR_CODES.ENCRYPTION_FAILED,
//         "AES encryption of chunk failed"
//       );
//     }
//   }

//   static decryptChunk(
//     encryptedChunk: Buffer,
//     aesKey: string,
//     iv: string
//   ): Buffer {
//     try {
//       const key = CryptoJS.enc.Base64.parse(aesKey);
//       const ivParsed = CryptoJS.enc.Base64.parse(iv);
//       const encryptedWordArray = CryptoJS.enc.Base64.parse(
//         encryptedChunk.toString("base64")
//       );
//       const decrypted = CryptoJS.AES.decrypt(
//         CryptoJS.lib.CipherParams.create({ ciphertext: encryptedWordArray }),
//         key,
//         {
//           iv: ivParsed,
//           mode: CryptoJS.mode.CBC,
//           padding: CryptoJS.pad.Pkcs7,
//         }
//       );
//       return Buffer.from(decrypted.toString(CryptoJS.enc.Hex), "hex");
//     } catch (error) {
//       Logger.error(`Failed to decrypt chunk with AES key ${aesKey}`, error);
//       throw new DropShareError(
//         ERROR_CODES.ENCRYPTION_FAILED,
//         "AES decryption of chunk failed"
//       );
//     }
//   }

//   static async encryptBatch(
//     batchBuffers: Buffer[],
//     aesKey: string,
//     iv: string
//   ): Promise<Buffer[]> {
//     try {
//       const key = CryptoJS.enc.Base64.parse(aesKey);
//       const ivParsed = CryptoJS.enc.Base64.parse(iv);
//       const encryptedBatch: Buffer[] = [];

//       for (const buffer of batchBuffers) {
//         await new Promise<void>((resolve) => setImmediate(resolve)); // Yield to event loop
//         const bufferWordArray = CryptoJS.lib.WordArray.create(buffer);
//         const encrypted = CryptoJS.AES.encrypt(bufferWordArray, key, {
//           iv: ivParsed,
//           mode: CryptoJS.mode.CBC,
//           padding: CryptoJS.pad.Pkcs7,
//         });
//         const encryptedBuffer = Buffer.from(
//           encrypted.ciphertext.toString(CryptoJS.enc.Base64),
//           "base64"
//         );
//         encryptedBatch.push(encryptedBuffer);
//       }

//       return encryptedBatch;
//     } catch (error) {
//       Logger.error(`Failed to encrypt batch with AES key ${aesKey}`, error);
//       throw new DropShareError(
//         ERROR_CODES.ENCRYPTION_FAILED,
//         "AES encryption of batch failed"
//       );
//     }
//   }

//   static async decryptBatch(
//     encryptedBatch: Buffer[],
//     aesKey: string,
//     iv: string
//   ): Promise<Buffer[]> {
//     try {
//       const key = CryptoJS.enc.Base64.parse(aesKey);
//       const ivParsed = CryptoJS.enc.Base64.parse(iv);
//       const decryptedBatch: Buffer[] = [];

//       for (const encryptedBuffer of encryptedBatch) {
//         await new Promise<void>((resolve) => setImmediate(resolve)); // Yield to event loop
//         const encryptedWordArray = CryptoJS.enc.Base64.parse(
//           encryptedBuffer.toString("base64")
//         );
//         const decrypted = CryptoJS.AES.decrypt(
//           CryptoJS.lib.CipherParams.create({ ciphertext: encryptedWordArray }),
//           key,
//           {
//             iv: ivParsed,
//             mode: CryptoJS.mode.CBC,
//             padding: CryptoJS.pad.Pkcs7,
//           }
//         );
//         const decryptedBuffer = Buffer.from(
//           decrypted.toString(CryptoJS.enc.Hex),
//           "hex"
//         );
//         decryptedBatch.push(decryptedBuffer);
//       }

//       return decryptedBatch;
//     } catch (error) {
//       Logger.error(`Failed to decrypt batch with AES key ${aesKey}`, error);
//       throw new DropShareError(
//         ERROR_CODES.ENCRYPTION_FAILED,
//         "AES decryption of batch failed"
//       );
//     }
//   }

//   static encryptMessage(message: string, aesKey: string, iv: string): Buffer {
//     try {
//       const key = CryptoJS.enc.Base64.parse(aesKey);
//       const ivParsed = CryptoJS.enc.Base64.parse(iv);
//       const messageWordArray = CryptoJS.enc.Utf8.parse(message);
//       const encrypted = CryptoJS.AES.encrypt(messageWordArray, key, {
//         iv: ivParsed,
//         mode: CryptoJS.mode.CBC,
//         padding: CryptoJS.pad.Pkcs7,
//       });
//       return Buffer.from(
//         encrypted.ciphertext.toString(CryptoJS.enc.Base64),
//         "base64"
//       );
//     } catch (error) {
//       Logger.error(`Failed to encrypt message with AES key ${aesKey}`, error);
//       throw new DropShareError(
//         ERROR_CODES.ENCRYPTION_FAILED,
//         "Message encryption failed"
//       );
//     }
//   }

//   static decryptMessage(
//     encryptedMessage: Buffer,
//     aesKey: string,
//     iv: string
//   ): string {
//     try {
//       const key = CryptoJS.enc.Base64.parse(aesKey);
//       const ivParsed = CryptoJS.enc.Base64.parse(iv);
//       const encryptedWordArray = CryptoJS.enc.Base64.parse(
//         encryptedMessage.toString("base64")
//       );
//       const decrypted = CryptoJS.AES.decrypt(
//         CryptoJS.lib.CipherParams.create({ ciphertext: encryptedWordArray }),
//         key,
//         {
//           iv: ivParsed,
//           mode: CryptoJS.mode.CBC,
//           padding: CryptoJS.pad.Pkcs7,
//         }
//       );
//       return decrypted.toString(CryptoJS.enc.Utf8);
//     } catch (error) {
//       Logger.error(`Failed to decrypt message with AES key ${aesKey}`, error);
//       throw new DropShareError(
//         ERROR_CODES.ENCRYPTION_FAILED,
//         "Message decryption failed"
//       );
//     }
//   }

//   static async createEncryptedPayload(
//     data: Buffer,
//     publicKey: string
//   ): Promise<{ encryptedData: string; encryptedKey: string; encryptedIV: string }> {
//     try {
//       const { key, iv } = await this.generateAESKey();
//       const encryptedData = this.encryptChunk(data, key, iv).toString("base64");
//       const encryptedKey = this.encryptAESKeyWithRSA(key, publicKey);
//       const encryptedIV = this.encryptAESKeyWithRSA(iv, publicKey);
//       return { encryptedData, encryptedKey, encryptedIV };
//     } catch (error) {
//       Logger.error("Failed to create encrypted payload", error);
//       throw new DropShareError(
//         ERROR_CODES.ENCRYPTION_FAILED,
//         "Failed to create encrypted payload"
//       );
//     }
//   }

//   static decryptEncryptedPayload(
//     payload: {
//       encryptedData: string;
//       encryptedKey: string;
//       encryptedIV: string;
//     },
//     privateKey: string
//   ): Buffer {
//     try {
//       const key = this.decryptAESKeyWithRSA(payload.encryptedKey, privateKey);
//       const iv = this.decryptAESKeyWithRSA(payload.encryptedIV, privateKey);
//       const encryptedData = Buffer.from(payload.encryptedData, "base64");
//       return this.decryptChunk(encryptedData, key, iv);
//     } catch (error) {
//       Logger.error("Failed to decrypt encrypted payload", error);
//       throw new DropShareError(
//         ERROR_CODES.ENCRYPTION_FAILED,
//         "Failed to decrypt encrypted payload"
//       );
//     }
//   }
// }

// import CryptoJS from "crypto-js";
// import { Buffer } from "buffer";
// import forge from "node-forge";
// import { Logger } from "../utils/Logger";
// import { DropShareError, ERROR_CODES } from "../utils/Error";

// import "react-native-get-random-values";

// export interface EncryptionKeys {
//   aesKey: string; // Base64-encoded AES key
//   iv: string; // Base64-encoded IV
//   publicKey?: string; // PEM-encoded RSA public key
//   privateKey?: string; // PEM-encoded RSA private key
// }

// export class Crypto {
//   private static readonly AES_KEY_SIZE = 32; // 256 bits
//   private static readonly IV_SIZE = 16; // 128 bits
//   private static readonly RSA_KEY_SIZE = 2048;
//   private static cachedKeyPair: {
//     publicKey: string;
//     privateKey: string;
//   } | null = null; // Cache for key pair

//   static async generateAESKey(): Promise<{ key: string; iv: string }> {
//     try {
//       const key = Buffer.from(
//         crypto.getRandomValues(new Uint8Array(this.AES_KEY_SIZE))
//       );
//       const iv = Buffer.from(
//         crypto.getRandomValues(new Uint8Array(this.IV_SIZE))
//       );
//       return {
//         key: key.toString("base64"),
//         iv: iv.toString("base64"),
//       };
//     } catch (error) {
//       Logger.error("Failed to generate AES key and IV", error);
//       throw new DropShareError(
//         ERROR_CODES.ENCRYPTION_FAILED,
//         "AES key generation failed"
//       );
//     }
//   }

//   static async generateRSAKeyPair(): Promise<{
//     publicKey: string;
//     privateKey: string;
//   }> {
//     if (this.cachedKeyPair) {
//       Logger.info("Using cached RSA key pair");
//       return this.cachedKeyPair;
//     }

//     const startTime = Date.now();

//     try {
//       const keyPair = await new Promise<{
//         publicKey: string;
//         privateKey: string;
//       }>((resolve, reject) => {
//         setTimeout(() => {
//           try {
//             const keyPair = forge.pki.rsa.generateKeyPair(this.RSA_KEY_SIZE);
//             resolve({
//               publicKey: forge.pki.publicKeyToPem(keyPair.publicKey),
//               privateKey: forge.pki.privateKeyToPem(keyPair.privateKey),
//             });
//           } catch (error) {
//             reject(error);
//           }
//         }, 0); // Run in next event loop tick
//       });

//       this.cachedKeyPair = keyPair;
//       const endTime = Date.now();
//       Logger.info(`RSA key generation took ${endTime - startTime}ms`);

//       return keyPair;
//     } catch (error) {
//       Logger.error("Failed to generate RSA key pair", error);
//       throw new DropShareError(
//         ERROR_CODES.ENCRYPTION_FAILED,
//         "RSA key generation failed"
//       );
//     }
//   }

//   static clearCachedKeyPair(): void {
//     this.cachedKeyPair = null;
//     Logger.info("Cleared cached RSA key pair");
//   }

//   static encryptAESKeyWithRSA(aesKey: string, rsaPublicKey: string): string {
//     try {
//       const publicKey = forge.pki.publicKeyFromPem(rsaPublicKey);
//       const encrypted = publicKey.encrypt(aesKey, "RSA-OAEP");
//       return Buffer.from(encrypted).toString("base64");
//     } catch (error) {
//       Logger.error(`Failed to encrypt AES key with RSA public key`, error);
//       throw new DropShareError(
//         ERROR_CODES.ENCRYPTION_FAILED,
//         "RSA encryption of AES key failed"
//       );
//     }
//   }

//   static decryptAESKeyWithRSA(
//     encryptedKey: string,
//     rsaPrivateKey: string
//   ): string {
//     try {
//       const privateKey = forge.pki.privateKeyFromPem(rsaPrivateKey);
//       const encrypted = Buffer.from(encryptedKey, "base64").toString("binary");
//       const decrypted = privateKey.decrypt(encrypted, "RSA-OAEP");
//       return decrypted;
//     } catch (error) {
//       Logger.error(`Failed to decrypt AES key with RSA private key`, error);
//       throw new DropShareError(
//         ERROR_CODES.ENCRYPTION_FAILED,
//         "RSA decryption of AES key failed"
//       );
//     }
//   }

//   static encryptChunk(chunk: Buffer, aesKey: string, iv: string): Buffer {
//     try {
//       const key = CryptoJS.enc.Base64.parse(aesKey);
//       const ivParsed = CryptoJS.enc.Base64.parse(iv);
//       const chunkWordArray = CryptoJS.lib.WordArray.create(chunk);
//       const encrypted = CryptoJS.AES.encrypt(chunkWordArray, key, {
//         iv: ivParsed,
//         mode: CryptoJS.mode.CBC,
//         padding: CryptoJS.pad.Pkcs7,
//       });
//       return Buffer.from(
//         encrypted.ciphertext.toString(CryptoJS.enc.Base64),
//         "base64"
//       );
//     } catch (error) {
//       Logger.error(`Failed to encrypt chunk with AES key ${aesKey}`, error);
//       throw new DropShareError(
//         ERROR_CODES.ENCRYPTION_FAILED,
//         "AES encryption of chunk failed"
//       );
//     }
//   }

//   static decryptChunk(
//     encryptedChunk: Buffer,
//     aesKey: string,
//     iv: string
//   ): Buffer {
//     try {
//       const key = CryptoJS.enc.Base64.parse(aesKey);
//       const ivParsed = CryptoJS.enc.Base64.parse(iv);
//       const encryptedWordArray = CryptoJS.enc.Base64.parse(
//         encryptedChunk.toString("base64")
//       );
//       const decrypted = CryptoJS.AES.decrypt(
//         CryptoJS.lib.CipherParams.create({ ciphertext: encryptedWordArray }),
//         key,
//         {
//           iv: ivParsed,
//           mode: CryptoJS.mode.CBC,
//           padding: CryptoJS.pad.Pkcs7,
//         }
//       );
//       return Buffer.from(decrypted.toString(CryptoJS.enc.Hex), "hex");
//     } catch (error) {
//       Logger.error(`Failed to decrypt chunk with AES key ${aesKey}`, error);
//       throw new DropShareError(
//         ERROR_CODES.ENCRYPTION_FAILED,
//         "AES decryption of chunk failed"
//       );
//     }
//   }

//   static encryptBatch(
//     batchBuffers: Buffer[],
//     aesKey: string,
//     iv: string
//   ): Buffer[] {
//     try {
//       const key = CryptoJS.enc.Base64.parse(aesKey);
//       const ivParsed = CryptoJS.enc.Base64.parse(iv);
//       const encryptedBatch: Buffer[] = [];

//       for (const buffer of batchBuffers) {
//         const bufferWordArray = CryptoJS.lib.WordArray.create(buffer);
//         const encrypted = CryptoJS.AES.encrypt(bufferWordArray, key, {
//           iv: ivParsed,
//           mode: CryptoJS.mode.CBC,
//           padding: CryptoJS.pad.Pkcs7,
//         });
//         const encryptedBuffer = Buffer.from(
//           encrypted.ciphertext.toString(CryptoJS.enc.Base64),
//           "base64"
//         );
//         encryptedBatch.push(encryptedBuffer);
//       }

//       return encryptedBatch;
//     } catch (error) {
//       Logger.error(`Failed to encrypt batch with AES key ${aesKey}`, error);
//       throw new DropShareError(
//         ERROR_CODES.ENCRYPTION_FAILED,
//         "AES encryption of batch failed"
//       );
//     }
//   }

//   static decryptBatch(
//     encryptedBatch: Buffer[],
//     aesKey: string,
//     iv: string
//   ): Buffer[] {
//     try {
//       const key = CryptoJS.enc.Base64.parse(aesKey);
//       const ivParsed = CryptoJS.enc.Base64.parse(iv);
//       const decryptedBatch: Buffer[] = [];

//       for (const encryptedBuffer of encryptedBatch) {
//         const encryptedWordArray = CryptoJS.enc.Base64.parse(
//           encryptedBuffer.toString("base64")
//         );
//         const decrypted = CryptoJS.AES.decrypt(
//           CryptoJS.lib.CipherParams.create({ ciphertext: encryptedWordArray }),
//           key,
//           {
//             iv: ivParsed,
//             mode: CryptoJS.mode.CBC,
//             padding: CryptoJS.pad.Pkcs7,
//           }
//         );
//         const decryptedBuffer = Buffer.from(
//           decrypted.toString(CryptoJS.enc.Hex),
//           "hex"
//         );
//         decryptedBatch.push(decryptedBuffer);
//       }

//       return decryptedBatch;
//     } catch (error) {
//       Logger.error(`Failed to decrypt batch with AES key ${aesKey}`, error);
//       throw new DropShareError(
//         ERROR_CODES.ENCRYPTION_FAILED,
//         "AES decryption of batch failed"
//       );
//     }
//   }

//   static encryptMessage(message: string, aesKey: string, iv: string): Buffer {
//     try {
//       const key = CryptoJS.enc.Base64.parse(aesKey);
//       const ivParsed = CryptoJS.enc.Base64.parse(iv);
//       const messageWordArray = CryptoJS.enc.Utf8.parse(message);
//       const encrypted = CryptoJS.AES.encrypt(messageWordArray, key, {
//         iv: ivParsed,
//         mode: CryptoJS.mode.CBC,
//         padding: CryptoJS.pad.Pkcs7,
//       });
//       return Buffer.from(
//         encrypted.ciphertext.toString(CryptoJS.enc.Base64),
//         "base64"
//       );
//     } catch (error) {
//       Logger.error(`Failed to encrypt message with AES key ${aesKey}`, error);
//       throw new DropShareError(
//         ERROR_CODES.ENCRYPTION_FAILED,
//         "Message encryption failed"
//       );
//     }
//   }

//   static decryptMessage(
//     encryptedMessage: Buffer,
//     aesKey: string,
//     iv: string
//   ): string {
//     try {
//       const key = CryptoJS.enc.Base64.parse(aesKey);
//       const ivParsed = CryptoJS.enc.Base64.parse(iv);
//       const encryptedWordArray = CryptoJS.enc.Base64.parse(
//         encryptedMessage.toString("base64")
//       );
//       const decrypted = CryptoJS.AES.decrypt(
//         CryptoJS.lib.CipherParams.create({ ciphertext: encryptedWordArray }),
//         key,
//         {
//           iv: ivParsed,
//           mode: CryptoJS.mode.CBC,
//           padding: CryptoJS.pad.Pkcs7,
//         }
//       );
//       return decrypted.toString(CryptoJS.enc.Utf8);
//     } catch (error) {
//       Logger.error(`Failed to decrypt message with AES key ${aesKey}`, error);
//       throw new DropShareError(
//         ERROR_CODES.ENCRYPTION_FAILED,
//         "Message decryption failed"
//       );
//     }
//   }

//   static async createEncryptedPayload(
//     data: Buffer,
//     publicKey: string
//   ): Promise<{
//     encryptedData: string;
//     encryptedKey: string;
//     encryptedIV: string;
//   }> {
//     const { key, iv } = await this.generateAESKey();
//     const encryptedData = this.encryptChunk(data, key, iv).toString("base64");
//     const encryptedKey = this.encryptAESKeyWithRSA(key, publicKey);
//     const encryptedIV = this.encryptAESKeyWithRSA(iv, publicKey);
//     return { encryptedData, encryptedKey, encryptedIV };
//   }

//   static decryptEncryptedPayload(
//     payload: {
//       encryptedData: string;
//       encryptedKey: string;
//       encryptedIV: string;
//     },
//     privateKey: string
//   ): Buffer {
//     const key = this.decryptAESKeyWithRSA(payload.encryptedKey, privateKey);
//     const iv = this.decryptAESKeyWithRSA(payload.encryptedIV, privateKey);
//     const encryptedData = Buffer.from(payload.encryptedData, "base64");
//     return this.decryptChunk(encryptedData, key, iv);
//   }
// }

import forge from "node-forge";
import { Buffer } from "buffer";
import { Logger } from "../utils/Logger";

export class Crypto {
  private static readonly AES_KEY_SIZE = 32; // 256 bits
  private static readonly IV_SIZE = 16; // 128 bits
  private static readonly RSA_KEY_SIZE = 2048; // Standard size for security
  private static rsaKeyPair: { publicKey: string; privateKey: string } | null =
    null;
  private static isGeneratingKeys = false;

  // Generate or retrieve cached RSA key pair
  static async getOrGenerateRSAKeyPair(): Promise<{
    publicKey: string;
    privateKey: string;
  }> {
    if (this.rsaKeyPair) {
      Logger.info("Using cached RSA key pair");
      return this.rsaKeyPair;
    }

    if (this.isGeneratingKeys) {
      Logger.info("RSA key generation in progress, waiting...");
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.rsaKeyPair) {
            clearInterval(checkInterval);
            resolve(this.rsaKeyPair!);
          }
        }, 100);
      });
    }

    this.isGeneratingKeys = true;
    try {
      Logger.info("Generating new RSA key pair...");
      const keyPair = await new Promise<{
        publicKey: string;
        privateKey: string;
      }>((resolve, reject) => {
        forge.pki.rsa.generateKeyPair(
          { bits: this.RSA_KEY_SIZE, workers: -1 },
          (err, keypair) => {
            if (err) {
              Logger.error("RSA key pair generation failed", err);
              reject(err);
              return;
            }
            const publicKey = forge.pki.publicKeyToPem(keypair.publicKey);
            const privateKey = forge.pki.privateKeyToPem(keypair.privateKey);
            resolve({ publicKey, privateKey });
          }
        );
      });
      this.rsaKeyPair = keyPair;
      Logger.info("RSA key pair generated and cached");
      return keyPair;
    } finally {
      this.isGeneratingKeys = false;
    }
  }

  // Clear cached RSA key pair (e.g., on session end)
  static clearRSAKeyPair(): void {
    this.rsaKeyPair = null;
    this.isGeneratingKeys = false;
    Logger.info("RSA key pair cache cleared");
  }

  // Generate AES key and IV
  static generateAESKeyAndIV(): { key: Buffer; iv: Buffer } {
    const key = Buffer.from(forge.random.getBytesSync(this.AES_KEY_SIZE));
    const iv = Buffer.from(forge.random.getBytesSync(this.IV_SIZE));
    return { key, iv };
  }

  // Generate IV for a batch
  static generateIV(): Buffer {
    return Buffer.from(forge.random.getBytesSync(this.IV_SIZE));
  }

  // Encrypt data with AES
  static encryptAES(data: Buffer, key: Buffer, iv: Buffer): Buffer {
    try {
      const cipher = forge.cipher.createCipher(
        "AES-CBC",
        key.toString("binary")
      );
      cipher.start({ iv: iv.toString("binary") });
      cipher.update(forge.util.createBuffer(data.toString("binary")));
      cipher.finish();
      const encrypted = cipher.output.getBytes();
      return Buffer.from(encrypted, "binary");
    } catch (err) {
      Logger.error("AES encryption failed", err);
      throw err;
    }
  }

  // Decrypt data with AES
  static decryptAES(encryptedData: Buffer, key: Buffer, iv: Buffer): Buffer {
    try {
      const decipher = forge.cipher.createDecipher(
        "AES-CBC",
        key.toString("binary")
      );
      decipher.start({ iv: iv.toString("binary") });
      decipher.update(
        forge.util.createBuffer(encryptedData.toString("binary"))
      );
      decipher.finish();
      const decrypted = decipher.output.getBytes();
      return Buffer.from(decrypted, "binary");
    } catch (err) {
      Logger.error("AES decryption failed", err);
      throw err;
    }
  }

  // Encrypt AES key and IV with RSA public key
  static encryptWithRSAPublicKey(data: Buffer, publicKeyPem: string): Buffer {
    try {
      const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
      const encrypted = publicKey.encrypt(data.toString("binary"), "RSA-OAEP", {
        md: forge.md.sha256.create(),
      });
      return Buffer.from(encrypted, "binary");
    } catch (err) {
      Logger.error("RSA encryption failed", err);
      throw err;
    }
  }

  // Decrypt AES key and IV with RSA private key
  static decryptWithRSAPrivateKey(
    encryptedData: Buffer,
    privateKeyPem: string
  ): Buffer {
    try {
      const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
      const decrypted = privateKey.decrypt(
        encryptedData.toString("binary"),
        "RSA-OAEP",
        {
          md: forge.md.sha256.create(),
        }
      );
      return Buffer.from(decrypted, "binary");
    } catch (err) {
      Logger.error("RSA decryption failed", err);
      throw err;
    }
  }
}
