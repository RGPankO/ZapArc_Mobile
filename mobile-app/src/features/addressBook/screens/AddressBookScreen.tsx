/**
 * AddressBookScreen
 * Main screen for viewing and managing contacts
 */

import React, { useCallback } from 'react';
import { StyleSheet, View, FlatList, RefreshControl } from 'react-native';
import { Text, IconButton, FAB, Divider, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { t } from '../../../services/i18nService';
import { useAppTheme } from '../../../contexts/ThemeContext';
import {
  getGradientColors,
  getPrimaryTextColor,
  getSecondaryTextColor,
  BRAND_COLOR,
} from '../../../utils/theme-helpers';
import { Contact } from '../types';
import { useContacts } from '../hooks/useContacts';
import { useContactSearch } from '../hooks/useContactSearch';
import { useLightningAddress } from '../../../hooks/useLightningAddress';
import { ContactListItem } from '../components/ContactListItem';
import { ContactSearchBar } from '../components/ContactSearchBar';
import { EmptyAddressBook } from '../components/EmptyAddressBook';

export function AddressBookScreen(): React.JSX.Element {
  const { themeMode } = useAppTheme();
  const { contacts, loading, refreshContacts } = useContacts();
  const { searchQuery, setSearchQuery, filteredContacts, isSearching } =
    useContactSearch(contacts);
  const { addressInfo } = useLightningAddress();

  const gradientColors = getGradientColors(themeMode);
  const primaryTextColor = getPrimaryTextColor(themeMode);
  const secondaryTextColor = getSecondaryTextColor(themeMode);

  // Get the current user's Lightning Address (normalized for comparison)
  const myAddress = addressInfo?.lightningAddress?.toLowerCase().trim();

  // Refresh contacts when screen comes into focus (e.g., after adding a new contact)
  useFocusEffect(
    useCallback(() => {
      refreshContacts();
    }, [refreshContacts])
  );

  const handleContactPress = useCallback((contact: Contact) => {
    router.push(`/wallet/settings/address-book/${contact.id}`);
  }, []);

  const handleAddContact = useCallback(() => {
    router.push('/wallet/settings/address-book/add');
  }, []);

  const renderContact = useCallback(
    ({ item }: { item: Contact }) => {
      // Check if this contact's address matches the user's own address
      const isSelf = myAddress ? item.lightningAddress.toLowerCase().trim() === myAddress : false;
      
      return (
        <ContactListItem
          contact={item}
          onPress={handleContactPress}
          primaryTextColor={primaryTextColor}
          secondaryTextColor={secondaryTextColor}
          isSelf={isSelf}
        />
      );
    },
    [handleContactPress, primaryTextColor, secondaryTextColor, myAddress]
  );

  const renderSeparator = useCallback(
    () => <Divider style={styles.divider} />,
    []
  );

  const renderEmpty = useCallback(() => {
    if (loading) return null;

    return (
      <EmptyAddressBook
        onAddContact={handleAddContact}
        primaryTextColor={primaryTextColor}
        secondaryTextColor={secondaryTextColor}
        isSearchResult={searchQuery.length > 0}
      />
    );
  }, [
    loading,
    handleAddContact,
    primaryTextColor,
    secondaryTextColor,
    searchQuery,
  ]);

  const keyExtractor = useCallback((item: Contact) => item.id, []);

  return (
    <LinearGradient colors={gradientColors} style={styles.gradient}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            iconColor={primaryTextColor}
            size={24}
            onPress={() => router.back()}
          />
          <Text style={[styles.headerTitle, { color: primaryTextColor }]}>
            {t('addressBook.title')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Search Bar */}
        {contacts.length > 0 && (
          <ContactSearchBar value={searchQuery} onChangeText={setSearchQuery} />
        )}

        {/* Loading State */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={BRAND_COLOR} />
          </View>
        ) : (
          <FlatList
            data={filteredContacts}
            renderItem={renderContact}
            keyExtractor={keyExtractor}
            ItemSeparatorComponent={renderSeparator}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={
              filteredContacts.length === 0
                ? styles.emptyListContent
                : styles.listContent
            }
            refreshControl={
              <RefreshControl
                refreshing={isSearching}
                onRefresh={refreshContacts}
                tintColor={BRAND_COLOR}
              />
            }
          />
        )}

        {/* FAB for adding contacts */}
        {contacts.length > 0 && !loading && (
          <FAB
            icon="plus"
            style={styles.fab}
            color="#000000"
            onPress={handleAddContact}
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSpacer: {
    width: 48,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 80,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  divider: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginLeft: 72,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: BRAND_COLOR,
  },
});
