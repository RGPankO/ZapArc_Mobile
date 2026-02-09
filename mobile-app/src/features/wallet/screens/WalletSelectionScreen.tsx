// Wallet Selection Screen
// Hierarchical wallet list with master keys and sub-wallets

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Text, IconButton, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { getGradientColors, getPrimaryTextColor, getSecondaryTextColor, getIconColor, BRAND_COLOR } from '../../../utils/theme-helpers';
import { useWallet } from '../../../hooks/useWallet';
import { useWalletAuth } from '../../../hooks/useWalletAuth';
import type { MasterKeyEntry } from '../types';

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
  const { currentMasterKeyId } = useWalletAuth();

  // State - expand all master keys by default
  const [expandedMasterKeys, setExpandedMasterKeys] = useState<Set<string>>(new Set());

  // Expand all master keys when they load
  useEffect(() => {
    if (masterKeys.length > 0) {
      setExpandedMasterKeys(new Set(masterKeys.map((mk) => mk.id)));
    }
  }, [masterKeys]);

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
      // Always require PIN verification when selecting a wallet from this screen.
      // This ensures security because this screen can be accessed from:
      // 1. The PIN screen's "Switch Wallet" button (needs re-auth)
      // 2. Other places where re-auth may be required
      // The isUnlocked state is not reliable for determining if re-auth is needed.
      router.replace({
        pathname: '/wallet/unlock',
        params: { masterKeyId, subWalletIndex: subWalletIndex.toString() },
      });
    },
    []
  );

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
                  iconColor={BRAND_COLOR}
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
          <View style={styles.listWrapper}>
            <FlatList
              data={masterKeys}
              keyExtractor={(item) => item.id}
              renderItem={renderMasterKey}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
            
            {/* Add New Wallet Button - Recovery option for forgotten PIN */}
            <View style={styles.addNewWalletContainer}>
              <TouchableOpacity
                style={styles.addNewWalletButton}
                onPress={() => router.push('/wallet/welcome')}
              >
                <IconButton
                  icon="plus-circle-outline"
                  iconColor={BRAND_COLOR}
                  size={24}
                />
                <Text style={[styles.addNewWalletText, { color: primaryTextColor }]}>
                  Add New Wallet
                </Text>
              </TouchableOpacity>
              <Text style={[styles.addNewWalletHint, { color: secondaryTextColor }]}>
                Forgot your PIN? Create a new wallet to start fresh.
              </Text>

              {/* Restore from Cloud Backup */}
              <TouchableOpacity
                style={styles.cloudRestoreButton}
                onPress={() => router.push('/wallet/settings/google-drive-backup')}
              >
                <IconButton
                  icon="cloud-download"
                  iconColor={secondaryTextColor}
                  size={24}
                />
                <Text style={[styles.cloudRestoreText, { color: secondaryTextColor }]}>
                  Restore from Cloud Backup
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
    borderLeftColor: BRAND_COLOR,
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
    color: BRAND_COLOR,
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
    backgroundColor: BRAND_COLOR,
  },
  listWrapper: {
    flex: 1,
  },
  addNewWalletContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  addNewWalletButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)',
  },
  addNewWalletText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: -4,
  },
  addNewWalletHint: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  cloudRestoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 16,
  },
  cloudRestoreText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: -4,
  },
});
