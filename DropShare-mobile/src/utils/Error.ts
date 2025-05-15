export class DropShareError extends Error {
  public readonly code: string;
  public readonly details?: any;
  public readonly cause?: Error;

  constructor(code: string, message: string, details?: any, cause?: Error) {
    super(message.length > 100 ? `${message.slice(0, 97)}...` : message);
    this.code = code;
    this.details = details;
    this.cause = cause;
    this.name = "DropShareError";
  }

  static from(
    error: unknown,
    code: string,
    defaultMessage: string
  ): DropShareError {
    if (error instanceof Error) {
      return new DropShareError(
        code,
        error.message || defaultMessage,
        error.stack,
        error
      );
    }
    return new DropShareError(code, defaultMessage, error);
  }
}

export const ERROR_CODES = {
  TRANSFER_LIMIT_EXCEEDED: "TRANSFER_LIMIT_EXCEEDED",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  NETWORK_ERROR: "NETWORK_ERROR",
  ENCRYPTION_FAILED: "ENCRYPTION_FAILED",
  DECRYPTION_FAILED: "DECRYPTION_FAILED",
  CHUNK_MISSING: "CHUNK_MISSING",
  INVALID_HEADER: "INVALID_HEADER",
  DATABASE_ERROR: "DATABASE_ERROR",
  DATABASE_WRITE_ERROR: "DATABASE_WRITE_ERROR",
  FILE_IO_ERROR: "FILE_IO_ERROR",
  TRANSFER_QUEUE_FULL: "TRANSFER_QUEUE_FULL",
  MAX_CLIENTS_REACHED: "MAX_CLIENTS_REACHED",
  TIMEOUT: "TIMEOUT",
  CORRUPTED_CHUNK: "CORRUPTED_CHUNK",
  BUFFER_OVERFLOW: "BUFFER_OVERFLOW",
  MAX_SOCKETS_REACHED: "MAX_SOCKETS_REACHED",
  ENCRYPTION_ERROR: "ENCRYPTION_ERROR",
  TRANSFER_CANCELLED: "TRANSFER_CANCELLED",
  CORRUPTED_FILE: "CORRUPTED_FILE",
  DATABASE_READ_ERROR: "DATABASE_READ_ERROR",
  CRYPTO_ERROR: "CRYPTO_ERROR",
  TRANSFER_PAUSED: "TRANSFER_PAUSED",
};
