/**
 * Notification Subscription Service
 *
 * Manages push notification registration using cached lightning addresses.
 * Avoids needing to initialize the SDK for every wallet just to get its address.
 *
 * Cache lifecycle:
 * - Written: when SDK initializes and fetches lightning address (cacheWalletAddress)
 * - Read: at app startup to sync all subscriptions without SDK (syncAllFromCache)
 * - Cleared: when a wallet/sub-wallet is deleted or archived (clearWalletAddress)
 * - Updated: when lightning address changes (cacheWalletAddress overwrites)
 *
 * Edge cases handled:
 * - Wallet deleted/archived → address removed from cache → re-synced
 * - New wallet with no address yet → skipped, cached when address is registered
 * - Push token changes → re-sync all cached addresses with new token
 * - Cache corruption → graceful fallback, addresses re-cached on next SDK init
 * - Lightning address changes → overwritten in cache → re-synced
 */

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationTriggerService } from './notificationTriggerService';

const CACHE_KEY = '@notification_addresses';

interface AddressCache {
  // Map of "masterKeyId:subWalletIndex" → lightning address
  addresses: Record<string, string>;
  updatedAt: number;
}

/**
 * Read the cached addresses from AsyncStorage
 */
async function readCache(): Promise<AddressCache> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AddressCache;
      if (parsed.addresses && typeof parsed.addresses === 'object') {
        return parsed;
      }
    }
  } catch (error) {
    console.warn('⚠️ [NotifSubs] Failed to read address cache:', error);
  }
  return { addresses: {}, updatedAt: 0 };
}

/**
 * Write the cache to AsyncStorage
 */
async function writeCache(cache: AddressCache): Promise<void> {
  try {
    cache.updatedAt = Date.now();
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('⚠️ [NotifSubs] Failed to write address cache:', error);
  }
}

/**
 * Get the Expo push token (returns null if unavailable)
 */
async function getPushToken(): Promise<string | null> {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('⚠️ [NotifSubs] No project ID found');
      return null;
    }
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data || null;
  } catch (error) {
    console.warn('⚠️ [NotifSubs] Failed to get push token:', error);
    return null;
  }
}

/**
 * Cache a wallet's lightning address after SDK fetches it.
 * Call this from initializeSDK after getLightningAddress succeeds.
 * Automatically triggers a re-sync.
 */
export async function cacheWalletAddress(
  masterKeyId: string,
  subWalletIndex: number,
  lightningAddress: string,
  walletNickname?: string,
): Promise<void> {
  const key = `${masterKeyId}:${subWalletIndex}`;
  const cache = await readCache();

  // Skip if already cached with the same address (avoid unnecessary writes)
  if (cache.addresses[key] === lightningAddress) {
    return;
  }

  cache.addresses[key] = lightningAddress;
  await writeCache(cache);
  console.log(`✅ [NotifSubs] Cached address for ${key}: ${lightningAddress}`);

  // Re-sync all subscriptions with the updated cache
  await syncAllFromCache(walletNickname);
}

/**
 * Remove a wallet's cached address.
 * Call this when a wallet or sub-wallet is deleted/archived.
 * Automatically triggers a re-sync so the backend stops routing pushes to it.
 */
export async function clearWalletAddress(
  masterKeyId: string,
  subWalletIndex: number,
  walletNickname?: string,
): Promise<void> {
  const key = `${masterKeyId}:${subWalletIndex}`;
  const cache = await readCache();

  if (!(key in cache.addresses)) {
    return; // Nothing to clear
  }

  delete cache.addresses[key];
  await writeCache(cache);
  console.log(`🗑️ [NotifSubs] Cleared cached address for ${key}`);

  // Re-sync so backend removes the stale mapping
  await syncAllFromCache(walletNickname);
}

/**
 * Remove ALL cached addresses for a master key (all its sub-wallets).
 * Call this when an entire master key is deleted.
 */
export async function clearMasterKeyAddresses(
  masterKeyId: string,
  walletNickname?: string,
): Promise<void> {
  const cache = await readCache();
  const prefix = `${masterKeyId}:`;
  let changed = false;

  for (const key of Object.keys(cache.addresses)) {
    if (key.startsWith(prefix)) {
      delete cache.addresses[key];
      changed = true;
    }
  }

  if (changed) {
    await writeCache(cache);
    console.log(`🗑️ [NotifSubs] Cleared all cached addresses for master key ${masterKeyId}`);
    await syncAllFromCache(walletNickname);
  }
}

/**
 * Sync all cached lightning addresses with the backend in one shot.
 * Call this at app startup (no SDK needed) and after cache changes.
 *
 * If the cache is empty (e.g. fresh install), this is a no-op.
 * Addresses will be cached as wallets initialize their SDKs.
 */
export async function syncAllFromCache(walletNickname?: string): Promise<void> {
  const pushToken = await getPushToken();
  if (!pushToken) {
    console.warn('⚠️ [NotifSubs] No push token — skipping sync');
    return;
  }

  const cache = await readCache();
  const addresses = Object.values(cache.addresses).filter(Boolean);

  if (addresses.length === 0) {
    console.log('ℹ️ [NotifSubs] No cached addresses to sync');
    return;
  }

  // Deduplicate (two sub-wallets could theoretically have the same address)
  const uniqueAddresses = [...new Set(addresses)];

  console.log(`🔄 [NotifSubs] Syncing ${uniqueAddresses.length} cached addresses`);

  const result = await NotificationTriggerService.syncSubscriptions(
    pushToken,
    uniqueAddresses,
    walletNickname,
  );

  if (result.success) {
    console.log('✅ [NotifSubs] Sync complete');
  } else {
    console.warn('⚠️ [NotifSubs] Sync failed:', result.error);
  }
}

/**
 * Get all currently cached addresses (for debugging/display)
 */
export async function getCachedAddresses(): Promise<Record<string, string>> {
  const cache = await readCache();
  return cache.addresses;
}
