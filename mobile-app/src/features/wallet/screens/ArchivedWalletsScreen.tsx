// Archived Wallets Screen
// View and restore archived sub-wallets

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Text,
  IconButton,
  Button,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { getGradientColors, getPrimaryTextColor, getSecondaryTextColor, BRAND_COLOR } from '../../../utils/theme-helpers';
import { useWallet } from '../../../hooks/useWallet';
import type { SubWalletEntry } from '../types';

export function ArchivedWalletsScreen(): React.JSX.Element {
  const { themeMode } = useAppTheme();
  const { masterKeys, restoreSubWallet, isLoading } = useWallet();
  const [processing, setProcessing] = useState(false);

  // Theme colors
  const gradientColors = getGradientColors(themeMode);
  const primaryTextColor = getPrimaryTextColor(themeMode);
  const secondaryTextColor = getSecondaryTextColor(themeMode);

  // ========================================
  // Actions
  // ========================================

  const handleRestoreSubWallet = useCallback(
    async (masterKeyId: string, subWalletIndex: number) => {
      try {
        setProcessing(true);
        await restoreSubWallet(masterKeyId, subWalletIndex);
        Alert.alert('Success', 'Sub-wallet restored successfully');
      } catch (err) {
        console.error('❌ [ArchivedWallets] Restore error:', err);
        Alert.alert('Error', 'Failed to restore sub-wallet');
      } finally {
        setProcessing(false);
      }
    },
    [restoreSubWallet]
  );

  // ========================================
  // Renderers
  // ========================================

  const renderArchivedSubWallet = (
    masterKeyId: string,
    masterKeyNickname: string,
    subWallet: SubWalletEntry
  ): React.JSX.Element => (
    <View key={`${masterKeyId}-${subWallet.index}`} style={styles.subWalletRow}>
      <View style={styles.subWalletInfo}>
        <View style={styles.subWalletIcon}>
          <Text style={styles.subWalletIconText}>📦</Text>
        </View>
        <View>
          <Text style={[styles.subWalletName, { color: primaryTextColor }]}>
            {subWallet.nickname}
          </Text>
          <Text style={[styles.subWalletSubtitle, { color: secondaryTextColor }]}>
            From: {masterKeyNickname} • Index: {subWallet.index}
          </Text>
        </View>
      </View>

      <Button
        mode="contained"
        onPress={() => handleRestoreSubWallet(masterKeyId, subWallet.index)}
        style={styles.restoreButton}
        labelStyle={styles.restoreButtonLabel}
        loading={processing}
        disabled={processing}
      >
        Restore
      </Button>
    </View>
  );

  const archivedWallets = masterKeys.flatMap(mk => 
    mk.archivedSubWallets.map(sw => ({ masterKey: mk, subWallet: sw }))
  );

  return (
    <LinearGradient colors={gradientColors} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            iconColor={primaryTextColor}
            size={24}
            onPress={() => router.back()}
          />
          <Text style={[styles.headerTitle, { color: primaryTextColor }]}>Archived Wallets</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {isLoading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color={BRAND_COLOR} />
            </View>
          ) : archivedWallets.length === 0 ? (
            <View style={styles.centerContent}>
              <Text style={styles.emptyIcon}>📂</Text>
              <Text style={[styles.emptyTitle, { color: primaryTextColor }]}>
                No Archived Wallets
              </Text>
              <Text style={[styles.emptyText, { color: secondaryTextColor }]}>
                Sub-wallets you archive from the management page will appear here.
              </Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              <Text style={[styles.sectionDescription, { color: secondaryTextColor }]}>
                These wallets are currently hidden from your main dashboard. You can restore them at any time.
              </Text>
              
              {archivedWallets.map(({ masterKey, subWallet }) => 
                renderArchivedSubWallet(masterKey.id, masterKey.nickname, subWallet)
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {(processing) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={BRAND_COLOR} />
        </View>
      )}
    </LinearGradient>
  );
}

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
  scrollContent: {
    padding: 16,
    flexGrow: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  listContainer: {
    gap: 16,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  subWalletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  subWalletInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  subWalletIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  subWalletIconText: {
    fontSize: 20,
  },
  subWalletName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  subWalletSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  restoreButton: {
    backgroundColor: BRAND_COLOR,
    borderRadius: 8,
  },
  restoreButtonLabel: {
    color: '#1a1a2e',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});
