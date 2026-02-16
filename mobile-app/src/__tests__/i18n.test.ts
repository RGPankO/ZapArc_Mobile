// Unit tests for Location and i18n services
// Tests language selection based on IP-based country detection

// Mock services
jest.mock('../services/settingsService', () => ({
  settingsService: {
    getUserSettings: jest.fn(),
    updateUserSettings: jest.fn(),
  },
}));

import { LocationService } from '../services/locationService';
import { I18nService } from '../services/i18nService';
import { settingsService } from '../services/settingsService';

// =============================================================================
// Location Service Tests
// =============================================================================

describe('LocationService', () => {
  let locationService: LocationService;

  beforeEach(() => {
    locationService = new LocationService();
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe('getCountryByIP', () => {
    it('should return country code from IP provider', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ countryCode: 'BG' }),
      });

      const result = await locationService.getCountryByIP();
      expect(result).toBe('BG');
    });

    it('should cache result', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ countryCode: 'US' }),
      });

      await locationService.getCountryByIP();
      const result = await locationService.getCountryByIP();
      expect(result).toBe('US');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should try fallback provider on failure', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ country_code: 'DE' }),
        });

      const result = await locationService.getCountryByIP();
      expect(result).toBe('DE');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should return null when all providers fail', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('network'));

      const result = await locationService.getCountryByIP();
      expect(result).toBeNull();
    });
  });
});

// =============================================================================
// I18n Service Tests
// =============================================================================

describe('I18nService', () => {
  let i18nService: I18nService;

  beforeEach(() => {
    i18nService = new I18nService();
    jest.clearAllMocks();
  });

  it('should default to English', () => {
    expect(i18nService.getCurrentLanguage()).toBe('en');
  });
});
