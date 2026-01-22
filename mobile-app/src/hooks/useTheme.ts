// useTheme Hook
// Manages app-wide theme switching with persistence

import { useState, useEffect, useCallback, useMemo } from 'react';
import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { settingsService } from '../services';
import type { ThemeMode } from '../features/settings/types';
import { BRAND_COLOR } from '../utils/theme-helpers';

// =============================================================================
// Theme Definitions
// =============================================================================

// Factory functions to create fresh theme objects
const createLightTheme = (): MD3Theme => ({
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: BRAND_COLOR, // Gold accent
    // Use transparent for outlined input label backgrounds
    // The actual screen background is handled by LinearGradient
    background: 'transparent',
    surface: '#ffffff',
    surfaceVariant: '#f5f5f5',
    onSurfaceVariant: 'rgba(0, 0, 0, 0.6)', // Label text color for light mode
  },
  roundness: 8,
});

const createDarkTheme = (): MD3Theme => ({
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: BRAND_COLOR, // Gold accent
    // Use transparent for outlined input label backgrounds
    // The actual screen background is handled by LinearGradient
    background: 'transparent',
    surface: '#1a1a2e',
    surfaceVariant: 'rgba(255, 255, 255, 0.05)',
    onSurfaceVariant: 'rgba(255, 255, 255, 0.6)', // Label text color for dark mode
  },
  roundness: 8,
});

// =============================================================================
// Types
// =============================================================================

export interface ThemeState {
  theme: MD3Theme;
  themeMode: ThemeMode;
  isLoading: boolean;
}

export interface ThemeActions {
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

export type UseThemeReturn = ThemeState & ThemeActions;

// =============================================================================
// Hook Implementation
// =============================================================================

export function useTheme(): UseThemeReturn {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from settings on mount
  useEffect(() => {
    const loadTheme = async (): Promise<void> => {
      try {
        const settings = await settingsService.getUserSettings();
        console.log('Loaded theme from settings:', settings.theme);
        setThemeModeState(settings.theme);
      } catch (error) {
        console.error('Failed to load theme:', error);
        setThemeModeState('dark'); // Fallback to dark
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode): Promise<void> => {
    try {
      console.log('Setting theme mode to:', mode);
      setThemeModeState(mode);
      const settings = await settingsService.getUserSettings();
      await settingsService.saveUserSettings({ ...settings, theme: mode });
      console.log('Theme saved successfully');
    } catch (error) {
      console.error('Failed to save theme:', error);
      throw error;
    }
  }, []);

  const toggleTheme = useCallback(async (): Promise<void> => {
    // Use functional update to get the latest themeMode
    setThemeModeState((currentMode) => {
      const newMode: ThemeMode = currentMode === 'dark' ? 'light' : 'dark';
      console.log('Toggling theme from', currentMode, 'to', newMode);

      // Save the new theme asynchronously
      (async () => {
        try {
          const settings = await settingsService.getUserSettings();
          await settingsService.saveUserSettings({ ...settings, theme: newMode });
          console.log('Theme toggled and saved successfully');
        } catch (error) {
          console.error('Failed to save toggled theme:', error);
        }
      })();

      return newMode;
    });
  }, []);

  // Memoize theme object to ensure it changes when themeMode changes
  const currentTheme = useMemo(() => {
    console.log('useMemo: Computing theme for mode:', themeMode);
    return themeMode === 'dark' ? createDarkTheme() : createLightTheme();
  }, [themeMode]);

  return {
    theme: currentTheme,
    themeMode,
    isLoading,
    setThemeMode,
    toggleTheme,
  };
}
