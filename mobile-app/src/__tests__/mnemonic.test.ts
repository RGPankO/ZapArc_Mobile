// Unit tests for BIP39 mnemonic utilities
// Tests mnemonic generation, validation, and sub-wallet derivation

import {
  generateMnemonic,
  validateMnemonic,
  normalizeMnemonic,
  getWordCount,
  is12WordMnemonic,
  is24WordMnemonic,
  validateMnemonicForImport,
  isValidSubWalletIndex,
  getWordIndex,
  getWordAtIndex,
  incrementWord,
  calculateChecksumWord,
  deriveSubWalletMnemonic,
  getNextAvailableIndex,
  canDeriveSubWallets,
  getDerivationInfo,
  generateSubWalletNickname,
  generateMasterKeyNickname,
} from '../utils/mnemonic';

// Test mnemonics (known valid BIP39 mnemonics)
const TEST_MNEMONIC_1 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const TEST_MNEMONIC_2 =
  'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong';
const INVALID_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';

// =============================================================================
// Mnemonic Generation Tests
// =============================================================================

describe('Mnemonic Generation', () => {
  describe('generateMnemonic', () => {
    it('should generate a valid 12-word mnemonic', () => {
      const mnemonic = generateMnemonic();

      expect(mnemonic).toBeDefined();
      expect(typeof mnemonic).toBe('string');
      expect(getWordCount(mnemonic)).toBe(12);
      expect(validateMnemonic(mnemonic)).toBe(true);
    });

    it('should generate unique mnemonics', () => {
      const mnemonics = new Set<string>();
      for (let i = 0; i < 10; i++) {
        mnemonics.add(generateMnemonic());
      }
      expect(mnemonics.size).toBe(10);
    });
  });
});

// =============================================================================
// Mnemonic Validation Tests
// =============================================================================

describe('Mnemonic Validation', () => {
  describe('validateMnemonic', () => {
    it('should return true for valid mnemonics', () => {
      expect(validateMnemonic(TEST_MNEMONIC_1)).toBe(true);
      expect(validateMnemonic(TEST_MNEMONIC_2)).toBe(true);
    });

    it('should return false for invalid mnemonics', () => {
      expect(validateMnemonic(INVALID_MNEMONIC)).toBe(false);
      expect(validateMnemonic('')).toBe(false);
      expect(validateMnemonic('single')).toBe(false);
    });

    it('should handle case insensitivity', () => {
      expect(validateMnemonic(TEST_MNEMONIC_1.toUpperCase())).toBe(true);
      expect(validateMnemonic('Abandon ABANDON abandon ABANDON abandon ABANDON abandon ABANDON abandon ABANDON abandon About')).toBe(true);
    });

    it('should handle extra whitespace', () => {
      const withExtraSpaces = '  abandon   abandon   abandon   abandon   abandon   abandon   abandon   abandon   abandon   abandon   abandon   about  ';
      expect(validateMnemonic(withExtraSpaces)).toBe(true);
    });

    it('should return false for null/undefined', () => {
      expect(validateMnemonic(null as unknown as string)).toBe(false);
      expect(validateMnemonic(undefined as unknown as string)).toBe(false);
    });
  });

  describe('normalizeMnemonic', () => {
    it('should lowercase and trim', () => {
      expect(normalizeMnemonic('  ABANDON ABANDON  ')).toBe('abandon abandon');
    });

    it('should collapse multiple spaces', () => {
      expect(normalizeMnemonic('word1   word2    word3')).toBe('word1 word2 word3');
    });
  });

  describe('getWordCount', () => {
    it('should count words correctly', () => {
      expect(getWordCount(TEST_MNEMONIC_1)).toBe(12);
      expect(getWordCount('one two three')).toBe(3);
      expect(getWordCount('')).toBe(0);
      expect(getWordCount('   ')).toBe(0);
    });
  });

  describe('is12WordMnemonic and is24WordMnemonic', () => {
    it('should detect 12-word mnemonic', () => {
      expect(is12WordMnemonic(TEST_MNEMONIC_1)).toBe(true);
      expect(is24WordMnemonic(TEST_MNEMONIC_1)).toBe(false);
    });

    it('should return false for other word counts', () => {
      expect(is12WordMnemonic('one two three')).toBe(false);
    });
  });

  describe('validateMnemonicForImport', () => {
    it('should accept valid 12-word mnemonic', () => {
      const result = validateMnemonicForImport(TEST_MNEMONIC_1);
      expect(result.isValid).toBe(true);
      expect(result.wordCount).toBe(12);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty mnemonic', () => {
      const result = validateMnemonicForImport('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('enter a mnemonic');
    });

    it('should reject wrong word count', () => {
      const result = validateMnemonicForImport('one two three four five');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('12 or 24 words');
    });

    it('should reject invalid mnemonic', () => {
      const result = validateMnemonicForImport(INVALID_MNEMONIC);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid mnemonic');
    });
  });
});

// =============================================================================
// Sub-Wallet Derivation Tests
// =============================================================================

describe('Sub-Wallet Derivation', () => {
  describe('isValidSubWalletIndex', () => {
    it('should accept valid indices (0-19)', () => {
      expect(isValidSubWalletIndex(0)).toBe(true);
      expect(isValidSubWalletIndex(19)).toBe(true);
      expect(isValidSubWalletIndex(10)).toBe(true);
    });

    it('should reject invalid indices', () => {
      expect(isValidSubWalletIndex(-1)).toBe(false);
      expect(isValidSubWalletIndex(20)).toBe(false);
      expect(isValidSubWalletIndex(100)).toBe(false);
      expect(isValidSubWalletIndex(1.5)).toBe(false);
    });
  });

  describe('getWordIndex and getWordAtIndex', () => {
    it('should find word index correctly', () => {
      expect(getWordIndex('abandon')).toBe(0);
      expect(getWordIndex('about')).toBe(3);
      expect(getWordIndex('zoo')).toBe(2047);
    });

    it('should return -1 for invalid words', () => {
      expect(getWordIndex('notaword')).toBe(-1);
      expect(getWordIndex('')).toBe(-1);
    });

    it('should get word at index correctly', () => {
      expect(getWordAtIndex(0)).toBe('abandon');
      expect(getWordAtIndex(3)).toBe('about');
      expect(getWordAtIndex(2047)).toBe('zoo');
    });

    it('should throw for out of bounds indices', () => {
      expect(() => getWordAtIndex(-1)).toThrow();
      expect(() => getWordAtIndex(2048)).toThrow();
    });
  });

  describe('incrementWord', () => {
    it('should increment word correctly', () => {
      // 'abandon' (0) + 3 = 'about' (3)
      expect(incrementWord('abandon', 3)).toBe('about');
    });

    it('should wrap around at end of wordlist', () => {
      // 'zoo' (2047) + 1 = 'abandon' (0)
      expect(incrementWord('zoo', 1)).toBe('abandon');
    });

    it('should throw for invalid words', () => {
      expect(() => incrementWord('notaword', 1)).toThrow();
    });
  });

  describe('calculateChecksumWord', () => {
    it('should find valid checksum word', () => {
      const first11 = TEST_MNEMONIC_1.split(' ').slice(0, 11);
      const checksumWord = calculateChecksumWord(first11);

      expect(checksumWord).toBeDefined();
      expect(typeof checksumWord).toBe('string');

      // Verify the full mnemonic is valid
      const fullMnemonic = [...first11, checksumWord].join(' ');
      expect(validateMnemonic(fullMnemonic)).toBe(true);
    });

    it('should throw for wrong number of words', () => {
      expect(() => calculateChecksumWord(['word1', 'word2'])).toThrow();
    });
  });

  describe('deriveSubWalletMnemonic', () => {
    it('should return original for index 0', () => {
      const derived = deriveSubWalletMnemonic(TEST_MNEMONIC_1, 0);
      expect(derived).toBe(normalizeMnemonic(TEST_MNEMONIC_1));
    });

    it('should derive different valid mnemonic for index > 0', () => {
      const derived1 = deriveSubWalletMnemonic(TEST_MNEMONIC_1, 1);
      const derived2 = deriveSubWalletMnemonic(TEST_MNEMONIC_1, 2);

      // Should be valid
      expect(validateMnemonic(derived1)).toBe(true);
      expect(validateMnemonic(derived2)).toBe(true);

      // Should be different from original
      expect(derived1).not.toBe(normalizeMnemonic(TEST_MNEMONIC_1));
      expect(derived2).not.toBe(normalizeMnemonic(TEST_MNEMONIC_1));

      // Should be different from each other
      expect(derived1).not.toBe(derived2);
    });

    it('should be deterministic', () => {
      const first = deriveSubWalletMnemonic(TEST_MNEMONIC_1, 5);
      const second = deriveSubWalletMnemonic(TEST_MNEMONIC_1, 5);
      expect(first).toBe(second);
    });

    it('should throw for out of bounds index', () => {
      expect(() => deriveSubWalletMnemonic(TEST_MNEMONIC_1, -1)).toThrow();
      expect(() => deriveSubWalletMnemonic(TEST_MNEMONIC_1, 20)).toThrow();
    });

    it('should throw for invalid mnemonic when index > 0', () => {
      expect(() => deriveSubWalletMnemonic(INVALID_MNEMONIC, 1)).toThrow();
    });

    it('should derive all 20 sub-wallets successfully', () => {
      for (let i = 0; i < 20; i++) {
        const derived = deriveSubWalletMnemonic(TEST_MNEMONIC_1, i);
        expect(validateMnemonic(derived)).toBe(true);
      }
    });
  });

  describe('getNextAvailableIndex', () => {
    it('should return 0 for empty array', () => {
      expect(getNextAvailableIndex([])).toBe(0);
    });

    it('should skip used indices', () => {
      expect(getNextAvailableIndex([0])).toBe(1);
      expect(getNextAvailableIndex([0, 1, 2])).toBe(3);
      expect(getNextAvailableIndex([0, 2])).toBe(1); // Gap at 1
    });

    it('should return -1 when all slots full', () => {
      const allIndices = Array.from({ length: 20 }, (_, i) => i);
      expect(getNextAvailableIndex(allIndices)).toBe(-1);
    });
  });

  describe('canDeriveSubWallets', () => {
    it('should return true for valid 12-word mnemonic', () => {
      expect(canDeriveSubWallets(TEST_MNEMONIC_1)).toBe(true);
    });

    it('should return false for invalid mnemonic', () => {
      expect(canDeriveSubWallets(INVALID_MNEMONIC)).toBe(false);
      expect(canDeriveSubWallets('')).toBe(false);
    });
  });

  describe('getDerivationInfo', () => {
    it('should return derivation details', () => {
      const info = getDerivationInfo(TEST_MNEMONIC_1, 3);

      expect(info.originalWord11).toBeDefined();
      expect(info.newWord11).toBeDefined();
      expect(info.originalWord12).toBeDefined();
      expect(info.newWord12).toBeDefined();
      expect(info.wordIndexChange).toBe(3);

      // The 11th word should have changed
      expect(info.originalWord11).not.toBe(info.newWord11);
    });
  });
});

// =============================================================================
// Nickname Generation Tests
// =============================================================================

describe('Nickname Generation', () => {
  describe('generateSubWalletNickname', () => {
    it('should generate correct nicknames', () => {
      expect(generateSubWalletNickname(0)).toBe('Main Wallet');
      expect(generateSubWalletNickname(1)).toBe('Sub-Wallet 1');
      expect(generateSubWalletNickname(5)).toBe('Sub-Wallet 5');
    });
  });

  describe('generateMasterKeyNickname', () => {
    it('should generate correct nicknames', () => {
      expect(generateMasterKeyNickname(1)).toBe('Wallet 1');
      expect(generateMasterKeyNickname(3)).toBe('Wallet 3');
    });
  });
});
