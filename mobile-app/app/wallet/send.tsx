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

function isValidBitcoinAddress(address: string): boolean {
  // Bech32 (native segwit): bc1q... or bc1p... (taproot)
  if (/^bc1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{25,87}$/i.test(address)) return true;
  // Legacy P2PKH: starts with 1
  if (/^1[1-9A-HJ-NP-Za-km-z]{24,33}$/.test(address)) return true;
  // P2SH: starts with 3
  if (/^3[1-9A-HJ-NP-Za-km-z]{24,33}$/.test(address)) return true;
  return false;
}

/**
 * Parse BIP21 bitcoin: URIs and lightning: URIs
 * Examples:
 *   bitcoin:bc1q...?amount=0.00115262
 *   bitcoin:bc1q...?amount=0.001&label=Donation
 *   lightning:lnbc500u1...
 *   BITCOIN:BC1Q...?amount=0.5 (case-insensitive scheme)
 *
 * Returns { address, amountSats?, label?, lightning? } or null if not a URI
 */
function parseBIP21(input: string): {
  address: string;
  amountSats?: number;
  label?: string;
  message?: string;
  lightning?: string;
} | null {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // Check for bitcoin: or lightning: scheme
  if (!lower.startsWith('bitcoin:') && !lower.startsWith('lightning:')) {
    return null;
  }

  // Handle lightning: URIs
  if (lower.startsWith('lightning:')) {
    const invoice = trimmed.substring('lightning:'.length);
    return { address: invoice };
  }

  // Parse bitcoin: URI
  const withoutScheme = trimmed.substring('bitcoin:'.length);
  const questionIndex = withoutScheme.indexOf('?');

  let address: string;
  let params: URLSearchParams;

  if (questionIndex === -1) {
    address = withoutScheme;
    params = new URLSearchParams();
  } else {
    address = withoutScheme.substring(0, questionIndex);
    params = new URLSearchParams(withoutScheme.substring(questionIndex + 1));
  }

  if (!address) return null;

  const result: {
    address: string;
    amountSats?: number;
    label?: string;
    message?: string;
    lightning?: string;
  } = { address };

  // Parse amount (BIP21 amount is in BTC)
  const amountBtc = params.get('amount');
  if (amountBtc) {
    const btcValue = parseFloat(amountBtc);
    if (!isNaN(btcValue) && btcValue > 0) {
      result.amountSats = Math.round(btcValue * 100_000_000);
    }
  }

  // Parse optional label/message
  const label = params.get('label');
  if (label) result.label = label;

  const message = params.get('message');
  if (message) result.message = message;

  // Parse lightning param (some wallets include a lightning invoice in the URI)
  const lightning = params.get('lightning');
  if (lightning) result.lightning = lightning;

  return result;
}

type SendStep = 'input' | 'preview' | 'onchain-preview' | 'scanning';
type ConfirmationSpeed = 'fast' | 'medium' | 'slow';
type SendTab = 'lightning' | 'onchain';

interface OnchainFeeQuote {
  feeSats: number;        // total fee (service + L1)
  serviceFee: number;     // Spark service fee (userFeeSat)
  l1Fee: number;          // L1 broadcast fee (l1BroadcastFeeSat)
  satPerVbyte?: number;
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
  const [isFetchingFees, setIsFetchingFees] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

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
    setAddressError(null);
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
    const trimmedInput = paymentInput.trim();
    if (!trimmedInput) return;

    const timeoutId = setTimeout(async () => {
      // Check for BIP21 / lightning: URI pasted into input
      const bip21 = parseBIP21(trimmedInput);
      if (bip21) {
        // If lightning param exists and we're on lightning tab, use it
        if (bip21.lightning && activeTab === 'lightning') {
          setPaymentInput(bip21.lightning);
          try {
            const parsed = await BreezSparkService.parsePaymentRequest(bip21.lightning);
            if (parsed.isValid && parsed.type === 'bolt11' && parsed.amountSat !== undefined) {
              setAmount(parsed.amountSat.toString());
            }
          } catch (e) { /* ignore */ }
          return;
        }

        // Bitcoin address — auto-switch to on-chain
        if (isValidBitcoinAddress(bip21.address)) {
          setActiveTab('onchain');
          setPaymentInput(bip21.address);
          if (bip21.amountSats) {
            setAmount(bip21.amountSats.toString());
            setInputCurrency('sats');
          }
          if (bip21.label || bip21.message) {
            setComment(bip21.label || bip21.message || '');
          }
          return;
        }

        // lightning: URI
        if (trimmedInput.toLowerCase().startsWith('lightning:')) {
          setPaymentInput(bip21.address);
        }
      }

      // Standard Lightning parsing
      if (activeTab !== 'lightning') return;
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

  // Auto-fetch on-chain fee quotes when address + amount are filled
  useEffect(() => {
    if (activeTab !== 'onchain') return;

    // Strip BIP21 URI if present
    let trimmedAddress = paymentInput.trim();
    const bip21Check = parseBIP21(trimmedAddress);
    if (bip21Check) {
      trimmedAddress = bip21Check.address;
      // If BIP21 has amount and our amount field is empty, apply it
      if (bip21Check.amountSats && !amount) {
        setAmount(bip21Check.amountSats.toString());
        setInputCurrency('sats');
        // Also update the input field to show just the address
        setPaymentInput(trimmedAddress);
        return; // Let the next effect cycle pick up the new values
      }
      // Update input to stripped address
      if (paymentInput.trim() !== trimmedAddress) {
        setPaymentInput(trimmedAddress);
        return;
      }
    }

    const satsAmount = Math.floor(Number(amount));

    // Validate address format
    if (trimmedAddress.length > 0 && !isValidBitcoinAddress(trimmedAddress)) {
      setAddressError(t('send.invalidOnchainAddress'));
      setOnchainFeeQuotes(null);
      return;
    } else {
      setAddressError(null);
    }

    if (!trimmedAddress || !isValidBitcoinAddress(trimmedAddress) || !satsAmount || satsAmount <= 0) {
      setOnchainFeeQuotes(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      // Double-check address is still valid (could have been cleared by tab switch)
      if (!trimmedAddress || !isValidBitcoinAddress(trimmedAddress) || satsAmount <= 0) return;
      try {
        setIsFetchingFees(true);
        const prepared = await BreezSparkService.prepareSendPayment(trimmedAddress, satsAmount);
        console.log('🔍 [Send] auto-fee prepared:', JSON.stringify(prepared, (_, v) => typeof v === 'bigint' ? v.toString() : v));
        setPrepareResponse(prepared);

        const method = prepared.paymentMethod;
        const methodInner = method?.inner || method;
        console.log('🔍 [Send] paymentMethod tag:', method?.tag, 'keys:', method ? Object.keys(method) : 'null');
        console.log('🔍 [Send] methodInner keys:', methodInner ? Object.keys(methodInner) : 'null');
        if (method?.tag === 'BitcoinAddress' || method?.type === 'bitcoinAddress') {
          const feeQuote = methodInner?.feeQuote || method?.feeQuote;
          console.log('🔍 [Send] feeQuote:', JSON.stringify(feeQuote, (_, v) => typeof v === 'bigint' ? v.toString() : v));
          if (feeQuote?.speedFast || feeQuote?.speedMedium || feeQuote?.speedSlow) {
            const extractL1Fee = (q: any) => Number(q?.l1BroadcastFeeSat ?? 0);
            const extractServiceFee = (q: any) => Number(q?.userFeeSat ?? q?.feeSats ?? 0);
            // Total fee = service fee (userFeeSat) + L1 broadcast fee (l1BroadcastFeeSat)
            const extractFee = (q: any) => extractServiceFee(q) + extractL1Fee(q);
            const extractSatPerVbyte = (q: any) => {
              // Try direct field first, then estimate from l1BroadcastFeeSat
              const direct = Number(q?.satPerVbyte ?? q?.sat_per_vbyte ?? 0);
              if (direct > 0) return direct;
              // Estimate: typical P2WPKH tx is ~141 vBytes, P2TR ~111 vBytes; use ~140 as approximation
              const l1Fee = extractL1Fee(q);
              if (l1Fee > 0) return Math.round(l1Fee / 140);
              return undefined;
            };
            const buildQuote = (q: any): OnchainFeeQuote => ({
              feeSats: extractFee(q),
              serviceFee: extractServiceFee(q),
              l1Fee: extractL1Fee(q),
              satPerVbyte: extractSatPerVbyte(q),
              estimatedConfirmationTime: q?.estimatedConfirmationTime,
            });
            setOnchainFeeQuotes({
              fast: buildQuote(feeQuote.speedFast),
              medium: buildQuote(feeQuote.speedMedium),
              slow: buildQuote(feeQuote.speedSlow),
            });
          }
        }
      } catch (error) {
        console.warn('⚠️ [Send] auto-fee estimation failed:', error);
        setOnchainFeeQuotes(null);
      } finally {
        setIsFetchingFees(false);
      }
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [activeTab, paymentInput, amount]);

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
      Alert.alert(t('send.permissionRequired'), t('send.cameraPermissionRequired'));
    }
  }, [permission, requestPermission]);

  const handleBarCodeScanned = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      if (scanned) return;
      setScanned(true);

      // Try BIP21 / lightning: URI parsing first
      const bip21 = parseBIP21(data);
      if (bip21) {
        // If it has a lightning param and we're on lightning tab, prefer that
        if (bip21.lightning && activeTab === 'lightning') {
          setPaymentInput(bip21.lightning);
          setStep('input');
          try {
            const parsed = await BreezSparkService.parsePaymentRequest(bip21.lightning);
            if (parsed.isValid && parsed.type === 'bolt11' && parsed.amountSat !== undefined) {
              setAmount(parsed.amountSat.toString());
            }
          } catch (error) {
            console.error('Failed to parse lightning param from BIP21:', error);
          }
          return;
        }

        // Bitcoin address — switch to on-chain tab if not already
        if (isValidBitcoinAddress(bip21.address)) {
          setActiveTab('onchain');
          setPaymentInput(bip21.address);
          if (bip21.amountSats) {
            setAmount(bip21.amountSats.toString());
            setInputCurrency('sats');
          }
          if (bip21.label || bip21.message) {
            setComment(bip21.label || bip21.message || '');
          }
          setStep('input');
          return;
        }

        // lightning: URI (not bitcoin:)
        setPaymentInput(bip21.address);
        setStep('input');
        try {
          const parsed = await BreezSparkService.parsePaymentRequest(bip21.address);
          if (parsed.isValid && parsed.type === 'bolt11' && parsed.amountSat !== undefined) {
            setAmount(parsed.amountSat.toString());
          }
        } catch (error) {
          console.error('Failed to parse lightning URI:', error);
        }
        return;
      }

      // Not a URI — handle as raw input
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
      Alert.alert(t('common.error'), t('send.enterDestination'));
      return;
    }

    try {
      setIsPreparing(true);

      // Strip BIP21/lightning: URI scheme before passing to SDK
      let resolvedInput = paymentInput.trim();
      const bip21Parsed = parseBIP21(resolvedInput);
      if (bip21Parsed) {
        // If lightning param exists and we're on lightning tab, use it
        if (bip21Parsed.lightning && activeTab === 'lightning') {
          resolvedInput = bip21Parsed.lightning;
        } else {
          resolvedInput = bip21Parsed.address;
        }
        // Apply amount from BIP21 if not already set
        if (bip21Parsed.amountSats && !amount) {
          setAmount(bip21Parsed.amountSats.toString());
        }
      }

      const parsedRequest = await BreezSparkService.parsePaymentRequest(resolvedInput);
      const isOnchainFlow = activeTab === 'onchain';

      if (!parsedRequest.isValid) {
        Alert.alert(t('send.paymentError'), t('send.invalidPaymentRequest'));
        return;
      }

      if (isOnchainFlow && parsedRequest.type !== 'bitcoinAddress') {
        Alert.alert(t('send.invalidBitcoinAddress'), t('send.invalidOnchainAddress'));
        return;
      }

      if (!isOnchainFlow && parsedRequest.type === 'bitcoinAddress') {
        Alert.alert(t('send.lightningOnly'), t('send.invalidLightningDestination'));
        return;
      }

      let paymentAmount: number;
      if (isOnchainFlow) {
        const satsAmount = Math.floor(Number(amount));
        if (!satsAmount || satsAmount <= 0) {
          Alert.alert(t('common.error'), t('send.amountRequiredOnchain'));
          return;
        }
        paymentAmount = satsAmount;
      } else if (parsedRequest.type === 'bolt11' && parsedRequest.amountSat !== undefined) {
        paymentAmount = parsedRequest.amountSat;
      } else {
        const parsedAmount = parseFloat(amount);
        if (!parsedAmount || parsedAmount <= 0) {
          Alert.alert(t('common.error'), t('send.invalidAmount'));
          return;
        }
        paymentAmount = convertToSats(parsedAmount, inputCurrency);

        if (!paymentAmount || paymentAmount <= 0) {
          Alert.alert(t('send.conversionError'), t('send.conversionErrorMessage'));
          return;
        }
      }

      // Minimum on-chain send to avoid dust issues on the receiving end
      const MIN_ONCHAIN_SATS = 1000;
      if (isOnchainFlow && paymentAmount < MIN_ONCHAIN_SATS) {
        Alert.alert(
          t('common.error'),
          `Minimum on-chain send is ${MIN_ONCHAIN_SATS.toLocaleString()} sats. Smaller amounts may be unspendable due to network fees.`
        );
        return;
      }

      if (paymentAmount > balance) {
        Alert.alert(
          t('send.insufficientBalance'),
          t('send.insufficientBalanceMessage')
            .replace('{{balance}}', balance.toLocaleString())
            .replace('{{amount}}', paymentAmount.toLocaleString())
        );
        return;
      }

      const prepared = await BreezSparkService.prepareSendPayment(resolvedInput, paymentAmount);
      console.log('🔍 [Send] prepared response:', JSON.stringify(prepared, (_, v) => typeof v === 'bigint' ? v.toString() : v));
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
            const extractL1 = (q: any) => Number(q?.l1BroadcastFeeSat ?? 0);
            const extractService = (q: any) => Number(q?.userFeeSat ?? q?.feeSats ?? 0);
            // Total fee = service fee + L1 broadcast fee
            const extractFee = (q: any) => extractService(q) + extractL1(q);
            const extractSatPerVbyte = (q: any) => {
              const direct = Number(q?.satPerVbyte ?? q?.sat_per_vbyte ?? 0);
              if (direct > 0) return direct;
              const l1Fee = extractL1(q);
              if (l1Fee > 0) return Math.round(l1Fee / 140);
              return undefined;
            };
            const buildQuote2 = (q: any): OnchainFeeQuote => ({
              feeSats: extractFee(q),
              serviceFee: extractService(q),
              l1Fee: extractL1(q),
              satPerVbyte: extractSatPerVbyte(q),
              estimatedConfirmationTime: q?.estimatedConfirmationTime,
            });
            extractedFeeQuotes = {
              fast: buildQuote2(feeQuote.speedFast),
              medium: buildQuote2(feeQuote.speedMedium),
              slow: buildQuote2(feeQuote.speedSlow),
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
          t('send.insufficientBalance'),
          t('send.insufficientBalanceWithFee')
            .replace('{{total}}', totalAmount.toLocaleString())
            .replace('{{fee}}', feeAmount.toLocaleString())
            .replace('{{balance}}', balance.toLocaleString())
        );
        return;
      }

      const paymentPreview: PaymentPreview = {
        recipient: resolvedInput,
        amount: paymentAmount,
        fee: feeAmount,
        total: totalAmount,
        description: parsedRequest.description || comment || undefined,
      };

      setPreview(paymentPreview);
      setStep(isOnchainFlow ? 'onchain-preview' : 'preview');
    } catch (error) {
      console.error('Failed to prepare payment:', error);

      let errorMessage = error instanceof Error ? error.message : String(error);
      // Try to extract from SDK error objects
      if (errorMessage === '[object Object]' && typeof error === 'object' && error !== null) {
        const e = error as Record<string, unknown>;
        errorMessage = (e.message as string) || (e.variant as string) || JSON.stringify(error);
      }

      if (errorMessage.includes('Network request failed') || errorMessage.includes('Failed to resolve')) {
        errorMessage = 'Could not reach the Lightning Address provider. Please check the address is correct (e.g., user@wallet.com).';
      }

      Alert.alert(t('send.paymentError'), errorMessage);
      // Clear any stale prepare state from previous attempts
      setPreview(null);
      setPrepareResponse(null);
    } finally {
      setIsPreparing(false);
    }
  }, [paymentInput, amount, comment, balance, inputCurrency, convertToSats, getOnchainFeeQuote, selectedSpeed, activeTab, t]);

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
        const errorMsg = result.error || 'Unknown error occurred';
        const details = result.errorDetails ? `\n\nDetails:\n${result.errorDetails}` : '';
        Alert.alert(t('send.paymentFailed'), `${errorMsg}${details}`);
        // Clear stale prepare state so next send attempt doesn't reuse it
        setStep('input');
        setPreview(null);
        setPrepareResponse(null);
      }
    } catch (error) {
      console.error('Failed to send payment:', error);
      const msg = error instanceof Error ? error.message : String(error);
      Alert.alert(t('common.error'), msg);
      // Clear stale prepare state on error too
      setStep('input');
      setPreview(null);
      setPrepareResponse(null);
    } finally {
      setIsSending(false);
    }
  }, [preview, prepareResponse, refreshBalance, step, selectedSpeed, paymentInput, t]);

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
          t('send.insufficientBalance'),
          t('send.insufficientBalanceWithFee')
            .replace('{{total}}', totalAmount.toLocaleString())
            .replace('{{fee}}', feeAmount.toLocaleString())
            .replace('{{balance}}', balance.toLocaleString())
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
    () => {
      const buildOption = (key: ConfirmationSpeed, labelKey: string, defaultTime: string, quote?: OnchainFeeQuote) => ({
        key,
        label: t(labelKey),
        time: formatEstimatedTime(quote?.estimatedConfirmationTime, defaultTime),
        fee: Number(quote?.feeSats || 0),
        serviceFee: Number(quote?.serviceFee || 0),
        l1Fee: Number(quote?.l1Fee || 0),
        satPerVbyte: quote?.satPerVbyte,
      });
      return [
        buildOption('fast', 'send.speedFast', '10', onchainFeeQuotes?.fast),
        buildOption('medium', 'send.speedMedium', '30', onchainFeeQuotes?.medium),
        buildOption('slow', 'send.speedSlow', '60', onchainFeeQuotes?.slow),
      ];
    },
    [onchainFeeQuotes, formatEstimatedTime]
  );

  const selectedOnchainQuote = useMemo(() => {
    if (!onchainFeeQuotes) return undefined;
    return onchainFeeQuotes[selectedSpeed];
  }, [onchainFeeQuotes, selectedSpeed]);

  if (step === 'scanning') {
    return (
      <LinearGradient colors={gradientColors} style={styles.gradient}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setStep('input')}>
              <Text style={styles.backButton}>← {t('common.back')}</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: primaryTextColor }]}>{t('send.scanQrCode')}</Text>
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
              <Text style={styles.backButton}>← {t('common.back')}</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: primaryTextColor }]}>{isOnchainPreview ? t('send.onchainTitle') : t('wallet.send')}</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <Text style={[styles.sectionTitle, { color: primaryTextColor }]}>{t('send.paymentPreview')}</Text>

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
                          {option.fee.toLocaleString()} sats{option.satPerVbyte ? ` (${option.satPerVbyte} sat/vB)` : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={styles.previewContainer}>
              <View style={styles.previewRow}>
                <Text style={[styles.previewLabel, { color: secondaryTextColor }]}>{t('send.recipient')}</Text>
                <Text style={[styles.previewValue, { color: primaryTextColor }]} numberOfLines={1} ellipsizeMode="middle">
                  {preview.recipient}
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={[styles.previewLabel, { color: secondaryTextColor }]}>{t('payments.amount')}:</Text>
                <Text style={[styles.previewAmount, { color: primaryTextColor }]}>
                  {preview.amount.toLocaleString()} sats
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={[styles.previewLabel, { color: secondaryTextColor }]}>{t('wallet.fee')}:</Text>
                <Text style={[styles.previewFee, { color: secondaryTextColor }]}>
                  {preview.fee.toLocaleString()} sats{isOnchainPreview && selectedOnchainQuote?.satPerVbyte ? ` (${selectedOnchainQuote.satPerVbyte} sat/vB)` : ''}
                </Text>
              </View>

              <View style={[styles.previewRow, styles.previewTotal]}>
                <Text style={[styles.previewTotalLabel, { color: primaryTextColor }]}>{t('send.total')}</Text>
                <Text style={styles.previewTotalAmount}>
                  {preview.total.toLocaleString()} sats
                </Text>
              </View>

              {preview.description && (
                <View style={styles.previewRow}>
                  <Text style={[styles.previewLabel, { color: secondaryTextColor }]}>{t('payments.description')}:</Text>
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
                {t('common.cancel')}
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
                {isOnchainPreview ? t('send.sendOnchainCta') : t('payments.sendPayment')}
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
            <Text style={styles.backButton}>← {t('common.back')}</Text>
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
            <Text style={[styles.balanceLabel, { color: secondaryTextColor }]}>{t('send.availableBalance')}</Text>
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
              <TouchableOpacity
                style={styles.addressBookButton}
                onPress={() => {
                  if (contacts.length > 0) {
                    setContactModalVisible(true);
                  } else {
                    router.push('/wallet/settings/address-book');
                  }
                }}
              >
                <IconButton icon="contacts" iconColor={BRAND_COLOR} size={24} style={styles.addressBookIcon} />
              </TouchableOpacity>
            </View>
          ) : (
            <StyledTextInput
              placeholder={t('send.onchainInputPlaceholder')}
              value={paymentInput}
              onChangeText={setPaymentInput}
              style={styles.input}
              multiline={false}
              error={!!addressError}
            />
          )}

          {addressError && activeTab === 'onchain' && (
            <Text style={styles.addressErrorText}>{addressError}</Text>
          )}

          <Button
            mode="outlined"
            onPress={handleScanQR}
            icon="qrcode-scan"
            style={styles.scanButton}
            textColor={BRAND_COLOR}
          >
            {t('send.scanQrCode')}
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
              <Text style={[styles.label, { color: primaryTextColor }]}>{t('send.amountLabel')}</Text>

              <View style={styles.amountInputRow}>
                <StyledTextInput
                  label={t('send.amountInCurrency').replace('{{currency}}', currencyLabels[inputCurrency])}
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

              <Text style={[styles.label, { color: primaryTextColor }]}>{t('send.commentLabel')}</Text>

              <StyledTextInput
                placeholder={t('send.paymentDescriptionPlaceholder')}
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
              {amount.length > 0 && Number(amount) > 0 && Number(amount) < 1000 && (
                <Text style={{ color: '#f44336', fontSize: 12, marginTop: -4, marginBottom: 4 }}>
                  Minimum on-chain send: 1,000 sats
                </Text>
              )}

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
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.speedCardTitle, { color: primaryTextColor }]}>{option.label}</Text>
                        <Text style={[styles.speedCardTime, { color: secondaryTextColor }]}>{option.time}</Text>
                      </View>
                      <Text style={[styles.speedCardFee, { color: onchainFeeQuotes ? primaryTextColor : secondaryTextColor }]}>
                        {isFetchingFees
                          ? '...'
                          : onchainFeeQuotes
                            ? `${option.fee.toLocaleString()} sats${option.satPerVbyte ? ` (${option.satPerVbyte} sat/vB)` : ''}`
                            : '-'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.onchainFeeRow}>
                <Text style={[styles.onchainFeeLabel, { color: secondaryTextColor }]}>{t('send.networkFee')}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.onchainFeeValue, { color: primaryTextColor }]}> 
                    {isFetchingFees
                      ? '...'
                      : onchainFeeQuotes
                        ? `${getOnchainFeeQuote(selectedSpeed, onchainFeeQuotes).toLocaleString()} sats`
                        : '-'}
                  </Text>
                </View>
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
              (!isLightningTab && !!addressError) ||
              (!isLightningTab && Number(amount) > 0 && Number(amount) < 1000) ||
              (isLightningTab && inputCurrency !== 'sats' && isLoadingRates && amount !== '')
            }
            style={styles.previewButton}
            buttonColor={BRAND_COLOR}
            textColor="#1a1a2e"
          >
            {isLightningTab ? t('send.previewPayment') : t('send.previewOnchainCta')}
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
    marginBottom: 0,
  },
  addressErrorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 4,
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
