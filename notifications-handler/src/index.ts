/**
 * Firebase Cloud Function for sending Expo push notifications
 * for Lightning wallet transactions
 */

import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from './config.js';
import { validateRequest } from './validation.js';
import type {
  TransactionNotificationRequest,
  TransactionNotificationResponse,
  ExpoPushMessage,
  BreezWebhookRequest,
  SyncSubscriptionsRequest,
  WalletSubscription,
} from './types.js';

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

// Deduplication: track recently notified recipients to prevent double pushes
// when both the sender and the NDS webhook fire for the same payment.
// Key: normalized recipient identifier, Value: timestamp
const recentNotifications = new Map<string, number>();
const DEDUP_WINDOW_MS = 30_000; // 30 seconds

/**
 * Formats the push notification message
 */
function normalizeIdentifier(identifier: string): string {
  const trimmed = identifier.trim();
  return trimmed.includes('@') ? trimmed.toLowerCase() : trimmed;
}

function formatPushMessage(
  expoPushToken: string,
  amount: number,
  walletNickname?: string
): ExpoPushMessage {
  const walletInfo = walletNickname ? ` on ${walletNickname}` : '';
  return {
    to: expoPushToken,
    title: 'Payment Received',
    body: `You received ${amount} sats${walletInfo}!`,
    data: { amount, walletNickname: walletNickname || '' },
  };
}

/**
 * Sends a push notification via the Expo Push API
 */
async function sendPushNotification(
  message: ExpoPushMessage
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(config.EXPO_PUSH_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Expo Push API returned ${response.status}: ${errorText}`,
      };
    }

    // Type for Expo Push API response
    interface ExpoTicket {
      status: 'ok' | 'error';
      message?: string;
    }
    interface ExpoPushResponse {
      data?: ExpoTicket[];
    }

    const result = (await response.json()) as ExpoPushResponse;

    // Check for Expo-specific errors in the response
    if (result.data && Array.isArray(result.data)) {
      const ticketResult = result.data[0];
      if (ticketResult?.status === 'error') {
        return {
          success: false,
          error: ticketResult.message || 'Unknown Expo Push API error',
        };
      }
    }

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to send notification: ${errorMessage}`,
    };
  }
}

// registerDevice removed — syncSubscriptions handles all registration
// (single and multi-wallet, with stale mapping cleanup)

/**
 * Sync subscriptions for one expo push token (replace-all semantics).
 * Accepts either structured `wallets` array (pubkey + address) or legacy `identifiers` (addresses only).
 * Removes stale mappings that are no longer active on this device.
 *
 * Firestore structure (users collection):
 *   doc id = normalizedIdentifier (lightning address)
 *   fields: { expoPushToken, identityPubkey?, platform, walletNickname?, updatedAt }
 *
 * Also maintains a pubkey index (pubkeys collection):
 *   doc id = identityPubkey
 *   fields: { lightningAddress, expoPushToken, updatedAt }
 */
export const syncSubscriptions = onRequest(
  { cors: true, region: 'europe-west3' },
  async (request, response) => {
    try {
      if (request.method !== 'POST') {
        response.status(405).json({
          success: false,
          error: 'Method not allowed. Use POST.',
        });
        return;
      }

      const body = request.body as Partial<SyncSubscriptionsRequest>;
      const { expoPushToken, wallets, identifiers, platform, walletNickname } = body;

      if (!expoPushToken) {
        response.status(400).json({
          success: false,
          error: 'Missing required field: expoPushToken',
        });
        return;
      }

      // Build normalized wallet list from either wallets[] or identifiers[]
      interface ResolvedEntry {
        lightningAddress: string;
        identityPubkey?: string;
      }
      const entries: ResolvedEntry[] = [];

      if (Array.isArray(wallets) && wallets.length > 0) {
        // New format: structured wallet entries with pubkey
        for (const w of wallets) {
          if (w.lightningAddress && typeof w.lightningAddress === 'string') {
            entries.push({
              lightningAddress: normalizeIdentifier(w.lightningAddress),
              identityPubkey: w.identityPubkey?.trim() || undefined,
            });
          }
        }
      } else if (Array.isArray(identifiers)) {
        // Legacy format: flat lightning address strings
        for (const id of identifiers) {
          if (typeof id === 'string' && id.trim().length > 0) {
            entries.push({ lightningAddress: normalizeIdentifier(id) });
          }
        }
      }

      if (entries.length === 0) {
        response.status(400).json({
          success: false,
          error: 'Must provide wallets[] or identifiers[] with at least one entry',
        });
        return;
      }

      // Deduplicate by lightning address
      const seen = new Set<string>();
      const uniqueEntries = entries.filter(e => {
        if (seen.has(e.lightningAddress)) return false;
        seen.add(e.lightningAddress);
        return true;
      });

      // 1) Find all existing docs currently mapped to this token
      const existingSnap = await db.collection('users')
        .where('expoPushToken', '==', expoPushToken)
        .get();

      const existingIds = existingSnap.docs.map(d => d.id);
      const keepSet = new Set(uniqueEntries.map(e => e.lightningAddress));

      // 2) Remove stale mappings for this token (users + pubkeys collections)
      const staleIds = existingIds.filter(id => !keepSet.has(id));
      await Promise.all(
        staleIds.map(async (id) => {
          const doc = await db.collection('users').doc(id).get();
          const pubkey = doc.data()?.identityPubkey;
          // Delete user doc
          await db.collection('users').doc(id).delete();
          // Delete pubkey index if it exists
          if (pubkey) {
            await db.collection('pubkeys').doc(pubkey).delete().catch(() => {});
          }
        })
      );

      // 3) Upsert all desired mappings (users + pubkeys)
      await Promise.all(
        uniqueEntries.map(async (entry) => {
          // Upsert user doc (keyed by lightning address)
          const userData: Record<string, unknown> = {
            expoPushToken,
            platform: platform || 'unknown',
            walletNickname: walletNickname || undefined,
            updatedAt: new Date(),
          };
          if (entry.identityPubkey) {
            userData.identityPubkey = entry.identityPubkey;
          }
          await db.collection('users').doc(entry.lightningAddress).set(userData, { merge: true });

          // Upsert pubkey index (keyed by identity pubkey)
          if (entry.identityPubkey) {
            await db.collection('pubkeys').doc(entry.identityPubkey).set({
              lightningAddress: entry.lightningAddress,
              expoPushToken,
              platform: platform || 'unknown',
              updatedAt: new Date(),
            }, { merge: true });
          }
        })
      );

      console.log('✅ syncSubscriptions complete', {
        tokenPrefix: expoPushToken.substring(0, 20),
        kept: uniqueEntries.length,
        withPubkey: uniqueEntries.filter(e => e.identityPubkey).length,
        removed: staleIds.length,
      });

      response.status(200).json({
        success: true,
        message: 'Subscriptions synced successfully',
      });
    } catch (error) {
      console.error('❌ syncSubscriptions failed:', error);
      response.status(500).json({
        success: false,
        error: 'Internal server error during subscription sync',
      });
    }
  }
);

/**
 * HTTP-triggered Cloud Function that sends transaction notifications
 */
export const sendTransactionNotification = onRequest(
  { cors: true, region: 'europe-west3' },
  async (request, response) => {
    try {
      // Only allow POST requests
      if (request.method !== 'POST') {
        response.status(405).json({
          success: false,
          error: 'Method not allowed. Use POST.',
        } satisfies TransactionNotificationResponse);
        return;
      }

      // Parse request body
      const body = request.body as Partial<TransactionNotificationRequest>;
      const { expoPushToken: directToken, recipientPubKey, recipientLightningAddress, amount } = body;
      const recipientPubkey = (body as Record<string, unknown>).recipientPubkey as string | undefined;

      // Validate inputs
      if (!amount) {
        response.status(400).json({ success: false, error: 'Amount is required' });
        return;
      }
      if (!directToken && !recipientLightningAddress && !recipientPubkey) {
        response.status(400).json({
          success: false,
          error: 'Provide expoPushToken, recipientLightningAddress, or recipientPubkey',
        });
        return;
      }
      if (recipientPubKey && !recipientLightningAddress && !directToken && !recipientPubkey) {
        console.warn('⚠️ recipientPubKey (legacy) only routing is disabled to prevent cross-wallet notifications');
      }

      // Store token + nickname pairs for personalized messages
      interface TokenInfo {
        token: string;
        walletNickname?: string;
      }
      let tokenInfos: TokenInfo[] = [];

      // 1. If direct token provided, use it
      if (directToken) {
        tokenInfos.push({ token: directToken });
      }

      // 2. If recipientLightningAddress provided, look it up in Firestore
      // Lightning Address is unique per wallet (unlike nodeId for Breez Spark users)
      if (recipientLightningAddress) {
        // Normalize Lightning Address (lowercase, trim)
        const normalizedAddress = recipientLightningAddress.toLowerCase().trim();
        const userDoc = await db.collection('users').doc(normalizedAddress).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData?.expoPushToken) {
            tokenInfos.push({
              token: userData.expoPushToken,
              walletNickname: userData.walletNickname
            });
            console.log(`✅ Found token for Lightning Address ${normalizedAddress}`);
          } else {
            console.log(`⚠️ Lightning Address ${normalizedAddress} found but no token.`);
          }
        } else {
          console.log(`⚠️ Lightning Address ${normalizedAddress} not found in registry.`);
        }
      }

      // 3. If recipientPubkey provided, look it up in the pubkeys collection
      if (recipientPubkey && tokenInfos.length === 0) {
        const pubkeyDoc = await db.collection('pubkeys').doc(recipientPubkey).get();
        if (pubkeyDoc.exists) {
          const pkData = pubkeyDoc.data();
          if (pkData?.expoPushToken) {
            tokenInfos.push({
              token: pkData.expoPushToken,
              walletNickname: undefined, // look up from users collection if needed
            });
            console.log(`✅ Found token for identityPubkey ${recipientPubkey.substring(0, 16)}…`);
          }
        } else {
          console.log(`⚠️ identityPubkey ${recipientPubkey.substring(0, 16)}… not found in pubkeys registry`);
        }
      }

      // Allow either direct token OR looked-up token
      if (tokenInfos.length === 0) {
         response.status(404).json({
          success: false,
          error: 'No valid recipient token found. Provide expoPushToken or valid recipientLightningAddress.',
        } satisfies TransactionNotificationResponse);
        return;
      }

      // Deduplicate by token
      const seenTokens = new Set<string>();
      tokenInfos = tokenInfos.filter(info => {
        if (seenTokens.has(info.token)) return false;
        seenTokens.add(info.token);
        return true;
      });

      // Dedup check: skip if this recipient was recently notified (e.g. by NDS webhook)
      const now = Date.now();
      tokenInfos = tokenInfos.filter(info => {
        const lastNotified = recentNotifications.get(info.token);
        if (lastNotified && (now - lastNotified) < DEDUP_WINDOW_MS) {
          console.log(`⏭️ Skipping duplicate notification for token ${info.token.substring(0, 20)}... (notified ${Math.round((now - lastNotified) / 1000)}s ago)`);
          return false;
        }
        return true;
      });

      if (tokenInfos.length === 0) {
        response.status(200).json({
          success: true,
          message: 'Notification already sent recently (deduplicated)',
        } satisfies TransactionNotificationResponse);
        return;
      }

      // Send to all found tokens with personalized messages
      const results = await Promise.all(
        tokenInfos.map(info => {
          const message = formatPushMessage(info.token, amount, info.walletNickname);
          return sendPushNotification(message);
        })
      );

      // Track sent notifications for dedup
      for (const info of tokenInfos) {
        recentNotifications.set(info.token, now);
      }

      // Check if ANY succeeded
      const anySuccess = results.some(r => r.success);
      const errors = results.filter(r => !r.success).map(r => r.error).join(', ');

      if (!anySuccess) {
        console.error('Expo Push API error(s):', errors);
        response.status(500).json({
          success: false,
          error: `Failed to send notification(s): ${errors}`,
        } satisfies TransactionNotificationResponse);
        return;
      }

      // Success response
      response.status(200).json({
        success: true,
        message: `Notification sent successfully to ${tokenInfos.length} device(s)`,
      } satisfies TransactionNotificationResponse);
    } catch (error) {
      // Handle unexpected errors
      console.error('Unexpected error:', error);
      response.status(500).json({
        success: false,
        error: 'An unexpected error occurred',
      } satisfies TransactionNotificationResponse);
    }
  }
);

/**
 * NDS (Notification Delivery Service) webhook endpoint
 * Called by Breez LSP when an incoming payment is detected
 *
 * URL format: /notify?platform=android&token=<EXPO_PUSH_TOKEN>
 *
 * The Breez SDK registers this webhook URL, and when a payment arrives,
 * the LSP calls this endpoint. We then forward the notification to
 * the device via Expo Push API.
 *
 * @see https://sdk-doc-greenlight.breez.technology/notifications/setup_nds.html
 */
export const notify = onRequest(
  { cors: true, region: 'europe-west3' },
  async (request, response) => {
    try {
      // Only allow POST requests
      if (request.method !== 'POST') {
        response.status(405).json({
          success: false,
          error: 'Method not allowed. Use POST.',
        });
        return;
      }

      // Extract token from query params
      // URL format: /notify?platform=android&token=ExponentPushToken[xxx]
      const token = request.query.token as string | undefined;
      const platform = request.query.platform as string | undefined;

      console.log('[NDS] Webhook received:', {
        platform,
        hasToken: !!token,
        tokenPrefix: token?.substring(0, 20),
      });

      if (!token) {
        console.error('[NDS] Missing token in query params');
        response.status(400).json({
          success: false,
          error: 'Missing token query parameter',
        });
        return;
      }

      // Validate token format
      if (!token.startsWith('ExponentPushToken[')) {
        console.error('[NDS] Invalid token format:', token.substring(0, 30));
        response.status(400).json({
          success: false,
          error: 'Invalid Expo push token format',
        });
        return;
      }

      // Parse webhook body from Breez LSP
      const body = request.body as BreezWebhookRequest;
      console.log('[NDS] Webhook body:', JSON.stringify(body));

      // Look up wallet nickname from Firestore by push token
      let walletNickname: string | undefined;
      try {
        const usersSnapshot = await db.collection('users')
          .where('expoPushToken', '==', token)
          .limit(1)
          .get();

        if (!usersSnapshot.empty) {
          const userData = usersSnapshot.docs[0].data();
          walletNickname = userData.walletNickname;
          console.log('[NDS] Found wallet nickname:', walletNickname);
        }
      } catch (lookupError) {
        console.log('[NDS] Could not look up wallet nickname:', lookupError);
        // Continue without nickname - notification will still be sent
      }

      // Handle different notification templates
      let notificationTitle = 'Payment Update';
      let notificationBody = 'You have a payment update';
      const walletInfo = walletNickname ? ` on ${walletNickname}` : '';

      // Convert millisats to sats if amount is available
      const amountSats = body.data?.amount_msat
        ? Math.floor(body.data.amount_msat / 1000)
        : undefined;
      const amountText = amountSats ? `${amountSats.toLocaleString()} sats` : '';

      if (body.template === 'payment_received') {
        notificationTitle = 'Payment Received';
        if (amountText) {
          notificationBody = `You received ${amountText}${walletInfo}!`;
        } else {
          notificationBody = `You have an incoming payment${walletInfo}!`;
        }
      } else if (body.template === 'lnurlpay_info' || body.template === 'lnurlpay_invoice') {
        notificationTitle = 'Payment Request';
        notificationBody = `Someone wants to pay you${walletInfo}`;
      } else {
        notificationBody = `You have a payment update${walletInfo}`;
      }

      // Send push notification
      const message: ExpoPushMessage = {
        to: token,
        title: notificationTitle,
        body: notificationBody,
        data: {
          type: body.template || 'unknown',
          payment_hash: body.data?.payment_hash || '',
          walletNickname: walletNickname || '',
          amount: amountSats || 0,
        },
      };

      // Dedup check: skip if this token was recently notified (e.g. by sender-triggered push)
      const now = Date.now();
      const lastNotified = recentNotifications.get(token);
      if (lastNotified && (now - lastNotified) < DEDUP_WINDOW_MS) {
        console.log(`[NDS] ⏭️ Skipping duplicate — token notified ${Math.round((now - lastNotified) / 1000)}s ago`);
        response.status(200).json({
          success: true,
          message: 'Notification already sent recently (deduplicated)',
        });
        return;
      }

      const sendResult = await sendPushNotification(message);

      if (!sendResult.success) {
        console.error('[NDS] Failed to send push:', sendResult.error);
        response.status(500).json({
          success: false,
          error: sendResult.error,
        });
        return;
      }

      // Track for dedup
      recentNotifications.set(token, now);

      console.log('[NDS] Push notification sent successfully');
      response.status(200).json({
        success: true,
        message: 'Notification delivered',
      });
    } catch (error) {
      console.error('[NDS] Unexpected error:', error);
      response.status(500).json({
        success: false,
        error: 'An unexpected error occurred',
      });
    }
  }
);
