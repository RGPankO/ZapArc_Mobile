/**
 * Unit tests for sendTransactionNotification Cloud Function
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock firebase-functions before importing index
vi.mock('firebase-functions/v2/https', () => ({
  onRequest: (handler: Function) => handler,
}));

// Mock config
vi.mock('../src/config.js', () => ({
  config: {
    EXPO_PUSH_API_URL: 'https://exp.host/--/api/v2/push/send',
  },
}));

// Import after mocks are set up
import { sendTransactionNotification } from '../src/index.js';

// Helper to create mock request/response
function createMockRequest(body: unknown, method = 'POST') {
  return {
    method,
    body,
  };
}

function createMockResponse() {
  const res = {
    statusCode: 0,
    body: null as unknown,
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn((data: unknown) => {
      res.body = data;
      return res;
    }),
  };
  return res;
}

describe('sendTransactionNotification', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Happy Path', () => {
    it('should send notification with valid inputs', async () => {
      // Mock successful Expo Push API response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ status: 'ok' }] }),
      });

      const req = createMockRequest({
        expoPushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
        amount: 1000,
      });
      const res = createMockResponse();

      await sendTransactionNotification(req as any, res as any);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: 'Notification sent successfully',
      });

      // Verify fetch was called with correct parameters
      expect(global.fetch).toHaveBeenCalledWith(
        'https://exp.host/--/api/v2/push/send',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
            title: 'Payment Received',
            body: 'You received 1000 sats!',
          }),
        }
      );
    });

    it('should format notification body correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ status: 'ok' }] }),
      });

      const req = createMockRequest({
        expoPushToken: 'ExponentPushToken[abc123]',
        amount: 21000000,
      });
      const res = createMockResponse();

      await sendTransactionNotification(req as any, res as any);

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.body).toBe('You received 21000000 sats!');
    });
  });

  describe('Input Validation - expoPushToken', () => {
    it('should reject missing expoPushToken', async () => {
      const req = createMockRequest({
        amount: 1000,
      });
      const res = createMockResponse();

      await sendTransactionNotification(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: 'Missing required parameter: expoPushToken',
      });
    });

    it('should reject empty expoPushToken', async () => {
      const req = createMockRequest({
        expoPushToken: '',
        amount: 1000,
      });
      const res = createMockResponse();

      await sendTransactionNotification(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: 'Invalid expoPushToken: must be a non-empty string',
      });
    });

    it('should reject whitespace-only expoPushToken', async () => {
      const req = createMockRequest({
        expoPushToken: '   ',
        amount: 1000,
      });
      const res = createMockResponse();

      await sendTransactionNotification(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: 'Invalid expoPushToken: must be a non-empty string',
      });
    });

    it('should reject non-string expoPushToken', async () => {
      const req = createMockRequest({
        expoPushToken: 12345,
        amount: 1000,
      });
      const res = createMockResponse();

      await sendTransactionNotification(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: 'Invalid expoPushToken: must be a string',
      });
    });
  });

  describe('Input Validation - amount', () => {
    it('should reject missing amount', async () => {
      const req = createMockRequest({
        expoPushToken: 'ExponentPushToken[abc123]',
      });
      const res = createMockResponse();

      await sendTransactionNotification(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: 'Missing required parameter: amount',
      });
    });

    it('should reject zero amount', async () => {
      const req = createMockRequest({
        expoPushToken: 'ExponentPushToken[abc123]',
        amount: 0,
      });
      const res = createMockResponse();

      await sendTransactionNotification(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: 'Invalid amount: must be a positive number',
      });
    });

    it('should reject negative amount', async () => {
      const req = createMockRequest({
        expoPushToken: 'ExponentPushToken[abc123]',
        amount: -100,
      });
      const res = createMockResponse();

      await sendTransactionNotification(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: 'Invalid amount: must be a positive number',
      });
    });

    it('should reject non-number amount', async () => {
      const req = createMockRequest({
        expoPushToken: 'ExponentPushToken[abc123]',
        amount: 'one thousand',
      });
      const res = createMockResponse();

      await sendTransactionNotification(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: 'Invalid amount: must be a number',
      });
    });
  });

  describe('HTTP Method Validation', () => {
    it('should reject GET requests', async () => {
      const req = createMockRequest(
        {
          expoPushToken: 'ExponentPushToken[abc123]',
          amount: 1000,
        },
        'GET'
      );
      const res = createMockResponse();

      await sendTransactionNotification(req as any, res as any);

      expect(res.statusCode).toBe(405);
      expect(res.body).toEqual({
        success: false,
        error: 'Method not allowed. Use POST.',
      });
    });
  });

  describe('Expo Push API Error Handling', () => {
    it('should handle Expo Push API HTTP error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const req = createMockRequest({
        expoPushToken: 'ExponentPushToken[abc123]',
        amount: 1000,
      });
      const res = createMockResponse();

      await sendTransactionNotification(req as any, res as any);

      expect(res.statusCode).toBe(500);
      expect((res.body as any).success).toBe(false);
      expect((res.body as any).error).toContain('Expo Push API returned 500');
    });

    it('should handle Expo Push API ticket error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              status: 'error',
              message: 'InvalidPushToken',
            },
          ],
        }),
      });

      const req = createMockRequest({
        expoPushToken: 'InvalidToken',
        amount: 1000,
      });
      const res = createMockResponse();

      await sendTransactionNotification(req as any, res as any);

      expect(res.statusCode).toBe(500);
      expect((res.body as any).success).toBe(false);
      expect((res.body as any).error).toContain('InvalidPushToken');
    });

    it('should handle network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const req = createMockRequest({
        expoPushToken: 'ExponentPushToken[abc123]',
        amount: 1000,
      });
      const res = createMockResponse();

      await sendTransactionNotification(req as any, res as any);

      expect(res.statusCode).toBe(500);
      expect((res.body as any).success).toBe(false);
      expect((res.body as any).error).toContain('Network error');
    });
  });
});
