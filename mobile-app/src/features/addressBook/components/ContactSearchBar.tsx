/**
 * ContactSearchBar Component
 * Search input for filtering contacts
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { Searchbar } from 'react-native-paper';

import { t } from '../../../services/i18nService';

interface ContactSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function ContactSearchBar({
  value,
  onChangeText,
  placeholder,
}: ContactSearchBarProps): React.JSX.Element {
  const defaultPlaceholder = t('addressBook.searchContacts');

  return (
    <Searchbar
      placeholder={placeholder || defaultPlaceholder}
      onChangeText={onChangeText}
      value={value}
      style={styles.searchBar}
      inputStyle={styles.input}
      iconColor="rgba(255, 255, 255, 0.5)"
      placeholderTextColor="rgba(255, 255, 255, 0.5)"
    />
  );
}

const styles = StyleSheet.create({
  searchBar: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    elevation: 0,
  },
  input: {
    color: '#FFFFFF',
  },
});
