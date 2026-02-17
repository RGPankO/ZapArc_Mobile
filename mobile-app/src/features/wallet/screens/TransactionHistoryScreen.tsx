// Transaction History Screen
// Full transaction list with filtering and details

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Linking,
} from 'react-native';
import { Text, IconButton, Chip, Button, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { getGradientColors, getPrimaryTextColor, getSecondaryTextColor, getIconColor, BRAND_COLOR } from '../../../utils/theme-helpers';
import { useWallet } from '../../../hooks/useWallet';
import { useLanguage } from '../../../hooks/useLanguage';
import { useCurrency } from '../../../hooks/useCurrency';
import type { Transaction } from '../types';

// =============================================================================
// Types
// =============================================================================

type FilterType = 'all' | 'sent' | 'received';

// =============================================================================
// Component
// =============================================================================

export function TransactionHistoryScreen(): React.JSX.Element {
  const { transactions, refreshTransactions, isLoading } = useWallet();
  const { t } = useLanguage();
  const { formatTx, refreshSettings } = useCurrency();

  const { themeMode } = useAppTheme();
  const gradientColors = getGradientColors(themeMode);
  const primaryTextColor = getPrimaryTextColor(themeMode);
  const secondaryTextColor = getSecondaryTextColor(themeMode);
  const iconColor = getIconColor(themeMode);

  // State
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    if (filter === 'all') return transactions;
    return transactions.filter((tx) => tx.type === filter.replace('ed', '') as 'send' | 'receive');
  }, [transactions, filter]);

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: Transaction[] } = {};

    filteredTransactions.forEach((tx) => {
      const date = new Date(tx.timestamp);
      const key = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(tx);
    });

    return Object.entries(groups).map(([date, txs]) => ({
      date,
      transactions: txs,
    }));
  }, [filteredTransactions]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshTransactions();
    } finally {
      setRefreshing(false);
    }
  }, [refreshTransactions]);

  // Refresh transactions and settings when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refreshSettings();
      refreshTransactions();
    }, [refreshTransactions, refreshSettings])
  );

  // Format time
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Render transaction item
  const renderTransaction = (tx: Transaction): React.JSX.Element => {
    const isReceived = tx.type === 'receive';
    const method = tx.method || (tx.txid ? 'onchain' : 'lightning');
    const formattedAmount = formatTx(tx.amount ?? 0, isReceived);

    return (
      <TouchableOpacity
        style={styles.transactionItem}
        onPress={() => setSelectedTransaction(tx)}
      >
        <View
          style={[
            styles.transactionIcon,
            isReceived ? styles.iconReceived : styles.iconSent,
          ]}
        >
          <Text style={[styles.transactionIconText, { color: primaryTextColor }]}>
            {method === 'onchain' ? '⛓️' : '⚡'}
          </Text>
        </View>

        <View style={styles.transactionInfo}>
          <Text style={[styles.transactionDescription, { color: primaryTextColor }]} numberOfLines={1}>
            {tx.description || (isReceived ? t('wallet.receivedPayment') : t('wallet.sentPayment'))}
          </Text>
          <Text style={[styles.transactionTime, { color: secondaryTextColor }]}>{formatTime(tx.timestamp)}</Text>
        </View>

        <View style={styles.transactionAmountContainer}>
          <Text
            style={[
              styles.transactionAmount,
              isReceived ? styles.amountReceived : styles.amountSent,
            ]}
          >
            {formattedAmount.primary}
          </Text>
          {formattedAmount.secondaryCompact && (
            <Text style={[styles.transactionAmountSecondary, { color: secondaryTextColor }]}>
              {formattedAmount.secondaryCompact}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render section header
  const renderSectionHeader = (date: string): React.JSX.Element => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionHeaderText, { color: secondaryTextColor }]}>{date}</Text>
    </View>
  );

  // Render transaction details modal
  const renderDetailsModal = (): React.JSX.Element | null => {
    if (!selectedTransaction) return null;

    const tx = selectedTransaction;
    const isReceived = tx.type === 'receive';
    const method = tx.method || (tx.txid ? 'onchain' : 'lightning');
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
              <View
                style={[
                  styles.modalIcon,
                  isReceived ? styles.iconReceived : styles.iconSent,
                ]}
              >
                <Text style={[styles.modalIconText, { color: primaryTextColor }]}> 
                  {method === 'onchain' ? '⛓️' : '⚡'}
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
              <Text style={styles.modalStatus}>
                {tx.status === 'completed' ? `\u2713 ${t('wallet.statusCompleted')}` : tx.status}
              </Text>
            </View>

            <Divider style={styles.divider} />

            {/* Details */}
            <View style={styles.detailsContainer}>
              <DetailRow label={t('wallet.type')} value={isReceived ? t('wallet.received') : t('wallet.sent')} />
              <DetailRow label="Method" value={method === 'onchain' ? 'On-chain' : 'Lightning'} />
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
              {method === 'onchain' && tx.txid && (
                <>
                  <DetailRow
                    label="TXID"
                    value={`${tx.txid.slice(0, 16)}...`}
                    copyable
                    fullValue={tx.txid}
                  />
                  <TouchableOpacity onPress={() => Linking.openURL(`https://mempool.space/tx/${tx.txid}`)}>
                    <Text style={styles.mempoolLink}>View on mempool.space</Text>
                  </TouchableOpacity>
                </>
              )}
              {tx.paymentHash && (
                <DetailRow
                  label={t('wallet.paymentHash')}
                  value={`${tx.paymentHash.slice(0, 16)}...`}
                  copyable
                  fullValue={tx.paymentHash}
                />
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
  };

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
          <Text style={[styles.headerTitle, { color: primaryTextColor }]}>{t('wallet.transactionHistory')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Filter Chips */}
        <View style={styles.filterContainer}>
          <Chip
            selected={filter === 'all'}
            onPress={() => setFilter('all')}
            style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
            textStyle={[
              styles.filterChipText,
              filter === 'all' && styles.filterChipTextActive,
            ]}
          >
            {t('common.all')}
          </Chip>
          <Chip
            selected={filter === 'received'}
            onPress={() => setFilter('received')}
            style={[styles.filterChip, filter === 'received' && styles.filterChipActive]}
            textStyle={[
              styles.filterChipText,
              filter === 'received' && styles.filterChipTextActive,
            ]}
          >
            {t('wallet.receivedPlural')}
          </Chip>
          <Chip
            selected={filter === 'sent'}
            onPress={() => setFilter('sent')}
            style={[styles.filterChip, filter === 'sent' && styles.filterChipActive]}
            textStyle={[
              styles.filterChipText,
              filter === 'sent' && styles.filterChipTextActive,
            ]}
          >
            {t('wallet.sentPlural')}
          </Chip>
        </View>

        {/* Transaction List */}
        {filteredTransactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={[styles.emptyTitle, { color: primaryTextColor }]}>{t('wallet.noTransactions')}</Text>
            <Text style={[styles.emptySubtitle, { color: secondaryTextColor }]}>
              {filter === 'all'
                ? t('wallet.historyWillAppear')
                : t('wallet.noTransactionsFound', { filter: filter === 'received' ? t('wallet.received').toLowerCase() : t('wallet.sent').toLowerCase() })}
            </Text>
          </View>
        ) : (
          <FlatList
            data={groupedTransactions}
            keyExtractor={(item) => item.date}
            renderItem={({ item }) => (
              <View>
                {renderSectionHeader(item.date)}
                {item.transactions.map((tx) => (
                  <View key={tx.id}>{renderTransaction(tx)}</View>
                ))}
              </View>
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={BRAND_COLOR}
              />
            }
          />
        )}

        {/* Transaction Details Modal */}
        {renderDetailsModal()}
      </SafeAreaView>
    </LinearGradient>
  );
}

// =============================================================================
// Detail Row Component
// =============================================================================

interface DetailRowProps {
  label: string;
  value: string;
  copyable?: boolean;
  fullValue?: string;
}

function DetailRow({ label, value, copyable, fullValue }: DetailRowProps): React.JSX.Element {
  const { themeMode } = useAppTheme();
  const primaryTextColor = getPrimaryTextColor(themeMode);
  const secondaryTextColor = getSecondaryTextColor(themeMode);
  const iconColor = getIconColor(themeMode);

  const handleCopy = (): void => {
    // TODO: Implement clipboard copy
    console.log('Copy:', fullValue || value);
  };

  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: secondaryTextColor }]}>{label}</Text>
      <View style={styles.detailValueContainer}>
        <Text style={[styles.detailValue, { color: primaryTextColor }]} numberOfLines={1}>
          {value}
        </Text>
        {copyable && (
          <IconButton
            icon="content-copy"
            iconColor={iconColor}
            size={16}
            onPress={handleCopy}
            style={styles.copyButton}
          />
        )}
      </View>
    </View>
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  filterChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: BRAND_COLOR,
  },
  filterChipText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
  },
  filterChipTextActive: {
    color: '#1a1a2e',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    paddingVertical: 8,
    marginTop: 8,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconReceived: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  iconSent: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
  },
  transactionIconText: {
    fontSize: 18,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 15,
    marginBottom: 2,
  },
  transactionTime: {
    fontSize: 12,
  },
  transactionAmountContainer: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '600',
  },
  amountReceived: {
    color: '#4CAF50',
  },
  amountSent: {
    color: '#FF6B6B',
  },
  transactionAmountSecondary: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
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
    color: '#4CAF50',
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
  detailValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  detailValue: {
    fontSize: 14,
    textAlign: 'right',
    maxWidth: '80%',
  },
  copyButton: {
    margin: 0,
    marginLeft: 4,
  },
  mempoolLink: {
    color: BRAND_COLOR,
    fontSize: 13,
    textAlign: 'right',
    marginTop: 8,
  },
  closeModalButton: {
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
  },
  closeModalButtonLabel: {
  },
});
