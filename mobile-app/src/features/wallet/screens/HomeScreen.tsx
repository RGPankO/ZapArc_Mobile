// Home/Balance Screen
// Main wallet dashboard with balance, recent transactions, and quick actions

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
} from 'react-native';
import { Text, IconButton, ActivityIndicator, Button, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { getGradientColors, getPrimaryTextColor, getSecondaryTextColor, getIconColor } from '../../../utils/theme-helpers';
import { useWallet } from '../../../hooks/useWallet';
import { useWalletAuth } from '../../../hooks/useWalletAuth';
import { useLanguage } from '../../../hooks/useLanguage';
import { useCurrency } from '../../../hooks/useCurrency';
import { onPaymentReceived } from '../../../services/breezSparkService';
import type { Transaction } from '../types';

// =============================================================================
// Types
// =============================================================================

interface QuickActionProps {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
}

// =============================================================================
// Component
// =============================================================================

export function HomeScreen(): React.JSX.Element {
  const {
    balance,
    transactions,
    isLoading,
    isConnected,
    refreshBalance,
    refreshTransactions,
    activeWalletInfo,
  } = useWallet();
  const { lock } = useWalletAuth();
  const { t } = useLanguage();
  const { format, formatTx, refreshSettings } = useCurrency();

  const { themeMode } = useAppTheme();
  const gradientColors = getGradientColors(themeMode);
  const primaryTextColor = getPrimaryTextColor(themeMode);
  const secondaryTextColor = getSecondaryTextColor(themeMode);
  const iconColor = getIconColor(themeMode);

  // State
  const [refreshing, setRefreshing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Currency formatting using the useCurrency hook
  const getFormattedBalance = (sats: number) => {
    return format(sats, { hideBalance: !showBalance });
  };

  // Refresh handler (for manual pull-to-refresh)
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshBalance(), refreshTransactions()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshBalance, refreshTransactions]);

  // Initial load and wallet switch - refresh when connected or when wallet changes
  // Don't show pull-to-refresh spinner here since cached data loads instantly
  useEffect(() => {
    if (isConnected && activeWalletInfo) {
      console.log('🔄 [HomeScreen] Wallet changed or connected, refreshing...', {
        masterKey: activeWalletInfo.masterKeyNickname,
        subWallet: activeWalletInfo.subWalletNickname,
      });
      // Call refresh directly without setting refreshing state
      // This allows cached data to show immediately without spinner
      Promise.all([refreshBalance(), refreshTransactions()]);
    }
  }, [isConnected, activeWalletInfo?.masterKeyId, activeWalletInfo?.subWalletIndex]);

  // Subscribe to payment events for real-time balance updates
  useEffect(() => {
    const unsubscribe = onPaymentReceived((payment) => {
      // Check if this is a sync event or a real payment
      const isSyncEvent = payment.description === '__SYNC_EVENT__';
      
      if (isSyncEvent) {
        console.log('🔄 [HomeScreen] SDK sync event - refreshing...');
      } else {
        console.log('💰 [HomeScreen] Payment received - refreshing...', {
          amount: payment.amountSat,
          type: payment.type,
        });
      }
      
      // Refresh balance and transactions
      refreshBalance();
      refreshTransactions();
    });

    return () => {
      unsubscribe();
    };
  }, [refreshBalance, refreshTransactions]);

  // Refresh transactions and settings when screen comes into focus
  // This ensures the transaction list and currency display updates when returning from other screens
  useFocusEffect(
    useCallback(() => {
      // Always refresh settings when screen comes into focus
      refreshSettings();
      
      if (isConnected && !isLoading) {
        refreshTransactions();
      }
    }, [isConnected, isLoading, refreshTransactions, refreshSettings])
  );

  // Navigation handlers
  const handleSend = (): void => {
    router.push('/wallet/send');
  };

  const handleReceive = (): void => {
    router.push('/wallet/receive');
  };

  const handleScan = (): void => {
    router.push('/wallet/scan');
  };

  const handleCreateTip = (): void => {
    router.push('/wallet/tip/create');
  };

  const handleViewHistory = (): void => {
    router.push('/wallet/history');
  };

  const handleManageWallets = (): void => {
    router.push('/wallet/manage');
  };

  const handleLock = async (): Promise<void> => {
    await lock();
    router.replace('/wallet/unlock');
  };

  const handleSettings = (): void => {
    router.push('/wallet/settings');
  };

  // Render transaction item
  const renderTransaction = (tx: Transaction, index: number): React.JSX.Element => {
    const isReceived = tx.type === 'receive';
    const amount = tx.amount ?? 0;
    const timestamp = typeof tx.timestamp === 'number' && tx.timestamp > 0 ? tx.timestamp : Date.now();
    const date = new Date(timestamp).toLocaleDateString();
    const formattedTx = formatTx(amount, isReceived);

    return (
      <TouchableOpacity
        key={tx.id || index}
        style={styles.transactionItem}
        onPress={() => setSelectedTransaction(tx)}
      >
        <View style={styles.transactionIcon}>
          <Text style={[styles.transactionIconText, { color: primaryTextColor }]}>
            {isReceived ? '↓' : '↑'}
          </Text>
        </View>
        <View style={styles.transactionInfo}>
          <Text style={[styles.transactionDescription, { color: primaryTextColor }]} numberOfLines={1}>
            {tx.description || (isReceived ? t('wallet.received') : t('wallet.sent'))}
          </Text>
          <Text style={[styles.transactionDate, { color: secondaryTextColor }]}>{date}</Text>
        </View>
        <View style={styles.transactionAmountContainer}>
          <Text
            style={[
              styles.transactionAmount,
              isReceived ? styles.amountReceived : styles.amountSent,
            ]}
          >
            {formattedTx.primary}
          </Text>
          {formattedTx.secondaryCompact && (
            <Text style={[styles.transactionAmountSecondary, { color: secondaryTextColor }]}>
              {formattedTx.secondaryCompact}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient
      colors={gradientColors}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.walletSelector}
            onPress={handleManageWallets}
          >
            <View style={styles.walletIcon}>
              <Text style={styles.walletIconText}>💰</Text>
            </View>
            <View>
              <Text style={[styles.walletName, { color: primaryTextColor }]} numberOfLines={1}>
                {activeWalletInfo?.masterKeyNickname || 'Wallet'}
              </Text>
              <Text style={[styles.subWalletName, { color: secondaryTextColor }]} numberOfLines={1}>
                {activeWalletInfo?.subWalletNickname || 'Main Wallet'}
              </Text>
            </View>
            <IconButton
              icon="chevron-down"
              iconColor={iconColor}
              size={20}
            />
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <IconButton
              icon="eye"
              iconColor={iconColor}
              size={22}
              onPress={() => setShowBalance(!showBalance)}
            />
            <IconButton
              icon="lock"
              iconColor={iconColor}
              size={22}
              onPress={handleLock}
            />
            <IconButton
              icon="cog"
              iconColor={iconColor}
              size={22}
              onPress={handleSettings}
            />
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FFC107"
            />
          }
        >
          {/* Balance Card */}
          <View style={styles.balanceCard}>
            <Text style={[styles.balanceLabel, { color: secondaryTextColor }]}>{t('wallet.balance')}</Text>
            {isLoading && !balance ? (
              <ActivityIndicator color="#FFC107" size="large" />
            ) : (
              <>
                <Text style={[styles.balanceAmount, { color: primaryTextColor }]}>
                  {getFormattedBalance(balance).primary}
                </Text>
                {showBalance && getFormattedBalance(balance).secondary && (
                  <Text style={[styles.balanceSecondary, { color: secondaryTextColor }]}>
                    {getFormattedBalance(balance).secondary}
                  </Text>
                )}
              </>
            )}
            {!showBalance && (
              <TouchableOpacity onPress={() => setShowBalance(true)}>
                <Text style={styles.tapToReveal}>{t('common.tapToReveal')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActionsContainer}>
            <QuickAction
              icon="↑"
              label={t('wallet.send')}
              onPress={handleSend}
              color="#FF6B6B"
            />
            <QuickAction
              icon="↓"
              label={t('wallet.receive')}
              onPress={handleReceive}
              color="#4CAF50"
            />
            <QuickAction
              icon="⬡"
              label={t('payments.scanQR')}
              onPress={handleScan}
              color="#2196F3"
            />
            <QuickAction
              icon="💡"
              label={t('payments.tip')}
              onPress={handleCreateTip}
              color="#FFC107"
            />
          </View>

          {/* Recent Transactions */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: primaryTextColor }]}>{t('wallet.transactions')}</Text>
            <TouchableOpacity onPress={handleViewHistory}>
              <Text style={styles.seeAllButton}>{t('common.seeAll')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.transactionsContainer}>
            {isLoading && transactions.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#FFC107" />
                <Text style={[styles.loadingText, { color: secondaryTextColor }]}>{t('common.loading')}</Text>
              </View>
            ) : transactions.length === 0 ? (
              <View style={styles.emptyTransactions}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={[styles.emptyText, { color: secondaryTextColor }]}>{t('wallet.noTransactions')}</Text>
                <Text style={[styles.emptySubtext, { color: secondaryTextColor }]}>
                  {t('wallet.getStarted')}
                </Text>
              </View>
            ) : (
              transactions.slice(0, 5).map(renderTransaction)
            )}
          </View>
        </ScrollView>

        {/* Transaction Details Modal */}
        {selectedTransaction && renderDetailsModal()}
      </SafeAreaView>
    </LinearGradient>
  );

  // Helper function to format time
  function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Render transaction details modal
  function renderDetailsModal(): React.JSX.Element | null {
    if (!selectedTransaction) return null;

    const tx = selectedTransaction;
    const isReceived = tx.type === 'receive';
    const date = new Date(tx.timestamp);

    return (
      <Modal
        visible={!!selectedTransaction}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTransaction(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: primaryTextColor }]}>{t('wallet.transactionDetails')}</Text>
              <IconButton
                icon="close"
                iconColor={iconColor}
                size={24}
                onPress={() => setSelectedTransaction(null)}
              />
            </View>

            {/* Amount */}
            <View style={styles.modalAmountContainer}>
              <View style={styles.modalIcon}>
                <Text style={[styles.modalIconText, { color: primaryTextColor }]}>
                  {isReceived ? '↓' : '↑'}
                </Text>
              </View>
              <Text
                style={[
                  styles.modalAmount,
                  isReceived ? styles.amountReceived : styles.amountSent,
                ]}
              >
                {formatTx(tx.amount ?? 0, isReceived).primary}
              </Text>
              {formatTx(tx.amount ?? 0, isReceived).secondary && (
                <Text style={[styles.modalAmountSecondary, { color: secondaryTextColor }]}>
                  {formatTx(tx.amount ?? 0, isReceived).secondary}
                </Text>
              )}
              <Text style={[
                styles.modalStatus,
                { color: secondaryTextColor },
                tx.status === 'completed' && styles.statusCompleted,
                tx.status === 'pending' && styles.statusPending,
                tx.status === 'failed' && styles.statusFailed,
              ]}>
                {tx.status === 'completed' ? `\u2713 ${t('wallet.statusCompleted')}` :
                 tx.status === 'pending' ? `\u23F3 ${t('wallet.statusPending')}` :
                 tx.status === 'failed' ? `\u2715 ${t('wallet.statusFailed')}` : tx.status}
              </Text>
            </View>

            <Divider style={styles.divider} />

            {/* Details */}
            <View style={styles.detailsContainer}>
              <DetailRow label={t('wallet.type')} value={isReceived ? t('wallet.received') : t('wallet.sent')} />
              <DetailRow
                label={t('wallet.date')}
                value={date.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              />
              <DetailRow label={t('wallet.time')} value={formatTime(tx.timestamp)} />
              {tx.description && (
                <DetailRow label={t('payments.description')} value={tx.description} />
              )}
              {tx.feeSats !== undefined && tx.feeSats > 0 && (
                <DetailRow label={t('wallet.fee')} value={`${tx.feeSats.toLocaleString()} ${t('wallet.sats')}`} />
              )}
            </View>

            {/* Close Button */}
            <Button
              mode="outlined"
              onPress={() => setSelectedTransaction(null)}
              style={styles.closeModalButton}
              labelStyle={[styles.closeModalButtonLabel, { color: primaryTextColor }]}
            >
              {t('common.close')}
            </Button>
          </View>
        </View>
      </Modal>
    );
  }

  // Detail row component
  function DetailRow({ label, value }: { label: string; value: string }): React.JSX.Element {
    return (
      <View style={styles.detailRow}>
        <Text style={[styles.detailLabel, { color: secondaryTextColor }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: primaryTextColor }]} numberOfLines={2}>
          {value}
        </Text>
      </View>
    );
  }
}

// =============================================================================
// Quick Action Button
// =============================================================================

function QuickAction({
  icon,
  label,
  onPress,
  color = '#FFC107',
}: QuickActionProps): React.JSX.Element {
  const { themeMode } = useAppTheme();
  const secondaryTextColor = getSecondaryTextColor(themeMode);

  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={[styles.quickActionIcon, { backgroundColor: `${color}20` }]}>
        <Text style={[styles.quickActionIconText, { color }]}>{icon}</Text>
      </View>
      <Text style={[styles.quickActionLabel, { color: secondaryTextColor }]}>{label}</Text>
    </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  walletSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  walletIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  walletIconText: {
    fontSize: 18,
  },
  walletName: {
    fontSize: 16,
    fontWeight: '600',
    maxWidth: 150,
  },
  subWalletName: {
    fontSize: 12,
    maxWidth: 150,
  },
  headerActions: {
    flexDirection: 'row',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  balanceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  balanceSecondary: {
    fontSize: 14,
    marginTop: 4,
  },
  tapToReveal: {
    fontSize: 12,
    color: '#FFC107',
    marginTop: 8,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  quickAction: {
    alignItems: 'center',
    flex: 1,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionIconText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  quickActionLabel: {
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  seeAllButton: {
    fontSize: 14,
    color: '#FFC107',
  },
  transactionsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyTransactions: {
    padding: 32,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionIconText: {
    fontSize: 18,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
  },
  transactionAmountContainer: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  transactionAmountSecondary: {
    fontSize: 11,
    marginTop: 2,
  },
  amountReceived: {
    color: '#4CAF50',
  },
  amountSent: {
    color: '#FF6B6B',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalAmountContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalIconText: {
    fontSize: 24,
  },
  modalAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalAmountSecondary: {
    fontSize: 14,
    marginBottom: 8,
  },
  modalStatus: {
    fontSize: 14,
  },
  statusCompleted: {
    color: '#4CAF50',
  },
  statusPending: {
    color: '#FFC107',
  },
  statusFailed: {
    color: '#FF5252',
  },
  divider: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
  },
  detailsContainer: {
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  closeModalButton: {
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
  },
  closeModalButtonLabel: {
  },
});
