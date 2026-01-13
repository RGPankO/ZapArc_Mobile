# Requirements Document

## Introduction

This document outlines the requirements for fixing missing Expo Router route files and navigation bugs in the Zap Arc Mobile Wallet. The WalletSettingsScreen navigates to several settings routes that either have screen components implemented but missing route files, or are completely unimplemented. Additionally, the PinEntryScreen has a broken "Switch Wallet" button that navigates to a non-existent route.

## Glossary

- **Route_File**: An Expo Router file in `app/wallet/settings/` that exports a screen component
- **Screen_Component**: A React component in `src/features/wallet/screens/settings/` that renders the UI
- **Settings_Hub**: The main WalletSettingsScreen that provides navigation to all settings sections
- **Wallet_Selection**: The screen that shows all wallets and allows switching between them

## Current State Analysis

### Settings Routes with Screen Components (Need Route Files Only)
| Route Path | Screen Component | Status |
|------------|------------------|--------|
| `/wallet/settings/wallet-config` | WalletConfigScreen.tsx | ✅ Screen exists, ❌ Route missing |
| `/wallet/settings/amounts` | AmountsSettingsScreen.tsx | ✅ Screen exists, ❌ Route missing |
| `/wallet/settings/security` | SecuritySettingsScreen.tsx | ✅ Screen exists, ❌ Route missing |
| `/wallet/settings/backup` | BackupScreen.tsx | ✅ Screen exists, ❌ Route missing |

### Settings Routes Completely Missing (Need Both Screen and Route)
| Route Path | Screen Component | Status |
|------------|------------------|--------|
| `/wallet/settings/currency` | None | ❌ Screen missing, ❌ Route missing |

### Settings Routes Already Working
| Route Path | Screen Component | Status |
|------------|------------------|--------|
| `/wallet/settings/language` | LanguageSettingsScreen.tsx | ✅ Complete |
| `/wallet/settings/theme` | AppPreferencesScreen.tsx | ✅ Complete |
| `/wallet/settings/notifications` | NotificationsSettingsScreen.tsx | ✅ Complete |

### Navigation Bug: Show All Wallets
| Issue | Current State | Fix Required |
|-------|---------------|--------------|
| PinEntryScreen "Switch Wallet" button | Navigates to `/wallet/select` | Route is `/wallet/selection` - fix navigation path |

### Routing Layout Note
- The wallet stack layout lives in `app/wallet/_layout.tsx` (there is no `_layout.tsx` inside `app/wallet/settings/`). New settings routes should rely on the existing parent stack.

## Requirements

### Requirement 1: Wallet Configuration Route

**User Story:** As a user, I want to access wallet configuration settings, so that I can switch between built-in wallet and custom LNURL.

#### Acceptance Criteria

1. WHEN a user taps "Wallet Type" in settings THEN the System SHALL navigate to `/wallet/settings/wallet-config`
2. WHEN the wallet-config route is accessed THEN the System SHALL render WalletConfigScreen component
3. THE Route_File SHALL export the WalletConfigScreen as the default export

### Requirement 2: Default Amounts Route

**User Story:** As a user, I want to access default amounts settings, so that I can configure my preferred tip amounts.

#### Acceptance Criteria

1. WHEN a user taps "Default Tip Amounts" in settings THEN the System SHALL navigate to `/wallet/settings/amounts`
2. WHEN the amounts route is accessed THEN the System SHALL render AmountsSettingsScreen component
3. THE Route_File SHALL export the AmountsSettingsScreen as the default export

### Requirement 3: Security Settings Route

**User Story:** As a user, I want to access security settings, so that I can configure biometric authentication and auto-lock.

#### Acceptance Criteria

1. WHEN a user taps "Biometric" in settings THEN the System SHALL navigate to `/wallet/settings/security`
2. WHEN the security route is accessed THEN the System SHALL render SecuritySettingsScreen component
3. THE Route_File SHALL export the SecuritySettingsScreen as the default export

### Requirement 4: Backup Settings Route

**User Story:** As a user, I want to access backup settings, so that I can view my recovery phrase.

#### Acceptance Criteria

1. WHEN a user taps "View Recovery Phrase" in settings THEN the System SHALL navigate to `/wallet/settings/backup`
2. WHEN the backup route is accessed THEN the System SHALL render BackupScreen component
3. THE Route_File SHALL export the BackupScreen as the default export

### Requirement 5: Currency Settings Screen and Route

**User Story:** As a user, I want to access currency settings, so that I can change my display currency preference.

#### Acceptance Criteria

1. WHEN a user taps "Display Currency" in settings THEN the System SHALL navigate to `/wallet/settings/currency`
2. WHEN the currency route is accessed THEN the System SHALL render CurrencySettingsScreen component
3. THE CurrencySettingsScreen SHALL display available currency options (BTC, Satoshis, USD, EUR)
4. WHEN a user selects a currency THEN the System SHALL persist the selection to settings storage
5. WHEN a user saves currency preference THEN the System SHALL update the display throughout the app
6. THE Route_File SHALL export the CurrencySettingsScreen as the default export
7. THE System SHALL not expose BGN as a currency option (BGN removed in favor of EUR)


### Requirement 6: Fix Show All Wallets Navigation

**User Story:** As a user on the unlock screen, I want to tap "Switch Wallet" and see all my wallets, so that I can select a different wallet to unlock.

#### Acceptance Criteria

1. WHEN a user taps "Switch Wallet" on the PinEntryScreen THEN the System SHALL navigate to `/wallet/selection`
2. WHEN the selection route is accessed THEN the System SHALL render WalletSelectionScreen component showing all wallets
3. THE PinEntryScreen SHALL use the correct route path `/wallet/selection` instead of `/wallet/select`
4. WHEN a user deletes the main wallet THEN the System SHALL present the WalletSelectionScreen so the user can choose another wallet
