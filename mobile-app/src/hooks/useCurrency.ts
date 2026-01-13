// useCurrency Hook
// Provides currency formatting with automatic exchange rate updates

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSettings } from './useSettings';
import {
  getExchangeRates,
  getCachedRates,
  formatAmountWithSettings,
  formatTransactionAmountWithSettings,
} from '../utils/currency';
import type { PrimaryDenomination, FiatCurrency } from '../features/settings/types';
import type { ExchangeRates, FormattedAmount, CurrencySettings } from '../utils/currency';

// =============================================================================
// Types
// =============================================================================

interface UseCurrencyReturn {
  // Current currency settings
  primaryDenomination: PrimaryDenomination;
  secondaryFiatCurrency: FiatCurrency;
  currencySettings: CurrencySettings;

  // Exchange rates
  rates: ExchangeRates | null;
  isLoadingRates: boolean;

  // Formatting functions
  format: (sats: number, options?: { hideBalance?: boolean }) => FormattedAmount;
  formatTx: (sats: number, isReceived: boolean) => FormattedAmount;
  formatCompact: (sats: number) => string;

  // Refresh functions
  refreshRates: () => Promise<void>;
  refreshSettings: () => Promise<void>;
}

// =============================================================================
// Hook
// =============================================================================

export function useCurrency(): UseCurrencyReturn {
  const { settings, loadSettings } = useSettings();
  
  // Get the new split settings, with fallbacks for backwards compatibility
  const primaryDenomination: PrimaryDenomination = settings?.primaryDenomination || 
    (settings?.currency === 'btc' ? 'btc' : 'sats');
  const secondaryFiatCurrency: FiatCurrency = settings?.secondaryFiatCurrency || 
    (settings?.currency === 'eur' ? 'eur' : 'usd');

  // Memoize the currency settings object
  const currencySettings = useMemo<CurrencySettings>(() => ({
    primaryDenomination,
    secondaryFiatCurrency,
  }), [primaryDenomination, secondaryFiatCurrency]);

  const [rates, setRates] = useState<ExchangeRates | null>(getCachedRates());
  const [isLoadingRates, setIsLoadingRates] = useState(false);

  // Fetch rates on mount and periodically
  useEffect(() => {
    let mounted = true;

    const fetchRates = async (): Promise<void> => {
      setIsLoadingRates(true);
      try {
        const newRates = await getExchangeRates();
        if (mounted) {
          setRates(newRates);
        }
      } finally {
        if (mounted) {
          setIsLoadingRates(false);
        }
      }
    };

    // Initial fetch
    fetchRates();

    // Refresh every 5 minutes
    const interval = global.setInterval(fetchRates, 5 * 60 * 1000);

    return (): void => {
      mounted = false;
      global.clearInterval(interval);
    };
  }, []);

  // Manual refresh rates
  const refreshRates = useCallback(async (): Promise<void> => {
    setIsLoadingRates(true);
    try {
      const newRates = await getExchangeRates();
      setRates(newRates);
    } finally {
      setIsLoadingRates(false);
    }
  }, []);

  // Refresh settings from storage (call when returning to screen)
  const refreshSettings = useCallback(async (): Promise<void> => {
    await loadSettings();
  }, [loadSettings]);

  // Format amount with current currency settings
  const format = useCallback(
    (sats: number, options?: { hideBalance?: boolean }): FormattedAmount => {
      return formatAmountWithSettings(sats, currencySettings, rates, options);
    },
    [currencySettings, rates]
  );

  // Format transaction amount
  const formatTx = useCallback(
    (sats: number, isReceived: boolean): FormattedAmount => {
      return formatTransactionAmountWithSettings(sats, isReceived, currencySettings, rates);
    },
    [currencySettings, rates]
  );

  // Format compact (for tight spaces like transaction list)
  const formatCompact = useCallback(
    (sats: number): string => {
      const formatted = formatAmountWithSettings(sats, currencySettings, rates);
      return formatted.primary;
    },
    [currencySettings, rates]
  );

  return {
    primaryDenomination,
    secondaryFiatCurrency,
    currencySettings,
    rates,
    isLoadingRates,
    format,
    formatTx,
    formatCompact,
    refreshRates,
    refreshSettings,
  };
}
