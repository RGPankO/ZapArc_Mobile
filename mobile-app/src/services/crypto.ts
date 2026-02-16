// Crypto utilities for wallet encryption/decryption
// Uses @noble/ciphers (AES-256-GCM) + @noble/hashes (PBKDF2)
// Pure JS, audited, zero native dependencies
// Preserves legacy XOR (v1) decryption for backward compatibility

import * as Crypto from 'expo-crypto';
import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/ciphers/webcrypto.js';

import type { EncryptedData } from '../features/wallet/types';

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
  return randomBytes(length);
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

function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

// =============================================================================
// Key Derivation
// =============================================================================

/**
 * Derive key using PBKDF2-HMAC-SHA256 (v2/v3)
 * Uses @noble/hashes — pure JS, audited
 */
function deriveKeyV2(pin: string, salt: Uint8Array | string): Uint8Array {
  const saltBytes = typeof salt === 'string' ? stringToBytes(salt) : salt;
  return pbkdf2(sha256, pin, saltBytes, { c: ITERATIONS, dkLen: KEY_LENGTH });
}

/**
 * Public API for key derivation (async for compatibility)
 */
export async function deriveKeyFromPin(pin: string): Promise<Uint8Array> {
  return deriveKeyV2(pin, LEGACY_SALT);
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
// AES-256-GCM Encryption (v3) — @noble/ciphers
// =============================================================================

/**
 * Encrypt data with PIN-derived key (AES-256-GCM, per-wallet random salt)
 */
export async function encryptData(
  plaintext: string,
  pin: string
): Promise<EncryptedData> {
  try {
    const salt = randomBytes(SALT_LENGTH);
    const key = deriveKeyV2(pin, salt);
    const iv = randomBytes(IV_LENGTH);

    const aes = gcm(key, iv);
    const ciphertext = aes.encrypt(stringToBytes(plaintext));
    // @noble/ciphers gcm.encrypt returns ciphertext + 16-byte authTag appended

    return {
      data: Array.from(ciphertext),
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

  console.log('🔐 [Crypto] decryptData version:', version, 'hasSalt:', !!encryptedData.salt);

  if (version === 1) {
    return decryptDataV1(encryptedData, pin);
  }

  // v2/v3: AES-256-GCM via @noble/ciphers
  try {
    const salt = encryptedData.salt
      ? new Uint8Array(encryptedData.salt)
      : stringToBytes(LEGACY_SALT);

    const key = deriveKeyV2(pin, salt);
    const fullData = new Uint8Array(encryptedData.data);
    const iv = new Uint8Array(encryptedData.iv);

    // fullData = ciphertext + authTag (16 bytes), as stored by both
    // quick-crypto and @noble/ciphers
    const aes = gcm(key, iv);
    const decrypted = aes.decrypt(fullData);

    return bytesToString(decrypted);
  } catch (error) {
    console.warn('⚠️ [Crypto] V' + version + ' decryption failed:', error);
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
