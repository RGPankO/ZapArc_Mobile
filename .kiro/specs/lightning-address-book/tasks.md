# Implementation Plan: Lightning Address Book

## Overview

This implementation plan breaks down the Lightning Address Book feature into discrete, incremental coding tasks. Each task builds on previous work, with testing integrated throughout to catch errors early. The implementation follows a bottom-up approach: data layer → business logic → UI components → integration.

## Tasks

- [ ] 1. Set up feature structure and core types
  - Create feature directory structure under `src/features/addressBook/`
  - Define TypeScript interfaces in `types/contact.types.ts` (Contact, CreateContactInput, UpdateContactInput, ValidationResult, ValidationError)
  - Set up test directories and configure Jest for the feature
  - Install fast-check for property-based testing: `npm install --save-dev fast-check`
  - _Requirements: All (foundational)_

- [ ] 2. Implement contact storage layer
  - [ ] 2.1 Create ContactStorage module
    - Implement `contactStorage.ts` with loadContacts, saveContacts, and clearContacts functions
    - Use AsyncStorage with key `@zap-arc:contacts`
    - Handle JSON serialization/deserialization with error handling
    - Return empty array on load failure, log errors
    - _Requirements: 5.1, 5.2, 5.4_

  - [ ] 2.2 Write property test for storage serialization
    - **Property 16: Serialization round-trip preserves data**
    - **Validates: Requirements 5.4**
    - Generate random contacts, save to storage, load back, verify data intact

  - [ ] 2.3 Write property test for storage persistence
    - **Property 14: Contacts persist across app restarts**
    - **Validates: Requirements 5.2**
    - Save contacts, simulate restart (clear cache), load, verify same contacts returned

  - [ ] 2.4 Write unit tests for storage error handling
    - Test corrupted JSON handling (Property 17)
    - Test AsyncStorage failure handling (Property 15)
    - Test empty storage load
    - _Requirements: 5.3, 5.5_

- [ ] 3. Implement contact validation logic
- [ ] 3.1 Create ContactValidator module
    - Implement `contactValidator.ts` with validation functions
    - Implement validateLightningAddress with regex pattern `^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`
    - Trim whitespace before validation and normalize to lowercase for duplicate checks
    - Implement validateName (1-100 chars, non-empty after trim)
    - Implement validateNotes (optional, max 500 chars)
    - Implement validateContactInput for complete validation
    - Return ValidationResult with descriptive error messages
    - _Requirements: 1.2, 1.3, 7.1, 8.1, 8.2, 10.3_

- [ ] 3.2 Write property test for Lightning Address validation
    - **Property 2: Invalid Lightning Addresses are rejected**
    - **Property 21: Lightning Address validation is comprehensive**
    - **Validates: Requirements 1.2, 7.1, 7.2, 7.3**
    - Generate valid addresses that match the regex and invalid addresses that do not

  - [ ] 3.3 Write property test for display name validation
    - **Property 3: Invalid display names are rejected**
    - **Property 22: Display name validation is comprehensive**
    - **Validates: Requirements 1.3, 8.1, 8.2, 8.3**
    - Generate names of various lengths and whitespace patterns

  - [ ] 3.4 Write unit tests for validation edge cases
    - Test specific invalid Lightning Address formats (no @, multiple @, no domain, etc.)
    - Test maximum length names (100 chars)
    - Test maximum length notes (500 chars)
    - Test whitespace-only names
    - _Requirements: 7.2, 7.3, 8.1, 8.3, 10.3_

- [ ] 4. Implement contact service (CRUD operations)
  - [ ] 4.1 Create ContactService module
    - Implement `contactService.ts` with all CRUD functions
    - Implement getAllContacts, getContactById, searchContacts
    - Implement createContact (generate UUID, timestamps, validate, check duplicates)
    - Implement updateContact (validate, check duplicates excluding self, update timestamp)
    - Implement deleteContact (verify exists, remove from storage)
    - Implement addressExists helper for duplicate detection (case-insensitive)
    - Use uuid library for ID generation: `npm install uuid && npm install --save-dev @types/uuid`
    - _Requirements: 1.1, 1.4, 1.5, 2.2, 3.1, 3.2, 3.4, 3.5, 4.1_

  - [ ] 4.2 Write property test for contact creation
    - **Property 1: Valid contact creation persists correctly**
    - **Validates: Requirements 1.1**
    - Generate random valid contacts, create them, verify they exist in storage with correct data

  - [ ] 4.3 Write property test for duplicate prevention
    - **Property 4: Duplicate Lightning Addresses are prevented**
    - **Validates: Requirements 1.4**
    - Create contact, attempt to create another with same address (various cases), verify rejection

  - [ ] 4.4 Write property test for contact metadata
    - **Property 5: Contacts receive unique identifiers and timestamps**
    - **Validates: Requirements 1.5**
    - Create multiple contacts, verify unique IDs and valid timestamps with updatedAt ≥ createdAt

  - [ ] 4.5 Write property test for contact updates
    - **Property 8: Contact updates persist correctly**
    - **Property 10: Update timestamp changes on modification**
    - **Validates: Requirements 3.1, 3.2, 3.4**
    - Create contacts, update with random valid data, verify changes persisted and timestamp updated

  - [ ] 4.6 Write property test for update duplicate prevention
    - **Property 11: Duplicate addresses prevented during update**
    - **Validates: Requirements 3.5**
    - Create two contacts, attempt to update one to have the other's address, verify rejection

  - [ ] 4.7 Write property test for contact deletion
    - **Property 12: Deletion removes contact from storage**
    - **Validates: Requirements 4.1, 4.3**
    - Create contacts, delete them, verify they're gone from storage and contact list

  - [ ] 4.8 Write property test for search functionality
    - **Property 6: Search filters contacts correctly**
    - **Validates: Requirements 2.2**
    - Generate random contact lists and queries, verify all results match and no matches excluded

  - [ ] 4.9 Write unit tests for service edge cases
    - Test getContactById with non-existent ID (returns null)
    - Test deleteContact with non-existent ID (handles gracefully)
    - Test search with empty query (returns all)
    - Test search with no matches (returns empty array)
    - Test invalid update rejection (Property 9)
    - Test failed deletion state maintenance (Property 13)
    - _Requirements: 3.3, 4.4_

- [ ] 5. Checkpoint - Ensure core services pass all tests
  - Run all tests for storage, validation, and service layers
  - Verify all property tests pass with 100+ iterations
  - Fix any failing tests before proceeding to UI
  - Ask the user if questions arise

- [ ] 6. Implement React hooks for contact management
  - [ ] 6.1 Create useContacts hook
    - Implement `hooks/useContacts.ts` with state management
    - Load contacts on mount, provide loading/error states
    - Expose createContact, updateContact, deleteContact, refreshContacts functions
    - Handle errors with user-friendly messages
    - Auto-refresh after mutations
    - _Requirements: 1.1, 3.1, 4.1_

  - [ ] 6.2 Create useContactSearch hook
    - Implement `hooks/useContactSearch.ts` with search state
    - Debounce search input (300ms)
    - Filter contacts client-side (case-insensitive)
    - Match against name and Lightning Address
    - _Requirements: 2.2_

  - [ ] 6.3 Write unit tests for hooks
    - Test useContacts loading, error, and success states
    - Test useContacts CRUD operations
    - Test useContactSearch filtering and debouncing
    - Use @testing-library/react-hooks for testing

- [ ] 7. Implement UI components
  - [ ] 7.1 Create ContactListItem component
    - Implement `components/ContactListItem.tsx`
    - Display contact name and Lightning Address using React Native Paper List.Item
    - Handle onPress for navigation to detail/edit
    - Show avatar placeholder (first letter of name)
    - _Requirements: 2.3_

  - [ ] 7.2 Create ContactSearchBar component
    - Implement `components/ContactSearchBar.tsx`
    - Use React Native Paper Searchbar component
    - Emit search query changes with debouncing
    - _Requirements: 2.2_

  - [ ] 7.3 Create EmptyAddressBook component
    - Implement `components/EmptyAddressBook.tsx`
    - Display empty state message with icon
    - Show "Add your first contact" prompt
    - Include button to navigate to Add Contact screen
    - _Requirements: 2.4_

  - [ ] 7.4 Create ContactSelectionModal component
    - Implement `components/ContactSelectionModal.tsx`
    - Modal/bottom sheet for selecting contact during payment
    - Include search bar and contact list
    - Emit selected contact on tap
    - Use React Native Paper Modal or Portal
    - _Requirements: 6.1, 6.2_

  - [ ] 7.5 Write unit tests for UI components
    - Test ContactListItem rendering with contact data (Property 7)
    - Test ContactSearchBar input and debouncing
    - Test EmptyAddressBook rendering
    - Test ContactSelectionModal selection behavior
    - Use @testing-library/react-native
    - _Requirements: 2.3_

- [ ] 8. Implement Address Book screens
  - [ ] 8.1 Create AddressBookScreen
    - Implement `screens/AddressBookScreen.tsx`
    - Use useContacts hook to load contacts
    - Display ContactSearchBar and contact list (FlatList)
    - Show EmptyAddressBook when no contacts
    - Add FAB (Floating Action Button) to navigate to Add Contact screen
    - Handle pull-to-refresh
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 8.2 Create AddContactScreen
    - Implement `screens/AddContactScreen.tsx`
    - Form with TextInput fields for name, Lightning Address, and notes
    - Use React Native Paper TextInput with validation error display
    - Call contactService.createContact on submit
    - Show validation errors inline
    - Navigate back on success with success message
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 10.1_

  - [ ] 8.3 Create EditContactScreen
    - Implement `screens/EditContactScreen.tsx`
    - Load contact by ID from route params
    - Pre-fill form with existing contact data
    - Allow editing name, Lightning Address, and notes
    - Include delete button with confirmation dialog
    - Call contactService.updateContact on save
    - Show validation errors inline
    - Navigate back on success
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 4.1, 4.2, 10.2_

  - [ ] 8.4 Write unit tests for screens
    - Test AddressBookScreen rendering with contacts
    - Test AddressBookScreen empty state
    - Test AddContactScreen form validation
    - Test AddContactScreen submission
    - Test EditContactScreen pre-fill and update
    - Test EditContactScreen deletion with confirmation
    - Mock navigation and contactService

- [ ] 9. Set up navigation and routing
  - [ ] 9.1 Add Address Book routes to Expo Router
    - Create route files under wallet settings: `mobile-app/app/wallet/settings/address-book/`
    - Create `index.tsx` for AddressBookScreen
    - Create `add.tsx` for AddContactScreen
    - Create `[id].tsx` for EditContactScreen (dynamic route)
    - Configure navigation options (titles, header buttons)
    - _Requirements: 9.1, 9.2_

  - [ ] 9.2 Add Address Book entry to Wallet Settings
    - Add Address Book List.Item to `mobile-app/src/features/wallet/screens/WalletSettingsScreen.tsx`
    - Use appropriate icon (e.g., "contacts" or "book" from MaterialCommunityIcons)
    - Set label to "Contacts" or "Address Book"
    - _Requirements: 9.1, 9.3_

  - [ ] 9.3 Write navigation integration tests
    - Test navigation from Wallet Settings to Address Book
    - Test navigation from Address Book to Add Contact
    - Test navigation from Address Book to Edit Contact
    - Test back navigation preserves state

- [ ] 10. Integrate with Send Payment flow
  - [ ] 10.1 Add contact selection to Send Payment screen
    - Modify existing Send Payment screen (`mobile-app/app/wallet/send.tsx`) to include address book icon/button next to Lightning Address input
    - Open ContactSelectionModal on button press
    - Auto-fill Lightning Address field when contact selected
    - Store selected contact in component state
    - Clear Lightning Address when contact cleared
    - _Requirements: 6.1, 6.2, 6.4_

  - [ ] 10.2 Display contact name in payment confirmation
    - Modify payment confirmation screen to show contact name if payment initiated with selected contact
    - Pass selected contact through navigation params or context
    - Display "Paying [Contact Name] ([Lightning Address])" format
    - _Requirements: 6.3_

  - [ ] 10.3 Write property tests for payment integration
    - **Property 18: Contact selection auto-fills address**
    - **Property 20: Clearing contact clears address field**
    - **Validates: Requirements 6.2, 6.4**
    - Test selection and clearing behavior

  - [ ] 10.4 Write unit tests for payment integration
    - Test contact selection modal opening
    - Test address auto-fill on selection
    - Test contact name display in confirmation (Property 19)
    - Test clearing selected contact
    - _Requirements: 6.3_

- [ ] 11. Final checkpoint - End-to-end testing
  - Run complete test suite (unit + property tests)
  - Verify all 24 properties pass with 100+ iterations
  - Perform manual testing of key user flows:
    - Add contact → View in list → Edit → Delete
    - Add contact → Use in payment flow
    - Search contacts → Select from results
  - Test with empty address book
  - Test with 20+ contacts for performance
  - Verify persistence across app restarts
  - Ask the user if questions arise

- [ ] 12. Polish and error handling
  - [ ] 12.1 Add user-friendly error messages
    - Implement toast/snackbar notifications for errors using React Native Paper Snackbar
    - Add error messages for all validation failures
    - Add error messages for storage failures
    - Add success messages for create/update/delete operations
    - _Requirements: 1.2, 1.3, 1.4, 3.3, 5.3_

  - [ ] 12.2 Add loading states and animations
    - Add loading indicators for async operations
    - Add skeleton loaders for contact list
    - Add smooth transitions between screens
    - Add confirmation dialogs for destructive actions (delete)
    - _Requirements: 4.2_

  - [ ] 12.3 Write unit tests for error handling
    - Test error message display for validation failures
    - Test error message display for storage failures
    - Test loading states during async operations
    - Test confirmation dialog for deletion

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties with 100+ iterations
- Unit tests validate specific examples, edge cases, and error conditions
- Integration tests verify component interactions and navigation flows
- Manual testing checklist provided in design document for final validation
- Use fast-check library for property-based testing
- Use @testing-library/react-native for component testing
- Mock AsyncStorage and navigation in tests
