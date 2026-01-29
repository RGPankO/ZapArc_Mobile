# Notifications Handler

Firebase Cloud Function for sending Expo push notifications when Lightning wallet transactions occur.

## Overview

This service provides HTTP-triggered Cloud Functions that:

1. **sendTransactionNotification**: Sends push notifications when payments are made
2. **registerDevice**: Registers a device's push token mapped to Lightning Address or Node ID
3. **notify**: NDS (Notification Delivery Service) webhook for Breez SDK integration

## Architecture

```
Mobile App (Sender) → Cloud Function → Expo Push API → Device (Recipient)
```

When User A sends sats to User B:

1. User A's app calls `sendTransactionNotification` with User B's Lightning Address or Node ID
2. Cloud Function looks up User B's push token in Firestore
3. Formats and sends notification via Expo Push API
4. User B receives: "You received {amount} sats on {wallet name}!"

## Project Structure

```
notifications-handler/
├── src/
│   ├── index.ts          # Cloud Function entry points
│   ├── config.ts         # Environment configuration
│   ├── types.ts          # TypeScript interfaces
│   └── validation.ts     # Input validation logic
├── tests/
│   ├── index.test.ts     # Cloud Function tests
│   └── validation.test.ts # Validation tests
├── package.json
├── tsconfig.json
├── firebase.json
├── vitest.config.ts
└── .env.example
```

---

## Complete Setup Guide

### 1. Prerequisites

- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`
- Firebase project with:
  - Cloud Functions enabled
  - Firestore database created
  - Billing enabled (required for Cloud Functions)

### 2. Firebase Project Setup

#### 2.1 Create/Select Firebase Project

```bash
firebase login
firebase projects:list
firebase use <your-project-id>
```

Or create `.firebaserc` manually:

```json
{
  "projects": {
    "default": "your-project-id"
  }
}
```

#### 2.2 Add Android App to Firebase

```bash
# Create Android app
firebase apps:create ANDROID -a com.yourcompany.yourapp --display-name="YourApp"

# Download google-services.json
firebase apps:sdkconfig ANDROID <app-id> -o ../mobile-app/google-services.json
```

Or via Firebase Console:

1. Go to Project Settings → Add app → Android
2. Package name: `com.yourcompany.yourapp` (must match `app.json`)
3. Download `google-services.json`
4. Place in `mobile-app/` directory

#### 2.3 Add iOS App to Firebase

```bash
# Create iOS app
firebase apps:create -b com.yourcompany.yourapp IOS YourApp

# Download GoogleService-Info.plist
firebase apps:sdkconfig IOS <app-id> -o ../mobile-app/GoogleService-Info.plist
```

Or via Firebase Console:

1. Go to Project Settings → Add app → iOS
2. Bundle ID: `com.yourcompany.yourapp` (must match `app.json`)
3. Download `GoogleService-Info.plist`
4. Place in `mobile-app/` directory

#### 2.4 Configure APNs for iOS Push Notifications

**This is REQUIRED for iOS notifications to work!**

1. **Get APNs Authentication Key from Apple**:
   - Go to [Apple Developer Portal → Keys](https://developer.apple.com/account/resources/authkeys/list)
   - Click "+" to create a new key
   - Name: "Expo Push Notifications Key"
   - Enable: "Apple Push Notifications service (APNs)"
   - Click "Continue" → "Register"
   - Download the `.p8` file (you can only download once!)
   - Note your **Key ID** and **Team ID**

2. **Upload to Firebase Console**:
   - Go to [Firebase Console](https://console.firebase.google.com) → Your Project
   - Project Settings → Cloud Messaging tab
   - Under "Apple app configuration", click "Upload"
   - Upload the `.p8` file
   - Enter your Key ID and Team ID
   - Click "Upload"

**Without this step, iOS devices will NOT receive push notifications!**

### 3. Mobile App Configuration

#### 3.1 Update `app.json`

Add Firebase configuration for both platforms:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourcompany.yourapp",
      "googleServicesFile": "./GoogleService-Info.plist"
    },
    "android": {
      "package": "com.yourcompany.yourapp",
      "googleServicesFile": "./google-services.json"
    },
    "extra": {
      "eas": {
        "projectId": "your-expo-project-id"
      }
    }
  }
}
```

**Important**:

- `bundleIdentifier` (iOS) and `package` (Android) must match what you registered in Firebase
- `projectId` is your EAS project ID (from Expo), NOT Firebase project ID
- Both Firebase config files must be in the mobile-app root directory

#### 3.2 Platform-Specific Settings

**Android**:

- ✅ `google-services.json` in mobile-app root
- ✅ `googleServicesFile` in `app.json`
- ✅ FCM automatically configured

**iOS**:

- ✅ `GoogleService-Info.plist` in mobile-app root
- ✅ `googleServicesFile` in `app.json`
- ✅ APNs key uploaded to Firebase (step 2.4)
- ✅ Correct `bundleIdentifier` in `app.json`
- ✅ EAS project ID in `app.json` (`extra.eas.projectId`)

### 4. Install Dependencies

```bash
cd notifications-handler
npm install
```

### 5. Configuration

Copy environment example (optional - defaults work):

```bash
cp .env.example .env
```

Environment variables:

```env
# Expo Push API endpoint (defaults to official endpoint)
EXPO_PUSH_API_URL=https://exp.host/--/api/v2/push/send
```

### 6. Build and Deploy

```bash
# Build TypeScript
npm run build

# Deploy to Firebase
npm run deploy

# Or deploy specific functions
firebase deploy --only functions:sendTransactionNotification
firebase deploy --only functions:registerDevice
```

---

## API Reference

### 1. POST /registerDevice

Registers a device's push token for notifications.

**Request Body**:

```json
{
  "pubKey": "user@lightning.address OR <hex-node-id>",
  "expoPushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "platform": "ios",
  "walletNickname": "My Lightning Wallet"
}
```

**Response**:

```json
{
  "success": true,
  "message": "Device registered successfully"
}
```

### 2. POST /sendTransactionNotification

Sends a payment notification to a recipient.

**Request Body (Option A - Direct token)**:

```json
{
  "expoPushToken": "ExponentPushToken[xxx]",
  "amount": 1000
}
```

**Request Body (Option B - Lightning Address lookup)**:

```json
{
  "recipientLightningAddress": "user@lightning.address",
  "amount": 1000
}
```

**Request Body (Option C - Node ID lookup)**:

```json
{
  "recipientPubKey": "<hex-node-id>",
  "amount": 1000
}
```

**Response**:

```json
{
  "success": true,
  "message": "Notification sent successfully to 1 device(s)"
}
```

### 3. POST /notify (NDS Webhook)

Breez SDK webhook endpoint for background notifications.

**URL Format**: `/notify?platform=ios&token=ExponentPushToken[xxx]`

**Request Body** (from Breez SDK):

```json
{
  "template": "payment_received",
  "data": {
    "amount_msat": 1000000,
    "payment_hash": "abc123..."
  }
}
```

---

## Mobile App Integration

### Registration (On Wallet Load)

```typescript
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

// Get push token with project ID (REQUIRED for iOS)
const projectId = Constants.expoConfig?.extra?.eas?.projectId;
const { data: pushToken } = await Notifications.getExpoPushTokenAsync(
  projectId ? { projectId } : undefined,
);

// Get Lightning Address or Node ID
const lightningAddress = await getLightningAddress();

// Register device
await fetch("https://region-project.cloudfunctions.net/registerDevice", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    pubKey: lightningAddress,
    expoPushToken: pushToken,
    platform: Platform.OS,
    walletNickname: "My Wallet",
  }),
});
```

### Sending Notification (After Payment)

```typescript
// After successful payment, trigger notification
await fetch(
  "https://region-project.cloudfunctions.net/sendTransactionNotification",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipientLightningAddress: "recipient@lightning.address",
      amount: 1000,
    }),
  },
);
```

---

## Testing

### Run Tests

```bash
npm test              # Run once
npm run test:watch    # Watch mode
npm run test:ui       # Interactive UI
```

### Local Emulator

```bash
npm run serve
```

Functions available at:

- `http://localhost:5001/<project-id>/europe-west3/sendTransactionNotification`
- `http://localhost:5001/<project-id>/europe-west3/registerDevice`
- `http://localhost:5001/<project-id>/europe-west3/notify`

### Test with cURL

**Register a device**:

```bash
curl -X POST http://localhost:5001/<project-id>/europe-west3/registerDevice \
  -H "Content-Type: application/json" \
  -d '{
    "pubKey": "test@lightning.address",
    "expoPushToken": "ExponentPushToken[abc123]",
    "platform": "ios",
    "walletNickname": "Test Wallet"
  }'
```

**Send notification**:

```bash
curl -X POST http://localhost:5001/<project-id>/europe-west3/sendTransactionNotification \
  -H "Content-Type: application/json" \
  -d '{
    "recipientLightningAddress": "test@lightning.address",
    "amount": 1000
  }'
```

---

## Troubleshooting

### Android Notifications Not Working

1. ✅ Check `google-services.json` is in mobile-app root
2. ✅ Verify package name matches Firebase console
3. ✅ Rebuild app after adding `google-services.json`
4. ✅ Check Firebase Console logs for errors

### iOS Notifications Not Working

1. ✅ Check `GoogleService-Info.plist` is in mobile-app root
2. ✅ Verify bundle ID matches Firebase console
3. ✅ **Check APNs key is uploaded to Firebase** (most common issue!)
4. ✅ Verify you're using `projectId` when getting push token:
   ```typescript
   const projectId = Constants.expoConfig?.extra?.eas?.projectId;
   await Notifications.getExpoPushTokenAsync(
     projectId ? { projectId } : undefined,
   );
   ```
5. ✅ Rebuild iOS app after configuration changes
6. ✅ Check device is registered with correct Lightning Address/Node ID

### Push Token Issues

**Problem**: Invalid or missing push token

**Solution**:

- Ensure notification permissions are granted
- Request permissions before getting token:
  ```typescript
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") {
    // Handle permission denied
  }
  ```

### Firestore Lookup Fails

**Problem**: User not found in registry

**Solution**:

- Ensure `registerDevice` was called successfully
- Check Firestore console for user document
- Lightning Addresses are stored lowercase
- Node IDs are stored as-is

---

## Deployment

### Deploy All Functions

```bash
npm run deploy
```

### Deploy Specific Function

```bash
firebase deploy --only functions:sendTransactionNotification
firebase deploy --only functions:registerDevice
```

### View Logs

```bash
npm run logs
# or
firebase functions:log
```

### Monitor Functions

Check Firebase Console → Functions → Dashboard for:

- Invocation count
- Error rate
- Execution time
- Memory usage

---

## Security Considerations

1. **Rate Limiting**: Consider adding rate limits to prevent abuse
2. **Authentication**: Add authentication for production use
3. **Input Validation**: All inputs are validated with Zod schemas
4. **CORS**: Currently allows all origins (`cors: true`) - restrict in production

---

## License

MIT
