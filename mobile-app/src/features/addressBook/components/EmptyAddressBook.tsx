/**
 * EmptyAddressBook Component
 * Displayed when the address book has no contacts
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage } from '../../../hooks/useLanguage';
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
  const { t } = useLanguage();

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons
        name={isSearchResult ? 'account-search' : 'account-multiple-plus'}
        size={64}
        color={secondaryTextColor}
      />
      <Text style={[styles.title, { color: primaryTextColor }]}>
        {isSearchResult ? t('addressBook.noContactsFound') : t('addressBook.noContacts')}
      </Text>
      <Text style={[styles.description, { color: secondaryTextColor }]}>
        {isSearchResult
          ? t('addressBook.tryDifferentSearchTerm')
          : t('addressBook.noContactsDescription')}
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
          {t('addressBook.addContact')}
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
