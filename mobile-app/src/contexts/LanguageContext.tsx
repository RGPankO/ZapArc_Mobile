// Language Context
// Provides language state and translations to entire app

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  i18n,
  locationService,
  type SupportedLanguage,
  type TranslationParams,
} from '../services';

// =============================================================================
// Context Types
// =============================================================================

interface LanguageContextValue {
  // State
  currentLanguage: SupportedLanguage;
  isManuallySet: boolean;
  isLoading: boolean;
  error: string | null;
  isInBulgaria: boolean | null;
  locationPermissionGranted: boolean;

  // Actions
  t: (keyPath: string, params?: TranslationParams) => string;
  setLanguage: (language: SupportedLanguage) => Promise<void>;
  resetToAuto: () => Promise<void>;
  requestLocationPermission: () => Promise<boolean>;
  detectFromLocation: () => Promise<void>;
}

// =============================================================================
// Context Creation
// =============================================================================

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

// =============================================================================
// Provider Component
// =============================================================================

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps): React.JSX.Element {
  // State
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>('en');
  const [isManuallySet, setIsManuallySet] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInBulgaria, setIsInBulgaria] = useState<boolean | null>(null);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);

  // ========================================
  // Initialize
  // ========================================

  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Initialize i18n service
        await i18n.initialize();

        // Update state from i18n service
        setCurrentLanguage(i18n.getLanguage());
        setIsManuallySet(i18n.isManuallySet());

        // Check location permission
        const hasPermission = await locationService.hasPermission();
        setLocationPermissionGranted(hasPermission);

        // Get cached location info
        const cachedLocation = locationService.getCachedLocation();
        if (cachedLocation) {
          setIsInBulgaria(cachedLocation.isInBulgaria);
        }

        console.log('✅ [LanguageProvider] Initialized:', {
          language: i18n.getLanguage(),
          manuallySet: i18n.isManuallySet(),
        });
      } catch (err) {
        console.error('❌ [LanguageProvider] Initialize failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize language');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  // ========================================
  // Translation
  // ========================================

  const t = useCallback(
    (keyPath: string, params?: TranslationParams): string => {
      return i18n.t(keyPath, params);
    },
    [currentLanguage] // Re-create when language changes to trigger re-renders
  );

  // ========================================
  // Language Management
  // ========================================

  const setLanguage = useCallback(
    async (language: SupportedLanguage): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);

        await i18n.setLanguage(language);
        setCurrentLanguage(language);
        setIsManuallySet(true);

        console.log('✅ [LanguageProvider] Language set to:', language);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to set language';
        setError(message);
        console.error('❌ [LanguageProvider] Set language failed:', err);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const resetToAuto = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      await i18n.resetToAuto();
      setCurrentLanguage(i18n.getLanguage());
      setIsManuallySet(false);

      console.log('✅ [LanguageProvider] Reset to auto, detected:', i18n.getLanguage());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset language';
      setError(message);
      console.error('❌ [LanguageProvider] Reset to auto failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ========================================
  // Location
  // ========================================

  const detectFromLocation = useCallback(async (): Promise<void> => {
    try {
      const location = await locationService.getCurrentLocation();

      if (location) {
        setIsInBulgaria(location.isInBulgaria);

        // If not manually set, update language based on location
        if (!isManuallySet) {
          const newLanguage = location.isInBulgaria ? 'bg' : 'en';
          await i18n.setLanguage(newLanguage);
          setCurrentLanguage(newLanguage);
          setIsManuallySet(false); // Keep it as auto-detected

          console.log('✅ [LanguageProvider] Language detected from location:', newLanguage);
        }
      }
    } catch (err) {
      console.error('❌ [LanguageProvider] Location detection failed:', err);
    }
  }, [isManuallySet]);

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await locationService.requestPermission();
      setLocationPermissionGranted(result.granted);

      if (result.granted) {
        // Detect language from location
        await detectFromLocation();
      }

      return result.granted;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to request permission';
      setError(message);
      console.error('❌ [LanguageProvider] Permission request failed:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [detectFromLocation]);

  // ========================================
  // Context Value
  // ========================================

  const contextValue: LanguageContextValue = {
    // State
    currentLanguage,
    isManuallySet,
    isLoading,
    error,
    isInBulgaria,
    locationPermissionGranted,

    // Actions
    t,
    setLanguage,
    resetToAuto,
    requestLocationPermission,
    detectFromLocation,
  };

  // Debug logging
  useEffect(() => {
    console.log('LanguageProvider: Current language:', currentLanguage);
  }, [currentLanguage]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

// =============================================================================
// Hook to Access Language Context
// =============================================================================

export function useAppLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);

  if (context === undefined) {
    throw new Error('useAppLanguage must be used within LanguageProvider');
  }

  return context;
}
