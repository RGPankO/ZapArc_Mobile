/**
 * ContactListItem Component
 * Displays a single contact in the address book list
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { List, Text, Avatar } from 'react-native-paper';
import { Contact } from '../types';

interface ContactListItemProps {
  contact: Contact;
  onPress: (contact: Contact) => void;
  primaryTextColor: string;
  secondaryTextColor: string;
}

export function ContactListItem({
  contact,
  onPress,
  primaryTextColor,
  secondaryTextColor,
}: ContactListItemProps): React.JSX.Element {
  const initials = contact.name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <List.Item
      title={contact.name}
      description={contact.lightningAddress}
      left={() => (
        <View style={styles.avatarContainer}>
          <Avatar.Text
            size={40}
            label={initials}
            style={styles.avatar}
            labelStyle={styles.avatarLabel}
          />
        </View>
      )}
      right={(props) => (
        <List.Icon {...props} icon="chevron-right" color={secondaryTextColor} />
      )}
      onPress={() => onPress(contact)}
      titleStyle={[styles.title, { color: primaryTextColor }]}
      descriptionStyle={[styles.description, { color: secondaryTextColor }]}
      style={styles.listItem}
    />
  );
}

const styles = StyleSheet.create({
  listItem: {
    backgroundColor: 'transparent',
    paddingVertical: 4,
    paddingLeft: 16,
  },
  avatarContainer: {
    justifyContent: 'center',
  },
  avatar: {
    backgroundColor: '#FFC107',
  },
  avatarLabel: {
    color: '#000000',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
  },
  description: {
    fontSize: 13,
  },
});
