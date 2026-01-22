// Wallet Configuration Settings Screen
// Configure built-in wallet vs custom LNURL

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  RadioButton,
  Button,
  IconButton,
} from 'react-native-paper';
import { StyledTextInput } from '../../../../components';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettings } from '../../../../hooks/useSettings';
import { useLanguage } from '../../../../hooks/useLanguage';
import { useAppTheme } from '../../../../contexts/ThemeContext';
import { getGradientColors, getPrimaryTextColor, getSecondaryTextColor, BRAND_COLOR } from '../../../../utils/theme-helpers';
import { isLightningAddress, isValidLnurlFormat } from '../../../../utils/lnurl';

// =============================================================================
// Component
// =============================================================================

export function WalletConfigScreen(): React.JSX.Element {
  const { settings, updateSettings } = useSettings();
  const { t } = useLanguage();
  const { themeMode } = useAppTheme();

  // Get theme colors
  const gradientColors = getGradientColors(themeMode);
  const primaryText = getPrimaryTextColor(themeMode);
  const secondaryText = getSecondaryTextColor(themeMode);

  // State
  const [useBuiltIn, setUseBuiltIn] = useState(true);
  const [customLNURL, setCustomLNURL] = useState('');
  const [customAddress, setCustomAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    if (settings) {
      setUseBuiltIn(settings.useBuiltInWallet);
      setCustomLNURL(settings.customLNURL || '');
      setCustomAddress(settings.customLightningAddress || '');
    }
  }, [settings]);

  // Validate custom input
  const validateCustomInput = (): boolean => {
    if (useBuiltIn) return true;

    if (!customLNURL && !customAddress) {
      setError('Please provide a custom LNURL or Lightning address');
      return false;
    }

    if (customLNURL && !isValidLnurlFormat(customLNURL)) {
      setError('Invalid LNURL format');
      return false;
    }

    if (customAddress && !isLightningAddress(customAddress)) {
      setError('Invalid Lightning address format (e.g., user@domain.com)');
      return false;
    }

    return true;
  };

  // Handle save
  const handleSave = async (): Promise<void> => {
    setError(null);

    if (!validateCustomInput()) return;

    setIsSaving(true);

    try {
      await updateSettings({
        useBuiltInWallet: useBuiltIn,
        customLNURL: useBuiltIn ? undefined : customLNURL || undefined,
        customLightningAddress: useBuiltIn
          ? undefined
          : customAddress || undefined,
      });

      Alert.alert('Saved', 'Wallet configuration updated', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      setError('Failed to save settings');
    } finally {
      setIsSaving(false);
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
            {t('settings.walletType')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            {/* Wallet Type Selection */}
            <View style={styles.section}>
              <Text style={[styles.sectionDescription, { color: secondaryText }]}>
                Choose how you want to receive Lightning payments
              </Text>

              <RadioButton.Group
                onValueChange={(value) => setUseBuiltIn(value === 'builtin')}
                value={useBuiltIn ? 'builtin' : 'custom'}
              >
                <View style={styles.radioItem}>
                  <RadioButton.Android
                    value="builtin"
                    color={BRAND_COLOR}
                    uncheckedColor={secondaryText}
                  />
                  <View style={styles.radioContent}>
                    <Text style={[styles.radioTitle, { color: primaryText }]}>
                      Built-in Wallet (Recommended)
                    </Text>
                    <Text style={[styles.radioDescription, { color: secondaryText }]}>
                      Use Breez SDK for seamless Lightning payments. Your keys,
                      your coins.
                    </Text>
                  </View>
                </View>

                <View style={styles.radioItem}>
                  <RadioButton.Android
                    value="custom"
                    color={BRAND_COLOR}
                    uncheckedColor={secondaryText}
                  />
                  <View style={styles.radioContent}>
                    <Text style={[styles.radioTitle, { color: primaryText }]}>Custom LNURL/Address</Text>
                    <Text style={[styles.radioDescription, { color: secondaryText }]}>
                      Use your own Lightning address or LNURL-pay endpoint.
                    </Text>
                  </View>
                </View>
              </RadioButton.Group>
            </View>

            {/* Custom Configuration */}
            {!useBuiltIn && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: primaryText }]}>Custom Configuration</Text>

                <StyledTextInput
                  label="Lightning Address"
                  value={customAddress}
                  onChangeText={(text: string) => {
                    setCustomAddress(text);
                    setError(null);
                  }}
                  placeholder="you@wallet.com"
                  mode="outlined"
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Text style={[styles.orDivider, { color: secondaryText }]}>— or —</Text>

                <StyledTextInput
                  label="LNURL-pay"
                  value={customLNURL}
                  onChangeText={(text: string) => {
                    setCustomLNURL(text);
                    setError(null);
                  }}
                  placeholder="lnurl..."
                  mode="outlined"
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            )}

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>About Wallet Types</Text>
              <Text style={[styles.infoText, { color: secondaryText }]}>
                {useBuiltIn
                  ? 'The built-in wallet uses Breez SDK to create a non-custodial Lightning wallet. Your seed phrase is encrypted and stored securely on your device.'
                  : 'Using a custom address means tips will be sent directly to your existing Lightning wallet. Make sure your wallet supports LNURL-pay.'}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Save Button */}
        <View style={styles.footer}>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={isSaving}
            disabled={isSaving}
            style={styles.saveButton}
            labelStyle={styles.saveButtonLabel}
          >
            Save Changes
          </Button>
        </View>
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
    marginBottom: 16,
  },
  sectionDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 16,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  radioContent: {
    flex: 1,
    marginLeft: 8,
  },
  radioTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  radioDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  input: {
    marginBottom: 12,
  },
  orDivider: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 13,
    marginVertical: 12,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 82, 82, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#FF5252',
    fontSize: 14,
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
  footer: {
    padding: 16,
  },
  saveButton: {
    backgroundColor: BRAND_COLOR,
    borderRadius: 12,
  },
  saveButtonLabel: {
    color: '#1a1a2e',
    fontWeight: '600',
  },
});
