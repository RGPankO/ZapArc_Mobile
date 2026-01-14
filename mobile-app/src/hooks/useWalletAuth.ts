// useWalletAuth Hook
// Manages wallet PIN authentication, session, and auto-lock

import { useState, useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { storageService, settingsService } from '../services';
import * as BreezSparkService from '../services/breezSparkService';
import { deriveSubWalletMnemonic } from '../utils/mnemonic';
import type { ActiveWalletInfo } from '../features/wallet/types';

// =============================================================================
// Types
// =============================================================================

export interface WalletAuthState {
  // Session state
  isUnlocked: boolean;
  isLoading: boolean;
  error: string | null;

  // Biometric
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  biometricType: 'fingerprint' | 'facial' | 'iris' | 'none';

  // Active wallet
  activeWalletInfo: ActiveWalletInfo | null;
  currentMasterKeyId: string | null;

  // Session info
  lastActivity: number;
  autoLockTimeout: number;
}

export interface WalletAuthActions {
  // PIN operations
  unlock: (pin: string) => Promise<boolean>;
  lock: () => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  changePin: (oldPin: string, newPin: string) => Promise<boolean>;

  // Biometric
  unlockWithBiometric: () => Promise<boolean>;

  // Wallet selection
  selectWallet: (masterKeyId: string, subWalletIndex: number, pin: string) => Promise<boolean>;
  selectSubWallet: (subWalletIndex: number) => Promise<boolean>;

  // Session management
  updateActivity: () => void;
  checkAutoLock: () => Promise<void>;
  getSessionPin: () => string | null;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useWalletAuth(): WalletAuthState & WalletAuthActions {
  // State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<
    'fingerprint' | 'facial' | 'iris' | 'none'
  >('none');
  const [activeWalletInfo, setActiveWalletInfo] = useState<ActiveWalletInfo | null>(null);
  const [currentMasterKeyId, setCurrentMasterKeyId] = useState<string | null>(null);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [autoLockTimeout, setAutoLockTimeout] = useState(900); // 15 minutes default

  // Refs
  const autoLockTimerRef = useRef<ReturnType<typeof global.setTimeout> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // ========================================
  // Initialize
  // ========================================

  useEffect(() => {
    const initialize = async (): Promise<void> => {
      try {
        setIsLoading(true);

        // Check wallet unlock status
        const unlocked = await storageService.isWalletUnlocked();
        setIsUnlocked(unlocked);

        // Get active wallet info
        const walletInfo = await storageService.getActiveWalletInfo();
        setActiveWalletInfo(walletInfo);
        if (walletInfo) {
          setCurrentMasterKeyId(walletInfo.masterKeyId);
        }

        // Get last activity
        const lastAct = await storageService.getLastActivity();
        setLastActivity(lastAct);

        // Check biometric availability
        await checkBiometricAvailability();

        // Get settings and auto-lock timeout
        const settings = await settingsService.getUserSettings();
        setAutoLockTimeout(settings.autoLockTimeout);
        setBiometricEnabled(settings.biometricEnabled ?? false);

        // Check if we should auto-lock
        await checkAutoLock();
      } catch (err) {
        console.error('❌ [useWalletAuth] Initialize failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize auth');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  // ========================================
  // App State Handling (for auto-lock)
  // ========================================

  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus): Promise<void> => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground - check auto-lock
        console.log('📱 [useWalletAuth] App came to foreground');
        await checkAutoLock();
      } else if (nextAppState === 'background') {
        // App going to background - save last activity
        console.log('📱 [useWalletAuth] App going to background');
        updateActivity();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return (): void => {
      subscription?.remove();
      if (autoLockTimerRef.current) {
        global.clearTimeout(autoLockTimerRef.current);
      }
    };
  }, [autoLockTimeout]);

  // ========================================
  // Biometric
  // ========================================

  const checkBiometricAvailability = async (): Promise<void> => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      setBiometricAvailable(hasHardware && isEnrolled);

      if (hasHardware && isEnrolled) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('facial');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('fingerprint');
        } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          setBiometricType('iris');
        }
      }
    } catch (err) {
      console.error('❌ [useWalletAuth] Biometric check failed:', err);
    }
  };

  // Session PIN for SDK initialization (stored in memory only, not persisted)
  const sessionPinRef = useRef<string | null>(null);

  const unlockWithBiometric = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      if (!biometricAvailable) {
        throw new Error('Biometric authentication not available');
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock wallet',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        await storageService.unlockWallet();
        setIsUnlocked(true);
        updateActivity();

        // Initialize Breez SDK with stored biometric PIN or cached session PIN
        if (currentMasterKeyId) {
          try {
            // Try to get the PIN from biometric storage first (requires biometric auth)
            let pin = await storageService.getBiometricPin(currentMasterKeyId);

            // Fall back to cached session PIN if biometric PIN is not available
            if (!pin && sessionPinRef.current) {
              pin = sessionPinRef.current;
              console.log('🔍 [useWalletAuth] Using cached session PIN for SDK initialization');
            }

            if (pin) {
              const mnemonic = await storageService.getMasterKeyMnemonic(
                currentMasterKeyId,
                pin
              );
              if (mnemonic) {
                const walletInfo = await storageService.getActiveWalletInfo();
                const subWalletIndex = walletInfo?.subWalletIndex ?? 0;
                const derivedMnemonic = deriveSubWalletMnemonic(mnemonic, subWalletIndex);

                await BreezSparkService.initializeSDK(derivedMnemonic);

                // Cache the PIN in session for subsequent unlocks
                sessionPinRef.current = pin;

                console.log('✅ [useWalletAuth] Breez SDK initialized (biometric unlock)');
              }
            } else {
              console.warn('⚠️ [useWalletAuth] No PIN available for biometric SDK init - wallet unlocked but SDK not initialized');
            }
          } catch (sdkError) {
            console.warn('⚠️ [useWalletAuth] SDK initialization failed (biometric):', sdkError);
          }
        }

        console.log('✅ [useWalletAuth] Unlocked with biometric');
        return true;
      }

      if (result.error === 'user_cancel') {
        return false;
      }

      throw new Error(result.error || 'Biometric authentication failed');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Biometric unlock failed';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [biometricAvailable, currentMasterKeyId]);

  // ========================================
  // PIN Operations
  // ========================================

  const unlock = useCallback(
    async (pin: string): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);

        // Verify PIN against current master key
        if (!currentMasterKeyId) {
          throw new Error('No wallet selected');
        }

        const isValid = await storageService.verifyMasterKeyPin(currentMasterKeyId, pin);
        if (!isValid) {
          setError('Invalid PIN');
          return false;
        }

        console.log('🔵 [useWalletAuth] PIN VERIFIED - About to check biometric storage');

        // Cache PIN for biometric unlock SDK initialization
        sessionPinRef.current = pin;

        // Check biometric availability directly (don't rely on state)
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        const isBiometricAvailable = hasHardware && isEnrolled;

        console.log('🔍 [useWalletAuth] Checking if should store PIN for biometric:', {
          hasHardware,
          isEnrolled,
          isBiometricAvailable,
          currentMasterKeyId,
        });

        // Store PIN securely for biometric unlock if biometric is available
        if (isBiometricAvailable) {
          try {
            await storageService.storeBiometricPin(currentMasterKeyId, pin);
            console.log('✅ [useWalletAuth] PIN stored for biometric unlock');
          } catch (biometricStoreError) {
            // Log but don't fail unlock - biometric storage is optional
            console.warn('⚠️ [useWalletAuth] Failed to store PIN for biometric:', biometricStoreError);
          }
        } else {
          console.log('⚠️ [useWalletAuth] Biometric not available, PIN not stored');
        }

        // Initialize Breez SDK with the wallet's mnemonic
        try {
          const mnemonic = await storageService.getMasterKeyMnemonic(currentMasterKeyId, pin);
          if (mnemonic) {
            const walletInfo = await storageService.getActiveWalletInfo();
            const subWalletIndex = walletInfo?.subWalletIndex ?? 0;
            const derivedMnemonic = deriveSubWalletMnemonic(mnemonic, subWalletIndex);

            await BreezSparkService.initializeSDK(derivedMnemonic);
            console.log('✅ [useWalletAuth] Breez SDK initialized');
          }
        } catch (sdkError) {
          // Log SDK error but don't fail unlock - SDK may not be available in Expo Go
          console.warn('⚠️ [useWalletAuth] SDK initialization failed:', sdkError);
        }

        await storageService.unlockWallet();
        setIsUnlocked(true);
        updateActivity();

        console.log('✅ [useWalletAuth] Unlocked with PIN');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unlock failed';
        setError(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [currentMasterKeyId]
  );

  const lock = useCallback(async (): Promise<void> => {
    try {
      await storageService.lockWallet();
      sessionPinRef.current = null; // Clear cached PIN for security
      setIsUnlocked(false);
      console.log('✅ [useWalletAuth] Wallet locked');
    } catch (err) {
      console.error('❌ [useWalletAuth] Lock failed:', err);
    }
  }, []);

  const verifyPin = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!currentMasterKeyId) return false;
      return storageService.verifyMasterKeyPin(currentMasterKeyId, pin);
    },
    [currentMasterKeyId]
  );

  const changePin = useCallback(
    async (_oldPin: string, _newPin: string): Promise<boolean> => {
      // TODO: Implement PIN change in storageService
      // Would need to re-encrypt the mnemonic with new PIN
      console.log('🔵 [useWalletAuth] Change PIN (not implemented)');
      return false;
    },
    []
  );

  // ========================================
  // Wallet Selection
  // ========================================

  const selectWallet = useCallback(
    async (
      masterKeyId: string,
      subWalletIndex: number,
      pin: string
    ): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);

        // If selecting a different master key, verify PIN
        if (masterKeyId !== currentMasterKeyId) {
          const isValid = await storageService.verifyMasterKeyPin(masterKeyId, pin);
          if (!isValid) {
            setError('Invalid PIN');
            return false;
          }
        }

        // Set active wallet
        await storageService.setActiveWallet(masterKeyId, subWalletIndex);
        const walletInfo = await storageService.getActiveWalletInfo();
        setActiveWalletInfo(walletInfo);
        setCurrentMasterKeyId(masterKeyId);

        // Cache PIN for future use
        sessionPinRef.current = pin;

        // Reinitialize SDK with the new wallet's mnemonic
        try {
          const mnemonic = await storageService.getMasterKeyMnemonic(masterKeyId, pin);
          if (mnemonic) {
            const derivedMnemonic = deriveSubWalletMnemonic(mnemonic, subWalletIndex);
            
            // Disconnect old SDK instance first
            await BreezSparkService.disconnectSDK();
            console.log('🔌 [useWalletAuth] Disconnected old SDK instance');
            
            // Initialize with new wallet's mnemonic
            await BreezSparkService.initializeSDK(derivedMnemonic);
            console.log('✅ [useWalletAuth] SDK reinitialized for new wallet:', {
              masterKeyId,
              subWalletIndex,
            });
          }
        } catch (sdkError) {
          console.error('❌ [useWalletAuth] SDK reinitialization failed:', sdkError);
        }

        await storageService.unlockWallet();
        setIsUnlocked(true);
        updateActivity();

        console.log('✅ [useWalletAuth] Wallet selected:', {
          masterKeyId,
          subWalletIndex,
        });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to select wallet';
        setError(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [currentMasterKeyId]
  );

  const selectSubWallet = useCallback(
    async (subWalletIndex: number): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!currentMasterKeyId) {
          throw new Error('No master key selected');
        }

        // Switching sub-wallet within same master key - no PIN needed for storage
        await storageService.setActiveWallet(currentMasterKeyId, subWalletIndex);
        const walletInfo = await storageService.getActiveWalletInfo();
        setActiveWalletInfo(walletInfo);
        updateActivity();

        // Reinitialize SDK with the new sub-wallet's mnemonic
        try {
          // Use cached session PIN or biometric PIN to get mnemonic
          let pin = sessionPinRef.current;
          if (!pin) {
            pin = await storageService.getBiometricPin(currentMasterKeyId);
          }

          if (pin) {
            const mnemonic = await storageService.getMasterKeyMnemonic(currentMasterKeyId, pin);
            if (mnemonic) {
              const derivedMnemonic = deriveSubWalletMnemonic(mnemonic, subWalletIndex);
              await BreezSparkService.disconnectSDK();
              await BreezSparkService.initializeSDK(derivedMnemonic);
              console.log('✅ [useWalletAuth] SDK reinitialized for sub-wallet:', subWalletIndex);
            }
          } else {
            console.warn('⚠️ [useWalletAuth] No PIN available for SDK reinit on sub-wallet switch');
          }
        } catch (sdkError) {
          console.error('❌ [useWalletAuth] SDK reinitialization failed:', sdkError);
        }

        return true;
      } catch (err) {
        console.error('❌ [useWalletAuth] selectSubWallet error:', err);
        const message = err instanceof Error ? err.message : 'Failed to switch sub-wallet';
        setError(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [currentMasterKeyId]
  );

  // ========================================
  // Session Management
  // ========================================

  const updateActivity = useCallback(() => {
    const now = Date.now();
    setLastActivity(now);
    storageService.updateActivity();

    // Reset auto-lock timer
    if (autoLockTimerRef.current) {
      global.clearTimeout(autoLockTimerRef.current);
    }

    if (autoLockTimeout > 0) {
      autoLockTimerRef.current = global.setTimeout(async () => {
        console.log('⏰ [useWalletAuth] Auto-lock triggered');
        await lock();
      }, autoLockTimeout * 1000);
    }
  }, [autoLockTimeout, lock]);

  const checkAutoLock = useCallback(async (): Promise<void> => {
    try {
      if (autoLockTimeout === 0) {
        // Auto-lock disabled
        return;
      }

      const storedLastActivity = await storageService.getLastActivity();
      const now = Date.now();
      const elapsed = (now - storedLastActivity) / 1000;

      if (elapsed > autoLockTimeout) {
        console.log('⏰ [useWalletAuth] Session expired, locking wallet');
        await lock();
      }
    } catch (err) {
      console.error('❌ [useWalletAuth] Auto-lock check failed:', err);
    }
  }, [autoLockTimeout, lock]);

  // ========================================
  // Return Hook Value
  // ========================================

  return {
    // State
    isUnlocked,
    isLoading,
    error,
    biometricAvailable,
    biometricEnabled,
    biometricType,
    activeWalletInfo,
    currentMasterKeyId,
    lastActivity,
    autoLockTimeout,

    // Actions
    unlock,
    lock,
    verifyPin,
    changePin,
    unlockWithBiometric,
    selectWallet,
    selectSubWallet,
    updateActivity,
    checkAutoLock,
    getSessionPin: () => sessionPinRef.current,
  };
}
