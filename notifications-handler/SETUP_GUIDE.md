# Notifications Handler Setup Guide

This guide describes how to set up, implement, and deploy the Firebase Cloud Functions service for Expo push notifications. Use this guide to recreate the environment or deploy to a new project.

## 1. Project Initialization

### Prerequisites

- Node.js 18+ (Node 20 recommended)
- Firebase CLI (`npm install -g firebase-tools`)
- A Firebase project on the **Blaze (pay-as-you-go) plan** (required for Cloud Functions)

### Setup Steps

1. Create the project directory:

   ```bash
   mkdir notifications-handler
   cd notifications-handler
   ```

2. Initialize configuration files manually (recommended for control) or via `firebase init`.

   **Key Files Needed:**
   - `package.json` (ensure `engines: { "node": "20" }`)
   - `tsconfig.json` (strict mode enabled)
   - `firebase.json` (functions configuration)
   - `.firebaserc` (project alias mapping)

3. Install dependencies:
   ```bash
   npm install firebase-functions firebase-admin dotenv zod
   npm install --save-dev typescript vitest @types/node
   ```

## 2. Implementation Details

The service is a **Gen 2** Firebase Cloud Function.

### Key File Structure

```
src/
├── index.ts          # Main entry point
├── config.ts         # Environment config (zod)
├── types.ts          # Interfaces
└── validation.ts     # Request validation
```

### Critical Code Configuration (Gen 2)

Use the v2 API with CORS enabled for public access:

```typescript
import { onRequest } from "firebase-functions/v2/https";

export const sendTransactionNotification = onRequest(
  { cors: true }, // Enables CORS and simplifies public access
  async (request, response) => {
    // ... logic
  },
);
```

## 3. Firebase Project Setup

1. **Login:**

   ```bash
   firebase login
   ```

2. **Select Project:**

   ```bash
   firebase use --add
   # Select your project alias (e.g., 'default')
   ```

3. **Verify Billing:**
   - Ensure the project is on the **Blaze Plan** in the Firebase Console.
   - This is strictly required for Node.js runtimes in Cloud Functions.

## 4. Deployment Process

The deployment enables several Google Cloud Platform (GCP) APIs automatically.

### Command

```bash
npm run deploy
# OR
npm run build && firebase deploy --only functions
```

### First Deployment Notes (Crucial)

During the first deployment, you may encounter timeouts or errors related to API enablement or "provisioning taking too long". This is normal.

**Required APIs (Enabled automatically, but may take time):**

- Cloud Build API
- Cloud Run API
- Artifact Registry API
- Eventarc API
- Pub/Sub API

**Handling Errors:**
If deployment fails with _"provisioning for project ... is taking too long"_:

1. **Wait 1-2 minutes.** Docker repositories and service identities are being created in the background.
2. **Retry the deployment.**
   ```bash
   firebase deploy --only functions
   ```

### Troubleshooting "Service Identity" Errors

If you see errors about `pubsub.googleapis.com` or `eventarc.googleapis.com` service identities:

- Wait 60 seconds and retry.
- These identities are auto-generated when the API is enabled but take time to propagate.

## 5. Verification

After successful deployment, you will get a function URL.

### Test with cURL

```bash
curl -X POST https://<region>-<project-id>.cloudfunctions.net/sendTransactionNotification \
  -H "Content-Type: application/json" \
  -d '{"expoPushToken": "ExponentPushToken[test]", "amount": 1000}'
```

**Expected Response:**

```json
{ "success": true, "message": "Notification sent successfully" }
```

## 6. Maintenance

- **Update Dependencies:** `npm update`
- **Run Tests:** `npm test`
- **Monitor Logs:** `firebase functions:log`
