# Google Drive Seed Phrase Backup - Requirements

## Overview
Enable users to securely backup their wallet seed phrase (mnemonic) to Google Drive, encrypted with a user-provided password.

## User Stories

### US-1: Connect Google Account
**As a** wallet user  
**I want to** connect my Google account to the app  
**So that** I can use Google Drive for encrypted backups  

**Acceptance Criteria:**
- [ ] User can initiate Google Sign-In from the Cloud Backup settings screen
- [ ] OAuth flow requests only `drive.appdata` scope (app-specific hidden folder)
- [ ] User sees connected account email after successful authentication
- [ ] User can disconnect their Google account
- [ ] Authentication tokens are stored securely

### US-2: Create Encrypted Backup
**As a** wallet user  
**I want to** create an encrypted backup of my seed phrase  
**So that** I can recover my wallet if I lose my device  

**Acceptance Criteria:**
- [ ] User must authenticate (biometric/PIN) before creating backup
- [ ] User enters a strong password with confirmation
- [ ] Password strength indicator shows minimum requirements (8+ chars, mixed case, numbers)
- [ ] Seed phrase is encrypted with AES-256-GCM before upload
- [ ] Encrypted file is uploaded to Google Drive appDataFolder
- [ ] User sees success confirmation with timestamp
- [ ] Clear warning about remembering the password (cannot be recovered)

### US-3: Restore from Backup
**As a** wallet user  
**I want to** restore my wallet from a Google Drive backup  
**So that** I can recover my funds on a new device  

**Acceptance Criteria:**
- [ ] User can list existing backups from Google Drive
- [ ] User selects a backup and enters the encryption password
- [ ] Backup is decrypted and mnemonic is revealed
- [ ] User can use the mnemonic to import/restore the wallet
- [ ] Invalid password shows clear error message
- [ ] Corrupted backup shows appropriate error

### US-4: Manage Backups
**As a** wallet user  
**I want to** manage my cloud backups  
**So that** I can delete old backups and keep my storage organized  

**Acceptance Criteria:**
- [ ] User can see list of all backups with timestamps
- [ ] User can delete individual backups with confirmation
- [ ] Deleting requires authentication (biometric/PIN)
- [ ] User sees last backup timestamp in settings

## Security Requirements

### Encryption
- AES-256-GCM authenticated encryption
- PBKDF2 key derivation with 600,000 iterations
- Random 32-byte salt per encryption
- Random 12-byte IV per encryption
- Never store the encryption password

### Password Policy
- Minimum 8 characters
- Must contain uppercase and lowercase letters
- Must contain at least one number
- Optional: special characters

### Data Handling
- Clear sensitive data from memory after use
- Mnemonic never transmitted unencrypted
- OAuth tokens stored in secure storage
- Backup files stored in hidden appDataFolder (not visible in Drive UI)

### User Warnings
- Clear warnings about password importance
- Cannot recover password - must remember it
- Losing password means losing access to backup
