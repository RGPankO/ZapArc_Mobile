// Security Settings Screen
// Configure auto-lock timeout and biometric authentication

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, RadioButton, Switch, Button, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSettings } from '../../../../hooks/useSettings';
import { useLanguage } from '../../../../hooks/useLanguage';
import type { AutoLockTimeout } from '../../../settings/types';

// =============================================================================
// Constants
// =============================================================================

const AUTO_LOCK_OPTIONS: { value: AutoLockTimeout; labelKey: string }[] = [
  { value: 300, labelKey: 'settings.fiveMinutes' },
  { value: 900, labelKey: 'settings.fifteenMinutes' },
  { value: 1800, labelKey: 'settings.thirtyMinutes' },
  { value: 3600, labelKey: 'settings.oneHour' },
  { value: 7200, labelKey: 'settings.twoHours' },
  { value: 0, labelKey: 'settings.never' },
];

// =============================================================================
// Component
// =============================================================================

export function SecuritySettingsScreen(): React.JSX.Element {
  const { settings, updateSettings } = useSettings();
  const { t } = useLanguage();

  // State
  const [autoLockTimeout, setAutoLockTimeout] = useState<AutoLockTimeout>(900);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometric');
  const [isSaving, setIsSaving] = useState(false);

  // Check biometric availability
  useEffect(() => {
    const checkBiometric = async (): Promise<void> => {
      try {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricAvailable(compatible && enrolled);

        if (compatible) {
          const types =
            await LocalAuthentication.supportedAuthenticationTypesAsync();
          if (
            types.includes(
              LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
            )
          ) {
            setBiometricType('Face ID');
          } else if (
            types.includes(
              LocalAuthentication.AuthenticationType.FINGERPRINT
            )
          ) {
            setBiometricType('Fingerprint');
          }
        }
      } catch (err) {
        console.error('Failed to check biometric:', err);
      }
    };

    checkBiometric();
  }, []);

  // Load settings on mount
  useEffect(() => {
    if (settings) {
      setAutoLockTimeout(settings.autoLockTimeout || 900);
      setBiometricEnabled(settings.biometricEnabled || false);
    }
  }, [settings]);

  // Handle biometric toggle
  const handleBiometricToggle = async (enabled: boolean): Promise<void> => {
    if (enabled) {
      // Verify biometric before enabling
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: t('settings.verifyToEnableBiometric'),
          fallbackLabel: t('settings.usePin'),
        });

        if (result.success) {
          setBiometricEnabled(true);
        } else {
          Alert.alert(t('settings.failed'), t('settings.biometricVerificationFailed'));
        }
      } catch (err) {
        Alert.alert(t('common.error'), t('settings.failedToVerifyBiometric'));
      }
    } else {
      setBiometricEnabled(false);
    }
  };

  // Handle save
  const handleSave = async (): Promise<void> => {
    setIsSaving(true);

    try {
      await updateSettings({
        autoLockTimeout,
        biometricEnabled,
      });

      Alert.alert(t('settings.saved'), t('settings.securitySettingsUpdated'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert(t('common.error'), t('settings.failedToSaveSettings'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            iconColor="#FFFFFF"
            size={24}
            onPress={() => router.back()}
          />
          <Text style={styles.headerTitle}>{t('settings.security')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            {/* Auto-Lock Timeout */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('settings.autoLockTimeout')}</Text>
              <Text style={styles.sectionDescription}>
                {t('settings.lockWalletAfterInactivity')}
              </Text>

              <RadioButton.Group
                onValueChange={(value) =>
                  setAutoLockTimeout(parseInt(value, 10) as AutoLockTimeout)
                }
                value={autoLockTimeout.toString()}
              >
                {AUTO_LOCK_OPTIONS.map((option) => (
                  <View style={styles.radioItem} key={option.value}>
                    <RadioButton.Android
                      value={option.value.toString()}
                      color="#FFC107"
                      uncheckedColor="rgba(255, 255, 255, 0.5)"
                    />
                    <Text style={styles.radioLabel}>{t(option.labelKey)}</Text>
                  </View>
                ))}
              </RadioButton.Group>

              {autoLockTimeout === 0 && (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    ⚠️ {t('settings.disableAutoLockWarning')}
                  </Text>
                </View>
              )}
            </View>

            {/* Biometric Authentication */}
            <View style={styles.section}>
              <View style={styles.switchRow}>
                <View style={styles.switchContent}>
                  <Text style={styles.switchTitle}>
                    {t('settings.biometricAuthentication', { type: biometricType })}
                  </Text>
                  <Text style={styles.switchDescription}>
                    {biometricAvailable
                      ? t('settings.useBiometricToUnlock', { type: biometricType })
                      : t('settings.notAvailableOnDevice')}
                  </Text>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleBiometricToggle}
                  disabled={!biometricAvailable}
                  color="#FFC107"
                />
              </View>
            </View>

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>{t('settings.securityTips')}</Text>
              <Text style={styles.infoText}>
                • {t('settings.securityTip1')}{'\n'}
                • {t('settings.securityTip2')}{'\n'}
                • {t('settings.securityTip3')}{'\n'}
                • {t('settings.securityTip4')}
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
            {t('settings.saveChanges')}
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
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 16,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  radioLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 8,
  },
  warningBox: {
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  warningText: {
    fontSize: 13,
    color: '#FFC107',
    lineHeight: 18,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchContent: {
    flex: 1,
    marginRight: 16,
  },
  switchTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  infoBox: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFC107',
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
    backgroundColor: '#FFC107',
    borderRadius: 12,
  },
  saveButtonLabel: {
    color: '#1a1a2e',
    fontWeight: '600',
  },
});
