# Notifications Handler

Firebase Cloud Function for sending Expo push notifications when Lightning wallet transactions occur.

## Overview

This service provides a minimal HTTP-triggered Cloud Function that:

1. Receives transaction notification requests with an Expo push token and amount
2. Validates the input parameters
3. Sends a formatted push notification via the Expo Push API
4. Returns success/error responses

## Architecture

```
Mobile App (User A) → Cloud Function → Expo Push API → Device (User B)
```

When User A sends sats to User B, User A's app calls this Cloud Function with User B's Expo push token. The function formats and sends a notification that appears as:

- **Title**: "Payment Received"
- **Body**: "You received {amount} sats!"

## Project Structure

```
notifications-handler/
├── src/
│   ├── index.ts          # Cloud Function entry point
│   ├── config.ts         # Environment configuration (dotenv + zod)
│   ├── types.ts          # TypeScript interfaces
│   └── validation.ts     # Input validation logic
├── tests/
│   ├── index.test.ts     # Cloud Function tests
│   └── validation.test.ts # Validation module tests
├── package.json
├── tsconfig.json
├── firebase.json
├── vitest.config.ts
└── .env.example
```

## Setup

### Prerequisites

- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase project with Cloud Functions enabled

### Installation

```bash
cd notifications-handler
npm install
```

### Configuration

1. Copy the environment example file:

   ```bash
   cp .env.example .env
   ```

2. Configure your `.env` file (optional - defaults work for most cases):

   ```env
   # Expo Push API endpoint (defaults to official endpoint)
   EXPO_PUSH_API_URL=https://exp.host/--/api/v2/push/send
   ```

3. Log in to Firebase:

   ```bash
   firebase login
   ```

4. Set your Firebase project:
   ```bash
   firebase use <your-project-id>
   ```

## Development

### Build

```bash
npm run build
```

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

This starts the Firebase emulator with your function at:
`http://localhost:5001/<project-id>/us-central1/sendTransactionNotification`

## API Reference

### POST /sendTransactionNotification

Send a push notification to a device.

#### Request Body

```json
{
  "expoPushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "amount": 1000
}
```

| Field           | Type   | Description                                   |
| --------------- | ------ | --------------------------------------------- |
| `expoPushToken` | string | Expo push token for the recipient device      |
| `amount`        | number | Payment amount in satoshis (must be positive) |

#### Success Response (200)

```json
{
  "success": true,
  "message": "Notification sent successfully"
}
```

#### Error Response (400)

Invalid input parameters:

```json
{
  "success": false,
  "error": "Missing required parameter: expoPushToken"
}
```

#### Error Response (500)

Server or Expo Push API error:

```json
{
  "success": false,
  "error": "Failed to send notification: <error details>"
}
```

## Deployment

### Deploy to Firebase

```bash
npm run deploy
```

Or manually:

```bash
firebase deploy --only functions
```

### View Logs

```bash
npm run logs
```

Or:

```bash
firebase functions:log
```

## Testing with cURL

### Local (Emulator)

```bash
curl -X POST http://localhost:5001/<project-id>/us-central1/sendTransactionNotification \
  -H "Content-Type: application/json" \
  -d '{"expoPushToken": "ExponentPushToken[abc123]", "amount": 1000}'
```

### Production

```bash
curl -X POST https://<region>-<project-id>.cloudfunctions.net/sendTransactionNotification \
  -H "Content-Type: application/json" \
  -d '{"expoPushToken": "ExponentPushToken[abc123]", "amount": 1000}'
```

## Mobile App Integration

To call this function from the mobile app:

```typescript
const response = await fetch(
  "https://<region>-<project-id>.cloudfunctions.net/sendTransactionNotification",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      expoPushToken: recipientPushToken,
      amount: paymentAmountSats,
    }),
  },
);

const result = await response.json();
if (result.success) {
  console.log("Notification sent!");
} else {
  console.error("Failed:", result.error);
}
```

## License

MIT
