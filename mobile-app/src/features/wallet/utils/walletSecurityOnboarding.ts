import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import { settingsService } from '../../../services';

const WALLET_SECURITY_ONBOARDING_KEY = '@zap_arc/wallet_security_onboarding_v1';

type WalletSecurityContext = 'create' | 'restore';

interface OnboardingState {
  skipped: boolean;
}

async function getOnboardingState(): Promise<OnboardingState | null> {
  try {
    const value = await AsyncStorage.getItem(WALLET_SECURITY_ONBOARDING_KEY);
    return value ? (JSON.parse(value) as OnboardingState) : null;
  } catch {
    return null;
  }
}

async function setOnboardingState(state: OnboardingState): Promise<void> {
  await AsyncStorage.setItem(WALLET_SECURITY_ONBOARDING_KEY, JSON.stringify(state));
}

function askContinue(context: WalletSecurityContext): Promise<boolean> {
  const title = context === 'restore' ? 'Secure your restored wallet' : 'Protect your wallet';
  const message =
    context === 'restore'
      ? 'Enable biometric unlock and payment alerts to secure your restored wallet and stay on top of incoming transactions.'
      : 'Enable biometric unlock and payment alerts for stronger security and instant payment updates.';

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Continue', onPress: () => resolve(true) },
    ]);
  });
}

async function enableBiometricsIfNeeded(): Promise<void> {
  const settings = await settingsService.getUserSettings();
  if (settings.biometricEnabled) return;

  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!hasHardware || !isEnrolled) return;

  const authResult = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Enable biometric unlock',
    cancelLabel: 'Skip',
  });

  if (authResult.success) {
    await settingsService.updateUserSettings({ biometricEnabled: true });
  }
}

async function enableNotificationsIfNeeded(): Promise<void> {
  const settings = await settingsService.getUserSettings();
  const { status } = await Notifications.getPermissionsAsync();

  if (status === 'granted') {
    if (!settings.notificationsEnabled || !settings.notifyPaymentReceived) {
      await settingsService.updateUserSettings({
        notificationsEnabled: true,
        notifyPaymentReceived: true,
      });
    }
    return;
  }

  const requested = await Notifications.requestPermissionsAsync();
  await settingsService.updateUserSettings({
    notificationsEnabled: requested.status === 'granted',
    notifyPaymentReceived: requested.status === 'granted',
  });
}

export async function runWalletSecurityOnboarding(context: WalletSecurityContext): Promise<void> {
  const existingState = await getOnboardingState();
  if (existingState) return;

  const shouldContinue = await askContinue(context);
  if (!shouldContinue) {
    await setOnboardingState({ skipped: true });
    return;
  }

  await enableBiometricsIfNeeded();
  await enableNotificationsIfNeeded();
  await setOnboardingState({ skipped: false });
}

export async function shouldShowWalletSecurityReminderBadge(): Promise<boolean> {
  const state = await getOnboardingState();
  if (!state?.skipped) return false;

  const settings = await settingsService.getUserSettings();
  return !(settings.biometricEnabled && settings.notificationsEnabled);
}
