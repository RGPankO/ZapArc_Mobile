// Domain Management Settings Screen
// Configure trusted domains for Lightning tipping

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Button,
  IconButton,
  Switch,
} from 'react-native-paper';
import { StyledTextInput } from '../../../../components';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettings } from '../../../../hooks/useSettings';
import { useAppTheme } from '../../../../contexts/ThemeContext';
import { getGradientColors, getPrimaryTextColor } from '../../../../utils/theme-helpers';

// =============================================================================
// Types
// =============================================================================

interface TrustedDomain {
  domain: string;
  addedAt: number;
}

// =============================================================================
// Component
// =============================================================================

export function DomainManagementScreen(): React.JSX.Element {
  const { settings, updateSettings } = useSettings();
  const { themeMode } = useAppTheme();

  // Theme colors
  const gradientColors = getGradientColors(themeMode);
  const primaryText = getPrimaryTextColor(themeMode);

  // State
  const [trustedDomains, setTrustedDomains] = useState<TrustedDomain[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [autoTrustVerified, setAutoTrustVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    if (settings) {
      setTrustedDomains(settings.trustedDomains || []);
      setAutoTrustVerified(settings.autoTrustVerifiedDomains || false);
    }
  }, [settings]);

  // Validate domain format
  const isValidDomain = (domain: string): boolean => {
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain) && domain.includes('.');
  };

  // Add new domain
  const handleAddDomain = useCallback(() => {
    const trimmedDomain = newDomain.trim().toLowerCase();
    setError(null);

    if (!trimmedDomain) {
      setError('Please enter a domain');
      return;
    }

    if (!isValidDomain(trimmedDomain)) {
      setError('Invalid domain format (e.g., example.com)');
      return;
    }

    if (trustedDomains.some((d) => d.domain === trimmedDomain)) {
      setError('Domain already in trusted list');
      return;
    }

    setTrustedDomains([
      ...trustedDomains,
      { domain: trimmedDomain, addedAt: Date.now() },
    ]);
    setNewDomain('');
  }, [newDomain, trustedDomains]);

  // Remove domain
  const handleRemoveDomain = useCallback(
    (domain: string) => {
      Alert.alert(
        'Remove Domain',
        `Remove "${domain}" from trusted domains?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              setTrustedDomains(trustedDomains.filter((d) => d.domain !== domain));
            },
          },
        ]
      );
    },
    [trustedDomains]
  );

  // Handle save
  const handleSave = async (): Promise<void> => {
    setIsSaving(true);

    try {
      await updateSettings({
        trustedDomains,
        autoTrustVerifiedDomains: autoTrustVerified,
      });

      Alert.alert('Saved', 'Domain settings updated', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Render domain item
  const renderDomainItem = ({ item }: { item: TrustedDomain }) => (
    <View style={styles.domainItem}>
      <View style={styles.domainInfo}>
        <Text style={styles.domainText}>{item.domain}</Text>
        <Text style={styles.domainDate}>
          Added {new Date(item.addedAt).toLocaleDateString()}
        </Text>
      </View>
      <IconButton
        icon="close-circle"
        iconColor="rgba(255, 82, 82, 0.8)"
        size={24}
        onPress={() => handleRemoveDomain(item.domain)}
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
          <Text style={[styles.headerTitle, { color: primaryText }]}>Trusted Domains</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            {/* Auto-trust Toggle */}
            <View style={styles.section}>
              <View style={styles.switchRow}>
                <View style={styles.switchContent}>
                  <Text style={styles.switchTitle}>Auto-trust Verified</Text>
                  <Text style={styles.switchDescription}>
                    Automatically trust domains with valid NIP-05 verification
                  </Text>
                </View>
                <Switch
                  value={autoTrustVerified}
                  onValueChange={setAutoTrustVerified}
                  color="#FFC107"
                />
              </View>
            </View>

            {/* Add Domain */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Add Trusted Domain</Text>

              <View style={styles.addRow}>
                <StyledTextInput
                  value={newDomain}
                  onChangeText={(text: string) => {
                    setNewDomain(text);
                    setError(null);
                  }}
                  placeholder="example.com"
                  mode="outlined"
                  style={styles.domainInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <IconButton
                  icon="plus-circle"
                  iconColor="#FFC107"
                  size={28}
                  onPress={handleAddDomain}
                />
              </View>

              {error && <Text style={styles.errorText}>{error}</Text>}
            </View>

            {/* Domain List */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Trusted Domains ({trustedDomains.length})
              </Text>

              {trustedDomains.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>🔒</Text>
                  <Text style={styles.emptyText}>
                    No trusted domains yet. Add domains you trust for Lightning
                    tipping.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={trustedDomains}
                  renderItem={renderDomainItem}
                  keyExtractor={(item) => item.domain}
                  scrollEnabled={false}
                />
              )}
            </View>

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>About Trusted Domains</Text>
              <Text style={styles.infoText}>
                Trusted domains are allowed to receive tips without additional
                confirmation prompts. Only add domains you fully trust.
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
  headerSpacer: {
    width: 48,
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchContent: {
    flex: 1,
    marginRight: 16,
  },
  switchTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  domainInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  errorText: {
    color: '#FF5252',
    fontSize: 13,
    marginTop: 8,
  },
  domainItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  domainInfo: {
    flex: 1,
  },
  domainText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  domainDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 2,
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
    borderLeftColor: '#FFC107',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFC107',
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
    backgroundColor: '#FFC107',
    borderRadius: 12,
  },
  saveButtonLabel: {
    color: '#1a1a2e',
    fontWeight: '600',
  },
});
