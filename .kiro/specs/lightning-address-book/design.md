# Design Document: Lightning Address Book

## Overview

The Lightning Address Book feature provides a local contact management system for storing and retrieving Lightning Addresses. The design follows the existing feature-based architecture of the zap-arc-mobile wallet app, using React Native with TypeScript, Expo Router for navigation, and React Native Paper for UI components.

The feature consists of four main layers:
1. **Data Layer**: Contact storage and persistence using AsyncStorage
2. **Business Logic Layer**: Contact management operations (CRUD) and validation
3. **UI Layer**: React Native screens and components for user interaction
4. **Integration Layer**: Hooks into the existing Send Payment flow

The design emphasizes simplicity, local-first storage, and seamless integration with existing wallet functionality.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     UI Layer (React Native)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ AddressBook  │  │ AddContact   │  │ EditContact  │      │
│  │   Screen     │  │   Screen     │  │   Screen     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────┐
│                  Business Logic Layer                        │
│                            │                                 │
│  ┌─────────────────────────▼──────────────────────────┐     │
│  │         ContactService (CRUD Operations)           │     │
│  └─────────────────────────┬──────────────────────────┘     │
│                            │                                 │
│  ┌─────────────────────────▼──────────────────────────┐     │
│  │         ContactValidator (Validation Logic)        │     │
│  └────────────────────────────────────────────────────┘     │
└────────────────────────────┼─────────────────────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────┐
│                      Data Layer                              │
│  ┌─────────────────────────▼──────────────────────────┐     │
│  │    ContactStorage (AsyncStorage Persistence)       │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

### Integration with Send Payment Flow

**Send Screen Location:**
- `mobile-app/app/wallet/send.tsx`

### Navigation Placement

**Settings Entry Location:**
- Wallet Settings list: `mobile-app/src/features/wallet/screens/WalletSettingsScreen.tsx`
- Route group: `mobile-app/app/wallet/settings/`

**Route Naming (proposed):**
- Address book list: `/wallet/settings/address-book`
- Add contact: `/wallet/settings/address-book/add`
- Edit contact: `/wallet/settings/address-book/[id]`

**Placement in Settings (UX note):**
- Place "Address Book" near the existing "Lightning Address" entry to keep receive/send related tools grouped.

```
┌─────────────────────────────────────────────────────────────┐
│                   Send Payment Screen                        │
│  ┌──────────────────────────────────────────────────┐       │
│  │  Lightning Address Input Field                   │       │
│  │  [user@domain.com                    ] [📖]      │       │
│  └──────────────────────────────────────────────────┘       │
│                                          │                   │
│                                          │ (tap address book)│
│                                          ▼                   │
│  ┌──────────────────────────────────────────────────┐       │
│  │     Contact Selection Modal/Sheet                │       │
│  │  ┌────────────────────────────────────────────┐  │       │
│  │  │ Search: [____________]                     │  │       │
│  │  ├────────────────────────────────────────────┤  │       │
│  │  │ Alice (alice@getalby.com)                  │  │       │
│  │  │ Bob (bob@walletofsatoshi.com)              │  │       │
│  │  │ Charlie (charlie@strike.me)                │  │       │
│  │  └────────────────────────────────────────────┘  │       │
│  └──────────────────────────────────────────────────┘       │
│                                          │                   │
│                                          │ (select contact)  │
│                                          ▼                   │
│  ┌──────────────────────────────────────────────────┐       │
│  │  Lightning Address: alice@getalby.com            │       │
│  │  Contact: Alice                                  │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure

Following the feature-based architecture:

```
src/features/addressBook/
├── screens/
│   ├── AddressBookScreen.tsx       # Main address book list
│   ├── AddContactScreen.tsx        # Add new contact form
│   └── EditContactScreen.tsx       # Edit existing contact
├── components/
│   ├── ContactListItem.tsx         # Individual contact row
│   ├── ContactSearchBar.tsx        # Search input component
│   ├── ContactSelectionModal.tsx   # Modal for selecting contact
│   └── EmptyAddressBook.tsx        # Empty state component
├── services/
│   ├── contactService.ts           # CRUD operations
│   ├── contactStorage.ts           # AsyncStorage persistence
│   └── contactValidator.ts         # Validation logic
├── types/
│   └── contact.types.ts            # TypeScript interfaces
└── hooks/
    ├── useContacts.ts              # Hook for contact operations
    └── useContactSearch.ts         # Hook for search functionality
```

## Components and Interfaces

### Data Models

#### Contact Interface

```typescript
interface Contact {
  id: string;                    // UUID v4
  name: string;                  // Display name (1-100 chars)
  lightningAddress: string;      // user@domain.tld format
  notes?: string;                // Optional notes (max 500 chars)
  createdAt: number;             // Unix timestamp (milliseconds)
  updatedAt: number;             // Unix timestamp (milliseconds)
}
```

#### Contact Creation Input

```typescript
interface CreateContactInput {
  name: string;
  lightningAddress: string;
  notes?: string;
}
```

#### Contact Update Input

```typescript
interface UpdateContactInput {
  id: string;
  name?: string;
  lightningAddress?: string;
  notes?: string;
}
```

#### Validation Result

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  field: string;
  message: string;
}
```

### ContactStorage Interface

The ContactStorage module handles all AsyncStorage operations for contact persistence.

```typescript
interface ContactStorage {
  // Load all contacts from AsyncStorage
  loadContacts(): Promise<Contact[]>;
  
  // Save all contacts to AsyncStorage
  saveContacts(contacts: Contact[]): Promise<void>;
  
  // Clear all contacts (for testing/reset)
  clearContacts(): Promise<void>;
}
```

**Storage Key**: `@zap-arc:contacts`

**Storage Format**: JSON array of Contact objects

**Error Handling**: 
- Wrap all AsyncStorage operations in try-catch
- Return empty array on load failure
- Log errors for debugging
- Validate JSON structure on load

### ContactValidator Interface

The ContactValidator module provides validation for all contact data.

```typescript
interface ContactValidator {
  // Validate Lightning Address format
  validateLightningAddress(address: string): ValidationResult;
  
  // Validate display name
  validateName(name: string): ValidationResult;
  
  // Validate optional notes
  validateNotes(notes: string | undefined): ValidationResult;
  
  // Validate complete contact input
  validateContactInput(input: CreateContactInput | UpdateContactInput): ValidationResult;
}
```

**Validation Rules**:

1. **Lightning Address**:
   - Must match pattern: `^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`
   - Must contain exactly one @ symbol
   - Local part (before @) must not be empty
   - Domain part (after @) must be valid domain format
   - Trim whitespace before validation
   - Case-insensitive comparison for duplicate detection (normalize to lowercase)

2. **Display Name**:
   - Must be non-empty after trimming whitespace
   - Must be between 1 and 100 characters
   - No special character restrictions (allow international names)

3. **Notes**:
   - Optional field
   - If provided, must not exceed 500 characters
   - No content restrictions

### ContactService Interface

The ContactService module provides all CRUD operations for contacts.

```typescript
interface ContactService {
  // Get all contacts
  getAllContacts(): Promise<Contact[]>;
  
  // Get contact by ID
  getContactById(id: string): Promise<Contact | null>;
  
  // Search contacts by name or address
  searchContacts(query: string): Promise<Contact[]>;
  
  // Create new contact
  createContact(input: CreateContactInput): Promise<Contact>;
  
  // Update existing contact
  updateContact(input: UpdateContactInput): Promise<Contact>;
  
  // Delete contact
  deleteContact(id: string): Promise<void>;
  
  // Check if Lightning Address already exists
  addressExists(address: string, excludeId?: string): Promise<boolean>;
}
```

**Implementation Details**:

1. **Contact Creation**:
   - Generate UUID v4 for id
   - Set createdAt and updatedAt to current timestamp
   - Validate input before creation
   - Check for duplicate Lightning Address
   - Persist to storage after creation

2. **Contact Update**:
   - Validate input before update
   - Check for duplicate Lightning Address (excluding current contact)
   - Update only provided fields
   - Update updatedAt timestamp
   - Persist to storage after update

3. **Contact Deletion**:
   - Verify contact exists before deletion
   - Remove from storage
   - No confirmation at service level (handled by UI)

4. **Search**:
   - Case-insensitive search
   - Match against both name and Lightning Address
   - Return results sorted by name

5. **Duplicate Detection**:
   - Normalize Lightning Addresses to lowercase for comparison
   - Allow same address during update of existing contact

### React Hooks

#### useContacts Hook

```typescript
interface UseContactsReturn {
  contacts: Contact[];
  loading: boolean;
  error: Error | null;
  createContact: (input: CreateContactInput) => Promise<Contact>;
  updateContact: (input: UpdateContactInput) => Promise<Contact>;
  deleteContact: (id: string) => Promise<void>;
  refreshContacts: () => Promise<void>;
}

function useContacts(): UseContactsReturn;
```

**Behavior**:
- Load contacts on mount
- Provide loading and error states
- Automatically refresh contact list after mutations
- Handle errors gracefully with user-friendly messages

#### useContactSearch Hook

```typescript
interface UseContactSearchReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredContacts: Contact[];
  isSearching: boolean;
}

function useContactSearch(contacts: Contact[]): UseContactSearchReturn;
```

**Behavior**:
- Debounce search input (300ms)
- Filter contacts client-side
- Case-insensitive matching
- Match against name and Lightning Address

## Data Models

### Contact Entity

The Contact entity represents a saved Lightning Address with associated metadata.

**Fields**:
- `id`: Unique identifier (UUID v4)
- `name`: Human-readable display name
- `lightningAddress`: Lightning Address in user@domain.tld format
- `notes`: Optional free-text notes
- `createdAt`: Creation timestamp (Unix milliseconds)
- `updatedAt`: Last modification timestamp (Unix milliseconds)

**Constraints**:
- `id` must be unique across all contacts
- `lightningAddress` must be unique across all contacts (case-insensitive)
- `name` must be 1-100 characters after trimming
- `notes` must be ≤500 characters if provided
- `createdAt` and `updatedAt` must be valid Unix timestamps

**Invariants**:
- `updatedAt` ≥ `createdAt` for all contacts
- All stored contacts must pass validation rules
- Lightning Addresses are stored in original case but compared case-insensitively; if normalization is chosen for display, use lowercase consistently

### Storage Schema

Contacts are stored in AsyncStorage as a JSON array under the key `@zap-arc:contacts`.

**Example Storage**:
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Alice",
    "lightningAddress": "alice@getalby.com",
    "notes": "Friend from conference",
    "createdAt": 1704067200000,
    "updatedAt": 1704067200000
  },
  {
    "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "name": "Bob's Coffee Shop",
    "lightningAddress": "bob@walletofsatoshi.com",
    "createdAt": 1704153600000,
    "updatedAt": 1704240000000
  }
]
```

**Migration Strategy**:
- Version 1: Initial schema (current design)
- Future versions: Add schema version field for migrations
- Handle missing optional fields gracefully
- Validate and sanitize on load

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Contact Creation Properties

Property 1: Valid contact creation persists correctly
*For any* valid Lightning Address and display name, creating a contact should result in the contact being stored in AsyncStorage with all provided data intact.
**Validates: Requirements 1.1**

Property 2: Invalid Lightning Addresses are rejected
*For any* string that does not match the format user@domain.tld (including missing @, invalid characters, empty local/domain parts), the validator should reject it and return a descriptive error.
**Validates: Requirements 1.2, 7.1, 7.2, 7.3**

Property 3: Invalid display names are rejected
*For any* string that is empty after trimming whitespace or exceeds 100 characters, the validator should reject it and return an error.
**Validates: Requirements 1.3, 8.1, 8.2, 8.3**

Property 4: Duplicate Lightning Addresses are prevented
*For any* existing contact with a Lightning Address, attempting to create a new contact with the same address (case-insensitive) should be rejected.
**Validates: Requirements 1.4**

Property 5: Contacts receive unique identifiers and timestamps
*For any* successfully created contact, it should have a unique UUID, and both createdAt and updatedAt should be set to valid timestamps with updatedAt ≥ createdAt.
**Validates: Requirements 1.5**

### Search and Display Properties

Property 6: Search filters contacts correctly
*For any* search query and contact list, all returned contacts should match the query (case-insensitive) in either name or Lightning Address, and no matching contacts should be excluded.
**Validates: Requirements 2.2**

Property 7: Contact rendering includes required fields
*For any* contact, the rendered output should include both the display name and Lightning Address.
**Validates: Requirements 2.3**

### Contact Update Properties

Property 8: Contact updates persist correctly
*For any* existing contact and valid update data (name, address, or notes), updating the contact should persist all changes to AsyncStorage.
**Validates: Requirements 3.1, 3.2**

Property 9: Invalid updates are rejected
*For any* update attempt with invalid data (invalid address format, invalid name, or invalid notes), the validator should reject the update and return an error.
**Validates: Requirements 3.3**

Property 10: Update timestamp changes on modification
*For any* contact that is successfully updated, the updatedAt timestamp should be greater than the original updatedAt timestamp.
**Validates: Requirements 3.4**

Property 11: Duplicate addresses prevented during update
*For any* two contacts A and B, attempting to update contact A's Lightning Address to match contact B's address (case-insensitive) should be rejected.
**Validates: Requirements 3.5**

### Contact Deletion Properties

Property 12: Deletion removes contact from storage
*For any* existing contact, deleting it should result in the contact no longer being present in AsyncStorage or in the loaded contact list.
**Validates: Requirements 4.1, 4.3**

Property 13: Failed deletion maintains state
*For any* contact, if deletion fails due to storage error, the contact should remain in the contact list unchanged.
**Validates: Requirements 4.4**

### Persistence Properties

Property 14: Contacts persist across app restarts
*For any* set of contacts saved to storage, loading contacts after simulating an app restart should return the same set of contacts with all data intact.
**Validates: Requirements 5.2**

Property 15: Storage errors handled gracefully
*For any* storage operation that fails, the system should handle the error gracefully, return an appropriate error message, and not crash.
**Validates: Requirements 5.3**

Property 16: Serialization round-trip preserves data
*For any* valid contact, serializing it to JSON and then deserializing should produce an equivalent contact with all fields preserved.
**Validates: Requirements 5.4**

Property 17: Corrupted data handled gracefully
*For any* corrupted or invalid JSON data in storage, loading contacts should handle the error gracefully, return an empty array or partial data, and not crash.
**Validates: Requirements 5.5**

### Payment Integration Properties

Property 18: Contact selection auto-fills address
*For any* contact selected from the address book during the Send Payment flow, the Lightning Address input field should be populated with the contact's Lightning Address.
**Validates: Requirements 6.2**

Property 19: Payment confirmation shows contact name
*For any* payment initiated with a selected contact, the confirmation screen should display the contact's display name.
**Validates: Requirements 6.3**

Property 20: Clearing contact clears address field
*For any* selected contact in the Send Payment flow, clearing the selection should result in the Lightning Address field being empty.
**Validates: Requirements 6.4**

### Validation Properties

Property 21: Lightning Address validation is comprehensive
*For any* Lightning Address, the validator should accept it if and only if it matches the pattern user@domain.tld with valid characters, exactly one @ symbol, non-empty local and domain parts, and a valid TLD.
**Validates: Requirements 7.1, 7.2, 7.3, 7.4**

Property 22: Display name validation is comprehensive
*For any* display name, the validator should accept it if and only if it is non-empty after trimming whitespace and does not exceed 100 characters.
**Validates: Requirements 8.1, 8.2, 8.3, 8.4**

Property 23: Notes validation enforces length limit
*For any* notes string exceeding 500 characters, the validator should reject it and return an error.
**Validates: Requirements 10.3**

Property 24: Optional notes storage works correctly
*For any* contact created with or without notes, the notes field should be stored correctly (present when provided, absent when not provided) and persist across storage operations.
**Validates: Requirements 10.1, 10.2, 10.4**

## Error Handling

### Error Categories

1. **Validation Errors**
   - Invalid Lightning Address format
   - Invalid display name (empty or too long)
   - Invalid notes (too long)
   - Duplicate Lightning Address
   - Errors are returned synchronously with descriptive messages

2. **Storage Errors**
   - AsyncStorage read failure
   - AsyncStorage write failure
   - JSON parse errors (corrupted data)
   - Errors are caught and logged, user-friendly messages displayed

3. **Not Found Errors**
   - Contact ID not found during update/delete
   - Return null or throw specific error
   - UI handles gracefully with appropriate message

### Error Handling Strategy

**Validation Errors**:
- Return `ValidationResult` with `isValid: false` and descriptive error messages
- Display errors inline in forms near the relevant field
- Prevent submission until validation passes
- Use React Native Paper's `TextInput` error prop for display

**Storage Errors**:
- Wrap all AsyncStorage operations in try-catch blocks
- Log errors to console for debugging
- Display user-friendly toast/snackbar messages
- On load failure: return empty array and notify user
- On save failure: retry once, then notify user
- Never crash the app due to storage errors

**Not Found Errors**:
- Check existence before update/delete operations
- Return null for getContactById when not found
- Display "Contact not found" message if user tries to edit/delete non-existent contact
- Refresh contact list to sync state

**Network Errors** (future consideration):
- Currently not applicable (local-only storage)
- Future: handle sync failures gracefully

### Error Messages

**User-Facing Messages**:
- "Please enter a valid Lightning Address (e.g., user@domain.com)"
- "Contact name is required and must be less than 100 characters"
- "This Lightning Address is already saved in your address book"
- "Notes must be less than 500 characters"
- "Failed to save contact. Please try again."
- "Failed to load contacts. Please restart the app."
- "Contact not found. It may have been deleted."

**Developer Messages** (logged):
- "AsyncStorage.getItem failed: [error details]"
- "JSON.parse failed for contacts data: [error details]"
- "Contact validation failed: [validation errors]"

## Testing Strategy

### Dual Testing Approach

The Lightning Address Book feature will use both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests**: Verify specific examples, edge cases, and error conditions
- Specific validation examples (valid/invalid addresses)
- Edge cases (empty lists, single contact, maximum length strings)
- Error conditions (storage failures, corrupted data)
- Integration points (navigation, payment flow integration)
- UI component rendering

**Property-Based Tests**: Verify universal properties across all inputs
- Contact CRUD operations with random valid data
- Validation logic with generated valid/invalid inputs
- Search functionality with random queries and contact lists
- Serialization round-trips with random contact data
- Duplicate detection with random address variations

Together, these approaches provide comprehensive coverage: unit tests catch concrete bugs and verify specific behaviors, while property tests verify general correctness across a wide range of inputs.

### Property-Based Testing Configuration

**Library**: fast-check (JavaScript/TypeScript property-based testing library)
- Install: `npm install --save-dev fast-check`
- Well-suited for React Native/TypeScript projects
- Excellent TypeScript support and type inference
- Comprehensive generators for common data types

**Test Configuration**:
- Minimum 100 iterations per property test (due to randomization)
- Each property test must reference its design document property
- Tag format: `// Feature: lightning-address-book, Property {number}: {property_text}`
- Use `fc.assert` for property verification
- Configure seed for reproducible failures

**Example Property Test Structure**:
```typescript
import fc from 'fast-check';

describe('Contact Creation Properties', () => {
  it('Property 1: Valid contact creation persists correctly', async () => {
    // Feature: lightning-address-book, Property 1: Valid contact creation persists correctly
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.emailAddress(),
        async (name, address) => {
          // Test implementation
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Custom Generators**:
- Lightning Address generator: build strings that match `^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$` to avoid false failures
- Contact generator: combine name, address, optional notes
- Invalid address generator: strings that don't match pattern
- Whitespace string generator: various whitespace combinations

### Unit Testing Strategy

**Test Organization**:
```
src/features/addressBook/
├── services/
│   ├── __tests__/
│   │   ├── contactService.test.ts
│   │   ├── contactStorage.test.ts
│   │   └── contactValidator.test.ts
├── screens/
│   ├── __tests__/
│   │   ├── AddressBookScreen.test.tsx
│   │   ├── AddContactScreen.test.tsx
│   │   └── EditContactScreen.test.tsx
└── components/
    ├── __tests__/
    │   ├── ContactListItem.test.tsx
    │   └── ContactSelectionModal.test.tsx
```

**Unit Test Coverage**:
1. **ContactValidator**:
   - Valid Lightning Address examples
   - Invalid Lightning Address examples (no @, multiple @, invalid domain)
   - Valid display name examples
   - Invalid display name examples (empty, whitespace-only, too long)
   - Notes validation (valid, too long, undefined)

2. **ContactStorage**:
   - Load empty contacts
   - Save and load single contact
   - Save and load multiple contacts
   - Handle corrupted JSON
   - Handle AsyncStorage errors

3. **ContactService**:
   - Create contact with valid data
   - Create contact with duplicate address
   - Update contact fields
   - Delete existing contact
   - Search contacts (exact match, partial match, no match)
   - Get contact by ID (exists, not exists)

4. **UI Components**:
   - Render contact list with data
   - Render empty state
   - Handle search input
   - Handle contact selection
   - Form validation feedback
   - Navigation between screens

**Mocking Strategy**:
- Mock AsyncStorage for all storage tests
- Mock navigation for screen tests
- Mock contactService for UI component tests
- Use `@testing-library/react-native` for component testing

### Integration Testing

**Key Integration Points**:
1. **Send Payment Flow Integration**:
   - Verify contact selection modal opens from Send Payment screen
   - Verify selected contact populates Lightning Address field
   - Verify contact name appears in payment confirmation
   - Test clearing selected contact

2. **Navigation Integration**:
   - Verify Address Book accessible from main navigation
   - Verify navigation between Address Book screens
   - Verify back navigation preserves state

3. **End-to-End Flows**:
   - Add contact → View in list → Edit → Delete
   - Add contact → Use in payment → Complete payment
   - Search contacts → Select from results → Edit

**Manual Testing Checklist**:
- [ ] Add contact with valid data
- [ ] Add contact with invalid Lightning Address (verify error)
- [ ] Add contact with empty name (verify error)
- [ ] Add duplicate Lightning Address (verify error)
- [ ] Search contacts by name
- [ ] Search contacts by address
- [ ] Edit contact name
- [ ] Edit contact Lightning Address
- [ ] Edit contact notes
- [ ] Delete contact (verify confirmation)
- [ ] Select contact in Send Payment flow
- [ ] Verify contact persists after app restart
- [ ] Test with empty address book
- [ ] Test with 50+ contacts (performance)

### Test Data

**Valid Test Contacts**:
```typescript
const validContacts = [
  { name: 'Alice', lightningAddress: 'alice@getalby.com' },
  { name: 'Bob', lightningAddress: 'bob@walletofsatoshi.com' },
  { name: 'Charlie', lightningAddress: 'charlie@strike.me' },
];
```

**Invalid Lightning Addresses**:
```typescript
const invalidAddresses = [
  'notanemail',           // No @ symbol
  '@domain.com',          // Empty local part
  'user@',                // Empty domain
  'user@@domain.com',     // Multiple @ symbols
  'user@domain',          // No TLD
  '',                     // Empty string
  'user @domain.com',     // Space in address
];
```

**Edge Cases**:
- Maximum length name (100 characters)
- Maximum length notes (500 characters)
- Unicode characters in names
- International domain names
- Case variations in Lightning Addresses
