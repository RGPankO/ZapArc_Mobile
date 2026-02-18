// Wallet Cache Service
// Caches balance and transactions per wallet for instant display

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Transaction } from '../features/wallet/types';

// =============================================================================
// Types
// =============================================================================

interface CachedBalance {
  balanceSat: number;
  timestamp: number; // When this was cached
}

interface CachedTransactions {
  transactions: Transaction[];
  timestamp: number;
}

interface WalletCache {
  balance?: CachedBalance;
  transactions?: CachedTransactions;
}

// =============================================================================
// In-Memory Preload Cache (cross-hook bridge)
// =============================================================================

// Module-level cache so selectWallet (useWalletAuth) can preload data
// that useWallet reads on mount — eliminates the async gap that causes 0-balance flash.
let _preloadedBalance: number | null = null;
let _preloadedTransactions: Transaction[] | null = null;

export function setPreloadedData(balance: number, transactions: Transaction[]): void {
  _preloadedBalance = balance;
  _preloadedTransactions = transactions;
}

export function consumePreloadedBalance(): number | null {
  const val = _preloadedBalance;
  _preloadedBalance = null;
  return val;
}

export function consumePreloadedTransactions(): Transaction[] | null {
  const val = _preloadedTransactions;
  _preloadedTransactions = null;
  return val;
}

// =============================================================================
// Wallet Switch Event (cross-hook bridge)
// =============================================================================
// Simple event emitter so useWalletAuth.selectWallet can directly notify
// useWallet to reload — more reliable than focus-based detection.

export interface WalletSwitchEvent {
  masterKeyId: string;
  subWalletIndex: number;
  balance: number;
  transactions: Transaction[];
}

type WalletSwitchListener = (event: WalletSwitchEvent) => void;
const _switchListeners: Set<WalletSwitchListener> = new Set();

export function onWalletSwitch(listener: WalletSwitchListener): () => void {
  _switchListeners.add(listener);
  return () => { _switchListeners.delete(listener); };
}

export function emitWalletSwitch(event: WalletSwitchEvent): void {
  _switchListeners.forEach((listener) => listener(event));
}

// =============================================================================
// Constants
// =============================================================================

const CACHE_KEY_PREFIX = '@wallet_cache:';
const BALANCE_CACHE_KEY_PREFIX = '@wallet_balance_cache:';
const TX_CACHE_KEY_PREFIX = '@wallet_tx_cache:';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes - consider data stale after this

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Get cache key for a specific wallet
 */
function getCacheKey(masterKeyId: string, subWalletIndex: number): string {
  return `${CACHE_KEY_PREFIX}${masterKeyId}:${subWalletIndex}`;
}

function getBalanceCacheKey(masterKeyId: string, subWalletIndex: number): string {
  return `${BALANCE_CACHE_KEY_PREFIX}${masterKeyId}:${subWalletIndex}`;
}

function getTransactionsCacheKey(masterKeyId: string, subWalletIndex: number): string {
  return `${TX_CACHE_KEY_PREFIX}${masterKeyId}:${subWalletIndex}`;
}

/**
 * Check if cached data is stale
 */
function isStale(timestamp: number): boolean {
  return Date.now() - timestamp > CACHE_EXPIRY_MS;
}

/**
 * Get cached balance for a wallet
 */
export async function getCachedBalance(
  masterKeyId: string,
  subWalletIndex: number
): Promise<{ balance: number; isStale: boolean } | null> {
  try {
    const balanceKey = getBalanceCacheKey(masterKeyId, subWalletIndex);
    const cachedBalance = await AsyncStorage.getItem(balanceKey);

    if (cachedBalance) {
      const balance: CachedBalance = JSON.parse(cachedBalance);
      return {
        balance: balance.balanceSat,
        isStale: isStale(balance.timestamp),
      };
    }

    // Backward compatibility with legacy combined key
    const key = getCacheKey(masterKeyId, subWalletIndex);
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;

    const walletCache: WalletCache = JSON.parse(cached);
    if (!walletCache.balance) return null;

    return {
      balance: walletCache.balance.balanceSat,
      isStale: isStale(walletCache.balance.timestamp),
    };
  } catch (err) {
    console.error('❌ [WalletCache] Failed to get cached balance:', err);
    return null;
  }
}

/**
 * Cache balance for a wallet
 */
export async function cacheBalance(
  masterKeyId: string,
  subWalletIndex: number,
  balanceSat: number
): Promise<void> {
  try {
    const balanceKey = getBalanceCacheKey(masterKeyId, subWalletIndex);
    await AsyncStorage.setItem(
      balanceKey,
      JSON.stringify({
        balanceSat,
        timestamp: Date.now(),
      } satisfies CachedBalance)
    );
  } catch (err) {
    console.error('❌ [WalletCache] Failed to cache balance:', err);
  }
}

/**
 * Get cached transactions for a wallet
 */
export async function getCachedTransactions(
  masterKeyId: string,
  subWalletIndex: number
): Promise<{ transactions: Transaction[]; isStale: boolean } | null> {
  try {
    const txKey = getTransactionsCacheKey(masterKeyId, subWalletIndex);
    const cachedTransactions = await AsyncStorage.getItem(txKey);

    if (cachedTransactions) {
      const txs: CachedTransactions = JSON.parse(cachedTransactions);
      return {
        transactions: txs.transactions,
        isStale: isStale(txs.timestamp),
      };
    }

    // Backward compatibility with legacy combined key
    const key = getCacheKey(masterKeyId, subWalletIndex);
    const cached = await AsyncStorage.getItem(key);

    if (!cached) return null;

    const walletCache: WalletCache = JSON.parse(cached);

    if (!walletCache.transactions) return null;

    return {
      transactions: walletCache.transactions.transactions,
      isStale: isStale(walletCache.transactions.timestamp),
    };
  } catch (err) {
    console.error('❌ [WalletCache] Failed to get cached transactions:', err);
    return null;
  }
}

/**
 * Cache transactions for a wallet
 */
export async function cacheTransactions(
  masterKeyId: string,
  subWalletIndex: number,
  transactions: Transaction[]
): Promise<void> {
  try {
    const txKey = getTransactionsCacheKey(masterKeyId, subWalletIndex);
    await AsyncStorage.setItem(
      txKey,
      JSON.stringify({
        transactions,
        timestamp: Date.now(),
      } satisfies CachedTransactions)
    );
  } catch (err) {
    console.error('❌ [WalletCache] Failed to cache transactions:', err);
  }
}

/**
 * Clear cache for a specific wallet
 */
export async function clearWalletCache(
  masterKeyId: string,
  subWalletIndex: number
): Promise<void> {
  try {
    const key = getCacheKey(masterKeyId, subWalletIndex);
    const balanceKey = getBalanceCacheKey(masterKeyId, subWalletIndex);
    const txKey = getTransactionsCacheKey(masterKeyId, subWalletIndex);
    await AsyncStorage.multiRemove([key, balanceKey, txKey]);
  } catch (err) {
    console.error('❌ [WalletCache] Failed to clear cache:', err);
  }
}

/**
 * Clear all wallet caches
 */
export async function clearAllCaches(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((key) => key.startsWith(CACHE_KEY_PREFIX) || key.startsWith(BALANCE_CACHE_KEY_PREFIX) || key.startsWith(TX_CACHE_KEY_PREFIX));
    await AsyncStorage.multiRemove(cacheKeys);
  } catch (err) {
    console.error('❌ [WalletCache] Failed to clear all caches:', err);
  }
}
