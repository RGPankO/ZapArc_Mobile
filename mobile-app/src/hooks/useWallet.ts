// useWallet Hook
// Manages wallet state, operations, and multi-wallet switching

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { storageService } from '../services';
import * as BreezSparkService from '../services/breezSparkService';
import * as WalletCache from '../services/walletCacheService';
import {
  deriveSubWalletMnemonic,
  generateMnemonic,
  validateMnemonic,
  generateMasterKeyNickname,
  generateSubWalletNickname,
} from '../utils/mnemonic';
import type {
  MultiWalletStorage,
  MasterKeyEntry,
  SubWalletEntry,
  ActiveWalletInfo,
  Transaction,
} from '../features/wallet/types';

// =============================================================================
// Types
// =============================================================================

export interface WalletState {
  // Status
  isLoading: boolean; // Initial load or no cached data
  isRefreshing: boolean; // Background refresh with cached data available
  isConnected: boolean;
  error: string | null;

  // Active wallet info
  activeWalletInfo: ActiveWalletInfo | null;
  balance: number;
  transactions: Transaction[];

  // Multi-wallet data
  masterKeys: MasterKeyEntry[];
  activeMasterKey: MasterKeyEntry | null;
  activeSubWallet: SubWalletEntry | null;
}

export interface WalletActions {
  // Wallet creation/import
  createMasterKey: (pin: string, nickname?: string) => Promise<string>;
  importMasterKey: (mnemonic: string, pin: string, nickname?: string) => Promise<string>;

  // Sub-wallet operations
  addSubWallet: (masterKeyId: string, nickname?: string) => Promise<number>;
  archiveSubWallet: (masterKeyId: string, index: number) => Promise<void>;
  restoreSubWallet: (masterKeyId: string, index: number) => Promise<void>;

  // Wallet switching
  switchWallet: (masterKeyId: string, subWalletIndex: number, pin?: string) => Promise<void>;

  // Master key operations
  deleteMasterKey: (masterKeyId: string, pin: string) => Promise<{ activeDeleted: boolean; nextActiveId: string | null }>;
  renameMasterKey: (masterKeyId: string, nickname: string) => Promise<void>;
  renameSubWallet: (masterKeyId: string, index: number, nickname: string) => Promise<void>;

  // Balance and transactions
  refreshBalance: () => Promise<void>;
  refreshTransactions: () => Promise<void>;

  // Payment operations
  sendPayment: (bolt11: string) => Promise<boolean>;
  receivePayment: (amountSats: number, description?: string) => Promise<string>;

  // Utility
  syncSubWalletActivity: (masterKeyId: string, subWalletIndex: number, pin: string, restorePin?: string | null) => Promise<boolean>;
  getMnemonic: (masterKeyId: string, pin: string) => Promise<string>;
  canAddSubWallet: (masterKeyId: string) => boolean;
  getAddSubWalletDisabledReason: (masterKeyId: string) => string | null;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useWallet(): WalletState & WalletActions {
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [storage, setStorage] = useState<MultiWalletStorage | null>(null);

  // Refs for stable access in callbacks without triggering identity changes
  const balanceRef = useRef(balance);
  const transactionsRef = useRef(transactions);

  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

  // Derived state
  const masterKeys = useMemo(() => storage?.masterKeys ?? [], [storage]);

  const activeMasterKey = useMemo(() => {
    if (!storage) return null;
    return masterKeys.find((mk) => mk.id === storage.activeMasterKeyId) ?? null;
  }, [storage, masterKeys]);

  const activeSubWallet = useMemo(() => {
    if (!activeMasterKey || storage === null) return null;
    return (
      activeMasterKey.subWallets.find(
        (sw) => sw.index === storage.activeSubWalletIndex
      ) ?? null
    );
  }, [activeMasterKey, storage]);

  const activeWalletInfo = useMemo((): ActiveWalletInfo | null => {
    if (!activeMasterKey || !activeSubWallet) return null;
    return {
      masterKeyId: activeMasterKey.id,
      masterKeyNickname: activeMasterKey.nickname,
      subWalletIndex: activeSubWallet.index,
      subWalletNickname: activeSubWallet.nickname,
    };
  }, [activeMasterKey, activeSubWallet]);

  // ========================================
  // Load wallet data
  // ========================================

  const loadWalletData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await storageService.loadMultiWalletStorage();
      setStorage(data);

      if (data && BreezSparkService.isSDKInitialized()) {
        setIsConnected(true);
      }
    } catch (err) {
      console.error('❌ [useWallet] Failed to load wallet data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load wallet');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWalletData();
  }, [loadWalletData]);

  // ========================================
  // Wallet Creation/Import
  // ========================================

  const createMasterKey = useCallback(
    async (pin: string, nickname?: string): Promise<string> => {
      try {
        setIsLoading(true);
        setError(null);

        const mnemonic = generateMnemonic();
        const keyNumber = masterKeys.length + 1;
        const name = nickname ?? generateMasterKeyNickname(keyNumber);

        const masterKeyId = await storageService.createMasterKey(
          mnemonic,
          name,
          pin
        );

        // Store PIN for biometric unlock if biometric is available
        try {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();
          if (hasHardware && isEnrolled) {
            await storageService.storeBiometricPin(masterKeyId, pin);
            console.log('✅ [useWallet] PIN stored for biometric unlock');
          }
        } catch (biometricError) {
          console.warn('⚠️ [useWallet] Failed to store biometric PIN:', biometricError);
        }

        // Initialize Breez SDK with the new wallet's mnemonic (sub-wallet index 0)
        let sdkInitialized = false;
        try {
          const derivedMnemonic = deriveSubWalletMnemonic(mnemonic, 0);
          await BreezSparkService.initializeSDK(derivedMnemonic);
          sdkInitialized = true;
          console.log('✅ [useWallet] Breez SDK initialized for new wallet');
        } catch (sdkError) {
          // Log SDK error but don't fail creation - SDK may not be available in Expo Go
          console.warn('⚠️ [useWallet] SDK initialization failed:', sdkError);
        }

        await loadWalletData();

        // Mark as connected if SDK initialized - balance will be fetched by polling effect
        if (sdkInitialized) {
          setIsConnected(true);
        }

        console.log('✅ [useWallet] Master key created:', masterKeyId);

        return masterKeyId;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create wallet';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [masterKeys.length, loadWalletData]
  );

  const importMasterKey = useCallback(
    async (
      mnemonic: string,
      pin: string,
      nickname?: string
    ): Promise<string> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!validateMnemonic(mnemonic)) {
          throw new Error('Invalid mnemonic phrase');
        }

        const normalizedMnemonic = mnemonic.trim().toLowerCase();
        const keyNumber = masterKeys.length + 1;
        const name = nickname ?? generateMasterKeyNickname(keyNumber);

        const masterKeyId = await storageService.createMasterKey(
          normalizedMnemonic,
          name,
          pin
        );

        // Store PIN for biometric unlock if biometric is available
        try {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();
          if (hasHardware && isEnrolled) {
            await storageService.storeBiometricPin(masterKeyId, pin);
            console.log('✅ [useWallet] PIN stored for biometric unlock');
          }
        } catch (biometricError) {
          console.warn('⚠️ [useWallet] Failed to store biometric PIN:', biometricError);
        }

        // Initialize Breez SDK with the imported wallet's mnemonic (sub-wallet index 0)
        let sdkInitialized = false;
        try {
          const derivedMnemonic = deriveSubWalletMnemonic(normalizedMnemonic, 0);
          await BreezSparkService.initializeSDK(derivedMnemonic);
          sdkInitialized = true;
          console.log('✅ [useWallet] Breez SDK initialized for imported wallet');
        } catch (sdkError) {
          // Log SDK error but don't fail import - SDK may not be available in Expo Go
          console.warn('⚠️ [useWallet] SDK initialization failed:', sdkError);
        }

        await loadWalletData();

        // Mark as connected if SDK initialized - balance will be fetched by polling effect
        if (sdkInitialized) {
          setIsConnected(true);
        }

        console.log('✅ [useWallet] Master key imported:', masterKeyId);

        return masterKeyId;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to import wallet';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [masterKeys.length, loadWalletData]
  );

  // ========================================
  // Sub-Wallet Operations
  // ========================================

  const addSubWallet = useCallback(
    async (masterKeyId: string, nickname?: string): Promise<number> => {
      try {
        setIsLoading(true);
        setError(null);

        const nextIndex = await storageService.getNextSubWalletIndex(masterKeyId);
        if (nextIndex === -1) {
          throw new Error('Maximum sub-wallets reached');
        }

        const name = nickname ?? generateSubWalletNickname(nextIndex);
        const index = await storageService.addSubWallet(masterKeyId, name);

        await loadWalletData();
        console.log('✅ [useWallet] Sub-wallet added:', index);

        return index;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add sub-wallet';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [loadWalletData]
  );

  const archiveSubWallet = useCallback(
    async (masterKeyId: string, index: number): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);

        await storageService.archiveSubWallet(masterKeyId, index);
        await loadWalletData();

        console.log('✅ [useWallet] Sub-wallet archived:', index);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to archive sub-wallet';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [loadWalletData]
  );

  const restoreSubWallet = useCallback(
    async (masterKeyId: string, index: number): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);

        await storageService.restoreSubWallet(masterKeyId, index);
        await loadWalletData();

        console.log('✅ [useWallet] Sub-wallet restored:', index);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to restore sub-wallet';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [loadWalletData]
  );

  // ========================================
  // Wallet Switching
  // ========================================

  const switchWallet = useCallback(
    async (masterKeyId: string, subWalletIndex: number, pin?: string): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);

        await storageService.setActiveWallet(masterKeyId, subWalletIndex);

        // Reconnect Breez SDK with the new wallet's mnemonic
        if (pin) {
          try {
            const mnemonic = await storageService.getMasterKeyMnemonic(masterKeyId, pin);
            if (mnemonic) {
              await BreezSparkService.disconnectSDK();
              const derivedMnemonic = deriveSubWalletMnemonic(mnemonic, subWalletIndex);
              await BreezSparkService.initializeSDK(derivedMnemonic);
              console.log('✅ [useWallet] Breez SDK reconnected for switched wallet');
            }
          } catch (sdkError) {
            // Log SDK error but don't fail switch - SDK may not be available in Expo Go
            console.warn('⚠️ [useWallet] SDK reconnection failed:', sdkError);
          }
        }

        await loadWalletData();

        console.log('✅ [useWallet] Switched to wallet:', {
          masterKeyId,
          subWalletIndex,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to switch wallet';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [loadWalletData]
  );

  // ========================================
  // Master Key Operations
  // ========================================

  const deleteMasterKey = useCallback(
    async (masterKeyId: string, pin: string): Promise<{ activeDeleted: boolean; nextActiveId: string | null }> => {
      try {
        setIsLoading(true);
        setError(null);

        const isActive = masterKeyId === activeMasterKey?.id;

        // Verify PIN first
        const isValidPin = await storageService.verifyMasterKeyPin(
          masterKeyId,
          pin
        );
        if (!isValidPin) {
          throw new Error('Invalid PIN');
        }

        // If active, disconnect SDK first
        if (isActive) {
          await BreezSparkService.disconnectSDK().catch(e => console.warn('⚠️ [useWallet] Failed to disconnect SDK during delete:', e));
          setIsConnected(false);
          setBalance(0);
          setTransactions([]);
        }

        await storageService.deleteMasterKey(masterKeyId);

        // Reload data to see changes
        const storageData = await storageService.loadMultiWalletStorage();
        setStorage(storageData);

        const nextActiveId = storageData?.activeMasterKeyId || null;

        console.log('✅ [useWallet] Master key deleted:', masterKeyId, {
          isActiveWasDeleted: isActive,
          nextActiveId
        });

        return { activeDeleted: isActive, nextActiveId };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete wallet';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [activeMasterKey?.id, loadWalletData]
  );

  const renameMasterKey = useCallback(
    async (masterKeyId: string, nickname: string): Promise<void> => {
      // TODO: Implement in storageService
      console.log('🔵 [useWallet] Rename master key:', { masterKeyId, nickname });
    },
    []
  );

  const renameSubWallet = useCallback(
    async (
      masterKeyId: string,
      index: number,
      nickname: string
    ): Promise<void> => {
      // TODO: Implement in storageService
      console.log('🔵 [useWallet] Rename sub-wallet:', {
        masterKeyId,
        index,
        nickname,
      });
    },
    []
  );

  // ========================================
  // Balance and Transactions
  // ========================================

  const refreshBalance = useCallback(async (): Promise<void> => {
    try {
      const walletInfo = await storageService.getActiveWalletInfo();

      if (!walletInfo) {
        setBalance(0);
        setIsLoading(false);
        return;
      }

      // Load from cache first for instant display
      const cached = await WalletCache.getCachedBalance(
        walletInfo.masterKeyId,
        walletInfo.subWalletIndex
      );

      if (cached) {
        setBalance(cached.balance);
        setIsLoading(false);
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      // Fetch fresh data from SDK
      if (!BreezSparkService.isSDKInitialized()) {
        if (!cached) {
          setBalance(0);
          setIsLoading(false);
        }
        setIsRefreshing(false);
        return;
      }

      const walletBalance = await BreezSparkService.getBalance();
      setBalance(walletBalance.balanceSat);
      setIsLoading(false);
      setIsRefreshing(false);

      // Update cache with fresh data
      await WalletCache.cacheBalance(
        walletInfo.masterKeyId,
        walletInfo.subWalletIndex,
        walletBalance.balanceSat
      );

      // Update activity flag
      if (walletInfo) {
        const hasActivity = walletBalance.balanceSat > 0 || transactionsRef.current.length > 0;
        storageService.updateSubWalletActivity(
          walletInfo.masterKeyId,
          walletInfo.subWalletIndex,
          hasActivity
        ).catch(err => console.warn('⚠️ [useWallet] Failed to update activity:', err));
      }
    } catch (err) {
      console.error('❌ [useWallet] Failed to refresh balance:', err);
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const refreshTransactions = useCallback(async (): Promise<void> => {
    try {
      const walletInfo = await storageService.getActiveWalletInfo();
      if (!walletInfo) {
        setTransactions([]);
        return;
      }

      // Load from cache first for instant display
      const cached = await WalletCache.getCachedTransactions(
        walletInfo.masterKeyId,
        walletInfo.subWalletIndex
      );

      if (cached) {
        setTransactions(cached.transactions);
        setIsRefreshing(true); // Background refresh indicator
      }

      // Fetch fresh data from SDK
      if (!BreezSparkService.isSDKInitialized()) {
        // If SDK not initialized and we have cache, keep using it
        if (!cached) {
          setTransactions([]);
        }
        setIsRefreshing(false);
        return;
      }

      const payments = await BreezSparkService.listPayments();
      
      // Map TransactionInfo to Transaction type
      const txs: Transaction[] = payments.map((p) => ({
        id: p.id,
        type: p.type,
        amount: p.amountSat,
        feeSats: p.feeSat,
        status: p.status,
        timestamp: p.timestamp,
        description: p.description,
      }));
      
      setTransactions(txs);
      setIsRefreshing(false);

      // Update cache with fresh data
      await WalletCache.cacheTransactions(
        walletInfo.masterKeyId,
        walletInfo.subWalletIndex,
        txs
      );

      // Update activity flag
      if (walletInfo) {
        const hasActivity = txs.length > 0 || balanceRef.current > 0;
        storageService.updateSubWalletActivity(
          walletInfo.masterKeyId,
          walletInfo.subWalletIndex,
          hasActivity
        ).catch(err => console.warn('⚠️ [useWallet] Failed to update activity:', err));
      }
    } catch (err) {
      console.error('❌ [useWallet] Failed to refresh transactions:', err);
      setIsRefreshing(false);
    }
  }, []);

  // ========================================
  // Real-time Payment Event Listener
  // ========================================
  
  // NOTE: Disabled - The SDK addEventListener was causing native crashes
  // Real-time payment updates will be reimplemented when proper Breez SDK event API is available
  // For now, users need to pull-to-refresh manually to see new transactions

  // ========================================
  // SDK Connection StatusSync
  // ========================================

  // Poll for SDK status changes (handles async initialization from useWalletAuth)
  // This ensures balance loads after SDK becomes available
  useEffect(() => {
    let isMounted = true;
    let interval: number | null = null;

    const checkAndSync = async (): Promise<void> => {
      try {
        if (!isMounted) return;
        
        const sdkInitialized = BreezSparkService.isSDKInitialized();

        if (sdkInitialized && !isConnected && isMounted) {
          setIsConnected(true);
          // Refresh balance and transactions when SDK becomes available
          try {
            await refreshBalance();
            await refreshTransactions();
          } catch (refreshError) {
            console.error('❌ [useWallet] Refresh error in SDK sync:', refreshError);
          }
        } else if (!sdkInitialized && isConnected && isMounted) {
          console.log('⚠️ [useWallet] SDK disconnected');
          setIsConnected(false);
        }
      } catch (error) {
        console.error('❌ [useWallet] SDK sync check error:', error);
      }
    };

    // Initial check with error handling
    checkAndSync().catch(err => {
      console.error('❌ [useWallet] Initial SDK sync error:', err);
    });

    // Poll every 500ms until SDK is initialized
    try {
      interval = global.setInterval(() => {
        if (!isConnected && isMounted) {
          checkAndSync().catch(err => {
            console.error('❌ [useWallet] Polling SDK sync error:', err);
          });
        }
      }, 500);
    } catch (error) {
      console.error('❌ [useWallet] Failed to start SDK polling:', error);
    }

    return (): void => {
      isMounted = false;
      if (interval) {
        try {
          global.clearInterval(interval);
        } catch (error) {
          console.error('❌ [useWallet] Interval cleanup error:', error);
        }
      }
    };
  }, [isConnected, refreshBalance, refreshTransactions]);

  // ========================================
  // Payment Operations
  // ========================================

  const sendPayment = useCallback(
    async (bolt11: string): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('🔵 [sendPayment] Starting payment...');
        const result = await BreezSparkService.payInvoice(bolt11);
        
        if (!result.success) {
          console.log('❌ [sendPayment] Payment failed:', result.error);
          return false;
        }

        console.log('✅ [sendPayment] Payment successful, paymentId:', result.paymentId);
        
        // Refresh balance and transactions
        console.log('🔄 [sendPayment] Refreshing balance...');
        await refreshBalance();
        
        console.log('🔄 [sendPayment] Refreshing transactions...');
        await refreshTransactions();
        
        console.log('✅ [sendPayment] All refreshes complete');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Payment failed';
        console.error('❌ [sendPayment] Error:', message);
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [refreshBalance, refreshTransactions]
  );

  const receivePayment = useCallback(
    async (amountSats: number, description?: string): Promise<string> => {
      try {
        setIsLoading(true);
        setError(null);

        const result = await BreezSparkService.receivePayment(
          amountSats,
          description
        );

        return result.paymentRequest;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate invoice';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // ========================================
  // Utility Functions
  // ========================================

  const getMnemonic = useCallback(
    async (masterKeyId: string, pin: string): Promise<string> => {
      const mnemonic = await storageService.getMasterKeyMnemonic(masterKeyId, pin);
      if (!mnemonic) {
        throw new Error('Failed to get mnemonic');
      }
      return mnemonic;
    },
    []
  );



  const getAddSubWalletDisabledReason = useCallback(
    (masterKeyId: string): string | null => {
      const masterKey = masterKeys.find((mk) => mk.id === masterKeyId);
      if (!masterKey) return 'Wallet not found';

      // Check limit
      const totalIndices = [
        ...masterKey.subWallets.map((sw) => sw.index),
        ...masterKey.archivedSubWallets.map((sw) => sw.index),
      ];
      if (totalIndices.length >= 20) {
        return 'Maximum number of sub-wallets reached';
      }

      // Check if last sub-wallet has activity
      const lastSubWallet =
        masterKey.subWallets[masterKey.subWallets.length - 1];
      
      if (!lastSubWallet) return null; // No sub-wallets yet, allowed

      // Check if we are connected to this last sub-wallet
      const isConnectedToLast = activeWalletInfo &&
                                activeWalletInfo.masterKeyId === masterKeyId &&
                                activeWalletInfo.subWalletIndex === lastSubWallet.index;

      if (isConnectedToLast) {
         // Use real-time state
         const hasActivity = balance > 0 || transactions.length > 0;
         if (hasActivity) return null;
         
         const name = lastSubWallet.nickname || 'Last sub-wallet';
         return `${name} must have transactions before adding another`;
      }

      // Not connected to last sub-wallet - use stored flag
      // Strict Policy: Only allow if explicitly true
      if (lastSubWallet.hasActivity === true) {
        return null;
      }
      
      const name = lastSubWallet.nickname || 'Last sub-wallet';
      return `${name} must have transactions before adding another`;
    },
    [masterKeys, activeWalletInfo, balance, transactions]
  );

  /**
   * Background sync activity for a specific sub-wallet
   * This is used to determine if a sub-wallet has had any activity
   * so we can enable/disable the "Add Sub-Wallet" button.
   */
  const syncSubWalletActivity = useCallback(
    async (
      masterKeyId: string,
      subWalletIndex: number,
      pin: string,
      restorePin?: string | null
    ): Promise<boolean> => {
      console.log('🔄 [useWallet] Syncing sub-wallet activity:', {
        masterKeyId,
        subWalletIndex,
      });

      try {
        // 1. Get mnemonic for the target master key
        const mnemonic = await storageService.getMasterKeyMnemonic(masterKeyId, pin);
        if (!mnemonic) return false;

        // 2. Identify current connection to restore later
        const originalWallet = await storageService.getActiveWalletInfo();

        // 3. Derive target mnemonic and initialize SDK
        const derivedMnemonic = deriveSubWalletMnemonic(mnemonic, subWalletIndex);
        
        // Disconnect current
        await BreezSparkService.disconnectSDK().catch(() => {});
        
        // Initialize target
        await BreezSparkService.initializeSDK(derivedMnemonic);
        
        // 4. Fetch transactions
        const payments = await BreezSparkService.listPayments();
        const hasActivity = payments.length > 0;

        // 5. Update storage
        if (hasActivity) {
          await storageService.updateSubWalletActivity(masterKeyId, subWalletIndex, true);
          await loadWalletData(); // Refresh local state
        }

        // 6. Restore original connection
        if (originalWallet && (restorePin || pin)) {
          try {
            // Use restorePin if provided, otherwise fall back to current pin (if it was same wallet)
            const rPin = restorePin || pin;
            const orgMnemonic = await storageService.getMasterKeyMnemonic(originalWallet.masterKeyId, rPin);
            if (orgMnemonic) {
              const orgDerived = deriveSubWalletMnemonic(orgMnemonic, originalWallet.subWalletIndex);
              await BreezSparkService.disconnectSDK().catch(() => {});
              await BreezSparkService.initializeSDK(orgDerived);
              console.log('✅ [useWallet] Restored original wallet connection');
            }
          } catch (restoreError) {
            console.warn('⚠️ [useWallet] Failed to restore original connection after sync:', restoreError);
          }
        }

        return hasActivity;
      } catch (err) {
        console.error('❌ [useWallet] syncSubWalletActivity failed:', err);
        return false;
      }
    },
    [loadWalletData]
  );

  const canAddSubWallet = useCallback(
    (masterKeyId: string): boolean => {
      return getAddSubWalletDisabledReason(masterKeyId) === null;
    },
    [getAddSubWalletDisabledReason]
  );

  // ========================================
  // Return Hook Value
  // ========================================

  return {
    // State
    isLoading,
    isRefreshing,
    isConnected,
    error,
    activeWalletInfo,
    balance,
    transactions,
    masterKeys,
    activeMasterKey,
    activeSubWallet,

    // Actions
    createMasterKey,
    importMasterKey,
    addSubWallet,
    archiveSubWallet,
    restoreSubWallet,
    switchWallet,
    deleteMasterKey,
    renameMasterKey,
    renameSubWallet,
    refreshBalance,
    refreshTransactions,
    sendPayment,
    receivePayment,
    syncSubWalletActivity,
    getMnemonic,
    canAddSubWallet,
    getAddSubWalletDisabledReason,
  };
}
