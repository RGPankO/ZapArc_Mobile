# Breez SDK Spark - Setup Guide

This guide covers setting up the Breez SDK Spark (Nodeless) for the ZapArc mobile app.

## Overview

The app uses **Breez SDK Spark** (`@breeztech/breez-sdk-spark-react-native`) for Lightning Network functionality. This is a "nodeless" implementation that provides self-custodial Lightning payments without running a full Lightning node.

### SDK Variants (Know the Difference!)

| SDK Package                                | Network                | Use Case                                |
| ------------------------------------------ | ---------------------- | --------------------------------------- |
| `@breeztech/react-native-breez-sdk`        | Lightning (Greenlight) | Original SDK, requires Greenlight nodes |
| `@breeztech/react-native-breez-sdk-liquid` | Liquid Network         | For Liquid-based payments               |
| `@breeztech/breez-sdk-spark-react-native`  | Lightning (Spark)      | **We use this** - Nodeless Lightning    |

> ⚠️ **Important:** Each SDK variant requires its own API key. Keys are NOT interchangeable!

---

## Prerequisites

- Node.js 18+ (recommended: use nvm)
- Expo CLI (`npm install -g expo-cli`)
- Android Studio (for Android builds)
- Xcode (for iOS builds, macOS only)

---

## Step 1: Install Dependencies

```bash
cd mobile-app

# Install the Breez SDK Spark package
npm install @breeztech/breez-sdk-spark-react-native

# Required peer dependencies
npm install react-native-fs react-native-get-random-values
```

---

## Step 2: Get Your API Key

1. Go to [Breez API Key Request Form](https://breez.technology/request-api-key/#contact-us-form-sdk)
2. Fill out the form and **select "Nodeless (Spark)"** as the SDK type
3. Wait for Breez to send you the API key via email
4. Add the API key to your environment:

**Option A: Environment Variable (Recommended for production)**

```bash
# .env file
EXPO_PUBLIC_BREEZ_API_KEY=your_spark_api_key_here
```

**Option B: Config file (for development)**

```typescript
// src/config/breezConfig.ts
export const BREEZ_API_KEY = 'your_spark_api_key_here';
```

> ⚠️ **Note:** The Spark API key format is different from the old Greenlight certificate format. If you get "invalid certificate" errors, you're using the wrong key type.

---

## Step 3: Configure Expo Build

The Breez SDK requires native modules, so it **cannot run in Expo Go**. Use local native development builds.

### 3.1 Configure app.json (local native build)

Ensure these plugins are in your `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-build-properties",
        {
          "android": {
            "minSdkVersion": 24,
            "compileSdkVersion": 34,
            "targetSdkVersion": 34,
            "buildToolsVersion": "34.0.0",
            "kotlinVersion": "1.9.24",
            "enableProguardInReleaseBuilds": false
          },
          "ios": {
            "deploymentTarget": "13.4"
          }
        }
      ]
    ]
  }
}
```

---

## Step 4: Build the Development Client

### Android (Local Build)

```bash
# Generate native Android project
npx expo prebuild --platform android

# Build development client locally
npx expo run:android
```

### iOS (Local Build - macOS only)

```bash
# Generate native iOS project
npx expo prebuild --platform ios

# Build development client
npx expo run:ios
```

---

## Step 5: Run the App

After building the development client:

```bash
# Start Metro bundler with dev client
npm run start
# or
npx expo start --dev-client
```

Then:

1. Install the built APK/IPA on your device
2. Open the app - it will connect to your Metro bundler
3. The Breez SDK will be available with full native functionality

---

## SDK Usage

### Initialize the SDK

```typescript
import {
  connect,
  defaultConfig,
  Network,
  Seed,
} from '@breeztech/breez-sdk-spark-react-native';
import RNFS from 'react-native-fs';

async function initializeBreezSDK(mnemonic: string, apiKey: string) {
  // Create seed from mnemonic
  const seed = new Seed.Mnemonic({
    mnemonic,
    passphrase: undefined,
  });

  // Create config
  const config = defaultConfig(Network.Mainnet);
  if (apiKey) {
    config.apiKey = apiKey;
  }

  // Connect
  const storageDir = `${RNFS.DocumentDirectoryPath}/breezSdkSpark`;
  const sdk = await connect({
    config,
    seed,
    storageDir,
  });

  return sdk;
}
```

### Get Wallet Info

```typescript
const info = await sdk.getInfo();
console.log('Balance:', info.balanceSat);
```

### List Payments

```typescript
const payments = await sdk.listPayments({});
```

---

## Troubleshooting

### Error: "Native SDK not available"

- You're running in Expo Go. Use a development build instead.

### Error: "invalid certificate for breeze api key"

- You're using an old Greenlight API key. Request a new Spark API key.

### Error: "EACCES" on node_modules/.bin

Windows permission issue. Try:

```bash
rm -rf node_modules
npm install
```

Or run terminal as Administrator.

### Error: Gradle build failures

Check Kotlin version compatibility:

```json
// app.json
"expo-build-properties": {
  "android": {
    "kotlinVersion": "1.9.24"
  }
}
```

### Error: "SdkError.Generic"

Enable detailed logging to see the actual error. Check API key format and network connectivity.

---

## Resources

- [Breez SDK Spark Documentation](https://sdk-doc-spark.breez.technology/)
- [Breez SDK Spark GitHub](https://github.com/breez/breez-sdk-spark-react-native)
- [Request API Key](https://breez.technology/request-api-key/)
- [Breez Telegram Support](https://t.me/breezsdk)

---

## Version Compatibility

| Package                      | Tested Version |
| ---------------------------- | -------------- |
| Expo SDK                     | 52.0.0         |
| React Native                 | 0.76.6         |
| breez-sdk-spark-react-native | 0.6.6          |
| Kotlin                       | 1.9.24         |
| Android minSdk               | 24             |
| iOS deployment target        | 13.4           |
