/**
 * Firebase Cloud Function for sending Expo push notifications
 * for Lightning wallet transactions
 */

import { onRequest } from 'firebase-functions/v2/https';
import { config } from './config.js';
import { validateRequest } from './validation.js';
import type {
  TransactionNotificationRequest,
  TransactionNotificationResponse,
  ExpoPushMessage,
  BreezWebhookRequest,
} from './types.js';

/**
 * Formats the push notification message
 */
function formatPushMessage(
  expoPushToken: string,
  amount: number
): ExpoPushMessage {
  return {
    to: expoPushToken,
    title: 'Payment Received',
    body: `You received ${amount} sats!`,
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
 * HTTP-triggered Cloud Function that sends transaction notifications
 *
 * Request Body:
 * - expoPushToken (string): Expo push token for the recipient device
 * - amount (number): Payment amount in satoshis
 *
 * Response:
 * - 200: Notification sent successfully
 * - 400: Invalid request parameters
 * - 500: Server error (Expo Push API failure or unexpected error)
 */
export const sendTransactionNotification = onRequest(
  { cors: true },
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
      const { expoPushToken, amount } = body;

      // Validate inputs
      const validation = validateRequest(expoPushToken, amount);
      if (!validation.valid) {
        response.status(400).json({
          success: false,
          error: validation.error,
        } satisfies TransactionNotificationResponse);
        return;
      }

      // Format the push message
      const message = formatPushMessage(expoPushToken as string, amount as number);

      // Send via Expo Push API
      const sendResult = await sendPushNotification(message);

      if (!sendResult.success) {
        console.error('Expo Push API error:', sendResult.error);
        response.status(500).json({
          success: false,
          error: `Failed to send notification: ${sendResult.error}`,
        } satisfies TransactionNotificationResponse);
        return;
      }

      // Success response
      response.status(200).json({
        success: true,
        message: 'Notification sent successfully',
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
  { cors: true },
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

      // Handle different notification templates
      let notificationTitle = 'Payment Update';
      let notificationBody = 'You have a payment update';

      if (body.template === 'payment_received') {
        notificationTitle = 'Payment Incoming';
        notificationBody = 'You have an incoming payment!';
      } else if (body.template === 'lnurlpay_info' || body.template === 'lnurlpay_invoice') {
        notificationTitle = 'Payment Request';
        notificationBody = 'Someone wants to pay you';
      }

      // Send push notification
      const message: ExpoPushMessage = {
        to: token,
        title: notificationTitle,
        body: notificationBody,
        data: {
          type: body.template || 'unknown',
          payment_hash: body.data?.payment_hash || '',
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
