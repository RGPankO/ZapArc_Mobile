import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Button, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { BreezSparkService } from '../../src/services/breezSparkService';

type ReceiveStep = 'input' | 'invoice';

export default function ReceiveScreen() {
  const [step, setStep] = useState<ReceiveStep>('input');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [invoice, setInvoice] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [expiryTime, setExpiryTime] = useState<number | null>(null);

  // Quick amount presets
  const presets = [10000, 50000, 100000, 500000];

  const handlePresetAmount = useCallback((presetAmount: number) => {
    setAmount(presetAmount.toString());
  }, []);

  const handleGenerateInvoice = useCallback(async () => {
    const amountValue = parseInt(amount, 10);

    if (!amountValue || amountValue <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0');
      return;
    }

    try {
      setIsGenerating(true);

      const result = await BreezSparkService.receivePayment(
        amountValue,
        description || undefined
      );

      setInvoice(result.paymentRequest);

      // Set expiry time (15 minutes from now)
      const expiryTimestamp = Date.now() + 15 * 60 * 1000;
      setExpiryTime(expiryTimestamp);

      setStep('invoice');
    } catch (error) {
      console.error('Failed to generate invoice:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to generate invoice'
      );
    } finally {
      setIsGenerating(false);
    }
  }, [amount, description]);

  const handleCopyInvoice = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(invoice);
      // Android's built-in clipboard notification will show a non-blocking toast
    } catch (error) {
      console.error('Failed to copy invoice:', error);
      Alert.alert('Error', 'Failed to copy invoice');
    }
  }, [invoice]);

  const handleShareInvoice = useCallback(async () => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        // Fallback to copy
        await handleCopyInvoice();
        return;
      }

      // Create a temporary text file to share
      // In a production app, you might want to use react-native-fs to create a file
      // For now, we'll just copy to clipboard as fallback
      await handleCopyInvoice();
    } catch (error) {
      console.error('Failed to share invoice:', error);
      Alert.alert('Error', 'Failed to share invoice');
    }
  }, [invoice, handleCopyInvoice]);

  const handleNewInvoice = useCallback(() => {
    setStep('input');
    setAmount('');
    setDescription('');
    setInvoice('');
    setExpiryTime(null);
  }, []);

  // Calculate remaining time
  const getRemainingTime = useCallback(() => {
    if (!expiryTime) return '';

    const remaining = Math.max(0, expiryTime - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [expiryTime]);

  // Timer update (simple approach)
  const [, setTick] = useState(0);
  React.useEffect(() => {
    if (step === 'invoice' && expiryTime) {
      const interval = setInterval(() => {
        setTick(t => t + 1);

        // Check if expired
        if (Date.now() >= expiryTime) {
          clearInterval(interval);
          // Auto-return to input screen without popup
          handleNewInvoice();
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [step, expiryTime, handleNewInvoice]);

  if (step === 'invoice') {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.gradient}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Deposit Funds</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <View style={styles.qrContainer}>
              <View style={styles.qrCodeWrapper}>
                <QRCode
                  value={invoice}
                  size={240}
                  backgroundColor="white"
                  color="black"
                />
              </View>
            </View>

            <Text style={styles.amountText}>
              Amount: {parseInt(amount, 10).toLocaleString()} sats
            </Text>

            <View style={styles.invoiceContainer}>
              <Text style={styles.invoiceLabel}>Lightning Invoice:</Text>
              <ScrollView
                style={styles.invoiceScroll}
                contentContainerStyle={styles.invoiceScrollContent}
              >
                <Text style={styles.invoiceText} selectable>
                  {invoice}
                </Text>
              </ScrollView>
              <Button
                mode="outlined"
                onPress={handleCopyInvoice}
                style={styles.copyButton}
                textColor="#FFC107"
              >
                Copy
              </Button>
            </View>

            <View style={styles.statusContainer}>
              <Text style={styles.waitingText}>⏳ Waiting for payment...</Text>
              <Text style={styles.expiryText}>
                Expires in: {getRemainingTime()}
              </Text>
            </View>

            <Button
              mode="contained"
              onPress={handleNewInvoice}
              style={styles.newInvoiceButton}
              buttonColor="#FFC107"
              textColor="#1a1a2e"
            >
              New Invoice
            </Button>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Deposit Funds</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.label}>Enter the amount you want to deposit:</Text>

          <TextInput
            mode="outlined"
            label="Amount in sats"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            style={styles.input}
            outlineColor="rgba(255, 255, 255, 0.3)"
            activeOutlineColor="#FFC107"
            textColor="#FFFFFF"
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
          />

          <View style={styles.presetsContainer}>
            {presets.map((preset) => (
              <Button
                key={preset}
                mode="outlined"
                onPress={() => handlePresetAmount(preset)}
                style={styles.presetButton}
                contentStyle={styles.presetButtonContent}
                labelStyle={styles.presetButtonLabel}
                textColor="#FFFFFF"
              >
                {preset >= 1000 ? `${preset / 1000}K` : preset}
              </Button>
            ))}
          </View>

          <TextInput
            mode="outlined"
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            style={[styles.input, styles.descriptionInput]}
            outlineColor="rgba(255, 255, 255, 0.3)"
            activeOutlineColor="#FFC107"
            textColor="#FFFFFF"
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
            multiline
            numberOfLines={2}
          />

          <Button
            mode="contained"
            onPress={handleGenerateInvoice}
            loading={isGenerating}
            disabled={isGenerating || !amount}
            style={styles.generateButton}
            buttonColor="#FFC107"
            textColor="#1a1a2e"
          >
            Generate Invoice
          </Button>
        </ScrollView>
      </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    fontSize: 16,
    color: '#FFC107',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  label: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 16,
  },
  descriptionInput: {
    marginTop: 8,
  },
  presetsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 8,
  },
  presetButton: {
    flex: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  presetButtonContent: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  presetButtonLabel: {
    fontSize: 13,
    marginHorizontal: 0,
  },
  generateButton: {
    marginTop: 16,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  qrCodeWrapper: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 24,
  },
  invoiceContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  invoiceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
  },
  invoiceScroll: {
    maxHeight: 100,
    marginBottom: 12,
  },
  invoiceScrollContent: {
    paddingVertical: 4,
  },
  invoiceText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  copyButton: {
    borderColor: '#FFC107',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  waitingText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  expiryText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  newInvoiceButton: {
    marginTop: 8,
  },
});
