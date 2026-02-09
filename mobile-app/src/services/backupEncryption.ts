// Backup Encryption Service
// Production-grade AES-256-CTR + HMAC-SHA256 encryption for seed phrase backups
// Uses expo-crypto for randomness and hashing, aes-js for AES encryption
// This implementation is compatible with React Native (no Web Crypto API dependency)

import * as Crypto from 'expo-crypto';
import * as aesjs from 'aes-js';

// =============================================================================
// Types
// =============================================================================

export interface EncryptedBackup {
  version: number;
  format: 'aes-256-ctr-hmac';
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
  mac: string; // base64 - HMAC for authentication
  timestamp: number;
  walletName?: string;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4; // 0 = very weak, 4 = very strong
  label: 'veryWeak' | 'weak' | 'fair' | 'strong' | 'veryStrong';
  isValid: boolean;
  feedback: string[];
}

// =============================================================================
// Constants
// =============================================================================

const PBKDF2_ITERATIONS = 10000; // 10k iterations — balanced for mobile JS performance
const SALT_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits for CTR mode
const KEY_LENGTH = 32; // 256 bits (32 bytes)
const MAC_KEY_LENGTH = 32; // 256 bits for HMAC key
const BACKUP_VERSION = 2; // Version 2 for new format

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert Uint8Array to base64 string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert string to Uint8Array (UTF-8)
 */
function stringToUint8Array(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

/**
 * Convert Uint8Array to string (UTF-8)
 */
function uint8ArrayToString(bytes: Uint8Array): string {
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

/**
 * Convert hex string to Uint8Array
 */
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Concatenate multiple Uint8Arrays
 */
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

/**
 * Constant-time comparison to prevent timing attacks
 */
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

/**
 * Generate cryptographically secure random bytes
 */
async function generateRandomBytes(length: number): Promise<Uint8Array> {
  const randomBytesArray = await Crypto.getRandomBytesAsync(length);
  return new Uint8Array(randomBytesArray);
}

/**
 * Clear sensitive data from a string (best effort)
 * Note: JavaScript strings are immutable, so this creates a new empty string
 * The original string may remain in memory until garbage collected
 */
export function clearSensitiveString(_value: string): void {
  // In JavaScript, we can't truly clear strings from memory
  // But we can help GC by dereferencing
  // The caller should set their variable to empty string or undefined
}

// =============================================================================
// Password Validation
// =============================================================================

/**
 * Validate password strength
 * Returns detailed feedback about password quality
 */
export function validatePasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  // Minimum length check (required)
  if (password.length < 8) {
    feedback.push('Password must be at least 8 characters');
  } else {
    score++;
    if (password.length >= 12) {
      score++;
    }
  }

  // Uppercase check
  if (!/[A-Z]/.test(password)) {
    feedback.push('Add at least one uppercase letter');
  } else {
    score++;
  }

  // Lowercase check
  if (!/[a-z]/.test(password)) {
    feedback.push('Add at least one lowercase letter');
  }

  // Number check
  if (!/[0-9]/.test(password)) {
    feedback.push('Add at least one number');
  } else {
    score++;
  }

  // Special character (optional but recommended)
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score++;
  }

  // Determine label and validity
  const labels: Array<PasswordStrength['label']> = [
    'veryWeak',
    'weak',
    'fair',
    'strong',
    'veryStrong',
  ];

  // Password is valid if: 8+ chars, has uppercase, lowercase, and number
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
// Key Derivation (PBKDF2-like using expo-crypto)
// =============================================================================

/**
 * Derive encryption and MAC keys from password using PBKDF2-like iteration
 * Uses iterated SHA-256 hashing since expo-crypto doesn't have native PBKDF2
 *
 * This implements: key = SHA256(SHA256(...SHA256(password + salt)...))
 * iterated PBKDF2_ITERATIONS times, then derives two keys from the result
 */
async function deriveKeys(
  password: string,
  salt: Uint8Array
): Promise<{ encryptionKey: Uint8Array; macKey: Uint8Array }> {
  const passwordBytes = stringToUint8Array(password);

  // Initial hash: SHA256(password || salt)
  const initialData = concatUint8Arrays(passwordBytes, salt);
  let hash = hexToUint8Array(
    await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      uint8ArrayToHex(initialData),
      { encoding: Crypto.CryptoEncoding.HEX }
    )
  );

  // Iterate: hash = SHA256(hash || password || salt) for PBKDF2_ITERATIONS times
  // We do this in batches to avoid blocking the UI thread
  const batchSize = 1000;
  for (let i = 1; i < PBKDF2_ITERATIONS; i += batchSize) {
    const iterations = Math.min(batchSize, PBKDF2_ITERATIONS - i);
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
    // Allow UI thread to breathe every batch
    if (i + batchSize < PBKDF2_ITERATIONS) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  // Derive two keys from the final hash
  // encryptionKey = SHA256("enc" || hash)
  // macKey = SHA256("mac" || hash)
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

/**
 * Compute HMAC-SHA256 using expo-crypto
 * HMAC(key, message) = SHA256((key XOR opad) || SHA256((key XOR ipad) || message))
 */
async function computeHmac(
  key: Uint8Array,
  message: Uint8Array
): Promise<Uint8Array> {
  const blockSize = 64; // SHA-256 block size

  // If key is longer than block size, hash it first
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

  // Pad key to block size
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(keyToUse);

  // Create ipad and opad
  const ipad = new Uint8Array(blockSize);
  const opad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    ipad[i] = paddedKey[i] ^ 0x36;
    opad[i] = paddedKey[i] ^ 0x5c;
  }

  // Inner hash: SHA256(ipad || message)
  const innerData = concatUint8Arrays(ipad, message);
  const innerHash = hexToUint8Array(
    await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      uint8ArrayToHex(innerData),
      { encoding: Crypto.CryptoEncoding.HEX }
    )
  );

  // Outer hash: SHA256(opad || innerHash)
  const outerData = concatUint8Arrays(opad, innerHash);
  const hmac = hexToUint8Array(
    await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      uint8ArrayToHex(outerData),
      { encoding: Crypto.CryptoEncoding.HEX }
    )
  );

  return hmac;
}

// =============================================================================
// Encryption/Decryption
// =============================================================================

/**
 * Encrypt a seed phrase with a password
 * Uses AES-256-CTR with HMAC-SHA256 for authenticated encryption (Encrypt-then-MAC)
 *
 * @param mnemonic - The seed phrase to encrypt
 * @param password - User-provided password (must pass validation)
 * @param walletName - Optional wallet name to include in backup metadata
 * @returns Encrypted backup object ready to be saved
 */
export async function encryptMnemonic(
  mnemonic: string,
  password: string,
  walletName?: string
): Promise<EncryptedBackup> {
  try {
    // Validate password strength
    const strength = validatePasswordStrength(password);
    if (!strength.isValid) {
      throw new Error('Password does not meet security requirements');
    }

    // Generate random salt and IV
    const salt = await generateRandomBytes(SALT_LENGTH);
    const iv = await generateRandomBytes(IV_LENGTH);

    // Derive encryption and MAC keys
    const { encryptionKey, macKey } = await deriveKeys(password, salt);

    // Encrypt the mnemonic using AES-256-CTR
    const plaintextBytes = stringToUint8Array(mnemonic);
    const aesCtr = new aesjs.ModeOfOperation.ctr(
      Array.from(encryptionKey),
      new aesjs.Counter(Array.from(iv))
    );
    const ciphertextBytes = new Uint8Array(aesCtr.encrypt(plaintextBytes));

    // Compute HMAC over (iv || ciphertext) for authentication
    const dataToMac = concatUint8Arrays(iv, ciphertextBytes);
    const mac = await computeHmac(macKey, dataToMac);

    // Build the encrypted backup object
    const backup: EncryptedBackup = {
      version: BACKUP_VERSION,
      format: 'aes-256-ctr-hmac',
      salt: uint8ArrayToBase64(salt),
      iv: uint8ArrayToBase64(iv),
      ciphertext: uint8ArrayToBase64(ciphertextBytes),
      mac: uint8ArrayToBase64(mac),
      timestamp: Date.now(),
      walletName,
    };

    console.log('✅ [BackupEncryption] Mnemonic encrypted successfully');
    return backup;
  } catch (error) {
    console.error('❌ [BackupEncryption] Encryption failed:', error);
    throw new Error('Failed to encrypt seed phrase');
  }
}

/**
 * Decrypt a seed phrase from an encrypted backup
 *
 * @param backup - The encrypted backup object
 * @param password - User-provided password
 * @returns The decrypted seed phrase
 */
export async function decryptMnemonic(
  backup: EncryptedBackup,
  password: string
): Promise<string> {
  try {
    // Validate backup format
    if (backup.version !== BACKUP_VERSION) {
      throw new Error('Unsupported backup version');
    }
    if (backup.format !== 'aes-256-ctr-hmac') {
      throw new Error('Unsupported encryption format');
    }

    // Decode base64 values
    const salt = base64ToUint8Array(backup.salt);
    const iv = base64ToUint8Array(backup.iv);
    const ciphertext = base64ToUint8Array(backup.ciphertext);
    const storedMac = base64ToUint8Array(backup.mac);

    // Derive keys from password
    const { encryptionKey, macKey } = await deriveKeys(password, salt);

    // Verify HMAC FIRST (before decryption) - this is critical for security
    const dataToMac = concatUint8Arrays(iv, ciphertext);
    const computedMac = await computeHmac(macKey, dataToMac);

    if (!constantTimeEqual(storedMac, computedMac)) {
      throw new Error('MAC verification failed - data may be tampered or wrong password');
    }

    // Decrypt the mnemonic using AES-256-CTR
    const aesCtr = new aesjs.ModeOfOperation.ctr(
      Array.from(encryptionKey),
      new aesjs.Counter(Array.from(iv))
    );
    const plaintextBytes = new Uint8Array(aesCtr.decrypt(ciphertext));
    const mnemonic = uint8ArrayToString(plaintextBytes);

    console.log('✅ [BackupEncryption] Mnemonic decrypted successfully');
    return mnemonic;
  } catch (error) {
    console.error('❌ [BackupEncryption] Decryption failed:', error);
    // Don't reveal whether password was wrong or data corrupted
    throw new Error('Failed to decrypt backup. Please check your password.');
  }
}

/**
 * Validate that an encrypted backup has the correct structure
 */
export function validateBackupStructure(backup: unknown): backup is EncryptedBackup {
  if (typeof backup !== 'object' || backup === null) {
    return false;
  }

  const b = backup as Record<string, unknown>;

  return (
    typeof b.version === 'number' &&
    b.format === 'aes-256-ctr-hmac' &&
    typeof b.salt === 'string' &&
    typeof b.iv === 'string' &&
    typeof b.ciphertext === 'string' &&
    typeof b.mac === 'string' &&
    typeof b.timestamp === 'number'
  );
}

/**
 * Check if encryption is available
 * Always returns true since we use pure JS + expo-crypto which is always available
 */
export function isEncryptionAvailable(): boolean {
  return true;
}
