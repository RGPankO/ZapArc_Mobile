# Requirements Document: Lightning Address Book

## Introduction

The Lightning Address Book feature enables users to save and manage Lightning Addresses of frequent payment recipients. This feature provides a convenient way to store contact information locally, reducing the need to manually enter Lightning Addresses for recurring payments. The address book integrates seamlessly with the existing Send Payment flow, allowing users to quickly select saved contacts when initiating transactions.

## Glossary

- **Lightning_Address**: A human-readable identifier (e.g., user@domain.com) that resolves to a Lightning payment destination
- **Contact**: A saved entry in the address book containing a display name and Lightning Address
- **Address_Book**: The collection of all saved contacts stored locally on the device
- **Contact_Storage**: The AsyncStorage-based persistence layer for contact data
- **Send_Payment_Flow**: The existing payment initiation workflow in the wallet application
- **Breez_SDK**: The Lightning Network SDK (@breeztech/breez-sdk-spark-react-native) used for payment operations
- **Contact_Validator**: The component responsible for validating Lightning Address format and contact data

## Requirements

### Requirement 1: Add New Contacts

**User Story:** As a wallet user, I want to add new contacts with a Lightning Address and display name, so that I can save recipients I frequently pay.

#### Acceptance Criteria

1. WHEN a user provides a valid Lightning Address and non-empty display name, THE Address_Book SHALL create a new contact and persist it to storage
2. WHEN a user attempts to add a contact with an invalid Lightning Address format, THE Contact_Validator SHALL reject the addition and display a descriptive error message
3. WHEN a user attempts to add a contact with an empty display name, THE Contact_Validator SHALL reject the addition and display an error message
4. WHEN a user attempts to add a duplicate Lightning Address, THE Address_Book SHALL prevent the addition and notify the user that the address already exists
5. WHEN a new contact is successfully added, THE Address_Book SHALL assign a unique identifier and timestamp the creation

### Requirement 2: View and Search Contacts

**User Story:** As a wallet user, I want to view all my saved contacts and search through them, so that I can quickly find the recipient I need.

#### Acceptance Criteria

1. WHEN a user opens the Address Book screen, THE Address_Book SHALL display all saved contacts in a list format
2. WHEN a user enters text in the search field, THE Address_Book SHALL filter contacts by matching the search term against contact names or Lightning Addresses
3. WHEN the contact list is displayed, THE Address_Book SHALL show each contact's display name and Lightning Address
4. WHEN no contacts exist, THE Address_Book SHALL display an empty state message prompting the user to add their first contact
5. WHEN search results are empty, THE Address_Book SHALL display a message indicating no matches were found

### Requirement 3: Edit Existing Contacts

**User Story:** As a wallet user, I want to edit my saved contacts, so that I can update names or correct Lightning Addresses.

#### Acceptance Criteria

1. WHEN a user modifies a contact's display name with valid input, THE Address_Book SHALL update the contact and persist the change
2. WHEN a user modifies a contact's Lightning Address with valid input, THE Address_Book SHALL update the contact and persist the change
3. WHEN a user attempts to update a contact with invalid data, THE Contact_Validator SHALL reject the update and display an error message
4. WHEN a contact is successfully updated, THE Address_Book SHALL update the timestamp for the modification
5. WHEN a user attempts to change a Lightning Address to one that already exists in another contact, THE Contact_Validator SHALL prevent the update and notify the user

### Requirement 4: Delete Contacts

**User Story:** As a wallet user, I want to delete contacts I no longer need, so that I can keep my address book organized.

#### Acceptance Criteria

1. WHEN a user confirms deletion of a contact, THE Address_Book SHALL remove the contact from storage permanently
2. WHEN a user initiates contact deletion, THE Address_Book SHALL display a confirmation dialog before proceeding
3. WHEN a contact is successfully deleted, THE Address_Book SHALL update the contact list view immediately
4. WHEN deletion fails, THE Address_Book SHALL display an error message and maintain the current state

### Requirement 5: Persist Contact Data

**User Story:** As a wallet user, I want my saved contacts to persist across app restarts, so that I don't lose my address book data.

#### Acceptance Criteria

1. WHEN a contact is added, updated, or deleted, THE Contact_Storage SHALL persist the change to AsyncStorage immediately
2. WHEN the app starts, THE Contact_Storage SHALL load all saved contacts from AsyncStorage
3. WHEN storage operations fail, THE Contact_Storage SHALL handle errors gracefully and notify the user
4. WHEN contact data is serialized, THE Contact_Storage SHALL encode it using JSON format
5. WHEN contact data is deserialized, THE Contact_Storage SHALL validate the structure and handle corrupted data gracefully

### Requirement 6: Integrate with Send Payment Flow

**User Story:** As a wallet user, I want to select a contact from my address book when sending a payment, so that I don't have to manually type Lightning Addresses.

#### Acceptance Criteria

1. WHEN a user is in the Send Payment flow, THE Send_Payment_Flow SHALL provide an option to select a contact from the address book
2. WHEN a user selects a contact, THE Send_Payment_Flow SHALL auto-fill the Lightning Address field with the contact's address
3. WHEN a payment is initiated with a selected contact, THE Send_Payment_Flow SHALL display the contact's display name in the confirmation screen
4. WHEN a user clears a selected contact, THE Send_Payment_Flow SHALL clear the auto-filled Lightning Address field

### Requirement 7: Validate Lightning Address Format

**User Story:** As a wallet user, I want the app to validate Lightning Addresses before saving, so that I don't save invalid addresses that will fail during payment.

#### Acceptance Criteria

1. WHEN a Lightning Address is provided, THE Contact_Validator SHALL verify it matches the format user@domain.tld
2. WHEN a Lightning Address contains invalid characters, THE Contact_Validator SHALL reject it and provide a descriptive error
3. WHEN a Lightning Address is missing the @ symbol or domain, THE Contact_Validator SHALL reject it and provide a descriptive error
4. WHEN a valid Lightning Address is provided, THE Contact_Validator SHALL accept it for storage

### Requirement 8: Validate Contact Display Names

**User Story:** As a wallet user, I want to ensure contact names are valid, so that my address book remains organized and readable.

#### Acceptance Criteria

1. WHEN a display name is provided, THE Contact_Validator SHALL verify it is non-empty after trimming whitespace
2. WHEN a display name exceeds 100 characters, THE Contact_Validator SHALL reject it and display an error message
3. WHEN a display name contains only whitespace, THE Contact_Validator SHALL reject it and display an error message
4. WHEN a valid display name is provided, THE Contact_Validator SHALL accept it for storage

### Requirement 9: Provide Address Book Navigation

**User Story:** As a wallet user, I want easy access to my address book from the main navigation, so that I can manage my contacts conveniently.

#### Acceptance Criteria

1. WHEN the app main navigation is displayed, THE app SHALL provide a clearly labeled Address Book navigation item
2. WHEN a user taps the Address Book navigation item, THE app SHALL navigate to the Address Book screen
3. WHEN a user is on the Address Book screen, THE app SHALL indicate the current navigation state

### Requirement 10: Support Optional Contact Notes

**User Story:** As a wallet user, I want to add optional notes to contacts, so that I can remember additional context about each recipient.

#### Acceptance Criteria

1. WHERE a user provides notes for a contact, THE Address_Book SHALL store the notes with the contact data
2. WHERE notes are provided, THE Address_Book SHALL display them in the contact detail view
3. WHEN notes exceed 500 characters, THE Contact_Validator SHALL reject them and display an error message
4. WHERE no notes are provided, THE Address_Book SHALL store the contact without notes
