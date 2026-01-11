// Theme Context
// Provides theme state and controls to entire app

import React, { createContext, useContext, ReactNode } from 'react';
import { PaperProvider } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { useTheme as useThemeHook } from '../hooks/useTheme';
import type { ThemeMode } from '../features/settings/types';

// =============================================================================
// Context Types
// =============================================================================

interface ThemeContextValue {
  theme: MD3Theme;
  themeMode: ThemeMode;
  isLoading: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

// =============================================================================
// Context Creation
// =============================================================================

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// =============================================================================
// Provider Component
// =============================================================================

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps): React.JSX.Element {
  const themeState = useThemeHook();

  // Debug logging
  React.useEffect(() => {
    console.log('ThemeProvider: Current theme mode:', themeState.themeMode);
  }, [themeState.themeMode]);

  return (
    <ThemeContext.Provider value={themeState}>
      <PaperProvider theme={themeState.theme}>
        {children}
      </PaperProvider>
    </ThemeContext.Provider>
  );
}

// =============================================================================
// Hook to Access Theme Context
// =============================================================================

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useAppTheme must be used within ThemeProvider');
  }

  return context;
}
