// useSettings Hook
// Manages app settings, domain settings, and blacklist

import { useState, useCallback, useEffect } from 'react';
import { settingsService } from '../services';
import type {
  UserSettings,
  DomainStatus,
  BlacklistData,
  CurrencyCode,
  AutoLockTimeout,
  SocialPlatform,
} from '../features/settings/types';

// =============================================================================
// Types
// =============================================================================

export interface SettingsState {
  // User settings
  settings: UserSettings | null;
  isLoading: boolean;
  error: string | null;

  // App state
  isOnboardingComplete: boolean;
  lastSyncTime: number | null;
}

export interface SettingsActions {
  // Settings management
  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;

  // Individual setting updates
  setCurrency: (currency: CurrencyCode) => Promise<void>;
  setAutoLockTimeout: (timeout: AutoLockTimeout) => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  setDefaultTipAmounts: (amounts: [number, number, number]) => Promise<void>;
  setDefaultPostAmounts: (amounts: [number, number, number]) => Promise<void>;
  setCustomLNURL: (lnurl: string | undefined) => Promise<void>;
  setSharingPlatforms: (platforms: SocialPlatform[]) => Promise<void>;

  // Domain settings
  getDomainStatus: (domain: string) => Promise<DomainStatus>;
  setDomainStatus: (domain: string, status: DomainStatus) => Promise<void>;
  removeDomainStatus: (domain: string) => Promise<void>;

  // Blacklist
  isBlacklisted: (lnurl: string) => Promise<boolean>;
  addToBlacklist: (lnurl: string) => Promise<void>;
  removeFromBlacklist: (lnurl: string) => Promise<void>;
  clearBlacklist: () => Promise<void>;

  // App state
  completeOnboarding: () => Promise<void>;
  updateSyncTime: () => Promise<void>;

  // Import/Export
  exportSettings: () => Promise<string>;
  importSettings: (json: string) => Promise<boolean>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useSettings(): SettingsState & SettingsActions {
  // State
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  // ========================================
  // Initialize
  // ========================================

  useEffect(() => {
    loadSettings();
    checkOnboarding();
    loadSyncTime();
  }, []);

  // ========================================
  // Settings Management
  // ========================================

  const loadSettings = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const userSettings = await settingsService.getUserSettings();
      setSettings(userSettings);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load settings';
      setError(message);
      console.error('❌ [useSettings] Load failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateSettings = useCallback(
    async (updates: Partial<UserSettings>): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);

        await settingsService.updateUserSettings(updates);
        const updatedSettings = await settingsService.getUserSettings();
        setSettings(updatedSettings);

        console.log('✅ [useSettings] Settings updated');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update settings';
        setError(message);
        console.error('❌ [useSettings] Update failed:', err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const resetSettings = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      await settingsService.resetUserSettings();
      const defaultSettings = await settingsService.getUserSettings();
      setSettings(defaultSettings);

      console.log('✅ [useSettings] Settings reset to defaults');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset settings';
      setError(message);
      console.error('❌ [useSettings] Reset failed:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ========================================
  // Individual Setting Updates
  // ========================================

  const setCurrency = useCallback(
    async (currency: CurrencyCode): Promise<void> => {
      await updateSettings({ currency });
    },
    [updateSettings]
  );

  const setAutoLockTimeout = useCallback(
    async (timeout: AutoLockTimeout): Promise<void> => {
      await updateSettings({ autoLockTimeout: timeout });
    },
    [updateSettings]
  );

  const setBiometricEnabled = useCallback(
    async (enabled: boolean): Promise<void> => {
      await updateSettings({ biometricEnabled: enabled });
    },
    [updateSettings]
  );

  const setNotificationsEnabled = useCallback(
    async (enabled: boolean): Promise<void> => {
      await updateSettings({ notificationsEnabled: enabled });
    },
    [updateSettings]
  );

  const setDefaultTipAmounts = useCallback(
    async (amounts: [number, number, number]): Promise<void> => {
      await updateSettings({ defaultTippingAmounts: amounts });
    },
    [updateSettings]
  );

  const setDefaultPostAmounts = useCallback(
    async (amounts: [number, number, number]): Promise<void> => {
      await updateSettings({ defaultPostingAmounts: amounts });
    },
    [updateSettings]
  );

  const setCustomLNURL = useCallback(
    async (lnurl: string | undefined): Promise<void> => {
      await updateSettings({
        customLNURL: lnurl,
        useBuiltInWallet: !lnurl,
      });
    },
    [updateSettings]
  );

  const setSharingPlatforms = useCallback(
    async (platforms: SocialPlatform[]): Promise<void> => {
      await updateSettings({ preferredSharingPlatforms: platforms });
    },
    [updateSettings]
  );

  // ========================================
  // Domain Settings
  // ========================================

  const getDomainStatus = useCallback(
    async (domain: string): Promise<DomainStatus> => {
      return settingsService.getDomainStatus(domain);
    },
    []
  );

  const setDomainStatus = useCallback(
    async (domain: string, status: DomainStatus): Promise<void> => {
      try {
        await settingsService.setDomainStatus(domain, status);
        console.log('✅ [useSettings] Domain status set:', { domain, status });
      } catch (err) {
        console.error('❌ [useSettings] Set domain status failed:', err);
        throw err;
      }
    },
    []
  );

  const removeDomainStatus = useCallback(
    async (domain: string): Promise<void> => {
      try {
        await settingsService.removeDomainStatus(domain);
        console.log('✅ [useSettings] Domain status removed:', domain);
      } catch (err) {
        console.error('❌ [useSettings] Remove domain status failed:', err);
        throw err;
      }
    },
    []
  );

  // ========================================
  // Blacklist
  // ========================================

  const isBlacklisted = useCallback(async (lnurl: string): Promise<boolean> => {
    return settingsService.isBlacklisted(lnurl);
  }, []);

  const addToBlacklist = useCallback(async (lnurl: string): Promise<void> => {
    try {
      await settingsService.addToBlacklist(lnurl);
      console.log('✅ [useSettings] Added to blacklist:', lnurl);
    } catch (err) {
      console.error('❌ [useSettings] Add to blacklist failed:', err);
      throw err;
    }
  }, []);

  const removeFromBlacklist = useCallback(
    async (lnurl: string): Promise<void> => {
      try {
        await settingsService.removeFromBlacklist(lnurl);
        console.log('✅ [useSettings] Removed from blacklist:', lnurl);
      } catch (err) {
        console.error('❌ [useSettings] Remove from blacklist failed:', err);
        throw err;
      }
    },
    []
  );

  const clearBlacklist = useCallback(async (): Promise<void> => {
    try {
      await settingsService.clearBlacklist();
      console.log('✅ [useSettings] Blacklist cleared');
    } catch (err) {
      console.error('❌ [useSettings] Clear blacklist failed:', err);
      throw err;
    }
  }, []);

  // ========================================
  // App State
  // ========================================

  const checkOnboarding = async () => {
    const complete = await settingsService.isOnboardingComplete();
    setIsOnboardingComplete(complete);
  };

  const loadSyncTime = async () => {
    const time = await settingsService.getLastSyncTime();
    setLastSyncTime(time);
  };

  const completeOnboarding = useCallback(async (): Promise<void> => {
    try {
      await settingsService.setOnboardingComplete(true);
      setIsOnboardingComplete(true);
      console.log('✅ [useSettings] Onboarding completed');
    } catch (err) {
      console.error('❌ [useSettings] Complete onboarding failed:', err);
      throw err;
    }
  }, []);

  const updateSyncTime = useCallback(async (): Promise<void> => {
    try {
      await settingsService.setLastSyncTime(Date.now());
      const time = await settingsService.getLastSyncTime();
      setLastSyncTime(time);
      console.log('✅ [useSettings] Sync time updated');
    } catch (err) {
      console.error('❌ [useSettings] Update sync time failed:', err);
    }
  }, []);

  // ========================================
  // Import/Export
  // ========================================

  const exportSettings = useCallback(async (): Promise<string> => {
    try {
      const exported = await settingsService.exportSettings();
      console.log('✅ [useSettings] Settings exported');
      return exported;
    } catch (err) {
      console.error('❌ [useSettings] Export failed:', err);
      throw err;
    }
  }, []);

  const importSettings = useCallback(async (json: string): Promise<boolean> => {
    try {
      const success = await settingsService.importSettings(json);
      if (success) {
        await loadSettings();
        console.log('✅ [useSettings] Settings imported');
      }
      return success;
    } catch (err) {
      console.error('❌ [useSettings] Import failed:', err);
      return false;
    }
  }, [loadSettings]);

  // ========================================
  // Return Hook Value
  // ========================================

  return {
    // State
    settings,
    isLoading,
    error,
    isOnboardingComplete,
    lastSyncTime,

    // Settings Management
    loadSettings,
    updateSettings,
    resetSettings,

    // Individual Settings
    setCurrency,
    setAutoLockTimeout,
    setBiometricEnabled,
    setNotificationsEnabled,
    setDefaultTipAmounts,
    setDefaultPostAmounts,
    setCustomLNURL,
    setSharingPlatforms,

    // Domain Settings
    getDomainStatus,
    setDomainStatus,
    removeDomainStatus,

    // Blacklist
    isBlacklisted,
    addToBlacklist,
    removeFromBlacklist,
    clearBlacklist,

    // App State
    completeOnboarding,
    updateSyncTime,

    // Import/Export
    exportSettings,
    importSettings,
  };
}
