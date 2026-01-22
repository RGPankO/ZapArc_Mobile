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
  /** Whether this contact is the current user's own address */
  isSelf?: boolean;
}

export function ContactListItem({
  contact,
  onPress,
  primaryTextColor,
  secondaryTextColor,
  isSelf = false,
}: ContactListItemProps): React.JSX.Element {
  const initials = contact.name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <List.Item
      title={() => (
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: primaryTextColor }]}>
            {contact.name}
          </Text>
          {isSelf && (
            <View style={styles.selfBadge}>
              <Text style={styles.selfBadgeText}>self</Text>
            </View>
          )}
        </View>
      )}
      description={contact.lightningAddress}
      left={() => (
        <View style={styles.avatarContainer}>
          <Avatar.Text
            size={40}
            label={initials}
            style={[styles.avatar, isSelf && styles.avatarSelf]}
            labelStyle={styles.avatarLabel}
          />
        </View>
      )}
      right={(props) => (
        <List.Icon {...props} icon="chevron-right" color={secondaryTextColor} />
      )}
      onPress={() => onPress(contact)}
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
  avatarSelf: {
    backgroundColor: '#4CAF50',
  },
  avatarLabel: {
    color: '#000000',
    fontWeight: 'bold',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
  },
  description: {
    fontSize: 13,
  },
  selfBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  selfBadgeText: {
    color: '#4CAF50',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
