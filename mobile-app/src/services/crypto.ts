// Crypto utilities for wallet encryption/decryption
// Uses Web Crypto API (crypto.subtle) for AES-256-GCM (v2/v3)
// Preserves legacy XOR (v1) decryption for backward compatibility

import * as Crypto from 'expo-crypto';

import type { EncryptedData } from '../features/wallet/types';

// =============================================================================
// Runtime capability check
// =============================================================================

const _hasSubtle = typeof crypto !== 'undefined' && typeof crypto?.subtle?.importKey === 'function';
console.log('🔐 [Crypto] crypto available:', typeof crypto !== 'undefined');
console.log('🔐 [Crypto] crypto.subtle available:', _hasSubtle);
console.log('🔐 [Crypto] crypto.getRandomValues available:', typeof crypto?.getRandomValues === 'function');

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

export function generateUUID(): string {
  return Crypto.randomUUID();
}

export async function generateRandomBytes(length: number): Promise<Uint8Array> {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// =============================================================================
// Web Crypto — PBKDF2 + AES-256-GCM
// =============================================================================

/**
 * PBKDF2 key derivation via Web Crypto API (crypto.subtle)
 */
async function deriveKeyPBKDF2(
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
 * AES-256-GCM encrypt via Web Crypto API
 */
async function encryptAesGcm(
  plaintext: string,
  key: Uint8Array,
  iv: Uint8Array
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    new TextEncoder().encode(plaintext)
  );
  // Web Crypto returns ciphertext + 16-byte authTag concatenated
  return new Uint8Array(encrypted);
}

/**
 * AES-256-GCM decrypt via Web Crypto API
 */
async function decryptAesGcm(
  ciphertextWithTag: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array
): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ciphertextWithTag
  );
  return new TextDecoder().decode(decrypted);
}

// =============================================================================
// Key Derivation
// =============================================================================

/**
 * Derive encryption key from PIN (v2/v3 — PBKDF2 100k iterations)
 */
export async function deriveKeyFromPin(pin: string): Promise<Uint8Array> {
  return deriveKeyPBKDF2(pin, LEGACY_SALT, ITERATIONS, KEY_LENGTH);
}

/**
 * Legacy (v1) key derivation using expo-crypto SHA-256 rounds.
 * Must remain exactly compatible for backward decryption.
 */
async function deriveKeyFromPinV1(pin: string): Promise<Uint8Array> {
  const saltedPin = `${pin}${LEGACY_SALT}`;

  let hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    saltedPin,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  hash = hash.toLowerCase();

  const mobileIterations = Math.floor(ITERATIONS / 100); // 1000 iterations

  for (let i = 0; i < mobileIterations; i++) {
    hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      hash + saltedPin,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    hash = hash.toLowerCase();
  }

  return hexToBytes(hash.substring(0, KEY_LENGTH * 2));
}

// =============================================================================
// Legacy XOR Helpers (v1 compatibility)
// =============================================================================

async function xorEncrypt(data: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return result;
}

async function xorDecrypt(data: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  return xorEncrypt(data, key);
}

// =============================================================================
// AES-GCM Encryption (v3)
// =============================================================================

/**
 * Encrypt data with PIN-derived key (AES-256-GCM, per-wallet random salt)
 */
export async function encryptData(
  plaintext: string,
  pin: string
): Promise<EncryptedData> {
  try {
    const saltArr = new Uint8Array(SALT_LENGTH);
    crypto.getRandomValues(saltArr);

    const keyArr = await deriveKeyPBKDF2(pin, saltArr, ITERATIONS, KEY_LENGTH);

    const ivArr = new Uint8Array(IV_LENGTH);
    crypto.getRandomValues(ivArr);

    const combinedArr = await encryptAesGcm(plaintext, keyArr, ivArr);

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

// =============================================================================
// Decryption (v1 / v2 / v3)
// =============================================================================

/**
 * Legacy v1 decrypt (XOR + integrity check)
 */
async function decryptDataV1(
  encryptedData: EncryptedData,
  pin: string
): Promise<string> {
  try {
    const key = await deriveKeyFromPinV1(pin);
    const iv = new Uint8Array(encryptedData.iv);
    const fullData = new Uint8Array(encryptedData.data);

    const integrityLength = 8;
    const encryptedBytes = fullData.slice(0, fullData.length - integrityLength);
    const storedIntegrity = fullData.slice(fullData.length - integrityLength);

    const integrityHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      bytesToHex(encryptedBytes) + bytesToHex(key),
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    const expectedIntegrity = hexToBytes(integrityHash.substring(0, 16));

    let integrityValid = true;
    for (let i = 0; i < integrityLength; i++) {
      if (storedIntegrity[i] !== expectedIntegrity[i]) {
        integrityValid = false;
        break;
      }
    }

    if (!integrityValid) {
      throw new Error('Data integrity check failed - invalid PIN or corrupted data');
    }

    const combinedKeyHex = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      bytesToHex(key) + bytesToHex(iv),
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    const combinedKey = hexToBytes(combinedKeyHex);

    const decryptedBytes = await xorDecrypt(encryptedBytes, combinedKey);
    return bytesToString(decryptedBytes);
  } catch (error) {
    console.warn('⚠️ [Crypto] V1 decryption failed:', error);
    throw new Error('Failed to decrypt data - invalid PIN or corrupted data');
  }
}

/**
 * Decrypt data with PIN-derived key
 * Auto-detects payload version: v1 (XOR), v2/v3 (AES-256-GCM)
 */
export async function decryptData(
  encryptedData: EncryptedData,
  pin: string
): Promise<string> {
  const version = encryptedData.version || 1;

  console.log('🔐 [Crypto] decryptData called, version:', version, 'hasSalt:', !!encryptedData.salt, 'dataLen:', encryptedData.data?.length);

  if (version === 1) {
    return decryptDataV1(encryptedData, pin);
  }

  if (!_hasSubtle) {
    console.error('🔐 [Crypto] crypto.subtle NOT available — cannot decrypt V' + version + ' data');
    throw new Error('crypto.subtle not available in this runtime — cannot decrypt AES-GCM data');
  }

  // v2/v3: AES-256-GCM via Web Crypto
  try {
    const saltSource = encryptedData.salt
      ? new Uint8Array(encryptedData.salt)
      : LEGACY_SALT;

    const key = await deriveKeyPBKDF2(pin, saltSource, ITERATIONS, KEY_LENGTH);
    const fullData = new Uint8Array(encryptedData.data);
    const iv = new Uint8Array(encryptedData.iv);

    if (fullData.length < 16) {
      throw new Error('Invalid encrypted payload');
    }

    // fullData = ciphertext + authTag(16 bytes)
    // Web Crypto expects them concatenated (which they already are)
    return await decryptAesGcm(fullData, key, iv);
  } catch (error) {
    console.warn('⚠️ [Crypto] V' + (encryptedData.version || '?') + ' decryption failed:', error);
    throw new Error('Failed to decrypt data - invalid PIN or corrupted data');
  }
}

// =============================================================================
// Validation
// =============================================================================

export function validatePayloadIntegrity(timestamp: number): boolean {
  const now = Date.now();
  const maxAge = 90 * 24 * 60 * 60 * 1000;
  const age = now - timestamp;

  if (age > maxAge) {
    console.warn('⚠️ [Crypto] Data timestamp is suspiciously old (>90 days)');
  }
  if (age < 0) {
    console.warn('⚠️ [Crypto] Data timestamp is in the future');
  }

  return true;
}

/**
 * Verify a PIN can decrypt the given encrypted data
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
