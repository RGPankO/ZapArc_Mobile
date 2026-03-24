/**
 * Service to trigger transaction notifications via Firebase Cloud Functions.
 */
import { Platform } from 'react-native';

// URL of the deployed Cloud Functions
const BASE_URL = 'https://europe-west3-investave-1337.cloudfunctions.net';
const NOTIFICATION_ENDPOINT = `${BASE_URL}/sendTransactionNotification`;
const SYNC_SUBSCRIPTIONS_ENDPOINT = `${BASE_URL}/syncSubscriptions`;

interface NotificationResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export const NotificationTriggerService = {
  // registerDevice removed — use syncSubscriptions for all registration

  /**
   * Sync all wallet identifiers for this device token in one shot.
   * Backend should replace existing mappings for this token.
   */
  async syncSubscriptions(
    pushToken: string,
    identifiers: string[],
    walletNickname?: string
  ): Promise<NotificationResponse> {
    try {
      const uniqueIdentifiers = Array.from(new Set(identifiers.map(i => i.trim()).filter(Boolean)));
      if (!pushToken || uniqueIdentifiers.length === 0) {
        return { success: false, error: 'Missing push token or identifiers' };
      }

      console.log(`🔄 [Notification] Syncing subscriptions (${uniqueIdentifiers.length})`);

      const response = await fetch(SYNC_SUBSCRIPTIONS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expoPushToken: pushToken,
          identifiers: uniqueIdentifiers,
          platform: Platform.OS,
          walletNickname,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`⚠️ [Notification] Sync subscriptions failed (${response.status}): ${errorText}`);
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const result = await response.json();
      console.log('✅ [Notification] Subscriptions synced:', result);
      return result;
    } catch (error) {
      console.warn('⚠️ [Notification] syncSubscriptions network error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown network error',
      };
    }
  },

  /**
   * Triggers a push notification to the recipient device.
   * Can use direct token, recipient PubKey, or Lightning Address for lookup.
   */
  async sendTransactionNotification(
    recipient: { pushToken?: string; lightningAddress?: string },
    amountSats: number
  ): Promise<NotificationResponse> {
    try {
      if (!recipient.pushToken && !recipient.lightningAddress) {
        return { success: false, error: 'Must provide pushToken or lightningAddress' };
      }

      if (__DEV__) {
        console.log('🔔 [Notification] Sending transaction notification');
      }

      const response = await fetch(NOTIFICATION_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expoPushToken: recipient.pushToken,
          recipientLightningAddress: recipient.lightningAddress,
          amount: amountSats,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`⚠️ [Notification] HTTP Error ${response.status}: ${errorText}`);
        return {
          success: false,
          error: `HTTP Error ${response.status}: ${errorText}`,
        };
      }

      const result = await response.json();
      console.log('✅ [Notification] Result:', result);
      return result;
    } catch (error) {
      console.warn('⚠️ [Notification] Network request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown network error',
      };
    }
  },
};
