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
import { getGradientColors, BRAND_COLOR, getPrimaryTextColor, getSecondaryTextColor } from '../../../utils/theme-helpers';

// =============================================================================
// Component
// =============================================================================

export function WalletSettingsScreen(): React.JSX.Element {
  const { settings } = useSettings();
  const { t, language } = useLanguage();
  const { themeMode, theme } = useAppTheme();

  const gradientColors = getGradientColors(themeMode);
  const primaryTextColor = getPrimaryTextColor(themeMode);
  const secondaryTextColor = getSecondaryTextColor(themeMode);

  // Format currency display
  const getCurrencyDisplay = (): string => {
    const currency = settings?.currency || 'sats';
    const map: Record<string, string> = {
      sats: 'Satoshis (sats)',
      btc: 'Bitcoin (BTC)',
      usd: 'US Dollar (USD)',
      eur: 'Euro (EUR)',
      bgn: 'Bulgarian Lev (BGN)',
    };
    return map[currency] || currency;
  };

  // Format language display
  const getLanguageDisplay = (): string => {
    if (settings?.language === 'auto') {
      return language === 'bg' ? 'Auto (Bulgarian)' : 'Auto (English)';
    }
    return language === 'bg' ? 'Bulgarian' : 'English';
  };

  // Format auto-lock display
  const getAutoLockDisplay = (): string => {
    const timeout = settings?.autoLockTimeout || 900;
    if (timeout === 0) return 'Never';
    if (timeout < 60) return `${timeout} seconds`;
    return `${timeout / 60} minutes`;
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
            iconColor={primaryTextColor}
            size={24}
            onPress={() => router.back()}
          />
          <Text style={[styles.headerTitle, { color: primaryTextColor }]}>{t('settings')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView}>
          {/* Wallet Configuration */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: secondaryTextColor }]}>Wallet Configuration</Text>

            <List.Item
              title="Wallet Type"
              description={
                settings?.useBuiltInWallet
                  ? 'Built-in Wallet (Breez SDK)'
                  : 'Custom LNURL'
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
              title="Default Tip Amounts"
              description={`${settings?.defaultPostingAmounts?.join(', ') || '100, 500, 1000'} sats`}
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
              title="Display Currency"
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
          </View>

          {/* Language & Region */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: secondaryTextColor }]}>{t('language')}</Text>

            <List.Item
              title={t('language')}
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
          </View>

          {/* Security */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: secondaryTextColor }]}>{t('security')}</Text>

            <List.Item
              title="Auto-Lock Timeout"
              description={getAutoLockDisplay()}
              left={(props) => (
                <List.Icon {...props} icon="timer" color="#FFC107" />
              )}
              right={(props) => (
                <List.Icon {...props} icon="chevron-right" color={secondaryTextColor} />
              )}
              onPress={() => router.push('/wallet/settings/security')}
              titleStyle={[styles.listTitle, { color: primaryTextColor }]}
              descriptionStyle={[styles.listDescription, { color: secondaryTextColor }]}
              style={styles.listItem}
            />

            <Divider style={styles.divider} />

            <List.Item
              title="Biometric Authentication"
              description={
                settings?.biometricEnabled ? 'Enabled' : 'Disabled'
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

          {/* Backup & Recovery */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: secondaryTextColor }]}>Backup & Recovery</Text>

            <List.Item
              title="View Recovery Phrase"
              description="Backup your wallet seed phrase"
              left={(props) => (
                <List.Icon {...props} icon="key" color="#FFC107" />
              )}
              right={(props) => (
                <List.Icon {...props} icon="chevron-right" color={secondaryTextColor} />
              )}
              onPress={() => router.push('/wallet/settings/backup')}
              titleStyle={[styles.listTitle, { color: primaryTextColor }]}
              descriptionStyle={[styles.listDescription, { color: secondaryTextColor }]}
              style={styles.listItem}
            />
          </View>

          {/* App Settings */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: secondaryTextColor }]}>App Settings</Text>

            <List.Item
              title="Theme"
              description="Dark mode and display settings"
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
              title="Notifications"
              description="Manage notification preferences"
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

          {/* About */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: secondaryTextColor }]}>About</Text>

            <List.Item
              title="Version"
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
