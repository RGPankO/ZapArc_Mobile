/**
 * Service to trigger transaction notifications via Firebase Cloud Functions.
 */

// URL of the deployed Cloud Function
const BASE_URL = 'https://europe-west3-investave-1337.cloudfunctions.net';
const NOTIFICATION_ENDPOINT = `${BASE_URL}/sendTransactionNotification`;
const REGISTER_ENDPOINT = `${BASE_URL}/registerDevice`;

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
            platform: 'android',
            walletNickname: walletNickname,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ [Notification] Registration Failed (attempt ${attempt}): ${errorText}`);
          
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
        console.error(`❌ [Notification] Registration network error (attempt ${attempt}):`, error);
        
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
   * Triggers a push notification to the recipient device.
   * Can use either direct token (legacy) or recipient PubKey (lookup).
   */
  async sendTransactionNotification(
    recipient: { pushToken?: string; pubKey?: string },
    amountSats: number
  ): Promise<NotificationResponse> {
    try {
      if (!recipient.pushToken && !recipient.pubKey) {
        return { success: false, error: 'Must provide either pushToken or pubKey' };
      }

      console.log(`🔔 [Notification] Sending ${amountSats} sats notification to ${recipient.pubKey || recipient.pushToken}...`);
      
      const response = await fetch(NOTIFICATION_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expoPushToken: recipient.pushToken,
          recipientPubKey: recipient.pubKey,
          amount: amountSats,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [Notification] HTTP Error ${response.status}: ${errorText}`);
        return {
          success: false,
          error: `HTTP Error ${response.status}: ${errorText}`,
        };
      }

      const result = await response.json();
      console.log('✅ [Notification] Result:', result);
      return result;
    } catch (error) {
      console.error('❌ [Notification] Network request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown network error',
      };
    }
  },
};
