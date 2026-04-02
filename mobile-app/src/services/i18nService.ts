// i18n (Internationalization) Service
// Handles translations for English and Bulgarian

import { settingsService } from './settingsService';
import { locationService } from './locationService';

// =============================================================================
// Types
// =============================================================================

export type SupportedLanguage = 'en' | 'bg';

export interface TranslationParams {
  [key: string]: string | number;
}

type TranslationValue = string | { [key: string]: TranslationValue };

export interface TranslationSet {
  [key: string]: TranslationValue;
}

// =============================================================================
// Translations
// =============================================================================

const translations: Record<SupportedLanguage, TranslationSet> = {
  en: {
    // Common
    common: {
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      cancel: 'Cancel',
      confirm: 'Confirm',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      done: 'Done',
      next: 'Next',
      back: 'Back',
      skip: 'Skip',
      retry: 'Retry',
      close: 'Close',
      yes: 'Yes',
      no: 'No',
      ok: 'OK',
      copied: 'Copied!',
      share: 'Share',
      seeAll: 'See All',
      tapToReveal: 'Tap to reveal',
      all: 'All',
      enabled: 'Enabled',
      disabled: 'Disabled',
      auto: 'Auto',
      now: 'now',
      to: 'to',
      minutes: 'minutes',
      seconds: 'seconds',
    },

    // Auth
    auth: {
      enterPin: 'Enter your PIN',
      createPin: 'Create a PIN',
      confirmPin: 'Confirm your PIN',
      incorrectPin: 'Incorrect PIN',
      wrongPin: 'Wrong PIN. Please try again.',
      pinMismatch: 'PINs do not match. Please try again.',
      unlockWallet: 'Unlock Wallet',
      unlockFailed: 'Unlock failed',
      useBiometric: 'Use biometric',
      useFaceId: 'Use Face ID',
      useFingerprint: 'Use Fingerprint',
      useIrisScan: 'Use Iris Scan',
      enterPinToSwitch: 'Please enter PIN to switch wallets',
      pinLengthRequirement: 'PIN must be exactly 6 digits',
      attemptsRemaining: '{{count}} attempts remaining',
      forgotPin: 'Forgot PIN?',
      switchWallet: 'Switch Wallet',
      unlocking: 'Unlocking…',
    },

    // Wallet
    wallet: {
      balance: 'Balance',
      sats: 'sats',
      send: 'Send',
      receive: 'Receive',
      transactions: 'Transactions',
      transactionHistory: 'Transaction History',
      noTransactions: 'No transactions yet',
      noTransactionsFound: 'No {{filter}} transactions found',
      historyWillAppear: 'Your transaction history will appear here',
      getStarted: 'Send or receive Bitcoin to get started',
      transactionDetails: 'Transaction Details',
      type: 'Type',
      method: 'Method',
      received: 'Received',
      sent: 'Sent',
      receivedPlural: 'Received',
      sentPlural: 'Sent',
      receivedPayment: 'Received payment',
      sentPayment: 'Sent payment',
      date: 'Date',
      time: 'Time',
      fee: 'Fee',
      paymentHash: 'Payment Hash',
      statusCompleted: 'Completed',
      statusPending: 'Pending',
      statusFailed: 'Failed',
      walletFallback: 'Wallet',
      mainWalletFallback: 'Main Wallet',
      methodOnchain: 'On-chain',
      methodLightning: 'Lightning',
      viewOnMempool: 'View on mempool.space',
      createWallet: 'Create Wallet',
      importWallet: 'Import Wallet',
      enterMnemonic: 'Enter your 12-word recovery phrase',
      walletCreated: 'Wallet created successfully!',
      walletImported: 'Wallet imported successfully!',
      invalidMnemonic: 'Invalid recovery phrase. Please check and try again.',
      masterKey: 'Master Key',
      subWallet: 'Sub-Wallet',
      addSubWallet: 'Add Sub-Wallet',
      manageWallets: 'Manage Wallets',
      switchWallet: 'Switch Wallet',
      archivedWallets: 'Archived Wallets',
      viewArchivedWallets: 'View and restore hidden sub-wallets',
      noArchivedWallets: 'No Archived Wallets',
      archivedWalletsEmptyDescription: 'Sub-wallets you archive from the management page will appear here',
      archivedWalletsInfo: 'These wallets are currently hidden from your main dashboard. You can restore them at any time.',
      from: 'From',
      index: 'Index',
      subWalletRestoredSuccessfully: 'Sub-wallet restored successfully',
      failedToRestoreSubWallet: 'Failed to restore sub-wallet',
      archiveWallet: 'Archive Wallet',
      restoreWallet: 'Restore Wallet',
      deleteWallet: 'Delete Wallet',
      deleteConfirm: 'Are you sure you want to delete this wallet?',
      backupReminder: 'Please backup your recovery phrase!',
      copyMnemonic: 'Copy Recovery Phrase',
      showMnemonic: 'Show Recovery Phrase',
      viewRecoveryPhrase: 'View Recovery Phrase',
      backupSeedPhrase: 'Backup your wallet seed phrase',
    },

    // Payments
    payments: {
      amount: 'Amount',
      amountSats: 'Amount (sats)',
      enterAmount: 'Enter amount',
      description: 'Description (optional)',
      invoice: 'Lightning Invoice',
      pasteInvoice: 'Paste invoice',
      scanQR: 'Scan QR Code',
      generateInvoice: 'Generate Invoice',
      sendPayment: 'Send Payment',
      paymentSent: 'Payment sent!',
      paymentReceived: 'Payment received!',
      paymentFailed: 'Payment failed',
      insufficientBalance: 'Insufficient balance',
      invalidInvoice: 'Invalid invoice',
      tip: 'Tip',
      tipSent: 'Tip sent successfully!',
    },

    send: {
      onchainTitle: 'Send to Bitcoin Address',
      onchainDetected: 'On-chain',
      confirmationSpeed: 'Confirmation Speed',
      speedFast: 'Fast',
      speedMedium: 'Medium',
      speedSlow: 'Slow',
      estimatedTime: '~%s min',
      networkFee: 'Network Fee',
      lightningTab: '⚡ Lightning',
      onchainTab: '₿ On-chain',
      lightningDestinationLabel: 'Lightning Invoice or Address:',
      onchainAddressLabel: 'Bitcoin Address:',
      lightningInputPlaceholder: 'Invoice or Lightning address...',
      onchainInputPlaceholder: 'bc1... or 1... or 3...',
      enterDestination: 'Please enter a destination',
      invalidPaymentRequest: 'Please enter a valid Lightning invoice, LNURL, Lightning address, or Bitcoin address',
      invalidOnchainAddress: 'Please enter a valid Bitcoin on-chain address',
      invalidLightningDestination: 'Please enter a Lightning invoice, LNURL, or Lightning address',
      amountRequiredOnchain: 'Please enter a valid amount in sats',
      amountRequiredOnchainLabel: 'Amount (required):',
      amountInSats: 'Amount in sats',
      onchainModeTitle: 'Bitcoin on-chain transaction',
      onchainModeDescription: 'You are sending a Bitcoin transaction on the base layer network.',
      previewOnchainCta: 'Preview On-chain Transaction',
      sendOnchainCta: 'Send On-chain Transaction',
      scanLightningQr: 'Point your camera at a Lightning QR code',
      scanOnchainQr: 'Point your camera at a Bitcoin on-chain QR code',
      scanQrCode: 'Scan QR Code',
      paymentPreview: 'Payment Preview',
      recipient: 'Recipient:',
      total: 'Total:',
      previewPayment: 'Preview Payment',
      availableBalance: 'Available Balance:',
      amountLabel: 'Amount (leave empty for invoice amount):',
      amountInCurrency: 'Amount in {{currency}}',
      commentLabel: 'Comment (optional):',
      paymentDescriptionPlaceholder: 'Payment description',
      permissionRequired: 'Permission Required',
      cameraPermissionRequired: 'Camera permission is required to scan QR codes',
      insufficientBalance: 'Insufficient Balance',
      insufficientBalanceMessage: 'You have {{balance}} sats but trying to send {{amount}} sats',
      insufficientBalanceWithFee: 'Total ({{total}} sats including {{fee}} sats fee) exceeds your balance of {{balance}} sats',
      paymentError: 'Payment Error',
      paymentFailed: 'Payment Failed',
      conversionError: 'Conversion Error',
      conversionErrorMessage: 'Could not convert amount. Please check exchange rates.',
      invalidAmount: 'Please enter a valid amount',
      invalidBitcoinAddress: 'Invalid Bitcoin Address',
      lightningOnly: 'Lightning Only',
      manage: 'Manage',
    },

    deposit: {
      lightningTab: '⚡ Lightning',
      onchainTab: '₿ On-chain',
      lightningSectionTitle: '⚡ Lightning Invoice',
      lightningSectionSubtitle: 'Instant payments via Lightning Network',
      lightningAddressSectionTitle: 'Lightning Address',
      invoiceSectionTitle: 'Invoice',
      registerAddressInSettings: 'Register a Lightning Address in Settings',
      noAddressYet: 'No Lightning Address set up yet',
      onchainSectionTitle: '₿ Bitcoin Address',
      onchainSectionSubtitle: 'Standard on-chain Bitcoin transfer',
      enterAmount: 'Enter amount (leave empty for any amount):',
      yourLightningAddress: '📧 Your Lightning Address',
      claimLightningAddress: '📧 Claim a Lightning Address for easy payments →',
      generateAnyAmountInvoice: 'Generate Any Amount Invoice',
      anyAmount: 'Any Amount',
      expiresIn: 'Expires in',
      newInvoice: 'New Invoice',
      conversionError: 'Could not convert amount. Please check exchange rates.',
      generateInvoiceFailed: 'Failed to generate invoice',
      copyFailed: 'Failed to copy',
      onchainTitle: 'Receive Bitcoin on-chain',
      onchainDescription: 'Use this Bitcoin address to receive funds on-chain.',
      bitcoinAddress: 'Bitcoin address',
      generatingAddress: 'Generating address...',
      copyAddress: 'Copy',
      minimumDeposit: 'Minimum receive amount: {{amount}} sats',
      onchainNote: 'Funds available after network confirmations.',
      invoiceCopied: 'Invoice copied',
      lightningAddressCopied: 'Lightning Address copied',
      bitcoinAddressCopied: 'Bitcoin Address copied',
    },

    // Settings
    settings: {
      title: 'Settings',
      language: 'Language',
      english: 'English',
      bulgarian: 'Bulgarian',
      currency: 'Currency',
      displayCurrency: 'Display Currency',
      security: 'Security',
      biometricAuth: 'Biometric Authentication',
      biometric: 'Biometric Authentication',
      autoLockTimeout: 'Auto-lock Timeout',
      changePin: 'Change PIN',
      notifications: 'Notifications',
      manageNotifications: 'Manage notification preferences',
      about: 'About',
      version: 'Version',
      privacyPolicy: 'Privacy Policy',
      termsOfService: 'Terms of Service',
      logout: 'Log out',
      // Settings sections
      walletConfiguration: 'Wallet Configuration',
      walletType: 'Wallet Type',
      builtInWallet: 'Built-in Wallet (Breez SDK)',
      customLnurl: 'Custom LNURL',
      defaultTipAmounts: 'Default Tip Amounts',
      languageRegion: 'Language & Region',
      backupRecovery: 'Backup & Recovery',
      appSettings: 'App Settings',
      theme: 'Theme',
      darkModeSettings: 'Dark mode and display settings',
      // Security screen
      lockWalletAfterInactivity: 'Lock wallet after period of inactivity',
      fiveMinutes: '5 minutes',
      fifteenMinutes: '15 minutes',
      thirtyMinutes: '30 minutes',
      oneHour: '1 hour',
      twoHours: '2 hours',
      never: 'Never',
      disableAutoLockWarning: 'Disabling auto-lock is not recommended. Your wallet will remain unlocked until you manually lock it.',
      biometricAuthentication: '{{type}} Authentication',
      useBiometricToUnlock: 'Use {{type}} to unlock wallet',
      notAvailableOnDevice: 'Not available on this device',
      verifyToEnableBiometric: 'Verify to enable biometric authentication',
      usePin: 'Use PIN',
      failed: 'Failed',
      biometricVerificationFailed: 'Biometric verification failed',
      failedToVerifyBiometric: 'Failed to verify biometric',
      saved: 'Saved',
      securitySettingsUpdated: 'Security settings updated',
      failedToSaveSettings: 'Failed to save settings',
      securityTips: 'Security Tips',
      securityTip1: 'Use a strong PIN that\'s not easy to guess',
      securityTip2: 'Enable biometric authentication for convenience',
      securityTip4: 'Never share your recovery phrase with anyone',
      fingerprintUnlock: 'Fingerprint Unlock',
      faceIdUnlock: 'Face ID Unlock',
      biometricUnlock: 'Biometric Unlock',
      biometricNotEnrolled: 'No biometric authentication is set up on this device. Go to your device settings to enroll.',
      saveChanges: 'Save Changes',
      // Language screen
      selectLanguage: 'Select Language',
      automaticLocationBased: 'Automatic (Location-based)',
      languageDetectionDescription: 'Detect language based on your location. Bulgarian in Bulgaria, English elsewhere.',
      aboutLanguageDetection: 'About Language Detection',
      languageDetectionInfo: 'When automatic mode is enabled, the app will use your device location to determine the appropriate language. If you\'re located within Bulgaria, Bulgarian will be used. Otherwise, English will be the default.',
      currentLanguage: 'Current language: {{language}}',
      // Currency settings screen
      bitcoinDenomination: 'Bitcoin Denomination',
      chooseBitcoinDisplay: 'Choose how Bitcoin amounts are displayed',
      satoshis: 'Satoshis',
      smallestBitcoinUnit: 'Smallest Bitcoin unit (1 BTC = 100,000,000 sats)',
      bitcoin: 'Bitcoin',
      fullBitcoinDenomination: 'Full Bitcoin denomination',
      fiatConversion: 'Fiat Conversion',
      chooseFiatSecondary: 'Choose which fiat currency to show as secondary',
      usDollar: 'US Dollar',
      unitedStatesDollar: 'United States Dollar',
      euro: 'Euro',
      europeanUnionCurrency: 'European Union currency',
      preview: 'Preview',
      balanceDisplayPreview: 'Your balance will display as:',
      approximate: 'about',
      aboutDisplayCurrency: 'About Display Currency',
      displayCurrencyInfoPrimary: 'The primary denomination controls how Bitcoin amounts are shown throughout the app. The fiat conversion shows an approximate value below the main amount.',
      displayCurrencyInfoSecondary: 'All Lightning payments are always processed in satoshis regardless of your display preference. Fiat conversions are approximate and based on current exchange rates.',
      // Amount settings screen
      postingAmounts: 'Posting Amounts',
      tipRequestAmounts: 'Tip Request Amounts',
      tippingAmounts: 'Tipping Amounts',
      defaultAmountsWhenTipping: 'Default amounts shown when tipping others',
      defaultAmountsWhenCreatingRequests: 'Default amounts shown when creating tip requests',
      small: 'Small',
      medium: 'Medium',
      large: 'Large',
      quickSelect: 'Quick Select',
      aboutAmounts: 'About Amounts',
      amountsRules: '• All amounts must be unique\n• Maximum amount is 100,000,000 sats (1 BTC)\n• Minimum amount is 1 sat',
      defaultAmountsUpdated: 'Default amounts updated',
      enterPositiveNumber: 'Please enter a valid positive number',
      maximumAmountIs: 'Maximum amount is {{amount}} sats (1 BTC)',
      amountsMustBeUnique: 'All three amounts must be unique',
      postingAmountsError: 'Posting amounts: {{error}}',
      tippingAmountsError: 'Tipping amounts: {{error}}',
      lightningAddress: 'Lightning Address',
      receivePaymentsSimpleAddress: 'Receive payments with a simple address',
      manageSavedLightningAddresses: 'Manage saved Lightning Addresses',
      // Theme screen
      darkMode: 'Dark Mode',
      useDarkTheme: 'Use dark theme throughout the app',
      // Notifications screen
      pushNotifications: 'Push Notifications',
      pushNotificationsDescription: 'Receive notifications about transactions and updates',
      notificationsDisabled: 'Notifications are disabled',
      enableNotificationsDescription: 'Enable push notifications to receive alerts about incoming payments and important updates.',
      enableNotifications: 'Enable Notifications',
      permissionDenied: 'Permission Denied',
      enableNotificationsInSettings: 'To enable notifications, please go to your device settings and allow notifications for this app.',
      openSettings: 'Open Settings',
      failedToRequestPermissions: 'Failed to request notification permissions. Please try again.',
      permissionRequired: 'Permission Required',
      enableNotificationsFirst: 'Please enable notifications first to send a test notification.',
      generalSettings: 'General',
      transactionAlerts: 'Transaction Alerts',
      paymentReceived: 'Payment Received',
      paymentReceivedDescription: 'Get notified when you receive a payment',
      paymentSent: 'Payment Sent',
      paymentSentDescription: 'Get notified when a payment is sent',
      testing: 'Testing',
      sendTestNotification: 'Send Test Notification',
      sendTestNotificationDescription: 'Verify notifications are working correctly',
      testNotification: 'Test Notification 🔔',
      testNotificationBody: 'Notifications are working! You will receive alerts for transactions.',
      failedToSendTestNotification: 'Failed to send test notification. Please try again.',
    },

    // Onboarding
    onboarding: {
      welcome: 'Welcome to Zap Arc',
      subtitle: 'Your Lightning Network wallet',
      setupWallet: 'Set Up Your Wallet',
      chooseSetup: 'Choose how you want to set up your wallet',
      getStarted: 'Get Started',
      createNew: 'Create New Wallet',
      importExisting: 'Import Existing Wallet',
      addSubWallet: 'Add Sub-Wallet',
      currentWallet: 'Current wallet: {{name}}',
      nameSubWallet: 'Name Your Sub-Wallet',
      createSubWalletUnder: 'Create a new sub-wallet under "{{name}}"',
      subWalletName: 'Sub-Wallet name',
      subWalletCreated: 'Sub-wallet created successfully',
      subWalletFailed: 'Failed to add sub-wallet',
      termsAgreement: 'By continuing, you agree to our Terms of Service',
      locationPermission: 'Location access helps us provide a better experience',
      allowLocation: 'Allow Location',
      skipLocation: 'Skip for now',
      create: 'Create',
    },

    // Address Book
    addressBook: {
      title: 'Address Book',
      addContact: 'Add Contact',
      editContact: 'Edit Contact',
      deleteContact: 'Delete Contact',
      noContacts: 'No contacts yet',
      noContactsDescription: 'Add your first contact to quickly send payments',
      tryDifferentSearchTerm: 'Try a different search term',
      searchContacts: 'Search contacts...',
      selectContact: 'Select Contact',
      noContactsFound: 'No contacts found',
      name: 'Name',
      lightningAddress: 'Lightning Address',
      notes: 'Notes',
      notesOptional: 'Notes (optional)',
      save: 'Save',
      verifying: 'Verifying...',
      deleteConfirm: 'Are you sure you want to delete this contact?',
      deleteConfirmMessage: 'This action cannot be undone.',
      contactSaved: 'Contact saved!',
      contactDeleted: 'Contact deleted',
      invalidAddress: 'Invalid Lightning Address',
      addressNotFound: 'Lightning Address not found',
      domainNotFound: 'Domain not found - check the address',
      verificationFailed: 'Address verification failed',
      self: 'Me',
      sendingTo: 'Sending to:',
    },

    // Lightning Address
    lightningAddressScreen: {
      title: 'Lightning Address',
      yourAddress: 'Your Lightning Address',
      claimAddress: 'Claim Your Lightning Address',
      username: 'Username',
      descriptionOptional: 'Description (optional)',
      checkAvailability: 'Check Availability',
      registerAddress: 'Register Address',
      unregisterAddress: 'Unregister Address',
      copyAddress: 'Copy Address',
      usernameAvailable: '✓ Username is available!',
      usernameTaken: '✗ Username is taken',
      aboutLightningAddress: 'About Lightning Address',
      aboutLightningAddressDesc: 'Share this address with anyone to receive Lightning payments. They can send sats to you using any wallet that supports Lightning Addresses.',
      whatIsLightningAddress: 'What is a Lightning Address?',
      whatIsLightningAddressDesc: 'A Lightning Address is like an email address for Bitcoin payments. Instead of generating invoices, people can send sats directly to your address.',
      example: 'Example: yourname@breez.tips',
      usernameRequirements: 'Username Requirements',
      requirement1: '3-32 characters long',
      requirement2: 'Letters, numbers, hyphens, underscores only',
      requirement3: 'Must start and end with a letter or number',
      unregisterConfirm: 'Are you sure you want to unregister {{address}}? You may not be able to reclaim this username.',
      addressRegistered: 'Your Lightning Address is now: {{address}}',
      addressUnregistered: 'Lightning Address unregistered',
    },

    // Cloud Backup
    cloudBackup: {
      title: 'Cloud Backup',
      description: 'Encrypted backup to Google Drive',
      encryptedBackup: 'Encrypted Backup',
      securityInfo: 'Your seed phrase is encrypted with AES-256-GCM before being uploaded. Only you can decrypt it with your password.',
      googleAccount: 'Google Account',
      connected: 'Connected',
      connectGoogle: 'Connect Google Account',
      disconnect: 'Disconnect',
      disconnectTitle: 'Disconnect Google Account',
      disconnectMessage: 'This will not delete your existing backups. You can reconnect anytime.',
      backupActions: 'Backup Actions',
      lastBackup: 'Last backup',
      createBackup: 'Create Backup',
      existingBackups: 'Existing Backups',
      noBackups: 'No backups yet',
      deleteBackup: 'Delete Backup',
      deleteConfirmation: 'Are you sure you want to delete this backup? This action cannot be undone.',
      restore: 'Restore',
      authenticateToBackup: 'Authenticate to access backup',
      enterBackupPassword: 'Enter Backup Password',
      enterRestorePassword: 'Enter Restore Password',
      passwordWarning: 'This password encrypts your seed phrase. If you forget it, you cannot recover your backup. Write it down!',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      passwordTooWeak: 'Password does not meet security requirements',
      passwordMismatch: 'Passwords do not match',
      backupCreated: 'Backup created successfully!',
      restoredPhrase: 'Restored Recovery Phrase',
      useToImport: 'Use this phrase to import your wallet on any device',
      securityTips: 'Security Tips',
      tip1: 'Use a unique, strong password for your backup',
      tip2: 'Write down your backup password and store it safely',
      tip3: 'Never share your backup password with anyone',
      strength: {
        veryWeak: 'Very Weak',
        weak: 'Weak',
        fair: 'Fair',
        strong: 'Strong',
        veryStrong: 'Very Strong',
      },
    },

    // Errors
    errors: {
      networkError: 'Network error. Please check your connection.',
      unknownError: 'An unknown error occurred. Please try again.',
      sessionExpired: 'Your session has expired. Please unlock again.',
      walletNotFound: 'Wallet not found.',
    },
  },

  bg: {
    // Common - Bulgarian
    common: {
      loading: 'Зареждане...',
      error: 'Грешка',
      success: 'Успех',
      cancel: 'Отказ',
      confirm: 'Потвърди',
      save: 'Запази',
      delete: 'Изтрий',
      edit: 'Редактирай',
      done: 'Готово',
      next: 'Напред',
      back: 'Назад',
      skip: 'Пропусни',
      retry: 'Опитай отново',
      close: 'Затвори',
      yes: 'Да',
      no: 'Не',
      ok: 'OK',
      copied: 'Копирано!',
      share: 'Сподели',
      seeAll: 'Виж всички',
      tapToReveal: 'Докосни за показване',
      all: 'Всички',
      enabled: 'Включено',
      disabled: 'Изключено',
      auto: 'Автоматично',
      now: 'сега',
      to: 'към',
      minutes: 'минути',
      seconds: 'секунди',
    },

    // Auth - Bulgarian
    auth: {
      enterPin: 'Въведете ПИН',
      createPin: 'Създайте ПИН',
      confirmPin: 'Потвърдете ПИН',
      incorrectPin: 'Грешен ПИН',
      wrongPin: 'Грешен ПИН. Опитайте отново.',
      pinMismatch: 'ПИН кодовете не съвпадат. Опитайте отново.',
      unlockWallet: 'Отключи портфейла',
      unlockFailed: 'Неуспешно отключване',
      useBiometric: 'Използвай биометрия',
      useFaceId: 'Използвай Face ID',
      useFingerprint: 'Използвай пръстов отпечатък',
      useIrisScan: 'Използвай ирис скенер',
      enterPinToSwitch: 'Моля, въведете ПИН за смяна на портфейл',
      pinLengthRequirement: 'ПИН кодът трябва да е точно 6 цифри',
      attemptsRemaining: '{{count}} оставащи опита',
      forgotPin: 'Забравен ПИН?',
      switchWallet: 'Смени портфейл',
      unlocking: 'Отключване…',
    },

    // Wallet - Bulgarian
    wallet: {
      balance: 'Баланс',
      sats: 'сатс',
      send: 'Изпрати',
      receive: 'Получи',
      transactions: 'Транзакции',
      transactionHistory: 'История на транзакциите',
      noTransactions: 'Все още няма транзакции',
      noTransactionsFound: 'Няма {{filter}} транзакции',
      historyWillAppear: 'Историята на транзакциите ще се появи тук',
      getStarted: 'Изпратете или получете биткойн, за да започнете',
      transactionDetails: 'Детайли на транзакцията',
      type: 'Тип',
      method: 'Метод',
      received: 'Получена',
      sent: 'Изпратена',
      receivedPlural: 'Получени',
      sentPlural: 'Изпратени',
      receivedPayment: 'Получено плащане',
      sentPayment: 'Изпратено плащане',
      date: 'Дата',
      time: 'Час',
      fee: 'Такса',
      paymentHash: 'Хеш на плащането',
      statusCompleted: 'Завършена',
      statusPending: 'Изчакваща',
      statusFailed: 'Неуспешна',
      walletFallback: 'Портфейл',
      mainWalletFallback: 'Основен портфейл',
      methodOnchain: 'On-chain',
      methodLightning: 'Lightning',
      viewOnMempool: 'Виж в mempool.space',
      createWallet: 'Създай портфейл',
      importWallet: 'Импортирай портфейл',
      enterMnemonic: 'Въведете вашата 12-думова фраза за възстановяване',
      walletCreated: 'Портфейлът е създаден успешно!',
      walletImported: 'Портфейлът е импортиран успешно!',
      invalidMnemonic: 'Невалидна фраза за възстановяване. Проверете и опитайте отново.',
      masterKey: 'Главен ключ',
      subWallet: 'Под-портфейл',
      addSubWallet: 'Добави под-портфейл',
      switchWallet: 'Смени портфейл',
      manageWallets: 'Управление на портфейли',
      archivedWallets: 'Архивирани портфейли',
      viewArchivedWallets: 'Преглед и възстановяване на скрити под-портфейли',
      noArchivedWallets: 'Няма архивирани портфейли',
      archivedWalletsEmptyDescription: 'Подпортфейлите, които архивирате от страницата за управление, ще се появят тук',
      archivedWalletsInfo: 'Тези портфейли в момента са скрити от основния ви екран. Можете да ги възстановите по всяко време.',
      from: 'От',
      index: 'Индекс',
      subWalletRestoredSuccessfully: 'Подпортфейлът е възстановен успешно',
      failedToRestoreSubWallet: 'Неуспешно възстановяване на подпортфейла',
      archiveWallet: 'Архивирай портфейл',
      restoreWallet: 'Възстанови портфейл',
      deleteWallet: 'Изтрий портфейл',
      deleteConfirm: 'Сигурни ли сте, че искате да изтриете този портфейл?',
      backupReminder: 'Моля, запазете вашата фраза за възстановяване!',
      copyMnemonic: 'Копирай фраза за възстановяване',
      showMnemonic: 'Покажи фраза за възстановяване',
      viewRecoveryPhrase: 'Преглед на фразата за възстановяване',
      backupSeedPhrase: 'Запазете seed фразата на портфейла',
    },

    // Payments - Bulgarian
    payments: {
      amount: 'Сума',
      amountSats: 'Сума (сатс)',
      enterAmount: 'Въведете сума',
      description: 'Описание (незадължително)',
      invoice: 'Lightning фактура',
      pasteInvoice: 'Постави фактура',
      scanQR: 'Сканирай QR код',
      generateInvoice: 'Генерирай фактура',
      sendPayment: 'Изпрати плащане',
      paymentSent: 'Плащането е изпратено!',
      paymentReceived: 'Плащането е получено!',
      paymentFailed: 'Плащането е неуспешно',
      insufficientBalance: 'Недостатъчен баланс',
      invalidInvoice: 'Невалидна фактура',
      tip: 'Бакшиш',
      tipSent: 'Бакшишът е изпратен успешно!',
    },

    send: {
      onchainTitle: 'Изпращане към Bitcoin адрес',
      onchainDetected: 'On-chain',
      confirmationSpeed: 'Скорост на потвърждение',
      speedFast: 'Бързо',
      speedMedium: 'Средно',
      speedSlow: 'Бавно',
      estimatedTime: '~%s мин',
      networkFee: 'Мрежова такса',
      lightningTab: '⚡ Lightning',
      onchainTab: '₿ On-chain',
      lightningDestinationLabel: 'Lightning фактура или адрес:',
      onchainAddressLabel: 'Bitcoin адрес:',
      lightningInputPlaceholder: 'Фактура или Lightning адрес...',
      onchainInputPlaceholder: 'bc1... или 1... или 3...',
      enterDestination: 'Моля, въведете получател',
      invalidPaymentRequest: 'Моля, въведете валидна Lightning фактура, LNURL, Lightning адрес или Bitcoin адрес',
      invalidOnchainAddress: 'Моля, въведете валиден Bitcoin on-chain адрес',
      invalidLightningDestination: 'Моля, въведете Lightning фактура, LNURL или Lightning адрес',
      amountRequiredOnchain: 'Моля, въведете валидна сума в сатс',
      amountRequiredOnchainLabel: 'Сума (задължително):',
      amountInSats: 'Сума в сатс',
      onchainModeTitle: 'Bitcoin on-chain транзакция',
      onchainModeDescription: 'Изпращате Bitcoin транзакция по основния блокчейн слой.',
      previewOnchainCta: 'Преглед на on-chain транзакция',
      sendOnchainCta: 'Изпрати on-chain транзакция',
      scanLightningQr: 'Насочете камерата към Lightning QR код',
      scanOnchainQr: 'Насочете камерата към Bitcoin on-chain QR код',
      scanQrCode: 'Сканирай QR код',
      paymentPreview: 'Преглед на плащане',
      recipient: 'Получател:',
      total: 'Общо:',
      previewPayment: 'Преглед на плащане',
      availableBalance: 'Наличен баланс:',
      amountLabel: 'Сума (оставете празно за сума от фактура):',
      amountInCurrency: 'Сума в {{currency}}',
      commentLabel: 'Коментар (незадължително):',
      paymentDescriptionPlaceholder: 'Описание на плащането',
      permissionRequired: 'Необходимо разрешение',
      cameraPermissionRequired: 'Необходимо е разрешение за камерата, за да сканирате QR кодове',
      insufficientBalance: 'Недостатъчен баланс',
      insufficientBalanceMessage: 'Имате {{balance}} сатс, но се опитвате да изпратите {{amount}} сатс',
      insufficientBalanceWithFee: 'Общо ({{total}} сатс включително {{fee}} сатс такса) превишава баланса ви от {{balance}} сатс',
      paymentError: 'Грешка при плащане',
      paymentFailed: 'Неуспешно плащане',
      conversionError: 'Грешка при конвертиране',
      conversionErrorMessage: 'Неуспешно конвертиране на сумата. Проверете обменните курсове.',
      invalidAmount: 'Моля, въведете валидна сума',
      invalidBitcoinAddress: 'Невалиден Bitcoin адрес',
      lightningOnly: 'Само Lightning',
      manage: 'Управление',
    },

    deposit: {
      lightningTab: '⚡ Lightning',
      onchainTab: '₿ On-chain',
      lightningSectionTitle: '⚡ Lightning фактура',
      lightningSectionSubtitle: 'Мигновени плащания чрез Lightning Network',
      lightningAddressSectionTitle: 'Lightning адрес',
      invoiceSectionTitle: 'Фактура',
      registerAddressInSettings: 'Регистрирайте Lightning адрес в Настройки',
      noAddressYet: 'Все още нямате Lightning адрес',
      onchainSectionTitle: '₿ Bitcoin адрес',
      onchainSectionSubtitle: 'Стандартен on-chain Bitcoin трансфер',
      enterAmount: 'Въведете сума (оставете празно за произволна сума):',
      yourLightningAddress: '📧 Вашият Lightning адрес',
      claimLightningAddress: '📧 Заявете Lightning адрес за лесни плащания →',
      generateAnyAmountInvoice: 'Генерирай фактура за произволна сума',
      anyAmount: 'Произволна сума',
      expiresIn: 'Изтича след',
      newInvoice: 'Нова фактура',
      conversionError: 'Неуспешно конвертиране на сумата. Проверете обменните курсове.',
      generateInvoiceFailed: 'Неуспешно генериране на фактура',
      copyFailed: 'Неуспешно копиране',
      onchainTitle: 'Получаване на Bitcoin on-chain',
      onchainDescription: 'Използвайте този Bitcoin адрес, за да получавате on-chain плащания.',
      bitcoinAddress: 'Bitcoin адрес',
      generatingAddress: 'Генериране на адрес...',
      copyAddress: 'Копирай',
      minimumDeposit: 'Минимална сума за получаване: {{amount}} сатс',
      onchainNote: 'Средствата са налични след мрежови потвърждения.',
      invoiceCopied: 'Фактурата е копирана',
      lightningAddressCopied: 'Lightning адресът е копиран',
      bitcoinAddressCopied: 'Bitcoin адресът е копиран',
    },

    // Settings - Bulgarian
    settings: {
      title: 'Настройки',
      language: 'Език',
      english: 'Английски',
      bulgarian: 'Български',
      currency: 'Валута',
      displayCurrency: 'Показвана валута',
      security: 'Сигурност',
      biometricAuth: 'Биометрична автентикация',
      biometric: 'Биометрична автентикация',
      autoLockTimeout: 'Време за автоматично заключване',
      changePin: 'Смяна на ПИН',
      notifications: 'Известия',
      manageNotifications: 'Управление на известията',
      about: 'За приложението',
      version: 'Версия',
      privacyPolicy: 'Политика за поверителност',
      termsOfService: 'Условия за ползване',
      logout: 'Изход',
      // Settings sections
      walletConfiguration: 'Конфигурация на портфейла',
      walletType: 'Тип портфейл',
      builtInWallet: 'Вграден портфейл (Breez SDK)',
      customLnurl: 'Персонализиран LNURL',
      defaultTipAmounts: 'Стандартни суми за бакшиш',
      languageRegion: 'Език и регион',
      backupRecovery: 'Резервно копие и възстановяване',
      appSettings: 'Настройки на приложението',
      theme: 'Тема',
      darkModeSettings: 'Тъмен режим и настройки на дисплея',
      // Security screen
      lockWalletAfterInactivity: 'Заключване на портфейла след период на неактивност',
      fiveMinutes: '5 минути',
      fifteenMinutes: '15 минути',
      thirtyMinutes: '30 минути',
      oneHour: '1 час',
      twoHours: '2 часа',
      never: 'Никога',
      disableAutoLockWarning: 'Изключването на автоматичното заключване не се препоръчва. Портфейлът ви ще остане отключен, докато не го заключите ръчно.',
      biometricAuthentication: '{{type}} автентикация',
      useBiometricToUnlock: 'Използвайте {{type}} за отключване на портфейла',
      notAvailableOnDevice: 'Не е налично на това устройство',
      verifyToEnableBiometric: 'Потвърдете за включване на биометрична автентикация',
      usePin: 'Използвай ПИН',
      failed: 'Неуспешно',
      biometricVerificationFailed: 'Биометричната проверка е неуспешна',
      failedToVerifyBiometric: 'Неуспешна проверка на биометрия',
      saved: 'Запазено',
      securitySettingsUpdated: 'Настройките за сигурност са обновени',
      failedToSaveSettings: 'Неуспешно запазване на настройките',
      securityTips: 'Съвети за сигурност',
      securityTip1: 'Използвайте силен ПИН, който не е лесен за отгатване',
      securityTip2: 'Включете биометрична автентикация за удобство',
      securityTip4: 'Никога не споделяйте фразата си за възстановяване',
      fingerprintUnlock: 'Отключване с пръстов отпечатък',
      faceIdUnlock: 'Отключване с Face ID',
      biometricUnlock: 'Биометрично отключване',
      biometricNotEnrolled: 'На това устройство няма настроена биометрична автентикация. Отидете в настройките на устройството, за да я настроите.',
      saveChanges: 'Запази промените',
      // Language screen
      selectLanguage: 'Избор на език',
      automaticLocationBased: 'Автоматично (базирано на местоположение)',
      languageDetectionDescription: 'Определяне на езика според вашето местоположение. Български в България, английски другаде.',
      aboutLanguageDetection: 'Относно определянето на езика',
      languageDetectionInfo: 'Когато автоматичният режим е включен, приложението ще използва местоположението на устройството ви, за да определи подходящия език. Ако се намирате в България, ще се използва български. В противен случай по подразбиране ще е английски.',
      currentLanguage: 'Текущ език: {{language}}',
      // Currency settings screen
      bitcoinDenomination: 'Биткойн деноминация',
      chooseBitcoinDisplay: 'Изберете как да се показват сумите в Биткойн',
      satoshis: 'Сатошита',
      smallestBitcoinUnit: 'Най-малката единица на Биткойн (1 BTC = 100,000,000 sats)',
      bitcoin: 'Биткойн',
      fullBitcoinDenomination: 'Пълно деноминиране на Биткойн',
      fiatConversion: 'Фиат конвертиране',
      chooseFiatSecondary: 'Изберете коя фиатна валута да се показва като вторична',
      usDollar: 'Щатски долар',
      unitedStatesDollar: 'Щатски долар',
      euro: 'Евро',
      europeanUnionCurrency: 'Валута на Европейския съюз',
      preview: 'Преглед',
      balanceDisplayPreview: 'Балансът ви ще се показва като:',
      approximate: 'около',
      aboutDisplayCurrency: 'Относно показваната валута',
      displayCurrencyInfoPrimary: 'Основната деноминация определя как се показват сумите в Биткойн в приложението. Фиатната конверсия показва приблизителна стойност под основната сума.',
      displayCurrencyInfoSecondary: 'Всички Lightning плащания винаги се обработват в сатошита, независимо от предпочитанието ви за показване. Фиатните конверсии са приблизителни и се базират на текущи обменни курсове.',
      // Amount settings screen
      postingAmounts: 'Суми за постове',
      tipRequestAmounts: 'Суми за заявки за бакшиш',
      tippingAmounts: 'Суми за бакшиш',
      defaultAmountsWhenTipping: 'Стандартни суми, показвани при даване на бакшиш',
      defaultAmountsWhenCreatingRequests: 'Стандартни суми, показвани при създаване на заявки за бакшиш',
      small: 'Малка',
      medium: 'Средна',
      large: 'Голяма',
      quickSelect: 'Бърз избор',
      aboutAmounts: 'Относно сумите',
      amountsRules: '• Всички суми трябва да са уникални\n• Максималната сума е 100,000,000 sats (1 BTC)\n• Минималната сума е 1 sat',
      defaultAmountsUpdated: 'Стандартните суми са обновени',
      enterPositiveNumber: 'Моля, въведете валидно положително число',
      maximumAmountIs: 'Максималната сума е {{amount}} sats (1 BTC)',
      amountsMustBeUnique: 'И трите суми трябва да са уникални',
      postingAmountsError: 'Суми за постове: {{error}}',
      tippingAmountsError: 'Суми за бакшиш: {{error}}',
      lightningAddress: 'Lightning адрес',
      receivePaymentsSimpleAddress: 'Получавайте плащания с лесен адрес',
      manageSavedLightningAddresses: 'Управлявайте запазените Lightning адреси',
      // Theme screen
      darkMode: 'Тъмен режим',
      useDarkTheme: 'Използвай тъмна тема в цялото приложение',
      // Notifications screen
      pushNotifications: 'Push известия',
      pushNotificationsDescription: 'Получавайте известия за транзакции и актуализации',
      notificationsDisabled: 'Известията са изключени',
      enableNotificationsDescription: 'Включете push известията за получаване на сигнали за входящи плащания и важни актуализации.',
      enableNotifications: 'Включи известията',
      permissionDenied: 'Отказано разрешение',
      enableNotificationsInSettings: 'За да включите известията, моля отидете в настройките на устройството и разрешете известия за това приложение.',
      openSettings: 'Отвори настройки',
      failedToRequestPermissions: 'Неуспешна заявка за разрешения за известия. Моля, опитайте отново.',
      permissionRequired: 'Необходимо разрешение',
      enableNotificationsFirst: 'Моля, първо включете известията, за да изпратите тестово известие.',
      generalSettings: 'Общи',
      transactionAlerts: 'Сигнали за транзакции',
      paymentReceived: 'Получено плащане',
      paymentReceivedDescription: 'Получавайте известие при получаване на плащане',
      paymentSent: 'Изпратено плащане',
      paymentSentDescription: 'Получавайте известие при изпращане на плащане',
      testing: 'Тестване',
      sendTestNotification: 'Изпрати тестово известие',
      sendTestNotificationDescription: 'Проверете дали известията работят правилно',
      testNotification: 'Тестово известие 🔔',
      testNotificationBody: 'Известията работят! Ще получавате сигнали за транзакции.',
      failedToSendTestNotification: 'Неуспешно изпращане на тестово известие. Моля, опитайте отново.',
    },

    // Onboarding - Bulgarian
    onboarding: {
      welcome: 'Добре дошли в Zap Arc',
      subtitle: 'Вашият Lightning Network портфейл',
      setupWallet: 'Настройте портфейла си',
      chooseSetup: 'Изберете как искате да настроите портфейла си',
      getStarted: 'Започнете',
      createNew: 'Създай нов портфейл',
      importExisting: 'Импортирай съществуващ портфейл',
      addSubWallet: 'Добави под-портфейл',
      currentWallet: 'Текущ портфейл: {{name}}',
      nameSubWallet: 'Наименувайте под-портфейла',
      createSubWalletUnder: 'Създайте нов под-портфейл под "{{name}}"',
      subWalletName: 'Име на под-портфейл',
      subWalletCreated: 'Под-портфейлът е създаден успешно',
      subWalletFailed: 'Неуспешно добавяне на под-портфейл',
      termsAgreement: 'Продължавайки, вие се съгласявате с нашите Условия за ползване',
      locationPermission: 'Достъпът до местоположение ни помага да предоставим по-добро изживяване',
      allowLocation: 'Разреши местоположение',
      skipLocation: 'Пропусни засега',
      create: 'Създай',
    },

    // Address Book - Bulgarian
    addressBook: {
      title: 'Адресна книга',
      addContact: 'Добави контакт',
      editContact: 'Редактирай контакт',
      deleteContact: 'Изтрий контакт',
      noContacts: 'Все още няма контакти',
      noContactsDescription: 'Добавете първия си контакт за бързи плащания',
      tryDifferentSearchTerm: 'Опитайте с различен термин за търсене',
      searchContacts: 'Търси контакти...',
      selectContact: 'Избери контакт',
      noContactsFound: 'Няма намерени контакти',
      name: 'Име',
      lightningAddress: 'Lightning адрес',
      notes: 'Бележки',
      notesOptional: 'Бележки (незадължително)',
      save: 'Запази',
      verifying: 'Проверява се...',
      deleteConfirm: 'Сигурни ли сте, че искате да изтриете този контакт?',
      deleteConfirmMessage: 'Това действие не може да бъде отменено.',
      contactSaved: 'Контактът е запазен!',
      contactDeleted: 'Контактът е изтрит',
      invalidAddress: 'Невалиден Lightning адрес',
      addressNotFound: 'Lightning адресът не е намерен',
      domainNotFound: 'Домейнът не е намерен - проверете адреса',
      verificationFailed: 'Проверката на адреса е неуспешна',
      self: 'Аз',
      sendingTo: 'Изпращане до:',
    },

    // Lightning Address - Bulgarian
    lightningAddressScreen: {
      title: 'Lightning адрес',
      yourAddress: 'Вашият Lightning адрес',
      claimAddress: 'Заявете своя Lightning адрес',
      username: 'Потребителско име',
      descriptionOptional: 'Описание (незадължително)',
      checkAvailability: 'Провери наличност',
      registerAddress: 'Регистрирай адрес',
      unregisterAddress: 'Отмени регистрация',
      copyAddress: 'Копирай адреса',
      usernameAvailable: '✓ Потребителското име е свободно!',
      usernameTaken: '✗ Потребителското име е заето',
      aboutLightningAddress: 'За Lightning адреса',
      aboutLightningAddressDesc: 'Споделете този адрес с всеки за получаване на Lightning плащания. Те могат да изпращат сатове директно чрез всеки портфейл, който поддържа Lightning адреси.',
      whatIsLightningAddress: 'Какво е Lightning адрес?',
      whatIsLightningAddressDesc: 'Lightning адресът е като имейл адрес за биткойн плащания. Вместо да генерирате фактури, хората могат да изпращат сатове директно на вашия адрес.',
      example: 'Пример: вашетоиме@breez.tips',
      usernameRequirements: 'Изисквания за потребителското име',
      requirement1: '3-32 символа дължина',
      requirement2: 'Само букви, цифри, тирета и долни черти',
      requirement3: 'Трябва да започва и завършва с буква или цифра',
      unregisterConfirm: 'Сигурни ли сте, че искате да отмените регистрацията на {{address}}? Може да не успеете да си възвърнете това потребителско име.',
      addressRegistered: 'Вашият Lightning адрес вече е: {{address}}',
      addressUnregistered: 'Lightning адресът е отменен',
    },

    // Cloud Backup - Bulgarian
    cloudBackup: {
      title: 'Облачно копие',
      description: 'Криптирано копие в Google Drive',
      encryptedBackup: 'Криптирано копие',
      securityInfo: 'Вашата seed фраза е криптирана с AES-256-GCM преди качване. Само вие можете да я декриптирате с вашата парола.',
      googleAccount: 'Google акаунт',
      connected: 'Свързан',
      connectGoogle: 'Свържи Google акаунт',
      disconnect: 'Прекъсни връзката',
      disconnectTitle: 'Прекъсни Google акаунт',
      disconnectMessage: 'Това няма да изтрие съществуващите ви копия. Можете да се свържете отново по всяко време.',
      backupActions: 'Действия за копие',
      lastBackup: 'Последно копие',
      createBackup: 'Създай копие',
      existingBackups: 'Съществуващи копия',
      noBackups: 'Все още няма копия',
      deleteBackup: 'Изтрий копие',
      deleteConfirmation: 'Сигурни ли сте, че искате да изтриете това копие? Това действие не може да бъде отменено.',
      restore: 'Възстанови',
      authenticateToBackup: 'Удостоверете се за достъп до копието',
      enterBackupPassword: 'Въведете парола за копие',
      enterRestorePassword: 'Въведете парола за възстановяване',
      passwordWarning: 'Тази парола криптира вашата seed фраза. Ако я забравите, не можете да възстановите копието. Запишете я!',
      password: 'Парола',
      confirmPassword: 'Потвърдете паролата',
      passwordTooWeak: 'Паролата не отговаря на изискванията за сигурност',
      passwordMismatch: 'Паролите не съвпадат',
      backupCreated: 'Копието е създадено успешно!',
      restoredPhrase: 'Възстановена фраза за възстановяване',
      useToImport: 'Използвайте тази фраза за импортиране на портфейла си на всяко устройство',
      securityTips: 'Съвети за сигурност',
      tip1: 'Използвайте уникална, силна парола за копието си',
      tip2: 'Запишете паролата за копието и я съхранявайте на сигурно място',
      tip3: 'Никога не споделяйте паролата за копието с никого',
      strength: {
        veryWeak: 'Много слаба',
        weak: 'Слаба',
        fair: 'Средна',
        strong: 'Силна',
        veryStrong: 'Много силна',
      },
    },

    // Errors - Bulgarian
    errors: {
      networkError: 'Мрежова грешка. Проверете връзката си.',
      unknownError: 'Възникна неизвестна грешка. Опитайте отново.',
      sessionExpired: 'Сесията ви е изтекла. Отключете отново.',
      walletNotFound: 'Портфейлът не е намерен.',
    },
  },
};

// =============================================================================
// i18n Service
// =============================================================================

class I18nService {
  private currentLanguage: SupportedLanguage = 'en';
  private isInitialized = false;
  private isManualOverride = false;

  /**
   * Initialize the i18n service
   * Detects language based on location or saved preference
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🌐 [i18n] Initializing...');

      // Check for saved language preference
      const settings = await settingsService.getUserSettings();
      
      if (settings.language && settings.language !== 'auto') {
        // Manual override exists
        this.currentLanguage = settings.language as SupportedLanguage;
        this.isManualOverride = true;
        console.log('🌐 [i18n] Using saved language:', this.currentLanguage);
      } else {
        // Default to English — user can change in settings
        this.currentLanguage = 'en';
        console.log('🌐 [i18n] Using default English');
      }

      this.isInitialized = true;
      console.log('✅ [i18n] Initialized with language:', this.currentLanguage);
    } catch (error) {
      console.error('❌ [i18n] Initialization failed:', error);
      this.currentLanguage = 'en';
      this.isInitialized = true;
    }
  }

  /**
   * Get the current language
   */
  getLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  /**
   * Check if current language was set manually
   */
  isManuallySet(): boolean {
    return this.isManualOverride;
  }

  /**
   * Set language manually (persists to settings)
   */
  async setLanguage(language: SupportedLanguage): Promise<void> {
    this.currentLanguage = language;
    this.isManualOverride = true;

    // Persist to settings
    await settingsService.updateUserSettings({ language });
    
    console.log('🌐 [i18n] Language set to:', language);
  }

  /**
   * Reset to auto-detect mode
   */
  async resetToAuto(): Promise<void> {
    this.isManualOverride = false;
    await settingsService.updateUserSettings({ language: 'auto' });

    // Default to English
    this.currentLanguage = 'en';

    console.log('🌐 [i18n] Reset to auto, detected:', this.currentLanguage);
  }

  /**
   * Get a translated string by key path
   * Examples: 'common.loading', 'wallet.balance', 'auth.enterPin'
   */
  t(keyPath: string, params?: TranslationParams): string {
    const keys = keyPath.split('.');
    let value: TranslationValue = translations[this.currentLanguage];

    for (const key of keys) {
      if (typeof value === 'object' && value !== null && key in value) {
        value = value[key];
      } else {
        // Fall back to English if key not found
        value = translations.en;
        for (const fallbackKey of keys) {
          if (typeof value === 'object' && value !== null && fallbackKey in value) {
            value = value[fallbackKey];
          } else {
            console.warn(`🌐 [i18n] Translation not found: ${keyPath}`);
            return keyPath; // Return key path as fallback
          }
        }
        break;
      }
    }

    if (typeof value !== 'string') {
      console.warn(`🌐 [i18n] Translation is not a string: ${keyPath}`);
      return keyPath;
    }

    // Handle string interpolation
    if (params) {
      return this.interpolate(value, params);
    }

    return value;
  }

  /**
   * Interpolate parameters into a translation string
   * Example: 'Hello, {{name}}!' with { name: 'John' } -> 'Hello, John!'
   */
  private interpolate(template: string, params: TranslationParams): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return params[key]?.toString() ?? `{{${key}}}`;
    });
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): Array<{ code: SupportedLanguage; name: string; nativeName: string }> {
    return [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'bg', name: 'Bulgarian', nativeName: 'Български' },
    ];
  }
}

// Export singleton instance
export const i18n = new I18nService();

// Export class for testing
export { I18nService };

// Convenience function for translation
export const t = (keyPath: string, params?: TranslationParams): string => {
  return i18n.t(keyPath, params);
};
