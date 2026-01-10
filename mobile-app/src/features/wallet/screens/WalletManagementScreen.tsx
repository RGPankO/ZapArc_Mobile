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
import { useWallet } from '../../../hooks/useWallet';
import { useWalletAuth } from '../../../hooks/useWalletAuth';
import type { MasterKeyEntry, SubWalletEntry } from '../types';

// =============================================================================
// Types
// =============================================================================

type ModalType = 'rename' | 'addSubWallet' | 'confirmDelete' | null;

interface RenameTarget {
  type: 'master' | 'subWallet';
  masterKeyId: string;
  subWalletIndex?: number;
  currentName: string;
}

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
    isLoading,
  } = useWallet();
  const { activeWalletInfo, verifyPin, selectSubWallet } = useWalletAuth();

  // State
  const [expandedMasterKeys, setExpandedMasterKeys] = useState<Set<string>>(
    new Set([activeMasterKey?.id || ''])
  );
  const [modalType, setModalType] = useState<ModalType>(null);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
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
            onPress: async () => {
              try {
                setProcessing(true);
                await archiveSubWallet(masterKeyId, subWalletIndex);
              } catch (err) {
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
      } catch (err) {
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
      .then(() => {
        setModalType(null);
        setDeleteTarget(null);
        setPinInput('');
        Alert.alert('Success', 'Wallet deleted successfully');
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
              <Text style={styles.masterKeyName}>{masterKey.nickname}</Text>
              <Text style={styles.masterKeySubtitle}>
                {masterKey.subWallets.length} sub-wallet
                {masterKey.subWallets.length !== 1 ? 's' : ''}
                {masterKey.archivedSubWallets.length > 0 &&
                  ` • ${masterKey.archivedSubWallets.length} archived`}
              </Text>
            </View>
            <IconButton
              icon={isExpanded ? 'chevron-up' : 'chevron-down'}
              iconColor="rgba(255, 255, 255, 0.5)"
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
                iconColor="rgba(255, 255, 255, 0.6)"
                size={20}
                onPress={() => setMenuVisible(masterKey.id)}
              />
            }
            contentStyle={styles.menuContent}
          >
            <Menu.Item
              onPress={() => {
                setMenuVisible(null);
                setRenameTarget({
                  type: 'master',
                  masterKeyId: masterKey.id,
                  currentName: masterKey.nickname,
                });
                setNewName(masterKey.nickname);
                setModalType('rename');
              }}
              title="Rename"
              leadingIcon="pencil"
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
                <Text style={styles.archivedLabel}>Archived</Text>
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
                  const nextIndex = masterKey.subWallets.length;
                  setNewName(`Sub-Wallet ${nextIndex + 1}`);
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
                  <Text style={styles.addSubWalletHint}>
                    Last sub-wallet needs transaction history
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
                isArchived && styles.subWalletNameArchived,
              ]}
            >
              {subWallet.nickname}
            </Text>
            <Text style={styles.subWalletIndex}>
              Index: {subWallet.index}
              {subWallet.hasActivity === true && ' • Has activity'}
              {subWallet.hasActivity === false && ' • No activity'}
            </Text>
          </View>
        </View>

        {isActive && (
          <View style={styles.activeIndicator}>
            <Text style={styles.activeIndicatorText}>Active</Text>
          </View>
        )}

        {/* Sub-wallet actions */}
        {!isActive && !isArchived && subWallet.index !== 0 && (
          <IconButton
            icon="archive"
            iconColor="rgba(255, 255, 255, 0.4)"
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
          <Dialog.Title style={styles.dialogTitle}>Delete Wallet</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogWarning}>
              ⚠️ This action cannot be undone!
            </Text>
            <Text style={styles.dialogText}>
              You are about to delete "{targetWallet?.nickname}". Make sure you
              have backed up your recovery phrase.
            </Text>

            {error && <Text style={styles.dialogError}>{error}</Text>}

            <TextInput
              style={styles.pinInputField}
              value={pinInput}
              onChangeText={setPinInput}
              placeholder="Enter PIN to confirm"
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
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
              labelStyle={styles.cancelButtonLabel}
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
          <Dialog.Title style={styles.dialogTitle}>Name Your Sub-Wallet</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>
              Choose a name for your new sub-wallet.
            </Text>

            <TextInput
              style={styles.nameInputField}
              value={newName}
              onChangeText={setNewName}
              placeholder="Sub-Wallet name"
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
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
              labelStyle={styles.cancelButtonLabel}
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
          <Text style={styles.headerTitle}>Manage Wallets</Text>
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    marginBottom: 2,
  },
  masterKeySubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
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
    color: '#FFFFFF',
  },
  subWalletNameArchived: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  subWalletIndex: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
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
    color: '#FFFFFF',
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
    color: 'rgba(255, 255, 255, 0.4)',
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
    color: 'rgba(255, 255, 255, 0.3)',
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
    color: '#FFFFFF',
  },
  dialogWarning: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  dialogText: {
    color: 'rgba(255, 255, 255, 0.7)',
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
    color: '#FFFFFF',
    fontSize: 16,
  },
  cancelButtonLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  deleteButtonLabel: {
    color: '#F44336',
  },
  nameInputField: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 8,
  },
  primaryButtonLabel: {
    color: '#FFC107',
  },
});
