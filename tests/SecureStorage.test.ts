import { describe, it, expect, beforeEach } from 'vitest';
import { SecureStorage } from '../src/SecureStorage';
import {
  DecryptionError,
  EncryptStorageError,
  StorageUnavailableError,
} from '../src/errors';

// Run all API tests for both storage types
describe.each(['localStorage', 'sessionStorage'] as const)(
  'SecureStorage (%s)',
  (storageType) => {
    const secret = 'test-secret-key';
    let store: SecureStorage;

    beforeEach(() => {
      // Clear both storages before each test
      globalThis.localStorage.clear();
      globalThis.sessionStorage.clear();

      store = new SecureStorage({
        secret,
        storageType,
      });
    });

    describe('constructor', () => {
      it('should throw EncryptStorageError for empty secret', () => {
        expect(
          () => new SecureStorage({ secret: '', storageType }),
        ).toThrow(EncryptStorageError);
        expect(
          () => new SecureStorage({ secret: '', storageType }),
        ).toThrow('Secret must be a non-empty string');
      });

      it('should accept a custom storageKey', () => {
        const customStore = new SecureStorage({
          secret,
          storageKey: 'my_custom_key',
          storageType,
        });
        expect(customStore).toBeInstanceOf(SecureStorage);
      });
    });

    describe('setItem + getItem', () => {
      it('should round-trip a string value', async () => {
        await store.setItem('name', 'John');
        const result = await store.getItem<string>('name');
        expect(result).toBe('John');
      });

      it('should round-trip a number value', async () => {
        await store.setItem('count', 42);
        const result = await store.getItem<number>('count');
        expect(result).toBe(42);
      });

      it('should round-trip a boolean value', async () => {
        await store.setItem('active', true);
        expect(await store.getItem<boolean>('active')).toBe(true);

        await store.setItem('active', false);
        expect(await store.getItem<boolean>('active')).toBe(false);
      });

      it('should round-trip null', async () => {
        await store.setItem('empty', null);
        const result = await store.getItem('empty');
        expect(result).toBeNull();
      });

      it('should round-trip an object', async () => {
        const user = { name: 'John', age: 30, email: 'john@example.com' };
        await store.setItem('user', user);
        const result = await store.getItem<typeof user>('user');
        expect(result).toEqual(user);
      });

      it('should round-trip an array', async () => {
        const items = [1, 'two', { three: 3 }, [4]];
        await store.setItem('items', items);
        const result = await store.getItem<typeof items>('items');
        expect(result).toEqual(items);
      });

      it('should round-trip nested objects', async () => {
        const nested = {
          level1: {
            level2: {
              level3: { value: 'deep' },
            },
          },
        };
        await store.setItem('nested', nested);
        expect(await store.getItem('nested')).toEqual(nested);
      });

      it('should return null for a nonexistent key', async () => {
        const result = await store.getItem('nonexistent');
        expect(result).toBeNull();
      });

      it('should return null on an empty store', async () => {
        const result = await store.getItem('anything');
        expect(result).toBeNull();
      });

      it('should overwrite an existing key', async () => {
        await store.setItem('key', 'value1');
        await store.setItem('key', 'value2');
        expect(await store.getItem('key')).toBe('value2');
      });

      it('should handle multiple keys independently', async () => {
        await store.setItem('a', 1);
        await store.setItem('b', 2);
        await store.setItem('c', 3);

        expect(await store.getItem('a')).toBe(1);
        expect(await store.getItem('b')).toBe(2);
        expect(await store.getItem('c')).toBe(3);
      });
    });

    describe('removeItem', () => {
      it('should remove the specified key', async () => {
        await store.setItem('a', 1);
        await store.setItem('b', 2);
        await store.removeItem('a');

        expect(await store.getItem('a')).toBeNull();
        expect(await store.getItem('b')).toBe(2);
      });

      it('should not throw when removing a nonexistent key', async () => {
        await expect(
          store.removeItem('nonexistent'),
        ).resolves.toBeUndefined();
      });
    });

    describe('clear', () => {
      it('should remove all data', async () => {
        await store.setItem('a', 1);
        await store.setItem('b', 2);
        await store.clear();

        expect(await store.getItem('a')).toBeNull();
        expect(await store.getItem('b')).toBeNull();
        expect(await store.length()).toBe(0);
      });

      it('should not throw on an already empty store', async () => {
        await expect(store.clear()).resolves.toBeUndefined();
      });
    });

    describe('getAllKeys', () => {
      it('should return all keys', async () => {
        await store.setItem('x', 1);
        await store.setItem('y', 2);
        await store.setItem('z', 3);

        const keys = await store.getAllKeys();
        expect(keys).toHaveLength(3);
        expect(keys).toContain('x');
        expect(keys).toContain('y');
        expect(keys).toContain('z');
      });

      it('should return empty array for empty store', async () => {
        expect(await store.getAllKeys()).toEqual([]);
      });
    });

    describe('getAll', () => {
      it('should return all key-value pairs', async () => {
        await store.setItem('a', 1);
        await store.setItem('b', 'two');

        const all = await store.getAll();
        expect(all).toEqual({ a: 1, b: 'two' });
      });

      it('should return empty object for empty store', async () => {
        expect(await store.getAll()).toEqual({});
      });
    });

    describe('hasKey', () => {
      it('should return true for existing key', async () => {
        await store.setItem('exists', 'yes');
        expect(await store.hasKey('exists')).toBe(true);
      });

      it('should return false for nonexistent key', async () => {
        expect(await store.hasKey('nope')).toBe(false);
      });
    });

    describe('length', () => {
      it('should return the number of keys', async () => {
        expect(await store.length()).toBe(0);

        await store.setItem('a', 1);
        expect(await store.length()).toBe(1);

        await store.setItem('b', 2);
        expect(await store.length()).toBe(2);

        await store.removeItem('a');
        expect(await store.length()).toBe(1);
      });
    });
  },
);

describe('SecureStorage - cross-instance behavior', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    globalThis.sessionStorage.clear();
  });

  it('should share data between instances with same secret and storageKey', async () => {
    const store1 = new SecureStorage({
      secret: 'shared-secret',
      storageKey: 'shared',
    });
    const store2 = new SecureStorage({
      secret: 'shared-secret',
      storageKey: 'shared',
    });

    await store1.setItem('key', 'from-store1');
    const result = await store2.getItem('key');
    expect(result).toBe('from-store1');
  });

  it('should throw DecryptionError when reading with wrong secret', async () => {
    const store1 = new SecureStorage({ secret: 'secret-A' });
    const store2 = new SecureStorage({ secret: 'secret-B' });

    await store1.setItem('key', 'value');
    await expect(store2.getItem('key')).rejects.toThrow(DecryptionError);
  });

  it('should isolate data by storageKey', async () => {
    const store1 = new SecureStorage({
      secret: 'same-secret',
      storageKey: 'store1',
    });
    const store2 = new SecureStorage({
      secret: 'same-secret',
      storageKey: 'store2',
    });

    await store1.setItem('key', 'value1');
    await store2.setItem('key', 'value2');

    expect(await store1.getItem('key')).toBe('value1');
    expect(await store2.getItem('key')).toBe('value2');
  });

  it('should isolate localStorage from sessionStorage', async () => {
    const localStore = new SecureStorage({
      secret: 'same-secret',
      storageType: 'localStorage',
      storageKey: 'same-key',
    });
    const sessionStore = new SecureStorage({
      secret: 'same-secret',
      storageType: 'sessionStorage',
      storageKey: 'same-key',
    });

    await localStore.setItem('data', 'local-value');
    await sessionStore.setItem('data', 'session-value');

    expect(await localStore.getItem('data')).toBe('local-value');
    expect(await sessionStore.getItem('data')).toBe('session-value');
  });

  it('should throw DecryptionError when storage data is manually corrupted', async () => {
    const store = new SecureStorage({ secret: 'my-secret' });
    await store.setItem('key', 'value');

    // Manually corrupt the data in localStorage
    const raw = globalThis.localStorage.getItem('__encrypt_storage__')!;
    globalThis.localStorage.setItem(
      '__encrypt_storage__',
      raw.slice(0, 20) + 'CORRUPTED' + raw.slice(29),
    );

    await expect(store.getItem('key')).rejects.toThrow(DecryptionError);
  });
});

describe('SecureStorage - error hierarchy', () => {
  it('DecryptionError should be instanceof EncryptStorageError', () => {
    const error = new DecryptionError();
    expect(error).toBeInstanceOf(EncryptStorageError);
    expect(error).toBeInstanceOf(Error);
  });

  it('StorageUnavailableError should be instanceof EncryptStorageError', () => {
    const error = new StorageUnavailableError('localStorage');
    expect(error).toBeInstanceOf(EncryptStorageError);
    expect(error).toBeInstanceOf(Error);
  });

  it('DecryptionError should preserve cause', () => {
    const cause = new Error('original');
    const error = new DecryptionError('wrapped', { cause });
    expect(error.cause).toBe(cause);
  });
});
