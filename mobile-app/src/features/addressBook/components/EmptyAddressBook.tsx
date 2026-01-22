/**
 * EmptyAddressBook Component
 * Displayed when the address book has no contacts
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BRAND_COLOR } from '../../../utils/theme-helpers';

interface EmptyAddressBookProps {
  onAddContact: () => void;
  primaryTextColor: string;
  secondaryTextColor: string;
  isSearchResult?: boolean;
}

export function EmptyAddressBook({
  onAddContact,
  primaryTextColor,
  secondaryTextColor,
  isSearchResult = false,
}: EmptyAddressBookProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons
        name={isSearchResult ? 'account-search' : 'account-multiple-plus'}
        size={64}
        color={secondaryTextColor}
      />
      <Text style={[styles.title, { color: primaryTextColor }]}>
        {isSearchResult ? 'No contacts found' : 'No contacts yet'}
      </Text>
      <Text style={[styles.description, { color: secondaryTextColor }]}>
        {isSearchResult
          ? 'Try a different search term'
          : 'Add your first contact to quickly send payments'}
      </Text>
      {!isSearchResult && (
        <Button
          mode="contained"
          onPress={onAddContact}
          style={styles.button}
          buttonColor={BRAND_COLOR}
          textColor="#000000"
          icon="plus"
        >
          Add Contact
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: 24,
    borderRadius: 8,
  },
});
