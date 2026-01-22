# Requirements Document: Lightning Address Support

## Introduction

This document specifies the requirements for adding Lightning Address (LNURL) support to the zap-arc-mobile wallet application. Lightning Addresses provide a human-readable payment identifier (e.g., username@breez.co) that simplifies receiving Lightning payments without generating invoices for each transaction.

The feature integrates with the Breez SDK Spark (@breeztech/breez-sdk-spark-react-native v0.6.6) to register and manage Lightning Addresses, and provides a user interface for address management within the existing React Native Expo application.

## Glossary

- **Lightning_Address**: A human-readable identifier in email format (username@domain) that resolves to Lightning payment endpoints
- **Breez_SDK**: The Breez SDK Spark library that provides Lightning Network functionality
- **Service_Layer**: The breezSparkService.ts module that wraps Breez SDK operations
- **Settings_Screen**: The existing profile settings interface where Lightning Address management is accessed
- **Lightning_Address_Screen**: The new screen for registering and managing Lightning Addresses
- **Username**: The local part of a Lightning Address (before the @ symbol)
- **Registration**: The process of claiming a Lightning Address through the Breez SDK
- **QR_Code**: A visual representation of the Lightning Address for easy sharing

## Requirements

### Requirement 1: Service Layer Integration

**User Story:** As a developer, I want Lightning Address operations exposed through the service layer, so that the UI can interact with Breez SDK Lightning Address functionality.

#### Acceptance Criteria

1. THE Service_Layer SHALL expose a registerLightningAddress function that accepts username and description parameters
2. THE Service_Layer SHALL expose a checkLightningAddressAvailable function that accepts a username parameter
3. THE Service_Layer SHALL expose a getLightningAddress function that returns the currently registered Lightning Address
4. THE Service_Layer SHALL expose an unregisterLightningAddress function that removes the registered address
5. WHEN any Lightning Address function is called and the SDK is not initialized, THEN THE Service_Layer SHALL return an appropriate error or null value
6. WHEN registerLightningAddress is called with valid parameters, THEN THE Service_Layer SHALL invoke the corresponding Breez SDK method and return the result
7. WHEN checkLightningAddressAvailable is called, THEN THE Service_Layer SHALL query the Breez SDK and return availability status
8. WHEN getLightningAddress is called, THEN THE Service_Layer SHALL retrieve the current address from the Breez SDK
9. WHEN unregisterLightningAddress is called, THEN THE Service_Layer SHALL remove the address via the Breez SDK if supported

### Requirement 2: Lightning Address Registration

**User Story:** As a wallet user, I want to register a Lightning Address with my chosen username, so that I can receive payments using a memorable identifier.

#### Acceptance Criteria

1. WHEN a user enters a desired username, THEN THE Lightning_Address_Screen SHALL validate that the username is not empty
2. WHEN a user clicks "Check Availability", THEN THE Lightning_Address_Screen SHALL query the Service_Layer for username availability
3. WHEN the username is available, THEN THE Lightning_Address_Screen SHALL display a success indicator
4. WHEN the username is unavailable, THEN THE Lightning_Address_Screen SHALL display an error message indicating the username is taken
5. WHEN a user clicks "Register" with an available username, THEN THE Lightning_Address_Screen SHALL call the Service_Layer to register the address
6. WHEN registration succeeds, THEN THE Lightning_Address_Screen SHALL transition to the registered state and display the full Lightning Address
7. WHEN registration fails, THEN THE Lightning_Address_Screen SHALL display an error message with failure details
8. WHILE registration is in progress, THEN THE Lightning_Address_Screen SHALL display a loading indicator and disable input controls

### Requirement 3: Lightning Address Display and Management

**User Story:** As a wallet user, I want to view and share my registered Lightning Address, so that others can send me payments.

#### Acceptance Criteria

1. WHEN a Lightning Address is registered, THEN THE Lightning_Address_Screen SHALL display the complete address in the format username@domain
2. WHEN a Lightning Address is registered, THEN THE Lightning_Address_Screen SHALL generate and display a QR code containing the address
3. WHEN a user views their registered address, THEN THE Lightning_Address_Screen SHALL provide a copy-to-clipboard action
4. WHEN a user copies the address, THEN THE Lightning_Address_Screen SHALL display a confirmation message
5. IF the Breez SDK supports address removal, THEN THE Lightning_Address_Screen SHALL provide an unregister option
6. WHEN a user unregisters their address, THEN THE Lightning_Address_Screen SHALL transition back to the unregistered state

### Requirement 4: Navigation and Settings Integration

**User Story:** As a wallet user, I want to access Lightning Address management from the settings menu, so that I can easily find and configure my address.

#### Acceptance Criteria

1. THE Settings_Screen SHALL display a "Lightning Address" menu item
2. WHEN a user taps the "Lightning Address" menu item, THEN THE Settings_Screen SHALL navigate to the Lightning_Address_Screen
3. WHEN navigation occurs, THEN THE Lightning_Address_Screen SHALL load the current Lightning Address state from the Service_Layer
4. WHEN the user navigates back from the Lightning_Address_Screen, THEN THE Settings_Screen SHALL remain in its previous state

### Requirement 4.1: Receive Flow Integration

**User Story:** As a wallet user, I want Lightning Address management to fit alongside invoice-based receiving, so that the experience feels consistent with the existing receive flow.

#### Acceptance Criteria

1. THE Lightning Address entry point SHALL be accessible from the existing receive/invoice area in addition to Settings (Receive screen: `mobile-app/app/wallet/receive.tsx`)
2. WHEN a user accesses Lightning Address from the receive/invoice area, THEN THE screen SHALL match the same visual hierarchy and spacing used by invoice generation
3. THE Lightning Address screen SHALL reuse the same QR code presentation style used by invoice generation (size, padding, background)
4. THE Lightning Address screen SHALL reuse existing copy/share actions and confirmation patterns from invoice generation
5. WHEN the user switches between invoice receiving and Lightning Address receiving, THEN THE UI SHALL use the same control pattern already established for receive mode selection; if none exists, a new control SHALL be added to the Receive screen
6. WHEN Lightning Address is unavailable or loading, THEN THE error and loading UI SHALL match the receive/invoice styles

### Requirement 4.2: Receive Screen State and CTA Behavior

**User Story:** As a wallet user, I want the Receive screen to make invoices the primary flow while still letting me easily copy or create a Lightning Address.

#### Acceptance Criteria

1. WHEN a Lightning Address is registered, THEN the Receive screen SHALL display the address and a one-tap "Copy" action without requiring navigation to Settings
2. WHEN a Lightning Address is registered, THEN the Receive screen SHALL allow switching between invoice and Lightning Address modes using a clear, low-friction control
3. WHEN no Lightning Address is registered, THEN the Receive screen SHALL show an unobtrusive prompt with a secondary-style action that links to registration
4. THE unobtrusive prompt SHALL not block invoice generation or reduce the visibility of the primary "Generate Invoice" action
5. WHEN a Lightning Address is registered, THEN the Receive screen SHALL show a "Manage" link that navigates to the Lightning Address management screen

### Requirement 5.1: Restore and Reconciliation Behavior

**User Story:** As a wallet user, I want my Lightning Address to appear after restoring my wallet, so that I can keep using the same address if supported by the SDK.

#### Acceptance Criteria

1. WHEN the wallet is restored, THEN the app SHALL attempt to load the Lightning Address from the SDK using getLightningAddress
2. IF the SDK returns a Lightning Address on restore, THEN the app SHALL display it in the Receive screen and Settings
3. IF the SDK returns no Lightning Address on restore, THEN the app SHALL show the unobtrusive registration prompt in the Receive screen

### Requirement 5: Data Persistence and Synchronization

**User Story:** As a wallet user, I want my Lightning Address to persist across app restarts, so that I don't need to re-register after closing the app.

#### Acceptance Criteria

1. WHEN a Lightning Address is registered, THEN THE Service_Layer SHALL store the address state locally
2. WHEN the app restarts, THEN THE Service_Layer SHALL synchronize the local Lightning Address state with the Breez SDK
3. WHEN the SDK reports a different address than local storage, THEN THE Service_Layer SHALL update local storage to match the SDK state
4. WHEN the app is offline and Lightning Address operations are attempted, THEN THE Service_Layer SHALL return appropriate offline error messages
5. WHEN the app regains connectivity, THEN THE Service_Layer SHALL synchronize any pending Lightning Address state changes

### Requirement 6: Error Handling and User Feedback

**User Story:** As a wallet user, I want clear error messages when Lightning Address operations fail, so that I understand what went wrong and how to fix it.

#### Acceptance Criteria

1. WHEN a network error occurs during registration, THEN THE Lightning_Address_Screen SHALL display a user-friendly network error message
2. WHEN the SDK returns an error, THEN THE Lightning_Address_Screen SHALL display the error message from the SDK
3. WHEN a username contains invalid characters, THEN THE Lightning_Address_Screen SHALL display a validation error before attempting registration
4. WHEN the SDK is not initialized, THEN THE Lightning_Address_Screen SHALL display a message indicating the wallet must be initialized first
5. WHEN any operation is in progress, THEN THE Lightning_Address_Screen SHALL prevent duplicate submissions by disabling action buttons

### Requirement 7: User Interface Design

**User Story:** As a wallet user, I want a clean and intuitive Lightning Address interface, so that I can easily register and manage my address.

#### Acceptance Criteria

1. THE Lightning_Address_Screen SHALL follow the existing app design patterns using React Native Paper components
2. THE Lightning_Address_Screen SHALL display different UI states for unregistered and registered addresses
3. WHEN no address is registered, THEN THE Lightning_Address_Screen SHALL display an input field, availability check button, and register button
4. WHEN an address is registered, THEN THE Lightning_Address_Screen SHALL display the address, QR code, and management options
5. THE Lightning_Address_Screen SHALL use consistent spacing, typography, and colors with the rest of the application
6. THE Lightning_Address_Screen SHALL be responsive and work correctly on different screen sizes

### Requirement 8: Testing and Verification

**User Story:** As a developer, I want a testing strategy for Lightning Address functionality, so that I can verify the feature works correctly.

#### Acceptance Criteria

1. THE testing strategy SHALL include manual verification steps for the registration flow
2. THE testing strategy SHALL include verification of receiving payments via Lightning Address
3. THE testing strategy SHALL include verification of persistence across app restarts
4. THE testing strategy SHALL include verification of error handling scenarios
5. THE testing strategy SHALL document that automated tests are not required for SDK-dependent features
6. THE testing strategy SHALL provide clear steps for testing availability checking
7. THE testing strategy SHALL provide clear steps for testing QR code generation
