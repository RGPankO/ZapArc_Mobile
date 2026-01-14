// Default Amounts Settings Screen
// Configure default tip amounts for posting and tipping

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, IconButton, Chip } from 'react-native-paper';
import { StyledTextInput } from '../../../../components';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettings } from '../../../../hooks/useSettings';
import { useLanguage } from '../../../../hooks/useLanguage';
import { useAppTheme } from '../../../../contexts/ThemeContext';
import { getGradientColors, getPrimaryTextColor, getSecondaryTextColor } from '../../../../utils/theme-helpers';
import { validateTipAmounts } from '../../../../utils/lnurl';

// =============================================================================
// Constants
// =============================================================================

const PRESET_AMOUNTS = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000];
const MAX_AMOUNT = 100_000_000; // 1 BTC in sats

// =============================================================================
// Component
// =============================================================================

export function AmountsSettingsScreen(): React.JSX.Element {
  const { settings, updateSettings } = useSettings();
  const { t } = useLanguage();
  const { themeMode } = useAppTheme();

  // Get theme colors
  const gradientColors = getGradientColors(themeMode);
  const primaryText = getPrimaryTextColor(themeMode);
  const secondaryText = getSecondaryTextColor(themeMode);

  // State for posting amounts (when creating tips)
  const [postingAmounts, setPostingAmounts] = useState<[number, number, number]>([100, 500, 1000]);
  // State for tipping amounts (when tipping others)
  const [tippingAmounts, setTippingAmounts] = useState<[number, number, number]>([100, 500, 1000]);

  const [editingField, setEditingField] = useState<{
    type: 'posting' | 'tipping';
    index: number;
  } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    if (settings) {
      setPostingAmounts(settings.defaultPostingAmounts || [100, 500, 1000]);
      setTippingAmounts(settings.defaultTippingAmounts || [100, 500, 1000]);
    }
  }, [settings]);

  // Start editing an amount
  const startEdit = (type: 'posting' | 'tipping', index: number): void => {
    const amounts = type === 'posting' ? postingAmounts : tippingAmounts;
    setEditingField({ type, index });
    setEditValue(amounts[index].toString());
    setError(null);
  };

  // Apply edit
  const applyEdit = (): void => {
    if (!editingField) return;

    const value = parseInt(editValue, 10);

    if (isNaN(value) || value <= 0) {
      setError('Please enter a valid positive number');
      return;
    }

    if (value > MAX_AMOUNT) {
      setError(`Maximum amount is ${MAX_AMOUNT.toLocaleString()} sats (1 BTC)`);
      return;
    }

    const { type, index } = editingField;
    const amounts = type === 'posting' ? [...postingAmounts] : [...tippingAmounts];

    // Check for duplicates
    const otherAmounts = amounts.filter((_, i) => i !== index);
    if (otherAmounts.includes(value)) {
      setError('All three amounts must be unique');
      return;
    }

    amounts[index] = value;

    if (type === 'posting') {
      setPostingAmounts(amounts as [number, number, number]);
    } else {
      setTippingAmounts(amounts as [number, number, number]);
    }

    setEditingField(null);
    setEditValue('');
    setError(null);
  };

  // Cancel edit
  const cancelEdit = (): void => {
    setEditingField(null);
    setEditValue('');
    setError(null);
  };

  // Select preset amount
  const selectPreset = (value: number): void => {
    if (!editingField) return;
    setEditValue(value.toString());
  };

  // Handle save
  const handleSave = async (): Promise<void> => {
    // Validate posting amounts
    const postingValidation = validateTipAmounts(postingAmounts);
    if (!postingValidation.isValid) {
      setError(`Posting amounts: ${postingValidation.error}`);
      return;
    }

    // Validate tipping amounts
    const tippingValidation = validateTipAmounts(tippingAmounts);
    if (!tippingValidation.isValid) {
      setError(`Tipping amounts: ${tippingValidation.error}`);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await updateSettings({
        defaultPostingAmounts: postingAmounts,
        defaultTippingAmounts: tippingAmounts,
      });

      Alert.alert('Saved', 'Default amounts updated', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      setError('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Render amount row
  const renderAmountRow = (
    type: 'posting' | 'tipping',
    index: number,
    label: string
  ): React.JSX.Element => {
    const amounts = type === 'posting' ? postingAmounts : tippingAmounts;
    const isEditing =
      editingField?.type === type && editingField?.index === index;

    return (
      <View style={styles.amountRow} key={`${type}-${index}`}>
        <Text style={[styles.amountLabel, { color: secondaryText }]}>{label}</Text>
        {isEditing ? (
          <View style={styles.editContainer}>
            <StyledTextInput
              value={editValue}
              onChangeText={setEditValue}
              keyboardType="numeric"
              mode="outlined"
              style={styles.editInput}
              autoFocus
            />
            <IconButton
              icon="check"
              iconColor="#4CAF50"
              size={20}
              onPress={applyEdit}
            />
            <IconButton
              icon="close"
              iconColor="#FF5252"
              size={20}
              onPress={cancelEdit}
            />
          </View>
        ) : (
          <View style={styles.amountValue} onTouchEnd={() => startEdit(type, index)}>
            <Text style={styles.amountValueText}>
              {amounts[index].toLocaleString()} sats
            </Text>
            <IconButton
              icon="pencil"
              iconColor={secondaryText}
              size={16}
            />
          </View>
        )}
      </View>
    );
  };

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
          <Text style={[styles.headerTitle, { color: primaryText }]}>
            {t('settings.defaultTipAmounts')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            {/* Posting Amounts */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: primaryText }]}>Tip Request Amounts</Text>
              <Text style={[styles.sectionDescription, { color: secondaryText }]}>
                Default amounts shown when creating tip requests
              </Text>

              {renderAmountRow('posting', 0, 'Small')}
              {renderAmountRow('posting', 1, 'Medium')}
              {renderAmountRow('posting', 2, 'Large')}
            </View>

            {/* Tipping Amounts */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: primaryText }]}>Tipping Amounts</Text>
              <Text style={[styles.sectionDescription, { color: secondaryText }]}>
                Default amounts shown when tipping others
              </Text>

              {renderAmountRow('tipping', 0, 'Small')}
              {renderAmountRow('tipping', 1, 'Medium')}
              {renderAmountRow('tipping', 2, 'Large')}
            </View>

            {/* Presets (shown when editing) */}
            {editingField && (
              <View style={styles.presetsSection}>
                <Text style={[styles.presetsTitle, { color: secondaryText }]}>Quick Select</Text>
                <View style={styles.presetsContainer}>
                  {PRESET_AMOUNTS.map((preset) => (
                    <Chip
                      key={preset}
                      onPress={() => selectPreset(preset)}
                      style={styles.presetChip}
                      textStyle={[styles.presetChipText, { color: primaryText }]}
                    >
                      {preset.toLocaleString()}
                    </Chip>
                  ))}
                </View>
              </View>
            )}

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>About Amounts</Text>
              <Text style={[styles.infoText, { color: secondaryText }]}>
                • All amounts must be unique{'\n'}
                • Maximum amount is 100,000,000 sats (1 BTC){'\n'}
                • Minimum amount is 1 sat
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
            disabled={isSaving || editingField !== null}
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
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 16,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  amountLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  amountValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountValueText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFC107',
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 120,
    height: 40,
  },
  presetsSection: {
    marginBottom: 16,
  },
  presetsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 12,
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  presetChipText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 82, 82, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#FF5252',
    fontSize: 14,
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
