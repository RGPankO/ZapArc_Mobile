import React, { useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Button, Text, Card, Chip, ActivityIndicator } from 'react-native-paper';
import { StyledTextInput } from '../../../components';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { router } from 'expo-router';
import { useUserProfile, useUpdateProfile, useLogout } from '../hooks';
import { PremiumStatus } from '../../../types';

interface ProfileFormData {
  nickname: string;
  email: string;
}

const schema = yup.object({
  nickname: yup
    .string()
    .required('Nickname is required')
    .min(2, 'Nickname must be at least 2 characters'),
  email: yup
    .string()
    .required('Email is required')
    .email('Please enter a valid email address'),
});

export function ProfileScreen(): React.JSX.Element {
  const { data: profile, isLoading, error: profileError, refetch } = useUserProfile();
  const updateProfile = useUpdateProfile();
  const logout = useLogout();

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: yupResolver(schema),
    mode: 'onBlur',
  });

  useEffect(() => {
    if (profile) {
      setValue('nickname', profile.nickname);
      setValue('email', profile.email);
    }
  }, [profile, setValue]);

  const onSubmit = (data: ProfileFormData): void => {
    if (!profile) return;

    const updateData: { nickname?: string; email?: string } = {};

    if (data.nickname !== profile.nickname) {
      updateData.nickname = data.nickname;
    }

    if (data.email !== profile.email) {
      updateData.email = data.email;
    }

    if (Object.keys(updateData).length === 0) {
      Alert.alert('No Changes', 'No changes were made to your profile.');
      return;
    }

    updateProfile.mutate(updateData, {
      onSuccess: () => {
        Alert.alert(
          'Profile Updated',
          updateData.email
            ? 'Profile updated successfully. Please verify your new email address.'
            : 'Profile updated successfully.'
        );
      },
      onError: (err) => {
        Alert.alert('Update Failed', err.message || 'Failed to update profile');
      },
    });
  };

  const getPremiumStatusColor = (status: PremiumStatus): string => {
    switch (status) {
      case PremiumStatus.PREMIUM_LIFETIME:
        return '#4CAF50';
      case PremiumStatus.PREMIUM_SUBSCRIPTION:
        return '#2196F3';
      default:
        return '#9E9E9E';
    }
  };

  const getPremiumStatusText = (status: PremiumStatus): string => {
    switch (status) {
      case PremiumStatus.PREMIUM_LIFETIME:
        return 'Premium (Lifetime)';
      case PremiumStatus.PREMIUM_SUBSCRIPTION:
        return 'Premium (Subscription)';
      default:
        return 'Free';
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleLogout = (): void => {
    logout.mutate(undefined, {
      onSuccess: () => {
        router.replace('/auth/welcome');
      },
      onError: () => {
        router.replace('/auth/welcome');
      },
    });
  };

  if (profileError && !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{profileError.message || 'Failed to load profile'}</Text>
          <View style={styles.errorButtons}>
            <Button mode="contained" onPress={() => refetch()} style={styles.retryButton}>
              Retry
            </Button>
            <Button mode="outlined" onPress={handleLogout} style={styles.logoutButton}>
              Logout
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text variant="headlineMedium" style={styles.title}>
            Profile
          </Text>

          {profile && (
            <Card style={styles.statusCard}>
              <Card.Content>
                <View style={styles.statusRow}>
                  <Text variant="titleMedium">Account Status</Text>
                  <View style={styles.statusChips}>
                    <Chip
                      style={[styles.statusChip, { backgroundColor: profile.isVerified ? '#4CAF50' : '#FF9800' }]}
                      textStyle={{ color: 'white' }}
                    >
                      {profile.isVerified ? 'Verified' : 'Unverified'}
                    </Chip>
                    <Chip
                      style={[styles.statusChip, { backgroundColor: getPremiumStatusColor(profile.premiumStatus) }]}
                      textStyle={{ color: 'white' }}
                    >
                      {getPremiumStatusText(profile.premiumStatus)}
                    </Chip>
                  </View>
                </View>
                {profile.premiumStatus === PremiumStatus.FREE && (
                  <View style={styles.premiumButtonContainer}>
                    <Button
                      mode="contained"
                      onPress={() => router.push('/(main)/premium')}
                      style={styles.premiumButton}
                      contentStyle={styles.buttonContent}
                      icon="crown"
                    >
                      Upgrade to Premium
                    </Button>
                  </View>
                )}
              </Card.Content>
            </Card>
          )}

          {updateProfile.error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{updateProfile.error.message}</Text>
            </View>
          )}

          <Card style={styles.formCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Personal Information
              </Text>

              <Controller
                control={control}
                name="nickname"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={styles.inputContainer}>
                    <StyledTextInput
                      label="Nickname"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={!!errors.nickname}
                      style={styles.input}
                      mode="outlined"
                    />
                    {errors.nickname && (
                      <Text style={styles.fieldErrorText}>{errors.nickname.message}</Text>
                    )}
                  </View>
                )}
              />

              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={styles.inputContainer}>
                    <StyledTextInput
                      label="Email"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={!!errors.email}
                      style={styles.input}
                      mode="outlined"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    {errors.email && (
                      <Text style={styles.fieldErrorText}>{errors.email.message}</Text>
                    )}
                  </View>
                )}
              />

              <Button
                mode="contained"
                onPress={handleSubmit(onSubmit)}
                loading={updateProfile.isPending}
                disabled={updateProfile.isPending || !isDirty}
                style={styles.updateButton}
                contentStyle={styles.buttonContent}
              >
                Update Profile
              </Button>
            </Card.Content>
          </Card>

          {profile && (
            <Card style={styles.infoCard}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Account Information
                </Text>
                <View style={styles.infoRow}>
                  <Text variant="bodyMedium" style={styles.infoLabel}>Member since:</Text>
                  <Text variant="bodyMedium">{new Date(profile.createdAt).toLocaleDateString()}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text variant="bodyMedium" style={styles.infoLabel}>Last updated:</Text>
                  <Text variant="bodyMedium">{new Date(profile.updatedAt).toLocaleDateString()}</Text>
                </View>
                {profile.premiumExpiry && (
                  <View style={styles.infoRow}>
                    <Text variant="bodyMedium" style={styles.infoLabel}>Premium expires:</Text>
                    <Text variant="bodyMedium">{new Date(profile.premiumExpiry).toLocaleDateString()}</Text>
                  </View>
                )}
              </Card.Content>
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  retryButton: {
    flex: 1,
  },
  logoutButton: {
    flex: 1,
  },
  title: {
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: 'bold',
  },
  statusCard: {
    marginBottom: 16,
    backgroundColor: 'white',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusChips: {
    flexDirection: 'row',
    gap: 8,
  },
  statusChip: {
    marginLeft: 4,
  },
  errorBanner: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorBannerText: {
    color: '#c62828',
    fontSize: 14,
  },
  formCard: {
    marginBottom: 16,
    backgroundColor: 'white',
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
  },
  fieldErrorText: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 4,
  },
  updateButton: {
    marginTop: 8,
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  infoCard: {
    marginBottom: 16,
    backgroundColor: 'white',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontWeight: '500',
    color: '#666',
  },
  premiumButtonContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  premiumButton: {
    backgroundColor: '#FF9800',
    borderRadius: 8,
  },
});
