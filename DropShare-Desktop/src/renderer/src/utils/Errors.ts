export class DropShareError extends Error {
  public readonly code: string;
  public readonly details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "DropShareError";
  }

  static from(
    error: unknown,
    code: string,
    defaultMessage: string,
  ): DropShareError {
    if (error instanceof Error) {
      return new DropShareError(
        code,
        error.message || defaultMessage,
        error.stack,
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
  FILE_IO_ERROR: "FILE_IO_ERROR",
  TRANSFER_QUEUE_FULL: "TRANSFER_QUEUE_FULL",
};
