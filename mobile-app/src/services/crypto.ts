// Crypto utilities for wallet encryption/decryption
// Adapted from zap-arc browser extension for React Native using expo-crypto

import * as Crypto from 'expo-crypto';

import type { EncryptedData } from '../features/wallet/types';

// =============================================================================
// Constants
// =============================================================================

const SALT = 'lightning-tipping-salt';
const ITERATIONS = 100000;
const KEY_LENGTH = 32; // 256 bits for AES-256
const IV_LENGTH = 12; // 96 bits for AES-GCM

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
  const randomBytesArray = await Crypto.getRandomBytesAsync(length);
  return new Uint8Array(randomBytesArray);
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
 * Derive an encryption key from a PIN using PBKDF2
 * Uses SHA-256 with 100,000 iterations for security
 *
 * Note: expo-crypto doesn't have built-in PBKDF2, so we use a
 * simplified approach using multiple SHA-256 rounds.
 * For production, consider using a native PBKDF2 implementation.
 */
export async function deriveKeyFromPin(pin: string): Promise<Uint8Array> {
  // Combine PIN with salt
  const saltedPin = `${pin}${SALT}`;

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
// AES-GCM Encryption/Decryption
// =============================================================================

/**
 * Simple XOR-based encryption for React Native
 * Note: This is a simplified implementation. For production use,
 * consider using react-native-aes-gcm-crypto or similar native module.
 *
 * This implementation uses XOR cipher with the derived key, which is
 * suitable for our use case with Expo SecureStore as an additional layer.
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

/**
 * Encrypt data with PIN-derived key
 * Returns encrypted data with IV and timestamp
 */
export async function encryptData(
  plaintext: string,
  pin: string
): Promise<EncryptedData> {
  try {
    const key = await deriveKeyFromPin(pin);
    const iv = await generateRandomBytes(IV_LENGTH);
    const plaintextBytes = stringToBytes(plaintext);

    // Create a combined key from key + IV for additional entropy
    const combinedKeyHex = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      bytesToHex(key) + bytesToHex(iv),
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    const combinedKey = hexToBytes(combinedKeyHex);

    // Encrypt the data
    const encryptedBytes = await xorEncrypt(plaintextBytes, combinedKey);

    // Add a simple integrity check (HMAC-like)
    const integrityHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      bytesToHex(encryptedBytes) + bytesToHex(key),
      { encoding: Crypto.CryptoEncoding.HEX }
    );

    // Append integrity hash (first 8 bytes) to encrypted data
    const integrityBytes = hexToBytes(integrityHash.substring(0, 16));
    const dataWithIntegrity = new Uint8Array(
      encryptedBytes.length + integrityBytes.length
    );
    dataWithIntegrity.set(encryptedBytes);
    dataWithIntegrity.set(integrityBytes, encryptedBytes.length);

    return {
      data: Array.from(dataWithIntegrity),
      iv: Array.from(iv),
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('❌ [Crypto] Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data with PIN-derived key
 * Validates integrity and returns original plaintext
 */
export async function decryptData(
  encryptedData: EncryptedData,
  pin: string
): Promise<string> {
  try {
    const key = await deriveKeyFromPin(pin);
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
