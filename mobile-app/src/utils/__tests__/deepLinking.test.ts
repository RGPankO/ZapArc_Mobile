jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('react-native', () => ({
  Linking: {
    addEventListener: jest.fn(),
    getInitialURL: jest.fn().mockResolvedValue(null),
  },
}));

import { router } from 'expo-router';
import { handleDeepLink, isValidDeepLink } from '../deepLinking';

describe('deepLinking security hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts trusted verify-email link and routes correctly', () => {
    const handled = handleDeepLink('mobile-app://verify-email?token=abc123');

    expect(handled).toBe(true);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/auth/verify-email',
      params: { token: 'abc123' },
    });
  });

  it('rejects external scheme without navigation', () => {
    const handled = handleDeepLink('https://evil.example/reset-password?token=hijack');

    expect(handled).toBe(false);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('rejects malformed or untrusted app-link host without navigation', () => {
    const handled = handleDeepLink('mobile-app://attacker-path?token=hijack');

    expect(handled).toBe(false);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('isValidDeepLink only allows trusted scheme and hosts', () => {
    expect(isValidDeepLink('mobile-app://verify-email?token=ok')).toBe(true);
    expect(isValidDeepLink('mobile-app://reset-password?token=ok')).toBe(true);
    expect(isValidDeepLink('mobile-app://unknown?token=bad')).toBe(false);
    expect(isValidDeepLink('https://example.com/verify-email')).toBe(false);
  });
});
