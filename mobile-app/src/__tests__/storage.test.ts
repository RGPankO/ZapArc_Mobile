// Unit tests for StorageService and crypto utilities
// Tests encryption/decryption, PIN verification, and multi-wallet storage

// Mock expo-crypto before importing anything that uses it
jest.mock('expo-crypto', () => {
  // Simple counter for generating unique UUIDs
  let uuidCounter = 0;

  return {
    randomUUID: jest.fn(() => {
      uuidCounter++;
      // Generate a valid UUID v4 format
      const hex = uuidCounter.toString(16).padStart(32, '0');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
    }),
    getRandomBytesAsync: jest.fn(async (length: number) => {
      // Generate pseudo-random bytes for testing
      const bytes = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
      return bytes;
    }),
    digestStringAsync: jest.fn(async (_algorithm: string, data: string) => {
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(data).digest('hex');
    }),
    CryptoDigestAlgorithm: {
      SHA256: 'SHA-256',
    },
    CryptoEncoding: {
      HEX: 'hex',
    },
  };
});

import { encryptData, decryptData, verifyPin, generateUUID } from '../services/crypto';

// =============================================================================
// Crypto Utilities Tests
// =============================================================================

describe('Crypto Utilities', () => {
  describe('generateUUID', () => {
    it('should generate a valid UUID v4 format', () => {
      const uuid = generateUUID();
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidRegex);
    });

    it('should generate unique UUIDs', () => {
      const uuids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        uuids.add(generateUUID());
      }
      expect(uuids.size).toBe(100);
    });
  });

  describe('encryptData and decryptData', () => {
    const testPin = '123456';
    const testData = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

    it('should encrypt then decrypt and return original data', async () => {
      const encrypted = await encryptData(testData, testPin);

      expect(encrypted).toHaveProperty('data');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('timestamp');
      expect(encrypted.data).toBeInstanceOf(Array);
      expect(encrypted.iv).toBeInstanceOf(Array);
      expect(encrypted.iv.length).toBe(12); // 96 bits
      expect(encrypted.timestamp).toBeLessThanOrEqual(Date.now());

      const decrypted = await decryptData(encrypted, testPin);
      expect(decrypted).toBe(testData);
    });

    it('should fail decryption with invalid PIN', async () => {
      const encrypted = await encryptData(testData, testPin);
      const wrongPin = '654321';

      await expect(decryptData(encrypted, wrongPin)).rejects.toThrow(
        'Failed to decrypt data'
      );
    });

    it('should produce different encrypted output for same data (due to random IV)', async () => {
      const encrypted1 = await encryptData(testData, testPin);
      const encrypted2 = await encryptData(testData, testPin);

      // IV should be different
      expect(encrypted1.iv).not.toEqual(encrypted2.iv);
      // Encrypted data should be different
      expect(encrypted1.data).not.toEqual(encrypted2.data);
    });

    it('should handle empty string encryption', async () => {
      const emptyData = '';
      const encrypted = await encryptData(emptyData, testPin);
      const decrypted = await decryptData(encrypted, testPin);
      expect(decrypted).toBe(emptyData);
    });

    it('should handle unicode characters', async () => {
      const unicodeData = 'Български текст 🔐⚡️';
      const encrypted = await encryptData(unicodeData, testPin);
      const decrypted = await decryptData(encrypted, testPin);
      expect(decrypted).toBe(unicodeData);
    });
  });

  describe('verifyPin', () => {
    const testPin = '123456';
    const testData = 'test mnemonic phrase';

    it('should return true for correct PIN', async () => {
      const encrypted = await encryptData(testData, testPin);
      const isValid = await verifyPin(encrypted, testPin);
      expect(isValid).toBe(true);
    });

    it('should return false for incorrect PIN', async () => {
      const encrypted = await encryptData(testData, testPin);
      const isValid = await verifyPin(encrypted, 'wrongpin');
      expect(isValid).toBe(false);
    });

    it('should return false for empty PIN', async () => {
      const encrypted = await encryptData(testData, testPin);
      const isValid = await verifyPin(encrypted, '');
      expect(isValid).toBe(false);
    });
  });
});

// =============================================================================
// Storage Service Tests (Mocked SecureStore)
// =============================================================================

// Mock Expo SecureStore
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import { StorageService } from '../services/storageService';

describe('StorageService', () => {
  let storageService: StorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    storageService = new StorageService();
  });

  describe('walletExists', () => {
    it('should return false when no wallet data exists', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const exists = await storageService.walletExists();
      expect(exists).toBe(false);
    });

    it('should return true when wallet data exists', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({ masterKeys: [], version: 1 })
      );

      const exists = await storageService.walletExists();
      expect(exists).toBe(true);
    });
  });

  describe('lockWallet and unlockWallet', () => {
    it('should lock wallet', async () => {
      await storageService.lockWallet();

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'zap_arc_is_unlocked',
        'false'
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'zap_arc_last_activity',
        '0'
      );
    });

    it('should unlock wallet', async () => {
      await storageService.unlockWallet();

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'zap_arc_is_unlocked',
        'true'
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'zap_arc_last_activity',
        expect.any(String)
      );
    });
  });

  describe('isWalletUnlocked', () => {
    it('should return false when not unlocked', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('false');

      const isUnlocked = await storageService.isWalletUnlocked();
      expect(isUnlocked).toBe(false);
    });

    it('should return true when unlocked', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('true');

      const isUnlocked = await storageService.isWalletUnlocked();
      expect(isUnlocked).toBe(true);
    });
  });

  describe('createMasterKey', () => {
    const testMnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const testNickname = 'Test Wallet';
    const testPin = '123456';

    it('should create a new master key', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

      const masterKeyId = await storageService.createMasterKey(
        testMnemonic,
        testNickname,
        testPin
      );

      expect(masterKeyId).toBeDefined();
      expect(typeof masterKeyId).toBe('string');
      expect(masterKeyId.length).toBeGreaterThan(0);
      expect(SecureStore.setItemAsync).toHaveBeenCalled();
    });
  });

  describe('deleteAllWallets', () => {
    it('should delete all wallet-related data', async () => {
      (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);

      await storageService.deleteAllWallets();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'zap_arc_multi_wallet_data'
      );
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'zap_arc_wallet_version'
      );
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'zap_arc_is_unlocked'
      );
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'zap_arc_last_activity'
      );
    });
  });

  describe('getNextSubWalletIndex', () => {
    it('should return 0 when no storage exists', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const index = await storageService.getNextSubWalletIndex('test-id');
      expect(index).toBe(0);
    });

    it('should skip indices occupied by active and archived sub-wallets', async () => {
      const mockStorage = {
        masterKeys: [
          {
            id: 'test-id',
            nickname: 'Test',
            subWallets: [
              { index: 0, nickname: 'W0' },
              { index: 1, nickname: 'W1' },
            ],
            archivedSubWallets: [{ index: 2, nickname: 'W2' }],
          },
        ],
        version: 1,
      };

      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(mockStorage)
      );

      const index = await storageService.getNextSubWalletIndex('test-id');
      expect(index).toBe(3); // Should skip 0, 1, 2
    });
  });
});

// =============================================================================
// Settings Service Tests (Mocked AsyncStorage)
// =============================================================================

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SettingsService } from '../services/settingsService';
import { DomainStatus, DEFAULT_USER_SETTINGS } from '../features/settings/types';

describe('SettingsService', () => {
  let settingsService: SettingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    settingsService = new SettingsService();
  });

  describe('getUserSettings', () => {
    it('should return default settings when none stored', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const settings = await settingsService.getUserSettings();
      expect(settings).toEqual(DEFAULT_USER_SETTINGS);
    });

    it('should merge stored settings with defaults', async () => {
      const partialSettings = {
        language: 'bg' as const,
        biometricEnabled: true,
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(partialSettings)
      );

      const settings = await settingsService.getUserSettings();
      expect(settings.language).toBe('bg');
      expect(settings.biometricEnabled).toBe(true);
      expect(settings.currency).toBe(DEFAULT_USER_SETTINGS.currency);
    });
  });

  describe('saveUserSettings', () => {
    it('should save settings to AsyncStorage', async () => {
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await settingsService.saveUserSettings(DEFAULT_USER_SETTINGS);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@zap_arc/user_settings',
        JSON.stringify(DEFAULT_USER_SETTINGS)
      );
    });
  });

  describe('Domain Settings', () => {
    it('should set and get domain status', async () => {
      const domain = 'example.com';
      const status = DomainStatus.WHITELISTED;

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await settingsService.setDomainStatus(domain, status);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@zap_arc/domain_settings',
        JSON.stringify({ [domain]: status })
      );
    });

    it('should return null for unknown domain', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const status = await settingsService.getDomainStatus('unknown.com');
      expect(status).toBeNull();
    });
  });

  describe('Blacklist', () => {
    it('should return empty blacklist when none stored', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const blacklist = await settingsService.getBlacklist();
      expect(blacklist.lnurls).toEqual([]);
      expect(blacklist.lightningAddresses).toEqual([]);
    });

    it('should add and check LNURL in blacklist', async () => {
      const lnurl = 'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcen';

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await settingsService.addToBlacklist(lnurl);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@zap_arc/blacklist_data',
        expect.stringContaining(lnurl)
      );
    });

    it('should check if LNURL is blacklisted', async () => {
      const lnurl = 'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcen';
      const blacklistData = {
        lnurls: [lnurl],
        lightningAddresses: [],
        lastUpdated: Date.now(),
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(blacklistData)
      );

      const isBlacklisted = await settingsService.isBlacklisted(lnurl);
      expect(isBlacklisted).toBe(true);

      const isNotBlacklisted = await settingsService.isBlacklisted('other-lnurl');
      expect(isNotBlacklisted).toBe(false);
    });
  });

  describe('Onboarding', () => {
    it('should return false when onboarding not complete', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const complete = await settingsService.isOnboardingComplete();
      expect(complete).toBe(false);
    });

    it('should set onboarding complete', async () => {
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await settingsService.setOnboardingComplete(true);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@zap_arc/onboarding_complete',
        'true'
      );
    });
  });

  describe('clearAllSettings', () => {
    it('should remove all settings keys', async () => {
      (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);

      await settingsService.clearAllSettings();

      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
        '@zap_arc/user_settings',
        '@zap_arc/domain_settings',
        '@zap_arc/blacklist_data',
        '@zap_arc/onboarding_complete',
        '@zap_arc/last_sync_time',
      ]);
    });
  });
});
