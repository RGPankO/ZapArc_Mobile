/**
 * Contact Service
 * Handles CRUD operations for contacts
 */

import { generateUUID } from '../../../services/crypto';
import {
  Contact,
  CreateContactInput,
  UpdateContactInput,
  ValidationResult,
} from '../types';
import { loadContacts, saveContacts } from './contactStorage';
import {
  validateContactInput,
  normalizeLightningAddress,
} from './contactValidator';

/**
 * Get all contacts sorted by name
 */
export async function getAllContacts(): Promise<Contact[]> {
  const contacts = await loadContacts();
  return contacts.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get a contact by ID
 * Returns null if not found
 */
export async function getContactById(id: string): Promise<Contact | null> {
  const contacts = await loadContacts();
  return contacts.find((c) => c.id === id) ?? null;
}

/**
 * Search contacts by name or Lightning Address
 * Case-insensitive matching
 */
export async function searchContacts(query: string): Promise<Contact[]> {
  const contacts = await loadContacts();

  if (!query.trim()) {
    return contacts.sort((a, b) => a.name.localeCompare(b.name));
  }

  const normalizedQuery = query.trim().toLowerCase();

  const filtered = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(normalizedQuery) ||
      contact.lightningAddress.toLowerCase().includes(normalizedQuery)
  );

  return filtered.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Check if a Lightning Address already exists
 * Optionally exclude a contact ID (for updates)
 */
export async function addressExists(
  address: string,
  excludeId?: string
): Promise<boolean> {
  const contacts = await loadContacts();
  const normalizedAddress = normalizeLightningAddress(address);

  return contacts.some(
    (contact) =>
      normalizeLightningAddress(contact.lightningAddress) === normalizedAddress &&
      contact.id !== excludeId
  );
}

/**
 * Create a new contact
 * Validates input and checks for duplicates
 */
export async function createContact(
  input: CreateContactInput
): Promise<Contact> {
  // Validate input
  const validation = validateContactInput(input);
  if (!validation.isValid) {
    throw new ContactValidationError(validation);
  }

  // Check for duplicate address
  const isDuplicate = await addressExists(input.lightningAddress);
  if (isDuplicate) {
    throw new ContactValidationError({
      isValid: false,
      errors: [
        {
          field: 'lightningAddress',
          message: 'This Lightning Address is already saved in your address book',
        },
      ],
    });
  }

  const now = Date.now();
  const contact: Contact = {
    id: generateUUID(),
    name: input.name.trim(),
    lightningAddress: input.lightningAddress.trim(),
    notes: input.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };

  // Load existing contacts and add new one
  const contacts = await loadContacts();
  contacts.push(contact);
  await saveContacts(contacts);

  return contact;
}

/**
 * Update an existing contact
 * Validates input and checks for duplicates
 */
export async function updateContact(
  input: UpdateContactInput
): Promise<Contact> {
  // Find existing contact
  const contacts = await loadContacts();
  const index = contacts.findIndex((c) => c.id === input.id);

  if (index === -1) {
    throw new ContactNotFoundError(input.id);
  }

  const existing = contacts[index];

  // Build update object with only provided fields
  const updateData: Partial<CreateContactInput> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.lightningAddress !== undefined)
    updateData.lightningAddress = input.lightningAddress;
  if (input.notes !== undefined) updateData.notes = input.notes;

  // Validate the update
  const validation = validateContactInput({
    ...existing,
    ...updateData,
  } as CreateContactInput);

  if (!validation.isValid) {
    throw new ContactValidationError(validation);
  }

  // Check for duplicate address (excluding current contact)
  if (input.lightningAddress !== undefined) {
    const isDuplicate = await addressExists(input.lightningAddress, input.id);
    if (isDuplicate) {
      throw new ContactValidationError({
        isValid: false,
        errors: [
          {
            field: 'lightningAddress',
            message: 'This Lightning Address is already saved in your address book',
          },
        ],
      });
    }
  }

  // Update the contact
  const updated: Contact = {
    ...existing,
    name: input.name !== undefined ? input.name.trim() : existing.name,
    lightningAddress:
      input.lightningAddress !== undefined
        ? input.lightningAddress.trim()
        : existing.lightningAddress,
    notes:
      input.notes !== undefined
        ? input.notes?.trim() || undefined
        : existing.notes,
    updatedAt: Date.now(),
  };

  contacts[index] = updated;
  await saveContacts(contacts);

  return updated;
}

/**
 * Delete a contact by ID
 */
export async function deleteContact(id: string): Promise<void> {
  const contacts = await loadContacts();
  const index = contacts.findIndex((c) => c.id === id);

  if (index === -1) {
    throw new ContactNotFoundError(id);
  }

  contacts.splice(index, 1);
  await saveContacts(contacts);
}

/**
 * Custom error for validation failures
 */
export class ContactValidationError extends Error {
  public readonly validation: ValidationResult;

  constructor(validation: ValidationResult) {
    const message = validation.errors.map((e) => e.message).join(', ');
    super(message);
    this.name = 'ContactValidationError';
    this.validation = validation;
  }
}

/**
 * Custom error for contact not found
 */
export class ContactNotFoundError extends Error {
  public readonly contactId: string;

  constructor(contactId: string) {
    super(`Contact not found: ${contactId}`);
    this.name = 'ContactNotFoundError';
    this.contactId = contactId;
  }
}

export const contactService = {
  getAllContacts,
  getContactById,
  searchContacts,
  addressExists,
  createContact,
  updateContact,
  deleteContact,
};
