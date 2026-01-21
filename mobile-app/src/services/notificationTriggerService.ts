/**
 * Service to trigger transaction notifications via Firebase Cloud Functions.
 */

// URL of the deployed Cloud Function
// In a real app, this should be in an environment variable
// URL of the deployed Cloud Function
// In a real app, this should be in an environment variable
const BASE_URL = 'https://europe-west3-investave-1337.cloudfunctions.net';
const NOTIFICATION_ENDPOINT = `${BASE_URL}/sendTransactionNotification`;
const REGISTER_ENDPOINT = `${BASE_URL}/registerDevice`;

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
    try {
      console.log(`🔔 [Notification] Registering device for node ${nodeId}...`);
      
      const response = await fetch(REGISTER_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pubKey: nodeId,
          expoPushToken: pushToken,
          platform: 'android', // You could use Platform.OS here
          walletNickname: walletNickname,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [Notification] Registration Failed: ${errorText}`);
        return { success: false, error: errorText };
      }

      const result = await response.json();
      console.log('✅ [Notification] Device registered:', result);
      return result;

    } catch (error) {
      console.error('❌ [Notification] Registration network error:', error);
      return { success: false, error: String(error) };
    }
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
