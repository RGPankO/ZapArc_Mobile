/**
 * Contact Validator Service
 * Handles validation for contact data
 */

import {
  ValidationResult,
  ValidationError,
  CreateContactInput,
  UpdateContactInput,
  VALIDATION_LIMITS,
} from '../types';

/**
 * Lightning Address regex pattern
 * Matches: user@domain.tld format
 * - Local part: alphanumeric, dots, underscores, hyphens
 * - Domain: alphanumeric with dots and hyphens
 * - TLD: at least 2 characters
 */
const LIGHTNING_ADDRESS_PATTERN = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Normalize a Lightning Address for comparison
 * Trims whitespace and converts to lowercase
 */
export function normalizeLightningAddress(address: string): string {
  return address.trim().toLowerCase();
}

/**
 * Validate a Lightning Address format
 */
export function validateLightningAddress(address: string): ValidationResult {
  const errors: ValidationError[] = [];
  const trimmed = address.trim();

  if (!trimmed) {
    errors.push({
      field: 'lightningAddress',
      message: 'Lightning Address is required',
    });
    return { isValid: false, errors };
  }

  if (!trimmed.includes('@')) {
    errors.push({
      field: 'lightningAddress',
      message: 'Lightning Address must contain @ symbol (e.g., user@domain.com)',
    });
    return { isValid: false, errors };
  }

  const atCount = (trimmed.match(/@/g) || []).length;
  if (atCount > 1) {
    errors.push({
      field: 'lightningAddress',
      message: 'Lightning Address must contain only one @ symbol',
    });
    return { isValid: false, errors };
  }

  const [localPart, domain] = trimmed.split('@');

  if (!localPart) {
    errors.push({
      field: 'lightningAddress',
      message: 'Lightning Address must have a username before @',
    });
    return { isValid: false, errors };
  }

  if (!domain || !domain.includes('.')) {
    errors.push({
      field: 'lightningAddress',
      message: 'Lightning Address must have a valid domain (e.g., domain.com)',
    });
    return { isValid: false, errors };
  }

  if (!LIGHTNING_ADDRESS_PATTERN.test(trimmed)) {
    errors.push({
      field: 'lightningAddress',
      message: 'Please enter a valid Lightning Address (e.g., user@domain.com)',
    });
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [] };
}

/**
 * Validate a contact display name
 */
export function validateName(name: string): ValidationResult {
  const errors: ValidationError[] = [];
  const trimmed = name.trim();

  if (!trimmed) {
    errors.push({
      field: 'name',
      message: 'Contact name is required',
    });
    return { isValid: false, errors };
  }

  if (trimmed.length > VALIDATION_LIMITS.NAME_MAX_LENGTH) {
    errors.push({
      field: 'name',
      message: `Contact name must be less than ${VALIDATION_LIMITS.NAME_MAX_LENGTH} characters`,
    });
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [] };
}

/**
 * Validate optional contact notes
 */
export function validateNotes(notes: string | undefined): ValidationResult {
  if (notes === undefined || notes === null) {
    return { isValid: true, errors: [] };
  }

  const errors: ValidationError[] = [];

  if (notes.length > VALIDATION_LIMITS.NOTES_MAX_LENGTH) {
    errors.push({
      field: 'notes',
      message: `Notes must be less than ${VALIDATION_LIMITS.NOTES_MAX_LENGTH} characters`,
    });
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [] };
}

/**
 * Validate a complete contact input (create or update)
 */
export function validateContactInput(
  input: CreateContactInput | UpdateContactInput
): ValidationResult {
  const errors: ValidationError[] = [];

  // For CreateContactInput, name and lightningAddress are required
  // For UpdateContactInput, they are optional but must be valid if provided
  const isUpdate = 'id' in input;

  if (!isUpdate || input.name !== undefined) {
    const name = (input as CreateContactInput).name ?? '';
    const nameResult = validateName(name);
    if (!nameResult.isValid) {
      errors.push(...nameResult.errors);
    }
  }

  if (!isUpdate || input.lightningAddress !== undefined) {
    const address = (input as CreateContactInput).lightningAddress ?? '';
    const addressResult = validateLightningAddress(address);
    if (!addressResult.isValid) {
      errors.push(...addressResult.errors);
    }
  }

  const notesResult = validateNotes(input.notes);
  if (!notesResult.isValid) {
    errors.push(...notesResult.errors);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export const contactValidator = {
  validateLightningAddress,
  validateName,
  validateNotes,
  validateContactInput,
  normalizeLightningAddress,
};
