/**
 * Service to trigger transaction notifications via Firebase Cloud Functions.
 */
import { Platform } from 'react-native';

// URL of the deployed Cloud Function
const BASE_URL = 'https://europe-west3-investave-1337.cloudfunctions.net';
const NOTIFICATION_ENDPOINT = `${BASE_URL}/sendTransactionNotification`;
// registerDevice endpoint removed — syncSubscriptions handles all registration
const SYNC_SUBSCRIPTIONS_ENDPOINT = `${BASE_URL}/syncSubscriptions`;

// Deduplication: track recent registrations to prevent spam
const recentRegistrations = new Map<string, number>();
const REGISTRATION_COOLDOWN_MS = 30000; // 30 seconds between registrations for same nodeId
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

// Helper for async delay
const delay = (ms: number): Promise<void> => new Promise(resolve => global.setTimeout(resolve, ms));

interface NotificationResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export const NotificationTriggerService = {
  /**
   * Registers this device's push token with the backend, mapped to the Node ID
   * @param nodeId - Lightning Node ID (public key)
   * @param pushToken - Expo push token
   * @param walletNickname - Optional wallet name to show in notifications
   */
  async registerDevice(
    nodeId: string,
    pushToken: string,
    walletNickname?: string
  ): Promise<NotificationResponse> {
    // Deduplication: skip if recently registered
    const lastRegistration = recentRegistrations.get(nodeId);
    const now = Date.now();
    if (lastRegistration && (now - lastRegistration) < REGISTRATION_COOLDOWN_MS) {
      console.log(`🔔 [Notification] Skipping registration - already registered ${Math.round((now - lastRegistration) / 1000)}s ago`);
      return { success: true, message: 'Already registered recently' };
    }

    // Attempt registration with retry
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`🔔 [Notification] Registering device for node ${nodeId.substring(0, 16)}... (attempt ${attempt}/${MAX_RETRIES})`);
        
        const response = await fetch(REGISTER_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pubKey: nodeId,
            expoPushToken: pushToken,
            platform: Platform.OS,
            walletNickname: walletNickname,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`⚠️ [Notification] Registration Failed (attempt ${attempt}): ${errorText}`);
          
          // Retry on server errors (5xx), not client errors (4xx)
          if (response.status >= 500 && attempt < MAX_RETRIES) {
            await delay(RETRY_DELAY_MS * attempt);
            continue;
          }
          
          return { success: false, error: errorText };
        }

        const result = await response.json();
        console.log('✅ [Notification] Device registered:', result);
        
        // Track successful registration
        recentRegistrations.set(nodeId, now);
        
        return result;

      } catch (error) {
        console.warn(`⚠️ [Notification] Registration network error (attempt ${attempt}):`, error);
        
        // Retry on network errors
        if (attempt < MAX_RETRIES) {
          await delay(RETRY_DELAY_MS * attempt);
          continue;
        }
        
        return { success: false, error: String(error) };
      }
    }

    return { success: false, error: 'Max retries exceeded' };
  },

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
