/** Options for Error constructor (polyfill for ES2022 ErrorOptions). */
interface ErrorCauseOptions {
  cause?: unknown;
}

/**
 * Base error class for encrypt-storage-lite.
 */
export class EncryptStorageError extends Error {
  cause?: unknown;

  constructor(message: string, options?: ErrorCauseOptions) {
    super(message);
    this.name = 'EncryptStorageError';
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/**
 * Thrown when decryption fails — either due to a wrong password
 * or corrupted/tampered data. By design, AES-GCM does not
 * distinguish between these two cases.
 */
export class DecryptionError extends EncryptStorageError {
  constructor(message?: string, options?: ErrorCauseOptions) {
    super(
      message ??
        'Decryption failed. The password may be incorrect or the data is corrupted.',
      options,
    );
    this.name = 'DecryptionError';
  }
}

/**
 * Thrown when the requested storage backend (localStorage or sessionStorage)
 * is not available in the current environment.
 */
export class StorageUnavailableError extends EncryptStorageError {
  constructor(storageType: string = 'localStorage') {
    super(`${storageType} is not available in the current environment.`);
    this.name = 'StorageUnavailableError';
  }
}
