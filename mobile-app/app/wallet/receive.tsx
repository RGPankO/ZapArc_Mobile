import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Button, TextInput, Menu } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { BreezSparkService } from '../../src/services/breezSparkService';
import { useCurrency, type InputCurrency } from '../../src/hooks/useCurrency';
import { StyledTextInput } from '../../src/components';

type ReceiveStep = 'input' | 'invoice';

// Currency labels for display
const currencyLabels: Record<InputCurrency, string> = {
  sats: 'sats',
  btc: 'BTC',
  usd: 'USD',
  eur: 'EUR',
};

export default function ReceiveScreen() {
  const { secondaryFiatCurrency, convertToSats, formatSatsWithFiat, rates, isLoadingRates } = useCurrency();
  
  const [step, setStep] = useState<ReceiveStep>('input');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [invoice, setInvoice] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [expiryTime, setExpiryTime] = useState<number | null>(null);
  const [invoiceSatsAmount, setInvoiceSatsAmount] = useState(0);
  
  // Currency selection state
  const [inputCurrency, setInputCurrency] = useState<InputCurrency>('sats');
  const [currencyMenuVisible, setCurrencyMenuVisible] = useState(false);

  // Available currency options (sats + user's secondary fiat)
  const currencyOptions: InputCurrency[] = useMemo(() => {
    return ['sats', secondaryFiatCurrency];
  }, [secondaryFiatCurrency]);

  // Convert current amount to sats for preview
  const previewSats = useMemo(() => {
    const numAmount = parseFloat(amount);
    if (!numAmount || isNaN(numAmount)) return 0;
    return convertToSats(numAmount, inputCurrency);
  }, [amount, inputCurrency, convertToSats]);

  // Format preview display
  const previewDisplay = useMemo(() => {
    if (!previewSats) return null;
    return formatSatsWithFiat(previewSats);
  }, [previewSats, formatSatsWithFiat]);

  // Dynamic presets based on currency
  const presets = useMemo(() => {
    switch (inputCurrency) {
      case 'eur':
        return [10, 25, 50, 100];
      case 'usd':
        return [10, 25, 50, 100];
      case 'btc':
        return [0.0001, 0.0005, 0.001, 0.005];
      case 'sats':
      default:
        return [10000, 50000, 100000, 500000];
    }
  }, [inputCurrency]);

  // Format preset label
  const formatPresetLabel = useCallback((preset: number): string => {
    switch (inputCurrency) {
      case 'eur':
        return `€${preset}`;
      case 'usd':
        return `$${preset}`;
      case 'btc':
        return `${preset} BTC`;
      case 'sats':
      default:
        return preset >= 1000 ? `${preset / 1000}K` : `${preset}`;
    }
  }, [inputCurrency]);

  const handlePresetAmount = useCallback((presetAmount: number) => {
    setAmount(presetAmount.toString());
  }, []);

  const handleGenerateInvoice = useCallback(async () => {
    const numAmount = parseFloat(amount);
    
    if (!numAmount || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0');
      return;
    }

    // Convert to sats based on input currency
    const satsAmount = convertToSats(numAmount, inputCurrency);
    
    if (!satsAmount || satsAmount <= 0) {
      Alert.alert('Conversion Error', 'Could not convert amount. Please check exchange rates.');
      return;
    }

    try {
      setIsGenerating(true);

      const result = await BreezSparkService.receivePayment(
        satsAmount,
        description || undefined
      );

      setInvoice(result.paymentRequest);
      setInvoiceSatsAmount(satsAmount);

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
  }, [amount, description, inputCurrency, convertToSats]);

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
    setInvoiceSatsAmount(0);
  }, []);

  // Handle currency change
  const handleCurrencyChange = useCallback((currency: InputCurrency) => {
    setInputCurrency(currency);
    setCurrencyMenuVisible(false);
    setAmount(''); // Reset amount when switching currencies
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
              Amount: {invoiceSatsAmount.toLocaleString()} sats
              {formatSatsWithFiat(invoiceSatsAmount).fiatDisplay && (
                <Text style={styles.amountFiatText}>
                  {' '}({formatSatsWithFiat(invoiceSatsAmount).fiatDisplay})
                </Text>
              )}
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

          {/* Amount Input with Currency Selector */}
          <View style={styles.amountInputRow}>
            <StyledTextInput
              label={`Amount in ${currencyLabels[inputCurrency]}`}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              style={[styles.input, styles.amountInput]}
            />
            
            {/* Currency Selector */}
            <Menu
              visible={currencyMenuVisible}
              onDismiss={() => setCurrencyMenuVisible(false)}
              anchor={
                <TouchableOpacity
                  style={styles.currencySelector}
                  onPress={() => setCurrencyMenuVisible(true)}
                >
                  <Text style={styles.currencySelectorText}>
                    {currencyLabels[inputCurrency]} ▼
                  </Text>
                </TouchableOpacity>
              }
              contentStyle={styles.currencyMenu}
            >
              {currencyOptions.map((currency) => (
                <Menu.Item
                  key={currency}
                  onPress={() => handleCurrencyChange(currency)}
                  title={currencyLabels[currency]}
                  titleStyle={inputCurrency === currency ? styles.currencyMenuItemActive : undefined}
                />
              ))}
            </Menu>
          </View>

          {/* Conversion Preview */}
          {previewDisplay && previewSats > 0 && inputCurrency !== 'sats' && (
            <View style={styles.conversionPreview}>
              <Text style={styles.conversionText}>
                ≈ {previewDisplay.satsDisplay}
              </Text>
              {previewDisplay.fiatDisplay && (
                <Text style={styles.conversionFiat}>
                  ({previewDisplay.fiatDisplay})
                </Text>
              )}
            </View>
          )}

          {/* Presets */}
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
                {formatPresetLabel(preset)}
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
            outlineStyle={styles.inputOutline}
            contentStyle={styles.inputContent}
            multiline
            numberOfLines={2}
          />

          <Button
            mode="contained"
            onPress={handleGenerateInvoice}
            loading={isGenerating}
            disabled={isGenerating || !amount || (inputCurrency !== 'sats' && isLoadingRates)}
            style={styles.generateButton}
            buttonColor="#FFC107"
            textColor="#1a1a2e"
          >
            {isLoadingRates && inputCurrency !== 'sats' ? 'Loading rates...' : 'Generate Invoice'}
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
    backgroundColor: '#1a1a2e',
    marginBottom: 16,
  },
  inputOutline: {
    borderRadius: 8,
  },
  inputContent: {
    paddingTop: 8,
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
    marginBottom: 16,
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
    marginBottom: 12,
  },
  invoiceContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  invoiceLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 6,
  },
  invoiceScroll: {
    maxHeight: 120,
    marginBottom: 10,
  },
  invoiceScrollContent: {
    paddingVertical: 4,
  },
  invoiceText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  copyButton: {
    borderColor: '#FFC107',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 16,
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
  // Currency input styles
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 16,
  },
  amountInput: {
    flex: 1,
    marginBottom: 0,
    backgroundColor: undefined, // Let StyledTextInput handle background for proper label masking
  },
  currencySelector: {
    backgroundColor: '#16213e', // Match input background
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFC107',
    minWidth: 75,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  currencySelectorText: {
    color: '#FFC107',
    fontSize: 14,
    fontWeight: '600',
  },
  currencyMenu: {
    backgroundColor: '#1a1a2e',
  },
  currencyMenuItemActive: {
    color: '#FFC107',
    fontWeight: 'bold',
  },
  conversionPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
    gap: 8,
  },
  conversionText: {
    color: '#FFC107',
    fontSize: 16,
    fontWeight: '600',
  },
  conversionFiat: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  amountFiatText: {
    fontWeight: 'normal',
    color: 'rgba(255, 255, 255, 0.7)',
  },
});
