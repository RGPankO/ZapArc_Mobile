# Implementation Plan: Lightning Address Support

## Overview

This implementation plan breaks down the Lightning Address feature into discrete, incremental coding tasks. Each task builds on previous work and includes specific requirements references for traceability. The implementation follows the app's feature-based architecture and integrates with the existing Breez SDK service layer.

## Tasks

- [ ] 1. Extend Service Layer with Lightning Address Operations
  - Add TypeScript interfaces for Lightning Address data structures
  - Implement `checkLightningAddressAvailable()` function in breezSparkService.ts
  - Implement `registerLightningAddress()` function in breezSparkService.ts
  - Implement `getLightningAddress()` function in breezSparkService.ts
  - Implement `unregisterLightningAddress()` function in breezSparkService.ts
  - Add error handling for SDK not available scenarios
  - Add error handling for network failures
  - Export new functions from service module
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

- [ ] 1.1 Write property test for SDK unavailability error handling
  - **Property 2: SDK Unavailability Error Handling**
  - **Validates: Requirements 1.5, 5.4**
  - Test that all Lightning Address functions return errors/null when SDK is unavailable
  - Use fast-check to generate random function calls
  - Verify no unhandled exceptions are thrown
  - _Requirements: 1.5, 5.4_

- [ ] 2. Implement Local Storage Caching for Lightning Address
  - Add AsyncStorage key constant for Lightning Address info
  - Implement cache save function after successful registration
  - Implement cache load function for screen initialization
  - Implement cache clear function after unregistration
  - Add cache synchronization logic in service layer
  - Handle cache read/write errors gracefully
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 2.1 Write property test for persistence after registration
  - **Property 5: Persistence After Registration**
  - **Validates: Requirements 5.1**
  - Test that registered address is immediately available in local storage
  - Use fast-check to generate random Lightning Address data
  - Verify storage contains exact same data after registration
  - _Requirements: 5.1_

- [ ] 2.2 Write property test for SDK state authority
  - **Property 6: SDK State Authority**
  - **Validates: Requirements 5.3**
  - Test that SDK state always overrides local storage
  - Generate scenarios with mismatched SDK and storage states
  - Verify local storage is updated to match SDK
  - _Requirements: 5.3_

- [ ] 3. Implement Username Validation Logic
  - Create validation function for username format
  - Implement regex pattern matching: `^[a-z0-9][a-z0-9_-]{1,30}[a-z0-9]$`
  - Add length validation (3-32 characters)
  - Add empty/whitespace validation
  - Return descriptive error messages for each validation failure
  - Export validation function for use in UI
  - _Requirements: 2.1, 6.3_

- [ ] 3.1 Write property test for username validation consistency
  - **Property 1: Username Validation Consistency**
  - **Validates: Requirements 2.1, 6.3**
  - Test validation across many generated string inputs
  - Verify empty and whitespace-only strings are rejected
  - Verify invalid characters are rejected
  - Verify valid usernames are accepted
  - Use fast-check string generators
  - _Requirements: 2.1, 6.3_

- [ ] 4. Create Lightning Address Screen Component
  - Create new file: `src/features/profile/screens/LightningAddressScreen.tsx`
  - Set up component structure with React Native Paper components
  - Define state interface for screen (addressInfo, username, description, loading states, errors)
  - Implement useState hooks for all state variables
  - Add useEffect hook to load Lightning Address on mount
  - Create basic screen layout with conditional rendering for registered/unregistered states
  - Add navigation header configuration
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 7.1, 7.2, 7.3, 7.4_

- [ ] 4.1 Align Lightning Address UI with Receive/Invoice design
  - Review existing receive/invoice screen layout for spacing, typography, and card usage
  - Reuse the same QR code container sizing/background used in invoice generation
  - Reuse existing copy/share actions and confirmation patterns
  - Match error/loading banners and spinners to receive/invoice styles
  - _Requirements: 4.1.2, 4.1.3, 4.1.4, 4.1.6_

- [ ] 5. Implement Unregistered State UI
  - Add TextInput for username with validation feedback
  - Add TextInput for description (optional)
  - Add "Check Availability" button with loading state
  - Add "Register" button (disabled until username is available)
  - Implement availability indicator (checkmark/error icon)
  - Add inline validation error messages
  - Style components using React Native Paper theme
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 7.3_

- [ ] 6. Implement Availability Check Handler
  - Create `handleCheckAvailability` async function
  - Add client-side username validation before API call
  - Call `checkLightningAddressAvailable` from service layer
  - Update availability state based on response
  - Handle errors and display error messages
  - Add loading state management
  - Debounce availability checks (500ms delay)
  - _Requirements: 2.2, 2.3, 2.4, 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 7. Implement Registration Handler
  - Create `handleRegister` async function
  - Validate username and description inputs
  - Call `registerLightningAddress` from service layer
  - Update screen state to registered on success
  - Display success toast notification
  - Handle registration errors and display error messages
  - Add loading state management
  - Prevent duplicate submissions during registration
  - _Requirements: 2.5, 2.6, 2.7, 2.8, 6.1, 6.2, 6.4, 6.5_

- [ ] 8. Implement Registered State UI
  - Display full Lightning Address (username@domain) in Card component
  - Add QR code component using react-native-qrcode-svg
  - Add "Copy Address" button with clipboard integration
  - Add "Unregister" button (if SDK supports deletion)
  - Style components using React Native Paper theme
  - Add success message or status indicator
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 7.4_

- [ ] 8.1 Write property test for Lightning Address format consistency
  - **Property 3: Lightning Address Format Consistency**
  - **Validates: Requirements 3.1**
  - Test address formatting across many generated usernames and domains
  - Verify format is always `username@domain` with no extra characters
  - Use fast-check to generate random valid usernames
  - _Requirements: 3.1_

- [ ] 8.2 Write property test for QR code data integrity
  - **Property 4: QR Code Data Integrity**
  - **Validates: Requirements 3.2**
  - Test QR code round-trip (encode then decode)
  - Generate random Lightning Addresses
  - Verify decoded data matches original address exactly
  - _Requirements: 3.2_

- [ ] 9. Implement Copy to Clipboard Handler
  - Create `handleCopyAddress` async function
  - Use Expo Clipboard API to copy Lightning Address
  - Display confirmation toast after successful copy
  - Handle clipboard errors gracefully
  - _Requirements: 3.3, 3.4_

- [ ] 10. Implement Unregistration Handler
  - Create `handleUnregister` async function
  - Show confirmation dialog before unregistering
  - Call `unregisterLightningAddress` from service layer
  - Update screen state to unregistered on success
  - Clear local storage cache
  - Display success toast notification
  - Handle unregistration errors and display error messages
  - Add loading state management
  - _Requirements: 3.5, 3.6, 6.1, 6.2, 6.5_

- [ ] 11. Integrate Lightning Address Screen into Settings
  - Open `src/features/profile/screens/SettingsScreen.tsx`
  - Add new List.Item for "Lightning Address"
  - Add appropriate icon (lightning bolt or @ symbol)
  - Add navigation handler to route to Lightning Address screen
  - Add description text: "Manage your Lightning Address"
  - _Requirements: 4.1, 4.2_

- [ ] 11.1 Integrate Lightning Address entry into Receive/Invoice flow
  - Add Lightning Address entry point or mode selector in existing receive/invoice screen (`mobile-app/app/wallet/receive.tsx`)
  - Ensure navigation or mode switching uses the same pattern as existing receive mode selection
  - Verify Lightning Address mode uses receive/invoice layout and actions
  - _Requirements: 4.1.1, 4.1.2, 4.1.5, 4.1.6, 4.2.1, 4.2.2, 4.2.3, 4.2.4, 4.2.5_

- [ ] 11.2 Implement unobtrusive Receive prompt and restore behavior
  - Show a compact prompt when no Lightning Address is registered with a secondary "Claim address" action
  - Ensure invoice generation remains the primary visible action
  - On app start/restore, call `getLightningAddress()` and hydrate Receive/Settings state
  - _Requirements: 4.2.3, 4.2.4, 5.1.1, 5.1.2, 5.1.3_

- [ ] 12. Configure Navigation Routing
  - Add route definition for `/profile/lightning-address`
  - Configure route in appropriate router layout file
  - Link route to LightningAddressScreen component
  - Test navigation flow from Settings to Lightning Address screen
  - Verify back navigation preserves Settings screen state
  - _Requirements: 4.2, 4.3, 4.4_

- [ ] 13. Checkpoint - Ensure all tests pass
  - Run all unit tests and property tests
  - Verify no TypeScript compilation errors
  - Test manual flow: Settings → Lightning Address → Register → Copy → Unregister
  - Verify error handling for invalid usernames
  - Verify error handling for SDK not available
  - Ask the user if questions arise

- [ ] 14. Write unit tests for service layer functions
  - Mock Breez SDK responses for all Lightning Address operations
  - Test successful registration flow
  - Test successful availability check
  - Test successful address retrieval
  - Test successful unregistration
  - Test error handling for network failures
  - Test error handling for SDK errors
  - Test local storage caching behavior
  - _Requirements: 1.6, 1.7, 1.8, 1.9, 5.1, 5.2, 5.3, 6.1, 6.2_

- [ ] 15. Write unit tests for Lightning Address screen
  - Test username validation logic
  - Test availability check UI updates
  - Test registration success UI transition
  - Test registration error display
  - Test copy to clipboard functionality
  - Test unregistration flow
  - Test loading states during operations
  - Test button enable/disable logic
  - Test error message display
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.3, 3.4, 3.5, 3.6, 6.3, 6.4, 6.5_

- [ ] 16. Write integration tests for navigation
  - Test navigation from Settings to Lightning Address screen
  - Test back navigation preserves Settings state
  - Test screen initialization loads current address
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 17. Final checkpoint - Manual testing and verification
  - Perform complete manual testing flow per design document
  - Test registration with valid username
  - Test registration with invalid username
  - Test registration with taken username
  - Test receiving payment via Lightning Address
  - Test persistence across app restarts
  - Test QR code scanning
  - Test copy to clipboard
  - Test unregistration
  - Test offline error handling
  - Document any issues found
  - Ask the user if questions arise

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- Manual testing is essential for SDK-dependent features
- All code should follow existing app patterns and use TypeScript
- Use React Native Paper components for UI consistency
- Follow feature-based architecture: place files in appropriate feature directories
