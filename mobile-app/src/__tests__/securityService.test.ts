jest.mock(
  'expo-screen-capture',
  () => ({
    preventScreenCaptureAsync: jest.fn().mockResolvedValue(undefined),
    allowScreenCaptureAsync: jest.fn().mockResolvedValue(undefined),
  }),
  { virtual: true }
);

jest.mock('react-native-quick-crypto', () => ({
  pbkdf2Sync: jest.fn(),
  randomBytes: jest.fn(() => ({ toString: () => '00' })),
}));

jest.mock('../services/storageService', () => ({
  storageService: {
    updateActivity: jest.fn(),
    getLastActivity: jest.fn(async () => Date.now()),
    lockWallet: jest.fn(async () => undefined),
    unlockWallet: jest.fn(async () => undefined),
  },
}));

jest.mock('../services/settingsService', () => ({
  settingsService: {
    getUserSettings: jest.fn(async () => ({ autoLockTimeout: 900, biometricEnabled: true })),
    updateUserSettings: jest.fn(async () => undefined),
  },
}));

import { securityService } from '../services/securityService';

const screenCapture = require('expo-screen-capture') as {
  preventScreenCaptureAsync: jest.Mock;
  allowScreenCaptureAsync: jest.Mock;
};

describe('securityService screenshot prevention', () => {
  beforeEach(() => {
    securityService.disableScreenshotPrevention();
    securityService.disableScreenshotPrevention();
    jest.clearAllMocks();
  });

  it('enables native capture prevention when guard is turned on', () => {
    securityService.enableScreenshotPrevention();

    expect(screenCapture.preventScreenCaptureAsync).toHaveBeenCalledTimes(1);
    expect(securityService.isScreenshotPreventionEnabled()).toBe(true);
  });

  it('uses reference counting and re-allows capture only after final disable', () => {
    securityService.enableScreenshotPrevention();
    securityService.enableScreenshotPrevention();

    expect(screenCapture.preventScreenCaptureAsync).toHaveBeenCalledTimes(1);

    securityService.disableScreenshotPrevention();
    expect(screenCapture.allowScreenCaptureAsync).not.toHaveBeenCalled();
    expect(securityService.isScreenshotPreventionEnabled()).toBe(true);

    securityService.disableScreenshotPrevention();
    expect(screenCapture.allowScreenCaptureAsync).toHaveBeenCalledTimes(1);
    expect(securityService.isScreenshotPreventionEnabled()).toBe(false);
  });
});
