# Google Drive Seed Phrase Backup - Technical Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                 GoogleDriveBackupScreen                      │
│                    (UI Component)                            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              googleDriveBackupService                        │
│   - Google OAuth (expo-auth-session)                         │
│   - Drive API calls (fetch)                                  │
│   - Coordinates encryption/decryption                        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 backupEncryption                             │
│   - AES-256-GCM encryption/decryption                        │
│   - PBKDF2 key derivation (600k iterations)                  │
│   - Password strength validation                             │
└─────────────────────────────────────────────────────────────┘
```

## Encryption Design

### Key Derivation
```typescript
// PBKDF2 with SHA-256
const salt = randomBytes(32);
const key = PBKDF2(password, salt, {
  iterations: 600000,
  keyLength: 32,
  hash: 'SHA-256'
});
```

### Encryption
```typescript
// AES-256-GCM
const iv = randomBytes(12);
const { ciphertext, authTag } = AES_GCM_Encrypt(plaintext, key, iv);
```

### Backup File Format
```json
{
  "version": 1,
  "format": "aes-256-gcm",
  "salt": "<base64>",
  "iv": "<base64>",
  "ciphertext": "<base64>",
  "timestamp": 1707465600000,
  "walletName": "Main Wallet"
}
```

## Google Drive Integration

### OAuth Configuration
- Use expo-auth-session for OAuth 2.0 flow
- Request scope: `https://www.googleapis.com/auth/drive.appdata`
- This scope grants access ONLY to the hidden app-specific folder
- User cannot see these files in their regular Google Drive

### API Endpoints
- List files: `GET /drive/v3/files?spaces=appDataFolder`
- Upload: `POST /upload/drive/v3/files?uploadType=multipart`
- Download: `GET /drive/v3/files/{fileId}?alt=media`
- Delete: `DELETE /drive/v3/files/{fileId}`

### File Naming
```
zaparc_backup_{walletId}_{timestamp}.json
```

## Implementation Strategy

Since expo-crypto doesn't provide AES-GCM, we'll use the Web Crypto API (SubtleCrypto) which is available in React Native's JavaScript runtime for most modern versions.

### Fallback Strategy
1. Primary: Use Web Crypto API (crypto.subtle)
2. If not available: Show error asking user to update the app

## Security Considerations

### Memory Handling
- Clear password and mnemonic from variables after use
- Use local variables with limited scope
- Don't log sensitive data

### Token Storage
- Store OAuth tokens in expo-secure-store
- Refresh tokens when expired
- Clear tokens on disconnect

### Error Handling
- Generic error messages (no internal details)
- Log errors without sensitive data
- Clear sensitive state on error

## UI Flow

### Create Backup Flow
1. User taps "Create Backup"
2. Authenticate (biometric/PIN)
3. Show password entry modal
4. Validate password strength
5. Encrypt mnemonic
6. Upload to Google Drive
7. Show success with timestamp

### Restore Flow
1. User taps "Restore from Backup"
2. Fetch backup list from Drive
3. User selects backup
4. Enter decryption password
5. Decrypt and display mnemonic
6. Option to import wallet

## Dependencies

### Existing
- expo-auth-session (OAuth)
- expo-crypto (random bytes)
- expo-secure-store (token storage)
- expo-web-browser (OAuth redirect)
- expo-local-authentication (biometric)

### No New Dependencies
- Using Web Crypto API (SubtleCrypto) built into JS runtime
- Using fetch for Google Drive API calls
