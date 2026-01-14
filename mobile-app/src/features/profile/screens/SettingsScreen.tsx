import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Text, Card, List, Switch, Dialog, Portal, useTheme, MD3Theme } from 'react-native-paper';
import { StyledTextInput } from '../../../components';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { router } from 'expo-router';
import { useChangePassword, useDeleteAccount, useSettings } from '../../../hooks';
import { useLogout } from '../hooks';
import { useAppTheme } from '../../../contexts/ThemeContext';

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const passwordSchema = yup.object({
  currentPassword: yup
    .string()
    .required('Current password is required'),
  newPassword: yup
    .string()
    .required('New password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
    .matches(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: yup
    .string()
    .required('Please confirm your new password')
    .oneOf([yup.ref('newPassword')], 'Passwords must match'),
});

export function SettingsScreen(): React.JSX.Element {
  const theme = useTheme();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // App preferences
  const { settings, setNotificationsEnabled } = useSettings();
  const { themeMode, toggleTheme } = useAppTheme();
  const [autoSync, setAutoSync] = useState(true);

  const changePassword = useChangePassword();
  const logout = useLogout();
  const deleteAccount = useDeleteAccount();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormData>({
    resolver: yupResolver(passwordSchema),
    mode: 'onBlur',
  });

  const onPasswordSubmit = (data: PasswordFormData): void => {
    setError(null);

    changePassword.mutate(
      { currentPassword: data.currentPassword, newPassword: data.newPassword },
      {
        onSuccess: () => {
          Alert.alert(
            'Password Changed',
            'Your password has been changed successfully. You will need to log in again.',
            [
              {
                text: 'OK',
                onPress: (): void => {
                  setShowPasswordForm(false);
                  reset();
                  handleLogout();
                },
              },
            ]
          );
        },
        onError: (err) => {
          setError(err.message || 'Failed to change password');
        },
      }
    );
  };

  const handleLogout = (): void => {
    logout.mutate(undefined, {
      onSuccess: () => {
        router.replace('/auth/welcome');
      },
      onError: (err) => {
        Alert.alert('Logout Failed', err.message || 'Failed to logout');
      },
    });
  };

  const handleDeleteAccount = (): void => {
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        Alert.alert(
          'Account Deleted',
          'Your account has been permanently deleted.',
          [
            {
              text: 'OK',
              onPress: (): void => router.replace('/auth/welcome'),
            },
          ]
        );
      },
      onError: (err) => {
        Alert.alert('Delete Failed', err.message || 'Failed to delete account');
      },
      onSettled: () => {
        setShowDeleteDialog(false);
      },
    });
  };

  const confirmDeleteAccount = (): void => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: (): void => setShowDeleteDialog(true),
        },
      ]
    );
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text variant="headlineMedium" style={styles.title}>
            Settings
          </Text>

          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Wallet & Data
              </Text>

              <List.Item
                title="Archived Wallets"
                description="View and restore hidden sub-wallets"
                left={(props) => <List.Icon {...props} icon="archive" />}
                onPress={() => router.push('/wallet/archived')}
              />
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                App Preferences
              </Text>

              <List.Item
                title="Push Notifications"
                description="Receive notifications about app updates"
                right={() => (
                  <Switch
                    value={settings?.notificationsEnabled ?? true}
                    onValueChange={setNotificationsEnabled}
                  />
                )}
              />

              <List.Item
                title="Dark Mode"
                description="Use dark theme throughout the app"
                right={() => (
                  <Switch
                    value={themeMode === 'dark'}
                    onValueChange={toggleTheme}
                  />
                )}
              />

              <List.Item
                title="Auto Sync"
                description="Automatically sync data when connected"
                right={() => (
                  <Switch
                    value={autoSync}
                    onValueChange={setAutoSync}
                  />
                )}
              />
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Account Security
              </Text>

              <List.Item
                title="Change Password"
                description="Update your account password"
                left={(props) => <List.Icon {...props} icon="lock" />}
                onPress={() => setShowPasswordForm(true)}
              />
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Account Actions
              </Text>

              <List.Item
                title="Logout"
                description="Sign out of your account"
                left={(props) => <List.Icon {...props} icon="logout" />}
                onPress={handleLogout}
                disabled={logout.isPending}
              />

              <List.Item
                title="Delete Account"
                description="Permanently delete your account"
                left={(props) => <List.Icon {...props} icon="delete" />}
                titleStyle={styles.dangerText}
                onPress={confirmDeleteAccount}
                disabled={deleteAccount.isPending}
              />
            </Card.Content>
          </Card>
        </View>
      </ScrollView>

      <Portal>
        <Dialog visible={showPasswordForm} onDismiss={() => setShowPasswordForm(false)}>
          <Dialog.Title>Change Password</Dialog.Title>
          <Dialog.Content>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Controller
              control={control}
              name="currentPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputContainer}>
                  <StyledTextInput
                    label="Current Password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={!!errors.currentPassword}
                    style={styles.input}
                    mode="outlined"
                    secureTextEntry={!showCurrentPassword}
                    right={
                      <TextInput.Icon
                        icon={showCurrentPassword ? 'eye-off' : 'eye'}
                        onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                      />
                    }
                  />
                  {errors.currentPassword && (
                    <Text style={styles.fieldError}>{errors.currentPassword.message}</Text>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="newPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputContainer}>
                  <StyledTextInput
                    label="New Password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={!!errors.newPassword}
                    style={styles.input}
                    mode="outlined"
                    secureTextEntry={!showNewPassword}
                    right={
                      <TextInput.Icon
                        icon={showNewPassword ? 'eye-off' : 'eye'}
                        onPress={() => setShowNewPassword(!showNewPassword)}
                      />
                    }
                  />
                  {errors.newPassword && (
                    <Text style={styles.fieldError}>{errors.newPassword.message}</Text>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputContainer}>
                  <StyledTextInput
                    label="Confirm New Password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={!!errors.confirmPassword}
                    style={styles.input}
                    mode="outlined"
                    secureTextEntry={!showConfirmPassword}
                    right={
                      <TextInput.Icon
                        icon={showConfirmPassword ? 'eye-off' : 'eye'}
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      />
                    }
                  />
                  {errors.confirmPassword && (
                    <Text style={styles.fieldError}>{errors.confirmPassword.message}</Text>
                  )}
                </View>
              )}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowPasswordForm(false)}>Cancel</Button>
            <Button
              mode="contained"
              onPress={handleSubmit(onPasswordSubmit)}
              loading={changePassword.isPending}
              disabled={changePassword.isPending}
            >
              Change Password
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
          <Dialog.Title>Confirm Account Deletion</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              This will permanently delete your account and all associated data.
              This action cannot be undone.
            </Text>
            <Text variant="bodyMedium" style={styles.warningText}>
              Are you absolutely sure you want to continue?
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button
              mode="contained"
              buttonColor="#f44336"
              onPress={handleDeleteAccount}
              loading={deleteAccount.isPending}
              disabled={deleteAccount.isPending}
            >
              Delete Account
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const createStyles = (theme: MD3Theme): ReturnType<typeof StyleSheet.create> => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    textAlign: 'center' as const,
    marginBottom: 24,
    fontWeight: 'bold' as const,
    color: theme.colors.onBackground,
  },
  card: {
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
  },
  sectionTitle: {
    marginBottom: 8,
    fontWeight: 'bold' as const,
    color: theme.colors.onSurface,
  },
  dangerText: {
    color: '#f44336',
  },
  errorBanner: {
    backgroundColor: theme.dark ? 'rgba(244, 67, 54, 0.1)' : '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorText: {
    color: '#f44336',
    fontSize: 14,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
  },
  fieldError: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 4,
  },
  warningText: {
    marginTop: 16,
    fontWeight: 'bold' as const,
    color: '#f44336',
  },
});
