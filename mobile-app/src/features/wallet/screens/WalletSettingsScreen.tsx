// Wallet Settings Screen
// Main settings hub for wallet configuration

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, List, Divider, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettings } from '../../../hooks/useSettings';
import { useLanguage } from '../../../hooks/useLanguage';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { getGradientColors, getPrimaryTextColor, getSecondaryTextColor } from '../../../utils/theme-helpers';

// =============================================================================
// Component
// =============================================================================

export function WalletSettingsScreen(): React.JSX.Element {
  const { settings, isLoading: settingsLoading } = useSettings();
  const { currentLanguage, t } = useLanguage();
  const { themeMode } = useAppTheme();

  const gradientColors = getGradientColors(themeMode);
  const primaryTextColor = getPrimaryTextColor(themeMode);
  const secondaryTextColor = getSecondaryTextColor(themeMode);

  // Format currency display
  const getCurrencyDisplay = (): string => {
    if (!settings) return 'sats';
    const currency = settings.currency || 'sats';
    const map: Record<string, string> = {
      btc: 'BTC',
      sats: 'Satoshis',
      usd: 'USD',
      eur: 'EUR',
    };
    return map[currency] || currency;
  };

  // Format language display
  const getLanguageDisplay = (): string => {
    if (!settings) return t('settings.english');

    try {
      const lang = currentLanguage || 'en';
      const langName = lang === 'bg' ? t('settings.bulgarian') : t('settings.english');

      if (settings.language === 'auto') {
        return `${t('common.auto')} (${langName})`;
      }
      return langName;
    } catch (err) {
      console.error('❌ [WalletSettings] getLanguageDisplay error:', err);
      return t('settings.english');
    }
  };

  // Show loading state if settings not loaded yet
  if (settingsLoading || !settings) {
    return (
      <LinearGradient colors={gradientColors} style={styles.gradient}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <IconButton
              icon="arrow-left"
              iconColor={primaryTextColor}
              size={24}
              onPress={() => router.back()}
            />
            <Text style={[styles.headerTitle, { color: primaryTextColor }]}>{t('settings.title')}</Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

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
            iconColor={primaryTextColor}
            size={24}
            onPress={() => router.back()}
          />
          <Text style={[styles.headerTitle, { color: primaryTextColor }]}>{t('settings.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView}>
          {/* App Settings - MOVED TO TOP */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: secondaryTextColor }]}>{t('settings.appSettings')}</Text>

            <List.Item
              title={t('settings.language')}
              description={getLanguageDisplay()}
              left={(props) => (
                <List.Icon {...props} icon="translate" color="#FFC107" />
              )}
              right={(props) => (
                <List.Icon {...props} icon="chevron-right" color={secondaryTextColor} />
              )}
              onPress={() => router.push('/wallet/settings/language')}
              titleStyle={[styles.listTitle, { color: primaryTextColor }]}
              descriptionStyle={[styles.listDescription, { color: secondaryTextColor }]}
              style={styles.listItem}
            />

            <Divider style={styles.divider} />

            <List.Item
              title={t('settings.theme')}
              description={t('settings.darkModeSettings')}
              left={(props) => (
                <List.Icon {...props} icon="theme-light-dark" color="#FFC107" />
              )}
              right={(props) => (
                <List.Icon {...props} icon="chevron-right" color={secondaryTextColor} />
              )}
              onPress={() => router.push('/wallet/settings/theme')}
              titleStyle={[styles.listTitle, { color: primaryTextColor }]}
              descriptionStyle={[styles.listDescription, { color: secondaryTextColor }]}
              style={styles.listItem}
            />

            <Divider style={styles.divider} />

            <List.Item
              title={t('settings.notifications')}
              description={t('settings.manageNotifications')}
              left={(props) => (
                <List.Icon {...props} icon="bell" color="#FFC107" />
              )}
              right={(props) => (
                <List.Icon {...props} icon="chevron-right" color={secondaryTextColor} />
              )}
              onPress={() => router.push('/wallet/settings/notifications')}
              titleStyle={[styles.listTitle, { color: primaryTextColor }]}
              descriptionStyle={[styles.listDescription, { color: secondaryTextColor }]}
              style={styles.listItem}
            />
          </View>

          {/* Wallet Configuration */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: secondaryTextColor }]}>{t('settings.walletConfiguration')}</Text>

            <List.Item
              title={t('settings.walletType')}
              description={
                settings?.useBuiltInWallet
                  ? t('settings.builtInWallet')
                  : t('settings.customLnurl')
              }
              left={(props) => (
                <List.Icon {...props} icon="wallet" color="#FFC107" />
              )}
              right={(props) => (
                <List.Icon {...props} icon="chevron-right" color={secondaryTextColor} />
              )}
              onPress={() => router.push('/wallet/settings/wallet-config')}
              titleStyle={[styles.listTitle, { color: primaryTextColor }]}
              descriptionStyle={[styles.listDescription, { color: secondaryTextColor }]}
              style={styles.listItem}
            />

            <Divider style={styles.divider} />

            <List.Item
              title="Lightning Address"
              description="Receive payments with a simple address"
              left={(props) => (
                <List.Icon {...props} icon="at" color="#FFC107" />
              )}
              right={(props) => (
                <List.Icon {...props} icon="chevron-right" color={secondaryTextColor} />
              )}
              onPress={() => router.push('/wallet/settings/lightning-address')}
              titleStyle={[styles.listTitle, { color: primaryTextColor }]}
              descriptionStyle={[styles.listDescription, { color: secondaryTextColor }]}
              style={styles.listItem}
            />

            <Divider style={styles.divider} />

            <List.Item
              title="Address Book"
              description="Manage saved Lightning Addresses"
              left={(props) => (
                <List.Icon {...props} icon="contacts" color="#FFC107" />
              )}
              right={(props) => (
                <List.Icon {...props} icon="chevron-right" color={secondaryTextColor} />
              )}
              onPress={() => router.push('/wallet/settings/address-book')}
              titleStyle={[styles.listTitle, { color: primaryTextColor }]}
              descriptionStyle={[styles.listDescription, { color: secondaryTextColor }]}
              style={styles.listItem}
            />

            <Divider style={styles.divider} />

            <List.Item
              title={t('settings.defaultTipAmounts')}
              description={`${settings?.defaultPostingAmounts?.join(', ') || '100, 500, 1000'} ${t('wallet.sats')}`}
              left={(props) => (
                <List.Icon {...props} icon="currency-btc" color="#FFC107" />
              )}
              right={(props) => (
                <List.Icon {...props} icon="chevron-right" color={secondaryTextColor} />
              )}
              onPress={() => router.push('/wallet/settings/amounts')}
              titleStyle={[styles.listTitle, { color: primaryTextColor }]}
              descriptionStyle={[styles.listDescription, { color: secondaryTextColor }]}
              style={styles.listItem}
            />

            <Divider style={styles.divider} />

            <List.Item
              title={t('settings.displayCurrency')}
              description={getCurrencyDisplay()}
              left={(props) => (
                <List.Icon {...props} icon="cash" color="#FFC107" />
              )}
              right={(props) => (
                <List.Icon {...props} icon="chevron-right" color={secondaryTextColor} />
              )}
              onPress={() => router.push('/wallet/settings/currency')}
              titleStyle={[styles.listTitle, { color: primaryTextColor }]}
              descriptionStyle={[styles.listDescription, { color: secondaryTextColor }]}
              style={styles.listItem}
            />
            <Divider style={styles.divider} />

            <List.Item
              title={t('wallet.archivedWallets')}
              description={t('wallet.viewArchivedWallets')}
              left={(props) => (
                <List.Icon {...props} icon="archive" color="#FFC107" />
              )}
              right={(props) => (
                <List.Icon {...props} icon="chevron-right" color={secondaryTextColor} />
              )}
              onPress={() => router.push('/wallet/archived')}
              titleStyle={[styles.listTitle, { color: primaryTextColor }]}
              descriptionStyle={[styles.listDescription, { color: secondaryTextColor }]}
              style={styles.listItem}
            />
          </View>

          {/* Security - Removed Auto-Lock */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: secondaryTextColor }]}>{t('settings.security')}</Text>

            <List.Item
              title={t('settings.biometric')}
              description={
                settings?.biometricEnabled ? t('common.enabled') : t('common.disabled')
              }
              left={(props) => (
                <List.Icon {...props} icon="fingerprint" color="#FFC107" />
              )}
              right={(props) => (
                <List.Icon {...props} icon="chevron-right" color={secondaryTextColor} />
              )}
              onPress={() => router.push('/wallet/settings/security')}
              titleStyle={[styles.listTitle, { color: primaryTextColor }]}
              descriptionStyle={[styles.listDescription, { color: secondaryTextColor }]}
              style={styles.listItem}
            />
          </View>


          {/* About */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: secondaryTextColor }]}>{t('settings.about')}</Text>

            <List.Item
              title={t('settings.version')}
              description="1.0.0"
              left={(props) => (
                <List.Icon {...props} icon="information" color="#FFC107" />
              )}
              titleStyle={[styles.listTitle, { color: primaryTextColor }]}
              descriptionStyle={[styles.listDescription, { color: secondaryTextColor }]}
              style={styles.listItem}
            />
          </View>

          <View style={styles.bottomSpacer} />
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
  section: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listItem: {
    backgroundColor: 'transparent',
  },
  listTitle: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  listDescription: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
  },
  divider: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginLeft: 56,
  },
  bottomSpacer: {
    height: 32,
  },
});
