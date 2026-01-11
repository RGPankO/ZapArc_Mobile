// Notifications Settings Screen
// Configure notification preferences

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, List, Switch, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettings } from '../../../../hooks/useSettings';
import { useAppTheme } from '../../../../contexts/ThemeContext';

// =============================================================================
// Component
// =============================================================================

export function NotificationsSettingsScreen(): React.JSX.Element {
  const { settings, setNotificationsEnabled } = useSettings();
  const { themeMode, theme } = useAppTheme();

  // Dynamic gradient colors based on theme
  const gradientColors = themeMode === 'dark'
    ? ['#1a1a2e', '#16213e', '#0f3460']
    : ['#f5f5f5', '#e8e8e8', '#d0d0d0'];

  return (
    <LinearGradient
      colors={gradientColors as any}
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
            Notifications
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.settingsList}>
            {/* Push Notifications Toggle */}
            <List.Item
              title="Push Notifications"
              description="Receive notifications about transactions and updates"
              left={(props) => (
                <List.Icon {...props} icon="bell" color="#FFC107" />
              )}
              right={() => (
                <Switch
                  value={settings?.notificationsEnabled ?? true}
                  onValueChange={setNotificationsEnabled}
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
  settingsList: {
    marginTop: 24,
    paddingHorizontal: 16,
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
