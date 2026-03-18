# encrypt-storage-lite

Zero-dependency encrypted `localStorage` & `sessionStorage` using AES-256-GCM and the Web Crypto API.

## The Problem

When you store data in `localStorage` or `sessionStorage`, it's saved as **plain text**. Anyone can open browser DevTools → Application → Storage and see everything — user preferences, tokens, sensitive data — all in the open.

## The Solution

This package takes **all your key-value pairs**, bundles them into **one JSON object**, **encrypts** it using AES-256-GCM encryption, and stores that single encrypted blob in storage. When you read a value back, it decrypts on the fly and returns just the value you asked for.

```
Without this package (plain localStorage):
┌─────────────────────────────────────┐
│  localStorage                       │
│  ├─ username  → "john"              │  ← Anyone can read this
│  ├─ token     → "abc123secret"      │  ← Exposed!
│  └─ theme     → "dark"              │
└─────────────────────────────────────┘

With encrypt-storage-lite:
┌─────────────────────────────────────┐
│  localStorage                       │
│  └─ __encrypt_storage__  →          │
│     "U2FsdGVkX1+3qZ7v..."          │  ← Unreadable encrypted blob
└─────────────────────────────────────┘
```

## Installation

```bash
npm install encrypt-storage-lite
```

## Quick Start

```ts
import { SecureStorage } from 'encrypt-storage-lite';

const store = new SecureStorage({
  secret: 'my-secret-password',
});

// Store values
await store.setItem('user', { name: 'John', role: 'admin' });
await store.setItem('token', 'eyJhbGciOiJIUzI1NiIs...');
await store.setItem('theme', 'dark');

// Retrieve values
const user = await store.getItem('user');
// → { name: 'John', role: 'admin' }

const token = await store.getItem('token');
// → 'eyJhbGciOiJIUzI1NiIs...'
```

## Usage with sessionStorage

```ts
const sessionStore = new SecureStorage({
  secret: 'my-secret-password',
  storageType: 'sessionStorage',
});

await sessionStore.setItem('tempData', { expires: '1h' });
```

## API

### Constructor

```ts
new SecureStorage(options: SecureStorageOptions)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `secret` | `string` | *(required)* | Password used for encryption and decryption |
| `storageKey` | `string` | `'__encrypt_storage__'` | Key name used in the storage backend |
| `storageType` | `'localStorage' \| 'sessionStorage'` | `'localStorage'` | Which storage backend to use |

### Methods

All methods are **async** (Web Crypto API is promise-based).

```ts
// Store a value (must be JSON-serializable)
await store.setItem(key: string, value: any): Promise<void>

// Retrieve a value (returns null if key doesn't exist)
await store.getItem<T>(key: string): Promise<T | null>

// Remove a specific key
await store.removeItem(key: string): Promise<void>

// Remove all data
await store.clear(): Promise<void>

// Get all keys
await store.getAllKeys(): Promise<string[]>

// Get all key-value pairs
await store.getAll(): Promise<Record<string, unknown>>

// Check if a key exists
await store.hasKey(key: string): Promise<boolean>

// Get the number of stored keys
await store.length(): Promise<number>
```

## How It Works

### On Write (`setItem`)

```
{ username: "john", token: "abc123", theme: "dark" }
    ↓ JSON.stringify
'{"username":"john","token":"abc123","theme":"dark"}'
    ↓ AES-256-GCM encrypt (with your password)
"U2FsdGVkX1+3qZ7vKx8m..."
    ↓ stored in localStorage/sessionStorage
```

### On Read (`getItem('token')`)

```
"U2FsdGVkX1+3qZ7vKx8m..."
    ↓ AES-256-GCM decrypt (with your password)
{ username: "john", token: "abc123", theme: "dark" }
    ↓ return data["token"]
"abc123"
```

## Security Details

| Parameter | Value |
|-----------|-------|
| Cipher | AES-GCM with 256-bit key |
| Key Derivation | PBKDF2, SHA-256, 100,000 iterations |
| Salt | 16 random bytes (regenerated on every write) |
| IV/Nonce | 12 random bytes (regenerated on every write) |
| Tamper Detection | AES-GCM authentication tag |
| Dependencies | Zero — uses the browser's native Web Crypto API |

Every write generates a **fresh random salt and IV**, so the same data never produces the same ciphertext twice.

## Error Handling

The package exports three error classes for precise error handling:

```ts
import {
  SecureStorage,
  EncryptStorageError,  // Base error class
  DecryptionError,      // Wrong password or corrupted data
  StorageUnavailableError, // localStorage/sessionStorage not available
} from 'encrypt-storage-lite';

try {
  const data = await store.getItem('key');
} catch (error) {
  if (error instanceof DecryptionError) {
    console.error('Wrong password or data was tampered with');
  }
  if (error instanceof StorageUnavailableError) {
    console.error('Storage is not available in this environment');
  }
}
```

## Browser Support

Works in all modern browsers that support the [Web Crypto API](https://caniuse.com/cryptography):

- Chrome 37+
- Firefox 34+
- Safari 11+
- Edge 79+

## License

MIT
