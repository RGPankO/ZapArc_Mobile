// PIN Entry Screen
// Unlock wallet with PIN or biometric authentication

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  Animated,
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useWalletAuth } from '../../../hooks/useWalletAuth';
import { useLanguage } from '../../../hooks/useLanguage';
import { useAppTheme } from '../../../contexts/ThemeContext';
import {
  getGradientColors,
  getPrimaryTextColor,
  getSecondaryTextColor,
  BRAND_COLOR,
} from '../../../utils/theme-helpers';

// =============================================================================
// Constants
// =============================================================================

const PIN_LENGTH = 6;
const KEYPAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'delete'],
];

// =============================================================================
// Component
// =============================================================================

export function PinEntryScreen(): React.JSX.Element {
  const { t } = useLanguage();
  const { themeMode } = useAppTheme();
  
  // Get theme colors
  const gradientColors = getGradientColors(themeMode);
  const primaryText = getPrimaryTextColor(themeMode);
  const secondaryText = getSecondaryTextColor(themeMode);
  
  // Get route params for wallet switching
  const params = useLocalSearchParams<{ masterKeyId?: string; subWalletIndex?: string }>();
  const targetMasterKeyId = params.masterKeyId;
  const targetSubWalletIndex = params.subWalletIndex ? parseInt(params.subWalletIndex, 10) : 0;
  
  const {
    unlock,
    unlockWithBiometric,
    biometricAvailable,
    biometricEnabled,
    biometricType,
    activeWalletInfo,
    selectWallet,
  } = useWalletAuth();

  // State
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Animation ref for shake effect
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  // ========================================
  // Effects
  // ========================================

  useEffect(() => {
    // Try biometric on mount if available and enabled, but not when switching wallets
    if (biometricAvailable && biometricEnabled && !targetMasterKeyId) {
      handleBiometricUnlock();
    }
  }, [biometricAvailable, biometricEnabled, targetMasterKeyId]);

  // Prevent back navigation to welcome/create screens
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Return true to prevent default back behavior
      // This prevents going back to welcome/create screens
      return true;
    });

    return () => backHandler.remove();
  }, []);

  // Auto-submit when PIN is complete
  useEffect(() => {
    if (pin.length === PIN_LENGTH) {
      handleUnlock();
    }
  }, [pin]);

  // ========================================
  // PIN Input
  // ========================================

  const handleKeyPress = useCallback(
    (key: string) => {
      if (key === 'delete') {
        setPin((prev) => prev.slice(0, -1));
        setError(null);
        return;
      }

      if (key === '' || pin.length >= PIN_LENGTH) {
        return;
      }

      setPin((prev) => prev + key);
      setError(null);
    },
    [pin]
  );

  // ========================================
  // Unlock
  // ========================================

  const shake = useCallback(() => {
    Vibration.vibrate(200);
    
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnimation]);

  const handleUnlock = useCallback(async () => {
    if (pin.length !== PIN_LENGTH) return;

    try {
      setIsUnlocking(true);
      setError(null);

      // If we have target wallet params, use selectWallet to switch to it
      if (targetMasterKeyId) {
        const success = await selectWallet(targetMasterKeyId, targetSubWalletIndex, pin);
        if (success) {
          router.replace('/wallet/home');
        } else {
          setIsUnlocking(false);
          setError(t('auth.incorrectPin'));
          setAttempts((prev) => prev + 1);
          shake();
          setPin('');
        }
      } else {
        // Normal unlock for the current wallet
        const success = await unlock(pin);
        if (success) {
          router.replace('/wallet/home');
        } else {
          setIsUnlocking(false);
          setError(t('auth.incorrectPin'));
          setAttempts((prev) => prev + 1);
          shake();
          setPin('');
        }
      }
    } catch (err) {
      setIsUnlocking(false);
      setError(err instanceof Error ? err.message : t('auth.unlockFailed'));
      shake();
      setPin('');
    }
  }, [pin, unlock, selectWallet, targetMasterKeyId, targetSubWalletIndex, shake]);

  const handleBiometricUnlock = useCallback(async () => {
    try {
      // Biometric can only unlock current wallet, not switch to different one
      if (targetMasterKeyId) {
        // Cannot use biometric for switching wallets - need PIN
        setError(t('auth.enterPinToSwitch'));
        return;
      }
      
      const success = await unlockWithBiometric();

      if (success) {
        router.replace('/wallet/home');
      }
    } catch (err) {
      // User cancelled or biometric failed - they can use PIN
      console.log('Biometric unlock failed:', err);
    }
  }, [unlockWithBiometric, targetMasterKeyId]);

  // ========================================
  // Get biometric icon
  // ========================================

  const getBiometricIcon = (): string => {
    switch (biometricType) {
      case 'facial':
        return 'face-recognition';
      case 'fingerprint':
        return 'fingerprint';
      case 'iris':
        return 'eye';
      default:
        return 'fingerprint';
    }
  };

  const getBiometricLabel = (): string => {
    switch (biometricType) {
      case 'facial':
        return t('auth.useFaceId');
      case 'fingerprint':
        return t('auth.useFingerprint');
      case 'iris':
        return t('auth.useIrisScan');
      default:
        return t('auth.useBiometric');
    }
  };

  // ========================================
  // Render
  // ========================================

  return (
    <LinearGradient
      colors={gradientColors}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: primaryText }]}>{t('auth.unlockWallet')}</Text>
          {activeWalletInfo && (
            <Text style={[styles.walletInfo, { color: secondaryText }]}>
              {activeWalletInfo.masterKeyNickname} • {activeWalletInfo.subWalletNickname}
            </Text>
          )}
        </View>

        {/* PIN Display */}
        <View style={styles.pinDisplayContainer}>
          {isUnlocking ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={BRAND_COLOR} />
              <Text style={[styles.loadingText, { color: secondaryText }]}>
                {t('auth.unlocking') || 'Unlocking…'}
              </Text>
            </View>
          ) : (
            <>
              <Animated.View
                style={[
                  styles.pinDisplay,
                  { transform: [{ translateX: shakeAnimation }] },
                ]}
              >
                {Array(PIN_LENGTH)
                  .fill(0)
                  .map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.pinDot,
                        index < pin.length && styles.pinDotFilled,
                        error && styles.pinDotError,
                      ]}
                    />
                  ))}
              </Animated.View>

              {/* Error Message */}
              {error && <Text style={styles.errorText}>{error}</Text>}
              {!error && pin.length > 0 && pin.length < PIN_LENGTH && (
                <Text style={styles.pinHintText}>{t('auth.pinLengthRequirement')}</Text>
              )}
            </>
          )}

          {/* Attempts Warning */}
          {attempts >= 3 && (
            <Text style={styles.warningText}>
              {t('auth.attemptsRemaining', { count: 5 - attempts })}
            </Text>
          )}
        </View>

        {/* Keypad */}
        <View style={styles.keypadContainer}>
          {KEYPAD.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.keypadRow}>
              {row.map((key, keyIndex) => {
                if (key === '') {
                  // Biometric button or empty space (only show if available AND enabled in settings)
                  return biometricAvailable && biometricEnabled ? (
                    <TouchableOpacity
                      key={keyIndex}
                      style={styles.keypadKey}
                      onPress={handleBiometricUnlock}
                    >
                      <IconButton
                        icon={getBiometricIcon()}
                        size={28}
                        iconColor={BRAND_COLOR}
                      />
                    </TouchableOpacity>
                  ) : (
                    <View key={keyIndex} style={styles.keypadKeyEmpty} />
                  );
                }

                if (key === 'delete') {
                  return (
                    <TouchableOpacity
                      key={keyIndex}
                      style={styles.keypadKey}
                      onPress={() => handleKeyPress('delete')}
                      disabled={pin.length === 0}
                    >
                      <IconButton
                        icon="backspace-outline"
                        size={28}
                        iconColor={
                          pin.length > 0 ? primaryText : secondaryText
                        }
                      />
                    </TouchableOpacity>
                  );
                }

                return (
                  <TouchableOpacity
                    key={keyIndex}
                    style={styles.keypadKey}
                    onPress={() => handleKeyPress(key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.keypadKeyText, { color: primaryText }]}>{key}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* Biometric Button Label - only show if available AND enabled in settings */}
        {biometricAvailable && biometricEnabled && (
          <TouchableOpacity
            style={styles.biometricLabel}
            onPress={handleBiometricUnlock}
          >
            <Text style={[styles.biometricLabelText, { color: BRAND_COLOR }]}>{getBiometricLabel()}</Text>
          </TouchableOpacity>
        )}

        {/* Switch Wallet Button */}
        <TouchableOpacity
          style={styles.switchWalletButton}
          onPress={() => router.push('/wallet/selection')}
        >
          <Text style={[styles.switchWalletText, { color: secondaryText }]}>{t('auth.switchWallet')}</Text>
        </TouchableOpacity>
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
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  walletInfo: {
    fontSize: 14,
  },
  pinDisplayContainer: {
    alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '500',
  },
  pinDisplay: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: BRAND_COLOR,
    borderColor: BRAND_COLOR,
  },
  pinDotError: {
    borderColor: '#F44336',
    backgroundColor: '#F44336',
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    marginTop: 8,
  },
  pinHintText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    marginTop: 8,
  },
  warningText: {
    color: '#FF9800',
    fontSize: 12,
    marginTop: 4,
  },
  keypadContainer: {
    alignItems: 'center',
    gap: 16,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  keypadKey: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadKeyEmpty: {
    width: 72,
    height: 72,
  },
  keypadKeyText: {
    fontSize: 28,
    fontWeight: '500',
  },
  biometricLabel: {
    alignSelf: 'center',
    padding: 12,
  },
  biometricLabelText: {
    fontSize: 16,
    fontWeight: '500',
  },
  switchWalletButton: {
    alignSelf: 'center',
    padding: 12,
  },
  switchWalletText: {
    fontSize: 14,
  },
});
