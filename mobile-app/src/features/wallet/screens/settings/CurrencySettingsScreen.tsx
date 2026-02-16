// Currency Settings Screen
// Configure display currency preference with split settings

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, RadioButton, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettings } from '../../../../hooks/useSettings';
import { useLanguage } from '../../../../hooks/useLanguage';
import { useAppTheme } from '../../../../contexts/ThemeContext';
import { getGradientColors, getPrimaryTextColor, getSecondaryTextColor, BRAND_COLOR } from '../../../../utils/theme-helpers';
import type { PrimaryDenomination, FiatCurrency } from '../../../settings/types';

// =============================================================================
// Denomination Options
// =============================================================================

interface DenominationOption {
  code: PrimaryDenomination;
  nameKey: string;
  symbol: string;
  descriptionKey: string;
}

const DENOMINATION_OPTIONS: DenominationOption[] = [
  {
    code: 'sats',
    nameKey: 'settings.satoshis',
    symbol: 'sats',
    descriptionKey: 'settings.smallestBitcoinUnit'
  },
  {
    code: 'btc',
    nameKey: 'settings.bitcoin',
    symbol: 'BTC',
    descriptionKey: 'settings.fullBitcoinDenomination'
  },
];

// =============================================================================
// Fiat Currency Options
// =============================================================================

interface FiatOption {
  code: FiatCurrency;
  nameKey: string;
  symbol: string;
  descriptionKey: string;
}

const FIAT_OPTIONS: FiatOption[] = [
  {
    code: 'usd',
    nameKey: 'settings.usDollar',
    symbol: '$',
    descriptionKey: 'settings.unitedStatesDollar'
  },
  {
    code: 'eur',
    nameKey: 'settings.euro',
    symbol: '€',
    descriptionKey: 'settings.europeanUnionCurrency'
  },
];

// =============================================================================
// Component
// =============================================================================

export function CurrencySettingsScreen(): React.JSX.Element {
  const { settings, updateSettings } = useSettings();
  const { t } = useLanguage();
  const { themeMode } = useAppTheme();

  const gradientColors = getGradientColors(themeMode);
  const primaryText = getPrimaryTextColor(themeMode);
  const secondaryText = getSecondaryTextColor(themeMode);

  // State - separate for each setting
  const [primaryDenomination, setPrimaryDenomination] = useState<PrimaryDenomination>('sats');
  const [secondaryFiatCurrency, setSecondaryFiatCurrency] = useState<FiatCurrency>('usd');

  // Load current settings
  useEffect(() => {
    if (settings) {
      // Handle new split settings
      if (settings.primaryDenomination) {
        setPrimaryDenomination(settings.primaryDenomination);
      } else if (settings.currency) {
        // Backwards compatibility: derive from old currency setting
        setPrimaryDenomination(settings.currency === 'btc' ? 'btc' : 'sats');
      }

      if (settings.secondaryFiatCurrency) {
        setSecondaryFiatCurrency(settings.secondaryFiatCurrency);
      } else if (settings.currency) {
        // Backwards compatibility: derive from old currency setting
        setSecondaryFiatCurrency(settings.currency === 'eur' ? 'eur' : 'usd');
      }
    }
  }, [settings]);

  // Handle primary denomination change - save immediately
  const handlePrimaryDenominationChange = async (value: string): Promise<void> => {
    const newValue = value as PrimaryDenomination;
    setPrimaryDenomination(newValue);

    try {
      await updateSettings({
        primaryDenomination: newValue,
        // Also update legacy field for backwards compatibility
        currency: newValue,
      });
    } catch (error) {
      console.error('❌ [CurrencySettings] Failed to save primaryDenomination:', error);
    }
  };

  // Handle fiat currency change - save immediately
  const handleFiatCurrencyChange = async (value: string): Promise<void> => {
    const newValue = value as FiatCurrency;
    setSecondaryFiatCurrency(newValue);

    try {
      await updateSettings({
        secondaryFiatCurrency: newValue,
      });
    } catch (error) {
      console.error('❌ [CurrencySettings] Failed to save secondaryFiatCurrency:', error);
    }
  };

  return (
    <LinearGradient
      colors={gradientColors}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            iconColor={primaryText}
            size={24}
            onPress={() => router.back()}
          />
          <Text style={[styles.headerTitle, { color: primaryText }]}>
            {t('settings.displayCurrency')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            {/* Primary Denomination Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: primaryText }]}>
                {t('settings.bitcoinDenomination')}
              </Text>
              <Text style={[styles.sectionDescription, { color: secondaryText }]}>
                {t('settings.chooseBitcoinDisplay')}
              </Text>

              <RadioButton.Group
                onValueChange={handlePrimaryDenominationChange}
                value={primaryDenomination}
              >
                {DENOMINATION_OPTIONS.map((option) => (
                  <View key={option.code} style={styles.radioItem}>
                    <RadioButton.Android
                      value={option.code}
                      color={BRAND_COLOR}
                      uncheckedColor={secondaryText}
                    />
                    <View style={styles.radioContent}>
                      <View style={styles.radioTitleRow}>
                        <Text style={[styles.radioTitle, { color: primaryText }]}>
                          {t(option.nameKey)}
                        </Text>
                        <Text style={[styles.currencySymbol, { color: secondaryText }]}>
                          {option.symbol}
                        </Text>
                      </View>
                      <Text style={[styles.radioDescription, { color: secondaryText }]}>
                        {t(option.descriptionKey)}
                      </Text>
                    </View>
                  </View>
                ))}
              </RadioButton.Group>
            </View>

            {/* Secondary Fiat Currency Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: primaryText }]}>
                {t('settings.fiatConversion')}
              </Text>
              <Text style={[styles.sectionDescription, { color: secondaryText }]}>
                {t('settings.chooseFiatSecondary')}
              </Text>

              <RadioButton.Group
                onValueChange={handleFiatCurrencyChange}
                value={secondaryFiatCurrency}
              >
                {FIAT_OPTIONS.map((option) => (
                  <View key={option.code} style={styles.radioItem}>
                    <RadioButton.Android
                      value={option.code}
                      color={BRAND_COLOR}
                      uncheckedColor={secondaryText}
                    />
                    <View style={styles.radioContent}>
                      <View style={styles.radioTitleRow}>
                        <Text style={[styles.radioTitle, { color: primaryText }]}>
                          {t(option.nameKey)}
                        </Text>
                        <Text style={[styles.currencySymbol, { color: secondaryText }]}>
                          {option.symbol}
                        </Text>
                      </View>
                      <Text style={[styles.radioDescription, { color: secondaryText }]}>
                        {t(option.descriptionKey)}
                      </Text>
                    </View>
                  </View>
                ))}
              </RadioButton.Group>
            </View>

            {/* Preview Box */}
            <View style={styles.previewBox}>
              <Text style={styles.previewTitle}>{t('settings.preview')}</Text>
              <Text style={[styles.previewText, { color: secondaryText }]}>
                {t('settings.balanceDisplayPreview')}
              </Text>
              <View style={styles.previewExample}>
                <Text style={[styles.previewPrimary, { color: primaryText }]}>
                  {primaryDenomination === 'btc' ? '₿ 0.00035529' : `35,529 ${t('wallet.sats')}`}
                </Text>
                <Text style={[styles.previewSecondary, { color: secondaryText }]}>
                  {t('settings.approximate')} {secondaryFiatCurrency === 'eur' ? '€14' : '$16'}
                </Text>
              </View>
            </View>

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>{t('settings.aboutDisplayCurrency')}</Text>
              <Text style={[styles.infoText, { color: secondaryText }]}> 
                {t('settings.displayCurrencyInfoPrimary')}
              </Text>
              <Text style={[styles.infoText, { color: secondaryText, marginTop: 8 }]}> 
                {t('settings.displayCurrencyInfoSecondary')}
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 48,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    marginBottom: 16,
    opacity: 0.7,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  radioContent: {
    flex: 1,
    marginLeft: 8,
  },
  radioTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  radioTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  currencySymbol: {
    fontSize: 14,
    fontWeight: '500',
  },
  radioDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  previewBox: {
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND_COLOR,
    marginBottom: 8,
  },
  previewText: {
    fontSize: 13,
    marginBottom: 12,
  },
  previewExample: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  previewPrimary: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  previewSecondary: {
    fontSize: 14,
    marginTop: 4,
  },
  infoBox: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: BRAND_COLOR,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND_COLOR,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
  },
});
