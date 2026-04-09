// Security Service
// Handles app security features: auto-lock, biometric auth, and security protections

import { AppState, AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
// Import directly to avoid circular dependency with index.ts
import { storageService } from './storageService';
import { settingsService } from './settingsService';

let screenCaptureModule: {
  preventScreenCaptureAsync?: () => Promise<void>;
  allowScreenCaptureAsync?: () => Promise<void>;
} | null = null;

try {
  // Optional dependency. If unavailable, keep fallback behavior with warning logs.
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  screenCaptureModule = require('expo-screen-capture');
} catch {
  screenCaptureModule = null;
}

// =============================================================================
// Types
// =============================================================================

export interface SecurityConfig {
  autoLockTimeout: number; // seconds, 0 = disabled
  biometricEnabled: boolean;
  screenshotPrevention: boolean;
  appSwitcherHide: boolean;
}

export interface BiometricInfo {
  isAvailable: boolean;
  isEnrolled: boolean;
  biometricType: 'fingerprint' | 'facial' | 'iris' | 'none';
  securityLevel: 'weak' | 'strong';
}

export interface AutoLockState {
  isLocked: boolean;
  lastActivity: number;
  lockReason: 'timeout' | 'manual' | 'background' | null;
}

// =============================================================================
// Security Service Class
// =============================================================================

class SecurityService {
  private autoLockTimer: ReturnType<typeof global.setTimeout> | null = null;
  private lastActivityTime: number = Date.now();
  private appStateSubscription: { remove: () => void } | null = null;
  private isLocked: boolean = false;
  private lockListeners: Set<(locked: boolean, reason: string | null) => void> = new Set();
  private screenshotGuardCount: number = 0;
  private config: SecurityConfig = {
    autoLockTimeout: 900, // 15 minutes default
    biometricEnabled: true,
    screenshotPrevention: false,
    appSwitcherHide: true,
  };

  // ========================================
  // Initialization
  // ========================================

  async initialize(): Promise<void> {
    console.log('🔐 [Security] Initializing...');

    // Load security settings
    await this.loadSecuritySettings();

    // Subscribe to app state changes
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );

    // Start auto-lock timer if enabled
    this.resetAutoLockTimer();

    console.log('🔐 [Security] Initialized, timeout:', this.config.autoLockTimeout);
  }

  destroy(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.clearAutoLockTimer();
    this.lockListeners.clear();
  }

  // ========================================
  // Settings
  // ========================================

  async loadSecuritySettings(): Promise<void> {
    try {
      const settings = await settingsService.getUserSettings();
      this.config = {
        autoLockTimeout: settings.autoLockTimeout ?? 900,
        biometricEnabled: settings.biometricEnabled ?? true,
        screenshotPrevention: false, // TODO: Implement when native module available
        appSwitcherHide: true,
      };
    } catch (error) {
      console.error('❌ [Security] Failed to load settings:', error);
    }
  }

  async updateSecurityConfig(updates: Partial<SecurityConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    
    // Persist relevant settings (only update if timeout is a valid option)
    const validTimeouts = [0, 300, 900, 1800, 3600, 7200];
    const timeout = validTimeouts.includes(this.config.autoLockTimeout) 
      ? this.config.autoLockTimeout as 0 | 300 | 900 | 1800 | 3600 | 7200
      : 900;
    await settingsService.updateUserSettings({
      autoLockTimeout: timeout,
      biometricEnabled: this.config.biometricEnabled,
    });

    // Reset auto-lock timer with new timeout
    if ('autoLockTimeout' in updates) {
      this.resetAutoLockTimer();
    }
  }

  getSecurityConfig(): SecurityConfig {
    return { ...this.config };
  }

  // ========================================
  // Auto-Lock
  // ========================================

  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (nextAppState === 'active') {
      // App came to foreground
      console.log('📱 [Security] App active, checking lock status');
      this.checkAutoLock();
    } else if (nextAppState === 'background') {
      // App going to background
      console.log('📱 [Security] App backgrounded, saving activity time');
      this.updateActivity();
    }
  }

  updateActivity(): void {
    this.lastActivityTime = Date.now();
    storageService.updateActivity();
    this.resetAutoLockTimer();
  }

  private resetAutoLockTimer(): void {
    this.clearAutoLockTimer();

    if (this.config.autoLockTimeout <= 0) {
      console.log('⏰ [Security] Auto-lock disabled');
      return;
    }

    this.autoLockTimer = global.setTimeout(() => {
      console.log('⏰ [Security] Auto-lock timer expired');
      this.lockWallet('timeout');
    }, this.config.autoLockTimeout * 1000);
  }

  private clearAutoLockTimer(): void {
    if (this.autoLockTimer) {
      global.clearTimeout(this.autoLockTimer);
      this.autoLockTimer = null;
    }
  }

  async checkAutoLock(): Promise<void> {
    if (this.config.autoLockTimeout <= 0) return;

    const storedLastActivity = await storageService.getLastActivity();
    const now = Date.now();
    const elapsed = (now - storedLastActivity) / 1000;

    if (elapsed > this.config.autoLockTimeout) {
      console.log('⏰ [Security] Session expired, locking wallet');
      await this.lockWallet('timeout');
    } else {
      // Reset timer for remaining time
      const remainingSeconds = this.config.autoLockTimeout - elapsed;
      this.clearAutoLockTimer();
      this.autoLockTimer = global.setTimeout(() => {
        this.lockWallet('timeout');
      }, remainingSeconds * 1000);
    }
  }

  async lockWallet(reason: 'timeout' | 'manual' | 'background' = 'manual'): Promise<void> {
    console.log('🔒 [Security] Locking wallet, reason:', reason);
    
    this.isLocked = true;
    await storageService.lockWallet();
    this.clearAutoLockTimer();
    
    // Notify listeners
    this.lockListeners.forEach((listener) => listener(true, reason));
  }

  async unlockWallet(): Promise<void> {
    console.log('🔓 [Security] Unlocking wallet');
    
    this.isLocked = false;
    await storageService.unlockWallet();
    this.updateActivity();
    
    // Notify listeners
    this.lockListeners.forEach((listener) => listener(false, null));
  }

  isWalletLocked(): boolean {
    return this.isLocked;
  }

  // ========================================
  // Lock Listeners
  // ========================================

  addLockListener(listener: (locked: boolean, reason: string | null) => void): () => void {
    this.lockListeners.add(listener);
    return () => {
      this.lockListeners.delete(listener);
    };
  }

  // ========================================
  // Biometric Authentication
  // ========================================

  async getBiometricInfo(): Promise<BiometricInfo> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const securityLevel = await LocalAuthentication.getEnrolledLevelAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

      let biometricType: BiometricInfo['biometricType'] = 'none';
      
      if (isEnrolled) {
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          biometricType = 'facial';
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          biometricType = 'fingerprint';
        } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          biometricType = 'iris';
        }
      }

      return {
        isAvailable: hasHardware,
        isEnrolled,
        biometricType,
        securityLevel: securityLevel === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG 
          ? 'strong' 
          : 'weak',
      };
    } catch (error) {
      console.error('❌ [Security] Failed to get biometric info:', error);
      return {
        isAvailable: false,
        isEnrolled: false,
        biometricType: 'none',
        securityLevel: 'weak',
      };
    }
  }

  async authenticateWithBiometric(
    promptMessage: string = 'Authenticate to unlock wallet'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.config.biometricEnabled) {
        return { success: false, error: 'Biometric authentication disabled' };
      }

      const biometricInfo = await this.getBiometricInfo();
      if (!biometricInfo.isEnrolled) {
        return { success: false, error: 'No biometric enrolled' };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use PIN',
      });

      if (result.success) {
        console.log('✅ [Security] Biometric authentication successful');
        return { success: true };
      }

      console.log('⚠️ [Security] Biometric authentication failed:', result.error);
      return { 
        success: false, 
        error: result.error === 'user_cancel' ? 'Cancelled' : result.error || 'Authentication failed'
      };
    } catch (error) {
      console.error('❌ [Security] Biometric error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // ========================================
  // Security Protections
  // ========================================

  enableScreenshotPrevention(): void {
    this.screenshotGuardCount += 1;

    if (this.screenshotGuardCount > 1) {
      this.config.screenshotPrevention = true;
      return;
    }

    if (!screenCaptureModule?.preventScreenCaptureAsync) {
      console.warn('⚠️ [Security] expo-screen-capture not available; native capture blocking skipped');
      this.config.screenshotPrevention = true;
      return;
    }

    screenCaptureModule.preventScreenCaptureAsync()
      .then(() => {
        console.log('🔐 [Security] Screenshot prevention enabled');
      })
      .catch((error) => {
        console.warn('⚠️ [Security] Failed to enable screenshot prevention:', error);
      });

    this.config.screenshotPrevention = true;
  }

  disableScreenshotPrevention(): void {
    if (this.screenshotGuardCount <= 0) {
      this.screenshotGuardCount = 0;
      this.config.screenshotPrevention = false;
      return;
    }

    this.screenshotGuardCount -= 1;

    if (this.screenshotGuardCount > 0) {
      this.config.screenshotPrevention = true;
      return;
    }

    if (!screenCaptureModule?.allowScreenCaptureAsync) {
      this.config.screenshotPrevention = false;
      return;
    }

    screenCaptureModule.allowScreenCaptureAsync()
      .then(() => {
        console.log('🔓 [Security] Screenshot prevention disabled');
      })
      .catch((error) => {
        console.warn('⚠️ [Security] Failed to disable screenshot prevention:', error);
      });

    this.config.screenshotPrevention = false;
  }

  isScreenshotPreventionEnabled(): boolean {
    return this.config.screenshotPrevention;
  }

  // ========================================
  // Device Security Check
  // ========================================

  async checkDeviceSecurity(): Promise<{
    isSecure: boolean;
    warnings: string[];
  }> {
    const warnings: string[] = [];

    // Check if device has passcode/biometric
    const biometricInfo = await this.getBiometricInfo();
    
    if (!biometricInfo.isAvailable) {
      warnings.push('Device does not support biometric authentication');
    } else if (!biometricInfo.isEnrolled) {
      warnings.push('No biometric authentication enrolled');
    }

    // Note: Jailbreak/root detection would require a native module
    // like `react-native-device-info` with `isJailBroken`/`isRooted`
    
    // For now, we'll add a placeholder warning if we can detect it
    // This would be implemented with: 
    // import DeviceInfo from 'react-native-device-info';
    // if (await DeviceInfo.isEmulator()) warnings.push('Running on emulator');
    // if (Platform.OS === 'android' && await DeviceInfo.isRooted()) warnings.push('Device is rooted');
    // if (Platform.OS === 'ios' && await DeviceInfo.isJailBroken()) warnings.push('Device is jailbroken');

    return {
      isSecure: warnings.length === 0,
      warnings,
    };
  }

  // ========================================
  // Auto-Lock State
  // ========================================

  async getAutoLockState(): Promise<AutoLockState> {
    const lastActivity = await storageService.getLastActivity();
    
    return {
      isLocked: this.isLocked,
      lastActivity,
      lockReason: null,
    };
  }

  getAutoLockTimeout(): number {
    return this.config.autoLockTimeout;
  }

  async setAutoLockTimeout(seconds: number): Promise<void> {
    await this.updateSecurityConfig({ autoLockTimeout: seconds });
  }
}

// =============================================================================
// Export Singleton
// =============================================================================

export const securityService = new SecurityService();
