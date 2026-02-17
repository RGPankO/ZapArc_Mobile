import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Button, TextInput, Menu } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useAppTheme } from '../../src/contexts/ThemeContext';
import {
  getGradientColors,
  getPrimaryTextColor,
  getSecondaryTextColor,
  getInputBackgroundColor,
  BRAND_COLOR,
} from '../../src/utils/theme-helpers';
import { BreezSparkService, onPaymentReceived } from '../../src/services/breezSparkService';
import { useCurrency, type InputCurrency } from '../../src/hooks/useCurrency';
import { useLightningAddress } from '../../src/hooks/useLightningAddress';
import { StyledTextInput } from '../../src/components';
import { useFeedback } from '../../src/features/wallet/components/FeedbackComponents';
import { t } from '../../src/services/i18nService';

type ReceiveStep = 'input' | 'invoice';
type ReceiveMode = 'invoice' | 'address';
type ReceiveTab = 'lightning' | 'onchain';

// Currency labels for display
const currencyLabels: Record<InputCurrency, string> = {
  sats: 'sats',
  btc: 'BTC',
  usd: 'USD',
  eur: 'EUR',
};

export default function ReceiveScreen() {
  const { themeMode } = useAppTheme();
  const gradientColors = getGradientColors(themeMode);
  const primaryTextColor = getPrimaryTextColor(themeMode);
  const secondaryTextColor = getSecondaryTextColor(themeMode);
  const inputBackgroundColor = getInputBackgroundColor(themeMode);

  const { secondaryFiatCurrency, convertToSats, formatSatsWithFiat, rates, isLoadingRates } = useCurrency();
  const { addressInfo, isRegistered, isLoading: isLoadingAddress, refresh: refreshAddress } = useLightningAddress();
  const { showSuccess } = useFeedback();

  // Refresh Lightning Address state when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refreshAddress();
    }, [refreshAddress])
  );

  const [step, setStep] = useState<ReceiveStep>('input');
  const [activeTab, setActiveTab] = useState<ReceiveTab>('lightning');
  const [receiveMode, setReceiveMode] = useState<ReceiveMode>('invoice');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [invoice, setInvoice] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [expiryTime, setExpiryTime] = useState<number | null>(null);
  const [invoiceSatsAmount, setInvoiceSatsAmount] = useState(0);
  const [onchainRequest, setOnchainRequest] = useState('');
  const [isGeneratingOnchain, setIsGeneratingOnchain] = useState(false);

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

    // Allow zero/empty amount for "any amount" invoices
    let satsAmount = 0;

    if (numAmount && numAmount > 0) {
      // Convert to sats based on input currency
      satsAmount = convertToSats(numAmount, inputCurrency);

      if (!satsAmount || satsAmount <= 0) {
        Alert.alert('Conversion Error', 'Could not convert amount. Please check exchange rates.');
        return;
      }
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

  const parseOnchainRequest = useCallback((request: string) => {
    const trimmed = request.trim();
    if (!trimmed) return { address: '', minimumSats: null as number | null };

    let address = trimmed;
    let minimumSats: number | null = null;

    if (trimmed.toLowerCase().startsWith('bitcoin:')) {
      const withoutScheme = trimmed.slice(8);
      const [rawAddress, rawQuery] = withoutScheme.split('?');
      address = rawAddress || '';

      if (rawQuery) {
        const params = new URLSearchParams(rawQuery);
        const amountBtc = params.get('amount');
        const minimumAmountBtc = params.get('minimumAmount');
        const minAmountSats = params.get('minAmountSats');

        if (minAmountSats && !Number.isNaN(Number(minAmountSats))) {
          minimumSats = Math.floor(Number(minAmountSats));
        } else if (minimumAmountBtc && !Number.isNaN(Number(minimumAmountBtc))) {
          minimumSats = Math.floor(Number(minimumAmountBtc) * 100_000_000);
        } else if (amountBtc && !Number.isNaN(Number(amountBtc))) {
          minimumSats = Math.floor(Number(amountBtc) * 100_000_000);
        }
      }
    }

    return { address, minimumSats };
  }, []);

  const handleGenerateOnchainAddress = useCallback(async () => {
    try {
      setIsGeneratingOnchain(true);
      const request = await BreezSparkService.receiveOnchain();
      setOnchainRequest(request);
    } catch (error) {
      console.error('Failed to generate on-chain address:', error);
      Alert.alert('Error', error instanceof Error ? error.message : t('deposit.generatingAddress'));
    } finally {
      setIsGeneratingOnchain(false);
    }
  }, []);

  const handleTabChange = useCallback(
    (tab: ReceiveTab) => {
      if (tab === activeTab) return;
      setActiveTab(tab);
      setStep('input');

      if (tab === 'onchain' && !onchainRequest) {
        void handleGenerateOnchainAddress();
      }
    },
    [activeTab, onchainRequest, handleGenerateOnchainAddress]
  );

  // Handle currency change
  const handleCurrencyChange = useCallback((currency: InputCurrency) => {
    setInputCurrency(currency);
    setCurrencyMenuVisible(false);
    setAmount(''); // Reset amount when switching currencies
  }, []);

  // Copy Lightning Address to clipboard
  const handleCopyAddress = useCallback(async () => {
    if (!addressInfo?.lightningAddress) return;
    try {
      await Clipboard.setStringAsync(addressInfo.lightningAddress);
      // Android's built-in clipboard notification will show feedback
    } catch (error) {
      console.error('Failed to copy address:', error);
      Alert.alert('Error', 'Failed to copy address');
    }
  }, [addressInfo]);

  const handleCopyOnchainAddress = useCallback(async () => {
    const parsed = parseOnchainRequest(onchainRequest);
    if (!parsed.address) return;

    try {
      await Clipboard.setStringAsync(parsed.address);
    } catch (error) {
      console.error('Failed to copy on-chain address:', error);
      Alert.alert('Error', 'Failed to copy address');
    }
  }, [onchainRequest, parseOnchainRequest]);

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
  useEffect(() => {
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

  // Listen for incoming payment when invoice is displayed
  useEffect(() => {
    if (step !== 'invoice' || !invoice) return;

    const unsubscribe = onPaymentReceived((payment) => {
      // Skip sync events
      if (payment.description === '__SYNC_EVENT__') return;

      // Check if this is a received payment
      if (payment.type === 'receive' && payment.amountSat > 0) {
        const formattedAmount = payment.amountSat.toLocaleString();
        showSuccess(`Payment received: ${formattedAmount} sats`);
        router.replace('/wallet/home');
      }
    });

    return () => unsubscribe();
  }, [step, invoice, showSuccess]);

  const onchainParsed = parseOnchainRequest(onchainRequest);
  const onchainAddress = onchainParsed.address;

  if (step === 'invoice' && activeTab === 'lightning') {
    return (
      <LinearGradient colors={gradientColors} style={styles.gradient}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: primaryTextColor }]}>Deposit Funds</Text>
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

            <Text style={[styles.amountText, { color: primaryTextColor }]}>
              {invoiceSatsAmount > 0 ? (
                <>
                  Amount: {invoiceSatsAmount.toLocaleString()} sats
                  {formatSatsWithFiat(invoiceSatsAmount).fiatDisplay && (
                    <Text style={[styles.amountFiatText, { color: secondaryTextColor }]}>
                      {' '}({formatSatsWithFiat(invoiceSatsAmount).fiatDisplay})
                    </Text>
                  )}
                </>
              ) : (
                <Text style={styles.anyAmountText}>Any Amount</Text>
              )}
            </Text>

            <View style={styles.invoiceContainer}>
              <Text style={[styles.invoiceLabel, { color: secondaryTextColor }]}>Lightning Invoice:</Text>
              <ScrollView
                style={styles.invoiceScroll}
                contentContainerStyle={styles.invoiceScrollContent}
              >
                <Text style={[styles.invoiceText, { color: primaryTextColor }]} selectable>
                  {invoice}
                </Text>
              </ScrollView>
              <Button
                mode="outlined"
                onPress={handleCopyInvoice}
                style={styles.copyButton}
                textColor={BRAND_COLOR}
              >
                Copy
              </Button>
            </View>

            <View style={styles.statusContainer}>
              <Text style={[styles.waitingText, { color: primaryTextColor }]}>⏳ Waiting for payment...</Text>
              <Text style={[styles.expiryText, { color: secondaryTextColor }]}>
                Expires in: {getRemainingTime()}
              </Text>
            </View>

            <Button
              mode="contained"
              onPress={handleNewInvoice}
              style={styles.newInvoiceButton}
              buttonColor={BRAND_COLOR}
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
    <LinearGradient colors={gradientColors} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: primaryTextColor }]}>Deposit Funds</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            onPress={() => handleTabChange('lightning')}
            style={[
              styles.tabButton,
              activeTab === 'lightning' && styles.tabButtonActive,
              { borderColor: BRAND_COLOR },
            ]}
          >
            <Text style={[styles.tabText, { color: activeTab === 'lightning' ? '#1a1a2e' : primaryTextColor }]}>
              {t('deposit.lightningTab')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleTabChange('onchain')}
            style={[
              styles.tabButton,
              activeTab === 'onchain' && styles.tabButtonActive,
              { borderColor: BRAND_COLOR },
            ]}
          >
            <Text style={[styles.tabText, { color: activeTab === 'onchain' ? '#1a1a2e' : primaryTextColor }]}>
              {t('deposit.onchainTab')}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {activeTab === 'lightning' ? (
            <>
              {/* Mode Toggle */}
              <View style={styles.modeToggle}>
                <TouchableOpacity
                  style={[styles.modeButton, receiveMode === 'invoice' && styles.modeButtonActive]}
                  onPress={() => setReceiveMode('invoice')}
                >
                  <Text style={[styles.modeButtonText, { color: receiveMode === 'invoice' ? '#1a1a2e' : secondaryTextColor }]}>⚡ Invoice</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeButton, receiveMode === 'address' && styles.modeButtonActive]}
                  onPress={() => setReceiveMode('address')}
                >
                  <Text style={[styles.modeButtonText, { color: receiveMode === 'address' ? '#1a1a2e' : secondaryTextColor }]}>📧 Address</Text>
                </TouchableOpacity>
              </View>

              {receiveMode === 'address' && (
                <>
                  {isLoadingAddress ? (
                    <View style={styles.addressLoadingContainer}>
                      <Text style={[styles.addressLoadingText, { color: secondaryTextColor }]}>Loading...</Text>
                    </View>
                  ) : isRegistered && addressInfo ? (
                    <View style={styles.addressCard}>
                      <View style={styles.addressQrContainer}>
                        <View style={styles.qrCodeWrapper}>
                          <QRCode value={addressInfo.lightningAddress} size={200} backgroundColor="white" color="black" />
                        </View>
                      </View>

                      <View style={styles.addressDisplay}>
                        <Text style={styles.addressText}>{addressInfo.lightningAddress}</Text>
                      </View>

                      <View style={styles.addressActions}>
                        <Button mode="contained" onPress={handleCopyAddress} style={styles.addressCopyButton} labelStyle={styles.addressCopyButtonLabel} icon="content-copy">
                          Copy
                        </Button>
                        <Button
                          mode="outlined"
                          onPress={() => router.push('/wallet/settings/lightning-address')}
                          style={styles.addressManageButton}
                          textColor={BRAND_COLOR}
                        >
                          Manage
                        </Button>
                      </View>

                      <View style={styles.addressInfoBox}>
                        <Text style={[styles.addressInfoText, { color: secondaryTextColor }]}>Share this address with anyone to receive Lightning payments instantly.</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.claimPromptCard}>
                      <Text style={[styles.claimPromptTitle, { color: primaryTextColor }]}>Lightning Address</Text>
                      <Text style={[styles.claimPromptText, { color: secondaryTextColor }]}>Get a Lightning Address to receive payments without generating invoices.</Text>
                      <Button
                        mode="outlined"
                        onPress={() => router.push('/wallet/settings/lightning-address')}
                        style={styles.claimButton}
                        textColor={BRAND_COLOR}
                        icon="at"
                      >
                        Claim Address
                      </Button>
                    </View>
                  )}
                </>
              )}

              {receiveMode === 'invoice' && (
                <>
                  <Text style={[styles.label, { color: primaryTextColor }]}>Enter amount (leave empty for any amount):</Text>

                  <View style={styles.amountInputRow}>
                    <StyledTextInput
                      label={`Amount in ${currencyLabels[inputCurrency]}`}
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="decimal-pad"
                      style={[styles.input, styles.amountInput]}
                    />

                    <Menu
                      visible={currencyMenuVisible}
                      onDismiss={() => setCurrencyMenuVisible(false)}
                      anchor={
                        <TouchableOpacity
                          style={[styles.currencySelector, { backgroundColor: gradientColors[1] || '#16213e' }]}
                          onPress={() => setCurrencyMenuVisible(true)}
                        >
                          <Text style={styles.currencySelectorText}>{currencyLabels[inputCurrency]} ▼</Text>
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

                  {previewDisplay && previewSats > 0 && inputCurrency !== 'sats' && (
                    <View style={styles.conversionPreview}>
                      <Text style={styles.conversionText}>≈ {previewDisplay.satsDisplay}</Text>
                      {previewDisplay.fiatDisplay && <Text style={styles.conversionFiat}>({previewDisplay.fiatDisplay})</Text>}
                    </View>
                  )}

                  <View style={styles.presetsContainer}>
                    {presets.map((preset) => (
                      <Button
                        key={preset}
                        mode="outlined"
                        onPress={() => handlePresetAmount(preset)}
                        style={[styles.presetButton, { borderColor: secondaryTextColor }]}
                        contentStyle={styles.presetButtonContent}
                        labelStyle={styles.presetButtonLabel}
                        textColor={primaryTextColor}
                      >
                        {formatPresetLabel(preset)}
                      </Button>
                    ))}
                  </View>

                  <StyledTextInput
                    label="Description (optional)"
                    value={description}
                    onChangeText={setDescription}
                    style={[styles.input, styles.descriptionInput, { backgroundColor: inputBackgroundColor }]}
                    outlineColor={secondaryTextColor}
                    activeOutlineColor={BRAND_COLOR}
                    textColor={primaryTextColor}
                    placeholderTextColor={secondaryTextColor}
                    outlineStyle={styles.inputOutline}
                    contentStyle={styles.inputContent}
                    multiline
                    numberOfLines={2}
                    theme={{
                      colors: {
                        background: inputBackgroundColor,
                        onSurfaceVariant: secondaryTextColor,
                      },
                    }}
                  />

                  <Button
                    mode="contained"
                    onPress={handleGenerateInvoice}
                    loading={isGenerating}
                    disabled={isGenerating || (amount !== '' && inputCurrency !== 'sats' && isLoadingRates)}
                    style={styles.generateButton}
                    buttonColor={BRAND_COLOR}
                    textColor="#1a1a2e"
                  >
                    {isLoadingRates && inputCurrency !== 'sats' && amount !== ''
                      ? 'Loading rates...'
                      : amount === ''
                        ? 'Generate Any Amount Invoice'
                        : 'Generate Invoice'}
                  </Button>
                </>
              )}
            </>
          ) : (
            <View style={styles.onchainContainer}>
              <Text style={[styles.onchainTitle, { color: primaryTextColor }]}>{t('deposit.onchainTitle')}</Text>
              <Text style={[styles.onchainDescription, { color: secondaryTextColor }]}>{t('deposit.onchainDescription')}</Text>

              {isGeneratingOnchain ? (
                <Text style={[styles.generatingText, { color: secondaryTextColor }]}>{t('deposit.generatingAddress')}</Text>
              ) : onchainAddress ? (
                <>
                  <View style={styles.qrContainer}>
                    <View style={styles.qrCodeWrapper}>
                      <QRCode value={onchainRequest} size={220} backgroundColor="white" color="black" />
                    </View>
                  </View>

                  <Text style={[styles.invoiceLabel, { color: secondaryTextColor }]}>{t('deposit.bitcoinAddress')}</Text>
                  <View style={styles.invoiceContainer}>
                    <Text style={[styles.invoiceText, { color: primaryTextColor }]} selectable>
                      {onchainAddress}
                    </Text>
                    <Button mode="outlined" onPress={handleCopyOnchainAddress} style={styles.copyButton} textColor={BRAND_COLOR}>
                      {t('deposit.copyAddress')}
                    </Button>
                  </View>

                  {onchainParsed.minimumSats !== null && (
                    <Text style={[styles.minimumText, { color: secondaryTextColor }]}> 
                      {t('deposit.minimumDeposit').replace('{{amount}}', onchainParsed.minimumSats.toLocaleString())}
                    </Text>
                  )}

                  <Text style={[styles.onchainNote, { color: secondaryTextColor }]}>{t('deposit.onchainNote')}</Text>
                </>
              ) : null}
            </View>
          )}
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
    color: BRAND_COLOR,
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
    paddingTop: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 14,
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    gap: 6,
  },
  tabButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: BRAND_COLOR,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
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
    borderColor: BRAND_COLOR,
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
    borderColor: BRAND_COLOR,
    minWidth: 75,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  currencySelectorText: {
    color: BRAND_COLOR,
    fontSize: 14,
    fontWeight: '600',
  },
  currencyMenu: {
    backgroundColor: '#1a1a2e',
  },
  currencyMenuItemActive: {
    color: BRAND_COLOR,
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
    color: BRAND_COLOR,
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
  anyAmountText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: BRAND_COLOR,
  },
  // Mode toggle styles
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: BRAND_COLOR,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  modeButtonTextActive: {
    color: '#1a1a2e',
  },
  // Lightning Address styles
  addressLoadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  addressLoadingText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
  addressCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
  },
  addressQrContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  addressDisplay: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  addressText: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_COLOR,
    fontFamily: 'monospace',
  },
  addressActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  addressCopyButton: {
    flex: 1,
    backgroundColor: BRAND_COLOR,
    borderRadius: 8,
  },
  addressCopyButtonLabel: {
    color: '#1a1a2e',
    fontWeight: '600',
  },
  addressManageButton: {
    flex: 1,
    borderColor: BRAND_COLOR,
    borderRadius: 8,
  },
  addressInfoBox: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 8,
    padding: 12,
  },
  addressInfoText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 18,
  },
  // Claim prompt styles
  claimPromptCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  claimPromptTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  claimPromptText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  claimButton: {
    borderColor: BRAND_COLOR,
    borderRadius: 8,
  },
  onchainContainer: {
    gap: 12,
  },
  onchainTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  onchainDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  generatingText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },
  minimumText: {
    fontSize: 13,
    marginTop: 2,
  },
  onchainNote: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
});
