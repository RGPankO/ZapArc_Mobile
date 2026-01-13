# Design Document: Settings Routes Fix

## Overview

This design addresses the missing Expo Router route files for the wallet settings section and fixes a navigation bug in the unlock screen. The implementation involves:
1. Creating simple route files that export existing screen components
2. Implementing one new screen component (CurrencySettingsScreen) that is completely missing
3. Fixing the "Switch Wallet" navigation path in PinEntryScreen
4. Removing legacy BGN currency support (EUR is the national currency)

## Architecture

The Expo Router file-based routing system requires route files in the `app/` directory that export React components. The actual screen implementations live in `src/features/wallet/screens/settings/`. The settings routes use the parent wallet stack defined in `app/wallet/_layout.tsx` (there is no `_layout.tsx` inside `app/wallet/settings/`).

```
app/wallet/settings/
├── language.tsx              ✔ EXISTS
├── theme.tsx                 ✔ EXISTS
├── notifications.tsx         ✔ EXISTS
├── wallet-config.tsx         ✖ NEEDS CREATION (route only)
├── amounts.tsx               ✖ NEEDS CREATION (route only)
├── security.tsx              ✖ NEEDS CREATION (route only)
├── backup.tsx                ✖ NEEDS CREATION (route only)
└── currency.tsx              ✖ NEEDS CREATION (route + screen)

src/features/wallet/screens/settings/
├── index.ts                  (barrel export)
├── WalletConfigScreen.tsx    ✔ EXISTS
├── AmountsSettingsScreen.tsx ✔ EXISTS
├── SecuritySettingsScreen.tsx✔ EXISTS
├── BackupScreen.tsx          ✔ EXISTS
├── LanguageSettingsScreen.tsx✔ EXISTS
├── AppPreferencesScreen.tsx  ✔ EXISTS (ThemeSettingsScreen)
├── NotificationsSettingsScreen.tsx ✔ EXISTS
├── DomainManagementScreen.tsx✔ EXISTS
├── BlacklistScreen.tsx       ✔ EXISTS
└── CurrencySettingsScreen.tsx✖ NEEDS CREATION
```

## Components and Interfaces

### Route File Pattern

Each route file follows the same simple pattern used by existing routes:

```typescript
// app/wallet/settings/{route-name}.tsx
import { ScreenComponent } from '../../../src/features/wallet/screens/settings';

export default ScreenComponent;
```

### CurrencySettingsScreen Component

New screen component for currency selection:

```typescript
interface CurrencyOption {
  value: 'btc' | 'sats' | 'usd' | 'eur';
  label: string;
  symbol: string;
  description: string;
}

const CURRENCY_OPTIONS: CurrencyOption[] = [
  { value: 'sats', label: 'Satoshis', symbol: 'sats', description: 'Bitcoin smallest unit (1 BTC = 100M sats)' },
  { value: 'btc', label: 'Bitcoin', symbol: 'BTC', description: 'Display in whole Bitcoin' },
  { value: 'usd', label: 'US Dollar', symbol: 'USD', description: 'Convert to USD equivalent' },
  { value: 'eur', label: 'Euro', symbol: 'EUR', description: 'Convert to EUR equivalent' },
];
```

The screen will:
1. Load current currency setting from useSettings hook
2. Display radio button list of currency options
3. Save selection on user confirmation
4. Navigate back to settings hub

## Data Models

### Settings Type Extension

The existing UserSettings type in `src/features/settings/types.ts` includes:

```typescript
interface UserSettings {
  // ... existing fields
  currency?: 'btc' | 'sats' | 'usd' | 'eur';
}
```

Action required: remove legacy `bgn` from the `CurrencyCode` union and from any option lists so BGN is no longer surfaced.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do.*

### Property 1: Route Navigation Consistency

*For any* settings menu item that navigates to a route, tapping that item SHALL successfully render the corresponding screen component without errors.

**Validates: Requirements 1.1, 2.1, 3.1, 4.1, 5.1**

### Property 2: Currency Selection Persistence

*For any* valid currency option selected by the user, saving the selection and reopening the currency settings screen SHALL display the previously selected option as active.

**Validates: Requirements 5.4**

### Property 3: Route Export Correctness

*For any* route file in `app/wallet/settings/`, the default export SHALL be a valid React component that renders without throwing errors.

**Validates: Requirements 1.3, 2.3, 3.3, 4.3, 5.6**

### Property 4: Switch Wallet Navigation

*For any* user on the PinEntryScreen, tapping "Switch Wallet" SHALL navigate to the WalletSelectionScreen showing all available wallets.

**Validates: Requirements 6.1, 6.2, 6.3**

## Error Handling

### Navigation Errors
- If a screen component fails to load, Expo Router will display its default error boundary
- Screen components should handle their own internal errors gracefully

### Settings Persistence Errors
- CurrencySettingsScreen will display an error alert if settings fail to save
- User can retry or cancel the operation

## Navigation Bug Fix

### PinEntryScreen Switch Wallet Button

Current code (line ~232):
```typescript
onPress={() => router.push('/wallet/select')}
```

Fixed code:
```typescript
onPress={() => router.push('/wallet/selection')}
```

The route file exists at `app/wallet/selection.tsx` which exports `WalletSelectionScreen`.

### Main Wallet Deletion

When a user deletes the main wallet, the flow should present `WalletSelectionScreen` so the user can pick another wallet to continue.

## Testing Strategy

### Unit Tests
- Verify CurrencySettingsScreen renders all currency options
- Verify currency selection updates local state
- Verify save operation calls updateSettings with correct value

### Integration Tests
- Navigate from WalletSettingsScreen to each settings route
- Verify each route renders the correct screen component
- Verify back navigation returns to settings hub

### Manual Testing
- Test each settings route on iOS and Android
- Verify currency changes reflect throughout the app
