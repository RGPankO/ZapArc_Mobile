/**
 * TypeScript interfaces for the Expo Push Notifications Handler
 */

/**
 * Request interface for transaction notifications
 */
export interface TransactionNotificationRequest {
  /** Expo push token (e.g., "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]") */
  expoPushToken: string;
  /** Amount in satoshis (positive integer) */
  amount: number;
}

/**
 * Response interface for notification API
 */
export interface TransactionNotificationResponse {
  /** Whether the notification was sent successfully */
  success: boolean;
  /** Success message (present when success=true) */
  message?: string;
  /** Error description (present when success=false) */
  error?: string;
}

/**
 * Expo Push API message structure
 * @see https://docs.expo.dev/push-notifications/sending-notifications/
 */
export interface ExpoPushMessage {
  /** Expo push token to send the notification to */
  to: string;
  /** Notification title */
  title: string;
  /** Notification body text */
  body: string;
  /** Optional data payload */
  data?: Record<string, string | number | boolean>;
}

/**
 * Validation result structure
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
}
