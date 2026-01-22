import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Button, TextInput, Menu, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getGradientColors,
  getPrimaryTextColor,
  getSecondaryTextColor,
} from '../../src/utils/theme-helpers';
import { useAppTheme } from '../../src/contexts/ThemeContext';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { useWallet } from '../../src/hooks/useWallet';
import { BreezSparkService } from '../../src/services/breezSparkService';
import { useCurrency, type InputCurrency } from '../../src/hooks/useCurrency';
import { useLightningAddress } from '../../src/hooks/useLightningAddress';
import { StyledTextInput } from '../../src/components';
import { useContacts } from '../../src/features/addressBook/hooks/useContacts';
import { ContactSelectionModal } from '../../src/features/addressBook/components/ContactSelectionModal';
import { Contact } from '../../src/features/addressBook/types';

type SendStep = 'input' | 'preview' | 'scanning';

interface PaymentPreview {
  recipient: string;
  amount: number;
  fee: number;
  total: number;
  description?: string;
}

// Currency labels for display
const currencyLabels: Record<InputCurrency, string> = {
  sats: 'sats',
  btc: 'BTC',
  usd: 'USD',
  eur: 'EUR',
};

export default function SendScreen() {
  const { themeMode } = useAppTheme();
  const gradientColors = getGradientColors(themeMode);
  const primaryTextColor = getPrimaryTextColor(themeMode);
  const secondaryTextColor = getSecondaryTextColor(themeMode);

  const { balance, refreshBalance } = useWallet();
  const { secondaryFiatCurrency, convertToSats, formatSatsWithFiat, rates, isLoadingRates } = useCurrency();
  const { contacts } = useContacts();
  const { addressInfo } = useLightningAddress();

  const [step, setStep] = useState<SendStep>('input');
  const [paymentInput, setPaymentInput] = useState('');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [preview, setPreview] = useState<PaymentPreview | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [prepareResponse, setPrepareResponse] = useState<any>(null);
  const [scanned, setScanned] = useState(false);

  // Currency selection state
  const [inputCurrency, setInputCurrency] = useState<InputCurrency>('sats');
  const [currencyMenuVisible, setCurrencyMenuVisible] = useState(false);

  // Address book state
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [contactModalVisible, setContactModalVisible] = useState(false);

  // Available currency options
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

  // Format balance with fiat
  const balanceDisplay = useMemo(() => {
    return formatSatsWithFiat(balance);
  }, [balance, formatSatsWithFiat]);

  // Handle currency change
  const handleCurrencyChange = useCallback((currency: InputCurrency) => {
    setInputCurrency(currency);
    setCurrencyMenuVisible(false);
    setAmount(''); // Reset amount when switching currencies
  }, []);

  // Handle contact selection from address book
  const handleContactSelect = useCallback((contact: Contact) => {
    setSelectedContact(contact);
    setPaymentInput(contact.lightningAddress);
    setContactModalVisible(false);
  }, []);

  // Clear selected contact
  const handleClearContact = useCallback(() => {
    setSelectedContact(null);
    setPaymentInput('');
  }, []);

  // Auto-fill amount when invoice is pasted
  useEffect(() => {
    const checkAndFillAmount = async () => {
      if (!paymentInput.trim()) return;

      try {
        const parsed = await BreezSparkService.parsePaymentRequest(paymentInput);
        console.log('🔍 [Send] Parsed:', parsed.type, 'Valid:', parsed.isValid, 'Amount:', parsed.amountSat);

        if (parsed.isValid && parsed.amountSat !== undefined) {
          console.log('✅ [Send] Auto-filling amount:', parsed.amountSat);
          setAmount(parsed.amountSat.toString());
        } else {
          console.log('⚠️ [Send] No amount in invoice or invalid');
        }
      } catch (error) {
        console.error('❌ [Send] Failed to parse payment request:', error);
      }
    };

    checkAndFillAmount();
  }, [paymentInput]);

  // Request camera permissions for QR scanner
  const requestCameraPermission = useCallback(async () => {
    const { status } = await BarCodeScanner.requestPermissionsAsync();
    setHasPermission(status === 'granted');
    return status === 'granted';
  }, []);

  const handleScanQR = useCallback(async () => {
    const granted = await requestCameraPermission();
    if (granted) {
      setScanned(false); // Reset scanned flag
      setStep('scanning');
    } else {
      Alert.alert(
        'Permission Required',
        'Camera permission is required to scan QR codes'
      );
    }
  }, [requestCameraPermission]);

  const handleBarCodeScanned = useCallback(
    async ({ data }: { type: string; data: string }) => {
      if (scanned) return; // Prevent multiple scans
      setScanned(true);

      console.log('📷 [Send] QR Code scanned, navigating to input');
      setPaymentInput(data);
      setStep('input');

      // Try to parse and auto-fill amount if present
      try {
        const parsed = await BreezSparkService.parsePaymentRequest(data);
        if (parsed.isValid && parsed.amountSat !== undefined) {
          setAmount(parsed.amountSat.toString());
        }
      } catch (error) {
        console.error('Failed to parse scanned QR code:', error);
      }

      // No popup - user can see the form is filled
    },
    [scanned]
  );

  const handlePreviewPayment = useCallback(async () => {
    if (!paymentInput.trim()) {
      Alert.alert('Error', 'Please enter a Lightning invoice or address');
      return;
    }

    try {
      setIsPreparing(true);

      // Parse the payment request
      const parsedRequest = await BreezSparkService.parsePaymentRequest(paymentInput);

      if (!parsedRequest.isValid) {
        Alert.alert(
          'Invalid Payment Request',
          'Please enter a valid Lightning invoice, LNURL, or Lightning address'
        );
        return;
      }

      // Determine amount
      let paymentAmount: number;

      if (parsedRequest.type === 'bolt11' && parsedRequest.amountSat !== undefined) {
        // Bolt11 with embedded amount
        paymentAmount = parsedRequest.amountSat;
      } else {
        // User must specify amount - convert if in fiat
        const parsedAmount = parseFloat(amount);
        if (!parsedAmount || parsedAmount <= 0) {
          Alert.alert('Error', 'Please enter a valid amount');
          return;
        }
        paymentAmount = convertToSats(parsedAmount, inputCurrency);
        
        if (!paymentAmount || paymentAmount <= 0) {
          Alert.alert('Conversion Error', 'Could not convert amount. Please check exchange rates.');
          return;
        }
      }

      // Check balance
      if (paymentAmount > balance) {
        Alert.alert(
          'Insufficient Balance',
          `You have ${balance.toLocaleString()} sats but trying to send ${paymentAmount.toLocaleString()} sats`
        );
        return;
      }

      // Prepare the payment to get fee estimate
      const prepared = await BreezSparkService.prepareSendPayment(
        paymentInput,
        paymentAmount
      );

      setPrepareResponse(prepared);

      // Extract fee from prepare response
      // The fee is in paymentMethod.inner (either lightningFeeSats or feeQuote depending on type)
      let feeAmount = 0;
      if (prepared.paymentMethod) {
        const method = prepared.paymentMethod;
        if (method.tag === 'Bolt11Invoice' || method.tag === 'SparkInvoice') {
          feeAmount = Number(method.inner?.lightningFeeSats || 0);
          // Add spark transfer fee if present
          if (method.inner?.sparkTransferFeeSats) {
            feeAmount += Number(method.inner.sparkTransferFeeSats);
          }
        } else if (method.tag === 'BitcoinAddress') {
          // For on-chain, fee is in feeQuote
          feeAmount = Number(method.inner?.feeQuote?.feeSats || 0);
        }
      }
      const totalAmount = paymentAmount + feeAmount;

      // Check total against balance
      if (totalAmount > balance) {
        Alert.alert(
          'Insufficient Balance',
          `Total (${totalAmount.toLocaleString()} sats including ${feeAmount.toLocaleString()} sats fee) exceeds your balance of ${balance.toLocaleString()} sats`
        );
        return;
      }

      // Create preview
      const paymentPreview: PaymentPreview = {
        recipient: paymentInput,
        amount: paymentAmount,
        fee: feeAmount,
        total: totalAmount,
        description: parsedRequest.description || comment || undefined,
      };

      setPreview(paymentPreview);
      setStep('preview');
    } catch (error) {
      console.error('Failed to prepare payment:', error);
      
      // Provide more specific error message for Lightning Address resolution failures
      let errorMessage = error instanceof Error ? error.message : 'Failed to prepare payment';
      
      if (errorMessage.includes('Network request failed') || errorMessage.includes('Failed to resolve')) {
        errorMessage = 'Could not reach the Lightning Address provider. Please check the address is correct (e.g., user@wallet.com).';
      }
      
      Alert.alert('Payment Error', errorMessage);
    } finally {
      setIsPreparing(false);
    }
  }, [paymentInput, amount, comment, balance, inputCurrency, convertToSats]);

  const handleSendPayment = useCallback(async () => {
    if (!preview || !prepareResponse) {
      return;
    }

    try {
      setIsSending(true);

      const result = await BreezSparkService.sendPayment(prepareResponse);

      if (result.success) {
        // Refresh balance immediately
        await refreshBalance();
        
        // Wait for SDK to sync the payment to its database
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Navigate to home - useFocusEffect will refresh transactions
        router.navigate('/wallet/home');
      } else {
        Alert.alert('Payment Failed', result.error || 'Unknown error occurred');
        setStep('input');
      }
    } catch (error) {
      console.error('Failed to send payment:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to send payment'
      );
      setStep('input');
    } finally {
      setIsSending(false);
    }
  }, [preview, prepareResponse, refreshBalance]);

  const handleBackToInput = useCallback(() => {
    setStep('input');
    setPreview(null);
    setPrepareResponse(null);
  }, []);

  // Render QR Scanner
  if (step === 'scanning') {
    return (
      <LinearGradient colors={gradientColors} style={styles.gradient}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setStep('input')}>
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: primaryTextColor }]}>Scan QR Code</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.scannerContainer}>
            <BarCodeScanner
              onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
              style={StyleSheet.absoluteFillObject}
            />
            {/* Scan Frame Overlay - matches QRScannerScreen */}
            <View style={styles.overlay}>
              <View style={styles.overlayTop} />
              <View style={styles.overlayMiddle}>
                <View style={styles.overlaySide} />
                <View style={styles.scanFrame}>
                  {/* Corner decorations */}
                  <View style={[styles.corner, styles.cornerTopLeft]} />
                  <View style={[styles.corner, styles.cornerTopRight]} />
                  <View style={[styles.corner, styles.cornerBottomLeft]} />
                  <View style={[styles.corner, styles.cornerBottomRight]} />
                  {/* Crosshair */}
                  <View style={styles.crosshairHorizontal} />
                  <View style={styles.crosshairVertical} />
                </View>
                <View style={styles.overlaySide} />
              </View>
              <View style={styles.overlayBottom}>
                <Text style={styles.scannerText}>
                  Point your camera at a Lightning QR code
                </Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Render Payment Preview
  if (step === 'preview' && preview) {
    return (
      <LinearGradient colors={gradientColors} style={styles.gradient}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBackToInput}>
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: primaryTextColor }]}>Withdraw Funds</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <Text style={[styles.sectionTitle, { color: primaryTextColor }]}>Payment Preview</Text>

            <View style={styles.previewContainer}>
              <View style={styles.previewRow}>
                <Text style={[styles.previewLabel, { color: secondaryTextColor }]}>Recipient:</Text>
                <Text style={[styles.previewValue, { color: primaryTextColor }]} numberOfLines={1} ellipsizeMode="middle">
                  {preview.recipient}
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={[styles.previewLabel, { color: secondaryTextColor }]}>Amount:</Text>
                <Text style={[styles.previewAmount, { color: primaryTextColor }]}>
                  {preview.amount.toLocaleString()} sats
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={[styles.previewLabel, { color: secondaryTextColor }]}>Fee:</Text>
                <Text style={[styles.previewFee, { color: secondaryTextColor }]}>
                  {preview.fee.toLocaleString()} sats
                </Text>
              </View>

              <View style={[styles.previewRow, styles.previewTotal]}>
                <Text style={[styles.previewTotalLabel, { color: primaryTextColor }]}>Total:</Text>
                <Text style={styles.previewTotalAmount}>
                  {preview.total.toLocaleString()} sats
                </Text>
              </View>

              {preview.description && (
                <View style={styles.previewRow}>
                  <Text style={[styles.previewLabel, { color: secondaryTextColor }]}>Description:</Text>
                  <Text style={[styles.previewValue, { color: primaryTextColor }]}>{preview.description}</Text>
                </View>
              )}
            </View>

            <View style={styles.buttonRow}>
              <Button
                mode="outlined"
                onPress={handleBackToInput}
                disabled={isSending}
                style={[styles.cancelButton, { borderColor: secondaryTextColor }]}
                textColor={secondaryTextColor}
              >
                Preview Payment
              </Button>

              <Button
                mode="contained"
                onPress={handleSendPayment}
                loading={isSending}
                disabled={isSending}
                style={styles.sendButton}
                buttonColor="#FFC107"
                textColor="#1a1a2e"
              >
                Send Payment
              </Button>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Render Input Form
  return (
    <LinearGradient colors={gradientColors} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: primaryTextColor }]}>Withdraw Funds</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.balanceContainer}>
            <Text style={[styles.balanceLabel, { color: secondaryTextColor }]}>Available Balance:</Text>
            <Text style={styles.balanceAmount}>{balance.toLocaleString()} sats</Text>
            {balanceDisplay.fiatDisplay && (
              <Text style={[styles.balanceFiat, { color: secondaryTextColor }]}>{balanceDisplay.fiatDisplay}</Text>
            )}
          </View>

          <Text style={[styles.label, { color: primaryTextColor }]}>Lightning Invoice or Address:</Text>

          {/* Selected contact indicator */}
          {selectedContact && (
            <View style={styles.selectedContactContainer}>
              <Text style={[styles.selectedContactLabel, { color: secondaryTextColor }]}>Sending to:</Text>
              <View style={styles.selectedContactRow}>
                <Text style={[styles.selectedContactName, { color: primaryTextColor }]}>{selectedContact.name}</Text>
                <IconButton
                  icon="close"
                  iconColor={secondaryTextColor}
                  size={18}
                  onPress={handleClearContact}
                  style={styles.clearContactButton}
                />
              </View>
            </View>
          )}

          <View style={styles.inputWithButtonRow}>
            <TextInput
              mode="outlined"
              placeholder="Paste Lightning invoice (lnbc...) or Lightning address (user@domain.com)"
              value={paymentInput}
              onChangeText={(text) => {
                setPaymentInput(text);
                if (selectedContact && text !== selectedContact.lightningAddress) {
                  setSelectedContact(null);
                }
              }}
              style={[styles.input, styles.inputWithButton]}
              outlineColor={secondaryTextColor}
              activeOutlineColor="#FFC107"
              textColor={primaryTextColor}
              placeholderTextColor={secondaryTextColor}
              multiline
              numberOfLines={3}
            theme={{
              colors: {
                background: undefined, // Let it use default/parent theme
              }
            }}
            />
            {contacts.length > 0 && (
              <IconButton
                icon="contacts"
                iconColor="#FFC107"
                size={24}
                onPress={() => setContactModalVisible(true)}
                style={styles.addressBookButton}
              />
            )}
          </View>

          <Button
            mode="outlined"
            onPress={handleScanQR}
            icon="qrcode-scan"
            style={styles.scanButton}
            textColor="#FFC107"
          >
            Scan QR Code
          </Button>

          {/* Contact Selection Modal */}
          <ContactSelectionModal
            visible={contactModalVisible}
            onDismiss={() => setContactModalVisible(false)}
            onSelect={handleContactSelect}
            contacts={contacts}
            myAddress={addressInfo?.lightningAddress}
          />

          <Text style={[styles.label, { color: primaryTextColor }]}>Amount (leave empty for invoice amount):</Text>

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
                  style={[styles.currencySelector, { backgroundColor: gradientColors[1] || '#16213e' }]}
                  onPress={() => setCurrencyMenuVisible(true)}
                >
                  <Text style={styles.currencySelectorText}>
                    {currencyLabels[inputCurrency]} ▼
                  </Text>
                </TouchableOpacity>
              }
              contentStyle={[styles.currencyMenu, { backgroundColor: gradientColors[0] || '#1a1a2e' }]}
            >
              {currencyOptions.map((currency) => (
                <Menu.Item
                  key={currency}
                  onPress={() => handleCurrencyChange(currency)}
                  title={currencyLabels[currency]}
                  titleStyle={inputCurrency === currency ? styles.currencyMenuItemActive : { color: primaryTextColor }}
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

          <Text style={[styles.label, { color: primaryTextColor }]}>Comment (optional):</Text>

          <TextInput
            mode="outlined"
            placeholder="Payment description"
            value={comment}
            onChangeText={setComment}
            style={styles.input}
            outlineColor={secondaryTextColor}
            activeOutlineColor="#FFC107"
            textColor={primaryTextColor}
            placeholderTextColor={secondaryTextColor}
            theme={{
              colors: {
                background: 'transparent',
              }
            }}
          />

          <Button
            mode="contained"
            onPress={handlePreviewPayment}
            loading={isPreparing}
            disabled={isPreparing || !paymentInput.trim() || (inputCurrency !== 'sats' && isLoadingRates && amount !== '')}
            style={styles.previewButton}
            buttonColor="#FFC107"
            textColor="#1a1a2e"
          >
            Preview Payment
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
  balanceContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFC107',
  },
  label: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 8,
  },
  scanButton: {
    borderColor: '#FFC107',
    marginBottom: 16,
  },
  previewButton: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  previewContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  previewLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    flex: 1,
  },
  previewValue: {
    fontSize: 14,
    color: '#FFFFFF',
    flex: 2,
    textAlign: 'right',
  },
  previewAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  previewFee: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  previewTotal: {
    borderBottomWidth: 0,
    paddingTop: 16,
    marginTop: 8,
  },
  previewTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  previewTotalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFC107',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  sendButton: {
    flex: 1,
  },
  scannerContainer: {
    flex: 1,
    position: 'relative',
  },
  // Scanner overlay styles (matching QRScannerScreen)
  overlay: {
    flex: 1,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  overlayMiddle: {
    flexDirection: 'row',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  scanFrame: {
    width: 250,
    height: 250,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#FFC107',
    borderWidth: 3,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  crosshairHorizontal: {
    position: 'absolute',
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255, 193, 7, 0.8)',
  },
  crosshairVertical: {
    position: 'absolute',
    width: 2,
    height: 40,
    backgroundColor: 'rgba(255, 193, 7, 0.8)',
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    paddingTop: 32,
  },
  scannerText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  // Currency input styles
  balanceFiat: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
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
  // Address book integration styles
  selectedContactContainer: {
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  selectedContactLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
  },
  selectedContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedContactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFC107',
  },
  clearContactButton: {
    margin: 0,
  },
  inputWithButtonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  inputWithButton: {
    flex: 1,
  },
  addressBookButton: {
    marginTop: 8,
    marginLeft: 4,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 8,
  },
});
