/**
 * useContacts Hook
 * Manages contact state and operations
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Contact,
  CreateContactInput,
  UpdateContactInput,
} from '../types';
import {
  getAllContacts,
  createContact as createContactService,
  updateContact as updateContactService,
  deleteContact as deleteContactService,
  ContactValidationError,
  ContactNotFoundError,
} from '../services/contactService';

export interface UseContactsReturn {
  contacts: Contact[];
  loading: boolean;
  error: Error | null;
  createContact: (input: CreateContactInput) => Promise<Contact>;
  updateContact: (input: UpdateContactInput) => Promise<Contact>;
  deleteContact: (id: string) => Promise<void>;
  refreshContacts: () => Promise<void>;
}

export function useContacts(): UseContactsReturn {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refreshContacts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedContacts = await getAllContacts();
      setContacts(loadedContacts);
    } catch (err) {
      console.error('❌ useContacts: Failed to load contacts', err);
      setError(err instanceof Error ? err : new Error('Failed to load contacts'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshContacts();
  }, [refreshContacts]);

  const createContact = useCallback(
    async (input: CreateContactInput): Promise<Contact> => {
      try {
        const newContact = await createContactService(input);
        await refreshContacts();
        return newContact;
      } catch (err) {
        if (err instanceof ContactValidationError) {
          throw err;
        }
        console.error('❌ useContacts: Failed to create contact', err);
        throw new Error('Failed to save contact. Please try again.');
      }
    },
    [refreshContacts]
  );

  const updateContact = useCallback(
    async (input: UpdateContactInput): Promise<Contact> => {
      try {
        const updatedContact = await updateContactService(input);
        await refreshContacts();
        return updatedContact;
      } catch (err) {
        if (
          err instanceof ContactValidationError ||
          err instanceof ContactNotFoundError
        ) {
          throw err;
        }
        console.error('❌ useContacts: Failed to update contact', err);
        throw new Error('Failed to update contact. Please try again.');
      }
    },
    [refreshContacts]
  );

  const deleteContact = useCallback(
    async (id: string): Promise<void> => {
      try {
        await deleteContactService(id);
        await refreshContacts();
      } catch (err) {
        if (err instanceof ContactNotFoundError) {
          throw err;
        }
        console.error('❌ useContacts: Failed to delete contact', err);
        throw new Error('Failed to delete contact. Please try again.');
      }
    },
    [refreshContacts]
  );

  return {
    contacts,
    loading,
    error,
    createContact,
    updateContact,
    deleteContact,
    refreshContacts,
  };
}
