jest.mock('../services/settingsService', () => ({
  settingsService: {
    getUserSettings: jest.fn(),
    updateUserSettings: jest.fn().mockResolvedValue(undefined),
  },
}));

import { I18nService } from '../services/i18nService';

describe('I18nService', () => {
  let i18nService: I18nService;

  beforeEach(() => {
    i18nService = new I18nService();
    jest.clearAllMocks();
  });

  it('defaults to English', () => {
    expect(i18nService.getLanguage()).toBe('en');
  });

  it('contains required on-chain translation keys for EN and BG', async () => {
    const requiredKeys = [
      'send.onchainTitle',
      'send.onchainDetected',
      'send.confirmationSpeed',
      'send.speedFast',
      'send.speedMedium',
      'send.speedSlow',
      'send.estimatedTime',
      'send.networkFee',
    ];

    for (const key of requiredKeys) {
      const en = i18nService.t(key);
      expect(en).toBeTruthy();
      expect(en).not.toBe(key);
    }

    await i18nService.setLanguage('bg');

    for (const key of requiredKeys) {
      const bg = i18nService.t(key);
      expect(bg).toBeTruthy();
      expect(bg).not.toBe(key);
    }
  });
});
