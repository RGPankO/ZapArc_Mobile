import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Button, Menu, Snackbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
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

type ReceiveTab = 'lightning' | 'onchain';

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

  const { secondaryFiatCurrency, convertToSats, formatSatsWithFiat, isLoadingRates } = useCurrency();
  const { addressInfo, isRegistered, isLoading: isLoadingAddress, refresh: refreshAddress } = useLightningAddress();
  const { showSuccess } = useFeedback();

  useFocusEffect(
    useCallback(() => {
      refreshAddress();
    }, [refreshAddress])
  );

  const [activeTab, setActiveTab] = useState<ReceiveTab>('lightning');

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [invoice, setInvoice] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [expiryTime, setExpiryTime] = useState<number | null>(null);
  const [invoiceSatsAmount, setInvoiceSatsAmount] = useState(0);

  const [onchainRequest, setOnchainRequest] = useState('');
  const [isGeneratingOnchain, setIsGeneratingOnchain] = useState(false);
  const [onchainError, setOnchainError] = useState<string | null>(null);

  const [inputCurrency, setInputCurrency] = useState<InputCurrency>('sats');
  const [currencyMenuVisible, setCurrencyMenuVisible] = useState(false);

  const currencyOptions: InputCurrency[] = useMemo(() => {
    return ['sats', secondaryFiatCurrency];
  }, [secondaryFiatCurrency]);

  const previewSats = useMemo(() => {
    const numAmount = parseFloat(amount);
    if (!numAmount || isNaN(numAmount)) return 0;
    return convertToSats(numAmount, inputCurrency);
  }, [amount, inputCurrency, convertToSats]);

  const previewDisplay = useMemo(() => {
    if (!previewSats) return null;
    return formatSatsWithFiat(previewSats);
  }, [previewSats, formatSatsWithFiat]);

  const presets = useMemo(() => {
    switch (inputCurrency) {
      case 'eur':
      case 'usd':
        return [10, 25, 50, 100];
      case 'btc':
        return [0.0001, 0.0005, 0.001, 0.005];
      case 'sats':
      default:
        return [10000, 50000, 100000, 500000];
    }
  }, [inputCurrency]);

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
    let satsAmount = 0;

    if (numAmount && numAmount > 0) {
      satsAmount = convertToSats(numAmount, inputCurrency);
      if (!satsAmount || satsAmount <= 0) {
        Alert.alert(t('common.error'), t('deposit.conversionError'));
        return;
      }
    }

    try {
      setIsGenerating(true);
      const result = await BreezSparkService.receivePayment(satsAmount, description || undefined);

      setInvoice(result.paymentRequest);
      setInvoiceSatsAmount(satsAmount);
      setExpiryTime(Date.now() + 15 * 60 * 1000);
    } catch (error) {
      console.error('Failed to generate invoice:', error);
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('deposit.generateInvoiceFailed'));
    } finally {
      setIsGenerating(false);
    }
  }, [amount, description, inputCurrency, convertToSats]);

  const [snackMsg, setSnackMsg] = useState('');
  const [snackVisible, setSnackVisible] = useState(false);

  const showCopyToast = useCallback((label: string) => {
    setSnackMsg(`${label} copied`);
    setSnackVisible(true);
  }, []);

  const handleCopyInvoice = useCallback(async () => {
    if (!invoice) return;
    try {
      await Clipboard.setStringAsync(invoice);
      showCopyToast('Invoice');
    } catch (error) {
      console.error('Failed to copy invoice:', error);
      Alert.alert(t('common.error'), t('deposit.copyFailed'));
    }
  }, [invoice, showCopyToast]);

  const handleNewInvoice = useCallback(() => {
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
      setOnchainError(null);
      const request = await BreezSparkService.receiveOnchain();
      setOnchainRequest(request);
    } catch (error) {
      console.error('Failed to generate on-chain address:', error);
      const message = error instanceof Error ? error.message : t('deposit.generatingAddress');
      setOnchainError(message);
    } finally {
      setIsGeneratingOnchain(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'onchain') {
      void handleGenerateOnchainAddress();
    }
  }, [activeTab, handleGenerateOnchainAddress]);

  const handleTabChange = useCallback((tab: ReceiveTab) => {
    if (activeTab === tab) return;
    setActiveTab(tab);
  }, [activeTab]);

  const handleCurrencyChange = useCallback((currency: InputCurrency) => {
    setInputCurrency(currency);
    setCurrencyMenuVisible(false);
    setAmount('');
  }, []);

  const handleCopyAddress = useCallback(async () => {
    if (!addressInfo?.lightningAddress) return;
    try {
      await Clipboard.setStringAsync(addressInfo.lightningAddress);
      showCopyToast('Lightning Address');
    } catch (error) {
      console.error('Failed to copy address:', error);
      Alert.alert(t('common.error'), t('deposit.copyFailed'));
    }
  }, [addressInfo, showCopyToast]);

  const onchainParsed = parseOnchainRequest(onchainRequest);
  const onchainAddress = onchainParsed.address;

  const handleCopyOnchainAddress = useCallback(async () => {
    if (!onchainAddress) return;
    try {
      await Clipboard.setStringAsync(onchainAddress);
      showCopyToast('Bitcoin Address');
    } catch (error) {
      console.error('Failed to copy on-chain address:', error);
      Alert.alert(t('common.error'), t('deposit.copyFailed'));
    }
  }, [onchainAddress, showCopyToast]);

  const getRemainingTime = useCallback(() => {
    if (!expiryTime) return '';
    const remaining = Math.max(0, expiryTime - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [expiryTime]);

  const [, setTick] = useState(0);
  useEffect(() => {
    if (!invoice || !expiryTime) return;

    const interval = setInterval(() => {
      setTick((tVal) => tVal + 1);
      if (Date.now() >= expiryTime) {
        clearInterval(interval);
        handleNewInvoice();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [invoice, expiryTime, handleNewInvoice]);

  useEffect(() => {
    if (!invoice) return;

    const unsubscribe = onPaymentReceived((payment) => {
      if (payment.description === '__SYNC_EVENT__') return;
      if (payment.type === 'receive' && payment.amountSat > 0) {
        const formattedAmount = payment.amountSat.toLocaleString();
        showSuccess(`Payment received: ${formattedAmount} sats`);
        router.replace('/wallet/home');
      }
    });

    return () => unsubscribe();
  }, [invoice, showSuccess]);

  const isLightningTab = activeTab === 'lightning';

  return (
    <LinearGradient colors={gradientColors} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: primaryTextColor }]}>{t('wallet.receive')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            onPress={() => handleTabChange('lightning')}
            style={[
              styles.tabButton,
              isLightningTab && styles.tabButtonActive,
              { borderColor: BRAND_COLOR },
            ]}
          >
            <Text style={[styles.tabText, { color: isLightningTab ? '#1a1a2e' : primaryTextColor }]}>
              {t('deposit.lightningTab')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleTabChange('onchain')}
            style={[
              styles.tabButton,
              !isLightningTab && styles.tabButtonActive,
              { borderColor: BRAND_COLOR },
            ]}
          >
            <Text style={[styles.tabText, { color: !isLightningTab ? '#1a1a2e' : primaryTextColor }]}>
              {t('deposit.onchainTab')}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {isLightningTab ? (
            <View style={styles.card}>
              <Text style={[styles.sectionTitle, { color: primaryTextColor }]}>{t('deposit.lightningAddressSectionTitle')}</Text>

              {isLoadingAddress ? (
                <View style={styles.addressLoadingContainer}>
                  <Text style={[styles.addressLoadingText, { color: secondaryTextColor }]}>{t('common.loading')}</Text>
                </View>
              ) : isRegistered && addressInfo?.lightningAddress ? (
                <View style={styles.inlineValueRow}>
                  <Text style={styles.inlineValueText} numberOfLines={1} ellipsizeMode="middle">
                    {addressInfo.lightningAddress}
                  </Text>
                  <Button mode="outlined" onPress={handleCopyAddress} compact textColor={BRAND_COLOR} style={styles.inlineCopyButton}>
                    {t('deposit.copyAddress')}
                  </Button>
                </View>
              ) : (
                <View style={styles.manageAddressRow}>
                  <Text style={[styles.helperText, { color: secondaryTextColor }]}>{t('deposit.noAddressYet')}</Text>
                  <Button
                    mode="contained"
                    onPress={() => router.push('/wallet/settings/lightning-address')}
                    compact
                    buttonColor={BRAND_COLOR}
                    textColor="#1a1a2e"
                    style={styles.manageButton}
                  >
                    Manage
                  </Button>
                </View>
              )}

              <Text style={[styles.sectionTitle, styles.invoiceSectionTitle, { color: primaryTextColor }]}>{t('deposit.invoiceSectionTitle')}</Text>
              <Text style={[styles.label, { color: primaryTextColor }]}>{t('deposit.enterAmount')}</Text>

              <View style={styles.amountInputRow}>
                <StyledTextInput
                  label={`${t('payments.amount')} (${currencyLabels[inputCurrency]})`}
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
                label={t('payments.description')}
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
                  ? t('common.loading')
                  : amount === ''
                    ? t('deposit.generateAnyAmountInvoice')
                    : t('payments.generateInvoice')}
              </Button>

              {invoice ? (
                <View style={styles.generatedSection}>
                  <Text style={[styles.amountText, { color: primaryTextColor }]}> 
                    {invoiceSatsAmount > 0
                      ? `${t('payments.amount')}: ${invoiceSatsAmount.toLocaleString()} sats`
                      : t('deposit.anyAmount')}
                  </Text>

                  <View style={styles.qrContainer}>
                    <QRCode
                      value={invoice}
                      size={200}
                      backgroundColor="transparent"
                      color={primaryTextColor}
                    />
                  </View>

                  <View style={styles.invoiceContainer}>
                    <Text style={[styles.invoiceLabel, { color: secondaryTextColor }]}>{t('payments.invoice')}</Text>
                    <View style={styles.inlineValueRow}>
                      <Text style={[styles.invoiceTextSingleLine, { color: primaryTextColor }]} numberOfLines={1} ellipsizeMode="middle">
                        {invoice}
                      </Text>
                      <Button mode="outlined" onPress={handleCopyInvoice} compact textColor={BRAND_COLOR} style={styles.inlineCopyButton}>
                        {t('deposit.copyAddress')}
                      </Button>
                    </View>
                  </View>

                  <Text style={[styles.expiryText, { color: secondaryTextColor }]}>⏳ {t('deposit.expiresIn')}: {getRemainingTime()}</Text>

                  <Button mode="text" onPress={handleNewInvoice} textColor={BRAND_COLOR}>
                    {t('deposit.newInvoice')}
                  </Button>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={[styles.card, styles.onchainCard]}>
              <Text style={[styles.sectionTitle, { color: primaryTextColor }]}>{t('deposit.onchainSectionTitle')}</Text>
              <Text style={[styles.sectionSubtitle, { color: secondaryTextColor }]}>{t('deposit.onchainSectionSubtitle')}</Text>

              {isGeneratingOnchain ? (
                <Text style={[styles.generatingText, { color: secondaryTextColor }]}>{t('deposit.generatingAddress')}</Text>
              ) : onchainError ? (
                <View style={styles.errorWrap}>
                  <Text style={[styles.errorText, { color: secondaryTextColor }]}>{onchainError}</Text>
                  <Button mode="outlined" onPress={handleGenerateOnchainAddress} textColor={BRAND_COLOR}>
                    {t('common.retry')}
                  </Button>
                </View>
              ) : onchainAddress ? (
                <>
                  <Text style={[styles.invoiceLabel, { color: secondaryTextColor }]}>{t('deposit.bitcoinAddress')}</Text>
                  <View style={styles.inlineValueRow}>
                    <Text style={[styles.inlineValueText, styles.onchainAddressText]} numberOfLines={1} ellipsizeMode="middle">
                      {onchainAddress}
                    </Text>
                    <Button mode="outlined" onPress={handleCopyOnchainAddress} compact textColor={BRAND_COLOR} style={styles.inlineCopyButton}>
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
      <Snackbar
        visible={snackVisible}
        onDismiss={() => setSnackVisible(false)}
        duration={2000}
        style={styles.snackbar}
      >
        {snackMsg}
      </Snackbar>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: { fontSize: 16, color: BRAND_COLOR, fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  headerSpacer: { width: 60 },
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
  scrollView: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 16, paddingBottom: 36 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 16,
    marginBottom: 16,
  },
  onchainCard: {
    backgroundColor: 'rgba(255,193,7,0.06)',
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  snackbar: { marginBottom: 16 },
  qrContainer: { alignItems: 'center', marginVertical: 16, padding: 16, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 12, alignSelf: 'center' },
  invoiceSectionTitle: { marginTop: 20 },
  sectionSubtitle: { fontSize: 13, marginBottom: 14 },
  helperText: { fontSize: 13, marginBottom: 2 },
  manageAddressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  manageButton: { borderRadius: 8 },
  label: { fontSize: 15, marginBottom: 12 },
  input: { marginBottom: 16 },
  inputOutline: { borderRadius: 8 },
  inputContent: { paddingTop: 8 },
  descriptionInput: { marginTop: 8 },
  amountInputRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 16 },
  amountInput: { flex: 1, marginBottom: 0, backgroundColor: undefined },
  currencySelector: {
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
  currencySelectorText: { color: BRAND_COLOR, fontSize: 14, fontWeight: '600' },
  currencyMenu: { backgroundColor: '#1a1a2e' },
  currencyMenuItemActive: { color: BRAND_COLOR, fontWeight: 'bold' },
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
  conversionText: { color: BRAND_COLOR, fontSize: 16, fontWeight: '600' },
  conversionFiat: { color: 'rgba(255, 255, 255, 0.7)', fontSize: 14 },
  presetsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 8 },
  presetButton: { flex: 1, borderColor: 'rgba(255, 255, 255, 0.3)' },
  presetButtonContent: { paddingHorizontal: 4, paddingVertical: 6 },
  presetButtonLabel: { fontSize: 13, marginHorizontal: 0 },
  generateButton: { marginTop: 8 },
  generatedSection: { marginTop: 20 },
  amountText: { fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  invoiceContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  invoiceLabel: { fontSize: 13, marginBottom: 6 },
  invoiceTextSingleLine: { flex: 1, fontSize: 11, fontFamily: 'monospace', lineHeight: 16 },
  expiryText: { textAlign: 'center', fontSize: 14 },
  generatingText: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  errorWrap: { gap: 10, marginTop: 8 },
  errorText: { fontSize: 14 },
  minimumText: { fontSize: 13, marginTop: 10 },
  onchainNote: { fontSize: 13, lineHeight: 18, marginTop: 8 },
  addressLoadingContainer: { paddingVertical: 10, alignItems: 'center' },
  addressLoadingText: { fontSize: 14 },
  inlineValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  inlineValueText: { flex: 1, color: BRAND_COLOR, fontFamily: 'monospace', fontSize: 13 },
  onchainAddressText: { color: '#ffd54f' },
  inlineCopyButton: { borderColor: BRAND_COLOR },
});