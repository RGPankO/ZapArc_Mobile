// Blacklist Management Screen
// Manage blocked domains and addresses

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  FlatList,
} from 'react-native';
import {
  Text,
  Button,
  IconButton,
  SegmentedButtons,
} from 'react-native-paper';
import { StyledTextInput } from '../../../../components';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettings } from '../../../../hooks/useSettings';
import { useAppTheme } from '../../../../contexts/ThemeContext';
import { getGradientColors, getPrimaryTextColor, BRAND_COLOR } from '../../../../utils/theme-helpers';

// =============================================================================
// Types
// =============================================================================

interface BlacklistEntry {
  value: string;
  type: 'domain' | 'address';
  reason?: string;
  addedAt: number;
}

type FilterType = 'all' | 'domain' | 'address';

// =============================================================================
// Component
// =============================================================================

export function BlacklistScreen(): React.JSX.Element {
  const { settings, updateSettings } = useSettings();
  const { themeMode } = useAppTheme();

  // Theme colors
  const gradientColors = getGradientColors(themeMode);
  const primaryText = getPrimaryTextColor(themeMode);

  // State
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [newEntry, setNewEntry] = useState('');
  const [entryType, setEntryType] = useState<'domain' | 'address'>('domain');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    if (settings) {
      setBlacklist(settings.blacklist || []);
    }
  }, [settings]);

  // Filtered list
  const filteredBlacklist = blacklist.filter((entry) => {
    if (filterType === 'all') return true;
    return entry.type === filterType;
  });

  // Validate entry
  const isValidEntry = (value: string, type: 'domain' | 'address'): boolean => {
    if (type === 'domain') {
      const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
      return domainRegex.test(value) && value.includes('.');
    } else {
      // Lightning address format: user@domain
      const addressRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
      return addressRegex.test(value);
    }
  };

  // Add new entry
  const handleAddEntry = useCallback(() => {
    const trimmedValue = newEntry.trim().toLowerCase();
    setError(null);

    if (!trimmedValue) {
      setError(`Please enter a ${entryType}`);
      return;
    }

    if (!isValidEntry(trimmedValue, entryType)) {
      setError(
        entryType === 'domain'
          ? 'Invalid domain format (e.g., example.com)'
          : 'Invalid address format (e.g., user@domain.com)'
      );
      return;
    }

    if (blacklist.some((e) => e.value === trimmedValue)) {
      setError('Already in blacklist');
      return;
    }

    setBlacklist([
      ...blacklist,
      { value: trimmedValue, type: entryType, addedAt: Date.now() },
    ]);
    setNewEntry('');
  }, [newEntry, entryType, blacklist]);

  // Remove entry
  const handleRemoveEntry = useCallback(
    (value: string) => {
      Alert.alert(
        'Remove from Blacklist',
        `Remove "${value}" from blacklist?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              setBlacklist(blacklist.filter((e) => e.value !== value));
            },
          },
        ]
      );
    },
    [blacklist]
  );

  // Clear all
  const handleClearAll = useCallback(() => {
    if (blacklist.length === 0) return;

    Alert.alert(
      'Clear Blacklist',
      'Remove all entries from the blacklist?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => setBlacklist([]),
        },
      ]
    );
  }, [blacklist]);

  // Handle save
  const handleSave = async (): Promise<void> => {
    setIsSaving(true);

    try {
      await updateSettings({ blacklist });

      Alert.alert('Saved', 'Blacklist updated', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Render entry item
  const renderEntryItem = ({ item }: { item: BlacklistEntry }) => (
    <View style={styles.entryItem}>
      <View style={styles.entryInfo}>
        <View style={styles.entryHeader}>
          <Text style={styles.entryValue}>{item.value}</Text>
          <View
            style={[
              styles.entryTypeBadge,
              item.type === 'domain' ? styles.domainBadge : styles.addressBadge,
            ]}
          >
            <Text style={styles.entryTypeBadgeText}>
              {item.type === 'domain' ? 'Domain' : 'Address'}
            </Text>
          </View>
        </View>
        <Text style={styles.entryDate}>
          Blocked {new Date(item.addedAt).toLocaleDateString()}
        </Text>
      </View>
      <IconButton
        icon="close-circle"
        iconColor="rgba(255, 82, 82, 0.8)"
        size={24}
        onPress={() => handleRemoveEntry(item.value)}
      />
    </View>
  );

  return (
    <LinearGradient
      colors={gradientColors}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            iconColor={primaryText}
            size={24}
            onPress={() => router.back()}
          />
          <Text style={[styles.headerTitle, { color: primaryText }]}>Blacklist</Text>
          <IconButton
            icon="delete-sweep"
            iconColor={blacklist.length > 0 ? '#FF5252' : 'rgba(255,255,255,0.3)'}
            size={24}
            onPress={handleClearAll}
            disabled={blacklist.length === 0}
          />
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            {/* Add Entry */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Block Domain or Address</Text>

              {/* Type Selection */}
              <SegmentedButtons
                value={entryType}
                onValueChange={(value) => setEntryType(value as 'domain' | 'address')}
                buttons={[
                  { value: 'domain', label: 'Domain' },
                  { value: 'address', label: 'Address' },
                ]}
                style={styles.segmentedButtons}
              />

              <View style={styles.addRow}>
                <StyledTextInput
                  value={newEntry}
                  onChangeText={(text: string) => {
                    setNewEntry(text);
                    setError(null);
                  }}
                  placeholder={
                    entryType === 'domain' ? 'spam-site.com' : 'spammer@example.com'
                  }
                  mode="outlined"
                  style={styles.entryInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <IconButton
                  icon="block-helper"
                  iconColor="#FF5252"
                  size={28}
                  onPress={handleAddEntry}
                />
              </View>

              {error && <Text style={styles.errorText}>{error}</Text>}
            </View>

            {/* Filter */}
            {blacklist.length > 0 && (
              <View style={styles.filterSection}>
                <SegmentedButtons
                  value={filterType}
                  onValueChange={(value) => setFilterType(value as FilterType)}
                  buttons={[
                    { value: 'all', label: `All (${blacklist.length})` },
                    {
                      value: 'domain',
                      label: `Domains (${blacklist.filter((e) => e.type === 'domain').length})`,
                    },
                    {
                      value: 'address',
                      label: `Addresses (${blacklist.filter((e) => e.type === 'address').length})`,
                    },
                  ]}
                  style={styles.filterButtons}
                />
              </View>
            )}

            {/* Blacklist */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Blocked ({filteredBlacklist.length})
              </Text>

              {filteredBlacklist.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>🛡️</Text>
                  <Text style={styles.emptyText}>
                    {blacklist.length === 0
                      ? 'No blocked domains or addresses. Add entries to prevent receiving tips from specific sources.'
                      : 'No entries match the current filter.'}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={filteredBlacklist}
                  renderItem={renderEntryItem}
                  keyExtractor={(item) => item.value}
                  scrollEnabled={false}
                />
              )}
            </View>

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>About Blacklist</Text>
              <Text style={styles.infoText}>
                Blocked domains and addresses will not be able to send you tips.
                Use this to block spam or unwanted sources.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Save Button */}
        <View style={styles.footer}>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={isSaving}
            disabled={isSaving}
            style={styles.saveButton}
            labelStyle={styles.saveButtonLabel}
          >
            Save Changes
          </Button>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// =============================================================================
// Styles
// =============================================================================

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
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  errorText: {
    color: '#FF5252',
    fontSize: 13,
    marginTop: 8,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterButtons: {
    backgroundColor: 'transparent',
  },
  entryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  entryInfo: {
    flex: 1,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  entryValue: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  entryTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  domainBadge: {
    backgroundColor: 'rgba(100, 181, 246, 0.3)',
  },
  addressBadge: {
    backgroundColor: 'rgba(186, 104, 200, 0.3)',
  },
  entryTypeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  entryDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: BRAND_COLOR,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND_COLOR,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
  },
  footer: {
    padding: 16,
  },
  saveButton: {
    backgroundColor: BRAND_COLOR,
    borderRadius: 12,
  },
  saveButtonLabel: {
    color: '#1a1a2e',
    fontWeight: '600',
  },
});
