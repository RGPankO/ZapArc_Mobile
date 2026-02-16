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
// Web Crypto Fallback (for AES-GCM when quick-crypto unavailable)
// =============================================================================

/**
 * PBKDF2 via Web Crypto API (crypto.subtle)
 * Available in Hermes engine since RN 0.76
 */
async function deriveKeyWebCrypto(
  pin: string,
  salt: Uint8Array | string,
  iterations: number,
  keyLength: number
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const pinData = encoder.encode(pin);
  const saltData = typeof salt === 'string' ? encoder.encode(salt) : salt;

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    pinData,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltData,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    keyLength * 8
  );

  return new Uint8Array(bits);
}

/**
 * AES-256-GCM decrypt via Web Crypto API
 */
async function decryptAesGcmWebCrypto(
  encrypted: Uint8Array,
  authTag: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array
): Promise<string> {
  // Web Crypto expects ciphertext + authTag concatenated
  const combined = new Uint8Array(encrypted.length + authTag.length);
  combined.set(encrypted);
  combined.set(authTag, encrypted.length);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    'AES-GCM',
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    combined
  );

  return new TextDecoder().decode(decrypted);
}

// =============================================================================
// Key Derivation
// =============================================================================

/**
 * New (v2) key derivation using native PBKDF2 (quick-crypto) or Web Crypto fallback
 * Kept async for API compatibility.
 */
export async function deriveKeyFromPin(pin: string): Promise<Uint8Array> {
  if (_quickCryptoAvailable && QuickCrypto) {
    return new Uint8Array(deriveKeyFromPinV2(pin, LEGACY_SALT));
  }
  return deriveKeyWebCrypto(pin, LEGACY_SALT, ITERATIONS, KEY_LENGTH);
}

function deriveKeyFromPinV2(pin: string, salt: string | Uint8Array): Uint8Array {
  if (!QuickCrypto) throw new Error('quick-crypto not available');
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
  try {
    let saltArr: Uint8Array;
    let keyArr: Uint8Array;
    let ivArr: Uint8Array;
    let combinedArr: Uint8Array;

    if (_quickCryptoAvailable && QuickCrypto) {
      saltArr = new Uint8Array(QuickCrypto.randomBytes(SALT_LENGTH));
      keyArr = deriveKeyFromPinV2(pin, saltArr);
      ivArr = new Uint8Array(QuickCrypto.randomBytes(IV_LENGTH));
      const cipher = QuickCrypto.createCipheriv('aes-256-gcm', Buffer.from(keyArr), Buffer.from(ivArr));
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const authTag = cipher.getAuthTag();
      combinedArr = new Uint8Array(Buffer.concat([encrypted, authTag]));
    } else {
      // Web Crypto fallback
      console.log('🔑 [Crypto] Using Web Crypto API for encryption');
      saltArr = new Uint8Array(SALT_LENGTH);
      crypto.getRandomValues(saltArr);
      keyArr = await deriveKeyWebCrypto(pin, saltArr, ITERATIONS, KEY_LENGTH);
      ivArr = new Uint8Array(IV_LENGTH);
      crypto.getRandomValues(ivArr);

      const cryptoKey = await crypto.subtle.importKey('raw', keyArr, 'AES-GCM', false, ['encrypt']);
      const encoder = new TextEncoder();
      const encryptedBuf = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: ivArr },
        cryptoKey,
        encoder.encode(plaintext)
      );
      combinedArr = new Uint8Array(encryptedBuf); // Web Crypto appends authTag automatically
    }

    return {
      data: Array.from(combinedArr),
      iv: Array.from(ivArr),
      salt: Array.from(saltArr),
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

  try {
    const saltBytes = encryptedData.salt
      ? new Uint8Array(encryptedData.salt)
      : undefined;
    const saltSource = saltBytes || LEGACY_SALT;
    const fullData = new Uint8Array(encryptedData.data);
    const iv = new Uint8Array(encryptedData.iv);

    if (fullData.length < 16) {
      throw new Error('Invalid encrypted payload');
    }

    const authTag = fullData.slice(fullData.length - 16);
    const encrypted = fullData.slice(0, fullData.length - 16);

    // Try quick-crypto first, fall back to Web Crypto API
    if (_quickCryptoAvailable && QuickCrypto) {
      const key = deriveKeyFromPinV2(pin, saltSource);
      const decipher = QuickCrypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(key),
        Buffer.from(iv)
      );
      decipher.setAuthTag(Buffer.from(authTag));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encrypted)),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    }

    // Web Crypto fallback (Hermes crypto.subtle)
    console.log('🔑 [Crypto] Using Web Crypto API for V' + version + ' decrypt');
    const key = await deriveKeyWebCrypto(pin, saltSource, ITERATIONS, KEY_LENGTH);
    return await decryptAesGcmWebCrypto(encrypted, authTag, key, iv);
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
