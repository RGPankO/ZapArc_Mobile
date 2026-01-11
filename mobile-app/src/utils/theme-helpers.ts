// Theme Helper Utilities
// Provides consistent theme-based styling across the app

import type { ThemeMode } from '../features/settings/types';

/**
 * Get gradient colors based on theme mode
 * Used for LinearGradient backgrounds throughout the app
 */
export const getGradientColors = (themeMode: ThemeMode): [string, string, string] => {
  return themeMode === 'dark'
    ? ['#1a1a2e', '#16213e', '#0f3460'] // Dark gradient
    : ['#f5f5f5', '#e8e8e8', '#d0d0d0']; // Light gradient
};

/**
 * Get semi-transparent background color for cards/items
 */
export const getCardBackgroundColor = (themeMode: ThemeMode): string => {
  return themeMode === 'dark'
    ? 'rgba(255, 255, 255, 0.05)' // Light overlay on dark
    : 'rgba(0, 0, 0, 0.03)';        // Dark overlay on light
};

/**
 * Get icon color based on theme (for non-branded icons)
 */
export const getIconColor = (themeMode: ThemeMode): string => {
  return themeMode === 'dark'
    ? 'rgba(255, 255, 255, 0.6)' // Light icons on dark
    : 'rgba(0, 0, 0, 0.6)';        // Dark icons on light
};

/**
 * Get primary text color based on theme
 */
export const getPrimaryTextColor = (themeMode: ThemeMode): string => {
  return themeMode === 'dark'
    ? '#FFFFFF' // White text on dark
    : '#000000'; // Black text on light
};

/**
 * Get secondary text color based on theme
 */
export const getSecondaryTextColor = (themeMode: ThemeMode): string => {
  return themeMode === 'dark'
    ? 'rgba(255, 255, 255, 0.6)' // Dimmed white on dark
    : 'rgba(0, 0, 0, 0.6)';        // Dimmed black on light
};

/**
 * Brand color (gold) - consistent across themes
 */
export const BRAND_COLOR = '#FFC107';

/**
 * Status colors - consistent across themes
 */
export const STATUS_COLORS = {
  success: '#4CAF50',
  error: '#f44336',
  warning: '#FF9800',
  info: '#2196F3',
} as const;
