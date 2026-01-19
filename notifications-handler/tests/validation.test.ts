/**
 * Unit tests for validation module
 */

import { describe, it, expect } from 'vitest';
import { validateRequest } from '../src/validation.js';

describe('validateRequest', () => {
  describe('expoPushToken validation', () => {
    it('should accept valid expoPushToken', () => {
      const result = validateRequest('ExponentPushToken[abc123]', 1000);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject undefined expoPushToken', () => {
      const result = validateRequest(undefined, 1000);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing required parameter: expoPushToken');
    });

    it('should reject null expoPushToken', () => {
      const result = validateRequest(null, 1000);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing required parameter: expoPushToken');
    });

    it('should reject non-string expoPushToken', () => {
      const result = validateRequest(12345, 1000);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid expoPushToken: must be a string');
    });

    it('should reject empty string expoPushToken', () => {
      const result = validateRequest('', 1000);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Invalid expoPushToken: must be a non-empty string'
      );
    });

    it('should reject whitespace-only expoPushToken', () => {
      const result = validateRequest('   ', 1000);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Invalid expoPushToken: must be a non-empty string'
      );
    });

    it('should accept expoPushToken with surrounding whitespace (trimmed)', () => {
      // Note: The validation trims, so "  token  " should pass if non-empty after trim
      const result = validateRequest('  ExponentPushToken[abc]  ', 1000);
      expect(result.valid).toBe(true);
    });
  });

  describe('amount validation', () => {
    it('should accept valid positive amount', () => {
      const result = validateRequest('token', 1000);
      expect(result.valid).toBe(true);
    });

    it('should accept small positive amount', () => {
      const result = validateRequest('token', 1);
      expect(result.valid).toBe(true);
    });

    it('should accept decimal amount', () => {
      const result = validateRequest('token', 0.5);
      expect(result.valid).toBe(true);
    });

    it('should reject undefined amount', () => {
      const result = validateRequest('token', undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing required parameter: amount');
    });

    it('should reject null amount', () => {
      const result = validateRequest('token', null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing required parameter: amount');
    });

    it('should reject zero amount', () => {
      const result = validateRequest('token', 0);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid amount: must be a positive number');
    });

    it('should reject negative amount', () => {
      const result = validateRequest('token', -100);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid amount: must be a positive number');
    });

    it('should reject string amount', () => {
      const result = validateRequest('token', '1000');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid amount: must be a number');
    });

    it('should reject NaN amount', () => {
      const result = validateRequest('token', NaN);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid amount: must be a number');
    });
  });

  describe('combined validation', () => {
    it('should validate both parameters together', () => {
      const result = validateRequest('ExponentPushToken[xyz789]', 21000000);
      expect(result.valid).toBe(true);
    });

    it('should fail on first validation error (expoPushToken)', () => {
      const result = validateRequest('', -100);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Invalid expoPushToken: must be a non-empty string'
      );
    });
  });
});
