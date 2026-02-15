// BIP39 Mnemonic Utilities for React Native
// Handles mnemonic generation, validation, and sub-wallet derivation

// NOTE: This implementation uses the 'bip39' package which needs to be installed:
// npm install bip39

import * as bip39 from 'bip39';
import { WALLET_CONSTANTS } from '../features/wallet/types';

const { MAX_SUB_WALLETS, BIP39_WORDLIST_SIZE } = WALLET_CONSTANTS;

// BIP-39 English wordlist
const WORDLIST = bip39.wordlists.english;

// =============================================================================
// Mnemonic Generation and Validation
// =============================================================================

/**
 * Generate a new 12-word BIP39 mnemonic
 * @returns A valid 12-word mnemonic phrase
 */
export function generateMnemonic(): string {
  return bip39.generateMnemonic();
}

/**
 * Generate a 12-word mnemonic and run strict sanity checks.
 * Retries generation up to 3 times before throwing.
 *
 * Checks performed:
 * - BIP39 checksum validity
 * - Exactly 12 words
 * - All words exist in BIP39 English wordlist
 * - No duplicate consecutive words
 *
 * @returns A validated 12-word mnemonic phrase
 * @throws Error if a valid mnemonic cannot be generated after retries
 */
export function generateAndValidateMnemonic(): string {
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const mnemonic = bip39.generateMnemonic();
    const normalized = normalizeMnemonic(mnemonic);
    const words = normalized.split(' ');

    const isBip39Valid = bip39.validateMnemonic(normalized);
    const is12Words = words.length === 12;
    const allWordsInEnglishWordlist = words.every((word) => WORDLIST.includes(word));
    const hasConsecutiveDuplicates = words.some(
      (word, index) => index > 0 && word === words[index - 1]
    );

    const isValid =
      isBip39Valid &&
      is12Words &&
      allWordsInEnglishWordlist &&
      !hasConsecutiveDuplicates;

    if (isValid) {
      if (__DEV__) {
        console.log('✅ [Mnemonic] generateAndValidateMnemonic() passed sanity checks', {
          attempt,
        });
      }
      return normalized;
    }

    console.error('❌ [Mnemonic] Generated mnemonic failed sanity checks, retrying', {
      attempt,
      isBip39Valid,
      is12Words,
      allWordsInEnglishWordlist,
      hasConsecutiveDuplicates,
    });
  }

  throw new Error('Failed to generate a valid 12-word mnemonic after 3 attempts');
}

/**
 * Validate a mnemonic phrase using BIP39
 * @param mnemonic - The mnemonic phrase to validate
 * @returns true if the mnemonic is valid
 */
export function validateMnemonic(mnemonic: string): boolean {
  if (!mnemonic || typeof mnemonic !== 'string') {
    return false;
  }
  // Normalize the mnemonic before validating (handles newlines, tabs, extra spaces)
  const normalized = normalizeMnemonic(mnemonic);
  return bip39.validateMnemonic(normalized);
}

/**
 * Normalize a mnemonic (lowercase, single spaces, handles newlines/tabs)
 * @param mnemonic - The mnemonic to normalize
 * @returns Normalized mnemonic
 */
export function normalizeMnemonic(mnemonic: string): string {
  if (!mnemonic || typeof mnemonic !== 'string') {
    return '';
  }
  // Replace any whitespace (spaces, tabs, newlines) with single space
  // Also handles Windows \r\n line endings
  return mnemonic
    .trim()
    .toLowerCase()
    .replace(/[\s\r\n]+/g, ' ');
}

/**
 * Get the word count of a mnemonic
 * @param mnemonic - The mnemonic phrase
 * @returns Number of words in the mnemonic
 */
export function getWordCount(mnemonic: string): number {
  const normalized = normalizeMnemonic(mnemonic);
  if (!normalized) return 0;
  return normalized.split(' ').length;
}

/**
 * Check if a mnemonic has exactly 12 words
 * @param mnemonic - The mnemonic to check
 * @returns true if the mnemonic has 12 words
 */
export function is12WordMnemonic(mnemonic: string): boolean {
  return getWordCount(mnemonic) === 12;
}

/**
 * Check if a mnemonic has exactly 24 words
 * @param mnemonic - The mnemonic to check
 * @returns true if the mnemonic has 24 words
 */
export function is24WordMnemonic(mnemonic: string): boolean {
  return getWordCount(mnemonic) === 24;
}

/**
 * Validate mnemonic format and content for wallet import
 * @param mnemonic - The mnemonic to validate
 * @returns Object with validation result and error message if invalid
 */
export function validateMnemonicForImport(mnemonic: string): {
  isValid: boolean;
  error?: string;
  wordCount: number;
} {
  const wordCount = getWordCount(mnemonic);

  if (wordCount === 0) {
    return {
      isValid: false,
      error: 'Please enter a mnemonic phrase',
      wordCount: 0,
    };
  }

  if (wordCount !== 12 && wordCount !== 24) {
    return {
      isValid: false,
      error: `Mnemonic must be 12 or 24 words, got ${wordCount}`,
      wordCount,
    };
  }

  if (!validateMnemonic(mnemonic)) {
    return {
      isValid: false,
      error: 'Invalid mnemonic phrase. Please check for typos.',
      wordCount,
    };
  }

  return { isValid: true, wordCount };
}

// =============================================================================
// Sub-Wallet Derivation
// =============================================================================

/**
 * Validates that a sub-wallet index is within bounds
 * @param index - Sub-wallet index to validate
 * @returns true if index is 0-19 (MAX_SUB_WALLETS - 1)
 */
export function isValidSubWalletIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < MAX_SUB_WALLETS;
}

/**
 * Gets the index of a word in the BIP-39 wordlist
 * @param word - Word to find
 * @returns Index (0-2047) or -1 if not found
 */
export function getWordIndex(word: string): number {
  return WORDLIST.indexOf(word.toLowerCase().trim());
}

/**
 * Gets the word at a specific index in the BIP-39 wordlist
 * @param index - Index (0-2047)
 * @returns Word at that index
 * @throws Error if index is out of bounds
 */
export function getWordAtIndex(index: number): string {
  if (index < 0 || index >= BIP39_WORDLIST_SIZE) {
    throw new Error(`Word index ${index} out of bounds (0-${BIP39_WORDLIST_SIZE - 1})`);
  }
  return WORDLIST[index];
}

/**
 * Increments a word's position in the BIP-39 wordlist by an offset
 * Wraps around if the result exceeds 2047
 *
 * @param currentWord - Current word from the wordlist
 * @param offset - How many positions to increment (0-19)
 * @returns New word from BIP-39 wordlist
 * @throws Error if currentWord is not in the wordlist
 */
export function incrementWord(currentWord: string, offset: number): string {
  const currentIndex = getWordIndex(currentWord);
  if (currentIndex === -1) {
    throw new Error(`Word "${currentWord}" is not in the BIP-39 wordlist`);
  }

  // Wrap around using modulo
  const newIndex = (currentIndex + offset) % BIP39_WORDLIST_SIZE;
  return getWordAtIndex(newIndex);
}

/**
 * Calculates the 12th word (checksum word) for a modified mnemonic
 *
 * For a 12-word BIP-39 mnemonic:
 * - 128 bits of entropy
 * - 4 bits of checksum (SHA-256 hash of entropy)
 * - Total: 132 bits = 12 words × 11 bits
 *
 * @param first11Words - Array of the first 11 words of the mnemonic
 * @returns Valid 12th word that makes the mnemonic valid
 */
export function calculateChecksumWord(first11Words: string[]): string {
  if (first11Words.length !== 11) {
    throw new Error(`Expected 11 words, got ${first11Words.length}`);
  }

  // Validate all words are in the wordlist
  for (const word of first11Words) {
    if (getWordIndex(word) === -1) {
      throw new Error(`Word "${word}" is not in the BIP-39 wordlist`);
    }
  }

  // Try each possible 12th word until we find one that creates a valid mnemonic
  // This is brute-force but only 2048 possibilities
  const testMnemonic = first11Words.join(' ');

  for (let i = 0; i < BIP39_WORDLIST_SIZE; i++) {
    const candidateWord = WORDLIST[i];
    const fullMnemonic = `${testMnemonic} ${candidateWord}`;

    if (bip39.validateMnemonic(fullMnemonic)) {
      return candidateWord;
    }
  }

  // This should never happen if the input words are valid
  throw new Error('Could not find a valid checksum word - this should not happen');
}

/**
 * Derives a sub-wallet mnemonic by modifying the 11th word
 *
 * Sub-Wallet Derivation Strategy:
 * - Sub-Wallet 0: Uses the original 12-word mnemonic unchanged
 * - Sub-Wallet N: Increment the 11th word by N positions in BIP-39 wordlist,
 *                 then recalculate the 12th word (checksum)
 *
 * @param masterMnemonic - Original 12-word mnemonic
 * @param subWalletIndex - Index 0-19 (0 = original, 1-19 = modified)
 * @returns New valid 12-word mnemonic
 * @throws Error if mnemonic is invalid or index is out of bounds
 */
export function deriveSubWalletMnemonic(
  masterMnemonic: string,
  subWalletIndex: number
): string {
  // Validate index
  if (!isValidSubWalletIndex(subWalletIndex)) {
    throw new Error(
      `Sub-wallet index ${subWalletIndex} is out of bounds (0-${MAX_SUB_WALLETS - 1})`
    );
  }

  // Normalize the mnemonic
  const normalized = normalizeMnemonic(masterMnemonic);

  // If index is 0, return the original mnemonic unchanged
  if (subWalletIndex === 0) {
    return normalized;
  }

  // Validate master mnemonic (only needed for derivation)
  if (!bip39.validateMnemonic(normalized)) {
    throw new Error('Invalid master mnemonic');
  }

  // Split mnemonic into words
  const words = normalized.split(' ');
  if (words.length !== 12) {
    throw new Error(`Expected 12-word mnemonic, got ${words.length} words`);
  }

  // Get the 11th word (index 10) and increment it
  const original11thWord = words[10];
  const new11thWord = incrementWord(original11thWord, subWalletIndex);

  // Create new first 11 words with modified 11th word
  const first11Words = [...words.slice(0, 10), new11thWord];

  // Calculate the new 12th word (checksum)
  const new12thWord = calculateChecksumWord(first11Words);

  // Construct and validate the new mnemonic
  const newMnemonic = [...first11Words, new12thWord].join(' ');

  // Double-check validity
  if (!bip39.validateMnemonic(newMnemonic)) {
    throw new Error('Generated mnemonic is invalid - this should not happen');
  }

  return newMnemonic;
}

/**
 * Gets the next available sub-wallet index for a master key
 *
 * @param existingIndices - Array of indices already in use (active + archived)
 * @returns Next available index, or -1 if all slots are full
 */
export function getNextAvailableIndex(existingIndices: number[]): number {
  const usedSet = new Set(existingIndices);

  for (let i = 0; i < MAX_SUB_WALLETS; i++) {
    if (!usedSet.has(i)) {
      return i;
    }
  }

  return -1; // All slots full
}

/**
 * Validates that a mnemonic can support sub-wallet derivation
 * (i.e., it's a valid 12-word BIP-39 mnemonic)
 *
 * @param mnemonic - Mnemonic to validate
 * @returns true if valid for sub-wallet derivation
 */
export function canDeriveSubWallets(mnemonic: string): boolean {
  if (!validateMnemonic(mnemonic)) {
    return false;
  }

  return is12WordMnemonic(mnemonic);
}

/**
 * Gets information about how a sub-wallet mnemonic differs from the master
 * Useful for debugging and UI display
 *
 * @param masterMnemonic - Original mnemonic
 * @param subWalletIndex - Sub-wallet index
 * @returns Object with derivation details
 */
export function getDerivationInfo(
  masterMnemonic: string,
  subWalletIndex: number
): {
  originalWord11: string;
  newWord11: string;
  originalWord12: string;
  newWord12: string;
  wordIndexChange: number;
} {
  const masterWords = normalizeMnemonic(masterMnemonic).split(' ');
  const derivedMnemonic = deriveSubWalletMnemonic(masterMnemonic, subWalletIndex);
  const derivedWords = derivedMnemonic.split(' ');

  return {
    originalWord11: masterWords[10],
    newWord11: derivedWords[10],
    originalWord12: masterWords[11],
    newWord12: derivedWords[11],
    wordIndexChange: subWalletIndex,
  };
}

/**
 * Check if importing a mnemonic would create a duplicate wallet
 * by comparing the underlying seed
 *
 * @param newMnemonic - The mnemonic being imported
 * @param existingMnemonics - Array of existing wallet mnemonics
 * @returns true if this mnemonic would create a duplicate
 */
export async function isDuplicateMnemonic(
  newMnemonic: string,
  existingMnemonics: string[]
): Promise<boolean> {
  const normalizedNew = normalizeMnemonic(newMnemonic);
  const newSeed = await bip39.mnemonicToSeed(normalizedNew);
  const newSeedHex = Array.from(new Uint8Array(newSeed))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  for (const existing of existingMnemonics) {
    const normalizedExisting = normalizeMnemonic(existing);
    const existingSeed = await bip39.mnemonicToSeed(normalizedExisting);
    const existingSeedHex = Array.from(new Uint8Array(existingSeed))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (newSeedHex === existingSeedHex) {
      return true;
    }
  }

  return false;
}

/**
 * Generate a default nickname for a sub-wallet
 * @param index - The sub-wallet index
 * @param masterNickname - The master key's nickname
 * @returns Generated nickname
 */
export function generateSubWalletNickname(
  index: number,
  _masterNickname?: string
): string {
  if (index === 0) {
    return 'Main Wallet';
  }
  return `Sub-Wallet ${index}`;
}

/**
 * Generate a default nickname for a master key
 * @param keyNumber - The master key number (1-based)
 * @returns Generated nickname
 */
export function generateMasterKeyNickname(keyNumber: number): string {
  return `Wallet ${keyNumber}`;
}
