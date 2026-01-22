/**
 * useContactSearch Hook
 * Provides search functionality with debouncing
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { Contact } from '../types';

export interface UseContactSearchReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredContacts: Contact[];
  isSearching: boolean;
}

const DEBOUNCE_DELAY = 300;

export function useContactSearch(contacts: Contact[]): UseContactSearchReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (searchQuery !== debouncedQuery) {
      setIsSearching(true);

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        setDebouncedQuery(searchQuery);
        setIsSearching(false);
      }, DEBOUNCE_DELAY);
    }

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery, debouncedQuery]);

  const filteredContacts = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return contacts;
    }

    const normalizedQuery = debouncedQuery.trim().toLowerCase();

    return contacts.filter(
      (contact) =>
        contact.name.toLowerCase().includes(normalizedQuery) ||
        contact.lightningAddress.toLowerCase().includes(normalizedQuery)
    );
  }, [contacts, debouncedQuery]);

  return {
    searchQuery,
    setSearchQuery,
    filteredContacts,
    isSearching,
  };
}
