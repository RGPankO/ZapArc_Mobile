# Google Drive Seed Phrase Backup - Implementation Tasks

## Phase 1: Core Encryption Module

- [x] Create `src/services/backupEncryption.ts`
  - [x] Implement PBKDF2 key derivation (600k iterations)
  - [x] Implement AES-256-GCM encryption
  - [x] Implement AES-256-GCM decryption
  - [x] Implement password strength validation
  - [x] Define backup file format interface
  - [x] Add memory clearing utilities

## Phase 2: Google Drive Service

- [x] Create `src/services/googleDriveBackupService.ts`
  - [x] Implement Google OAuth sign-in with expo-auth-session
  - [x] Implement token storage/retrieval from secure store
  - [x] Implement file upload to appDataFolder
  - [x] Implement file download from appDataFolder
  - [x] Implement list backups
  - [x] Implement delete backup
  - [x] Implement sign-out / disconnect

## Phase 3: UI Components

- [x] Create `src/features/wallet/screens/settings/GoogleDriveBackupScreen.tsx`
  - [x] Header with back button
  - [x] Google account connection status
  - [x] Connect/Disconnect button
  - [x] Create Backup section with button
  - [x] Backup list with timestamps
  - [x] Restore flow UI
  - [x] Delete backup confirmation
  - [x] Password entry modal with strength indicator
  - [x] Security warnings

## Phase 4: Integration

- [x] Create route file `app/wallet/settings/google-drive-backup.tsx`
- [x] Update `src/features/wallet/screens/settings/index.ts` barrel export
- [x] Add Cloud Backup entry to `WalletSettingsScreen.tsx`
- [x] Add translation keys to i18nService.ts

## Phase 5: Testing & Polish

- [ ] Run type-check
- [ ] Test OAuth flow
- [ ] Test encryption/decryption
- [ ] Test backup creation
- [ ] Test backup restoration
- [ ] Git commit all changes

## File Checklist

New files:
- [ ] `src/services/backupEncryption.ts`
- [ ] `src/services/googleDriveBackupService.ts`
- [ ] `src/features/wallet/screens/settings/GoogleDriveBackupScreen.tsx`
- [ ] `app/wallet/settings/google-drive-backup.tsx`

Modified files:
- [ ] `src/features/wallet/screens/settings/index.ts`
- [ ] `src/features/wallet/screens/WalletSettingsScreen.tsx`
- [ ] `src/services/i18nService.ts`
