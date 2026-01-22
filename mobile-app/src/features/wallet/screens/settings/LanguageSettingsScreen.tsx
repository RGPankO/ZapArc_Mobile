// Language Settings Screen
// Configure app language and location-based detection

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, RadioButton, Button, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettings } from '../../../../hooks/useSettings';
import { useLanguage } from '../../../../hooks/useLanguage';
import { useAppTheme } from '../../../../contexts/ThemeContext';
import { getGradientColors, getPrimaryTextColor, getSecondaryTextColor, BRAND_COLOR } from '../../../../utils/theme-helpers';

// =============================================================================
// Component
// =============================================================================

export function LanguageSettingsScreen(): React.JSX.Element {
  const { settings, updateSettings } = useSettings();
  const { currentLanguage, setLanguage, resetToAuto, t } = useLanguage();
  const { themeMode } = useAppTheme();

  const gradientColors = getGradientColors(themeMode);
  const primaryText = getPrimaryTextColor(themeMode);
  const secondaryText = getSecondaryTextColor(themeMode);

  // State - use settings.language which can be 'auto', 'en', or 'bg'
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'bg' | 'auto'>('auto');
  const [isSaving, setIsSaving] = useState(false);

  // Load current settings
  useEffect(() => {
    if (settings?.language) {
      setSelectedLanguage(settings.language);
    }
  }, [settings]);

  // Handle save
  const handleSave = async (): Promise<void> => {
    setIsSaving(true);

    try {
      console.log('🌐 [LanguageSettings] Saving language:', selectedLanguage);
      
      // Update settings first
      await updateSettings({
        language: selectedLanguage,
      });
      console.log('✅ [LanguageSettings] Settings updated');

      // Apply language change through i18n hook
      if (selectedLanguage === 'auto') {
        await resetToAuto();
      } else if (selectedLanguage === 'en' || selectedLanguage === 'bg') {
        await setLanguage(selectedLanguage);
      }
      console.log('✅ [LanguageSettings] Language applied');

      // Small delay to let language change take effect
      await new Promise(resolve => setTimeout(resolve, 100));

      // Navigate back silently (no Alert to prevent app restart)
      console.log('🌐 [LanguageSettings] Navigating back');
      router.back();
    } catch (error) {
      console.error('❌ [LanguageSettings] Save failed:', error);
      console.error('❌ [LanguageSettings] Error details:', JSON.stringify(error));
      
      // Only show Alert on error
      Alert.alert('Error', `Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
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
          <Text style={[styles.headerTitle, { color: primaryText }]}>{t('settings.language')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            {/* Language Selection */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: primaryText }]}>{t('settings.selectLanguage')}</Text>

              <RadioButton.Group
                onValueChange={(value) =>
                  setSelectedLanguage(value as 'en' | 'bg' | 'auto')
                }
                value={selectedLanguage}
              >
                <View style={styles.radioItem}>
                  <RadioButton.Android
                    value="auto"
                    color={BRAND_COLOR}
                    uncheckedColor={secondaryText}
                  />
                  <View style={styles.radioContent}>
                    <Text style={[styles.radioTitle, { color: primaryText }]}>
                      {t('settings.automaticLocationBased')}
                    </Text>
                    <Text style={[styles.radioDescription, { color: secondaryText }]}>
                      {t('settings.languageDetectionDescription')}
                    </Text>
                  </View>
                </View>

                <View style={styles.radioItem}>
                  <RadioButton.Android
                    value="en"
                    color={BRAND_COLOR}
                    uncheckedColor={secondaryText}
                  />
                  <View style={styles.radioContent}>
                    <View style={styles.radioTitleRow}>
                      <Text style={[styles.radioTitle, { color: primaryText }]}>{t('settings.english')}</Text>
                      <Text style={styles.flag}>🇬🇧</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.radioItem}>
                  <RadioButton.Android
                    value="bg"
                    color={BRAND_COLOR}
                    uncheckedColor={secondaryText}
                  />
                  <View style={styles.radioContent}>
                    <View style={styles.radioTitleRow}>
                      <Text style={[styles.radioTitle, { color: primaryText }]}>{t('settings.bulgarian')}</Text>
                      <Text style={styles.flag}>🇧🇬</Text>
                    </View>
                  </View>
                </View>
              </RadioButton.Group>
            </View>

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>{t('settings.aboutLanguageDetection')}</Text>
              <Text style={[styles.infoText, { color: secondaryText }]}>
                {t('settings.languageDetectionInfo')}
              </Text>
              <Text style={[styles.infoText, { color: secondaryText, marginTop: 8 }]}>
                {t('settings.currentLanguage', { language: currentLanguage === 'en' ? 'English 🇬🇧' : 'Български 🇧🇬' })}
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
            {t('settings.saveChanges')}
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
  radioItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  radioContent: {
    flex: 1,
    marginLeft: 8,
  },
  radioTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  radioDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  flag: {
    fontSize: 20,
    marginLeft: 8,
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
