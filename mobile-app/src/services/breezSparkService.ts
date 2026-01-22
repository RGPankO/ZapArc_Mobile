// Breez SDK Spark Service
// Lightning wallet operations using Breez SDK Nodeless (Spark Implementation)
//
// NOTE: This service requires native modules. It will work in:
// - Development builds (npx expo run:android)
// - Production builds
import { BREEZ_API_KEY, BREEZ_STORAGE_DIR } from '../config';
import * as Notifications from 'expo-notifications';
// Note: Local notifications disabled - FCM push handles payment notifications
// import { sendPaymentReceivedNotification } from './notificationService';
import { NotificationTriggerService } from './notificationTriggerService';

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

export interface LightningAddressInfo {
  lightningAddress: string;  // Full address: username@domain
  username: string;          // Username part only
  description: string;       // Description/display name
  lnurl: string;            // LNURL representation
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

// Event listeners
type PaymentEventCallback = (payment: TransactionInfo) => void;
const paymentEventListeners: Set<PaymentEventCallback> = new Set();

// Active SDK event listener ID for cleanup
let activeEventListenerId: string | null = null;

// Track recently sent payment IDs to avoid sending "Payment Received" notifications for our own sends
const recentlySentPaymentIds: Set<string> = new Set();
const SENT_PAYMENT_TRACKING_MS = 60000; // Track for 1 minute

// =============================================================================
// Public API
// =============================================================================

/**
 * Get the local Node ID (Public Key)
 * Spark SDK doesn't expose node ID directly, so we generate a minimal invoice and parse it
 */
 export async function getNodeId(): Promise<string | null> {
  if (!_isNativeAvailable || !sdkInstance) return null;
  try {
    // Spark SDK doesn't have getNodeInfo() - try to get pubkey from a generated invoice
    const paymentMethod = BreezSDK.ReceivePaymentMethod.Bolt11Invoice.new({
      description: '__nodeId_probe__',
      amountSats: BigInt(1),
      expirySecs: 60,
    });
    
    const response = await sdkInstance.receivePayment({ paymentMethod });
    const invoice = response.paymentRequest;
    
    // Parse the invoice to get our own pubkey
    const parsed = await sdkInstance.parse(invoice);
    
    if (parsed.tag === 'Bolt11Invoice' && parsed.inner) {
      const innerData = Array.isArray(parsed.inner) ? parsed.inner[0] : parsed.inner;
      const nodeId = innerData?.payeePubkey || innerData?.destination || innerData?.nodeId;
      if (nodeId) {
        console.log('✅ [BreezSparkService] Got node ID:', nodeId.substring(0, 20) + '...');
        return nodeId;
      }
    }
    
    console.warn('⚠️ [BreezSparkService] Could not extract node ID from invoice');
    return null;
  } catch (err) {
    console.warn('⚠️ [BreezSparkService] Failed to get node ID:', err);
    return null;
  }
}


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
 * @param mnemonic - The wallet mnemonic
 * @param apiKey - Optional Breez API key
 * @param walletNickname - Optional wallet name for push notifications
 */
export async function initializeSDK(
  mnemonic: string,
  apiKey?: string,
  walletNickname?: string
): Promise<boolean> {
  const walletId = generateWalletStorageId(mnemonic);

  console.log('🔵 [BreezSparkService] initializeSDK called for wallet:', walletId);

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
    } else {
      console.warn('⚠️ [BreezSparkService] No API key configured');
    }

    // Use wallet-specific storage directory
    const storageDir = `${RNFS.DocumentDirectoryPath}/${BREEZ_STORAGE_DIR}/${walletId}`;
    // Storage directory set to: storageDir

    // Ensure storage directory exists
    const dirExists = await RNFS.exists(storageDir);
    if (!dirExists) {
      await RNFS.mkdir(storageDir);
    }


    sdkInstance = await BreezSDK.connect({
      config,
      seed,
      storageDir,
    });

    _isInitialized = true;

    // Setup event listeners for real-time payment notifications
    try {
      await setupEventListeners();
    } catch (eventError) {
      console.warn('⚠️ [BreezSparkService] Event listeners failed:', eventError);
      // Don't fail SDK init if events don't work - user can still pull-to-refresh
    }

    // NOTE: Webhook registration for background notifications is not available
    // in Breez SDK Spark. Notifications only work when the app is in foreground.
    // The NDS webhook infrastructure is ready in our Cloud Functions if Breez
    // adds this feature in the future.

    console.log('✅ [BreezSparkService] SDK initialized');

    // Register for notifications
    try {
        const nodeId = await getNodeId();
        if (nodeId) {
            const pushTokenData = await Notifications.getExpoPushTokenAsync();
            if (pushTokenData.data) {
              await NotificationTriggerService.registerDevice(nodeId, pushTokenData.data, walletNickname);
              console.log('✅ [BreezSparkService] Registered for push notifications');
            }
        }
    } catch (e) {
        console.warn('⚠️ [BreezSparkService] Notification registration warning:', e);
    }

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
    // Unsubscribe from events
    if (activeEventListenerId && sdkInstance) {
      try {
        await sdkInstance.removeEventListener(activeEventListenerId);
      } catch (e) {
        console.warn('⚠️ [BreezSparkService] Error removing listener during disconnect:', e);
      }
      activeEventListenerId = null;
    }

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
 * Subscribe to payment events
 * Returns unsubscribe function
 */
export function onPaymentReceived(callback: PaymentEventCallback): () => void {
  paymentEventListeners.add(callback);
  console.log('✅ [BreezSparkService] Payment event listener added');

  return () => {
    paymentEventListeners.delete(callback);
    console.log('✅ [BreezSparkService] Payment event listener removed');
  };
}


/**
 * Setup SDK event listeners
 * Based on: https://sdk-doc-spark.breez.technology/guide/events.html
 */
async function setupEventListeners(): Promise<void> {
  if (!sdkInstance || !_isNativeAvailable) return;

  try {
    // Unsubscribe from previous listener if exists
    if (activeEventListenerId) {
      try {
        await sdkInstance.removeEventListener(activeEventListenerId);
      } catch (e) {
        console.warn('⚠️ [BreezSparkService] Error removing listener:', e);
      }
      activeEventListenerId = null;
    }

    // Create event listener object with onEvent method (per SDK docs)
    // The SDK expects an object with an onEvent method, not a plain function
    const eventListener = {
      onEvent: async (event: unknown): Promise<void> => {
        try {
          // Cast to expected structure based on SDK docs
          const evt = event as {
            tag?: string;
            inner?: {
              payment?: unknown;
              unclaimedDeposits?: unknown;
              claimedDeposits?: unknown;
            };
          };

          const eventTag = evt?.tag || (event as Record<string, unknown>)?.type || 'unknown';

          // Handle PaymentSucceeded event (try multiple possible formats)
          const isPaymentEvent = 
            eventTag === 'PaymentSucceeded' || 
            eventTag === 'paymentSucceeded' ||
            eventTag === 'payment_succeeded';
            
          if (isPaymentEvent) {
            // Try to find payment data in different possible locations
            const paymentData = (
              evt?.inner?.payment || 
              (event as Record<string, unknown>)?.payment ||
              (event as Record<string, unknown>)?.data
            ) as Record<string, unknown>;
            
            // Determine if this is a received or sent payment
            // paymentType: 1 = receive, 0 = send (or string 'receive'/'send')
            const paymentType = paymentData?.paymentType;
            const isReceived = 
              paymentType === 1 || 
              paymentType === 'receive' || 
              paymentType === 'Receive' ||
              String(paymentType).toLowerCase() === 'receive';
            
            const payment: TransactionInfo = {
              id: String(paymentData?.id || Date.now()),
              type: isReceived ? 'receive' : 'send',
              amountSat: Number(paymentData?.amountSat || paymentData?.amount || paymentData?.amountSats || 0),
              feeSat: Number(paymentData?.feeSat || paymentData?.fee || paymentData?.feesSats || 0),
              status: 'completed',
              timestamp: Date.now(),
              description: String(paymentData?.description || ''),
            };

            // Only send push notification for RECEIVED payments
            // Skip if: not received, no amount, or we recently sent this payment ourselves
            const wasRecentlySent = recentlySentPaymentIds.has(payment.id);
            if (isReceived && payment.amountSat > 0 && !wasRecentlySent) {
              // NOTE: Local notification disabled - FCM push notifications now handle this
              // to prevent duplicate notifications when both local and remote fire.
              // The sender triggers a push notification via Cloud Function.
              // sendPaymentReceivedNotification(payment.amountSat, payment.description);
              console.log('🔔 [BreezSparkService] Payment received - push notification expected from sender');
            }

            // Notify all listeners (for UI refresh etc)
            paymentEventListeners.forEach((listener) => {
              try {
                listener(payment);
              } catch (err) {
                console.error('❌ [BreezSparkService] Listener callback error:', err);
              }
            });
          }

          // Handle Synced event - trigger refresh for all listeners
          if (eventTag === 'Synced') {
            // Create a "sync" event to notify listeners to refresh their data
            const syncEvent: TransactionInfo = {
              id: 'sync-' + Date.now(),
              type: 'receive',
              amountSat: 0,
              feeSat: 0,
              status: 'completed',
              timestamp: Date.now(),
              description: '__SYNC_EVENT__', // Special marker
            };
            // Notify listeners - they can check for this marker and refresh
            paymentEventListeners.forEach((listener) => {
              try {
                listener(syncEvent);
              } catch (err) {
                console.error('❌ [BreezSparkService] Sync listener error:', err);
              }
            });
          }

        } catch (handlerError) {
          console.error('❌ [BreezSparkService] Event handler error:', handlerError);
        }
      }
    };

    // Add the event listener using sdk.addEventListener(listener)
    const listenerId = await sdkInstance.addEventListener(eventListener);
    console.log('✅ [BreezSparkService] Event listener added with ID:', listenerId);
    
    // Store the ID for later removal
    activeEventListenerId = listenerId;

  } catch (error) {
    console.warn('⚠️ [BreezSparkService] Failed to setup event listeners:', error);
    // Don't fail initialization if events don't work
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

    // Re-check sdkInstance before fallback (could have disconnected during getInfo)
    if (!sdkInstance) {
      console.warn('⚠️ [BreezSparkService] SDK disconnected during balance fetch');
      return { balanceSat: 0, pendingSendSat: 0, pendingReceiveSat: 0 };
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

    // Track this payment ID so we don't show "Payment Received" notification for it
    const paymentId = response.payment?.id;
    if (paymentId) {
      recentlySentPaymentIds.add(paymentId);
      console.log('📤 [BreezSparkService] Tracking sent payment ID:', paymentId);
      // Remove from tracking after timeout
      global.setTimeout(() => {
        recentlySentPaymentIds.delete(paymentId);
      }, SENT_PAYMENT_TRACKING_MS);

            // Trigger notification to recipient if possible
            try {
              // Attempt to extract destination from payment request
              const parsed = await sdkInstance.parse(paymentRequest);
              
              // DEBUG LOGGING
              console.log('🔍 [BreezSparkService] Parsed invoice structure:', JSON.stringify(parsed, null, 2));

              let destinationPubkey: string | undefined;
              
              if (parsed.tag === 'Bolt11Invoice' && parsed.inner) {
                 const innerData = Array.isArray(parsed.inner) ? parsed.inner[0] : parsed.inner;
                 // Try multiple known fields
                 destinationPubkey = innerData?.payeePubkey || innerData?.destination || innerData?.nodeId; 
                 console.log('🔍 [BreezSparkService] Extracted pubkey from Bolt11:', destinationPubkey);
              }
              
              if (destinationPubkey) {
                   console.log('🔔 [BreezSparkService] Triggering notification for recipient:', destinationPubkey);
                   // Send async without awaiting so we don't block the UI
                   NotificationTriggerService.sendTransactionNotification(
                       { pubKey: destinationPubkey }, 
                       _amountSat || 0 // use amount provided or from invoice
                   )
                   .then(res => console.log('🔔 [BreezSparkService] Trigger result:', res))
                   .catch(e => console.warn('🔔 [BreezSparkService] Trigger failed:', e));
              } else {
                  console.warn('⚠️ [BreezSparkService] Could not find destination PubKey in invoice');
              }
          } catch (err) {
              console.warn('⚠️ [BreezSparkService] Failed to parse invoice for notification:', err);
          }
    }

    return {
      success: true,
      paymentId,
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
    console.log('⚠️ [BreezSparkService] listPayments: SDK not available');
    return [];
  }

  try {
    const response = await sdkInstance.listPayments({
      sortAscending: false,
    });

    const payments = response.payments || [];

    return payments.map((payment: any) => {
      // Try multiple field name variations (SDK may return different formats)
      const rawAmount = payment.amount ?? payment.amountSats ?? payment.amountSat ?? 0;
      const amountSat = typeof rawAmount === 'bigint' ? Number(rawAmount) : Number(rawAmount);

      const rawFees = payment.fees ?? payment.feesSats ?? payment.feeSat ?? payment.fee ?? 0;
      const feeSat = typeof rawFees === 'bigint' ? Number(rawFees) : Number(rawFees);

      const rawTime = payment.timestamp ?? payment.createdAt ?? 0;
      let timestamp = typeof rawTime === 'bigint' ? Number(rawTime) : Number(rawTime);
      // Convert from seconds to milliseconds if needed
      if (timestamp > 0 && timestamp < 10000000000) {
        timestamp *= 1000;
      }

      // Determine payment type - try multiple formats
      let type: 'receive' | 'send' = 'send';
      const paymentType = payment.paymentType;
      if (
        paymentType === 1 || 
        paymentType === '1' || 
        paymentType === 'receive' || 
        String(paymentType).toLowerCase() === 'receive'
      ) {
        type = 'receive';
      }

      const description = payment.details?.description || payment.description || '';

      const mappedStatus = mapPaymentStatus(payment.status);

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
    console.error('❌ [BreezSparkService] Failed to list payments:', error);
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

// =============================================================================
// Lightning Address Registration (LNURL)
// =============================================================================

/**
 * Check if a Lightning Address username is available
 * @param username - Desired username (without @domain)
 * @returns true if available, false if taken
 */
export async function checkLightningAddressAvailable(
  username: string
): Promise<boolean> {
  if (!_isNativeAvailable || !sdkInstance) {
    console.warn('⚠️ [BreezSparkService] checkLightningAddressAvailable: SDK not available');
    return false;
  }

  try {
    const request = { username };
    const available = await sdkInstance.checkLightningAddressAvailable(request);
    console.log(`✅ [BreezSparkService] Username "${username}" available:`, available);
    return available;
  } catch (error) {
    console.error('❌ [BreezSparkService] checkLightningAddressAvailable failed:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to check username availability'
    );
  }
}

/**
 * Register a Lightning Address
 * @param username - Desired username (without @domain)
 * @param description - Optional description for the address
 * @returns Registered address information
 */
export async function registerLightningAddress(
  username: string,
  description?: string
): Promise<LightningAddressInfo> {
  if (!_isNativeAvailable || !sdkInstance) {
    throw new Error('SDK not available. Please ensure the wallet is initialized.');
  }

  try {
    const request = {
      username,
      description: description || '',
    };
    const result = await sdkInstance.registerLightningAddress(request);

    const addressInfo: LightningAddressInfo = {
      lightningAddress: result.lightningAddress || `${username}@breez.tips`,
      username: result.username || username,
      description: result.description || description || '',
      lnurl: result.lnurl || '',
    };

    console.log('✅ [BreezSparkService] Lightning Address registered:', addressInfo.lightningAddress);
    return addressInfo;
  } catch (error) {
    console.error('❌ [BreezSparkService] registerLightningAddress failed:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to register Lightning Address'
    );
  }
}

/**
 * Get currently registered Lightning Address
 * @returns Address info or null if not registered
 */
export async function getLightningAddress(): Promise<LightningAddressInfo | null> {
  if (!_isNativeAvailable || !sdkInstance) {
    console.warn('⚠️ [BreezSparkService] getLightningAddress: SDK not available');
    return null;
  }

  try {
    const result = await sdkInstance.getLightningAddress();

    if (!result || !result.lightningAddress) {
      console.log('ℹ️ [BreezSparkService] No Lightning Address registered');
      return null;
    }

    const addressInfo: LightningAddressInfo = {
      lightningAddress: result.lightningAddress,
      username: result.username || result.lightningAddress.split('@')[0],
      description: result.description || '',
      lnurl: result.lnurl || '',
    };

    console.log('✅ [BreezSparkService] Got Lightning Address:', addressInfo.lightningAddress);
    return addressInfo;
  } catch (error) {
    console.error('❌ [BreezSparkService] getLightningAddress failed:', error);
    return null;
  }
}

/**
 * Unregister/delete the current Lightning Address
 */
export async function unregisterLightningAddress(): Promise<void> {
  if (!_isNativeAvailable || !sdkInstance) {
    throw new Error('SDK not available. Please ensure the wallet is initialized.');
  }

  try {
    await sdkInstance.deleteLightningAddress();
    console.log('✅ [BreezSparkService] Lightning Address unregistered');
  } catch (error) {
    console.error('❌ [BreezSparkService] unregisterLightningAddress failed:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to unregister Lightning Address'
    );
  }
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
  const trimmed = input.trim();
  const trimmedLower = trimmed.toLowerCase();

  // FIRST: Check for Lightning Address (user@domain.com) - handle locally, SDK doesn't support this
  // Must check before SDK parsing because SDK throws InvalidInput for Lightning Addresses
  if (trimmed.includes('@') && !trimmedLower.startsWith('lnurl') && !trimmedLower.startsWith('lnbc')) {
    const parts = trimmed.split('@');
    if (parts.length === 2 && parts[0] && parts[1] && parts[1].includes('.')) {
      // Valid Lightning Address format - no amount embedded, user must specify
      return { type: 'lightningAddress', isValid: true };
    }
  }

  // For other types, try SDK if available
  if (!_isNativeAvailable || !sdkInstance) {
    // Fallback to simple string matching if SDK not available
    if (trimmedLower.startsWith('lnurl')) {
      return { type: 'lnurl', isValid: true };
    }

    if (trimmedLower.startsWith('lnbc') || trimmedLower.startsWith('lntb') || trimmedLower.startsWith('lnbcrt')) {
      return { type: 'bolt11', isValid: true };
    }

    if (trimmedLower.startsWith('bc1') || trimmedLower.startsWith('1') || trimmedLower.startsWith('3') || trimmedLower.startsWith('tb1')) {
      return { type: 'bitcoinAddress', isValid: true };
    }

    if (trimmedLower.startsWith('sp1')) {
      return { type: 'sparkAddress', isValid: true };
    }

    return { type: 'unknown', isValid: false };
  }

  try {
    // Use SDK to parse for full details including amount
    const parsed = await sdkInstance.parse(trimmed);

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
 * Handles both BOLT11 invoices and Lightning Addresses (via LNURL resolution)
 */
export async function prepareSendPayment(
  paymentRequest: string,
  amountSat?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  if (!_isNativeAvailable || !sdkInstance) {
    throw new Error('SDK not available');
  }

  const trimmed = paymentRequest.trim();
  
  // Check if this is a Lightning Address (user@domain.com format)
  if (trimmed.includes('@') && !trimmed.toLowerCase().startsWith('lnurl') && !trimmed.toLowerCase().startsWith('lnbc')) {
    // Lightning Address needs to be resolved to LNURL pay endpoint first
    const parts = trimmed.split('@');
    if (parts.length === 2 && parts[0] && parts[1] && parts[1].includes('.')) {
      const [username, domain] = parts;
      const lnurlEndpoint = `https://${domain}/.well-known/lnurlp/${username}`;
      
      console.log('🔗 [BreezSparkService] Resolving Lightning Address:', trimmed);
      console.log('🔗 [BreezSparkService] LNURL endpoint:', lnurlEndpoint);
      
      try {
        // Step 1: Fetch LNURL pay data
        const lnurlResponse = await fetch(lnurlEndpoint);
        if (!lnurlResponse.ok) {
          throw new Error(`Failed to resolve Lightning Address: HTTP ${lnurlResponse.status}`);
        }
        
        const lnurlData = await lnurlResponse.json();
        console.log('🔗 [BreezSparkService] LNURL data:', JSON.stringify(lnurlData));
        
        if (lnurlData.tag !== 'payRequest') {
          throw new Error('Lightning Address does not support payments');
        }
        
        // Validate amount against min/max
        const amountMsat = (amountSat || 0) * 1000;
        if (amountMsat < lnurlData.minSendable) {
          throw new Error(`Amount too small. Minimum: ${Math.ceil(lnurlData.minSendable / 1000)} sats`);
        }
        if (amountMsat > lnurlData.maxSendable) {
          throw new Error(`Amount too large. Maximum: ${Math.floor(lnurlData.maxSendable / 1000)} sats`);
        }
        
        // Step 2: Request BOLT11 invoice from callback
        const callbackUrl = new URL(lnurlData.callback);
        callbackUrl.searchParams.set('amount', amountMsat.toString());
        
        console.log('🔗 [BreezSparkService] Fetching invoice from:', callbackUrl.toString());
        
        const invoiceResponse = await fetch(callbackUrl.toString());
        if (!invoiceResponse.ok) {
          throw new Error(`Failed to get invoice: HTTP ${invoiceResponse.status}`);
        }
        
        const invoiceData = await invoiceResponse.json();
        console.log('🔗 [BreezSparkService] Invoice response:', JSON.stringify(invoiceData));
        
        if (invoiceData.status === 'ERROR') {
          throw new Error(invoiceData.reason || 'Failed to generate invoice');
        }
        
        if (!invoiceData.pr) {
          throw new Error('No invoice received from Lightning Address provider');
        }
        
        // Step 3: Now prepare payment with the BOLT11 invoice
        console.log('🔗 [BreezSparkService] Preparing payment with BOLT11:', invoiceData.pr.substring(0, 30) + '...');
        
        return await sdkInstance.prepareSendPayment({
          paymentRequest: invoiceData.pr,
          // Don't pass amount for BOLT11 with embedded amount
        });
        
      } catch (error) {
        console.error('❌ [BreezSparkService] Lightning Address resolution failed:', error);
        throw error;
      }
    }
  }

  // For BOLT11, LNURL, or other formats, pass directly to SDK
  return await sdkInstance.prepareSendPayment({
    paymentRequest: trimmed,
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

    // Track this payment ID so we don't show "Payment Received" notification for it
    const paymentId = response.payment?.id;
    if (paymentId) {
      recentlySentPaymentIds.add(paymentId);
      console.log('📤 [BreezSparkService] Tracking sent payment ID (sendPayment):', paymentId);
      // Remove from tracking after timeout
      global.setTimeout(() => {
        recentlySentPaymentIds.delete(paymentId);
      }, SENT_PAYMENT_TRACKING_MS);
    }

    return {
      success: true,
      paymentId,
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
  // Handle numeric status codes from Breez SDK
  if (typeof status === 'number') {
    if (status === 0) return 'completed'; // Completed
    if (status === 1) return 'pending';   // Pending
    if (status === 2) return 'failed';    // Failed
    return 'pending'; // Default for unknown numeric codes
  }
  
  // Handle object status (e.g., { type: 'completed' })
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
  // Lightning Address Registration
  checkLightningAddressAvailable,
  registerLightningAddress,
  getLightningAddress,
  unregisterLightningAddress,
};

export default BreezSparkService;
