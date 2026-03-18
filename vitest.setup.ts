import { webcrypto } from 'node:crypto';

// Ensure Web Crypto API is available globally (Node 18+ has it natively,
// but some environments may not expose it on globalThis)
if (!globalThis.crypto?.subtle) {
  // @ts-expect-error - webcrypto types differ slightly from DOM Crypto
  globalThis.crypto = webcrypto;
}

// Minimal localStorage mock for Node environment
function createStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

// Set up both localStorage and sessionStorage mocks
if (!globalThis.localStorage) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createStorageMock(),
    writable: true,
    configurable: true,
  });
}

if (!globalThis.sessionStorage) {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: createStorageMock(),
    writable: true,
    configurable: true,
  });
}
