// Payment Confirmation Screen
// Confirms Lightning payment details before sending

import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text, Button, IconButton, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallet } from '../../../hooks/useWallet';

// =============================================================================
// Types
// =============================================================================

type PaymentStatus = 'confirming' | 'processing' | 'success' | 'failed';

interface PaymentInfo {
  type: 'bolt11' | 'lnurl' | 'lightning-address';
  destination: string;
  amount: number;
  description?: string;
  feeEstimate?: number;
}

// =============================================================================
// Component
// =============================================================================

export function PaymentConfirmationScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{
    type: string;
    destination: string;
    amount: string;
    description?: string;
  }>();

  const { balance, sendPayment } = useWallet();

  // State
  const [status, setStatus] = useState<PaymentStatus>('confirming');
  const [error, setError] = useState<string | null>(null);
  const [feeEstimate, setFeeEstimate] = useState<number>(0);

  // Parse payment info from params
  const paymentInfo: PaymentInfo = {
    type: (params.type as PaymentInfo['type']) || 'bolt11',
    destination: params.destination || '',
    amount: parseInt(params.amount || '0', 10),
    description: params.description,
    feeEstimate,
  };

  // Check if balance is sufficient
  const hasSufficientBalance = balance >= paymentInfo.amount + feeEstimate;

  // Estimate fee on mount
  useEffect(() => {
    // Simple fee estimate: 0.1% with minimum of 1 sat
    const estimated = Math.max(1, Math.ceil(paymentInfo.amount * 0.001));
    setFeeEstimate(estimated);
  }, [paymentInfo.amount]);

  // Handle payment confirmation
  const handleConfirm = useCallback(async () => {
    if (!hasSufficientBalance) {
      setError('Insufficient balance');
      return;
    }

    setStatus('processing');
    setError(null);

    try {
      const success = await sendPayment(paymentInfo.destination);

      if (success) {
        setStatus('success');
      } else {
        setStatus('failed');
        setError('Payment failed. Please try again.');
      }
    } catch (err) {
      setStatus('failed');
      setError(err instanceof Error ? err.message : 'Payment failed');
    }
  }, [hasSufficientBalance, paymentInfo.destination, sendPayment]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    router.back();
  }, []);

  // Handle done (after success/failure)
  const handleDone = useCallback(() => {
    // Navigate back to home - this will trigger useFocusEffect to refresh transactions
    router.navigate('/wallet/home');
  }, []);

  // Format sats with thousand separators
  const formatSats = (sats: number): string => {
    return sats.toLocaleString();
  };

  // Truncate destination for display
  const truncateDestination = (dest: string, maxLen = 40): string => {
    if (dest.length <= maxLen) return dest;
    return `${dest.slice(0, 20)}...${dest.slice(-16)}`;
  };

  // ========================================
  // Render Processing State
  // ========================================
  if (status === 'processing') {
    return (
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#FFC107" />
            <Text style={styles.processingText}>Processing Payment...</Text>
            <Text style={styles.processingSubtext}>
              Please wait while your payment is being sent
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ========================================
  // Render Success State
  // ========================================
  if (status === 'success') {
    return (
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.centerContent}>
            <View style={styles.successIcon}>
              <Text style={styles.successIconText}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Payment Sent!</Text>
            <Text style={styles.successAmount}>
              {formatSats(paymentInfo.amount)} sats
            </Text>
            <Text style={styles.successSubtext}>
              Your payment has been successfully sent
            </Text>
            <Button
              mode="contained"
              onPress={handleDone}
              style={styles.doneButton}
              labelStyle={styles.doneButtonLabel}
            >
              Done
            </Button>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ========================================
  // Render Failed State
  // ========================================
  if (status === 'failed') {
    return (
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.centerContent}>
            <View style={styles.failedIcon}>
              <Text style={styles.failedIconText}>✕</Text>
            </View>
            <Text style={styles.failedTitle}>Payment Failed</Text>
            <Text style={styles.failedError}>{error}</Text>
            <View style={styles.failedButtons}>
              <Button
                mode="outlined"
                onPress={handleDone}
                style={styles.cancelButton}
                labelStyle={styles.cancelButtonLabel}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={() => setStatus('confirming')}
                style={styles.retryButton}
                labelStyle={styles.retryButtonLabel}
              >
                Try Again
              </Button>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ========================================
  // Render Confirmation State
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
            icon="close"
            iconColor="#FFFFFF"
            size={24}
            onPress={handleCancel}
          />
          <Text style={styles.headerTitle}>Confirm Payment</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Payment Details */}
        <View style={styles.content}>
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>You're sending</Text>
            <Text style={styles.amountValue}>
              {formatSats(paymentInfo.amount)}
            </Text>
            <Text style={styles.amountUnit}>sats</Text>
          </View>

          <View style={styles.detailsCard}>
            {/* Destination */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>To</Text>
              <Text style={styles.detailValue} numberOfLines={2}>
                {paymentInfo.type === 'lightning-address'
                  ? paymentInfo.destination
                  : truncateDestination(paymentInfo.destination)}
              </Text>
            </View>

            <Divider style={styles.divider} />

            {/* Description */}
            {paymentInfo.description && (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Description</Text>
                  <Text style={styles.detailValue} numberOfLines={2}>
                    {paymentInfo.description}
                  </Text>
                </View>
                <Divider style={styles.divider} />
              </>
            )}

            {/* Fee Estimate */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Estimated Fee</Text>
              <Text style={styles.detailValue}>~{formatSats(feeEstimate)} sats</Text>
            </View>

            <Divider style={styles.divider} />

            {/* Total */}
            <View style={styles.detailRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>
                {formatSats(paymentInfo.amount + feeEstimate)} sats
              </Text>
            </View>
          </View>

          {/* Balance Check */}
          <View style={styles.balanceInfo}>
            <Text style={styles.balanceLabel}>Your Balance</Text>
            <Text
              style={[
                styles.balanceValue,
                !hasSufficientBalance && styles.balanceInsufficient,
              ]}
            >
              {formatSats(balance)} sats
            </Text>
            {!hasSufficientBalance && (
              <Text style={styles.insufficientText}>Insufficient balance</Text>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            mode="outlined"
            onPress={handleCancel}
            style={styles.cancelButton}
            labelStyle={styles.cancelButtonLabel}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleConfirm}
            disabled={!hasSufficientBalance}
            style={[
              styles.confirmButton,
              !hasSufficientBalance && styles.confirmButtonDisabled,
            ]}
            labelStyle={styles.confirmButtonLabel}
          >
            Send Payment
          </Button>
        </View>
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
  headerSpacer: {
    width: 48,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  amountCard: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  amountLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFC107',
  },
  amountUnit: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },
  detailsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#FFFFFF',
    flex: 2,
    textAlign: 'right',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFC107',
  },
  divider: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  balanceInfo: {
    alignItems: 'center',
    padding: 16,
  },
  balanceLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  balanceInsufficient: {
    color: '#FF5252',
  },
  insufficientText: {
    fontSize: 12,
    color: '#FF5252',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
  },
  cancelButtonLabel: {
    color: '#FFFFFF',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#FFC107',
    borderRadius: 12,
  },
  confirmButtonDisabled: {
    backgroundColor: 'rgba(255, 193, 7, 0.3)',
  },
  confirmButtonLabel: {
    color: '#1a1a2e',
    fontWeight: '600',
  },
  // Processing state
  processingText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 24,
  },
  processingSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 8,
    textAlign: 'center',
  },
  // Success state
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successIconText: {
    fontSize: 40,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  successAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFC107',
    marginBottom: 8,
  },
  successSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 32,
  },
  doneButton: {
    backgroundColor: '#FFC107',
    borderRadius: 12,
    paddingHorizontal: 32,
  },
  doneButtonLabel: {
    color: '#1a1a2e',
    fontWeight: '600',
  },
  // Failed state
  failedIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF5252',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  failedIconText: {
    fontSize: 40,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  failedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  failedError: {
    fontSize: 14,
    color: '#FF5252',
    textAlign: 'center',
    marginBottom: 32,
  },
  failedButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    backgroundColor: '#FFC107',
    borderRadius: 12,
  },
  retryButtonLabel: {
    color: '#1a1a2e',
    fontWeight: '600',
  },
});
