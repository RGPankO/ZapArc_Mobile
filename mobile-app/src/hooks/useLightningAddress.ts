// useLightningAddress Hook
// Manages Lightning Address state, registration, and synchronization

import { useState, useCallback, useEffect } from 'react';
import {
  type LightningAddressInfo,
  LightningAddressService,
  validateUsername,
} from '../services';

// =============================================================================
// Types
// =============================================================================

export interface LightningAddressState {
  /** Current Lightning Address info (null if not registered) */
  addressInfo: LightningAddressInfo | null;
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Error message from last operation */
  error: string | null;
  /** Whether a Lightning Address is currently registered */
  isRegistered: boolean;
}

export interface LightningAddressActions {
  /** Reload Lightning Address from SDK/cache */
  refresh: () => Promise<void>;
  /** Check if a username is available */
  checkAvailability: (username: string) => Promise<{ available: boolean; error?: string }>;
  /** Register a new Lightning Address */
  register: (username: string, description?: string) => Promise<{ success: boolean; error?: string }>;
  /** Unregister the current Lightning Address */
  unregister: () => Promise<{ success: boolean; error?: string }>;
  /** Validate username format (client-side only) */
  validateUsername: (username: string) => { isValid: boolean; error?: string };
  /** Clear any error state */
  clearError: () => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useLightningAddress(): LightningAddressState & LightningAddressActions {
  // State
  const [addressInfo, setAddressInfo] = useState<LightningAddressInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Derived state
  const isRegistered = addressInfo !== null;

  // ========================================
  // Initialize - Load address on mount
  // ========================================

  useEffect(() => {
    refresh();
  }, []);

  // ========================================
  // Actions
  // ========================================

  /**
   * Refresh Lightning Address from SDK (source of truth) or cache
   */
  const refresh = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await LightningAddressService.getAddress();

      if (result.success) {
        setAddressInfo(result.data || null);
      } else {
        setError(result.error || 'Failed to load Lightning Address');
      }
    } catch (err) {
      console.error('❌ [useLightningAddress] refresh failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load Lightning Address');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Check if a username is available for registration
   */
  const checkAvailability = useCallback(
    async (username: string): Promise<{ available: boolean; error?: string }> => {
      try {
        setError(null);

        const result = await LightningAddressService.checkAvailability(username);

        if (result.success) {
          return { available: result.data === true };
        } else {
          return { available: false, error: result.error };
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to check availability';
        return { available: false, error: errorMsg };
      }
    },
    []
  );

  /**
   * Register a new Lightning Address
   */
  const register = useCallback(
    async (
      username: string,
      description?: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        setError(null);

        const result = await LightningAddressService.register(username, description);

        if (result.success && result.data) {
          setAddressInfo(result.data);
          return { success: true };
        } else {
          const errorMsg = result.error || 'Failed to register Lightning Address';
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to register Lightning Address';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    },
    []
  );

  /**
   * Unregister the current Lightning Address
   */
  const unregister = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      setError(null);

      const result = await LightningAddressService.unregister();

      if (result.success) {
        setAddressInfo(null);
        return { success: true };
      } else {
        const errorMsg = result.error || 'Failed to unregister Lightning Address';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to unregister Lightning Address';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  /**
   * Validate username format (client-side only, no SDK call)
   */
  const validateUsernameLocal = useCallback(
    (username: string): { isValid: boolean; error?: string } => {
      const result = validateUsername(username);
      return { isValid: result.isValid, error: result.error };
    },
    []
  );

  /**
   * Clear error state
   */
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  // ========================================
  // Return
  // ========================================

  return {
    // State
    addressInfo,
    isLoading,
    error,
    isRegistered,

    // Actions
    refresh,
    checkAvailability,
    register,
    unregister,
    validateUsername: validateUsernameLocal,
    clearError,
  };
}

export default useLightningAddress;
