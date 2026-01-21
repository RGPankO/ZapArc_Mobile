// Security Settings Screen
// Configure biometric authentication (fingerprint/Face ID)

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Switch, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSettings } from '../../../../hooks/useSettings';
import { useLanguage } from '../../../../hooks/useLanguage';
import { useAppTheme } from '../../../../contexts/ThemeContext';
import { getGradientColors, getPrimaryTextColor, getSecondaryTextColor } from '../../../../utils/theme-helpers';

// =============================================================================
// Component
// =============================================================================

export function SecuritySettingsScreen(): React.JSX.Element {
  const { settings, updateSettings } = useSettings();
  const { t } = useLanguage();
  const { themeMode } = useAppTheme();

  // Get theme colors
  const gradientColors = getGradientColors(themeMode);
  const primaryText = getPrimaryTextColor(themeMode);
  const secondaryText = getSecondaryTextColor(themeMode);

  // State
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometric');

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
      setBiometricEnabled(settings.biometricEnabled || false);
    }
  }, [settings]);

  // Get biometric icon
  const getBiometricIcon = (): string => {
    if (biometricType === 'Face ID') {
      return 'face-recognition';
    }
    return 'fingerprint';
  };

  // Handle biometric toggle
  const handleBiometricToggle = async (enabled: boolean): Promise<void> => {
    let finalEnabled = enabled;

    if (enabled) {
      // Verify biometric before enabling
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: t('settings.verifyToEnableBiometric'),
          fallbackLabel: t('settings.usePin'),
        });

        if (!result.success) {
          Alert.alert(t('settings.failed'), t('settings.biometricVerificationFailed'));
          return;
        }
        finalEnabled = true;
      } catch {
        Alert.alert(t('common.error'), t('settings.failedToVerifyBiometric'));
        return;
      }
    }

    try {
      setBiometricEnabled(finalEnabled);
      await updateSettings({
        biometricEnabled: finalEnabled,
      });
      console.log(`🔐 [SecuritySettings] Biometric ${finalEnabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      console.error('❌ [SecuritySettings] Failed to save setting:', err);
      Alert.alert(t('common.error'), t('settings.failedToSaveSettings'));
      // Revert local state
      setBiometricEnabled(!finalEnabled);
    }
  };

  // handleSave removed (saving immediately now)

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
            {t('settings.biometricAuth')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            {/* Biometric Authentication */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <IconButton
                  icon={getBiometricIcon()}
                  iconColor="#FFC107"
                  size={28}
                  style={styles.sectionIcon}
                />
                <Text style={[styles.sectionTitle, { color: primaryText }]}>
                  {biometricType === 'Fingerprint' ? t('settings.fingerprintUnlock') : t('settings.faceIdUnlock')}
                </Text>
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchContent}>
                  <Text style={[styles.switchDescription, { color: secondaryText }]}>
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

              {!biometricAvailable && (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    ⚠️ {t('settings.biometricNotEnrolled')}
                  </Text>
                </View>
              )}
            </View>

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>{t('settings.securityTips')}</Text>
              <Text style={[styles.infoText, { color: secondaryText }]}>
                • {t('settings.securityTip1')}{'\n'}
                • {t('settings.securityTip2')}{'\n'}
                • {t('settings.securityTip4')}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Footer spacer */}
        <View style={styles.bottomSpacer} />
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIcon: {
    margin: 0,
    marginRight: 4,
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
  bottomSpacer: {
    height: 32,
  },
});
