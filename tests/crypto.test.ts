import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../src/crypto';
import { DecryptionError } from '../src/errors';

describe('crypto', () => {
  const secret = 'test-password-123';

  describe('encrypt → decrypt round-trip', () => {
    it('should round-trip a simple string', async () => {
      const plaintext = 'Hello, World!';
      const encrypted = await encrypt(plaintext, secret);
      const decrypted = await decrypt(encrypted, secret);
      expect(decrypted).toBe(plaintext);
    });

    it('should round-trip an empty string', async () => {
      const plaintext = '';
      const encrypted = await encrypt(plaintext, secret);
      const decrypted = await decrypt(encrypted, secret);
      expect(decrypted).toBe(plaintext);
    });

    it('should round-trip a JSON string', async () => {
      const data = { name: 'John', age: 30, items: [1, 2, 3] };
      const plaintext = JSON.stringify(data);
      const encrypted = await encrypt(plaintext, secret);
      const decrypted = await decrypt(encrypted, secret);
      expect(JSON.parse(decrypted)).toEqual(data);
    });

    it('should round-trip unicode content (emoji, CJK)', async () => {
      const plaintext = '你好世界 🌍🔐 こんにちは café résumé';
      const encrypted = await encrypt(plaintext, secret);
      const decrypted = await decrypt(encrypted, secret);
      expect(decrypted).toBe(plaintext);
    });

    it('should round-trip a large payload (~100KB)', async () => {
      const plaintext = 'x'.repeat(100_000);
      const encrypted = await encrypt(plaintext, secret);
      const decrypted = await decrypt(encrypted, secret);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('encryption uniqueness', () => {
    it('should produce different ciphertext for the same input', async () => {
      const plaintext = 'same data';
      const encrypted1 = await encrypt(plaintext, secret);
      const encrypted2 = await encrypt(plaintext, secret);
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to the same value
      const decrypted1 = await decrypt(encrypted1, secret);
      const decrypted2 = await decrypt(encrypted2, secret);
      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
    });
  });

  describe('decryption errors', () => {
    it('should throw DecryptionError with wrong password', async () => {
      const encrypted = await encrypt('secret data', secret);
      await expect(decrypt(encrypted, 'wrong-password')).rejects.toThrow(
        DecryptionError,
      );
    });

    it('should throw DecryptionError for truncated data', async () => {
      // Less than 44 bytes (salt + iv + auth tag minimum)
      const shortData = btoa('too-short');
      await expect(decrypt(shortData, secret)).rejects.toThrow(
        DecryptionError,
      );
      await expect(decrypt(shortData, secret)).rejects.toThrow(
        'Data is too short',
      );
    });

    it('should throw DecryptionError for corrupted data', async () => {
      const encrypted = await encrypt('test', secret);
      // Corrupt the ciphertext by changing characters in the middle
      const corrupted =
        encrypted.slice(0, 50) + 'XXXX' + encrypted.slice(54);
      await expect(decrypt(corrupted, secret)).rejects.toThrow(
        DecryptionError,
      );
    });

    it('should throw DecryptionError for invalid base64', async () => {
      await expect(decrypt('not-valid-base64!!!', secret)).rejects.toThrow(
        DecryptionError,
      );
    });

    it('should throw DecryptionError for random garbage bytes', async () => {
      // Random valid base64 that isn't valid encrypted data
      const randomBytes = new Uint8Array(100);
      crypto.getRandomValues(randomBytes);
      const garbage = btoa(String.fromCharCode(...randomBytes));
      await expect(decrypt(garbage, secret)).rejects.toThrow(
        DecryptionError,
      );
    });
  });
});
