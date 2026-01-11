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
// Constants
// =============================================================================

const CACHE_KEY_PREFIX = '@wallet_cache:';
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
    const key = getCacheKey(masterKeyId, subWalletIndex);
    
    // Get existing cache or create new
    let walletCache: WalletCache = {};
    const existing = await AsyncStorage.getItem(key);
    if (existing) {
      walletCache = JSON.parse(existing);
    }
    
    // Update balance
    walletCache.balance = {
      balanceSat,
      timestamp: Date.now(),
    };
    
    await AsyncStorage.setItem(key, JSON.stringify(walletCache));
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
    const key = getCacheKey(masterKeyId, subWalletIndex);
    
    // Get existing cache or create new
    let walletCache: WalletCache = {};
    const existing = await AsyncStorage.getItem(key);
    if (existing) {
      walletCache = JSON.parse(existing);
    }
    
    // Update transactions
    walletCache.transactions = {
      transactions,
      timestamp: Date.now(),
    };
    
    await AsyncStorage.setItem(key, JSON.stringify(walletCache));
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
    await AsyncStorage.removeItem(key);
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
    const cacheKeys = keys.filter((key) => key.startsWith(CACHE_KEY_PREFIX));
    await AsyncStorage.multiRemove(cacheKeys);
  } catch (err) {
    console.error('❌ [WalletCache] Failed to clear all caches:', err);
  }
}
