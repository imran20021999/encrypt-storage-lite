import { encrypt, decrypt } from './crypto';
import { DEFAULTS } from './constants';
import {
  DecryptionError,
  EncryptStorageError,
  StorageUnavailableError,
} from './errors';
import type { SecureStorageOptions, StorageData } from './types';

/**
 * Encrypted storage that persists key-value pairs as a single encrypted
 * JSON blob in localStorage or sessionStorage.
 *
 * @example
 * ```ts
 * const store = new SecureStorage({
 *   secret: 'my-password',
 *   storageType: 'localStorage', // or 'sessionStorage'
 * });
 *
 * await store.setItem('user', { name: 'John' });
 * const user = await store.getItem<{ name: string }>('user');
 * ```
 */
export class SecureStorage {
  private readonly secret: string;
  private readonly storageKey: string;
  private readonly storage: Storage;

  constructor(options: SecureStorageOptions) {
    // Validate secret
    if (!options.secret || typeof options.secret !== 'string') {
      throw new EncryptStorageError('Secret must be a non-empty string.');
    }

    this.secret = options.secret;
    this.storageKey = options.storageKey ?? DEFAULTS.STORAGE_KEY;

    // Resolve storage backend
    const storageType = options.storageType ?? 'localStorage';

    try {
      const backend =
        storageType === 'sessionStorage'
          ? globalThis.sessionStorage
          : globalThis.localStorage;

      if (!backend) {
        throw new Error('Storage is undefined');
      }

      // Verify storage is actually usable
      const testKey = '__encrypt_storage_test__';
      backend.setItem(testKey, '1');
      backend.removeItem(testKey);

      this.storage = backend;
    } catch (error) {
      if (error instanceof StorageUnavailableError) {
        throw error;
      }
      throw new StorageUnavailableError(storageType);
    }
  }

  /**
   * Read and decrypt the entire store from the storage backend.
   * Returns an empty object if no data exists yet.
   */
  private async readStore(): Promise<StorageData> {
    const raw = this.storage.getItem(this.storageKey);

    if (raw === null) {
      return {};
    }

    const json = await decrypt(raw, this.secret);

    try {
      return JSON.parse(json) as StorageData;
    } catch (error) {
      throw new DecryptionError(
        'Failed to parse decrypted data as JSON.',
        { cause: error },
      );
    }
  }

  /**
   * Encrypt and write the entire store to the storage backend.
   */
  private async writeStore(data: StorageData): Promise<void> {
    const json = JSON.stringify(data);
    const encrypted = await encrypt(json, this.secret);
    this.storage.setItem(this.storageKey, encrypted);
  }

  /**
   * Store a value under the given key.
   * The value must be JSON-serializable.
   */
  async setItem(key: string, value: unknown): Promise<void> {
    const data = await this.readStore();
    data[key] = value;
    await this.writeStore(data);
  }

  /**
   * Retrieve the value stored under the given key.
   * Returns `null` if the key does not exist.
   */
  async getItem<T = unknown>(key: string): Promise<T | null> {
    const data = await this.readStore();
    if (key in data) {
      return data[key] as T;
    }
    return null;
  }

  /**
   * Remove a specific key from the store.
   */
  async removeItem(key: string): Promise<void> {
    const data = await this.readStore();
    delete data[key];
    await this.writeStore(data);
  }

  /**
   * Remove the entire encrypted blob from the storage backend.
   */
  async clear(): Promise<void> {
    this.storage.removeItem(this.storageKey);
  }

  /**
   * Get all keys currently in the store.
   */
  async getAllKeys(): Promise<string[]> {
    const data = await this.readStore();
    return Object.keys(data);
  }

  /**
   * Get a copy of all key-value pairs in the store.
   */
  async getAll(): Promise<StorageData> {
    return this.readStore();
  }

  /**
   * Check whether a key exists in the store.
   */
  async hasKey(key: string): Promise<boolean> {
    const data = await this.readStore();
    return key in data;
  }

  /**
   * Get the number of keys in the store.
   */
  async length(): Promise<number> {
    const data = await this.readStore();
    return Object.keys(data).length;
  }
}
