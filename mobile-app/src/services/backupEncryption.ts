// Backup Encryption Service
// v3: AES-256-GCM + PBKDF2-SHA256 via Web Crypto API (crypto.subtle)
// Backward compatibility: v2 AES-256-CTR + HMAC decrypt path preserved

import * as Crypto from 'expo-crypto';
import * as aesjs from 'aes-js';
import { Buffer } from 'buffer';
import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/ciphers/webcrypto.js';

// =============================================================================
// Types
// =============================================================================

export interface EncryptedBackup {
  version: number;
  format: 'aes-256-gcm';
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
  authTag: string; // base64 - GCM auth tag
  timestamp: number;
  walletName?: string;
  seedFingerprint?: string;
}

interface LegacyEncryptedBackupV2 {
  version: number;
  format: 'aes-256-ctr-hmac';
  salt: string;
  iv: string;
  ciphertext: string;
  mac: string;
  timestamp: number;
  walletName?: string;
  seedFingerprint?: string;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'veryWeak' | 'weak' | 'fair' | 'strong' | 'veryStrong';
  isValid: boolean;
  feedback: string[];
}

// =============================================================================
// Constants
// =============================================================================

const PBKDF2_ITERATIONS_V3 = 100000;
const PBKDF2_ITERATIONS_V2 = 10000;
const SALT_LENGTH = 32;
const IV_LENGTH_GCM = 12;
const IV_LENGTH_V2 = 16;
const KEY_LENGTH = 32;
const BACKUP_VERSION = 3;

// =============================================================================
// Helpers
// =============================================================================

function uint8ArrayToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function base64ToUint8Array(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function uint8ArrayToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

export function clearSensitiveString(_value: string): void {
  // Best effort only; strings are immutable in JS.
}

// =============================================================================
// Password validation
// =============================================================================

export function validatePasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  if (password.length < 8) {
    feedback.push('Password must be at least 8 characters');
  } else {
    score++;
    if (password.length >= 12) {
      score++;
    }
  }

  if (!/[A-Z]/.test(password)) {
    feedback.push('Add at least one uppercase letter');
  } else {
    score++;
  }

  if (!/[a-z]/.test(password)) {
    feedback.push('Add at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    feedback.push('Add at least one number');
  } else {
    score++;
  }

  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score++;
  }

  const labels: Array<PasswordStrength['label']> = [
    'veryWeak',
    'weak',
    'fair',
    'strong',
    'veryStrong',
  ];

  const isValid =
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password);

  return {
    score: Math.min(4, Math.max(0, score)) as PasswordStrength['score'],
    label: labels[Math.min(4, Math.max(0, score))],
    isValid,
    feedback,
  };
}

// =============================================================================
// v3 encryption/decryption (AES-GCM)
// =============================================================================

export async function encryptMnemonic(
  mnemonic: string,
  password: string,
  walletName?: string
): Promise<EncryptedBackup> {
  try {
    const strength = validatePasswordStrength(password);
    if (!strength.isValid) {
      throw new Error('Password does not meet security requirements');
    }

    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH_GCM);
    const key = pbkdf2(sha256, password, salt, { c: PBKDF2_ITERATIONS_V3, dkLen: KEY_LENGTH });

    const aes = gcm(key, iv);
    const encrypted = aes.encrypt(new TextEncoder().encode(mnemonic));
    // @noble/ciphers returns ciphertext + 16-byte authTag
    const ciphertext = encrypted.slice(0, encrypted.length - 16);
    const authTag = encrypted.slice(encrypted.length - 16);

    return {
      version: BACKUP_VERSION,
      format: 'aes-256-gcm',
      salt: Buffer.from(salt).toString('base64'),
      iv: Buffer.from(iv).toString('base64'),
      ciphertext: Buffer.from(ciphertext).toString('base64'),
      authTag: Buffer.from(authTag).toString('base64'),
      timestamp: Date.now(),
      walletName,
    };
  } catch (error) {
    console.error('❌ [BackupEncryption] Encryption failed:', error);
    throw new Error('Failed to encrypt seed phrase');
  }
}

export async function decryptMnemonic(
  backup: EncryptedBackup,
  password: string
): Promise<string> {
  try {
    if (backup.version <= 2) {
      return await decryptMnemonicV2(backup as unknown as LegacyEncryptedBackupV2, password);
    }

    if (backup.version !== BACKUP_VERSION || backup.format !== 'aes-256-gcm') {
      throw new Error('Unsupported backup format/version');
    }

    const salt = new Uint8Array(Buffer.from(backup.salt, 'base64'));
    const iv = new Uint8Array(Buffer.from(backup.iv, 'base64'));
    const ciphertext = new Uint8Array(Buffer.from(backup.ciphertext, 'base64'));
    const authTag = new Uint8Array(Buffer.from(backup.authTag, 'base64'));

    const key = pbkdf2(sha256, password, salt, { c: PBKDF2_ITERATIONS_V3, dkLen: KEY_LENGTH });

    // @noble/ciphers expects ciphertext + authTag concatenated
    const combined = new Uint8Array(ciphertext.length + authTag.length);
    combined.set(ciphertext);
    combined.set(authTag, ciphertext.length);

    const aes = gcm(key, iv);
    const decrypted = aes.decrypt(combined);

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('❌ [BackupEncryption] Decryption failed:', error);
    throw new Error('Failed to decrypt backup. Please check your password.');
  }
}

// =============================================================================
// Legacy v2 decrypt path (preserved for backward compatibility)
// =============================================================================

async function deriveKeysV2(
  password: string,
  salt: Uint8Array
): Promise<{ encryptionKey: Uint8Array; macKey: Uint8Array }> {
  const passwordBytes = stringToUint8Array(password);

  const initialData = concatUint8Arrays(passwordBytes, salt);
  let hash = hexToUint8Array(
    await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      uint8ArrayToHex(initialData),
      { encoding: Crypto.CryptoEncoding.HEX }
    )
  );

  const batchSize = 1000;
  for (let i = 1; i < PBKDF2_ITERATIONS_V2; i += batchSize) {
    const iterations = Math.min(batchSize, PBKDF2_ITERATIONS_V2 - i);
    for (let j = 0; j < iterations; j++) {
      const data = concatUint8Arrays(hash, passwordBytes, salt);
      hash = hexToUint8Array(
        await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          uint8ArrayToHex(data),
          { encoding: Crypto.CryptoEncoding.HEX }
        )
      );
    }
    if (i + batchSize < PBKDF2_ITERATIONS_V2) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  const encKeyData = concatUint8Arrays(stringToUint8Array('enc'), hash);
  const macKeyData = concatUint8Arrays(stringToUint8Array('mac'), hash);

  const encryptionKey = hexToUint8Array(
    await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      uint8ArrayToHex(encKeyData),
      { encoding: Crypto.CryptoEncoding.HEX }
    )
  );

  const macKey = hexToUint8Array(
    await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      uint8ArrayToHex(macKeyData),
      { encoding: Crypto.CryptoEncoding.HEX }
    )
  );

  return { encryptionKey, macKey };
}

async function computeHmacV2(
  key: Uint8Array,
  message: Uint8Array
): Promise<Uint8Array> {
  const blockSize = 64;

  let keyToUse = key;
  if (key.length > blockSize) {
    keyToUse = hexToUint8Array(
      await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        uint8ArrayToHex(key),
        { encoding: Crypto.CryptoEncoding.HEX }
      )
    );
  }

  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(keyToUse);

  const ipad = new Uint8Array(blockSize);
  const opad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    ipad[i] = paddedKey[i] ^ 0x36;
    opad[i] = paddedKey[i] ^ 0x5c;
  }

  const innerData = concatUint8Arrays(ipad, message);
  const innerHash = hexToUint8Array(
    await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      uint8ArrayToHex(innerData),
      { encoding: Crypto.CryptoEncoding.HEX }
    )
  );

  const outerData = concatUint8Arrays(opad, innerHash);
  return hexToUint8Array(
    await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      uint8ArrayToHex(outerData),
      { encoding: Crypto.CryptoEncoding.HEX }
    )
  );
}

export async function decryptMnemonicV2(
  backup: LegacyEncryptedBackupV2,
  password: string
): Promise<string> {
  if (backup.version !== 2 || backup.format !== 'aes-256-ctr-hmac') {
    throw new Error('Unsupported legacy backup version/format');
  }

  const salt = base64ToUint8Array(backup.salt);
  const iv = base64ToUint8Array(backup.iv);
  const ciphertext = base64ToUint8Array(backup.ciphertext);
  const storedMac = base64ToUint8Array(backup.mac);

  const { encryptionKey, macKey } = await deriveKeysV2(password, salt);

  const dataToMac = concatUint8Arrays(iv, ciphertext);
  const computedMac = await computeHmacV2(macKey, dataToMac);

  if (!constantTimeEqual(storedMac, computedMac)) {
    throw new Error('MAC verification failed - data may be tampered or wrong password');
  }

  if (iv.length !== IV_LENGTH_V2) {
    throw new Error('Invalid legacy IV length');
  }

  const aesCtr = new aesjs.ModeOfOperation.ctr(
    Array.from(encryptionKey),
    new aesjs.Counter(Array.from(iv))
  );
  const plaintextBytes = new Uint8Array(aesCtr.decrypt(ciphertext));
  return uint8ArrayToString(plaintextBytes);
}

// =============================================================================
// Validation
// =============================================================================

export function validateBackupStructure(backup: unknown): backup is EncryptedBackup {
  if (typeof backup !== 'object' || backup === null) {
    return false;
  }

  const b = backup as Record<string, unknown>;

  const isV3 =
    typeof b.version === 'number' &&
    b.version >= 3 &&
    b.format === 'aes-256-gcm' &&
    typeof b.salt === 'string' &&
    typeof b.iv === 'string' &&
    typeof b.ciphertext === 'string' &&
    typeof b.authTag === 'string' &&
    typeof b.timestamp === 'number';

  const isV2 =
    typeof b.version === 'number' &&
    b.version <= 2 &&
    b.format === 'aes-256-ctr-hmac' &&
    typeof b.salt === 'string' &&
    typeof b.iv === 'string' &&
    typeof b.ciphertext === 'string' &&
    typeof b.mac === 'string' &&
    typeof b.timestamp === 'number';

  return isV3 || isV2;
}

export function isEncryptionAvailable(): boolean {
  return true;
}
