import { Platform } from 'react-native';
import { initializeSslPinning } from 'react-native-ssl-public-key-pinning';
import { SecurityConfig, hasPinningMaterial } from '../config/security';

let initialized = false;

export const initializeTlsPinning = async (): Promise<void> => {
  if (initialized || Platform.OS === 'web') return;

  if (!hasPinningMaterial()) {
    console.warn('[TLS Pinning] disabled: missing EXPO_PUBLIC_API_PINNED_KEYS or API host');
    initialized = true;
    return;
  }

  try {
    await initializeSslPinning({
      ...SecurityConfig.pinnedDomains,
    });
    initialized = true;
    console.log('[TLS Pinning] initialized');
  } catch (error) {
    console.warn('[TLS Pinning] initialization failed:', error);
  }
};

export const isTlsPinningError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /pinning|certificate|ssl/i.test(message);
};
