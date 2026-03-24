// Notification Service
// Handles sending local push notifications for payment events

import * as Notifications from 'expo-notifications';
import { settingsService } from './settingsService';

// Configure notification handler for foreground notifications
// When the app is in the foreground, suppress push alerts for payment
// notifications — the SDK event listener already refreshes the UI and
// shows a snackbar. Showing the push banner on top of that causes
// duplicate visual notifications.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;
    const isPaymentNotification =
      data?.type === 'payment_received' ||
      data?.type === 'transaction' ||
      notification.request.content.title?.includes('Payment');

    if (isPaymentNotification) {
      // Suppress in-app alert for payment pushes when the app is in foreground.
      // The SDK event listener already refreshes balance/transactions and shows
      // feedback. Without this, the user sees both the push banner AND the UI update.
      return {
        shouldShowAlert: false,
        shouldPlaySound: true,
        shouldSetBadge: false,
      };
    }

    // Show all other notification types normally
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    };
  },
});

/**
 * Send a notification for a received payment
 */
export async function sendPaymentReceivedNotification(
  amountSats: number,
  description?: string
): Promise<void> {
  try {
    // Check if notifications are enabled
    const settings = await settingsService.getUserSettings();
    if (!settings.notificationsEnabled || !settings.notifyPaymentReceived) {
      console.log('🔕 [NotificationService] Payment received notifications disabled');
      return;
    }

    // Check permission
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.log('🔕 [NotificationService] No notification permission');
      return;
    }

    // Format amount
    const formattedAmount = amountSats.toLocaleString();
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⚡ Payment Received!`,
        body: description 
          ? `+${formattedAmount} sats - ${description}`
          : `+${formattedAmount} sats`,
        data: { type: 'payment_received', amount: amountSats },
        sound: true,
      },
      trigger: null, // Immediate
    });

    console.log('✅ [NotificationService] Payment received notification sent');
  } catch (error) {
    console.error('❌ [NotificationService] Failed to send notification:', error);
  }
}

export const notificationService = {
  sendPaymentReceivedNotification,
};
