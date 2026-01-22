/**
 * Contact Storage Service
 * Handles AsyncStorage persistence for contacts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Contact, CONTACTS_STORAGE_KEY } from '../types';

/**
 * Validates that an object has the required Contact structure
 */
function isValidContact(obj: unknown): obj is Contact {
  if (typeof obj !== 'object' || obj === null) return false;

  const contact = obj as Record<string, unknown>;

  return (
    typeof contact.id === 'string' &&
    typeof contact.name === 'string' &&
    typeof contact.lightningAddress === 'string' &&
    typeof contact.createdAt === 'number' &&
    typeof contact.updatedAt === 'number' &&
    (contact.notes === undefined || typeof contact.notes === 'string')
  );
}

/**
 * Load all contacts from AsyncStorage
 * Returns empty array on failure or if no contacts exist
 */
export async function loadContacts(): Promise<Contact[]> {
  try {
    const data = await AsyncStorage.getItem(CONTACTS_STORAGE_KEY);

    if (!data) {
      return [];
    }

    const parsed = JSON.parse(data);

    if (!Array.isArray(parsed)) {
      console.error('❌ Contact storage: Invalid data format, expected array');
      return [];
    }

    // Filter out invalid contacts and log warnings
    const validContacts: Contact[] = [];
    for (const item of parsed) {
      if (isValidContact(item)) {
        validContacts.push(item);
      } else {
        console.warn('⚠️ Contact storage: Skipping invalid contact entry', item);
      }
    }

    return validContacts;
  } catch (error) {
    console.error('❌ Contact storage: Failed to load contacts', error);
    return [];
  }
}

/**
 * Save all contacts to AsyncStorage
 * Throws on failure
 */
export async function saveContacts(contacts: Contact[]): Promise<void> {
  try {
    const data = JSON.stringify(contacts);
    await AsyncStorage.setItem(CONTACTS_STORAGE_KEY, data);
  } catch (error) {
    console.error('❌ Contact storage: Failed to save contacts', error);
    throw new Error('Failed to save contacts to storage');
  }
}

/**
 * Clear all contacts from AsyncStorage
 * Used for testing and reset functionality
 */
export async function clearContacts(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CONTACTS_STORAGE_KEY);
  } catch (error) {
    console.error('❌ Contact storage: Failed to clear contacts', error);
    throw new Error('Failed to clear contacts from storage');
  }
}

export const contactStorage = {
  loadContacts,
  saveContacts,
  clearContacts,
};
