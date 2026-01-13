// Wallet Management Screen
// Manage master keys and sub-wallets with add, rename, archive, and delete actions

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
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
import { getGradientColors, getPrimaryTextColor, getSecondaryTextColor, getIconColor } from '../../../utils/theme-helpers';
import { useWallet } from '../../../hooks/useWallet';
import { useWalletAuth } from '../../../hooks/useWalletAuth';
import { storageService } from '../../../services';
import type { MasterKeyEntry, SubWalletEntry } from '../types';

// =============================================================================
// Types
// =============================================================================

type ModalType = 'rename' | 'addSubWallet' | 'confirmDelete' | null;

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
    restoreSubWallet,
    deleteMasterKey,
    canAddSubWallet,
    getAddSubWalletDisabledReason,
    syncSubWalletActivity,
  } = useWallet();
  const { selectSubWallet, getSessionPin } = useWalletAuth();

  const { themeMode } = useAppTheme();
  const gradientColors = getGradientColors(themeMode);
  const primaryTextColor = getPrimaryTextColor(themeMode);
  const secondaryTextColor = getSecondaryTextColor(themeMode);
  const iconColor = getIconColor(themeMode);

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
          // Note: This temporarily disconnects and reconnects the SDK
          // Pass sessionPin as restorePin to ensure we can go back to the original active wallet
          await syncSubWalletActivity(masterKey.id, lastSubWallet.index, pin, sessionPin);
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

  const handleRestoreSubWallet = useCallback(
    async (masterKeyId: string, subWalletIndex: number) => {
      try {
        setProcessing(true);
        await restoreSubWallet(masterKeyId, subWalletIndex);
        Alert.alert('Success', 'Sub-wallet restored');
      } catch {
        Alert.alert('Error', 'Failed to restore sub-wallet');
      } finally {
        setProcessing(false);
      }
    },
    [restoreSubWallet]
  );

  // ========================================
  // Delete Master Key
  // ========================================

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
            // Switch to the new active wallet's unlock screen
            router.replace({
              pathname: '/wallet/unlock',
              params: { masterKeyId: nextActiveId, subWalletIndex: '0' },
            });
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
  // Switch Wallet
  // ========================================

  const handleSwitchWallet = useCallback(
    async (masterKeyId: string, subWalletIndex: number) => {
      try {
        setProcessing(true);
        setError(null);

        // For same master key, no PIN needed - use selectSubWallet which reinitializes SDK
        if (masterKeyId === activeMasterKey?.id) {
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
                {masterKey.archivedSubWallets.length > 0 &&
                  ` • ${masterKey.archivedSubWallets.length} archived`}
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
              />
            }
            contentStyle={styles.menuContent}
          >
            <Menu.Item
              onPress={() => {
                setMenuVisible(null);
                setNewName(masterKey.nickname);
                // setSelectedMasterKeyId(masterKey.id); // If we implement renaming later
                // setModalType('rename'); // If we implement renaming later
              }}
              title="Rename (Coming Soon)"
              leadingIcon="pencil"
              disabled
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
              renderSubWallet(masterKey.id, subWallet, false)
            )}

            {/* Archived Sub-Wallets */}
            {masterKey.archivedSubWallets.length > 0 && (
              <View style={styles.archivedSection}>
                <Text style={[styles.archivedLabel, { color: secondaryTextColor }]}>Archived</Text>
                {masterKey.archivedSubWallets.map((subWallet) =>
                  renderSubWallet(masterKey.id, subWallet, true)
                )}
              </View>
            )}

            {/* Add Sub-Wallet Button */}
            <TouchableOpacity
              style={[
                styles.addSubWalletButton,
                !canAddSub && styles.addSubWalletButtonDisabled,
              ]}
              onPress={() => {
                if (canAddSub) {
                  setSelectedMasterKeyId(masterKey.id);
                  // Calculate next sub-wallet index for default name
                  // Main wallet is index 0. First sub-wallet should be index 1 and named "Sub-Wallet 1"
                  const nextIndex = masterKey.subWallets.length;
                  setNewName(`Sub-Wallet ${nextIndex}`);
                  setModalType('addSubWallet');
                }
              }}
              disabled={!canAddSub}
            >
              <IconButton
                icon="plus"
                iconColor={canAddSub ? '#FFC107' : 'rgba(255, 255, 255, 0.3)'}
                size={20}
              />
              <View>
                <Text
                  style={[
                    styles.addSubWalletText,
                    !canAddSub && styles.addSubWalletTextDisabled,
                  ]}
                >
                  Add Sub-Wallet
                </Text>
                {!canAddSub && (
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
    subWallet: SubWalletEntry,
    isArchived: boolean
  ): React.JSX.Element => {
    const isActive =
      !isArchived &&
      masterKeyId === activeMasterKey?.id &&
      subWallet.index === activeSubWallet?.index;

    return (
      <TouchableOpacity
        key={`${masterKeyId}-${subWallet.index}`}
        style={[
          styles.subWalletRow,
          isActive && styles.subWalletRowActive,
          isArchived && styles.subWalletRowArchived,
        ]}
        onPress={() =>
          !isArchived && handleSwitchWallet(masterKeyId, subWallet.index)
        }
        disabled={isArchived}
      >
        <View style={styles.subWalletInfo}>
          <View
            style={[
              styles.subWalletIcon,
              isArchived && styles.subWalletIconArchived,
            ]}
          >
            <Text style={styles.subWalletIconText}>
              {isArchived ? '📦' : subWallet.index === 0 ? '💰' : '👝'}
            </Text>
          </View>
          <View>
            <Text
              style={[
                styles.subWalletName,
                { color: primaryTextColor },
                isArchived && styles.subWalletNameArchived,
              ]}
            >
              {subWallet.nickname}
            </Text>
            <Text style={[styles.subWalletIndex, { color: secondaryTextColor }]}>
              Index: {subWallet.index}
              {subWallet.hasActivity === true && ' • Has activity'}
              {subWallet.hasActivity === false && ' • No activity'}
            </Text>
          </View>
        </View>

        {isActive && (
          <View style={styles.activeIndicator}>
            <Text style={[styles.activeIndicatorText, { color: primaryTextColor }]}>Active</Text>
          </View>
        )}

        {/* Sub-wallet actions */}
        {!isActive && !isArchived && subWallet.index !== 0 && (
          <IconButton
            icon="archive"
            iconColor={secondaryTextColor}
            size={18}
            onPress={() => handleArchiveSubWallet(masterKeyId, subWallet.index)}
          />
        )}

        {isArchived && (
          <Button
            mode="text"
            onPress={() => handleRestoreSubWallet(masterKeyId, subWallet.index)}
            labelStyle={styles.restoreButtonLabel}
            compact
          >
            Restore
          </Button>
        )}
      </TouchableOpacity>
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
          style={styles.dialog}
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

            <TextInput
              style={[styles.pinInputField, { color: primaryTextColor }]}
              value={pinInput}
              onChangeText={setPinInput}
              placeholder="Enter PIN to confirm"
              placeholderTextColor={secondaryTextColor}
              secureTextEntry
              keyboardType="numeric"
              maxLength={6}
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
          style={styles.dialog}
        >
          <Dialog.Title style={[styles.dialogTitle, { color: primaryTextColor }]}>Name Your Sub-Wallet</Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.dialogText, { color: secondaryTextColor }]}>
              Choose a name for your new sub-wallet.
            </Text>

            <TextInput
              style={[styles.nameInputField, { color: primaryTextColor }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Sub-Wallet name"
              placeholderTextColor={secondaryTextColor}
              autoFocus
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
  // Render
  // ========================================

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
            iconColor={iconColor}
            size={24}
            onPress={() => router.back()}
          />
          <Text style={[styles.headerTitle, { color: primaryTextColor }]}>Manage Wallets</Text>
          <IconButton
            icon="plus"
            iconColor="#FFC107"
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
            <ActivityIndicator size="large" color="#FFC107" />
          </View>
        )}

        {/* Modals */}
        {renderDeleteModal()}
        {renderAddSubWalletModal()}
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
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  masterKeyIconActive: {
    borderWidth: 2,
    borderColor: '#FFC107',
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
    paddingHorizontal: 16,
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
    color: '#FFC107',
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
    color: '#FFC107',
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
    backgroundColor: '#1a1a2e',
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  cancelButtonLabel: {
  },
  deleteButtonLabel: {
    color: '#F44336',
  },
  nameInputField: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginTop: 8,
  },
  primaryButtonLabel: {
    color: '#FFC107',
  },
});
