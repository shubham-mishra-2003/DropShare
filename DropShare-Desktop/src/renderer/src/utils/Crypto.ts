import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  generateKeyPairSync,
  publicEncrypt,
  privateDecrypt,
} from "crypto";
import { Buffer } from "buffer";

export async function generateAESKey(): Promise<{ key: Buffer; iv: Buffer }> {
  return { key: randomBytes(32), iv: randomBytes(16) };
}

export async function generateRSAKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  return {
    publicKey: publicKey.export({ type: "pkcs1", format: "pem" }) as string,
    privateKey: privateKey.export({ type: "pkcs1", format: "pem" }) as string,
  };
}

export async function encryptAESKeyWithRSA(
  aesKey: Buffer,
  publicKeyPem: string,
): Promise<Buffer> {
  return publicEncrypt({ key: publicKeyPem, padding: 1 }, aesKey);
}

export async function decryptAESKeyWithRSA(
  encryptedKey: Buffer,
  privateKeyPem: string,
): Promise<Buffer> {
  return privateDecrypt({ key: privateKeyPem, padding: 1 }, encryptedKey);
}

export async function encryptData(
  data: Buffer,
  key: Buffer,
  iv: Buffer,
  algorithm: "aes-256-cbc"
): Promise<Buffer> {
  const cipher = createCipheriv(algorithm, key, iv);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

export async function decryptData(
  data: Buffer,
  key: Buffer,
  iv: Buffer,
  algorithm: "aes-256-cbc"
): Promise<string> {
  const decipher = createDecipheriv(algorithm, key, iv);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}
