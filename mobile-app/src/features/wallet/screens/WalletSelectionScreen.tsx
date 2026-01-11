// Wallet Selection Screen
// Hierarchical wallet list with master keys and sub-wallets

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Text, IconButton, Button, useTheme, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { getGradientColors, getPrimaryTextColor, getSecondaryTextColor, getIconColor } from '../../../utils/theme-helpers';
import { useWallet } from '../../../hooks/useWallet';
import { useWalletAuth } from '../../../hooks/useWalletAuth';
import type { MasterKeyEntry, SubWalletEntry } from '../types';

// =============================================================================
// Component
// =============================================================================

export function WalletSelectionScreen(): React.JSX.Element {
  const { themeMode } = useAppTheme();
  const gradientColors = getGradientColors(themeMode);
  const primaryTextColor = getPrimaryTextColor(themeMode);
  const secondaryTextColor = getSecondaryTextColor(themeMode);
  const iconColor = getIconColor(themeMode);

  const { masterKeys, activeWalletInfo } = useWallet();
  const { selectWallet, selectSubWallet, currentMasterKeyId } = useWalletAuth();

  // State
  const [expandedMasterKeys, setExpandedMasterKeys] = useState<Set<string>>(
    new Set([currentMasterKeyId || ''])
  );
  const [pinInput, setPinInput] = useState('');
  const [selectedMasterKey, setSelectedMasterKey] = useState<string | null>(null);
  const [selectedSubWalletIndex, setSelectedSubWalletIndex] = useState<number | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // ========================================
  // Toggle Master Key Expansion
  // ========================================

  const toggleExpansion = useCallback((masterKeyId: string) => {
    setExpandedMasterKeys((prev) => {
      const next = new Set(prev);
      if (next.has(masterKeyId)) {
        next.delete(masterKeyId);
      } else {
        next.add(masterKeyId);
      }
      return next;
    });
  }, []);

  // ========================================
  // Wallet Selection
  // ========================================

  const handleSelectWallet = useCallback(
    async (masterKeyId: string, subWalletIndex: number) => {
      // Check if this is a different master key that requires PIN
      if (masterKeyId !== currentMasterKeyId) {
        setSelectedMasterKey(masterKeyId);
        setSelectedSubWalletIndex(subWalletIndex);
        setShowPinModal(true);
        return;
      }

      // Same master key - use selectSubWallet which will reinitialize SDK
      try {
        setIsLoading(true);
        const success = await selectSubWallet(subWalletIndex);

        if (success) {
          router.replace('/wallet/home');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to select wallet');
      } finally {
        setIsLoading(false);
      }
    },
    [currentMasterKeyId, selectSubWallet]
  );

  const handlePinSubmit = useCallback(async () => {
    if (!selectedMasterKey || selectedSubWalletIndex === null) return;

    try {
      setIsLoading(true);
      setError(null);

      const success = await selectWallet(
        selectedMasterKey,
        selectedSubWalletIndex,
        pinInput
      );

      if (success) {
        setShowPinModal(false);
        router.replace('/wallet/home');
      } else {
        setError('Incorrect PIN');
        setPinInput('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select wallet');
      setPinInput('');
    } finally {
      setIsLoading(false);
    }
  }, [selectedMasterKey, selectedSubWalletIndex, pinInput, selectWallet]);

  // ========================================
  // Render Master Key
  // ========================================

  const renderMasterKey = ({ item: masterKey }: { item: MasterKeyEntry }) => {
    const isExpanded = expandedMasterKeys.has(masterKey.id);
    const isActive = masterKey.id === currentMasterKeyId;

    return (
      <View style={styles.masterKeyContainer}>
        {/* Master Key Header */}
        <TouchableOpacity
          style={[
            styles.masterKeyHeader,
            isActive && styles.masterKeyHeaderActive,
          ]}
          onPress={() => toggleExpansion(masterKey.id)}
          activeOpacity={0.7}
        >
          <View style={styles.masterKeyInfo}>
            <View style={styles.masterKeyIcon}>
              <Text style={styles.masterKeyIconText}>🔑</Text>
            </View>
            <View style={styles.masterKeyTextContainer}>
              <Text style={[styles.masterKeyName, { color: primaryTextColor }]}>{masterKey.nickname}</Text>
              <Text style={[styles.masterKeySubtitle, { color: secondaryTextColor }]}>
                {masterKey.subWallets.length} sub-wallet
                {masterKey.subWallets.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          <IconButton
            icon={isExpanded ? 'chevron-up' : 'chevron-down'}
            iconColor={iconColor}
            size={24}
          />
        </TouchableOpacity>

        {/* Expanded Sub-Wallets */}
        {isExpanded && (
          <View style={styles.subWalletsContainer}>
            {masterKey.subWallets.map((subWallet) => (
              <TouchableOpacity
                key={`${masterKey.id}-${subWallet.index}`}
                style={[
                  styles.subWalletRow,
                  isActive &&
                    activeWalletInfo?.subWalletIndex === subWallet.index &&
                    styles.subWalletRowActive,
                ]}
                onPress={() => handleSelectWallet(masterKey.id, subWallet.index)}
                activeOpacity={0.7}
              >
                <View style={styles.subWalletInfo}>
                  <View style={styles.subWalletIcon}>
                    <Text style={styles.subWalletIconText}>
                      {subWallet.index === 0 ? '💰' : '👝'}
                    </Text>
                  </View>
                  <View>
                    <Text style={[styles.subWalletName, { color: primaryTextColor }]}>{subWallet.nickname}</Text>
                    <Text style={[styles.subWalletIndex, { color: secondaryTextColor }]}>
                      Index: {subWallet.index}
                    </Text>
                  </View>
                </View>

                {isActive &&
                  activeWalletInfo?.subWalletIndex === subWallet.index && (
                    <View style={styles.activeIndicator}>
                      <Text style={styles.activeIndicatorText}>Active</Text>
                    </View>
                  )}
              </TouchableOpacity>
            ))}

            {/* Add Sub-Wallet Button */}
            {masterKey.canCreateSubWallets && (
              <TouchableOpacity
                style={styles.addSubWalletButton}
                onPress={() => {
                  // TODO: Navigate to add sub-wallet flow
                  console.log('Add sub-wallet for', masterKey.id);
                }}
              >
                <IconButton
                  icon="plus"
                  iconColor="#FFC107"
                  size={20}
                />
                <Text style={styles.addSubWalletText}>Add Sub-Wallet</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  // ========================================
  // PIN Modal
  // ========================================

  const renderPinModal = () => {
    if (!showPinModal) return null;

    const masterKey = masterKeys.find((mk) => mk.id === selectedMasterKey);

    return (
      <View style={styles.pinModalOverlay}>
        <View style={styles.pinModalContent}>
          <Text style={[styles.pinModalTitle, { color: primaryTextColor }]}>Enter PIN</Text>
          <Text style={[styles.pinModalSubtitle, { color: secondaryTextColor }]}>
            Unlock {masterKey?.nickname || 'wallet'}
          </Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.pinInputContainer}>
            {/* Simple PIN input for demo - use proper PIN component in production */}
            <View style={styles.pinDotsContainer}>
              {Array(6)
                .fill(0)
                .map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.pinDot,
                      i < pinInput.length && styles.pinDotFilled,
                    ]}
                  />
                ))}
            </View>

            {/* Simple keypad */}
            <View style={styles.miniKeypad}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '←'].map(
                (key, i) => (
                  <TouchableOpacity
                    key={`keypad-${i}-${key}`}
                    style={[styles.miniKeypadKey, key === '' && styles.miniKeypadKeyEmpty]}
                    onPress={() => {
                      if (key === '←') {
                        setPinInput((p) => p.slice(0, -1));
                      } else if (key && pinInput.length < 6) {
                        setPinInput((p) => p + key);
                      }
                    }}
                    disabled={key === ''}
                  >
                    <Text style={[styles.miniKeypadKeyText, { color: primaryTextColor }]}>{key}</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          </View>

          <View style={styles.pinModalButtons}>
            <Button
              mode="outlined"
              onPress={() => {
                setShowPinModal(false);
                setPinInput('');
                setError(null);
              }}
              style={styles.cancelPinButton}
              labelStyle={[styles.cancelPinButtonLabel, { color: secondaryTextColor }]}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handlePinSubmit}
              disabled={pinInput.length < 6 || isLoading}
              loading={isLoading}
              style={styles.confirmPinButton}
              labelStyle={styles.confirmPinButtonLabel}
            >
              Unlock
            </Button>
          </View>
        </View>
      </View>
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconButton icon="arrow-left" iconColor={primaryTextColor} size={24} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: primaryTextColor }]}>Select Wallet</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Wallet List */}
        {masterKeys.length > 0 ? (
          <FlatList
            data={masterKeys}
            keyExtractor={(item) => item.id}
            renderItem={renderMasterKey}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📭</Text>
            <Text style={[styles.emptyStateText, { color: secondaryTextColor }]}>No wallets found</Text>
            <Button
              mode="contained"
              onPress={() => router.push('/wallet/welcome')}
              style={styles.createWalletButton}
            >
              Create Wallet
            </Button>
          </View>
        )}

        {/* PIN Modal */}
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
  backButton: {
    marginRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 48,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  separator: {
    height: 12,
  },
  masterKeyContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  masterKeyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  masterKeyHeaderActive: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#FFC107',
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
  masterKeyIconText: {
    fontSize: 20,
  },
  masterKeyTextContainer: {
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
  subWalletsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  subWalletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginLeft: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 8,
  },
  subWalletRowActive: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  subWalletInfo: {
    flexDirection: 'row',
    alignItems: 'center',
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
  subWalletIconText: {
    fontSize: 16,
  },
  subWalletName: {
    fontSize: 14,
    fontWeight: '500',
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
    color: '#FFFFFF',
  },
  addSubWalletButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 32,
    padding: 8,
    marginTop: 4,
  },
  addSubWalletText: {
    color: '#FFC107',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 18,
    marginBottom: 24,
  },
  createWalletButton: {
    backgroundColor: '#FFC107',
  },
  pinModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pinModalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 320,
  },
  pinModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  pinModalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorBox: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    textAlign: 'center',
  },
  pinInputContainer: {
    marginBottom: 24,
  },
  pinDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  pinDotFilled: {
    backgroundColor: '#FFC107',
    borderColor: '#FFC107',
  },
  miniKeypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  miniKeypadKey: {
    width: 60,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniKeypadKeyEmpty: {
    backgroundColor: 'transparent',
  },
  miniKeypadKeyText: {
    fontSize: 20,
    fontWeight: '500',
  },
  pinModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelPinButton: {
    flex: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cancelPinButtonLabel: {
  },
  confirmPinButton: {
    flex: 1,
    backgroundColor: '#FFC107',
  },
  confirmPinButtonLabel: {
    color: '#1a1a2e',
  },
});
