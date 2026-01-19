/**
 * Service to trigger transaction notifications via Firebase Cloud Functions.
 */

// URL of the deployed Cloud Function
// In a real app, this should be in an environment variable
const NOTIFICATION_SERVICE_URL = 'https://us-central1-investave-1337.cloudfunctions.net/sendTransactionNotification';

interface NotificationResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export const NotificationTriggerService = {
  /**
   * Triggers a push notification to the recipient device.
   * 
   * @param recipientPushToken - The Expo Push Token of the recipient
   * @param amountSats - The amount sent in satoshis
   */
  async sendTransactionNotification(
    recipientPushToken: string,
    amountSats: number
  ): Promise<NotificationResponse> {
    try {
      console.log(`🔔 [Notification] Sending ${amountSats} sats notification to ${recipientPushToken}...`);
      
      const response = await fetch(NOTIFICATION_SERVICE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expoPushToken: recipientPushToken,
          amount: amountSats,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [Notification] HTTP Error ${response.status}: ${errorText}`);
        return {
          success: false,
          error: `HTTP Error: ${response.status}`,
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
