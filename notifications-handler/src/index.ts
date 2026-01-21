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
  RegisterPushTokenRequest,
} from './types.js';

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

/**
 * Formats the push notification message
 */
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

/**
 * Registers a user's push token mapped to their Public Key (Node ID)
 */
export const registerDevice = onRequest(
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

      const body = request.body as Partial<RegisterPushTokenRequest>;
      const { pubKey, expoPushToken, platform, walletNickname } = body;

      if (!pubKey || !expoPushToken) {
        response.status(400).json({
          success: false,
          error: 'Missing required fields: pubKey, expoPushToken',
        });
        return;
      }

      // Store in Firestore
      // Collection: 'users' -> Document: <pubKey>
      await db.collection('users').doc(pubKey).set({
        expoPushToken,
        platform: platform || 'unknown',
        walletNickname: walletNickname || undefined,
        updatedAt: new Date(),
      }, { merge: true });

      console.log(`✅ Registered token for user ${pubKey.substring(0, 8)}...`);

      response.status(200).json({
        success: true,
        message: 'Device registered successfully',
      });
    } catch (error) {
      console.error('❌ Registration failed:', error);
      response.status(500).json({
        success: false,
        error: 'Internal server error during registration',
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
      const { expoPushToken: directToken, recipientPubKey, amount } = body;

      // Validate inputs
      if (!amount) {
        response.status(400).json({ success: false, error: 'Amount is required' });
        return;
      }

      let tokensToSend: string[] = [];

      // 1. If direct token provided, use it
      if (directToken) {
        tokensToSend.push(directToken);
      }
      
      // 2. If recipientPubKey provided, look it up in Firestore
      // Store token + nickname pairs for personalized messages
      interface TokenInfo {
        token: string;
        walletNickname?: string;
      }
      let tokenInfos: TokenInfo[] = [];

      if (directToken) {
        tokenInfos.push({ token: directToken });
      }

      if (recipientPubKey) {
        const userDoc = await db.collection('users').doc(recipientPubKey).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData?.expoPushToken) {
            tokenInfos.push({ 
              token: userData.expoPushToken,
              walletNickname: userData.walletNickname 
            });
          } else {
            console.log(`⚠️ User ${recipientPubKey} found but no token.`);
          }
        } else {
          console.log(`⚠️ User ${recipientPubKey} not found in registry.`);
        }
      }

      // Allow either direct token OR looked-up token
      if (tokenInfos.length === 0) {
         response.status(404).json({
          success: false,
          error: 'No valid recipient token found. Provide expoPushToken or specify valid recipientPubKey.',
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

      // Send to all found tokens with personalized messages
      const results = await Promise.all(
        tokenInfos.map(info => {
          const message = formatPushMessage(info.token, amount, info.walletNickname);
          return sendPushNotification(message);
        })
      );

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

      const sendResult = await sendPushNotification(message);

      if (!sendResult.success) {
        console.error('[NDS] Failed to send push:', sendResult.error);
        response.status(500).json({
          success: false,
          error: sendResult.error,
        });
        return;
      }

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
