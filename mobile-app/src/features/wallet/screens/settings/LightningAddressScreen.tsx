// Lightning Address Screen
// Register and manage Lightning Address for receiving payments

import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, IconButton, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useLightningAddress } from '../../../../hooks/useLightningAddress';
import { useAppTheme } from '../../../../contexts/ThemeContext';
import {
  getGradientColors,
  getPrimaryTextColor,
  getSecondaryTextColor,
  BRAND_COLOR,
} from '../../../../utils/theme-helpers';
import { t } from '../../../../services/i18nService';
import { StyledTextInput } from '../../../../components';

// =============================================================================
// Component
// =============================================================================

export function LightningAddressScreen(): React.JSX.Element {
  const {
    addressInfo,
    isLoading,
    isRegistered,
    checkAvailability,
    register,
    unregister,
    validateUsername,
    refresh,
  } = useLightningAddress();

  const { themeMode } = useAppTheme();

  const gradientColors = getGradientColors(themeMode);
  const primaryText = getPrimaryTextColor(themeMode);
  const secondaryText = getSecondaryTextColor(themeMode);

  // Refresh Lightning Address state when screen comes into focus
  // This ensures the correct address is shown for the current wallet
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Form state
  const [username, setUsername] = useState('');
  const [description, setDescription] = useState('');

  // UI state
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isUnregistering, setIsUnregistering] = useState(false);

  // Validation state
  const [availabilityStatus, setAvailabilityStatus] = useState<
    'unchecked' | 'available' | 'unavailable' | 'error'
  >('unchecked');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset form when address changes
  useEffect(() => {
    if (!isRegistered) {
      setAvailabilityStatus('unchecked');
    }
  }, [isRegistered]);

  // ========================================
  // Handlers
  // ========================================

  const handleUsernameChange = useCallback(
    (text: string) => {
      // Normalize to lowercase
      const normalized = text.toLowerCase().replace(/[^a-z0-9_-]/g, '');
      setUsername(normalized);

      // Reset availability when username changes
      setAvailabilityStatus('unchecked');
      setValidationError(null);
    },
    []
  );

  const handleCheckAvailability = useCallback(async () => {
    // Validate format first
    const validation = validateUsername(username);
    if (!validation.isValid) {
      setValidationError(validation.error || 'Invalid username');
      setAvailabilityStatus('error');
      return;
    }

    setIsCheckingAvailability(true);
    setValidationError(null);

    try {
      const result = await checkAvailability(username);

      if (result.error) {
        setValidationError(result.error);
        setAvailabilityStatus('error');
      } else if (result.available) {
        setAvailabilityStatus('available');
      } else {
        setAvailabilityStatus('unavailable');
        setValidationError('This username is already taken');
      }
    } finally {
      setIsCheckingAvailability(false);
    }
  }, [username, checkAvailability, validateUsername]);

  const handleRegister = useCallback(async () => {
    // Validate format first
    const validation = validateUsername(username);
    if (!validation.isValid) {
      setValidationError(validation.error || 'Invalid username');
      setAvailabilityStatus('error');
      return;
    }

    setIsRegistering(true);
    setValidationError(null);

    try {
      // Auto-check availability if not already checked
      if (availabilityStatus !== 'available') {
        const result = await checkAvailability(username);
        if (result.error) {
          setValidationError(result.error);
          setAvailabilityStatus('error');
          return;
        }
        if (!result.available) {
          setAvailabilityStatus('unavailable');
          setValidationError('This username is already taken');
          return;
        }
        setAvailabilityStatus('available');
      }

      const result = await register(username, description || undefined);

      if (result.success) {
        Alert.alert(t('common.success'), t('lightningAddressScreen.addressRegistered', { address: `${username}@breez.tips` }));
        setUsername('');
        setDescription('');
        setAvailabilityStatus('unchecked');
      } else {
        Alert.alert(t('common.error'), result.error || 'Failed to register Lightning Address');
      }
    } finally {
      setIsRegistering(false);
    }
  }, [username, description, availabilityStatus, register, checkAvailability, validateUsername]);

  const handleUnregister = useCallback(async () => {
    Alert.alert(
      t('lightningAddressScreen.unregisterAddress'),
      t('lightningAddressScreen.unregisterConfirm', { address: addressInfo?.lightningAddress || '' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('lightningAddressScreen.unregisterAddress'),
          style: 'destructive',
          onPress: async () => {
            setIsUnregistering(true);
            try {
              const result = await unregister();
              if (result.success) {
                Alert.alert(t('common.success'), t('lightningAddressScreen.addressUnregistered'));
              } else {
                Alert.alert(t('common.error'), result.error || 'Failed to unregister');
              }
            } finally {
              setIsUnregistering(false);
            }
          },
        },
      ]
    );
  }, [addressInfo, unregister]);

  const handleCopyAddress = useCallback(async () => {
    if (!addressInfo?.lightningAddress) return;

    try {
      await Clipboard.setStringAsync(addressInfo.lightningAddress);
      // Android's built-in clipboard notification provides feedback
    } catch {
      Alert.alert(t('common.error'), 'Failed to copy address');
    }
  }, [addressInfo]);

  // ========================================
  // Render
  // ========================================

  // Loading state
  if (isLoading) {
    return (
      <LinearGradient colors={gradientColors} style={styles.gradient}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <IconButton
              icon="arrow-left"
              iconColor={primaryText}
              size={24}
              onPress={() => router.back()}
            />
            <Text style={[styles.headerTitle, { color: primaryText }]}>{t('lightningAddressScreen.title')}</Text>
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={BRAND_COLOR} />
            <Text style={[styles.loadingText, { color: secondaryText }]}>{t('common.loading')}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={gradientColors} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            iconColor={primaryText}
            size={24}
            onPress={() => router.back()}
          />
          <Text style={[styles.headerTitle, { color: primaryText }]}>{t('lightningAddressScreen.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            {isRegistered && addressInfo ? (
              /* ===== REGISTERED STATE ===== */
              <>
                {/* QR Code */}
                <View style={styles.qrSection}>
                  <View style={styles.qrContainer}>
                    <QRCode
                      value={addressInfo.lightningAddress}
                      size={200}
                      backgroundColor="white"
                      color="black"
                    />
                  </View>
                </View>

                {/* Address Display */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: primaryText }]}>
                    {t('lightningAddressScreen.yourAddress')}
                  </Text>
                  <View style={styles.addressDisplay}>
                    <Text style={styles.addressText}>{addressInfo.lightningAddress}</Text>
                  </View>

                  {/* Actions */}
                  <View style={styles.actionButtons}>
                    <Button
                      mode="contained"
                      onPress={handleCopyAddress}
                      style={styles.copyButton}
                      labelStyle={styles.copyButtonLabel}
                      icon="content-copy"
                    >
                      {t('lightningAddressScreen.copyAddress')}
                    </Button>
                  </View>
                </View>

                {/* Info Box */}
                <View style={styles.infoBox}>
                  <Text style={styles.infoTitle}>{t('lightningAddressScreen.aboutLightningAddress')}</Text>
                  <Text style={[styles.infoText, { color: secondaryText }]}>
                    {t('lightningAddressScreen.aboutLightningAddressDesc')}
                  </Text>
                </View>

                {/* Unregister Option */}
                <View style={styles.dangerSection}>
                  <Button
                    mode="outlined"
                    onPress={handleUnregister}
                    loading={isUnregistering}
                    disabled={isUnregistering}
                    style={styles.unregisterButton}
                    textColor="#f44336"
                  >
                    {t('lightningAddressScreen.unregisterAddress')}
                  </Button>
                </View>
              </>
            ) : (
              /* ===== UNREGISTERED STATE ===== */
              <>
                {/* Registration Form */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: primaryText }]}>
                    {t('lightningAddressScreen.claimAddress')}
                  </Text>

                  {/* Username Input */}
                  <StyledTextInput
                    label={t('lightningAddressScreen.username')}
                    value={username}
                    onChangeText={handleUsernameChange}
                    placeholder="yourname"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                    right={<Text style={styles.domainSuffix}>@breez.tips</Text>}
                  />

                  {/* Availability Status */}
                  {availabilityStatus !== 'unchecked' && (
                    <View
                      style={[
                        styles.statusContainer,
                        availabilityStatus === 'available' && styles.statusAvailable,
                        (availabilityStatus === 'unavailable' || availabilityStatus === 'error') &&
                          styles.statusUnavailable,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          availabilityStatus === 'available' && styles.statusTextAvailable,
                          (availabilityStatus === 'unavailable' ||
                            availabilityStatus === 'error') &&
                            styles.statusTextUnavailable,
                        ]}
                      >
                        {availabilityStatus === 'available' && t('lightningAddressScreen.usernameAvailable')}
                        {availabilityStatus === 'unavailable' && t('lightningAddressScreen.usernameTaken')}
                        {availabilityStatus === 'error' && validationError}
                      </Text>
                    </View>
                  )}

                  {/* Validation Error */}
                  {validationError && availabilityStatus === 'unchecked' && (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{validationError}</Text>
                    </View>
                  )}

                  {/* Description Input (Optional) */}
                  <StyledTextInput
                    label={t('lightningAddressScreen.descriptionOptional')}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="My Lightning Wallet"
                    style={[styles.input, styles.inputSpacing]}
                  />

                  {/* Action Buttons */}
                  <View style={styles.formActions}>
                    <Button
                      mode="outlined"
                      onPress={handleCheckAvailability}
                      loading={isCheckingAvailability}
                      disabled={
                        isCheckingAvailability || !username || username.length < 3
                      }
                      style={styles.checkButton}
                      textColor={BRAND_COLOR}
                    >
                      {t('lightningAddressScreen.checkAvailability')}
                    </Button>

                    <Button
                      mode="contained"
                      onPress={handleRegister}
                      loading={isRegistering}
                      disabled={isRegistering || !username || username.length < 3}
                      style={styles.registerButton}
                      labelStyle={styles.registerButtonLabel}
                    >
                      {t('lightningAddressScreen.registerAddress')}
                    </Button>
                  </View>
                </View>

                {/* Info Box */}
                <View style={styles.infoBox}>
                  <Text style={styles.infoTitle}>{t('lightningAddressScreen.whatIsLightningAddress')}</Text>
                  <Text style={[styles.infoText, { color: secondaryText }]}>
                    {t('lightningAddressScreen.whatIsLightningAddressDesc')}
                  </Text>
                  <Text style={[styles.infoText, { color: secondaryText, marginTop: 8 }]}>
                    {t('lightningAddressScreen.example')}
                  </Text>
                </View>

                {/* Username Requirements */}
                <View style={styles.requirementsBox}>
                  <Text style={[styles.requirementsTitle, { color: secondaryText }]}>
                    {t('lightningAddressScreen.usernameRequirements')}
                  </Text>
                  <Text style={[styles.requirementsText, { color: secondaryText }]}>
                    • {t('lightningAddressScreen.requirement1')}
                  </Text>
                  <Text style={[styles.requirementsText, { color: secondaryText }]}>
                    • {t('lightningAddressScreen.requirement2')}
                  </Text>
                  <Text style={[styles.requirementsText, { color: secondaryText }]}>
                    • {t('lightningAddressScreen.requirement3')}
                  </Text>
                </View>
              </>
            )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
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
  qrSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  addressDisplay: {
    backgroundColor: 'rgba(247, 147, 26, 0.1)',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  addressText: {
    fontSize: 18,
    fontWeight: '600',
    color: BRAND_COLOR,
    fontFamily: 'monospace',
  },
  actionButtons: {
    gap: 12,
  },
  copyButton: {
    backgroundColor: BRAND_COLOR,
    borderRadius: 8,
  },
  copyButtonLabel: {
    color: '#1a1a2e',
    fontWeight: '600',
  },
  dangerSection: {
    marginTop: 24,
  },
  unregisterButton: {
    borderColor: '#f44336',
    borderRadius: 8,
  },
  input: {
    marginBottom: 8,
  },
  inputSpacing: {
    marginTop: 16,
  },
  domainSuffix: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    alignSelf: 'center',
    marginRight: 12,
  },
  statusContainer: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  statusAvailable: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  statusUnavailable: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusTextAvailable: {
    color: '#4CAF50',
  },
  statusTextUnavailable: {
    color: '#f44336',
  },
  errorContainer: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorText: {
    color: '#f44336',
    fontSize: 13,
  },
  formActions: {
    marginTop: 24,
    gap: 12,
  },
  checkButton: {
    borderColor: BRAND_COLOR,
    borderRadius: 8,
  },
  registerButton: {
    backgroundColor: BRAND_COLOR,
    borderRadius: 8,
  },
  registerButtonLabel: {
    color: '#1a1a2e',
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: 'rgba(247, 147, 26, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: BRAND_COLOR,
    marginBottom: 16,
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
  requirementsBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 16,
  },
  requirementsTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  requirementsText: {
    fontSize: 12,
    lineHeight: 20,
  },
});
