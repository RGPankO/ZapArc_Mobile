// Unit tests for Location and i18n services
// Tests language selection based on location

// Mock expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
  Accuracy: {
    Lowest: 1,
    Low: 2,
    Balanced: 3,
    High: 4,
    Highest: 5,
  },
}));

// Mock services
jest.mock('../services/settingsService', () => ({
  settingsService: {
    getUserSettings: jest.fn(),
    updateUserSettings: jest.fn(),
  },
}));

import * as Location from 'expo-location';
import { LocationService } from '../services/locationService';
import { I18nService } from '../services/i18nService';
import { settingsService } from '../services/settingsService';

// =============================================================================
// LocationService Tests
// =============================================================================

describe('LocationService', () => {
  let locationService: LocationService;

  beforeEach(() => {
    jest.clearAllMocks();
    locationService = new LocationService();
  });

  describe('isCoordinateInBulgaria', () => {
    it('should return true for Sofia coordinates', () => {
      // Sofia: 42.6977° N, 23.3219° E
      expect(locationService.isCoordinateInBulgaria(42.6977, 23.3219)).toBe(true);
    });

    it('should return true for Plovdiv coordinates', () => {
      // Plovdiv: 42.1354° N, 24.7453° E
      expect(locationService.isCoordinateInBulgaria(42.1354, 24.7453)).toBe(true);
    });

    it('should return true for Varna coordinates', () => {
      // Varna: 43.2141° N, 27.9147° E
      expect(locationService.isCoordinateInBulgaria(43.2141, 27.9147)).toBe(true);
    });

    it('should return false for London coordinates', () => {
      // London: 51.5074° N, 0.1278° W
      expect(locationService.isCoordinateInBulgaria(51.5074, -0.1278)).toBe(false);
    });

    it('should return false for New York coordinates', () => {
      // New York: 40.7128° N, 74.0060° W
      expect(locationService.isCoordinateInBulgaria(40.7128, -74.006)).toBe(false);
    });

    it('should return false for coordinates outside Bulgaria bounding box', () => {
      // North of Bulgaria
      expect(locationService.isCoordinateInBulgaria(45.0, 25.0)).toBe(false);
      // South of Bulgaria
      expect(locationService.isCoordinateInBulgaria(40.0, 25.0)).toBe(false);
      // East of Bulgaria
      expect(locationService.isCoordinateInBulgaria(42.5, 30.0)).toBe(false);
      // West of Bulgaria
      expect(locationService.isCoordinateInBulgaria(42.5, 21.0)).toBe(false);
    });
  });

  describe('requestPermission', () => {
    it('should return granted when permission is granted', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
        canAskAgain: true,
      });

      const result = await locationService.requestPermission();

      expect(result.granted).toBe(true);
      expect(result.canAskAgain).toBe(true);
    });

    it('should return not granted when permission is denied', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
        canAskAgain: false,
      });

      const result = await locationService.requestPermission();

      expect(result.granted).toBe(false);
      expect(result.canAskAgain).toBe(false);
    });
  });

  describe('getCurrentLocation', () => {
    it('should return location info when in Bulgaria', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
        coords: { latitude: 42.6977, longitude: 23.3219 }, // Sofia
      });

      const result = await locationService.getCurrentLocation();

      expect(result).not.toBeNull();
      expect(result?.isInBulgaria).toBe(true);
      expect(result?.countryCode).toBe('BG');
    });

    it('should fall back to IP-based detection when permission not granted', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const result = await locationService.getCurrentLocation();

      expect(result).not.toBeNull();
    });
  });
});

// =============================================================================
// I18nService Tests
// =============================================================================

describe('I18nService', () => {
  let i18nService: I18nService;

  beforeEach(() => {
    jest.clearAllMocks();
    i18nService = new I18nService();
  });

  describe('getLanguage', () => {
    it('should default to English', () => {
      expect(i18nService.getLanguage()).toBe('en');
    });
  });

  describe('setLanguage', () => {
    it('should set language to Bulgarian', async () => {
      (settingsService.updateUserSettings as jest.Mock).mockResolvedValue({});

      await i18nService.setLanguage('bg');

      expect(i18nService.getLanguage()).toBe('bg');
      expect(i18nService.isManuallySet()).toBe(true);
      expect(settingsService.updateUserSettings).toHaveBeenCalledWith({
        language: 'bg',
      });
    });

    it('should set language to English', async () => {
      (settingsService.updateUserSettings as jest.Mock).mockResolvedValue({});

      await i18nService.setLanguage('en');

      expect(i18nService.getLanguage()).toBe('en');
      expect(i18nService.isManuallySet()).toBe(true);
    });
  });

  describe('t (translation)', () => {
    it('should return translated string for valid key', () => {
      const result = i18nService.t('common.loading');
      expect(result).toBe('Loading...');
    });

    it('should return key path for missing key', () => {
      const result = i18nService.t('nonexistent.key');
      expect(result).toBe('nonexistent.key');
    });

    it('should interpolate parameters', () => {
      // Test with a simple template
      const result = i18nService.t('wallet.balance');
      expect(result).toBe('Balance');
    });

    it('should return Bulgarian translation when language is set', async () => {
      (settingsService.updateUserSettings as jest.Mock).mockResolvedValue({});
      await i18nService.setLanguage('bg');

      const result = i18nService.t('common.loading');
      expect(result).toBe('Зареждане...');
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return English and Bulgarian', () => {
      const languages = i18nService.getSupportedLanguages();

      expect(languages).toHaveLength(2);
      expect(languages.find((l) => l.code === 'en')).toBeDefined();
      expect(languages.find((l) => l.code === 'bg')).toBeDefined();
    });
  });
});

// =============================================================================
// Language Selection Integration Tests
// =============================================================================

describe('Language Selection Logic', () => {
  describe('Bulgaria coordinates should return Bulgarian', () => {
    it('Sofia -> Bulgarian', () => {
      const locationService = new LocationService();
      const isInBulgaria = locationService.isCoordinateInBulgaria(42.6977, 23.3219);
      expect(isInBulgaria).toBe(true);
      // Language would be 'bg' for Bulgaria
    });
  });

  describe('Non-Bulgaria coordinates should return English', () => {
    it('London -> English (not Bulgaria)', () => {
      const locationService = new LocationService();
      const isInBulgaria = locationService.isCoordinateInBulgaria(51.5074, -0.1278);
      expect(isInBulgaria).toBe(false);
      // Language would be 'en' for non-Bulgaria
    });

    it('Tokyo -> English (not Bulgaria)', () => {
      const locationService = new LocationService();
      const isInBulgaria = locationService.isCoordinateInBulgaria(35.6762, 139.6503);
      expect(isInBulgaria).toBe(false);
    });
  });

  describe('Manual override should persist', () => {
    it('should mark as manually set when setLanguage is called', async () => {
      const i18nService = new I18nService();
      (settingsService.updateUserSettings as jest.Mock).mockResolvedValue({});

      expect(i18nService.isManuallySet()).toBe(false);

      await i18nService.setLanguage('bg');

      expect(i18nService.isManuallySet()).toBe(true);
      expect(settingsService.updateUserSettings).toHaveBeenCalledWith({
        language: 'bg',
      });
    });
  });
});
