/**
 * Notification Subscription Service
 *
 * Manages push notification registration using identity public keys.
 * Each wallet's identityPubkey (derived from seed) is the stable, unique identifier.
 *
 * Cache structure:
 *   identityPubkey → lightningAddress
 *
 * Why identityPubkey?
 * - Deterministic: same seed always produces the same pubkey
 * - Unique per wallet: each sub-wallet derives a different key
 * - Stable: never changes for a given seed
 * - Cross-device: restore on new phone → same pubkey → same subscription
 *
 * Cache lifecycle:
 * - Written: when SDK initializes and fetches lightning address + identityPubkey
 * - Read: at app startup to sync all subscriptions without SDK
 * - Cleared: when a wallet/sub-wallet is deleted or archived
 * - Updated: when lightning address changes (overwritten in cache)
 *
 * Migration: on first read, if old-format keys (masterKeyId:index) exist,
 * they are preserved until overwritten by new pubkey-based entries.
 */

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationTriggerService, WalletSubscription } from './notificationTriggerService';

const CACHE_KEY = '@notification_addresses';
// Legacy key mapping: masterKeyId:subWalletIndex → identityPubkey
const PUBKEY_MAP_KEY = '@notification_pubkey_map';

interface AddressCache {
  // Map of identityPubkey → lightning address
  addresses: Record<string, string>;
  updatedAt: number;
}

interface PubkeyMap {
  // Map of "masterKeyId:subWalletIndex" → identityPubkey (for clear operations)
  map: Record<string, string>;
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
 * Read the pubkey mapping from AsyncStorage
 */
async function readPubkeyMap(): Promise<PubkeyMap> {
  try {
    const raw = await AsyncStorage.getItem(PUBKEY_MAP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PubkeyMap;
      if (parsed.map && typeof parsed.map === 'object') {
        return parsed;
      }
    }
  } catch (error) {
    console.warn('⚠️ [NotifSubs] Failed to read pubkey map:', error);
  }
  return { map: {} };
}

/**
 * Write the pubkey mapping to AsyncStorage
 */
async function writePubkeyMap(pkMap: PubkeyMap): Promise<void> {
  try {
    await AsyncStorage.setItem(PUBKEY_MAP_KEY, JSON.stringify(pkMap));
  } catch (error) {
    console.warn('⚠️ [NotifSubs] Failed to write pubkey map:', error);
  }
}

/**
 * Get the Expo push token (returns null if unavailable)
 */
async function getPushToken(): Promise<string | null> {
  try {
    const projectId = Constants.expoConfig?.extra?.expoProjectId;
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
 * Cache a wallet's lightning address keyed by its identity public key.
 * Also stores the masterKeyId:index → pubkey mapping for clear operations.
 * Call this from initializeSDK after getInfo + getLightningAddress succeed.
 * Automatically triggers a re-sync.
 */
export async function cacheWalletAddress(
  identityPubkey: string,
  lightningAddress: string,
  walletIdentity?: { masterKeyId: string; subWalletIndex: number },
  walletNickname?: string,
): Promise<void> {
  const cache = await readCache();

  // If we have walletIdentity, remove any old-format entry keyed by masterKeyId:index
  if (walletIdentity) {
    const legacyKey = `${walletIdentity.masterKeyId}:${walletIdentity.subWalletIndex}`;
    if (cache.addresses[legacyKey]) {
      delete cache.addresses[legacyKey];
      console.log(`🔄 [NotifSubs] Migrated legacy key ${legacyKey} → pubkey ${identityPubkey.slice(0, 12)}…`);
    }

    // Store the reverse mapping for clear operations
    const pkMap = await readPubkeyMap();
    pkMap.map[legacyKey] = identityPubkey;
    await writePubkeyMap(pkMap);
  }

  // Skip if already cached with the same address
  if (cache.addresses[identityPubkey] === lightningAddress) {
    return;
  }

  cache.addresses[identityPubkey] = lightningAddress;
  await writeCache(cache);
  console.log(`✅ [NotifSubs] Cached address for ${identityPubkey.slice(0, 12)}…: ${lightningAddress}`);

  // Re-sync all subscriptions
  await syncAllFromCache(walletNickname);
}

/**
 * Remove a wallet's cached address by identity public key.
 * Call this when a wallet or sub-wallet is deleted/archived.
 */
export async function clearWalletByPubkey(
  identityPubkey: string,
  walletNickname?: string,
): Promise<void> {
  const cache = await readCache();

  if (!(identityPubkey in cache.addresses)) {
    return;
  }

  delete cache.addresses[identityPubkey];
  await writeCache(cache);
  console.log(`🗑️ [NotifSubs] Cleared cached address for pubkey ${identityPubkey.slice(0, 12)}…`);

  await syncAllFromCache(walletNickname);
}

/**
 * Remove a wallet's cached address by masterKeyId + subWalletIndex.
 * Looks up the identityPubkey from the reverse mapping.
 * Backwards-compatible — works even if caller doesn't have the pubkey.
 */
export async function clearWalletAddress(
  masterKeyId: string,
  subWalletIndex: number,
  walletNickname?: string,
): Promise<void> {
  const legacyKey = `${masterKeyId}:${subWalletIndex}`;
  const cache = await readCache();

  // Try pubkey lookup first
  const pkMap = await readPubkeyMap();
  const pubkey = pkMap.map[legacyKey];

  if (pubkey && cache.addresses[pubkey]) {
    delete cache.addresses[pubkey];
    delete pkMap.map[legacyKey];
    await writePubkeyMap(pkMap);
    await writeCache(cache);
    console.log(`🗑️ [NotifSubs] Cleared cached address for ${legacyKey} (pubkey ${pubkey.slice(0, 12)}…)`);
    await syncAllFromCache(walletNickname);
    return;
  }

  // Fallback: try legacy key directly (pre-migration data)
  if (cache.addresses[legacyKey]) {
    delete cache.addresses[legacyKey];
    await writeCache(cache);
    console.log(`🗑️ [NotifSubs] Cleared legacy cached address for ${legacyKey}`);
    await syncAllFromCache(walletNickname);
  }
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
  const pkMap = await readPubkeyMap();
  const prefix = `${masterKeyId}:`;
  let changed = false;

  // Find all pubkeys for this master key and remove them
  for (const [legacyKey, pubkey] of Object.entries(pkMap.map)) {
    if (legacyKey.startsWith(prefix)) {
      if (cache.addresses[pubkey]) {
        delete cache.addresses[pubkey];
        changed = true;
      }
      delete pkMap.map[legacyKey];
    }
  }

  // Also clean up any legacy-format entries
  for (const key of Object.keys(cache.addresses)) {
    if (key.startsWith(prefix)) {
      delete cache.addresses[key];
      changed = true;
    }
  }

  if (changed) {
    await writeCache(cache);
    await writePubkeyMap(pkMap);
    console.log(`🗑️ [NotifSubs] Cleared all cached addresses for master key ${masterKeyId}`);
    await syncAllFromCache(walletNickname);
  }
}

/**
 * Sync all cached wallet subscriptions with the backend in one shot.
 * Sends identityPubkey + lightningAddress pairs for each wallet.
 * Call this at app startup (no SDK needed) and after cache changes.
 */
export async function syncAllFromCache(walletNickname?: string): Promise<void> {
  const pushToken = await getPushToken();
  if (!pushToken) {
    console.warn('⚠️ [NotifSubs] No push token — skipping sync');
    return;
  }

  const cache = await readCache();
  const entries = Object.entries(cache.addresses).filter(([_, addr]) => !!addr);

  if (entries.length === 0) {
    console.log('ℹ️ [NotifSubs] No cached wallets to sync');
    return;
  }

  // Build structured wallet list from cache (key = identityPubkey, value = lightningAddress)
  const wallets: WalletSubscription[] = entries.map(([key, address]) => ({
    identityPubkey: key,
    lightningAddress: address,
  }));

  console.log(`🔄 [NotifSubs] Syncing ${wallets.length} wallet subscriptions`);

  const result = await NotificationTriggerService.syncSubscriptions(
    pushToken,
    wallets,
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
