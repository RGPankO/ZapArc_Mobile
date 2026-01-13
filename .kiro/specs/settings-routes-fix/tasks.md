# Implementation Plan: Settings Routes Fix

## Overview

This implementation plan fixes missing Expo Router route files for wallet settings, removes legacy BGN currency support, and resolves a navigation bug in the unlock screen. Most tasks are simple route file creation since the screen components already exist.

## Tasks

- [ ] 1. Create missing settings route files (screens already exist)
  - [ ] 1.1 Create wallet-config route file
    - Create `app/wallet/settings/wallet-config.tsx`
    - Import and export `WalletConfigScreen` from settings barrel
    - _Requirements: 1.1, 1.2, 1.3_
  - [ ] 1.2 Create amounts route file
    - Create `app/wallet/settings/amounts.tsx`
    - Import and export `AmountsSettingsScreen` from settings barrel
    - _Requirements: 2.1, 2.2, 2.3_
  - [ ] 1.3 Create security route file
    - Create `app/wallet/settings/security.tsx`
    - Import and export `SecuritySettingsScreen` from settings barrel
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ] 1.4 Create backup route file
    - Create `app/wallet/settings/backup.tsx`
    - Import and export `BackupScreen` from settings barrel
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 2. Implement Currency Settings (screen + route missing)
  - [ ] 2.1 Create CurrencySettingsScreen component
    - Create `src/features/wallet/screens/settings/CurrencySettingsScreen.tsx`
    - Display currency options: Satoshis, BTC, USD, EUR
    - Use RadioButton for selection
    - Integrate with useSettings hook for persistence
    - Follow existing settings screen patterns (LinearGradient, header, save button)
    - _Requirements: 5.2, 5.3, 5.4, 5.5_
  - [ ] 2.2 Export CurrencySettingsScreen from barrel
    - Add export to `src/features/wallet/screens/settings/index.ts`
    - _Requirements: 5.2_
  - [ ] 2.3 Create currency route file
    - Create `app/wallet/settings/currency.tsx`
    - Import and export `CurrencySettingsScreen`
    - _Requirements: 5.1, 5.6_

- [ ] 3. Fix Switch Wallet navigation bug
  - [ ] 3.1 Fix PinEntryScreen navigation path
    - Update `src/features/wallet/screens/PinEntryScreen.tsx`
    - Change `router.push('/wallet/select')` to `router.push('/wallet/selection')`
    - _Requirements: 6.1, 6.2, 6.3_
  - [ ] 3.2 Ensure main wallet deletion shows wallet selection
    - After deleting the main wallet, present WalletSelectionScreen for choosing another wallet
    - _Requirements: 6.4_

- [ ] 4. Checkpoint - Verify all routes work
  - Test each settings route navigates correctly from WalletSettingsScreen
  - Test Switch Wallet button navigates to WalletSelectionScreen
  - Verify currency selection persists correctly
  - _Requirements: All_

- [ ] 5. Remove BGN currency option (EUR only for Bulgaria)
  - [ ] 5.1 Update currency type union to remove `'bgn'`
  - [ ] 5.2 Ensure currency option lists exclude BGN (CurrencySettingsScreen, settings hub display)
  - _Requirements: 5.7_

## Notes

- Tasks 1.1-1.4 are simple one-line route files since screen components already exist
- Task 2.1 requires creating a new screen component following existing patterns
- Task 3.1 is a one-line bug fix
- All route files follow the same pattern used by existing routes (language, theme, notifications) and rely on the parent wallet stack defined in `app/wallet/_layout.tsx`
