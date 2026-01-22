# Design Document: Lightning Address Support

## Overview

This design document specifies the implementation of Lightning Address (LNURL) support for the zap-arc-mobile wallet application. Lightning Addresses provide users with human-readable payment identifiers (e.g., `username@breez.co`) that simplify receiving Lightning payments without generating invoices for each transaction.

The implementation integrates with the Breez SDK Spark (@breeztech/breez-sdk-spark-react-native v0.6.6) to leverage its built-in Lightning Address infrastructure. The feature follows the app's existing feature-based architecture and uses React Native Paper components for UI consistency.

**Key Design Decisions:**
- Use Breez's default domain (no custom domain configuration in MVP)
- Leverage Breez SDK's Lightning Address API (registerLightningAddress, checkLightningAddressAvailable, getLightningAddress, deleteLightningAddress)
- Store Lightning Address state locally using AsyncStorage for offline access
- Follow existing app patterns: service layer wraps SDK, screens handle UI, navigation via Expo Router
- Manual testing approach (no automated tests for SDK-dependent features per project guidelines)

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     UI Layer (React Native)                  │
│  ┌────────────────────┐      ┌──────────────────────────┐  │
│  │  SettingsScreen    │─────▶│ LightningAddressScreen   │  │
│  │  (Navigation)      │      │  (Management UI)         │  │
│  └────────────────────┘      └──────────────────────────┘  │
│                                        │                     │
└────────────────────────────────────────┼─────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         breezSparkService.ts                         │  │
│  │  • registerLightningAddress()                        │  │
│  │  • checkLightningAddressAvailable()                  │  │
│  │  • getLightningAddress()                             │  │
│  │  • unregisterLightningAddress()                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                    │
└─────────────────────────┼────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Breez SDK Spark (Native Module)                 │
│  • registerLightningAddress()                                │
│  • checkLightningAddressAvailable()                          │
│  • getLightningAddress()                                     │
│  • deleteLightningAddress()                                  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Local Storage (AsyncStorage)               │
│  • Cached Lightning Address state                            │
│  • Offline access to registered address                      │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

**UI Layer:**
- `SettingsScreen`: Provides navigation entry point to Lightning Address management
- `LightningAddressScreen`: Manages Lightning Address registration, display, and removal

**Service Layer:**
- `breezSparkService.ts`: Wraps Breez SDK Lightning Address operations, handles errors, manages local caching

**Storage Layer:**
- AsyncStorage: Persists Lightning Address state for offline access and quick loading

## Components and Interfaces

### Service Layer Extensions (breezSparkService.ts)

The service layer will be extended with the following functions:

```typescript
/**
 * Lightning Address information returned from SDK
 */
export interface LightningAddressInfo {
  lightningAddress: string;  // Full address: username@domain
  username: string;           // Username part only
  description: string;        // Description/display name
  lnurl: string;             // LNURL representation
}

/**
 * Check if a Lightning Address username is available
 * @param username - Desired username (without @domain)
 * @returns Promise<boolean> - true if available, false if taken
 */
export async function checkLightningAddressAvailable(
  username: string
): Promise<boolean>

/**
 * Register a Lightning Address
 * @param username - Desired username (without @domain)
 * @param description - Optional description for the address
 * @returns Promise<LightningAddressInfo> - Registered address information
 * @throws Error if registration fails
 */
export async function registerLightningAddress(
  username: string,
  description?: string
): Promise<LightningAddressInfo>

/**
 * Get currently registered Lightning Address
 * @returns Promise<LightningAddressInfo | null> - Address info or null if not registered
 */
export async function getLightningAddress(): Promise<LightningAddressInfo | null>

/**
 * Unregister/delete the current Lightning Address
 * @returns Promise<void>
 * @throws Error if deletion fails
 */
export async function unregisterLightningAddress(): Promise<void>
```

**Implementation Notes:**
- All functions check `isNativeAvailable()` and `isSDKInitialized()` before proceeding
- Errors from Breez SDK are caught and re-thrown with user-friendly messages
- Local cache (AsyncStorage) is updated after successful operations
- Cache key: `@lightning_address_info`

### UI Components

#### LightningAddressScreen

**Location:** `src/features/profile/screens/LightningAddressScreen.tsx`

**State Management:**
```typescript
interface LightningAddressScreenState {
  // Current address info (null if not registered)
  addressInfo: LightningAddressInfo | null;
  
  // Input state
  username: string;
  description: string;
  
  // UI state
  isLoading: boolean;
  isCheckingAvailability: boolean;
  isRegistering: boolean;
  isUnregistering: boolean;
  
  // Validation state
  isAvailable: boolean | null;  // null = not checked, true = available, false = taken
  validationError: string | null;
  
  // Error state
  error: string | null;
}
```

**UI States:**

1. **Unregistered State:**
   - Text input for username
   - Text input for description (optional)
   - "Check Availability" button
   - "Register" button (enabled only if username is available)
   - Validation feedback (available/unavailable/error)

2. **Registered State:**
   - Display full Lightning Address (username@domain)
   - QR code showing the Lightning Address
   - "Copy Address" button
   - "Unregister" button (if SDK supports deletion)
   - Success message

3. **Loading States:**
   - Spinner overlay during operations
   - Disabled buttons during operations
   - Loading text feedback

#### Receive Flow Integration

**Location (entry points):**
- Existing receive/invoice screen (add Lightning Address mode/entry): `mobile-app/app/wallet/receive.tsx`
- Settings (secondary entry for management)

**Design Alignment Notes:**
- The Lightning Address UI should mirror the invoice generation screen's layout rhythm (card spacing, padding, typography) so switching feels seamless.
- Reuse the same QR code sizing, background, and container styling used for invoice QR display.
- Reuse existing copy/share actions and confirmation/toast patterns from invoice generation.
- Mode selection should use the same control pattern already established for receive mode selection (if one exists); otherwise add a minimal toggle/segmented control that matches the app's established styling.
- Error and loading states should reuse the same banner/spinner styles used in invoice generation.

**Receive Screen References (current invoice flow):**
- Header title: "Deposit Funds"
- QR sizing and container: 240px QR size, 16px padding, white background, 12px radius
- Copy action: "Copy" outlined button styled with `#FFC107`
- Share action: uses Expo Sharing with copy fallback

**Receive Screen UX (Lightning Address):**
- Invoice remains the primary flow; Lightning Address is a secondary mode or card.
- If address is registered: show an address card with `username@domain`, QR, one-tap Copy, and a "Manage" link.
- If address is not registered: show a compact prompt card with short copy and a secondary-style "Claim address" action; do not reduce the visibility of "Generate Invoice".
- Use a low-friction mode selector (toggle/segmented control) near the top to switch between Invoice and Lightning Address, matching existing visual patterns.

**Restore Behavior:**
- On wallet restore or app startup, call `getLightningAddress()` and hydrate state.
- If an address is returned by the SDK, show it immediately in Receive and Settings.
- If none is returned, show the unobtrusive prompt.

**Receive Screen Sketch (proposed):**

```
Deposit Funds
[Invoice] [Lightning Address]   <-- segmented control (matches app pattern)

-- Invoice Mode (primary) --
Amount input + presets
Description input
[Generate Invoice]  (primary CTA)

Lightning Address (secondary card)
If registered:
  alice@breez.co
  [Copy] [Manage]
If not registered:
  Get a Lightning Address to receive without invoices.
  [Claim address]  (secondary/outlined)
```

**Copy Suggestions (unobtrusive):**
- Title: "Lightning Address"
- Empty state: "Get a Lightning Address to receive without invoices."
- Action: "Claim address"
- Registered state actions: "Copy", "Manage"

**Key Functions:**
```typescript
// Load current address on mount
useEffect(() => {
  loadLightningAddress();
}, []);

// Check username availability
const handleCheckAvailability = async () => {
  // Validate username format
  // Call service layer
  // Update availability state
};

// Register new address
const handleRegister = async () => {
  // Validate inputs
  // Call service layer
  // Update state to registered
  // Show success message
};

// Copy address to clipboard
const handleCopyAddress = async () => {
  // Copy to clipboard
  // Show confirmation toast
};

// Unregister address
const handleUnregister = async () => {
  // Show confirmation dialog
  // Call service layer
  // Update state to unregistered
};
```

#### Settings Screen Integration

**Location:** `src/features/profile/screens/SettingsScreen.tsx`

**Changes:**
- Add new menu item: "Lightning Address"
- Icon: lightning bolt or @ symbol
- Navigation: Routes to `/profile/lightning-address`

**Example Integration:**
```typescript
<List.Item
  title="Lightning Address"
  description="Manage your Lightning Address"
  left={(props) => <List.Icon {...props} icon="at" />}
  onPress={() => router.push('/profile/lightning-address')}
/>
```

### Navigation

**Route:** `/profile/lightning-address`

**Router Configuration:**
- Add route in `app/(tabs)/profile/_layout.tsx` or appropriate router file
- Screen component: `LightningAddressScreen`

## Data Models

### Lightning Address Information

```typescript
interface LightningAddressInfo {
  lightningAddress: string;  // e.g., "alice@breez.co"
  username: string;           // e.g., "alice"
  description: string;        // e.g., "Alice's Wallet"
  lnurl: string;             // LNURL representation
}
```

### Local Storage Schema

**Key:** `@lightning_address_info`

**Value:** JSON string of `LightningAddressInfo | null`

**Purpose:**
- Cache registered address for offline access
- Quick loading on screen mount
- Sync with SDK on app restart

### Username Validation Rules

Based on typical Lightning Address standards:
- Minimum length: 3 characters
- Maximum length: 32 characters
- Allowed characters: lowercase letters, numbers, hyphens, underscores
- Must start with a letter or number
- No consecutive special characters
- Regex pattern: `^[a-z0-9][a-z0-9_-]{1,30}[a-z0-9]$`

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Username Validation Consistency

*For any* string input, the username validation function should reject empty strings, whitespace-only strings, and strings containing invalid characters (anything not matching the pattern `^[a-z0-9][a-z0-9_-]{1,30}[a-z0-9]$`), and should accept valid usernames.

**Validates: Requirements 2.1, 6.3**

### Property 2: SDK Unavailability Error Handling

*For any* Lightning Address service function (register, check availability, get address, unregister), when the SDK is not initialized or not available, the function should return an appropriate error or null value without throwing an unhandled exception.

**Validates: Requirements 1.5, 5.4**

### Property 3: Lightning Address Format Consistency

*For any* valid username and domain, the displayed Lightning Address should always be formatted as `username@domain` with no extra whitespace or special characters.

**Validates: Requirements 3.1**

### Property 4: QR Code Data Integrity

*For any* registered Lightning Address, the generated QR code should encode the complete Lightning Address string, and decoding the QR code should return the exact same address.

**Validates: Requirements 3.2**

### Property 5: Persistence After Registration

*For any* successfully registered Lightning Address, querying local storage immediately after registration should return the same Lightning Address information.

**Validates: Requirements 5.1**

### Property 6: SDK State Authority

*For any* scenario where local storage contains a different Lightning Address than the SDK reports, the service layer should update local storage to match the SDK state (SDK is the source of truth).

**Validates: Requirements 5.3**

## Error Handling

### Error Categories

1. **SDK Not Available Errors**
   - Scenario: Native module not loaded (Expo Go) or SDK not initialized
   - Handling: Return null or throw descriptive error
   - User Message: "Lightning features require a development build. Please build the app with: npx expo run:android"

2. **Network Errors**
   - Scenario: No internet connection during registration/availability check
   - Handling: Catch network exceptions from SDK
   - User Message: "Network error. Please check your connection and try again."

3. **Username Validation Errors**
   - Scenario: Invalid username format
   - Handling: Client-side validation before SDK call
   - User Messages:
     - "Username must be 3-32 characters"
     - "Username can only contain letters, numbers, hyphens, and underscores"
     - "Username must start and end with a letter or number"

4. **Username Unavailable Errors**
   - Scenario: Desired username is already taken
   - Handling: Display availability status from SDK
   - User Message: "This username is already taken. Please try another."

5. **Registration Errors**
   - Scenario: SDK returns error during registration
   - Handling: Display SDK error message
   - User Message: SDK error message or "Registration failed. Please try again."

6. **Unregistration Errors**
   - Scenario: SDK returns error during deletion
   - Handling: Display SDK error message
   - User Message: "Failed to unregister address. Please try again."

### Error Handling Strategy

```typescript
try {
  // SDK operation
  const result = await sdkInstance.registerLightningAddress(request);
  return result;
} catch (error) {
  console.error('[LightningAddress] Registration failed:', error);
  
  // Extract user-friendly message
  const message = error instanceof Error 
    ? error.message 
    : 'Registration failed. Please try again.';
  
  throw new Error(message);
}
```

### User Feedback

- **Success:** Toast notification with success message
- **Errors:** Alert dialog or inline error message with retry option
- **Loading:** Spinner with descriptive text ("Checking availability...", "Registering address...")

## Testing Strategy

### Dual Testing Approach

This feature will use a combination of unit tests and property-based tests:

**Unit Tests:**
- Specific examples of valid and invalid usernames
- SDK integration mocking (verify service calls SDK correctly)
- UI state transitions (unregistered → registered)
- Error handling scenarios (network errors, SDK errors)
- Navigation integration

**Property-Based Tests:**
- Username validation across many generated inputs
- Address format consistency
- QR code round-trip integrity
- Error handling for unavailable SDK

### Property-Based Testing Configuration

**Library:** fast-check (JavaScript/TypeScript property-based testing library)

**Configuration:**
- Minimum 100 iterations per property test
- Each test tagged with feature name and property number
- Tag format: `Feature: lightning-address-support, Property {N}: {property description}`

**Example Property Test:**
```typescript
import fc from 'fast-check';

describe('Lightning Address Properties', () => {
  it('Property 1: Username Validation Consistency', () => {
    // Feature: lightning-address-support, Property 1: Username Validation Consistency
    fc.assert(
      fc.property(
        fc.string(),
        (input) => {
          const isValid = validateUsername(input);
          const matchesPattern = /^[a-z0-9][a-z0-9_-]{1,30}[a-z0-9]$/.test(input);
          
          // Valid usernames must match pattern
          if (isValid) {
            expect(matchesPattern).toBe(true);
          }
          
          // Empty or whitespace-only strings must be invalid
          if (input.trim().length === 0) {
            expect(isValid).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Manual Testing Plan

Since this feature depends heavily on the Breez SDK (native module), manual testing is essential:

**Test Cases:**

1. **Registration Flow**
   - Open Settings → Lightning Address
   - Enter username, click "Check Availability"
   - Verify availability indicator shows correct status
   - Click "Register"
   - Verify success message and transition to registered state
   - Verify QR code displays correctly

2. **Receiving Payments**
   - Share Lightning Address with another wallet
   - Send payment from other wallet to Lightning Address
   - Verify payment appears in transaction history

3. **Persistence**
   - Register Lightning Address
   - Close and restart app
   - Open Lightning Address screen
   - Verify address still shows as registered

4. **Error Handling**
   - Try registering with invalid username (too short, special characters)
   - Try registering with taken username
   - Try operations with no internet connection
   - Verify appropriate error messages display

5. **Unregistration**
   - Register address
   - Click "Unregister"
   - Confirm deletion
   - Verify transition back to unregistered state

6. **QR Code Scanning**
   - Register address
   - Scan QR code with another device
   - Verify scanned data matches Lightning Address

### Unit Test Coverage

**Service Layer Tests:**
- Mock Breez SDK responses
- Test error handling for SDK not available
- Test error handling for network failures
- Test local storage caching
- Test state synchronization

**UI Tests:**
- Test username validation logic
- Test state transitions
- Test button enable/disable logic
- Test error message display
- Test loading states

**Integration Tests:**
- Test navigation from Settings to Lightning Address screen
- Test clipboard copy functionality
- Test QR code generation

### Test File Locations

```
src/services/__tests__/breezSparkService.lightningAddress.test.ts
src/features/profile/screens/__tests__/LightningAddressScreen.test.tsx
src/features/profile/screens/__tests__/LightningAddressScreen.properties.test.ts
```

## Implementation Notes

### Breez SDK Integration

The Breez SDK Spark provides the following Lightning Address methods (based on [official documentation](https://sdk-doc-spark.breez.technology/guide/receive_lnurl_pay.html)):

```typescript
// Check availability
const request = { username };
const available = await sdk.checkLightningAddressAvailable(request);

// Register address
const request = { username, description };
const addressInfo = await sdk.registerLightningAddress(request);
// Returns: { lightningAddress, username, description, lnurl }

// Get current address
const addressInfo = await sdk.getLightningAddress();
// Returns: LightningAddressInfo | null

// Delete address
await sdk.deleteLightningAddress();
```

**Important:** The SDK uses Breez's default domain. Custom domain configuration requires DNS setup and is out of scope for this MVP.

### QR Code Generation

Use `react-native-qrcode-svg` library (likely already in dependencies):

```typescript
import QRCode from 'react-native-qrcode-svg';

<QRCode
  value={addressInfo.lightningAddress}
  size={200}
  backgroundColor="white"
  color="black"
/>
```

### Clipboard Integration

Use Expo's Clipboard API:

```typescript
import * as Clipboard from 'expo-clipboard';

const handleCopyAddress = async () => {
  await Clipboard.setStringAsync(addressInfo.lightningAddress);
  // Show toast confirmation
};
```

### AsyncStorage Integration

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@lightning_address_info';

// Save
await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(addressInfo));

// Load
const cached = await AsyncStorage.getItem(STORAGE_KEY);
const addressInfo = cached ? JSON.parse(cached) : null;

// Clear
await AsyncStorage.removeItem(STORAGE_KEY);
```

### Styling Considerations

- Use React Native Paper components: `TextInput`, `Button`, `Card`, `Text`, `ActivityIndicator`
- Follow existing app theme (colors, spacing, typography)
- Responsive layout for different screen sizes
- Accessibility: proper labels, contrast ratios, touch targets

### Performance Considerations

- Debounce username input for availability checking (avoid excessive API calls)
- Cache QR code generation result
- Lazy load QR code library
- Optimize re-renders with React.memo where appropriate

## Future Enhancements

These features are out of scope for the MVP but could be added later:

1. **Custom Domain Support**
   - Allow users to configure custom domains
   - Requires DNS setup and coordination with Breez

2. **Multiple Addresses**
   - Support registering multiple Lightning Addresses
   - Address selection/switching UI

3. **Address Analytics**
   - Track payments received via Lightning Address
   - Display statistics and history

4. **Nostr Integration**
   - Link Lightning Address to Nostr identity
   - Support Nostr Zaps (NIP-57)

5. **Address Sharing**
   - Share QR code via social media
   - Generate shareable links

6. **Address Customization**
   - Update description without changing username
   - Custom QR code styling
