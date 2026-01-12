// Notifications Settings Screen
// Configure notification preferences with actual push notification integration

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { Text, List, Switch, IconButton, Button, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useSettings } from '../../../../hooks/useSettings';
import { useAppTheme } from '../../../../contexts/ThemeContext';
import { useLanguage } from '../../../../hooks/useLanguage';

// =============================================================================
// Types
// =============================================================================

interface NotificationSettings {
  pushEnabled: boolean;
  transactionAlerts: boolean;
  paymentReceived: boolean;
  paymentSent: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function NotificationsSettingsScreen(): React.JSX.Element {
  const { settings, updateSettings } = useSettings();
  const { themeMode, theme } = useAppTheme();
  const { t } = useLanguage();

  // Local state for notification settings - initialized from persisted settings
  const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
    pushEnabled: settings?.notificationsEnabled ?? true,
    transactionAlerts: true,
    paymentReceived: settings?.notifyPaymentReceived ?? true,
    paymentSent: settings?.notifyPaymentSent ?? true,
  });

  // Dynamic colors
  const gradientColors = themeMode === 'dark'
    ? ['#1a1a2e', '#16213e', '#0f3460']
    : ['#f5f5f5', '#e8e8e8', '#d0d0d0'];
  
  const primaryTextColor = theme.colors.onBackground;
  const secondaryTextColor = theme.colors.onSurfaceVariant;

  // Setup notification handler so notifications show when app is in foreground
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }, []);

  // Sync local state with settings when they load
  useEffect(() => {
    if (settings) {
      setNotifSettings({
        pushEnabled: settings.notificationsEnabled ?? true,
        transactionAlerts: true,
        paymentReceived: settings.notifyPaymentReceived ?? true,
        paymentSent: settings.notifyPaymentSent ?? true,
      });
    }
  }, [settings]);

  // Check notification permissions on mount
  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async (): Promise<void> => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setPermissionStatus(status);
      // Only log once on mount, not on every check
    } catch (error) {
      console.error('❌ [Notifications] Failed to check permissions:', error);
    }
  };

  const requestPermissions = async (): Promise<void> => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setPermissionStatus(status);
      
      if (status === 'granted') {
        console.log('✅ [Notifications] Permission granted');
        // Update settings directly without calling handleTogglePush to avoid loop
        setNotifSettings(prev => ({ ...prev, pushEnabled: true }));
        await updateSettings({ notificationsEnabled: true });
      } else {
        console.log('⚠️ [Notifications] Permission denied');
        Alert.alert(
          t('settings.permissionDenied'),
          t('settings.enableNotificationsInSettings'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { 
              text: t('settings.openSettings'), 
              onPress: (): void => { Linking.openSettings(); }
            },
          ]
        );
      }
    } catch (error) {
      console.error('❌ [Notifications] Failed to request permissions:', error);
      Alert.alert(t('common.error'), t('settings.failedToRequestPermissions'));
    }
  };

  const handleTogglePush = async (enabled: boolean): Promise<void> => {
    try {
      // If trying to enable but no permission, request it (only once)
      if (enabled && permissionStatus !== 'granted') {
        await requestPermissions();
        return; // requestPermissions will update state if successful
      }

      // Otherwise just toggle the setting
      setNotifSettings(prev => ({ ...prev, pushEnabled: enabled }));
      await updateSettings({ notificationsEnabled: enabled });
      console.log('🔔 [Notifications] Push notifications:', enabled ? 'enabled' : 'disabled');
    } catch (error) {
      console.error('❌ [Notifications] Failed to update push setting:', error);
    }
  };

  // Note: handleToggleTransactionAlerts removed as it was unused
  // Transaction alerts are controlled via paymentReceived and paymentSent toggles

  const handleTogglePaymentReceived = async (enabled: boolean): Promise<void> => {
    setNotifSettings(prev => ({ ...prev, paymentReceived: enabled }));
    await updateSettings({ notifyPaymentReceived: enabled });
    console.log('🔔 [Notifications] Payment received alerts:', enabled ? 'enabled' : 'disabled');
  };

  const handleTogglePaymentSent = async (enabled: boolean): Promise<void> => {
    setNotifSettings(prev => ({ ...prev, paymentSent: enabled }));
    await updateSettings({ notifyPaymentSent: enabled });
    console.log('🔔 [Notifications] Payment sent alerts:', enabled ? 'enabled' : 'disabled');
  };

  // Test notification
  const sendTestNotification = async (): Promise<void> => {
    try {
      if (permissionStatus !== 'granted') {
        Alert.alert(
          t('settings.permissionRequired'),
          t('settings.enableNotificationsFirst')
        );
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: t('settings.testNotification'),
          body: t('settings.testNotificationBody'),
          data: { type: 'test' },
        },
        trigger: null, // null = immediate notification
      });

      console.log('✅ [Notifications] Test notification scheduled');
    } catch (error) {
      console.error('❌ [Notifications] Failed to send test notification:', error);
      Alert.alert(t('common.error'), t('settings.failedToSendTestNotification'));
    }
  };

  return (
    <LinearGradient
      colors={gradientColors as [string, string, ...string[]]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            iconColor={primaryTextColor}
            size={24}
            onPress={() => router.back()}
          />
          <Text style={[styles.headerTitle, { color: primaryTextColor }]}>
            {t('settings.notifications')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView}>
          {/* Permission Status */}
          {permissionStatus !== 'granted' && (
            <View style={styles.permissionBanner}>
              <Text style={styles.permissionTitle}>
                {t('settings.notificationsDisabled')}
              </Text>
              <Text style={styles.permissionText}>
                {t('settings.enableNotificationsDescription')}
              </Text>
              <Button
                mode="contained"
                onPress={requestPermissions}
                style={styles.enableButton}
                buttonColor="#FFC107"
                textColor="#1a1a2e"
              >
                {t('settings.enableNotifications')}
              </Button>
            </View>
          )}

          {/* Main Settings */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: secondaryTextColor }]}>
              {t('settings.generalSettings')}
            </Text>

            <List.Item
              title={t('settings.pushNotifications')}
              description={t('settings.pushNotificationsDescription')}
              left={(props) => (
                <List.Icon {...props} icon="bell" color="#FFC107" />
              )}
              right={() => (
                <Switch
                  value={notifSettings.pushEnabled && permissionStatus === 'granted'}
                  onValueChange={handleTogglePush}
                  disabled={permissionStatus !== 'granted'}
                />
              )}
              titleStyle={[styles.listTitle, { color: primaryTextColor }]}
              descriptionStyle={[styles.listDescription, { color: secondaryTextColor }]}
              style={styles.listItem}
            />
          </View>

          {/* Transaction Notifications */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: secondaryTextColor }]}>
              {t('settings.transactionAlerts')}
            </Text>

            <List.Item
              title={t('settings.paymentReceived')}
              description={t('settings.paymentReceivedDescription')}
              left={(props) => (
                <List.Icon {...props} icon="arrow-down" color="#4CAF50" />
              )}
              right={() => (
                <Switch
                  value={notifSettings.paymentReceived}
                  onValueChange={handleTogglePaymentReceived}
                  disabled={!notifSettings.pushEnabled || permissionStatus !== 'granted'}
                />
              )}
              titleStyle={[styles.listTitle, { color: primaryTextColor }]}
              descriptionStyle={[styles.listDescription, { color: secondaryTextColor }]}
              style={styles.listItem}
            />

            <Divider style={styles.divider} />

            <List.Item
              title={t('settings.paymentSent')}
              description={t('settings.paymentSentDescription')}
              left={(props) => (
                <List.Icon {...props} icon="arrow-up" color="#F44336" />
              )}
              right={() => (
                <Switch
                  value={notifSettings.paymentSent}
                  onValueChange={handleTogglePaymentSent}
                  disabled={!notifSettings.pushEnabled || permissionStatus !== 'granted'}
                />
              )}
              titleStyle={[styles.listTitle, { color: primaryTextColor }]}
              descriptionStyle={[styles.listDescription, { color: secondaryTextColor }]}
              style={styles.listItem}
            />
          </View>

          {/* Test Notification */}
          {permissionStatus === 'granted' && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: secondaryTextColor }]}>
                {t('settings.testing')}
              </Text>

              <List.Item
                title={t('settings.sendTestNotification')}
                description={t('settings.sendTestNotificationDescription')}
                left={(props) => (
                  <List.Icon {...props} icon="bell-ring" color="#FFC107" />
                )}
                right={(props) => (
                  <List.Icon {...props} icon="chevron-right" color={secondaryTextColor} />
                )}
                onPress={sendTestNotification}
                titleStyle={[styles.listTitle, { color: primaryTextColor }]}
                descriptionStyle={[styles.listDescription, { color: secondaryTextColor }]}
                style={styles.listItem}
              />
            </View>
          )}

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
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  permissionBanner: {
    margin: 16,
    padding: 16,
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)',
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFC107',
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 16,
    lineHeight: 20,
  },
  enableButton: {
    borderRadius: 8,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  listItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 1,
  },
  listTitle: {
    fontSize: 16,
  },
  listDescription: {
    fontSize: 13,
  },
  divider: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 1,
  },
  bottomSpacer: {
    height: 40,
  },
});
