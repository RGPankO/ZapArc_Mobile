// Settings feature type definitions
// Adapted from zap-arc browser extension for React Native

// =============================================================================
// User Settings Types
// =============================================================================

/**
 * User settings and preferences
 */
export interface UserSettings {
  // Language and Localization
  language: 'en' | 'bg' | 'auto'; // 'auto' = detect from location
  isLocationBased: boolean;
  
  // Currency Display Settings
  currency: CurrencyCode; // @deprecated - kept for backwards compatibility, use primaryDenomination
  primaryDenomination: PrimaryDenomination; // How to display Bitcoin amounts (sats or btc)
  secondaryFiatCurrency: FiatCurrency; // Which fiat currency to show as secondary (usd or eur)

  // Wallet Configuration
  useBuiltInWallet: boolean; // true = Breez SDK, false = custom LNURL
  customLNURL?: string; // Custom LNURL-pay address (when useBuiltInWallet is false)
  customLightningAddress?: string; // Alternative Lightning address format

  // Tip Configuration
  defaultPostingAmounts: [number, number, number]; // Amounts for tip requests when posting
  defaultTippingAmounts: [number, number, number]; // Amounts when tipping others

  // App Behavior
  theme: ThemeMode; // Light or dark theme
  biometricEnabled: boolean;
  autoLockTimeout: AutoLockTimeout; // In seconds
  notificationsEnabled: boolean;
  notifyPaymentReceived: boolean; // Notify on incoming payments
  notifyPaymentSent: boolean; // Notify on outgoing payments

  // Social Platform Settings
  preferredSharingPlatforms: SocialPlatform[];
}

/**
 * Supported currency codes for display (legacy, kept for backwards compatibility)
 */
export type CurrencyCode = 'sats' | 'btc' | 'usd' | 'eur';

/**
 * Primary denomination for Bitcoin display
 */
export type PrimaryDenomination = 'sats' | 'btc';

/**
 * Fiat currency for secondary conversion display
 */
export type FiatCurrency = 'usd' | 'eur';

/**
 * Theme mode options
 */
export type ThemeMode = 'light' | 'dark';

/**
 * Auto-lock timeout options (in seconds)
 * 0 = Never (with security warning)
 */
export type AutoLockTimeout = 300 | 900 | 1800 | 3600 | 7200 | 0;

/**
 * Supported social platforms for sharing
 */
export type SocialPlatform =
  | 'twitter'
  | 'instagram'
  | 'telegram'
  | 'whatsapp'
  | 'facebook';

// =============================================================================
// Domain Settings Types
// =============================================================================

/**
 * Domain status for tip request handling
 */
export enum DomainStatus {
  UNMANAGED = 'unmanaged',
  WHITELISTED = 'whitelisted',
  DISABLED = 'disabled',
}

/**
 * Domain settings map
 */
export interface DomainSettings {
  [domain: string]: DomainStatus;
}

// =============================================================================
// Blacklist Types
// =============================================================================

/**
 * Blacklist data for blocked LNURLs and Lightning addresses
 */
export interface BlacklistData {
  lnurls: string[];
  lightningAddresses: string[];
  lastUpdated: number;
}

// =============================================================================
// Language Types
// =============================================================================

/**
 * Available language option
 */
export interface LanguageOption {
  code: 'en' | 'bg';
  name: string;
  nativeName: string;
  flag: string;
}

/**
 * Location data for language detection
 */
export interface LocationData {
  latitude: number;
  longitude: number;
  country: string;
  countryCode: string;
}

// =============================================================================
// Default Values
// =============================================================================

export const DEFAULT_USER_SETTINGS: UserSettings = {
  language: 'en',
  isLocationBased: true,
  currency: 'sats', // Legacy field, kept for backwards compatibility
  primaryDenomination: 'sats', // Default to satoshis
  secondaryFiatCurrency: 'usd', // Default to USD for fiat conversion
  useBuiltInWallet: true,
  defaultPostingAmounts: [100, 500, 1000],
  defaultTippingAmounts: [100, 500, 1000],
  theme: 'dark', // Default to dark theme to match current app style
  biometricEnabled: false,
  autoLockTimeout: 900, // 15 minutes
  notificationsEnabled: true,
  notifyPaymentReceived: true,
  notifyPaymentSent: true,
  preferredSharingPlatforms: ['twitter', 'telegram'],
};

export const AVAILABLE_LANGUAGES: LanguageOption[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
  },
  {
    code: 'bg',
    name: 'Bulgarian',
    nativeName: 'Български',
    flag: '🇧🇬',
  },
];

export const AUTO_LOCK_OPTIONS: { value: AutoLockTimeout; label: string }[] = [
  { value: 300, label: '5 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
  { value: 7200, label: '2 hours' },
  { value: 0, label: 'Never' },
];

// =============================================================================
// Validation Constants
// =============================================================================

export const SETTINGS_VALIDATION = {
  MAX_AMOUNT_SATS: 100_000_000, // 1 BTC
  MIN_AMOUNT_SATS: 1,
} as const;
