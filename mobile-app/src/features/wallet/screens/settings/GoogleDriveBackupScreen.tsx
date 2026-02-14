// Google Drive Backup Settings Screen
// Manage encrypted seed phrase backups to Google Drive

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  Text,
  Button,
  IconButton,
  ProgressBar,
} from 'react-native-paper';
import { TextInput } from 'react-native-paper'; // Only for TextInput.Icon
import { StyledTextInput } from '../../../../components/StyledTextInput';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import { useWallet } from '../../../../hooks/useWallet';
import { storageService, settingsService } from '../../../../services';
import { useAppTheme } from '../../../../contexts/ThemeContext';
import { generateMasterKeyNickname } from '../../../../utils/mnemonic';
import { useLanguage } from '../../../../hooks/useLanguage';
import {
  getGradientColors,
  getPrimaryTextColor,
  getSecondaryTextColor,
  BRAND_COLOR,
} from '../../../../utils/theme-helpers';
import {
  googleDriveBackupService,
  type GoogleUser,
  type BackupMetadata,
} from '../../../../services/googleDriveBackupService';
import {
  validatePasswordStrength,
  type PasswordStrength,
} from '../../../../services/backupEncryption';

// =============================================================================
// Component
// =============================================================================

export function GoogleDriveBackupScreen(): React.JSX.Element {
  const { getMnemonic, activeMasterKey, importMasterKey, masterKeys } = useWallet();
  const { themeMode } = useAppTheme();
  const { t } = useLanguage();

  // Get theme colors
  const gradientColors = getGradientColors(themeMode);
  const primaryText = getPrimaryTextColor(themeMode);
  const secondaryText = getSecondaryTextColor(themeMode);

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [userInfo, setUserInfo] = useState<GoogleUser | null>(null);
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [lastBackupTimestamp, setLastBackupTimestamp] = useState<number | null>(null);
  const [localFingerprints, setLocalFingerprints] = useState<Record<string, string>>({});

  // Modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'restore'>('create');
  const [selectedBackup, setSelectedBackup] = useState<BackupMetadata | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Restore flow: PIN setup after decryption
  const [restoredMnemonic, setRestoredMnemonic] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [restorePin, setRestorePin] = useState('');
  const [confirmRestorePin, setConfirmRestorePin] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // ==========================================================================
  // Effects
  // ==========================================================================

  // Initialize service and check connection status
  useEffect(() => {
    initializeService();
  }, []);

  // Update password strength when password changes
  useEffect(() => {
    if (password) {
      setPasswordStrength(validatePasswordStrength(password));
    } else {
      setPasswordStrength(null);
    }
  }, [password]);

  // ==========================================================================
  // Service Initialization
  // ==========================================================================

  const initializeService = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await googleDriveBackupService.initialize();
      const connected = await googleDriveBackupService.isConnected();
      setIsConnected(connected);

      if (connected) {
        const user = await googleDriveBackupService.getUserInfo();
        setUserInfo(user);
        await refreshBackups();
      }
    } catch (error) {
      console.error('Failed to initialize:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshBackups = async (): Promise<void> => {
    try {
      const backupList = await googleDriveBackupService.listBackups();
      setBackups(backupList);
      if (backupList.length > 0) {
        setLastBackupTimestamp(backupList[0].timestamp);
      }

      const keys = masterKeys || [];
      const fingerprintPairs = await Promise.all(
        keys.map(async (key) => {
          const fingerprint = await googleDriveBackupService.getLocalFingerprint(key.id);
          return [key.id, fingerprint] as const;
        })
      );

      const nextLocalFingerprints: Record<string, string> = {};
      for (const [walletId, fingerprint] of fingerprintPairs) {
        if (fingerprint) {
          nextLocalFingerprints[walletId] = fingerprint;
        }
      }
      setLocalFingerprints(nextLocalFingerprints);
    } catch (error) {
      console.warn('⚠️ [GoogleDriveBackupScreen] Failed to refresh backups:', error);
    }
  };

  // ==========================================================================
  // Authentication
  // ==========================================================================

  const handleConnect = async (): Promise<void> => {
    setIsLoading(true);
    try {
      const result = await googleDriveBackupService.signIn();
      if (result.success) {
        setIsConnected(true);
        const user = await googleDriveBackupService.getUserInfo();
        setUserInfo(user);
        await refreshBackups();
      } else {
        Alert.alert(t('common.error'), result.error || 'Failed to connect');
      }
    } catch (error) {
      Alert.alert(t('common.error'), 'Failed to connect to Google Drive');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async (): Promise<void> => {
    Alert.alert(
      t('cloudBackup.disconnectTitle'),
      t('cloudBackup.disconnectMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('cloudBackup.disconnect'),
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await googleDriveBackupService.signOut();
              setIsConnected(false);
              setUserInfo(null);
              setBackups([]);
              setLastBackupTimestamp(null);
            } catch (error) {
              Alert.alert(t('common.error'), 'Failed to disconnect');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // ==========================================================================
  // Biometric Authentication
  // ==========================================================================

  const authenticateUser = async (): Promise<boolean> => {
    try {
      // Check app-level biometric setting first
      const settings = await settingsService.getUserSettings();
      if (!settings.biometricEnabled) {
        return true; // Biometric disabled in app settings, skip
      }

      const biometricAvailable = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (biometricAvailable && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: t('cloudBackup.authenticateToBackup'),
          fallbackLabel: t('settings.usePin'),
        });
        return result.success;
      }
      return true; // No biometric available, allow proceed
    } catch (error) {
      console.warn('[GoogleDriveBackup] Auth error:', error);
      return false;
    }
  };

  // ==========================================================================
  // Backup Operations
  // ==========================================================================

  // Which master key to back up
  const [selectedMasterKeyId, setSelectedMasterKeyId] = useState<string | null>(null);

  const getSelectedMasterKey = () => {
    if (selectedMasterKeyId) {
      return masterKeys.find((k) => k.id === selectedMasterKeyId) || activeMasterKey;
    }
    return activeMasterKey;
  };

  const getWalletBackupById = useCallback((walletId: string): BackupMetadata | undefined => {
    const fingerprint = localFingerprints[walletId];
    if (!fingerprint) return undefined;
    return backups.find((backup) => backup.seedFingerprint === fingerprint);
  }, [backups, localFingerprints]);

  const handleCreateBackup = async (masterKeyId?: string): Promise<void> => {
    const keys = masterKeys || [];
    const targetId = masterKeyId || activeMasterKey?.id;

    if (!targetId) {
      Alert.alert(t('common.error'), 'No wallet found');
      return;
    }

    // If multiple wallets and no specific one chosen, let user pick
    if (!masterKeyId && keys.length > 1) {
      Alert.alert(
        'Select Wallet to Back Up',
        'Which wallet do you want to back up?',
        [
          ...keys.map((key) => ({
            text: key.nickname || key.id.substring(0, 8),
            onPress: () => handleCreateBackup(key.id),
          })),
          { text: t('common.cancel'), style: 'cancel' as const },
        ]
      );
      return;
    }

    setSelectedMasterKeyId(targetId);

    // Authenticate first
    const authenticated = await authenticateUser();
    if (!authenticated) {
      return;
    }

    // Show password modal
    setModalMode('create');
    setPassword('');
    setConfirmPassword('');
    setShowPasswordModal(true);
  };

  const handleConfirmCreateBackup = async (): Promise<void> => {
    const targetKey = getSelectedMasterKey();
    if (!targetKey) return;

    // Validate password
    if (!passwordStrength?.isValid) {
      Alert.alert(t('common.error'), t('cloudBackup.passwordTooWeak'));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), t('cloudBackup.passwordMismatch'));
      return;
    }

    setIsProcessing(true);
    try {
      // Get the MASTER KEY mnemonic (the original 12-word seed phrase).
      // This is intentional: we only back up the master seed, NOT individual sub-wallet
      // mnemonics. Sub-wallets are derived from the master seed using BIP-85, so
      // restoring the master seed allows regenerating all sub-wallets.
      const pin = await storageService.getBiometricPin(targetKey.id);
      if (!pin) {
        Alert.alert(t('common.error'), 'PIN not available');
        return;
      }

      const mnemonic = await getMnemonic(targetKey.id, pin);
      if (!mnemonic) {
        Alert.alert(t('common.error'), 'Could not retrieve seed phrase');
        return;
      }

      // Create backup with the master seed phrase
      const result = await googleDriveBackupService.createBackup(
        mnemonic,
        password,
        targetKey.id,
        targetKey.nickname
      );

      if (result.success) {
        Alert.alert(t('common.success'), t('cloudBackup.backupCreated'));
        setShowPasswordModal(false);
        setPassword('');
        setConfirmPassword('');

        const mnemonicFingerprint = await googleDriveBackupService.getSeedFingerprint(mnemonic);
        await googleDriveBackupService.saveLocalFingerprint(targetKey.id, mnemonicFingerprint);

        await refreshBackups();
      } else {
        Alert.alert(t('common.error'), result.error || 'Failed to create backup');
      }
    } catch (error) {
      console.warn('⚠️ [GoogleDriveBackupScreen] Failed to create backup:', error);
      Alert.alert(t('common.error'), 'Failed to create backup');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreBackup = (backup: BackupMetadata): void => {
    setSelectedBackup(backup);
    setModalMode('restore');
    setPassword('');
    setShowPasswordModal(true);
  };

  const handleConfirmRestore = async (): Promise<void> => {
    if (!selectedBackup) return;

    setIsProcessing(true);
    try {
      const result = await googleDriveBackupService.restoreBackup(
        selectedBackup.id,
        password
      );

      if (result.success && result.mnemonic) {
        setShowPasswordModal(false);
        setPassword('');
        setRestoredMnemonic(result.mnemonic);
        setRestorePin('');
        setConfirmRestorePin('');
        setShowPinModal(true);
      } else {
        Alert.alert(t('common.error'), result.error || 'Failed to restore backup');
      }
    } catch (error) {
      Alert.alert(t('common.error'), 'Failed to restore backup');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = async (): Promise<void> => {
    if (!restoredMnemonic) return;

    if (restorePin.length < 4) {
      Alert.alert(t('common.error'), 'PIN must be at least 4 digits');
      return;
    }

    if (restorePin !== confirmRestorePin) {
      Alert.alert(t('common.error'), 'PINs do not match');
      return;
    }

    setIsImporting(true);
    try {
      const nickname = generateMasterKeyNickname(masterKeys.length + 1);
      console.log('🔄 [Restore] Importing wallet...', { nickname });
      const masterKeyId = await importMasterKey(restoredMnemonic, restorePin, nickname);
      console.log('✅ [Restore] Wallet imported:', masterKeyId);

      setShowPinModal(false);
      setRestoredMnemonic(null);
      setRestorePin('');
      setConfirmRestorePin('');

      Alert.alert(
        t('common.success'),
        'Wallet restored successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to unlock screen to properly initialize the wallet
              router.replace({
                pathname: '/wallet/unlock',
                params: { masterKeyId },
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error('❌ [Restore] Import failed:', error);
      const message = error instanceof Error ? error.message : 'Failed to import wallet';
      Alert.alert(t('common.error'), message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteBackup = (backup: BackupMetadata): void => {
    Alert.alert(
      t('cloudBackup.deleteBackup'),
      t('cloudBackup.deleteConfirmation'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              const result = await googleDriveBackupService.deleteBackup(backup.id);
              if (result.success) {
                await refreshBackups();
              } else {
                Alert.alert(t('common.error'), result.error || 'Failed to delete');
              }
            } catch {
              Alert.alert(t('common.error'), 'Failed to delete backup');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // ==========================================================================
  // Helpers
  // ==========================================================================

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStrengthColor = (score: number): string => {
    const colors = ['#ff4444', '#ff8800', '#ffcc00', '#88cc00', '#00cc44'];
    return colors[score] || colors[0];
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  const activeWalletBackup = activeMasterKey ? getWalletBackupById(activeMasterKey.id) : undefined;

  const getWalletLabel = (walletId: string): string => {
    const wallet = (masterKeys || []).find((key) => key.id === walletId);
    return wallet?.nickname || wallet?.id.substring(0, 8) || walletId.substring(0, 8);
  };

  const renderPasswordModal = (): React.JSX.Element => (
    <Modal
      visible={showPasswordModal}
      transparent
      animationType="slide"
      onRequestClose={() => {
        setShowPasswordModal(false);
        setPassword('');
        setConfirmPassword('');
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: gradientColors[0] }]}>
          <Text style={[styles.modalTitle, { color: primaryText }]}>
            {modalMode === 'create'
              ? t('cloudBackup.enterBackupPassword')
              : t('cloudBackup.enterRestorePassword')}
          </Text>

          {modalMode === 'create' && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <Text style={[styles.warningText, { color: secondaryText }]}>
                {t('cloudBackup.passwordWarning')}
              </Text>
            </View>
          )}

          <StyledTextInput
            label={t('cloudBackup.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            style={styles.input}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword(!showPassword)}
              />
            }
          />

          {modalMode === 'create' && (
            <>
              {passwordStrength && (
                <View style={styles.strengthContainer}>
                  <ProgressBar
                    progress={(passwordStrength.score + 1) / 5}
                    color={getStrengthColor(passwordStrength.score)}
                    style={styles.strengthBar}
                  />
                  <Text
                    style={[
                      styles.strengthLabel,
                      { color: getStrengthColor(passwordStrength.score) },
                    ]}
                  >
                    {t(`cloudBackup.strength.${passwordStrength.label}`)}
                  </Text>
                </View>
              )}

              {passwordStrength && passwordStrength.feedback.length > 0 && (
                <View style={styles.feedbackContainer}>
                  {passwordStrength.feedback.map((feedback, index) => (
                    <Text
                      key={index}
                      style={[styles.feedbackText, { color: secondaryText }]}
                    >
                      • {feedback}
                    </Text>
                  ))}
                </View>
              )}

              <StyledTextInput
                label={t('cloudBackup.confirmPassword')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                style={styles.input}
              />
            </>
          )}

          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => {
                setShowPasswordModal(false);
                setPassword('');
                setConfirmPassword('');
              }}
              style={styles.modalButton}
              textColor={secondaryText}
            >
              {t('common.cancel')}
            </Button>
            <Button
              mode="contained"
              onPress={
                modalMode === 'create'
                  ? handleConfirmCreateBackup
                  : handleConfirmRestore
              }
              loading={isProcessing}
              disabled={
                isProcessing ||
                !password ||
                (modalMode === 'create' && !confirmPassword)
              }
              style={[styles.modalButton, { backgroundColor: BRAND_COLOR }]}
              labelStyle={{ color: '#1a1a2e' }}
            >
              {modalMode === 'create' ? t('cloudBackup.createBackup') : t('cloudBackup.restore')}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderPinModal = (): React.JSX.Element => (
    <Modal
      visible={showPinModal}
      transparent
      animationType="slide"
      onRequestClose={() => {
        setShowPinModal(false);
        setRestoredMnemonic(null);
        setRestorePin('');
        setConfirmRestorePin('');
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: gradientColors[0] }]}>
          <Text style={[styles.modalTitle, { color: primaryText }]}>
            Set a PIN for your wallet
          </Text>

          <Text style={[styles.restoreHint, { color: secondaryText, marginBottom: 16 }]}>
            Choose a PIN to secure your restored wallet.
          </Text>

          <StyledTextInput
            label="Enter PIN"
            value={restorePin}
            onChangeText={setRestorePin}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={6}
            style={styles.input}
          />

          <StyledTextInput
            label="Confirm PIN"
            value={confirmRestorePin}
            onChangeText={setConfirmRestorePin}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={6}
            style={styles.input}
          />

          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => {
                setShowPinModal(false);
                setRestoredMnemonic(null);
                setRestorePin('');
                setConfirmRestorePin('');
              }}
              style={styles.modalButton}
              textColor={secondaryText}
            >
              {t('common.cancel')}
            </Button>
            <Button
              mode="contained"
              onPress={handleConfirmImport}
              loading={isImporting}
              disabled={isImporting || restorePin.length < 4 || !confirmRestorePin}
              style={[styles.modalButton, { backgroundColor: BRAND_COLOR }]}
              labelStyle={{ color: '#1a1a2e' }}
            >
              Restore Wallet
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );

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
          <Text style={[styles.headerTitle, { color: primaryText }]}>
            {t('cloudBackup.title')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            {/* Warning Banner */}
            <View style={styles.securityBanner}>
              <Text style={styles.securityIcon}>🔐</Text>
              <Text style={[styles.securityTitle, { color: primaryText }]}>
                {t('cloudBackup.encryptedBackup')}
              </Text>
              <Text style={[styles.securityText, { color: secondaryText }]}>
                {t('cloudBackup.securityInfo')}
              </Text>
            </View>

            {/* Google Account Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: primaryText }]}>
                {t('cloudBackup.googleAccount')}
              </Text>

              {isLoading ? (
                <ActivityIndicator color={BRAND_COLOR} style={styles.loader} />
              ) : isConnected && userInfo ? (
                <View style={styles.accountRow}>
                  <View style={styles.accountInfo}>
                    <Text style={[styles.accountEmail, { color: primaryText }]}>
                      {userInfo.email}
                    </Text>
                    <Text style={[styles.accountStatus, { color: '#4CAF50' }]}>
                      {t('cloudBackup.connected')}
                    </Text>
                  </View>
                  <Button
                    mode="outlined"
                    onPress={handleDisconnect}
                    textColor="#ff5252"
                    style={styles.disconnectButton}
                  >
                    {t('cloudBackup.disconnect')}
                  </Button>
                </View>
              ) : (
                <Button
                  mode="contained"
                  onPress={handleConnect}
                  icon="google"
                  style={[styles.connectButton, { backgroundColor: BRAND_COLOR }]}
                  labelStyle={{ color: '#1a1a2e' }}
                >
                  {t('cloudBackup.connectGoogle')}
                </Button>
              )}
            </View>

            {/* Backup Actions */}
            {isConnected && (
              <>
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: primaryText }]}>
                    {t('cloudBackup.backupActions')}
                  </Text>

                  {lastBackupTimestamp && (
                    <Text style={[styles.lastBackup, { color: secondaryText }]}>
                      {t('cloudBackup.lastBackup')}: {formatDate(lastBackupTimestamp)}
                    </Text>
                  )}

                  <Button
                    mode="contained"
                    onPress={() => {
                      void handleCreateBackup();
                    }}
                    icon="cloud-upload"
                    style={[styles.actionButton, { backgroundColor: BRAND_COLOR }]}
                    labelStyle={{ color: '#1a1a2e' }}
                  >
                    {activeWalletBackup ? 'Update Backup' : t('cloudBackup.createBackup')}
                  </Button>

                  {(masterKeys || []).map((key) => {
                    const matchedBackup = getWalletBackupById(key.id);
                    return (
                      <View key={key.id} style={styles.walletStatusRow}>
                        <View style={styles.walletStatusInfo}>
                          <Text style={[styles.backupWalletName, { color: primaryText }]}>
                            {key.nickname || key.id.substring(0, 8)}
                          </Text>
                          <Text style={[styles.walletStatusText, { color: matchedBackup ? '#4CAF50' : '#ffb74d' }]}>
                            {matchedBackup
                              ? `✅ Backed up · ${formatDate(matchedBackup.timestamp)}`
                              : '⚠️ Not backed up'}
                          </Text>
                        </View>
                        <Button
                          mode="text"
                          onPress={() => handleCreateBackup(key.id)}
                          compact
                          textColor={BRAND_COLOR}
                        >
                          {matchedBackup ? 'Update Backup' : 'Create Backup'}
                        </Button>
                      </View>
                    );
                  })}
                </View>

                {/* Existing Backups */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: primaryText }]}>
                    {t('cloudBackup.existingBackups')}
                  </Text>

                  {backups.length === 0 ? (
                    <Text style={[styles.noBackups, { color: secondaryText }]}>
                      {t('cloudBackup.noBackups')}
                    </Text>
                  ) : (
                    backups.map((backup) => (
                      <View key={backup.id} style={styles.backupItem}>
                        <View style={styles.backupInfo}>
                          <Text style={[styles.backupWalletName, { color: primaryText }]}>
                            {backup.walletName || 'Unknown Wallet'}
                          </Text>
                          <Text style={[styles.backupDate, { color: secondaryText }]}>
                            {formatDate(backup.timestamp)}
                          </Text>
                          <Text style={[styles.backupWallet, { color: secondaryText }]}>
                            {backup.seedFingerprint
                              ? (() => {
                                const matchedWallet = (masterKeys || []).find((key) => localFingerprints[key.id] === backup.seedFingerprint);
                                return matchedWallet
                                  ? `Wallet: ${getWalletLabel(matchedWallet.id)}`
                                  : 'Wallet: Not linked to local wallet';
                              })()
                              : 'Wallet: Unknown (legacy backup)'}
                          </Text>
                        </View>
                        <View style={styles.backupActions}>
                          <TouchableOpacity
                            onPress={() => handleRestoreBackup(backup)}
                            style={styles.backupActionButton}
                          >
                            <IconButton
                              icon="download"
                              iconColor={BRAND_COLOR}
                              size={20}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteBackup(backup)}
                            style={styles.backupActionButton}
                          >
                            <IconButton
                              icon="delete"
                              iconColor="#ff5252"
                              size={20}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </>
            )}

            {/* Security Tips */}
            <View style={styles.tipsSection}>
              <Text style={[styles.tipsTitle, { color: primaryText }]}>
                {t('cloudBackup.securityTips')}
              </Text>

              <View style={styles.tipItem}>
                <Text style={styles.tipIcon}>✅</Text>
                <Text style={[styles.tipText, { color: secondaryText }]}>
                  {t('cloudBackup.tip1')}
                </Text>
              </View>

              <View style={styles.tipItem}>
                <Text style={styles.tipIcon}>✅</Text>
                <Text style={[styles.tipText, { color: secondaryText }]}>
                  {t('cloudBackup.tip2')}
                </Text>
              </View>

              <View style={styles.tipItem}>
                <Text style={styles.tipIcon}>❌</Text>
                <Text style={[styles.tipText, { color: secondaryText }]}>
                  {t('cloudBackup.tip3')}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {renderPasswordModal()}
        {renderPinModal()}
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
  securityBanner: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  securityIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  securityText: {
    fontSize: 13,
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
    marginBottom: 12,
  },
  loader: {
    paddingVertical: 20,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountInfo: {
    flex: 1,
  },
  accountEmail: {
    fontSize: 14,
    fontWeight: '500',
  },
  accountStatus: {
    fontSize: 12,
    marginTop: 2,
  },
  disconnectButton: {
    borderColor: '#ff5252',
  },
  connectButton: {
    marginTop: 8,
  },
  lastBackup: {
    fontSize: 13,
    marginBottom: 12,
  },
  actionButton: {
    marginTop: 8,
    marginBottom: 8,
  },
  walletStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  walletStatusInfo: {
    flex: 1,
    paddingRight: 8,
  },
  walletStatusText: {
    fontSize: 12,
    marginTop: 2,
  },
  noBackups: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  backupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backupInfo: {
    flex: 1,
  },
  backupWalletName: {
    fontSize: 15,
    fontWeight: '600',
  },
  backupDate: {
    fontSize: 12,
    marginTop: 2,
  },
  backupWallet: {
    fontSize: 12,
    marginTop: 2,
  },
  backupActions: {
    flexDirection: 'row',
  },
  backupActionButton: {
    marginLeft: 4,
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
    lineHeight: 20,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  warningBanner: {
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  input: {
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  strengthContainer: {
    marginBottom: 12,
  },
  strengthBar: {
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
  },
  feedbackContainer: {
    marginBottom: 12,
  },
  feedbackText: {
    fontSize: 12,
    lineHeight: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
  },
  restoreHint: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  doneButton: {
    marginTop: 8,
  },
});
