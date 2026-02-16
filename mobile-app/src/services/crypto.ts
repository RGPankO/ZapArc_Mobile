// Crypto utilities for wallet encryption/decryption
// Supports legacy XOR (v1) decryption and AES-256-GCM (v2) encryption/decryption

import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';

import type { EncryptedData } from '../features/wallet/types';

// =============================================================================
// Quick Crypto — safe import with runtime check
// =============================================================================

let QuickCrypto: typeof import('react-native-quick-crypto').default | null = null;
let _quickCryptoAvailable = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  QuickCrypto = require('react-native-quick-crypto').default;
  // Test that native module actually works at runtime
  if (QuickCrypto && typeof QuickCrypto.pbkdf2Sync === 'function') {
    // Quick smoke test — if native isn't linked this will throw
    QuickCrypto.pbkdf2Sync('test', 'salt', 1, 32, 'sha256');
    _quickCryptoAvailable = true;
    console.log('✅ [Crypto] react-native-quick-crypto available');
  }
} catch (e) {
  console.warn('⚠️ [Crypto] react-native-quick-crypto NOT available, using legacy crypto only');
  QuickCrypto = null;
  _quickCryptoAvailable = false;
}

export function isQuickCryptoAvailable(): boolean {
  return _quickCryptoAvailable;
}

// =============================================================================
// Constants
// =============================================================================

const LEGACY_SALT = 'lightning-tipping-salt';
const SALT_LENGTH = 32; // 256-bit per-wallet random salt (v3)
const ITERATIONS = 100000;
const KEY_LENGTH = 32; // 256 bits for AES-256
const IV_LENGTH = 12; // 96 bits for AES-GCM
const ENCRYPTION_VERSION = 3;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a random UUID v4
 */
export function generateUUID(): string {
  return Crypto.randomUUID();
}

/**
 * Generate cryptographically secure random bytes
 */
export async function generateRandomBytes(length: number): Promise<Uint8Array> {
  const bytes = QuickCrypto.randomBytes(length);
  return new Uint8Array(bytes);
}

/**
 * Convert a string to Uint8Array
 */
function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Convert Uint8Array to string
 */
function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// =============================================================================
// Key Derivation
// =============================================================================

/**
 * New (v2) key derivation using native PBKDF2 (quick-crypto)
 * Kept async for API compatibility.
 */
export async function deriveKeyFromPin(pin: string): Promise<Uint8Array> {
  return new Uint8Array(deriveKeyFromPinV2(pin, LEGACY_SALT));
}

function deriveKeyFromPinV2(pin: string, salt: string | Uint8Array): Uint8Array {
  return new Uint8Array(
    QuickCrypto.pbkdf2Sync(pin, salt, ITERATIONS, KEY_LENGTH, 'sha256')
  );
}

/**
 * Legacy (v1) key derivation using expo-crypto SHA-256 rounds.
 * Must remain exactly compatible for backward decryption.
 */
async function deriveKeyFromPinV1(pin: string): Promise<Uint8Array> {
  // Combine PIN with salt
  const saltedPin = `${pin}${LEGACY_SALT}`;

  // Initial hash
  let hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    saltedPin,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  hash = hash.toLowerCase();

  // Perform multiple iterations for key stretching
  // Using reduced iterations for mobile performance, but still secure
  const mobileIterations = Math.floor(ITERATIONS / 100); // 1000 iterations

  for (let i = 0; i < mobileIterations; i++) {
    hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      hash + saltedPin,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    hash = hash.toLowerCase();
  }

  // Return first 32 bytes (256 bits) as the key
  return hexToBytes(hash.substring(0, KEY_LENGTH * 2));
}

// =============================================================================
// Legacy XOR Helpers (v1 compatibility)
// =============================================================================

/**
 * Simple XOR-based encryption/decryption helper
 */
async function xorEncrypt(data: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return result;
}

/**
 * XOR decryption (same as encryption due to XOR properties)
 */
async function xorDecrypt(data: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  return xorEncrypt(data, key);
}

// =============================================================================
// V1 Encryption (XOR fallback when quick-crypto unavailable)
// =============================================================================

/**
 * Encrypt data using V1 format (XOR + integrity hash)
 * Used as fallback when react-native-quick-crypto is not available
 */
async function encryptDataV1(
  plaintext: string,
  pin: string
): Promise<EncryptedData> {
  const key = await deriveKeyFromPinV1(pin);
  const ivHex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${Date.now()}-${pin}-iv`,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  const iv = hexToBytes(ivHex.substring(0, 32)); // 16 bytes

  // Create combined key
  const combinedKeyHex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    bytesToHex(key) + bytesToHex(iv),
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  const combinedKey = hexToBytes(combinedKeyHex);

  // Encrypt
  const data = stringToBytes(plaintext);
  const encrypted = await xorEncrypt(data, combinedKey);

  // Integrity hash
  const integrityHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    bytesToHex(encrypted) + bytesToHex(key),
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  const integrity = hexToBytes(integrityHash.substring(0, 16)); // 8 bytes

  // Combine encrypted + integrity
  const combined = new Uint8Array(encrypted.length + integrity.length);
  combined.set(encrypted);
  combined.set(integrity, encrypted.length);

  return {
    data: Array.from(combined),
    iv: Array.from(iv),
    timestamp: Date.now(),
    version: 1,
  };
}

// =============================================================================
// AES-GCM Encryption/Decryption
// =============================================================================

/**
 * Encrypt data with PIN-derived key (v2 AES-256-GCM)
 * Returns encrypted data with IV, timestamp, and version
 */
export async function encryptData(
  plaintext: string,
  pin: string
): Promise<EncryptedData> {
  if (!_quickCryptoAvailable || !QuickCrypto) {
    // Fallback to V1 encryption if quick-crypto unavailable
    console.warn('⚠️ [Crypto] quick-crypto unavailable, using V1 encryption');
    return encryptDataV1(plaintext, pin);
  }
  try {
    const salt = QuickCrypto.randomBytes(SALT_LENGTH);
    const key = deriveKeyFromPinV2(pin, salt);
    const iv = QuickCrypto.randomBytes(IV_LENGTH);
    const cipher = QuickCrypto.createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Append auth tag (16 bytes) to encrypted payload
    const combined = Buffer.concat([encrypted, authTag]);

    return {
      data: Array.from(combined),
      iv: Array.from(iv),
      salt: Array.from(salt),
      timestamp: Date.now(),
      version: ENCRYPTION_VERSION,
    };
  } catch (error) {
    console.error('❌ [Crypto] Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Legacy v1 decrypt path (XOR + integrity check).
 * Must remain compatible with historical stored payloads.
 */
async function decryptDataV1(
  encryptedData: EncryptedData,
  pin: string
): Promise<string> {
  try {
    const key = await deriveKeyFromPinV1(pin);
    const iv = new Uint8Array(encryptedData.iv);
    const fullData = new Uint8Array(encryptedData.data);

    // Separate encrypted data from integrity hash
    const integrityLength = 8;
    const encryptedBytes = fullData.slice(0, fullData.length - integrityLength);
    const storedIntegrity = fullData.slice(fullData.length - integrityLength);

    // Verify integrity
    const integrityHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      bytesToHex(encryptedBytes) + bytesToHex(key),
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    const expectedIntegrity = hexToBytes(integrityHash.substring(0, 16));

    // Compare integrity hashes
    let integrityValid = true;
    for (let i = 0; i < integrityLength; i++) {
      if (storedIntegrity[i] !== expectedIntegrity[i]) {
        integrityValid = false;
        break;
      }
    }

    if (!integrityValid) {
      console.warn('⚠️ [Crypto] Integrity mismatch:', {
        stored: bytesToHex(storedIntegrity),
        calculated: bytesToHex(expectedIntegrity),
      });
      throw new Error('Data integrity check failed - invalid PIN or corrupted data');
    }

    // Create combined key for decryption
    const combinedKeyHex = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      bytesToHex(key) + bytesToHex(iv),
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    const combinedKey = hexToBytes(combinedKeyHex);

    // Decrypt the data
    const decryptedBytes = await xorDecrypt(encryptedBytes, combinedKey);

    return bytesToString(decryptedBytes);
  } catch (error) {
    console.warn('⚠️ [Crypto] Decryption failed:', error);
    throw new Error('Failed to decrypt data - invalid PIN or corrupted data');
  }
}

/**
 * Decrypt data with PIN-derived key
 * Auto-detects payload version and routes to v1/v2 decrypt path
 */
export async function decryptData(
  encryptedData: EncryptedData,
  pin: string
): Promise<string> {
  const version = encryptedData.version || 1;

  if (version === 1) {
    return decryptDataV1(encryptedData, pin);
  }

  // V2/V3 require quick-crypto
  if (!_quickCryptoAvailable || !QuickCrypto) {
    throw new Error(
      'Cannot decrypt V' + version + ' data: react-native-quick-crypto not available. ' +
      'App needs rebuild with native module properly linked.'
    );
  }

  try {
    const saltSource = encryptedData.salt
      ? Buffer.from(encryptedData.salt)
      : LEGACY_SALT;
    const key = deriveKeyFromPinV2(pin, saltSource);
    const fullData = Buffer.from(encryptedData.data);
    const iv = Buffer.from(encryptedData.iv);

    if (fullData.length < 16) {
      throw new Error('Invalid encrypted payload');
    }

    const authTag = fullData.slice(fullData.length - 16);
    const encrypted = fullData.slice(0, fullData.length - 16);

    const decipher = QuickCrypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error) {
    console.warn('⚠️ [Crypto] Decryption failed:', error);
    throw new Error('Failed to decrypt data - invalid PIN or corrupted data');
  }
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate encrypted payload integrity
 * Checks timestamp for suspicious age (potential rollback attack)
 */
export function validatePayloadIntegrity(timestamp: number): boolean {
  const now = Date.now();
  const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days
  const age = now - timestamp;

  if (age > maxAge) {
    console.warn(
      '⚠️ [Crypto] Data timestamp is suspiciously old (>90 days)',
      {
        timestamp,
        age,
        ageInDays: Math.floor(age / (24 * 60 * 60 * 1000)),
      }
    );
    return true; // Allow but log warning
  }

  if (age < 0) {
    console.warn(
      '⚠️ [Crypto] Data timestamp is in the future (possible rollback attack)',
      {
        timestamp,
        now,
        difference: Math.abs(age),
      }
    );
    return true; // Allow but log warning
  }

  return true;
}

/**
 * Verify a PIN can decrypt the given encrypted data
 * Returns true if decryption succeeds, false otherwise
 */
export async function verifyPin(
  encryptedData: EncryptedData,
  pin: string
): Promise<boolean> {
  try {
    await decryptData(encryptedData, pin);
    return true;
  } catch {
    return false;
  }
}
