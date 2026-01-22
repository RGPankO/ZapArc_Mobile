/**
 * ContactSelectionModal Component
 * Modal for selecting a contact when sending payment
 */

import React from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity } from 'react-native';
import { Modal, Portal, Text, IconButton, Avatar, Divider } from 'react-native-paper';
import { Contact } from '../types';
import { ContactSearchBar } from './ContactSearchBar';
import { useContactSearch } from '../hooks/useContactSearch';
import { t } from '../../../services/i18nService';

interface ContactSelectionModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSelect: (contact: Contact) => void;
  contacts: Contact[];
  /** Current user's Lightning Address to detect self */
  myAddress?: string;
}

export function ContactSelectionModal({
  visible,
  onDismiss,
  onSelect,
  contacts,
  myAddress,
}: ContactSelectionModalProps): React.JSX.Element {
  const { searchQuery, setSearchQuery, filteredContacts } = useContactSearch(contacts);

  const handleSelect = (contact: Contact) => {
    onSelect(contact);
    setSearchQuery('');
    onDismiss();
  };

  const renderContact = ({ item }: { item: Contact }) => {
    const initials = item.name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    const isSelf = myAddress ? item.lightningAddress.toLowerCase().trim() === myAddress.toLowerCase().trim() : false;

    return (
      <TouchableOpacity
        style={styles.contactItem}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
      >
        <Avatar.Text
          size={40}
          label={initials}
          style={[styles.avatar, isSelf && styles.avatarSelf]}
          labelStyle={styles.avatarLabel}
        />
        <View style={styles.contactInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.contactName}>{item.name}</Text>
            {isSelf && (
              <View style={styles.selfBadge}>
                <Text style={styles.selfBadgeText}>{t('addressBook.self')}</Text>
              </View>
            )}
          </View>
          <Text style={styles.contactAddress}>{item.lightningAddress}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSeparator = () => <Divider style={styles.divider} />;

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        {searchQuery ? t('addressBook.noContactsFound') : t('addressBook.noContacts')}
      </Text>
    </View>
  );

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContent}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('addressBook.selectContact')}</Text>
          <IconButton
            icon="close"
            iconColor="#FFFFFF"
            size={24}
            onPress={onDismiss}
          />
        </View>

        <ContactSearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('addressBook.searchContacts')}
        />

        <FlatList
          data={filteredContacts}
          renderItem={renderContact}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={renderSeparator}
          ListEmptyComponent={renderEmpty}
          style={styles.list}
          contentContainerStyle={
            filteredContacts.length === 0 ? styles.emptyListContent : undefined
          }
        />
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    backgroundColor: '#1a1a2e',
    margin: 20,
    borderRadius: 16,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 4,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  list: {
    maxHeight: 400,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
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
  contactInfo: {
    marginLeft: 12,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  contactAddress: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
  },
  divider: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginLeft: 68,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
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
