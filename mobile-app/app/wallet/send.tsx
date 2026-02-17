import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Button, Menu, IconButton } from 'react-native-paper';
import { StyledTextInput } from '../../src/components';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getGradientColors,
  getPrimaryTextColor,
  getSecondaryTextColor,
  BRAND_COLOR,
} from '../../src/utils/theme-helpers';
import { useAppTheme } from '../../src/contexts/ThemeContext';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useWallet } from '../../src/hooks/useWallet';
import { BreezSparkService } from '../../src/services/breezSparkService';
import { useCurrency, type InputCurrency } from '../../src/hooks/useCurrency';
import { useLightningAddress } from '../../src/hooks/useLightningAddress';
import { useContacts } from '../../src/features/addressBook/hooks/useContacts';
import { ContactSelectionModal } from '../../src/features/addressBook/components/ContactSelectionModal';
import { Contact } from '../../src/features/addressBook/types';
import { t } from '../../src/services/i18nService';

type SendStep = 'input' | 'preview' | 'onchain-preview' | 'scanning';
type ConfirmationSpeed = 'fast' | 'medium' | 'slow';
type SendTab = 'lightning' | 'onchain';

interface OnchainFeeQuote {
  feeSats: number;
  estimatedConfirmationTime?: string;
}

interface PaymentPreview {
  recipient: string;
  amount: number;
  fee: number;
  total: number;
  description?: string;
}

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
  const { secondaryFiatCurrency, convertToSats, formatSatsWithFiat, isLoadingRates } = useCurrency();
  const { contacts } = useContacts();
  const { addressInfo } = useLightningAddress();

  const [step, setStep] = useState<SendStep>('input');
  const [activeTab, setActiveTab] = useState<SendTab>('lightning');
  const [paymentInput, setPaymentInput] = useState('');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [preview, setPreview] = useState<PaymentPreview | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [prepareResponse, setPrepareResponse] = useState<any>(null);
  const [scanned, setScanned] = useState(false);
  const [onchainFeeQuotes, setOnchainFeeQuotes] = useState<
    | { fast: OnchainFeeQuote; medium: OnchainFeeQuote; slow: OnchainFeeQuote }
    | null
  >(null);
  const [selectedSpeed, setSelectedSpeed] = useState<ConfirmationSpeed>('medium');

  const [inputCurrency, setInputCurrency] = useState<InputCurrency>('sats');
  const [currencyMenuVisible, setCurrencyMenuVisible] = useState(false);

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [contactModalVisible, setContactModalVisible] = useState(false);

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

  const balanceDisplay = useMemo(() => {
    return formatSatsWithFiat(balance);
  }, [balance, formatSatsWithFiat]);

  const getOnchainFeeQuote = useCallback(
    (
      speed: ConfirmationSpeed,
      feeQuotes?: { fast: OnchainFeeQuote; medium: OnchainFeeQuote; slow: OnchainFeeQuote } | null
    ) => {
      if (!feeQuotes) return 0;
      return Number(feeQuotes[speed]?.feeSats || 0);
    },
    []
  );

  const formatEstimatedTime = useCallback((value?: string, fallbackMinutes?: string) => {
    const base = value || fallbackMinutes || '0';
    const minutes = base.replace(/[^0-9]/g, '') || base;
    return t('send.estimatedTime').replace('%s', minutes);
  }, []);

  const resetFormState = useCallback(() => {
    setPaymentInput('');
    setAmount('');
    setComment('');
    setPreview(null);
    setPrepareResponse(null);
    setOnchainFeeQuotes(null);
    setSelectedSpeed('medium');
    setSelectedContact(null);
    setCurrencyMenuVisible(false);
    setInputCurrency('sats');
  }, []);

  const handleTabChange = useCallback(
    (tab: SendTab) => {
      if (activeTab === tab) return;
      setActiveTab(tab);
      resetFormState();
    },
    [activeTab, resetFormState]
  );

  const handleCurrencyChange = useCallback((currency: InputCurrency) => {
    setInputCurrency(currency);
    setCurrencyMenuVisible(false);
    setAmount('');
  }, []);

  const handleContactSelect = useCallback((contact: Contact) => {
    setSelectedContact(contact);
    setPaymentInput(contact.lightningAddress);
    setContactModalVisible(false);
  }, []);

  const handleClearContact = useCallback(() => {
    setSelectedContact(null);
    setPaymentInput('');
  }, []);

  useEffect(() => {
    if (activeTab !== 'lightning') return;

    const trimmedInput = paymentInput.trim();
    if (!trimmedInput) return;

    const timeoutId = setTimeout(async () => {
      try {
        const parsed = await BreezSparkService.parsePaymentRequest(trimmedInput);
        if (parsed.isValid && parsed.type === 'bolt11' && parsed.amountSat !== undefined) {
          setAmount(parsed.amountSat.toString());
        }
      } catch (error) {
        if (trimmedInput.length > 10) {
          console.error('❌ [Send] Failed to parse payment request:', error);
        }
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [paymentInput, activeTab]);

  const handleScanQR = useCallback(async () => {
    if (permission?.granted) {
      setScanned(false);
      setStep('scanning');
      return;
    }

    const response = await requestPermission();
    if (response.granted) {
      setScanned(false);
      setStep('scanning');
    } else {
      Alert.alert('Permission Required', 'Camera permission is required to scan QR codes');
    }
  }, [permission, requestPermission]);

  const handleBarCodeScanned = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      if (scanned) return;
      setScanned(true);

      setPaymentInput(data);
      setStep('input');

      if (activeTab === 'lightning') {
        try {
          const parsed = await BreezSparkService.parsePaymentRequest(data);
          if (parsed.isValid && parsed.type === 'bolt11' && parsed.amountSat !== undefined) {
            setAmount(parsed.amountSat.toString());
          }
        } catch (error) {
          console.error('Failed to parse scanned QR code:', error);
        }
      }
    },
    [scanned, activeTab]
  );

  const handlePreviewPayment = useCallback(async () => {
    if (!paymentInput.trim()) {
      Alert.alert('Error', t('send.enterDestination'));
      return;
    }

    try {
      setIsPreparing(true);

      const parsedRequest = await BreezSparkService.parsePaymentRequest(paymentInput.trim());
      const isOnchainFlow = activeTab === 'onchain';

      if (!parsedRequest.isValid) {
        Alert.alert('Invalid Payment Request', t('send.invalidPaymentRequest'));
        return;
      }

      if (isOnchainFlow && parsedRequest.type !== 'bitcoinAddress') {
        Alert.alert('Invalid Bitcoin Address', t('send.invalidOnchainAddress'));
        return;
      }

      if (!isOnchainFlow && parsedRequest.type === 'bitcoinAddress') {
        Alert.alert('Lightning Only', t('send.invalidLightningDestination'));
        return;
      }

      let paymentAmount: number;
      if (isOnchainFlow) {
        const satsAmount = Math.floor(Number(amount));
        if (!satsAmount || satsAmount <= 0) {
          Alert.alert('Error', t('send.amountRequiredOnchain'));
          return;
        }
        paymentAmount = satsAmount;
      } else if (parsedRequest.type === 'bolt11' && parsedRequest.amountSat !== undefined) {
        paymentAmount = parsedRequest.amountSat;
      } else {
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

      if (paymentAmount > balance) {
        Alert.alert(
          'Insufficient Balance',
          `You have ${balance.toLocaleString()} sats but trying to send ${paymentAmount.toLocaleString()} sats`
        );
        return;
      }

      const prepared = await BreezSparkService.prepareSendPayment(paymentInput.trim(), paymentAmount);
      setPrepareResponse(prepared);

      let feeAmount = 0;
      let extractedFeeQuotes: { fast: OnchainFeeQuote; medium: OnchainFeeQuote; slow: OnchainFeeQuote } | null = null;
      if (prepared.paymentMethod) {
        const method = prepared.paymentMethod;
        const methodInner = method.inner || method;
        if (method.tag === 'Bolt11Invoice' || method.tag === 'SparkInvoice') {
          feeAmount = Number(method.inner?.lightningFeeSats || 0);
          if (method.inner?.sparkTransferFeeSats) {
            feeAmount += Number(method.inner.sparkTransferFeeSats);
          }
        } else if (method.tag === 'BitcoinAddress' || method.type === 'bitcoinAddress') {
          const feeQuote = methodInner?.feeQuote || method?.feeQuote;
          if (feeQuote?.speedFast || feeQuote?.speedMedium || feeQuote?.speedSlow) {
            extractedFeeQuotes = {
              fast: {
                feeSats: Number(feeQuote.speedFast?.feeSats || 0),
                estimatedConfirmationTime: feeQuote.speedFast?.estimatedConfirmationTime,
              },
              medium: {
                feeSats: Number(feeQuote.speedMedium?.feeSats || 0),
                estimatedConfirmationTime: feeQuote.speedMedium?.estimatedConfirmationTime,
              },
              slow: {
                feeSats: Number(feeQuote.speedSlow?.feeSats || 0),
                estimatedConfirmationTime: feeQuote.speedSlow?.estimatedConfirmationTime,
              },
            };
            feeAmount = getOnchainFeeQuote(selectedSpeed, extractedFeeQuotes);
          } else {
            feeAmount = Number(methodInner?.feeQuote?.feeSats || 0);
          }
        }
      }

      if (isOnchainFlow) {
        const defaultSpeed: ConfirmationSpeed = 'medium';
        setSelectedSpeed(defaultSpeed);
        setOnchainFeeQuotes(extractedFeeQuotes);
        feeAmount = extractedFeeQuotes ? getOnchainFeeQuote(defaultSpeed, extractedFeeQuotes) : feeAmount;
      } else {
        setOnchainFeeQuotes(null);
      }

      const totalAmount = paymentAmount + feeAmount;

      if (totalAmount > balance) {
        Alert.alert(
          'Insufficient Balance',
          `Total (${totalAmount.toLocaleString()} sats including ${feeAmount.toLocaleString()} sats fee) exceeds your balance of ${balance.toLocaleString()} sats`
        );
        return;
      }

      const paymentPreview: PaymentPreview = {
        recipient: paymentInput.trim(),
        amount: paymentAmount,
        fee: feeAmount,
        total: totalAmount,
        description: parsedRequest.description || comment || undefined,
      };

      setPreview(paymentPreview);
      setStep(isOnchainFlow ? 'onchain-preview' : 'preview');
    } catch (error) {
      console.error('Failed to prepare payment:', error);

      let errorMessage = error instanceof Error ? error.message : 'Failed to prepare payment';
      if (errorMessage.includes('Network request failed') || errorMessage.includes('Failed to resolve')) {
        errorMessage = 'Could not reach the Lightning Address provider. Please check the address is correct (e.g., user@wallet.com).';
      }

      Alert.alert('Payment Error', errorMessage);
    } finally {
      setIsPreparing(false);
    }
  }, [paymentInput, amount, comment, balance, inputCurrency, convertToSats, getOnchainFeeQuote, selectedSpeed, activeTab]);

  const handleSendPayment = useCallback(async () => {
    if (!preview || !prepareResponse) {
      return;
    }

    try {
      setIsSending(true);

      const isOnchainFlow = step === 'onchain-preview';
      const result = isOnchainFlow
        ? await BreezSparkService.sendOnchainPayment(prepareResponse, selectedSpeed)
        : await BreezSparkService.sendPayment(prepareResponse, paymentInput, preview.amount);

      if (result.success) {
        await refreshBalance();
        await new Promise(resolve => setTimeout(resolve, 1000));
        router.navigate('/wallet/home');
      } else {
        Alert.alert('Payment Failed', result.error || 'Unknown error occurred');
        setStep('input');
      }
    } catch (error) {
      console.error('Failed to send payment:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to send payment');
      setStep('input');
    } finally {
      setIsSending(false);
    }
  }, [preview, prepareResponse, refreshBalance, step, selectedSpeed, paymentInput]);

  const handleBackToInput = useCallback(() => {
    setStep('input');
    setPreview(null);
    setPrepareResponse(null);
    setOnchainFeeQuotes(null);
    setSelectedSpeed('medium');
  }, []);

  const handleSelectSpeed = useCallback(
    (speed: ConfirmationSpeed) => {
      if (!preview) {
        setSelectedSpeed(speed);
        return;
      }

      const feeAmount = getOnchainFeeQuote(speed, onchainFeeQuotes);
      const totalAmount = preview.amount + feeAmount;
      if (totalAmount > balance) {
        Alert.alert(
          'Insufficient Balance',
          'Total (' +
            totalAmount.toLocaleString() +
            ' sats including ' +
            feeAmount.toLocaleString() +
            ' sats fee) exceeds your balance of ' +
            balance.toLocaleString() +
            ' sats'
        );
        return;
      }

      setSelectedSpeed(speed);
      setPreview({
        ...preview,
        fee: feeAmount,
        total: totalAmount,
      });
    },
    [preview, onchainFeeQuotes, balance, getOnchainFeeQuote]
  );

  const speedOptions = useMemo(
    () => [
      {
        key: 'fast' as ConfirmationSpeed,
        label: t('send.speedFast'),
        time: formatEstimatedTime(onchainFeeQuotes?.fast?.estimatedConfirmationTime, '10'),
        fee: Number(onchainFeeQuotes?.fast?.feeSats || 0),
      },
      {
        key: 'medium' as ConfirmationSpeed,
        label: t('send.speedMedium'),
        time: formatEstimatedTime(onchainFeeQuotes?.medium?.estimatedConfirmationTime, '30'),
        fee: Number(onchainFeeQuotes?.medium?.feeSats || 0),
      },
      {
        key: 'slow' as ConfirmationSpeed,
        label: t('send.speedSlow'),
        time: formatEstimatedTime(onchainFeeQuotes?.slow?.estimatedConfirmationTime, '60'),
        fee: Number(onchainFeeQuotes?.slow?.feeSats || 0),
      },
    ],
    [onchainFeeQuotes, formatEstimatedTime]
  );

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
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            />
            <View style={styles.overlay}>
              <View style={styles.overlayTop} />
              <View style={styles.overlayMiddle}>
                <View style={styles.overlaySide} />
                <View style={styles.scanFrame}>
                  <View style={[styles.corner, styles.cornerTopLeft]} />
                  <View style={[styles.corner, styles.cornerTopRight]} />
                  <View style={[styles.corner, styles.cornerBottomLeft]} />
                  <View style={[styles.corner, styles.cornerBottomRight]} />
                  <View style={styles.crosshairHorizontal} />
                  <View style={styles.crosshairVertical} />
                </View>
                <View style={styles.overlaySide} />
              </View>
              <View style={styles.overlayBottom}>
                <Text style={styles.scannerText}>
                  {activeTab === 'onchain' ? t('send.scanOnchainQr') : t('send.scanLightningQr')}
                </Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if ((step === 'preview' || step === 'onchain-preview') && preview) {
    const isOnchainPreview = step === 'onchain-preview';

    return (
      <LinearGradient colors={gradientColors} style={styles.gradient}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBackToInput}>
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: primaryTextColor }]}>{isOnchainPreview ? t('send.onchainTitle') : t('wallet.send')}</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <Text style={[styles.sectionTitle, { color: primaryTextColor }]}>Payment Preview</Text>

            {isOnchainPreview && (
              <View style={styles.onchainSelectorContainer}>
                <Text style={[styles.label, { color: primaryTextColor }]}>{t('send.confirmationSpeed')}</Text>
                <View style={styles.speedSelectorRow}>
                  {speedOptions.map((option) => {
                    const isSelected = selectedSpeed === option.key;
                    return (
                      <TouchableOpacity
                        key={option.key}
                        onPress={() => handleSelectSpeed(option.key)}
                        style={[
                          styles.speedOption,
                          {
                            borderColor: isSelected ? BRAND_COLOR : 'rgba(255, 255, 255, 0.2)',
                            backgroundColor: isSelected ? 'rgba(255, 193, 7, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                          },
                        ]}
                      >
                        <Text style={[styles.speedOptionTitle, { color: primaryTextColor }]}>
                          {option.label}
                        </Text>
                        <Text style={[styles.speedOptionSubtitle, { color: secondaryTextColor }]}>
                          {option.time}
                        </Text>
                        <Text style={[styles.speedOptionFee, { color: primaryTextColor }]}>
                          {option.fee.toLocaleString()} sats
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

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
                <Text style={[styles.previewLabel, { color: secondaryTextColor }]}>{`${isOnchainPreview ? t('send.networkFee') : 'Fee'}:`}</Text>
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
                buttonColor={BRAND_COLOR}
                textColor="#1a1a2e"
              >
                {isOnchainPreview ? t('send.sendOnchainCta') : 'Send Payment'}
              </Button>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const isLightningTab = activeTab === 'lightning';

  return (
    <LinearGradient colors={gradientColors} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: primaryTextColor }]}>{t('wallet.send')}</Text>
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
              {t('send.lightningTab')}
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
              {t('send.onchainTab')}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.balanceContainer}>
            <Text style={[styles.balanceLabel, { color: secondaryTextColor }]}>Available Balance:</Text>
            <Text style={styles.balanceAmount}>{balance.toLocaleString()} sats</Text>
            {balanceDisplay.fiatDisplay && (
              <Text style={[styles.balanceFiat, { color: secondaryTextColor }]}>{balanceDisplay.fiatDisplay}</Text>
            )}
          </View>

          {!isLightningTab && (
            <View style={styles.onchainInfoCard}>
              <Text style={[styles.onchainInfoTitle, { color: primaryTextColor }]}>{t('send.onchainModeTitle')}</Text>
              <Text style={[styles.onchainInfoText, { color: secondaryTextColor }]}>{t('send.onchainModeDescription')}</Text>
            </View>
          )}

          <Text style={[styles.sectionLabel, { color: primaryTextColor }]}>
            {isLightningTab ? t('send.lightningDestinationLabel') : t('send.onchainAddressLabel')}
          </Text>

          {isLightningTab && selectedContact ? (
            <View style={styles.selectedContactContainer}>
              <View style={styles.selectedContactHeader}>
                <Text style={styles.selectedContactName}>{selectedContact.name}</Text>
                <IconButton
                  icon="close"
                  iconColor="rgba(255, 255, 255, 0.7)"
                  size={20}
                  onPress={handleClearContact}
                  style={styles.clearContactButton}
                />
              </View>
              <Text style={styles.selectedContactAddress} numberOfLines={1} ellipsizeMode="middle">
                {selectedContact.lightningAddress}
              </Text>
            </View>
          ) : isLightningTab ? (
            <View style={styles.inputWithButtonRow}>
              <StyledTextInput
                placeholder={t('send.lightningInputPlaceholder')}
                value={paymentInput}
                onChangeText={setPaymentInput}
                style={[styles.input, styles.inputWithButton]}
                multiline
                numberOfLines={2}
              />
              {contacts.length > 0 && (
                <TouchableOpacity style={styles.addressBookButton} onPress={() => setContactModalVisible(true)}>
                  <IconButton icon="contacts" iconColor={BRAND_COLOR} size={24} style={styles.addressBookIcon} />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <StyledTextInput
              placeholder={t('send.onchainInputPlaceholder')}
              value={paymentInput}
              onChangeText={setPaymentInput}
              style={styles.input}
              multiline={false}
            />
          )}

          <Button
            mode="outlined"
            onPress={handleScanQR}
            icon="qrcode-scan"
            style={styles.scanButton}
            textColor={BRAND_COLOR}
          >
            Scan QR Code
          </Button>

          <ContactSelectionModal
            visible={contactModalVisible}
            onDismiss={() => setContactModalVisible(false)}
            onSelect={handleContactSelect}
            contacts={contacts}
            myAddress={addressInfo?.lightningAddress}
          />

          {isLightningTab ? (
            <>
              <Text style={[styles.label, { color: primaryTextColor }]}>Amount (leave empty for invoice amount):</Text>

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

              <Text style={[styles.label, { color: primaryTextColor }]}>Comment (optional):</Text>

              <StyledTextInput
                placeholder="Payment description"
                value={comment}
                onChangeText={setComment}
                style={styles.input}
              />
            </>
          ) : (
            <>
              <Text style={[styles.label, { color: primaryTextColor }]}>{t('send.amountRequiredOnchainLabel')}</Text>
              <StyledTextInput
                label={t('send.amountInSats')}
                value={amount}
                onChangeText={setAmount}
                keyboardType="number-pad"
                style={styles.input}
              />

              <Text style={[styles.label, { color: primaryTextColor }]}>{t('send.confirmationSpeed')}</Text>
              <View style={styles.speedCardsColumn}>
                {speedOptions.map((option) => {
                  const isSelected = selectedSpeed === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      onPress={() => setSelectedSpeed(option.key)}
                      style={[
                        styles.speedCard,
                        {
                          borderColor: isSelected ? BRAND_COLOR : 'rgba(255,255,255,0.18)',
                          backgroundColor: isSelected ? 'rgba(255, 193, 7, 0.13)' : 'rgba(255,255,255,0.05)',
                        },
                      ]}
                    >
                      <View>
                        <Text style={[styles.speedCardTitle, { color: primaryTextColor }]}>{option.label}</Text>
                        <Text style={[styles.speedCardTime, { color: secondaryTextColor }]}>{option.time}</Text>
                      </View>
                      <Text style={[styles.speedCardFee, { color: onchainFeeQuotes ? primaryTextColor : secondaryTextColor }]}>
                        {onchainFeeQuotes ? `${option.fee.toLocaleString()} sats` : '—'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.onchainFeeRow}>
                <Text style={[styles.onchainFeeLabel, { color: secondaryTextColor }]}>{t('send.networkFee')}</Text>
                <Text style={[styles.onchainFeeValue, { color: primaryTextColor }]}>
                  {onchainFeeQuotes ? `${getOnchainFeeQuote(selectedSpeed, onchainFeeQuotes).toLocaleString()} sats` : '—'}
                </Text>
              </View>
            </>
          )}

          <Button
            mode="contained"
            onPress={handlePreviewPayment}
            loading={isPreparing}
            disabled={
              isPreparing ||
              !paymentInput.trim() ||
              (!isLightningTab && !amount.trim()) ||
              (isLightningTab && inputCurrency !== 'sats' && isLoadingRates && amount !== '')
            }
            style={styles.previewButton}
            buttonColor={BRAND_COLOR}
            textColor="#1a1a2e"
          >
            {isLightningTab ? 'Preview Payment' : t('send.previewOnchainCta')}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 16,
  },
  balanceContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 18,
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
    color: BRAND_COLOR,
  },
  onchainInfoCard: {
    backgroundColor: 'rgba(255, 193, 7, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.35)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  onchainInfoTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  onchainInfoText: {
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 0,
  },
  scanButton: {
    borderColor: BRAND_COLOR,
    marginTop: 10,
    marginBottom: 10,
  },
  previewButton: {
    marginTop: 24,
    marginBottom: 8,
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
  onchainSelectorContainer: {
    marginBottom: 16,
  },
  speedSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  speedOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  speedOptionTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  speedOptionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  speedOptionFee: {
    fontSize: 12,
    marginTop: 6,
    fontWeight: '600',
  },
  speedCardsColumn: {
    marginTop: 4,
    gap: 8,
  },
  speedCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  speedCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  speedCardTime: {
    marginTop: 3,
    fontSize: 12,
  },
  speedCardFee: {
    fontSize: 14,
    fontWeight: '700',
  },
  onchainFeeRow: {
    marginTop: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  onchainFeeLabel: {
    fontSize: 13,
  },
  onchainFeeValue: {
    fontSize: 14,
    fontWeight: '700',
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
    color: BRAND_COLOR,
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
    borderColor: BRAND_COLOR,
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
    backgroundColor: undefined,
  },
  currencySelector: {
    backgroundColor: '#16213e',
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
  selectedContactContainer: {
    backgroundColor: 'rgba(255, 193, 7, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 0,
  },
  selectedContactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedContactName: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_COLOR,
  },
  selectedContactAddress: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
  },
  clearContactButton: {
    margin: -8,
  },
  inputWithButtonRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  inputWithButton: {
    flex: 1,
  },
  addressBookButton: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 8,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: 52,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)',
  },
  addressBookIcon: {
    margin: 0,
  },
});
