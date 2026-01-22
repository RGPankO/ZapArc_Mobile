/**
 * Contact Types for Lightning Address Book
 */

/**
 * Represents a saved contact in the address book
 */
export interface Contact {
  id: string;
  name: string;
  lightningAddress: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Input for creating a new contact
 */
export interface CreateContactInput {
  name: string;
  lightningAddress: string;
  notes?: string;
}

/**
 * Input for updating an existing contact
 */
export interface UpdateContactInput {
  id: string;
  name?: string;
  lightningAddress?: string;
  notes?: string;
}

/**
 * Validation error for a specific field
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Result of a validation operation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Storage key for contacts in AsyncStorage
 */
export const CONTACTS_STORAGE_KEY = '@zap-arc:contacts';

/**
 * Validation constants
 */
export const VALIDATION_LIMITS = {
  NAME_MAX_LENGTH: 100,
  NOTES_MAX_LENGTH: 500,
} as const;
