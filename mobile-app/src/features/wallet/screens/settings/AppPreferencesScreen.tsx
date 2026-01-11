// Theme Settings Screen
// Configure app theme and display preferences

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, List, Switch, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../../../../contexts/ThemeContext';

// =============================================================================
// Component
// =============================================================================

export function ThemeSettingsScreen(): React.JSX.Element {
  const { themeMode, toggleTheme, theme } = useAppTheme();

  // Dynamic gradient colors based on theme
  const gradientColors = themeMode === 'dark'
    ? ['#1a1a2e', '#16213e', '#0f3460']
    : ['#f5f5f5', '#e8e8e8', '#d0d0d0'];

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
            iconColor={theme.colors.onBackground}
            size={24}
            onPress={() => router.back()}
          />
          <Text style={[styles.headerTitle, { color: theme.colors.onBackground }]}>
            Theme
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.settingsList}>
            {/* Dark Mode Toggle */}
            <List.Item
              title="Dark Mode"
              description="Use dark theme throughout the app"
              left={(props) => (
                <List.Icon {...props} icon="theme-light-dark" color="#FFC107" />
              )}
              right={() => (
                <Switch
                  value={themeMode === 'dark'}
                  onValueChange={toggleTheme}
                />
              )}
              titleStyle={[styles.listTitle, { color: theme.colors.onSurface }]}
              descriptionStyle={[styles.listDescription, { color: theme.colors.onSurfaceVariant }]}
              style={styles.listItem}
            />
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
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
    // Color is dynamic, set inline
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    // Color is dynamic, set inline
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  listItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 1,
  },
  listTitle: {
    // Color is dynamic, set inline
    fontSize: 16,
  },
  listDescription: {
    // Color is dynamic, set inline
    fontSize: 13,
  },
  bottomSpacer: {
    height: 40,
  },
});
