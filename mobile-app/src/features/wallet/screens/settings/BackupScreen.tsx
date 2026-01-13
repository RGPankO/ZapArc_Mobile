// Backup and Recovery Settings Screen
// Manage wallet backup and recovery phrase

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Text, Button, IconButton, Switch } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import { useWallet } from '../../../../hooks/useWallet';
import { storageService } from '../../../../services';

// =============================================================================
// Component
// =============================================================================

export function BackupScreen(): React.JSX.Element {
  const { getMnemonic, activeMasterKey, activeWalletInfo } = useWallet();

  // State
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Authenticate and reveal mnemonic
  const handleRevealMnemonic = useCallback(async () => {
    console.log('🔐 [BackupScreen] Reveal requested. activeMasterKey:', activeMasterKey?.id);
    
    if (!activeMasterKey) {
      Alert.alert('Error', 'No active wallet found');
      return;
    }

    setIsLoading(true);

    try {
      // First try biometric authentication
      const biometricAvailable = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (biometricAvailable && isEnrolled) {
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
      const pin = await storageService.getBiometricPin(activeMasterKey.id);
      
      if (!pin) {
        Alert.alert('Error', 'PIN not available. Please unlock wallet with PIN first.');
        setIsLoading(false);
        return;
      }

      // Get the mnemonic with masterKeyId and pin
      const phrase = await getMnemonic(activeMasterKey.id, pin);
      if (phrase) {
        setMnemonic(phrase);
        setShowMnemonic(true);
      } else {
        Alert.alert('Error', 'Could not retrieve recovery phrase');
      }
    } catch (err) {
      console.error('Failed to reveal mnemonic:', err);
      Alert.alert('Error', 'Failed to authenticate');
    } finally {
      setIsLoading(false);
    }
  }, [activeMasterKey, activeWalletInfo, getMnemonic]);

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
          <Text style={styles.headerTitle}>Backup & Recovery</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            {/* Warning Banner */}
            <View style={styles.warningBanner}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <Text style={styles.warningTitle}>Keep Your Phrase Safe</Text>
              <Text style={styles.warningText}>
                Your recovery phrase is the ONLY way to restore your wallet if
                you lose access to this device. Never share it with anyone.
              </Text>
            </View>

            {/* Recovery Phrase Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recovery Phrase</Text>
              <Text style={styles.sectionDescription}>
                Write down these 12 words in order and store them in a secure
                location.
              </Text>

              {!showMnemonic ? (
                <View style={styles.hiddenContainer}>
                  <View style={styles.hiddenPlaceholder}>
                    <Text style={styles.hiddenIcon}>🔒</Text>
                    <Text style={styles.hiddenText}>
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
                        iconColor="#FFC107"
                        size={20}
                      />
                      <Text style={styles.mnemonicActionText}>Copy</Text>
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
                      <Text style={styles.mnemonicActionText}>Hide</Text>
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
                  <Text style={styles.confirmText}>
                    I have written down my recovery phrase and stored it safely
                  </Text>
                </View>
              </View>
            )}

            {/* Security Tips */}
            <View style={styles.tipsSection}>
              <Text style={styles.tipsTitle}>Backup Security Tips</Text>

              <View style={styles.tipItem}>
                <Text style={styles.tipIcon}>✅</Text>
                <Text style={styles.tipText}>
                  Write on paper - never store digitally
                </Text>
              </View>

              <View style={styles.tipItem}>
                <Text style={styles.tipIcon}>✅</Text>
                <Text style={styles.tipText}>
                  Store in multiple secure locations
                </Text>
              </View>

              <View style={styles.tipItem}>
                <Text style={styles.tipIcon}>✅</Text>
                <Text style={styles.tipText}>
                  Consider using a metal backup for fire/water protection
                </Text>
              </View>

              <View style={styles.tipItem}>
                <Text style={styles.tipIcon}>❌</Text>
                <Text style={styles.tipText}>
                  Never share with anyone - not even support staff
                </Text>
              </View>

              <View style={styles.tipItem}>
                <Text style={styles.tipIcon}>❌</Text>
                <Text style={styles.tipText}>
                  Never enter on a website or in an email
                </Text>
              </View>

              <View style={styles.tipItem}>
                <Text style={styles.tipIcon}>❌</Text>
                <Text style={styles.tipText}>
                  Never take a screenshot or photo
                </Text>
              </View>
            </View>

            {/* Wallet Info */}
            {activeMasterKey && (
              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>Wallet Information</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Name:</Text>
                  <Text style={styles.infoValue}>{activeMasterKey.nickname}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Created:</Text>
                  <Text style={styles.infoValue}>
                    {new Date(activeMasterKey.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
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
    color: '#FFC107',
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
    backgroundColor: '#FFC107',
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
    color: '#FFC107',
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
    borderLeftColor: '#FFC107',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFC107',
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
});
