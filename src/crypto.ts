import { DEFAULTS } from './constants';
import { DecryptionError } from './errors';

/**
 * Convert a Uint8Array to a base64 string.
 * Uses chunked processing to avoid call stack overflow on large payloads.
 */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/**
 * Convert a base64 string to a Uint8Array.
 */
function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive an AES-GCM CryptoKey from a password and salt using PBKDF2.
 */
export async function deriveKey(
  secret: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const secretBytes = encoder.encode(secret);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: DEFAULTS.PBKDF2_ITERATIONS,
      hash: DEFAULTS.PBKDF2_HASH,
    },
    baseKey,
    {
      name: DEFAULTS.AES_ALGORITHM,
      length: DEFAULTS.AES_KEY_LENGTH,
    },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt a plaintext string using AES-GCM.
 *
 * Generates a fresh random salt and IV on every call for maximum security.
 * Returns base64(salt ‖ iv ‖ ciphertext).
 */
export async function encrypt(
  plaintext: string,
  secret: string,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(DEFAULTS.SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(DEFAULTS.IV_LENGTH));

  const key = await deriveKey(secret, salt);

  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: DEFAULTS.AES_ALGORITHM, iv },
    key,
    plaintextBytes,
  );

  const ciphertext = new Uint8Array(ciphertextBuffer);

  // Concatenate: salt (16) + iv (12) + ciphertext (variable)
  const combined = new Uint8Array(
    DEFAULTS.SALT_LENGTH + DEFAULTS.IV_LENGTH + ciphertext.byteLength,
  );
  combined.set(salt, 0);
  combined.set(iv, DEFAULTS.SALT_LENGTH);
  combined.set(ciphertext, DEFAULTS.SALT_LENGTH + DEFAULTS.IV_LENGTH);

  return uint8ToBase64(combined);
}

/**
 * Decrypt a base64(salt ‖ iv ‖ ciphertext) string back to plaintext.
 *
 * @throws {DecryptionError} if the password is wrong, data is corrupted, or data is truncated.
 */
export async function decrypt(
  encoded: string,
  secret: string,
): Promise<string> {
  let combined: Uint8Array;

  try {
    combined = base64ToUint8(encoded);
  } catch (error) {
    throw new DecryptionError('Invalid base64 data.', { cause: error });
  }

  // Minimum length: salt (16) + iv (12) + AES-GCM auth tag (16) = 44 bytes
  const minLength =
    DEFAULTS.SALT_LENGTH + DEFAULTS.IV_LENGTH + 16; // 16 = GCM auth tag
  if (combined.length < minLength) {
    throw new DecryptionError(
      'Data is too short to be valid encrypted content.',
    );
  }

  const salt = combined.slice(0, DEFAULTS.SALT_LENGTH);
  const iv = combined.slice(
    DEFAULTS.SALT_LENGTH,
    DEFAULTS.SALT_LENGTH + DEFAULTS.IV_LENGTH,
  );
  const ciphertext = combined.slice(
    DEFAULTS.SALT_LENGTH + DEFAULTS.IV_LENGTH,
  );

  const key = await deriveKey(secret, salt);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: DEFAULTS.AES_ALGORITHM, iv },
      key,
      ciphertext,
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    throw new DecryptionError(undefined, { cause: error });
  }
}
