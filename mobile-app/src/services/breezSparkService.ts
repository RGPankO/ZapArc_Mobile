// Breez SDK Spark Service
// Lightning wallet operations using Breez SDK Nodeless (Spark Implementation)
//
// NOTE: This service requires native modules. It will work in:
// - Development builds (npx expo run:android)
// - Production builds
// It will NOT work in Expo Go (native modules not available)

import { BREEZ_API_KEY, BREEZ_STORAGE_DIR } from '../config';

// =============================================================================
// Types
// =============================================================================

export interface WalletBalance {
  balanceSat: number;
  pendingSendSat: number;
  pendingReceiveSat: number;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  error?: string;
}

export interface ReceivePaymentResult {
  paymentRequest: string;
  feeSat: number;
}

export interface TransactionInfo {
  id: string;
  type: 'send' | 'receive';
  amountSat: number;
  feeSat: number;
  status: 'pending' | 'completed' | 'failed';
  timestamp: number;
  description?: string;
  paymentRequest?: string;
}

// =============================================================================
// Native Module Detection
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let BreezSDK: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let RNFS: any = null;
let _isNativeAvailable = false;

// Try to load native modules - will fail gracefully in Expo Go
try {
  BreezSDK = require('@breeztech/breez-sdk-spark-react-native');
  RNFS = require('react-native-fs');
  _isNativeAvailable = true;
  console.log('✅ [BreezSparkService] Native SDK loaded successfully');
} catch {
  console.warn('⚠️ [BreezSparkService] Native SDK not available (running in Expo Go?)');
  console.warn('   To use Lightning features, build with: npx expo run:android');
}

// =============================================================================
// Service State
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sdkInstance: any = null;
let _isInitialized = false;

// =============================================================================
// Public API
// =============================================================================

/**
 * Check if native SDK is available
 */
export function isNativeAvailable(): boolean {
  return _isNativeAvailable;
}

/**
 * Check if SDK is initialized
 */
export function isSDKInitialized(): boolean {
  return _isInitialized && sdkInstance !== null;
}

/**
 * Generate a wallet-specific storage directory from mnemonic
 * Uses a simple hash of first 3 words to create unique storage per wallet
 */
function generateWalletStorageId(mnemonic: string): string {
  const words = mnemonic.trim().split(/\s+/);
  // Use first 3 words to create a deterministic but unique identifier
  const identifier = words.slice(0, 3).join('-');
  // Create a simple hash for privacy (don't expose actual words in storage name)
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `wallet-${Math.abs(hash).toString(16)}`;
}

/**
 * Initialize the Breez SDK with a mnemonic
 */
export async function initializeSDK(
  mnemonic: string,
  apiKey?: string
): Promise<boolean> {
  const walletId = generateWalletStorageId(mnemonic);
  const mnemonicWords = mnemonic.trim().split(/\s+/);

  console.log('🔵 [BreezSparkService] initializeSDK called');
  console.log('🔵 [BreezSparkService] Mnemonic word count:', mnemonicWords.length);
  console.log('🔵 [BreezSparkService] First 2 words:', mnemonicWords.slice(0, 2).join(' '));
  console.log('🔵 [BreezSparkService] Wallet storage ID:', walletId);
  console.log('🔵 [BreezSparkService] _isNativeAvailable:', _isNativeAvailable);

  if (!_isNativeAvailable) {
    console.warn('⚠️ [BreezSparkService] Cannot initialize - native SDK not available');
    return false;
  }

  try {
    // If already initialized with same wallet, return true
    if (sdkInstance && _isInitialized) {
      console.log('⚠️ [BreezSparkService] SDK already initialized, disconnecting first...');
      await disconnectSDK();
    }

    // Construct the seed using mnemonic words (per official Breez SDK Spark docs)
    const seed = new BreezSDK.Seed.Mnemonic({
      mnemonic,
      passphrase: undefined,
    });

    // Create the default config
    const config = BreezSDK.defaultConfig(BreezSDK.Network.Mainnet);
    
    // Only set API key if provided (empty string = no key)
    const effectiveApiKey = apiKey || BREEZ_API_KEY;
    if (effectiveApiKey && effectiveApiKey.length > 0) {
      config.apiKey = effectiveApiKey;
      console.log('🔵 [BreezSparkService] API key configured: YES (length: ' + effectiveApiKey.length + ')');
    } else {
      console.log('🔵 [BreezSparkService] API key configured: NO (running without API key)');
    }

    // Use wallet-specific storage directory
    const storageDir = `${RNFS.DocumentDirectoryPath}/${BREEZ_STORAGE_DIR}/${walletId}`;
    console.log('🔵 [BreezSparkService] Storage directory:', storageDir);

    // Ensure storage directory exists
    const dirExists = await RNFS.exists(storageDir);
    if (!dirExists) {
      console.log('🔵 [BreezSparkService] Creating storage directory...');
      await RNFS.mkdir(storageDir);
    }

    console.log('🔵 [BreezSparkService] Calling BreezSDK.connect()...');
    console.log('🔵 [BreezSparkService] Connect params:', {
      hasConfig: !!config,
      configApiKey: config?.apiKey ? '***SET***' : '***MISSING***',
      hasSeed: !!seed,
      seedType: seed?.constructor?.name,
      storageDir,
    });

    // Log available SDK exports for debugging
    console.log('🔵 [BreezSparkService] SDK exports:', Object.keys(BreezSDK || {}).slice(0, 20));

    sdkInstance = await BreezSDK.connect({
      config,
      seed,
      storageDir,
    });

    _isInitialized = true;
    console.log('✅ [BreezSparkService] Breez SDK initialized successfully');
    console.log('✅ [BreezSparkService] sdkInstance:', !!sdkInstance);
    return true;
  } catch (error) {
    // Try multiple ways to extract error info from native errors
    const errorStr = String(error);
    const errorName = (error as { name?: string })?.name || 'Unknown';
    const errorMessage = (error as { message?: string })?.message || errorStr;
    const errorCode = (error as { code?: string })?.code;
    const errorVariant = (error as { variant?: string })?.variant;

    console.error('❌ [BreezSparkService] Failed to initialize Breez SDK');
    console.error('❌ [BreezSparkService] Error toString:', errorStr);
    console.error('❌ [BreezSparkService] Error name:', errorName);
    console.error('❌ [BreezSparkService] Error message:', errorMessage);
    console.error('❌ [BreezSparkService] Error code:', errorCode);
    console.error('❌ [BreezSparkService] Error variant:', errorVariant);

    // Log all own properties
    if (error && typeof error === 'object') {
      console.error('❌ [BreezSparkService] Error properties:', Object.keys(error));
      for (const key of Object.keys(error)) {
        console.error(`❌ [BreezSparkService] Error.${key}:`, (error as Record<string, unknown>)[key]);
      }
    }

    _isInitialized = false;
    sdkInstance = null;
    return false;
  }
}

/**
 * Disconnect and cleanup SDK
 */
export async function disconnectSDK(): Promise<void> {
  if (!_isNativeAvailable) return;

  try {
    if (sdkInstance) {
      // Spark SDK uses sdkInstance.disconnect(), not BreezSDK.disconnect()
      await sdkInstance.disconnect();
      sdkInstance = null;
      _isInitialized = false;
      console.log('✅ [BreezSparkService] Breez SDK disconnected');
    }
  } catch (error) {
    console.error('❌ [BreezSparkService] Failed to disconnect SDK:', error);
  }
}

/**
 * Get current wallet balance
 */
export async function getBalance(): Promise<WalletBalance> {
  if (!_isNativeAvailable || !sdkInstance) {
    return { balanceSat: 0, pendingSendSat: 0, pendingReceiveSat: 0 };
  }

  try {
    // First try to get balance from getInfo()
    try {
      const info = await sdkInstance.getInfo({ ensureSynced: true });
      if (info) {
        return {
          balanceSat: Number(info.balanceSats || 0),
          pendingSendSat: Number(info.pendingSendSats || 0),
          pendingReceiveSat: Number(info.pendingReceiveSats || 0),
        };
      }
    } catch (infoError) {
      console.warn('⚠️ [BreezSparkService] getInfo() failed:', infoError);
    }

    // Fallback: Calculate from payments
    const response = await sdkInstance.listPayments({});
    const payments = response.payments || [];

    let balanceSat = 0;
    let pendingSendSat = 0;
    let pendingReceiveSat = 0;

    for (const payment of payments) {
      // Spark SDK uses object status and plural Sats
      const status = mapPaymentStatus(payment.status);
      const paymentType = (payment.paymentType === 'receive' || String(payment.paymentType).toLowerCase() === 'receive') ? 'receive' : 'send';
      
      const amount = typeof payment.amountSats === 'bigint' 
        ? Number(payment.amountSats) 
        : Number(payment.amountSats || 0);
        
      const fees = typeof payment.feesSats === 'bigint' 
        ? Number(payment.feesSats) 
        : Number(payment.feesSats || 0);

      if (status === 'completed') {
        if (paymentType === 'receive') {
          balanceSat += amount;
        } else {
          balanceSat -= amount + fees;
        }
      } else if (status === 'pending') {
        if (paymentType === 'receive') {
          pendingReceiveSat += amount;
        } else {
          pendingSendSat += amount;
        }
      }
    }

    return {
      balanceSat: Math.max(0, balanceSat),
      pendingSendSat,
      pendingReceiveSat,
    };
  } catch (error) {
    console.error('❌ [BreezSparkService] Failed to get balance:', error);
    return { balanceSat: 0, pendingSendSat: 0, pendingReceiveSat: 0 };
  }
}

/**
 * Pay a Lightning invoice
 */
export async function payInvoice(
  paymentRequest: string,
  _amountSat?: number
): Promise<PaymentResult> {
  if (!_isNativeAvailable || !sdkInstance) {
    return { success: false, error: 'SDK not available' };
  }

  try {
    const prepareResponse = await sdkInstance.prepareSendPayment({
      paymentRequest,
      amount: _amountSat ? BigInt(_amountSat) : undefined,
    });

    const response = await sdkInstance.sendPayment({
      prepareResponse,
    });

    return {
      success: true,
      paymentId: response.payment?.id,
    };
  } catch (error) {
    console.error('Failed to pay invoice:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment failed',
    };
  }
}

/**
 * Generate a Lightning invoice to receive payment
 */
export async function receivePayment(
  amountSat: number,
  description?: string
): Promise<ReceivePaymentResult> {
  if (!_isNativeAvailable || !sdkInstance) {
    throw new Error('SDK not available');
  }

  try {
    // Create the payment method using the SDK's factory pattern
    const paymentMethod = BreezSDK.ReceivePaymentMethod.Bolt11Invoice.new({
      description: description || '',
      amountSats: BigInt(amountSat),
      expirySecs: 900, // 15 minutes
    });

    const response = await sdkInstance.receivePayment({
      paymentMethod,
    });

    return {
      paymentRequest: response.paymentRequest,
      feeSat: Number(response.fee),
    };
  } catch (error) {
    console.error('Failed to create receive invoice:', error);
    throw error;
  }
}

/**
 * List all payments/transactions
 */
export async function listPayments(): Promise<TransactionInfo[]> {
  if (!_isNativeAvailable || !sdkInstance) {
    return [];
  }

  try {
    const response = await sdkInstance.listPayments({
      sortAscending: false,
    });

    const payments = response.payments || [];

    return payments.map((payment: any) => {
      const rawAmount = payment.amount || 0;
      const amountSat = typeof rawAmount === 'bigint' ? Number(rawAmount) : Number(rawAmount);

      const rawFees = payment.fees || 0;
      const feeSat = typeof rawFees === 'bigint' ? Number(rawFees) : Number(rawFees);

      const rawTime = payment.timestamp || 0;
      let timestamp = typeof rawTime === 'bigint' ? Number(rawTime) : Number(rawTime);
      if (timestamp > 0 && timestamp < 10000000000) {
        timestamp *= 1000;
      }

      let type: 'receive' | 'send' = 'send';
      if (payment.paymentType === 1 || payment.paymentType === '1') {
        type = 'receive';
      }

      const description = payment.details?.description || payment.description || '';

      const mappedStatus = mapPaymentStatus(payment.status);
      console.log(`[Payment ${payment.id}] Raw status:`, payment.status, '-> Mapped:', mappedStatus);

      return {
        id: payment.id,
        type,
        amountSat,
        feeSat,
        status: mappedStatus,
        timestamp: timestamp || Date.now(),
        description,
      };
    });
  } catch (error) {
    console.error('Failed to list payments:', error);
    return [];
  }
}

/**
 * Get a specific payment by ID
 */
export async function getPayment(paymentId: string): Promise<TransactionInfo | null> {
  if (!_isNativeAvailable || !sdkInstance) {
    return null;
  }

  try {
    const response = await sdkInstance.getPayment({ paymentId });
    if (response.payment) {
      const p = response.payment;
      // Properly convert BigInt to number for amounts
      const amountSat = typeof p.amountSat === 'bigint'
        ? Number(p.amountSat)
        : p.amountSat;
      const feeSat = p.feesSat
        ? (typeof p.feesSat === 'bigint' ? Number(p.feesSat) : p.feesSat)
        : 0;
      // Convert timestamp from seconds to milliseconds
      const timestamp = typeof p.createdAt === 'bigint'
        ? Number(p.createdAt) * 1000
        : p.createdAt * 1000;

      return {
        id: p.id,
        type: (p.paymentType === 'receive' || p.paymentType === 'Receive') ? 'receive' : 'send',
        amountSat,
        feeSat,
        status: mapPaymentStatus(p.status),
        timestamp,
        description: p.description,
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to get payment:', error);
    return null;
  }
}

/**
 * Get Spark address for receiving payments
 */
export async function getSparkAddress(): Promise<string> {
  if (!_isNativeAvailable || !sdkInstance) {
    throw new Error('SDK not available');
  }

  try {
    const response = await sdkInstance.receivePayment({
      paymentMethod: {
        type: 'sparkAddress',
      },
    });

    return response.paymentRequest;
  } catch (error) {
    console.error('Failed to get Spark address:', error);
    throw error;
  }
}

/**
 * Pay to a Lightning address
 */
export async function payLightningAddress(
  address: string,
  amountSat: number,
  _comment?: string
): Promise<PaymentResult> {
  return await payInvoice(address, amountSat);
}

/**
 * Parse and validate a payment request
 */
export async function parsePaymentRequest(input: string): Promise<{
  type: 'bolt11' | 'lnurl' | 'lightningAddress' | 'bitcoinAddress' | 'sparkAddress' | 'unknown';
  isValid: boolean;
  amountSat?: number;
  description?: string;
}> {
  if (!_isNativeAvailable || !sdkInstance) {
    // Fallback to simple string matching if SDK not available
    const trimmed = input.trim().toLowerCase();

    if (trimmed.includes('@') && trimmed.includes('.')) {
      return { type: 'lightningAddress', isValid: true };
    }

    if (trimmed.startsWith('lnurl')) {
      return { type: 'lnurl', isValid: true };
    }

    if (trimmed.startsWith('lnbc') || trimmed.startsWith('lntb') || trimmed.startsWith('lnbcrt')) {
      return { type: 'bolt11', isValid: true };
    }

    if (trimmed.startsWith('bc1') || trimmed.startsWith('1') || trimmed.startsWith('3') || trimmed.startsWith('tb1')) {
      return { type: 'bitcoinAddress', isValid: true };
    }

    if (trimmed.startsWith('sp1')) {
      return { type: 'sparkAddress', isValid: true };
    }

    return { type: 'unknown', isValid: false };
  }

  try {
    // Use SDK to parse for full details including amount
    const parsed = await sdkInstance.parse(input.trim());

    // Check the parsed result type
    if (parsed.tag === 'Bolt11Invoice' && parsed.inner) {
      // The inner might be an array with the invoice details as first element
      const innerData = Array.isArray(parsed.inner) ? parsed.inner[0] : parsed.inner;
      const invoiceDetails = innerData?.invoiceDetails || innerData;

      const amountSat = invoiceDetails?.amountMsat ? Number(invoiceDetails.amountMsat) / 1000 : undefined;

      return {
        type: 'bolt11',
        isValid: true,
        amountSat,
        description: invoiceDetails?.description,
      };
    }

    if (parsed.tag === 'LightningAddress') {
      return { type: 'lightningAddress', isValid: true };
    }

    if (parsed.tag === 'Lnurl') {
      return { type: 'lnurl', isValid: true };
    }

    if (parsed.tag === 'BitcoinAddress') {
      return { type: 'bitcoinAddress', isValid: true };
    }

    if (parsed.tag === 'SparkAddress') {
      return { type: 'sparkAddress', isValid: true };
    }

    return { type: 'unknown', isValid: false };
  } catch (error) {
    console.error('Failed to parse payment request:', error);
    return { type: 'unknown', isValid: false };
  }
}

/**
 * Prepare a payment (get fee estimate)
 */
export async function prepareSendPayment(
  paymentRequest: string,
  amountSat?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  if (!_isNativeAvailable || !sdkInstance) {
    throw new Error('SDK not available');
  }

  return await sdkInstance.prepareSendPayment({
    paymentRequest,
    amount: amountSat ? BigInt(amountSat) : undefined,
  });
}

/**
 * Send a prepared payment
 */
export async function sendPayment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prepareResponse: any,
  idempotencyKey?: string
): Promise<PaymentResult> {
  if (!_isNativeAvailable || !sdkInstance) {
    return { success: false, error: 'SDK not available' };
  }

  try {
    const response = await sdkInstance.sendPayment({
      prepareResponse,
      idempotencyKey,
    });

    return {
      success: true,
      paymentId: response.payment?.id,
    };
  } catch (error) {
    console.error('Failed to send payment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment failed',
    };
  }
}

/**
 * Add event listener for payment updates
 */
export function addPaymentListener(
  _callback: (payment: TransactionInfo) => void
): () => void {
  console.log('Payment listener registered');
  return () => {
    console.log('Payment listener removed');
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPaymentStatus(status: any): 'pending' | 'completed' | 'failed' {
  // Spark SDK may return status as an object like { type: 'completed' } or as a string
  let s: string;
  if (typeof status === 'object' && status !== null) {
    s = (status.type || status.variant || '').toLowerCase();
  } else {
    s = String(status || '').toLowerCase();
  }
  
  if (s === 'completed' || s === 'complete' || s === 'succeeded') {
    return 'completed';
  }
  if (s === 'failed' || s === 'canceled') {
    return 'failed';
  }
  return 'pending';
}

// =============================================================================
// Exports
// =============================================================================

export const BreezSparkService = {
  isNativeAvailable,
  initializeSDK,
  disconnectSDK,
  isSDKInitialized,
  getBalance,
  prepareSendPayment,
  sendPayment,
  payInvoice,
  receivePayment,
  getSparkAddress,
  listPayments,
  getPayment,
  payLightningAddress,
  parsePaymentRequest,
  addPaymentListener,
};

export default BreezSparkService;
