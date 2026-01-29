/**
 * TypeScript interfaces for the Expo Push Notifications Handler
 */

/**
 * Request interface for transaction notifications
 */
export interface TransactionNotificationRequest {
  /**
   * Expo push token (e.g., "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]")
   * Required if recipientPubKey/recipientLightningAddress is not provided
   */
  expoPushToken?: string;

  /**
   * Recipient's Lightning Node ID (Public Key)
   * Used to look up the push token if not provided directly
   * NOTE: For Breez Spark users, this is the LSP's pubkey (shared by all users)
   */
  recipientPubKey?: string;

  /**
   * Recipient's Lightning Address (e.g., user@domain.com)
   * Used to look up the push token - unique per wallet
   * Preferred over recipientPubKey for Breez Spark users
   */
  recipientLightningAddress?: string;

  /** Amount in satoshis (positive integer) */
  amount: number;
}

/**
 * Request interface for registering a device
 */
export interface RegisterPushTokenRequest {
  /** User's Lightning Node ID (Public Key) */
  pubKey: string;
  /** Expo push token */
  expoPushToken: string;
  /** Platform (android/ios) - optional for analytics */
  platform?: string;
  /** Wallet nickname to show in notifications */
  walletNickname?: string;
}

/**
 * Response interface for notification API
 */
export interface TransactionNotificationResponse {
  /** Whether the notification/operation was sent successfully */
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

/**
 * Breez NDS webhook request structure
 * Called by Breez LSP when a payment is incoming
 * @see https://sdk-doc-greenlight.breez.technology/notifications/setup_nds.html
 */
export interface BreezWebhookRequest {
  /** Notification template type */
  template: 'payment_received' | 'lnurlpay_info' | 'lnurlpay_invoice';
  /** Notification data */
  data: {
    /** Payment hash for the incoming payment */
    payment_hash?: string;
    /** Amount in millisatoshis (for some templates) */
    amount_msat?: number;
    /** Callback URL (for LNURL templates) */
    callback_url?: string;
  };
}
