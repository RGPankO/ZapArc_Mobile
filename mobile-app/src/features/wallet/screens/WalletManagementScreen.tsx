// Wallet Management Screen
// Manage master keys and sub-wallets with add, rename, archive, and delete actions

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
  Keyboard,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Clipboard from 'expo-clipboard';
import { StyledTextInput } from '../../../components';
import {
  Text,
  IconButton,
  Button,
  Menu,
  Portal,
  Dialog,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { getGradientColors, getPrimaryTextColor, getSecondaryTextColor, getIconColor, BRAND_COLOR } from '../../../utils/theme-helpers';
import { useWallet } from '../../../hooks/useWallet';
import { useWalletAuth } from '../../../hooks/useWalletAuth';
import { storageService } from '../../../services';
import { settingsService } from '../../../services/settingsService';
import type { MasterKeyEntry, SubWalletEntry } from '../types';

// =============================================================================
// Types
// =============================================================================

type ModalType = 'rename' | 'addSubWallet' | 'confirmDelete' | 'revealPhrase' | null;

// =============================================================================
// Component
// =============================================================================

export function WalletManagementScreen(): React.JSX.Element {
  const {
    masterKeys,
    activeMasterKey,
    activeSubWallet,
    addSubWallet,
    archiveSubWallet,
    deleteMasterKey,
    renameMasterKey,
    renameSubWallet,
    canAddSubWallet,
    getAddSubWalletDisabledReason,
    syncSubWalletActivity,
    getMnemonic,
  } = useWallet();
  const { selectSubWallet, getSessionPin } = useWalletAuth();

  const { themeMode } = useAppTheme();
  const gradientColors = getGradientColors(themeMode);
  const primaryTextColor = getPrimaryTextColor(themeMode);
  const secondaryTextColor = getSecondaryTextColor(themeMode);
  const iconColor = getIconColor(themeMode);
  const dialogBackgroundColor = themeMode === 'dark' ? '#1a1a2e' : '#FFFFFF';

  // State
  const [expandedMasterKeys, setExpandedMasterKeys] = useState<Set<string>>(
    new Set([activeMasterKey?.id || ''])
  );
  const [modalType, setModalType] = useState<ModalType>(null);
  const [newName, setNewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [selectedMasterKeyId, setSelectedMasterKeyId] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [renameSubWalletIndex, setRenameSubWalletIndex] = useState<number | null>(null);
  const [syncingMasterKeys, setSyncingMasterKeys] = useState<Set<string>>(new Set());

  // Reveal Phrase State
  const [revealMnemonic, setRevealMnemonic] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);

  // Keep active master key always expanded
  useEffect(() => {
    if (activeMasterKey?.id) {
      setExpandedMasterKeys((prev) => {
        if (prev.has(activeMasterKey.id)) return prev;
        const next = new Set(prev);
        next.add(activeMasterKey.id);
        return next;
      });
    }
  }, [activeMasterKey?.id]);

  // ========================================
  // Toggle Expansion
  // ========================================

  const toggleExpansion = useCallback((masterKeyId: string) => {
    // Don't allow collapsing the active master key
    if (masterKeyId === activeMasterKey?.id) {
      return;
    }
    
    setExpandedMasterKeys((prev) => {
      const next = new Set(prev);
      if (next.has(masterKeyId)) {
        next.delete(masterKeyId);
      } else {
        next.add(masterKeyId);
      }
      return next;
    });
  }, [activeMasterKey?.id]);

  // ========================================
  // Background Activity Sync
  // ========================================

  useEffect(() => {
    const syncActivities = async (): Promise<void> => {
      const sessionPin = getSessionPin();
      
      for (const masterKey of masterKeys) {
        const subWallets = masterKey.subWallets;
        if (subWallets.length === 0) continue;
        
        const lastSubWallet = subWallets[subWallets.length - 1];
        
        // If we already know it has activity, skip
        if (lastSubWallet.hasActivity === true) continue;

        // Try to get PIN for this master key
        let pin: string | null = null;
        if (masterKey.id === activeMasterKey?.id) {
          pin = sessionPin;
        } else {
          // Try biometric (will be silent if already authorized in current session's keystore)
          try {
            pin = await storageService.getBiometricPin(masterKey.id);
          } catch {
            // Silently fail if biometric not available
          }
        }

        if (pin) {
          console.log(`🔄 [WalletManagement] Background syncing activity for ${masterKey.nickname}...`);
          
          // Mark as syncing
          setSyncingMasterKeys(prev => new Set(prev).add(masterKey.id));
          
          try {
            // Note: This temporarily disconnects and reconnects the SDK
            // Pass sessionPin as restorePin to ensure we can go back to the original active wallet
            await syncSubWalletActivity(masterKey.id, lastSubWallet.index, pin, sessionPin);
          } finally {
            // Remove from syncing set
            setSyncingMasterKeys(prev => {
              const next = new Set(prev);
              next.delete(masterKey.id);
              return next;
            });
          }
        }
      }
    };

    // Run when masterKeys are loaded or changed
    if (masterKeys.length > 0) {
      syncActivities();
    }
  }, [masterKeys.length, activeMasterKey?.id]);

  // ========================================
  // Add Sub-Wallet
  // ========================================

  const handleAddSubWallet = useCallback(
    async (masterKeyId: string) => {
      try {
        setProcessing(true);
        setError(null);

        const nickname = newName.trim() || undefined;
        await addSubWallet(masterKeyId, nickname);
        setModalType(null);
        setSelectedMasterKeyId(null);
        setNewName('');
        Alert.alert('Success', 'Sub-wallet created successfully');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add sub-wallet';
        Alert.alert('Error', message);
      } finally {
        setProcessing(false);
      }
    },
    [addSubWallet, newName]
  );

  // ========================================
  // Archive/Restore Sub-Wallet
  // ========================================

  const handleArchiveSubWallet = useCallback(
    async (masterKeyId: string, subWalletIndex: number) => {
      Alert.alert(
        'Archive Sub-Wallet',
        'Are you sure you want to archive this sub-wallet? It can be restored later.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Archive',
            style: 'destructive',
            onPress: async (): Promise<void> => {
              try {
                setProcessing(true);
                await archiveSubWallet(masterKeyId, subWalletIndex);
              } catch {
                Alert.alert('Error', 'Failed to archive sub-wallet');
              } finally {
                setProcessing(false);
              }
            },
          },
        ]
      );
    },
    [archiveSubWallet]
  );



  // ========================================
  // Rename Operations
  // ========================================

  const handleRename = useCallback(async () => {
    if (!selectedMasterKeyId || !newName.trim()) return;

    try {
      setProcessing(true);
      setError(null);

      if (renameSubWalletIndex !== null) {
        // Renaming sub-wallet
        await renameSubWallet(selectedMasterKeyId, renameSubWalletIndex, newName.trim());
        Alert.alert('Success', 'Sub-wallet renamed successfully');
      } else {
        // Renaming master key
        await renameMasterKey(selectedMasterKeyId, newName.trim());
        Alert.alert('Success', 'Wallet renamed successfully');
      }

      setModalType(null);
      setSelectedMasterKeyId(null);
      setRenameSubWalletIndex(null);
      setNewName('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to rename';
      Alert.alert('Error', message);
    } finally {
      setProcessing(false);
    }
  }, [selectedMasterKeyId, renameSubWalletIndex, newName, renameMasterKey, renameSubWallet]);

  const handleDeleteMasterKey = useCallback(() => {
    if (!deleteTarget || !pinInput) return;

    setProcessing(true);
    setError(null);

    deleteMasterKey(deleteTarget, pinInput)
      .then(({ activeDeleted, nextActiveId }) => {
        setModalType(null);
        setDeleteTarget(null);
        setPinInput('');
        Alert.alert('Success', 'Wallet deleted successfully');

        if (activeDeleted) {
          if (nextActiveId) {
            // Show wallet selection screen to choose another wallet
            router.replace('/wallet/selection');
          } else {
            // No wallets left, go to welcome
            router.replace('/wallet/welcome');
          }
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to delete wallet');
      })
      .finally(() => {
        setProcessing(false);
      });
  }, [deleteTarget, pinInput, deleteMasterKey]);

  // ========================================
  // Reveal Recovery Phrase
  // ========================================

  const handleRevealPhrase = useCallback(async () => {
    if (!selectedMasterKeyId) return;

    setIsRevealing(true);
    setError(null);

    try {
      // Only use biometric if user has it enabled in app settings
      const freshSettings = await settingsService.getUserSettings();
      const biometricEnabled = freshSettings.biometricEnabled ?? false;
      const biometricAvailable = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (biometricEnabled && biometricAvailable && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to view recovery phrase',
          fallbackLabel: 'Use PIN',
        });

        if (!result.success) {
          setIsRevealing(false);
          return;
        }
      }

      // Get PIN from biometric storage
      const pin = await storageService.getBiometricPin(selectedMasterKeyId);
      
      if (!pin) {
        Alert.alert('Error', 'PIN not available. Please unlock wallet with PIN first.');
        setIsRevealing(false);
        setModalType(null);
        setSelectedMasterKeyId(null);
        return;
      }

      // Get the mnemonic
      const phrase = await getMnemonic(selectedMasterKeyId, pin);
      if (phrase) {
        setRevealMnemonic(phrase);
      } else {
        Alert.alert('Error', 'Could not retrieve recovery phrase');
        setModalType(null);
        setSelectedMasterKeyId(null);
      }
    } catch (err) {
      console.error('Failed to reveal mnemonic:', err);
      Alert.alert('Error', 'Failed to authenticate');
      setModalType(null);
      setSelectedMasterKeyId(null);
    } finally {
      setIsRevealing(false);
    }
  }, [selectedMasterKeyId, getMnemonic]);

  const handleCopyMnemonic = useCallback((): void => {
    if (!revealMnemonic) return;

    Alert.alert(
      'Security Warning',
      'Copying your recovery phrase to the clipboard is risky. Only do this in a secure environment. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Copy',
          style: 'destructive',
          onPress: (): void => {
            Clipboard.setString(revealMnemonic);
          },
        },
      ]
    );
  }, [revealMnemonic]);

  const closeRevealModal = useCallback(() => {
    setModalType(null);
    setSelectedMasterKeyId(null);
    setRevealMnemonic(null);
  }, []);

  // ========================================
  // Switch Wallet
  // ========================================

  const handleSwitchWallet = useCallback(
    async (masterKeyId: string, subWalletIndex: number) => {
      try {
        setProcessing(true);
        setError(null);

          // For same master key, no PIN needed - use selectSubWallet which reinitializes SDK
        if (masterKeyId === activeMasterKey?.id) {
          // No need to clear state manually, useWallet hook handles cache loading on active wallet change
          const success = await selectSubWallet(subWalletIndex);
          if (success) {
            router.replace('/wallet/home');
          } else {
            Alert.alert('Error', 'Failed to switch wallet');
          }
        } else {
          // Navigate to unlock with this wallet pre-selected
          router.push({
            pathname: '/wallet/unlock',
            params: { masterKeyId, subWalletIndex: subWalletIndex.toString() },
          });
          return;
        }
      } catch (err) {
        console.error('❌ [WalletManagement] Switch wallet error:', err);
        const message = err instanceof Error ? err.message : 'Failed to switch wallet';
        Alert.alert('Error', message);
        setError(message);
      } finally {
        setProcessing(false);
      }
    },
    [activeMasterKey?.id, selectSubWallet]
  );

  // ========================================
  // Render Master Key
  // ========================================

  const renderMasterKey = (masterKey: MasterKeyEntry): React.JSX.Element => {
    const isExpanded = expandedMasterKeys.has(masterKey.id);
    const isActive = masterKey.id === activeMasterKey?.id;
    const canAddSub = canAddSubWallet(masterKey.id);
    const isSyncing = syncingMasterKeys.has(masterKey.id);

    return (
      <View key={masterKey.id} style={styles.masterKeyContainer}>
        {/* Master Key Header */}
        <View style={styles.masterKeyHeader}>
          <TouchableOpacity
            style={styles.masterKeyInfo}
            onPress={() => toggleExpansion(masterKey.id)}
          >
            <View
              style={[
                styles.masterKeyIcon,
                isActive && styles.masterKeyIconActive,
              ]}
            >
              <Text style={styles.masterKeyIconText}>🔑</Text>
            </View>
            <View style={styles.masterKeyText}>
              <Text style={[styles.masterKeyName, { color: primaryTextColor }]}>{masterKey.nickname}</Text>
              <Text style={[styles.masterKeySubtitle, { color: secondaryTextColor }]}>
                {masterKey.subWallets.length} sub-wallet
                {masterKey.subWallets.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <IconButton
              icon={isExpanded ? 'chevron-up' : 'chevron-down'}
              iconColor={secondaryTextColor}
              size={24}
            />
          </TouchableOpacity>

          {/* Menu */}
          <Menu
            visible={menuVisible === masterKey.id}
            onDismiss={() => setMenuVisible(null)}
            anchor={
              <IconButton
                icon="dots-vertical"
                iconColor={iconColor}
                size={20}
                onPress={() => setMenuVisible(masterKey.id)}
                style={{ margin: 0 }}
              />
            }
            contentStyle={styles.menuContent}
          >
            <Menu.Item
              onPress={() => {
                setMenuVisible(null);
                setNewName(masterKey.nickname);
                setSelectedMasterKeyId(masterKey.id);
                setRenameSubWalletIndex(null);
                setModalType('rename');
              }}
              title="Rename"
              leadingIcon="pencil"
            />
            <Menu.Item
              onPress={() => {
                setMenuVisible(null);
                setSelectedMasterKeyId(masterKey.id);
                setRevealMnemonic(null);
                setModalType('revealPhrase');
              }}
              title="View Recovery Phrase"
              leadingIcon="key"
            />
            <Menu.Item
              onPress={() => {
                setMenuVisible(null);
                setDeleteTarget(masterKey.id);
                setModalType('confirmDelete');
              }}
              title="Delete Wallet"
              leadingIcon="delete"
              titleStyle={styles.deleteMenuItem}
            />
          </Menu>
        </View>

        {/* Expanded Sub-Wallets */}
        {isExpanded && (
          <View style={styles.subWalletsContainer}>
            {/* Active Sub-Wallets */}
            {masterKey.subWallets.map((subWallet) =>
              renderSubWallet(masterKey.id, subWallet)
            )}



            {/* Add Sub-Wallet Button */}
            <TouchableOpacity
              style={[
                styles.addSubWalletButton,
                !canAddSub && !isSyncing && styles.addSubWalletButtonDisabled,
              ]}
              onPress={() => {
                if (canAddSub && !isSyncing) {
                  setSelectedMasterKeyId(masterKey.id);
                  // Calculate next sub-wallet index for default name
                  // Main wallet is index 0. First sub-wallet should be index 1 and named "Sub-Wallet 1"
                  const nextIndex = masterKey.subWallets.length;
                  setNewName(`Sub-Wallet ${nextIndex}`);
                  setModalType('addSubWallet');
                }
              }}
              disabled={!canAddSub || isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color={BRAND_COLOR} style={{ marginHorizontal: 12 }} />
              ) : (
                <IconButton
                  icon="plus"
                  iconColor={canAddSub ? BRAND_COLOR : 'rgba(255, 255, 255, 0.3)'}
                  size={20}
                />
              )}
              <View>
                <Text
                  style={[
                    styles.addSubWalletText,
                    !canAddSub && !isSyncing && styles.addSubWalletTextDisabled,
                  ]}
                >
                  {isSyncing ? 'Checking...' : 'Add Sub-Wallet'}
                </Text>
                {!canAddSub && !isSyncing && (
                  <Text style={[styles.addSubWalletHint, { color: secondaryTextColor }]}>
                    {getAddSubWalletDisabledReason(masterKey.id) || 'Last sub-wallet needs transaction history'}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // ========================================
  // Render Sub-Wallet
  // ========================================

  const renderSubWallet = (
    masterKeyId: string,
    subWallet: SubWalletEntry
  ): React.JSX.Element => {
    const isActive =
      masterKeyId === activeMasterKey?.id &&
      subWallet.index === activeSubWallet?.index;

    const menuKey = `${masterKeyId}-${subWallet.index}-menu`;

    return (
      <View key={`${masterKeyId}-${subWallet.index}`} style={styles.subWalletWrapper}>
        <TouchableOpacity
          style={[
            styles.subWalletRow,
            isActive && styles.subWalletRowActive,
            { flex: 1, marginBottom: 0 }, // Reset margin for wrapper
          ]}
          onPress={() => handleSwitchWallet(masterKeyId, subWallet.index)}
        >
          <View style={styles.subWalletInfo}>
            <View style={styles.subWalletIcon}>
              <Text style={styles.subWalletIconText}>
                {subWallet.index === 0 ? '💰' : '👝'}
              </Text>
            </View>
            <View>
              <Text style={[styles.subWalletName, { color: primaryTextColor }]}>
                {subWallet.nickname}
              </Text>
              <Text style={[styles.subWalletIndex, { color: secondaryTextColor }]}>
                Index: {subWallet.index}
              </Text>
            </View>
          </View>

          {isActive && (
            <View style={styles.activeIndicator}>
              <Text style={[styles.activeIndicatorText, { color: primaryTextColor }]}>Active</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Sub-wallet Actions Menu */}
        <Menu
          visible={menuVisible === menuKey}
          onDismiss={() => setMenuVisible(null)}
          anchor={
            <IconButton
              icon="dots-vertical"
              iconColor={secondaryTextColor}
              size={20}
              onPress={() => setMenuVisible(menuKey)}
              style={{ margin: 0 }}
            />
          }
          contentStyle={styles.menuContent}
        >
          <Menu.Item
            onPress={() => {
              setMenuVisible(null);
              setNewName(subWallet.nickname);
              setSelectedMasterKeyId(masterKeyId);
              setRenameSubWalletIndex(subWallet.index);
              setModalType('rename');
            }}
            title="Rename"
            leadingIcon="pencil"
          />
          <Menu.Item
            onPress={() => {
              setMenuVisible(null);
              setSelectedMasterKeyId(masterKeyId);
              setRevealMnemonic(null);
              setModalType('revealPhrase');
            }}
            title="View Recovery Phrase"
            leadingIcon="key"
          />
          {!isActive && subWallet.index !== 0 && (
            <Menu.Item
              onPress={() => {
                setMenuVisible(null);
                handleArchiveSubWallet(masterKeyId, subWallet.index);
              }}
              title="Archive"
              leadingIcon="archive"
            />
          )}
        </Menu>
      </View>
    );
  };

  // ========================================
  // Render Rename Modal
  // ========================================

  const renderRenameModal = (): React.JSX.Element | null => {
    if (modalType !== 'rename') return null;

    const isSubWallet = renameSubWalletIndex !== null;
    const title = isSubWallet ? 'Rename Sub-Wallet' : 'Rename Wallet';

    return (
      <Portal>
        <Dialog
          visible
          onDismiss={() => {
            setModalType(null);
            setSelectedMasterKeyId(null);
            setRenameSubWalletIndex(null);
            setNewName('');
          }}
          style={[styles.dialog, { backgroundColor: dialogBackgroundColor }]}
        >
          <Dialog.Title style={[styles.dialogTitle, { color: primaryTextColor }]}>
            {title}
          </Dialog.Title>
          <Dialog.Content>
            <StyledTextInput
              style={styles.nameInputField}
              value={newName}
              onChangeText={setNewName}
              label="New Name"
              placeholder="Enter new name"
              autoFocus
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setModalType(null);
                setSelectedMasterKeyId(null);
                setRenameSubWalletIndex(null);
                setNewName('');
              }}
              labelStyle={[styles.cancelButtonLabel, { color: secondaryTextColor }]}
            >
              Cancel
            </Button>
            <Button
              onPress={handleRename}
              disabled={!newName.trim() || processing}
              loading={processing}
              labelStyle={[styles.saveButtonLabel, { color: BRAND_COLOR }]}
            >
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  };

  // ========================================
  // Render Delete Confirmation Modal
  // ========================================

  const renderDeleteModal = (): React.JSX.Element | null => {
    if (modalType !== 'confirmDelete' || !deleteTarget) return null;

    const targetWallet = masterKeys.find((mk) => mk.id === deleteTarget);

    return (
      <Portal>
        <Dialog
          visible
          onDismiss={() => {
            setModalType(null);
            setDeleteTarget(null);
            setPinInput('');
            setError(null);
          }}
          style={[styles.dialog, { backgroundColor: dialogBackgroundColor }]}
        >
          <Dialog.Title style={[styles.dialogTitle, { color: primaryTextColor }]}>Delete Wallet</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogWarning}>
              ⚠️ This action cannot be undone!
            </Text>
            <Text style={[styles.dialogText, { color: secondaryTextColor }]}>
              You are about to delete "{targetWallet?.nickname}". Make sure you
              have backed up your recovery phrase.
            </Text>

            {error && <Text style={styles.dialogError}>{error}</Text>}

            <StyledTextInput
              style={styles.pinInputField}
              value={pinInput}
              onChangeText={(text) => {
                setPinInput(text);
                if (text.length === 6) {
                  Keyboard.dismiss();
                }
              }}
              label="PIN"
              placeholder="Enter PIN to confirm"
              secureTextEntry
              keyboardType="numeric"
              maxLength={6}
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setModalType(null);
                setDeleteTarget(null);
                setPinInput('');
                setError(null);
              }}
              labelStyle={[styles.cancelButtonLabel, { color: secondaryTextColor }]}
            >
              Cancel
            </Button>
            <Button
              onPress={handleDeleteMasterKey}
              disabled={pinInput.length < 6 || processing}
              loading={processing}
              labelStyle={styles.deleteButtonLabel}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  };

  // ========================================
  // Render Add Sub-Wallet Modal
  // ========================================

  const renderAddSubWalletModal = (): React.JSX.Element | null => {
    if (modalType !== 'addSubWallet' || !selectedMasterKeyId) return null;

    return (
      <Portal>
        <Dialog
          visible
          onDismiss={() => {
            setModalType(null);
            setSelectedMasterKeyId(null);
            setNewName('');
          }}
          style={[styles.dialog, { backgroundColor: dialogBackgroundColor }]}
        >
          <Dialog.Title style={[styles.dialogTitle, { color: primaryTextColor }]}>Name Your Sub-Wallet</Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.dialogText, { color: secondaryTextColor }]}>
              Choose a name for your new sub-wallet.
            </Text>

            <StyledTextInput
              style={styles.nameInputField}
              value={newName}
              onChangeText={setNewName}
              label="Sub-Wallet Name"
              placeholder="Sub-Wallet name"
              autoFocus
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setModalType(null);
                setSelectedMasterKeyId(null);
                setNewName('');
              }}
              labelStyle={[styles.cancelButtonLabel, { color: secondaryTextColor }]}
            >
              Cancel
            </Button>
            <Button
              onPress={() => handleAddSubWallet(selectedMasterKeyId)}
              disabled={!newName.trim() || processing}
              loading={processing}
              labelStyle={styles.primaryButtonLabel}
            >
              Create
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  };

  // ========================================
  // Render Reveal Phrase Modal
  // ========================================

  const renderRevealPhraseModal = (): React.JSX.Element | null => {
    if (modalType !== 'revealPhrase' || !selectedMasterKeyId) return null;

    const targetWallet = masterKeys.find((mk) => mk.id === selectedMasterKeyId);
    const words = revealMnemonic?.split(' ') || [];

    return (
      <Portal>
        <Dialog
          visible
          onDismiss={closeRevealModal}
          style={[styles.dialog, styles.revealDialog, { backgroundColor: dialogBackgroundColor }]}
        >
          <Dialog.Title style={[styles.dialogTitle, { color: primaryTextColor }]}>
            Recovery Phrase
          </Dialog.Title>
          <Dialog.ScrollArea style={styles.revealScrollArea}>
            <ScrollView>
              {/* Wallet Info */}
              <Text style={[styles.revealWalletName, { color: secondaryTextColor }]}>
                {targetWallet?.nickname || 'Wallet'}
              </Text>

              {/* Warning Banner - only show when phrase is hidden */}
              {!revealMnemonic && (
                <View style={styles.revealWarning}>
                  <Text style={styles.revealWarningIcon}>⚠️</Text>
                  <Text style={styles.revealWarningText}>
                    Never share your recovery phrase with anyone. Anyone with this phrase can access your funds.
                  </Text>
                </View>
              )}

              {/* Mnemonic Display */}
              {!revealMnemonic ? (
                <View style={styles.revealHiddenContainer}>
                  <View style={styles.revealHiddenPlaceholder}>
                    <Text style={styles.revealHiddenIcon}>🔒</Text>
                    <Text style={[styles.revealHiddenText, { color: secondaryTextColor }]}>
                      Recovery phrase is hidden for security
                    </Text>
                  </View>

                  <Button
                    mode="contained"
                    onPress={handleRevealPhrase}
                    loading={isRevealing}
                    disabled={isRevealing}
                    style={styles.revealButton}
                    labelStyle={styles.revealButtonLabel}
                    icon="eye"
                  >
                    Reveal Recovery Phrase
                  </Button>
                </View>
              ) : (
                <View style={styles.mnemonicContainer}>
                  <View style={styles.mnemonicGrid}>
                    {words.map((word, index) => (
                      <View key={index} style={styles.wordItem}>
                        <Text style={styles.wordNumber}>{index + 1}</Text>
                        <Text style={styles.wordText}>{word}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Actions */}
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
                      <Text style={[styles.mnemonicActionText, { color: secondaryTextColor }]}>Copy</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.mnemonicAction}
                      onPress={() => setRevealMnemonic(null)}
                    >
                      <IconButton
                        icon="eye-off"
                        iconColor="#FF5252"
                        size={20}
                      />
                      <Text style={[styles.mnemonicActionText, { color: secondaryTextColor }]}>Hide</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Security Tips */}
              <View style={styles.revealTips}>
                <Text style={[styles.revealTipsTitle, { color: primaryTextColor }]}>Security Tips</Text>
                <Text style={[styles.revealTipText, { color: secondaryTextColor }]}>✅ Write on paper - never store digitally</Text>
                <Text style={[styles.revealTipText, { color: secondaryTextColor }]}>❌ Never share with anyone</Text>
                <Text style={[styles.revealTipText, { color: secondaryTextColor }]}>❌ Never take a screenshot</Text>
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button
              onPress={closeRevealModal}
              labelStyle={[styles.cancelButtonLabel, { color: secondaryTextColor }]}
            >
              Close
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  };

  // ========================================
  // Render
  // ========================================

  return (
    <LinearGradient
      colors={gradientColors}
      style={styles.gradient}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <SafeAreaView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <IconButton
              icon="arrow-left"
              iconColor={iconColor}
              size={24}
              onPress={() => router.back()}
            />
            <Text style={[styles.headerTitle, { color: primaryTextColor }]}>Manage Wallets</Text>
            <IconButton
              icon="plus"
              iconColor={BRAND_COLOR}
              size={24}
              onPress={() => router.push('/wallet/welcome')}
            />
          </View>

          {/* Wallet List */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            {masterKeys.map(renderMasterKey)}
          </ScrollView>

          {/* Loading Overlay */}
          {processing && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={BRAND_COLOR} />
            </View>
          )}

          {/* Modals */}
          {renderDeleteModal()}
          {renderAddSubWalletModal()}
          {renderRenameModal()}
          {renderRevealPhraseModal()}
        </SafeAreaView>
      </TouchableWithoutFeedback>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  masterKeyContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  masterKeyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  masterKeyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  masterKeyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(247, 147, 26, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  masterKeyIconActive: {
    borderWidth: 2,
    borderColor: BRAND_COLOR,
  },
  masterKeyIconText: {
    fontSize: 20,
  },
  masterKeyText: {
    flex: 1,
  },
  masterKeyName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  masterKeySubtitle: {
    fontSize: 12,
  },
  menuContent: {
    backgroundColor: '#1a1a2e',
  },
  deleteMenuItem: {
    color: '#F44336',
  },
  subWalletsContainer: {
    paddingLeft: 16,
    paddingRight: 12, // Match masterKeyHeader padding for dot alignment
    paddingBottom: 16,
  },
  subWalletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginLeft: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 8,
  },
  subWalletRowActive: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  subWalletRowArchived: {
    opacity: 0.6,
  },
  subWalletWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  subWalletInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  subWalletIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  subWalletIconArchived: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  subWalletIconText: {
    fontSize: 16,
  },
  subWalletName: {
    fontSize: 14,
    fontWeight: '500',
  },
  subWalletNameArchived: {
    opacity: 0.5,
  },
  subWalletIndex: {
    fontSize: 11,
  },
  activeIndicator: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeIndicatorText: {
    fontSize: 11,
    fontWeight: '600',
  },
  restoreButtonLabel: {
    color: BRAND_COLOR,
    fontSize: 12,
  },
  archivedSection: {
    marginTop: 12,
  },
  archivedLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 24,
    textTransform: 'uppercase',
  },
  addSubWalletButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 24,
    padding: 8,
    marginTop: 4,
  },
  addSubWalletButtonDisabled: {
    opacity: 0.5,
  },
  addSubWalletText: {
    color: BRAND_COLOR,
    fontSize: 14,
    fontWeight: '500',
  },
  addSubWalletTextDisabled: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
  addSubWalletHint: {
    fontSize: 11,
    marginTop: 2,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialog: {
    borderRadius: 12,
  },
  dialogTitle: {
  },
  dialogWarning: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  dialogText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  dialogError: {
    color: '#F44336',
    fontSize: 14,
    marginBottom: 12,
  },
  pinInputField: {
    padding: 12,
    fontSize: 16,
  },
  cancelButtonLabel: {
  },
  deleteButtonLabel: {
    color: '#F44336',
  },
  nameInputField: {
    padding: 12,
    fontSize: 16,
    marginTop: 8,
  },
  primaryButtonLabel: {
    color: BRAND_COLOR,
  },
  saveButtonLabel: {
    fontWeight: 'bold',
  },
  // Reveal Phrase Modal Styles
  revealDialog: {
    maxHeight: '90%',
  },
  revealScrollArea: {
    paddingHorizontal: 16,
    maxHeight: 400,
  },
  revealWalletName: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  revealWarning: {
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  revealWarningIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  revealWarningText: {
    fontSize: 12,
    color: BRAND_COLOR,
    textAlign: 'center',
    lineHeight: 18,
  },
  revealHiddenContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  revealHiddenPlaceholder: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  revealHiddenIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  revealHiddenText: {
    fontSize: 14,
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
    padding: 12,
    marginBottom: 16,
  },
  mnemonicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  wordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(247, 147, 26, 0.2)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    width: '48%',
  },
  wordNumber: {
    fontSize: 11,
    fontWeight: 'bold',
    color: BRAND_COLOR,
    marginRight: 6,
    width: 16,
  },
  wordText: {
    fontSize: 13,
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
    fontSize: 13,
  },
  revealTips: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  revealTipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  revealTipText: {
    fontSize: 12,
    marginBottom: 4,
    lineHeight: 18,
  },
});
