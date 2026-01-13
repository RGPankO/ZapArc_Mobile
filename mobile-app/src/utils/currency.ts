// Currency Conversion Utilities
// Handles sat to fiat conversion with exchange rate caching

import type { CurrencyCode, PrimaryDenomination, FiatCurrency } from '../features/settings/types';

// =============================================================================
// Types
// =============================================================================

export interface ExchangeRates {
  usd: number;
  eur: number;
  timestamp: number;
}

export interface FormattedAmount {
  primary: string;
  secondary: string | null;
  secondaryCompact: string | null;
}

export interface CurrencySettings {
  primaryDenomination: PrimaryDenomination;
  secondaryFiatCurrency: FiatCurrency;
}

// =============================================================================
// Constants
// =============================================================================

const SATS_PER_BTC = 100_000_000;
const RATE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,eur';

// =============================================================================
// State
// =============================================================================

let cachedRates: ExchangeRates | null = null;
let fetchPromise: Promise<ExchangeRates> | null = null;

// =============================================================================
// Exchange Rate Fetching
// =============================================================================

/**
 * Fetch current BTC exchange rates from CoinGecko
 */
async function fetchExchangeRates(): Promise<ExchangeRates> {
  try {
    const response = await fetch(COINGECKO_API);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const rates: ExchangeRates = {
      usd: data.bitcoin?.usd || 0,
      eur: data.bitcoin?.eur || 0,
      timestamp: Date.now(),
    };

    cachedRates = rates;
    console.log('\uD83D\uDCB1 [Currency] Rates fetched:', { usd: rates.usd, eur: rates.eur });
    return rates;
  } catch (error) {
    console.error('\u274C [Currency] Failed to fetch rates:', error);
    // Return cached rates if available, otherwise return zeros
    if (cachedRates) {
      return cachedRates;
    }
    return { usd: 0, eur: 0, timestamp: 0 };
  }
}

/**
 * Get exchange rates (cached or fresh)
 */
export async function getExchangeRates(): Promise<ExchangeRates> {
  // Return cached rates if still valid
  if (cachedRates && Date.now() - cachedRates.timestamp < RATE_CACHE_DURATION) {
    return cachedRates;
  }

  // Deduplicate concurrent requests
  if (!fetchPromise) {
    fetchPromise = fetchExchangeRates().finally(() => {
      fetchPromise = null;
    });
  }

  return fetchPromise;
}

/**
 * Get cached rates synchronously (for immediate display)
 */
export function getCachedRates(): ExchangeRates | null {
  return cachedRates;
}

// =============================================================================
// Conversion Functions
// =============================================================================

/**
 * Convert satoshis to BTC
 */
export function satsToBtc(sats: number): number {
  return sats / SATS_PER_BTC;
}

/**
 * Convert satoshis to fiat
 */
export function satsToFiat(sats: number, rates: ExchangeRates, currency: 'usd' | 'eur'): number {
  const btc = satsToBtc(sats);
  return btc * rates[currency];
}

// =============================================================================
// Formatting Functions
// =============================================================================

/**
 * Format satoshis with locale formatting
 */
export function formatSats(sats: number): string {
  return sats.toLocaleString();
}

/**
 * Format BTC amount
 */
export function formatBtc(btc: number): string {
  return btc.toFixed(8);
}

/**
 * Format fiat amount
 */
export function formatFiat(amount: number, currency: 'usd' | 'eur'): string {
  const symbol = currency === 'usd' ? '$' : '\u20AC';

  if (amount >= 1000) {
    return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  } else if (amount >= 1) {
    return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else {
    return `${symbol}${amount.toFixed(2)}`;
  }
}

/**
 * Format fiat with compact notation for tight spaces
 */
export function formatFiatCompact(amount: number, currency: 'usd' | 'eur'): string {
  const symbol = currency === 'usd' ? '$' : '\u20AC';

  if (amount >= 1) {
    return `~${symbol}${Math.round(amount).toLocaleString()}`;
  } else {
    return `~${symbol}${amount.toFixed(2)}`;
  }
}

// =============================================================================
// Main Formatting API
// =============================================================================

/**
 * Format an amount based on user's currency preference
 * Returns primary display (main amount) and secondary display (converted amount)
 */
export function formatAmount(
  sats: number,
  currency: CurrencyCode,
  rates: ExchangeRates | null,
  options?: { hideBalance?: boolean }
): FormattedAmount {
  const { hideBalance = false } = options || {};

  if (hideBalance) {
    return {
      primary: '\u2022\u2022\u2022\u2022\u2022\u2022',
      secondary: null,
      secondaryCompact: null,
    };
  }

  const safeSats = typeof sats === 'number' && !isNaN(sats) ? sats : 0;

  switch (currency) {
    case 'btc': {
      const btc = satsToBtc(safeSats);
      const secondary = rates && rates.usd > 0
        ? `about ${formatFiat(satsToFiat(safeSats, rates, 'usd'), 'usd')}`
        : null;
      const secondaryCompact = rates && rates.usd > 0
        ? formatFiatCompact(satsToFiat(safeSats, rates, 'usd'), 'usd')
        : null;
      return {
        primary: `\u20BF ${formatBtc(btc)}`,
        secondary,
        secondaryCompact,
      };
    }

    case 'usd': {
      if (!rates || rates.usd === 0) {
        return {
          primary: `${formatSats(safeSats)} sats`,
          secondary: 'Loading rates...',
          secondaryCompact: null,
        };
      }
      const usdAmount = satsToFiat(safeSats, rates, 'usd');
      return {
        primary: formatFiat(usdAmount, 'usd'),
        secondary: `${formatSats(safeSats)} sats`,
        secondaryCompact: `${formatSats(safeSats)} sats`,
      };
    }

    case 'eur': {
      if (!rates || rates.eur === 0) {
        return {
          primary: `${formatSats(safeSats)} sats`,
          secondary: 'Loading rates...',
          secondaryCompact: null,
        };
      }
      const eurAmount = satsToFiat(safeSats, rates, 'eur');
      return {
        primary: formatFiat(eurAmount, 'eur'),
        secondary: `${formatSats(safeSats)} sats`,
        secondaryCompact: `${formatSats(safeSats)} sats`,
      };
    }

    case 'sats':
    default: {
      const secondary = rates && rates.usd > 0
        ? `about ${formatFiat(satsToFiat(safeSats, rates, 'usd'), 'usd')}`
        : null;
      const secondaryCompact = rates && rates.usd > 0
        ? formatFiatCompact(satsToFiat(safeSats, rates, 'usd'), 'usd')
        : null;
      return {
        primary: `${formatSats(safeSats)} sats`,
        secondary,
        secondaryCompact,
      };
    }
  }
}

/**
 * Format transaction amount with +/- prefix
 * @deprecated Use formatTransactionAmountWithSettings for new code
 */
export function formatTransactionAmount(
  sats: number,
  isReceived: boolean,
  currency: CurrencyCode,
  rates: ExchangeRates | null,
  _options?: { compact?: boolean }
): FormattedAmount {
  const formatted = formatAmount(sats, currency, rates);
  const prefix = isReceived ? '+' : '-';

  return {
    primary: `${prefix}${formatted.primary}`,
    secondary: formatted.secondary,
    secondaryCompact: formatted.secondaryCompact,
  };
}

// =============================================================================
// New API with Split Settings
// =============================================================================

/**
 * Format an amount using the new split currency settings
 * - primaryDenomination controls how Bitcoin amounts are displayed (sats or btc)
 * - secondaryFiatCurrency controls which fiat is used for conversion display
 */
export function formatAmountWithSettings(
  sats: number,
  settings: CurrencySettings,
  rates: ExchangeRates | null,
  options?: { hideBalance?: boolean }
): FormattedAmount {
  const { hideBalance = false } = options || {};
  const { primaryDenomination, secondaryFiatCurrency } = settings;

  if (hideBalance) {
    return {
      primary: '••••••',
      secondary: null,
      secondaryCompact: null,
    };
  }

  const safeSats = typeof sats === 'number' && !isNaN(sats) ? sats : 0;

  // Format primary display based on denomination
  let primary: string;
  if (primaryDenomination === 'btc') {
    const btc = satsToBtc(safeSats);
    primary = `₿ ${formatBtc(btc)}`;
  } else {
    // Default to sats
    primary = `${formatSats(safeSats)} sats`;
  }

  // Format secondary display using the selected fiat currency
  let secondary: string | null = null;
  let secondaryCompact: string | null = null;

  if (rates && rates[secondaryFiatCurrency] > 0) {
    const fiatAmount = satsToFiat(safeSats, rates, secondaryFiatCurrency);
    secondary = `about ${formatFiat(fiatAmount, secondaryFiatCurrency)}`;
    secondaryCompact = formatFiatCompact(fiatAmount, secondaryFiatCurrency);
  }

  return {
    primary,
    secondary,
    secondaryCompact,
  };
}

/**
 * Format transaction amount with +/- prefix using split settings
 */
export function formatTransactionAmountWithSettings(
  sats: number,
  isReceived: boolean,
  settings: CurrencySettings,
  rates: ExchangeRates | null
): FormattedAmount {
  const formatted = formatAmountWithSettings(sats, settings, rates);
  const prefix = isReceived ? '+' : '-';

  return {
    primary: `${prefix}${formatted.primary}`,
    secondary: formatted.secondary,
    secondaryCompact: formatted.secondaryCompact,
  };
}
