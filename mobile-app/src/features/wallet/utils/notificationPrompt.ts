// Prompt for push notification permission after wallet setup
// Only prompts once per app install using settingsService flag

import * as Notifications from 'expo-notifications';
import { settingsService } from '../../../services';

/**
 * Prompt the user for notification permissions if not already asked.
 * Call this after wallet creation, import, or restore completes.
 * Safe to call multiple times — will only prompt once.
 */
export async function promptNotificationsIfNeeded(): Promise<void> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') {
      // Already granted — ensure settings reflect this
      await settingsService.updateUserSettings({
        notificationsEnabled: true,
        notifyPaymentReceived: true,
      });
      return;
    }

    // Check if we already prompted (avoid asking twice)
    const settings = await settingsService.getUserSettings();
    if (settings && settings.notificationsEnabled !== undefined) {
      // Settings exist with an explicit value — user was already prompted
      return;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    if (status === 'granted') {
      await settingsService.updateUserSettings({
        notificationsEnabled: true,
        notifyPaymentReceived: true,
      });
      console.log('✅ [NotificationPrompt] Permission granted');
    } else {
      // Store explicit false so we never prompt again after denial
      await settingsService.updateUserSettings({
        notificationsEnabled: false,
      });
      console.log('ℹ️ [NotificationPrompt] Permission denied/deferred');
    }
  } catch (err) {
    console.warn('⚠️ [NotificationPrompt] Failed to request permission:', err);
  }
}
