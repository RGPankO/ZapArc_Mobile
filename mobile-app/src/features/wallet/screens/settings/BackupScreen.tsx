// Backup and Recovery Settings Screen
// Manage wallet backup and recovery phrase

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Text, Button, IconButton, Switch } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import { useWallet } from '../../../../hooks/useWallet';
import { useSettings } from '../../../../hooks/useSettings';
import { storageService } from '../../../../services';
import { useAppTheme } from '../../../../contexts/ThemeContext';
import { useLanguage } from '../../../../hooks/useLanguage';
import { getGradientColors, getPrimaryTextColor, getSecondaryTextColor, BRAND_COLOR } from '../../../../utils/theme-helpers';

// =============================================================================
// Component
// =============================================================================

export function BackupScreen(): React.JSX.Element {
  const { getMnemonic, activeMasterKey, activeWalletInfo } = useWallet();
  const { settings } = useSettings();
  const { themeMode } = useAppTheme();
  const { t } = useLanguage();

  // Get theme colors
  const gradientColors = getGradientColors(themeMode);
  const primaryText = getPrimaryTextColor(themeMode);
  const secondaryText = getSecondaryTextColor(themeMode);

  // State
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pinPromptVisible, setPinPromptVisible] = useState(false);
  const [manualPin, setManualPin] = useState('');

  // Authenticate and reveal mnemonic
  const handleRevealMnemonic = useCallback(async () => {
    console.log('🔐 [BackupScreen] Reveal requested. activeMasterKey:', activeMasterKey?.id);
    
    if (!activeMasterKey) {
      Alert.alert('Error', 'No active wallet found');
      return;
    }

    setIsLoading(true);

    try {
      // Only use biometric if the user has it enabled in app settings
      const biometricEnabledInSettings = settings?.biometricEnabled ?? false;
      console.log('🔐 [BackupScreen] biometricEnabled from settings:', biometricEnabledInSettings, 'raw settings:', settings?.biometricEnabled);
      const biometricAvailable = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (biometricEnabledInSettings && biometricAvailable && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to view recovery phrase',
          fallbackLabel: 'Use PIN',
        });

        if (!result.success) {
          setIsLoading(false);
          return;
        }
      }

      // Get PIN from biometric storage (stored during wallet creation)
      let pin = await storageService.getBiometricPin(activeMasterKey.id);
      
      if (!pin) {
        // PIN not in biometric storage — prompt user to enter it
        setIsLoading(false);
        setPinPromptVisible(true);
        return;
      }

      // Get the mnemonic with masterKeyId and pin
      await revealWithPin(pin);
    } catch (err) {
      console.error('Failed to reveal mnemonic:', err);
      Alert.alert('Error', 'Failed to authenticate');
    } finally {
      setIsLoading(false);
    }
  }, [activeMasterKey, activeWalletInfo, getMnemonic, settings]);

  // Reveal mnemonic with a given PIN
  const revealWithPin = useCallback(async (pin: string) => {
    if (!activeMasterKey) return;
    try {
      const phrase = await getMnemonic(activeMasterKey.id, pin);
      if (phrase) {
        setMnemonic(phrase);
        setShowMnemonic(true);
        // Store PIN for future use so this wallet won't need manual entry again
        storageService.storeBiometricPin(activeMasterKey.id, pin).catch(() => {});
      } else {
        Alert.alert('Error', 'Incorrect PIN or could not retrieve recovery phrase');
      }
    } catch (err) {
      console.error('Failed to reveal mnemonic:', err);
      Alert.alert('Error', 'Incorrect PIN');
    }
  }, [activeMasterKey, getMnemonic]);

  // Handle manual PIN submission
  const handleManualPinSubmit = useCallback(async () => {
    if (manualPin.length !== 6) {
      Alert.alert('Error', 'PIN must be 6 digits');
      return;
    }
    setPinPromptVisible(false);
    setIsLoading(true);
    try {
      await revealWithPin(manualPin);
    } finally {
      setManualPin('');
      setIsLoading(false);
    }
  }, [manualPin, revealWithPin]);

  // Hide mnemonic
  const handleHideMnemonic = useCallback(() => {
    setShowMnemonic(false);
    setMnemonic(null);
  }, []);

  // Copy mnemonic to clipboard
  const handleCopyMnemonic = useCallback((): void => {
    if (!mnemonic) return;

    Alert.alert(
      'Security Warning',
      'Copying your recovery phrase to the clipboard is risky. Only do this in a secure environment. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Copy',
          style: 'destructive',
          onPress: (): void => {
            Clipboard.setString(mnemonic);
          },
        },
      ]
    );
  }, [mnemonic]);

  // Render mnemonic words
  const renderMnemonicWords = (): React.JSX.Element | null => {
    if (!mnemonic) return null;

    const words = mnemonic.split(' ');
    return (
      <View style={styles.mnemonicGrid}>
        {words.map((word, index) => (
          <View key={index} style={styles.wordItem}>
            <Text style={styles.wordNumber}>{index + 1}</Text>
            <Text style={styles.wordText}>{word}</Text>
          </View>
        ))}
      </View>
    );
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
            {t('settings.backupRecovery')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            {/* Warning Banner */}
            <View style={styles.warningBanner}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <Text style={styles.warningTitle}>Keep Your Phrase Safe</Text>
              <Text style={[styles.warningText, { color: secondaryText }]}>
                Your recovery phrase is the ONLY way to restore your wallet if
                you lose access to this device. Never share it with anyone.
              </Text>
            </View>

            {/* Recovery Phrase Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: primaryText }]}>Recovery Phrase</Text>
              <Text style={[styles.sectionDescription, { color: secondaryText }]}>
                Write down these 12 words in order and store them in a secure
                location.
              </Text>

              {!showMnemonic ? (
                <View style={styles.hiddenContainer}>
                  <View style={styles.hiddenPlaceholder}>
                    <Text style={styles.hiddenIcon}>🔒</Text>
                    <Text style={[styles.hiddenText, { color: secondaryText }]}>
                      Recovery phrase is hidden for security
                    </Text>
                  </View>

                  <Button
                    mode="contained"
                    onPress={handleRevealMnemonic}
                    loading={isLoading}
                    disabled={isLoading}
                    style={styles.revealButton}
                    labelStyle={styles.revealButtonLabel}
                    icon="eye"
                  >
                    Reveal Recovery Phrase
                  </Button>
                </View>
              ) : (
                <View style={styles.mnemonicContainer}>
                  {renderMnemonicWords()}

                  <View style={styles.mnemonicActions}>
                    <TouchableOpacity
                      style={styles.mnemonicAction}
                      onPress={handleCopyMnemonic}
                    >
                      <IconButton
                        icon="content-copy"
                        iconColor={BRAND_COLOR}
                        size={20}
                      />
                      <Text style={[styles.mnemonicActionText, { color: secondaryText }]}>Copy</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.mnemonicAction}
                      onPress={handleHideMnemonic}
                    >
                      <IconButton
                        icon="eye-off"
                        iconColor="#FF5252"
                        size={20}
                      />
                      <Text style={[styles.mnemonicActionText, { color: secondaryText }]}>Hide</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Backup Confirmation */}
            {showMnemonic && (
              <View style={styles.section}>
                <View style={styles.confirmRow}>
                  <Switch
                    value={backupConfirmed}
                    onValueChange={setBackupConfirmed}
                    color="#4CAF50"
                  />
                  <Text style={[styles.confirmText, { color: secondaryText }]}>
                    I have written down my recovery phrase and stored it safely
                  </Text>
                </View>
              </View>
            )}

            {/* Security Tips */}
            <View style={styles.tipsSection}>
              <Text style={[styles.tipsTitle, { color: primaryText }]}>Backup Security Tips</Text>

              <View style={styles.tipItem}>
                <Text style={styles.tipIcon}>✅</Text>
                <Text style={[styles.tipText, { color: secondaryText }]}>
                  Write on paper - never store digitally
                </Text>
              </View>

              <View style={styles.tipItem}>
                <Text style={styles.tipIcon}>✅</Text>
                <Text style={[styles.tipText, { color: secondaryText }]}>
                  Store in multiple secure locations
                </Text>
              </View>

              <View style={styles.tipItem}>
                <Text style={styles.tipIcon}>✅</Text>
                <Text style={[styles.tipText, { color: secondaryText }]}>
                  Consider using a metal backup for fire/water protection
                </Text>
              </View>

              <View style={styles.tipItem}>
                <Text style={styles.tipIcon}>❌</Text>
                <Text style={[styles.tipText, { color: secondaryText }]}>
                  Never share with anyone - not even support staff
                </Text>
              </View>

              <View style={styles.tipItem}>
                <Text style={styles.tipIcon}>❌</Text>
                <Text style={[styles.tipText, { color: secondaryText }]}>
                  Never enter on a website or in an email
                </Text>
              </View>

              <View style={styles.tipItem}>
                <Text style={styles.tipIcon}>❌</Text>
                <Text style={[styles.tipText, { color: secondaryText }]}>
                  Never take a screenshot or photo
                </Text>
              </View>
            </View>

            {/* Wallet Info */}
            {activeMasterKey && (
              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>Wallet Information</Text>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: secondaryText }]}>Name:</Text>
                  <Text style={[styles.infoValue, { color: primaryText }]}>{activeMasterKey.nickname}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: secondaryText }]}>Created:</Text>
                  <Text style={[styles.infoValue, { color: primaryText }]}>
                    {new Date(activeMasterKey.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* PIN Entry Modal */}
      <Modal visible={pinPromptVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Your PIN</Text>
            <Text style={styles.modalDescription}>Enter your 6-digit PIN to view the recovery phrase.</Text>
            <TextInput
              style={styles.modalPinInput}
              value={manualPin}
              onChangeText={(text) => setManualPin(text.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              placeholder="Enter 6-digit PIN"
              placeholderTextColor="#999"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => { setPinPromptVisible(false); setManualPin(''); }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, manualPin.length !== 6 && { opacity: 0.5 }]}
                onPress={handleManualPinSubmit}
                disabled={manualPin.length !== 6}
              >
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  warningBanner: {
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  warningIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: BRAND_COLOR,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 20,
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
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 16,
  },
  hiddenContainer: {
    alignItems: 'center',
  },
  hiddenPlaceholder: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  hiddenIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  hiddenText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
  revealButton: {
    backgroundColor: BRAND_COLOR,
  },
  revealButtonLabel: {
    color: '#1a1a2e',
    fontWeight: '600',
  },
  mnemonicContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 16,
  },
  mnemonicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  wordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: '48%',
  },
  wordNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: BRAND_COLOR,
    marginRight: 8,
    width: 20,
  },
  wordText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  mnemonicActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  mnemonicAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mnemonicActionText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  confirmText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
  },
  tipsSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  tipIcon: {
    fontSize: 16,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
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
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  infoValue: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: 'rgba(247, 147, 26, 0.3)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 20,
  },
  modalPinInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    fontSize: 20,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 8,
    borderWidth: 1,
    borderColor: 'rgba(247, 147, 26, 0.3)',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
  },
  modalCancelText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F7931A',
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#1a1a2e',
    fontSize: 16,
    fontWeight: '600',
  },
});
