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
    : ['#ffffff', '#ffffff', '#FAFAFA']; // Light gradient (very subtle to avoid keyboard resize shifts)
};

/**
 * Get input background color for outlined TextInputs
 * This should match the gradient background so the floating label
 * can properly mask the border line
 */
export const getInputBackgroundColor = (themeMode: ThemeMode): string => {
  // Use solid background to ensure label cutout works
  return themeMode === 'dark'
    ? '#16213e' 
    : '#FFFFFF'; // White for light mode to look clean
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
export const getIconColor = (_themeMode: ThemeMode): string => {
  return BRAND_COLOR; // User requested all icons to use brand color
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
 * Official Bitcoin Color: #F7931A
 */
export const BRAND_COLOR = '#F7931A';

/**
 * Status colors - consistent across themes
 */
export const STATUS_COLORS = {
  success: '#4CAF50',
  error: '#f44336',
  warning: '#FF9800',
  info: '#2196F3',
} as const;
