/**
 * Storage backend type.
 */
export type StorageType = 'localStorage' | 'sessionStorage';

/**
 * Configuration options for SecureStorage.
 */
export interface SecureStorageOptions {
  /** Password/secret used for encryption and decryption. Must be a non-empty string. */
  secret: string;

  /** Key name used in the storage backend. Defaults to '__encrypt_storage__'. */
  storageKey?: string;

  /** Which storage backend to use. Defaults to 'localStorage'. */
  storageType?: StorageType;
}

/**
 * Internal representation of the decrypted data store.
 */
export interface StorageData {
  [key: string]: unknown;
}
