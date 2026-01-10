// Home/Balance Screen
// Main wallet dashboard with balance, recent transactions, and quick actions

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Text, IconButton, useTheme, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallet } from '../../../hooks/useWallet';
import { useWalletAuth } from '../../../hooks/useWalletAuth';
import { useSettings } from '../../../hooks/useSettings';
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
  const theme = useTheme();
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
  const { settings } = useSettings();

  // State
  const [refreshing, setRefreshing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);

  // Currency formatting
  const formatBalance = (sats: number): string => {
    if (!showBalance) return '••••••';
    
    const currency = settings?.currency || 'BTC';
    
    if (String(currency).toUpperCase() === 'BTC') {
      // Convert sats to BTC
      const btc = sats / 100_000_000;
      return `₿ ${btc.toFixed(8)}`;
    } else if (String(currency).toUpperCase() === 'SATS') {
      return `${sats.toLocaleString()} sats`;
    } else {
      return `${sats.toLocaleString()} sats`;
    }
  };

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshBalance(), refreshTransactions()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshBalance, refreshTransactions]);

  // Initial load - refresh when connected
  // Note: The useWallet hook now handles SDK initialization detection
  // and will automatically refresh balance when SDK becomes available
  useEffect(() => {
    if (isConnected) {
      handleRefresh();
    }
  }, [isConnected, handleRefresh]);

  // Refresh transactions when screen comes into focus
  // This ensures the transaction list updates when returning from payment screen
  useFocusEffect(
    useCallback(() => {
      if (isConnected && !isLoading) {
        refreshTransactions();
      }
    }, [isConnected, isLoading, refreshTransactions])
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

  // Render transaction item
  const renderTransaction = (tx: Transaction, index: number): React.JSX.Element => {
    const isReceived = tx.type === 'receive';
    const amount = tx.amount ?? 0; // Transaction type uses 'amount', not 'amountSats'
    const date = new Date(tx.timestamp).toLocaleDateString();

    return (
      <TouchableOpacity
        key={tx.id || index}
        style={styles.transactionItem}
        onPress={() => router.push(`/wallet/transaction/${tx.id}`)}
      >
        <View style={styles.transactionIcon}>
          <Text style={styles.transactionIconText}>
            {isReceived ? '↓' : '↑'}
          </Text>
        </View>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionDescription} numberOfLines={1}>
            {tx.description || (isReceived ? 'Received' : 'Sent')}
          </Text>
          <Text style={styles.transactionDate}>{date}</Text>
        </View>
        <Text
          style={[
            styles.transactionAmount,
            isReceived ? styles.amountReceived : styles.amountSent,
          ]}
        >
          {isReceived ? '+' : '-'}{amount.toLocaleString()} sats
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460']}
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
              <Text style={styles.walletName} numberOfLines={1}>
                {activeWalletInfo?.masterKeyNickname || 'Wallet'}
              </Text>
              <Text style={styles.subWalletName} numberOfLines={1}>
                {activeWalletInfo?.subWalletNickname || 'Main Wallet'}
              </Text>
            </View>
            <IconButton
              icon="chevron-down"
              iconColor="rgba(255, 255, 255, 0.6)"
              size={20}
            />
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <IconButton
              icon="eye"
              iconColor="rgba(255, 255, 255, 0.6)"
              size={22}
              onPress={() => setShowBalance(!showBalance)}
            />
            <IconButton
              icon="lock"
              iconColor="rgba(255, 255, 255, 0.6)"
              size={22}
              onPress={handleLock}
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
            <Text style={styles.balanceLabel}>Total Balance</Text>
            {isLoading && !balance ? (
              <ActivityIndicator color="#FFC107" size="large" />
            ) : (
              <Text style={styles.balanceAmount}>{formatBalance(balance)}</Text>
            )}
            {!showBalance && (
              <TouchableOpacity onPress={() => setShowBalance(true)}>
                <Text style={styles.tapToReveal}>Tap to reveal</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActionsContainer}>
            <QuickAction
              icon="↑"
              label="Send"
              onPress={handleSend}
              color="#FF6B6B"
            />
            <QuickAction
              icon="↓"
              label="Receive"
              onPress={handleReceive}
              color="#4CAF50"
            />
            <QuickAction
              icon="⬡"
              label="Scan"
              onPress={handleScan}
              color="#2196F3"
            />
            <QuickAction
              icon="💡"
              label="Tip"
              onPress={handleCreateTip}
              color="#FFC107"
            />
          </View>

          {/* Recent Transactions */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity onPress={handleViewHistory}>
              <Text style={styles.seeAllButton}>See All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.transactionsContainer}>
            {isLoading && transactions.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#FFC107" />
                <Text style={styles.loadingText}>Loading transactions...</Text>
              </View>
            ) : transactions.length === 0 ? (
              <View style={styles.emptyTransactions}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyText}>No transactions yet</Text>
                <Text style={styles.emptySubtext}>
                  Send or receive Bitcoin to get started
                </Text>
              </View>
            ) : (
              transactions.slice(0, 5).map(renderTransaction)
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
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
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={[styles.quickActionIcon, { backgroundColor: `${color}20` }]}>
        <Text style={[styles.quickActionIconText, { color }]}>{icon}</Text>
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
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
    color: '#FFFFFF',
    maxWidth: 150,
  },
  subWalletName: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
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
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
    color: 'rgba(255, 255, 255, 0.8)',
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
    color: '#FFFFFF',
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
    color: 'rgba(255, 255, 255, 0.5)',
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
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.4)',
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
    color: '#FFFFFF',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  amountReceived: {
    color: '#4CAF50',
  },
  amountSent: {
    color: '#FF6B6B',
  },
});
