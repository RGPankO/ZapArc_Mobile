// Amount Validation Tests
// Tests for tip amount validation and formatting

describe('Amount Validation', () => {
  // ==========================================================================
  // Validation Functions (inline for testing)
  // ==========================================================================

  const MIN_AMOUNT = 1;
  const MAX_AMOUNT = 100_000_000; // 100M sats = 1 BTC

  const isValidAmount = (amount: number): boolean => {
    return (
      Number.isInteger(amount) &&
      amount >= MIN_AMOUNT &&
      amount <= MAX_AMOUNT
    );
  };

  const areAmountsUnique = (amounts: number[]): boolean => {
    const unique = new Set(amounts);
    return unique.size === amounts.length;
  };

  const validateAmountArray = (amounts: number[]): { valid: boolean; error?: string } => {
    if (!Array.isArray(amounts)) {
      return { valid: false, error: 'Amounts must be an array' };
    }

    if (amounts.length === 0) {
      return { valid: false, error: 'At least one amount is required' };
    }

    if (amounts.length > 5) {
      return { valid: false, error: 'Maximum 5 amounts allowed' };
    }

    for (const amount of amounts) {
      if (!isValidAmount(amount)) {
        return {
          valid: false,
          error: `Invalid amount: ${amount}. Must be between ${MIN_AMOUNT} and ${MAX_AMOUNT.toLocaleString()} sats`,
        };
      }
    }

    if (!areAmountsUnique(amounts)) {
      return { valid: false, error: 'All amounts must be unique' };
    }

    return { valid: true };
  };

  const formatSats = (amount: number): string => {
    if (amount >= 1_000_000) {
      const value = amount / 1_000_000;
      return `${Number(value.toFixed(2))}M sats`;
    }
    if (amount >= 1_000) {
      const value = amount / 1_000;
      return `${Number(value.toFixed(1))}K sats`;
    }
    return `${amount} sats`;
  };

  const parseSatsInput = (input: string): number | null => {
    const cleaned = input.replace(/[,\s]/g, '').toLowerCase();

    // Handle K/M suffixes
    if (cleaned.endsWith('k')) {
      const num = parseFloat(cleaned.slice(0, -1));
      return isNaN(num) ? null : Math.round(num * 1_000);
    }
    if (cleaned.endsWith('m')) {
      const num = parseFloat(cleaned.slice(0, -1));
      return isNaN(num) ? null : Math.round(num * 1_000_000);
    }

    // Handle "sats" suffix
    const withoutSats = cleaned.replace(/sats?$/, '');
    const num = parseInt(withoutSats, 10);
    return isNaN(num) ? null : num;
  };

  // ==========================================================================
  // Individual Amount Validation Tests
  // ==========================================================================

  describe('isValidAmount', () => {
    it('should accept valid amounts', () => {
      expect(isValidAmount(1)).toBe(true);
      expect(isValidAmount(100)).toBe(true);
      expect(isValidAmount(1000)).toBe(true);
      expect(isValidAmount(21000)).toBe(true);
      expect(isValidAmount(100_000_000)).toBe(true);
    });

    it('should reject zero', () => {
      expect(isValidAmount(0)).toBe(false);
    });

    it('should reject negative amounts', () => {
      expect(isValidAmount(-1)).toBe(false);
      expect(isValidAmount(-100)).toBe(false);
    });

    it('should reject amounts exceeding maximum', () => {
      expect(isValidAmount(100_000_001)).toBe(false);
      expect(isValidAmount(1_000_000_000)).toBe(false);
    });

    it('should reject non-integer amounts', () => {
      expect(isValidAmount(10.5)).toBe(false);
      expect(isValidAmount(100.99)).toBe(false);
    });

    it('should reject NaN and Infinity', () => {
      expect(isValidAmount(NaN)).toBe(false);
      expect(isValidAmount(Infinity)).toBe(false);
      expect(isValidAmount(-Infinity)).toBe(false);
    });
  });

  // ==========================================================================
  // Uniqueness Tests
  // ==========================================================================

  describe('areAmountsUnique', () => {
    it('should return true for unique amounts', () => {
      expect(areAmountsUnique([100, 500, 1000])).toBe(true);
      expect(areAmountsUnique([1])).toBe(true);
      expect(areAmountsUnique([21, 210, 2100, 21000])).toBe(true);
    });

    it('should return false for duplicate amounts', () => {
      expect(areAmountsUnique([100, 100, 500])).toBe(false);
      expect(areAmountsUnique([100, 500, 100])).toBe(false);
      expect(areAmountsUnique([100, 100])).toBe(false);
    });

    it('should handle empty arrays', () => {
      expect(areAmountsUnique([])).toBe(true);
    });
  });

  // ==========================================================================
  // Array Validation Tests
  // ==========================================================================

  describe('validateAmountArray', () => {
    it('should accept valid amount arrays', () => {
      expect(validateAmountArray([100, 500, 1000])).toEqual({ valid: true });
      expect(validateAmountArray([21])).toEqual({ valid: true });
      expect(validateAmountArray([21, 210, 2100, 21000, 210000])).toEqual({ valid: true });
    });

    it('should reject empty arrays', () => {
      const result = validateAmountArray([]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('At least one amount');
    });

    it('should reject arrays with more than 5 amounts', () => {
      const result = validateAmountArray([100, 200, 300, 400, 500, 600]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Maximum 5 amounts');
    });

    it('should reject arrays with invalid amounts', () => {
      const result = validateAmountArray([100, -50, 1000]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid amount');
    });

    it('should reject arrays with duplicate amounts', () => {
      const result = validateAmountArray([100, 500, 100]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('unique');
    });

    it('should reject amounts exceeding maximum', () => {
      const result = validateAmountArray([100, 100_000_001]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid amount');
    });
  });

  // ==========================================================================
  // Formatting Tests
  // ==========================================================================

  describe('formatSats', () => {
    it('should format small amounts as plain sats', () => {
      expect(formatSats(1)).toBe('1 sats');
      expect(formatSats(100)).toBe('100 sats');
      expect(formatSats(999)).toBe('999 sats');
    });

    it('should format thousands with K suffix', () => {
      expect(formatSats(1000)).toBe('1K sats');
      expect(formatSats(2100)).toBe('2.1K sats');
      expect(formatSats(21000)).toBe('21K sats');
      expect(formatSats(100000)).toBe('100K sats');
    });

    it('should format millions with M suffix', () => {
      expect(formatSats(1000000)).toBe('1M sats');
      expect(formatSats(2100000)).toBe('2.1M sats');
      expect(formatSats(21000000)).toBe('21M sats');
      expect(formatSats(100000000)).toBe('100M sats');
    });

    it('should handle edge cases', () => {
      expect(formatSats(1500)).toBe('1.5K sats');
      expect(formatSats(1500000)).toBe('1.5M sats');
    });
  });

  // ==========================================================================
  // Input Parsing Tests
  // ==========================================================================

  describe('parseSatsInput', () => {
    it('should parse plain numbers', () => {
      expect(parseSatsInput('100')).toBe(100);
      expect(parseSatsInput('1000')).toBe(1000);
      expect(parseSatsInput('21000')).toBe(21000);
    });

    it('should parse numbers with commas', () => {
      expect(parseSatsInput('1,000')).toBe(1000);
      expect(parseSatsInput('21,000')).toBe(21000);
      expect(parseSatsInput('1,000,000')).toBe(1000000);
    });

    it('should parse K suffix', () => {
      expect(parseSatsInput('1k')).toBe(1000);
      expect(parseSatsInput('1K')).toBe(1000);
      expect(parseSatsInput('21k')).toBe(21000);
      expect(parseSatsInput('2.1k')).toBe(2100);
    });

    it('should parse M suffix', () => {
      expect(parseSatsInput('1m')).toBe(1000000);
      expect(parseSatsInput('1M')).toBe(1000000);
      expect(parseSatsInput('2.1M')).toBe(2100000);
    });

    it('should handle "sats" suffix', () => {
      expect(parseSatsInput('100 sats')).toBe(100);
      expect(parseSatsInput('1000sats')).toBe(1000);
      expect(parseSatsInput('21sat')).toBe(21);
    });

    it('should return null for invalid input', () => {
      expect(parseSatsInput('')).toBe(null);
      expect(parseSatsInput('abc')).toBe(null);
      expect(parseSatsInput('not a number')).toBe(null);
    });

    it('should handle whitespace', () => {
      expect(parseSatsInput(' 100 ')).toBe(100);
      expect(parseSatsInput('1 000')).toBe(1000);
    });
  });

  // ==========================================================================
  // Bitcoin-specific Amount Tests
  // ==========================================================================

  describe('Bitcoin amounts', () => {
    it('should handle common Bitcoin tip amounts', () => {
      // Common Lightning tips
      expect(isValidAmount(21)).toBe(true); // 21 sats
      expect(isValidAmount(210)).toBe(true); // 210 sats
      expect(isValidAmount(2100)).toBe(true); // 2,100 sats
      expect(isValidAmount(21000)).toBe(true); // 21,000 sats (≈ $21 at 100k/BTC)
    });

    it('should handle 1 BTC limit', () => {
      // 1 BTC = 100,000,000 sats
      expect(isValidAmount(100_000_000)).toBe(true);
      expect(isValidAmount(100_000_001)).toBe(false);
    });

    it('should handle typical preset amounts', () => {
      const presets = [100, 500, 1000, 5000, 10000, 21000];
      presets.forEach((amount) => {
        expect(isValidAmount(amount)).toBe(true);
      });
    });
  });
});
