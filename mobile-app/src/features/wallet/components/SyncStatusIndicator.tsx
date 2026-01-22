// Sync Status Component
// Displays offline/sync status with optional refresh action

import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, IconButton, ActivityIndicator } from 'react-native-paper';
import { useOfflineSync } from '../../../hooks/useOfflineSync';
import { BRAND_COLOR } from '../../../utils/theme-helpers';

// =============================================================================
// Types
// =============================================================================

interface SyncStatusProps {
  showLastSync?: boolean;
  compact?: boolean;
  onRefresh?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function SyncStatusIndicator({
  showLastSync = false,
  compact = false,
  onRefresh,
}: SyncStatusProps): React.JSX.Element | null {
  const {
    isOnline,
    isSyncing,
    lastSyncTime,
    pendingActions,
    hasStaleData,
    triggerSync,
  } = useOfflineSync();

  // Format last sync time
  const lastSyncText = useMemo(() => {
    if (!lastSyncTime) return 'Never synced';
    
    const now = Date.now();
    const diff = now - lastSyncTime;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }, [lastSyncTime]);

  // Handle refresh
  const handleRefresh = async (): Promise<void> => {
    if (onRefresh) {
      onRefresh();
    }
    await triggerSync();
  };

  // Offline indicator
  if (!isOnline) {
    return (
      <View style={[styles.container, styles.offlineContainer]}>
        <View style={styles.statusRow}>
          <View style={[styles.dot, styles.offlineDot]} />
          <Text style={styles.offlineText}>Offline</Text>
        </View>
        {pendingActions > 0 && (
          <Text style={styles.pendingText}>
            {pendingActions} pending action{pendingActions !== 1 ? 's' : ''}
          </Text>
        )}
      </View>
    );
  }

  // Syncing indicator
  if (isSyncing) {
    return (
      <View style={[styles.container, styles.syncingContainer]}>
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={BRAND_COLOR} />
          <Text style={styles.syncingText}>Syncing...</Text>
        </View>
      </View>
    );
  }

  // Stale data warning
  if (hasStaleData) {
    return (
      <TouchableOpacity
        style={[styles.container, styles.staleContainer]}
        onPress={handleRefresh}
      >
        <View style={styles.statusRow}>
          <View style={[styles.dot, styles.staleDot]} />
          <Text style={styles.staleText}>Data may be outdated</Text>
        </View>
        <IconButton
          icon="refresh"
          iconColor="#FF9800"
          size={18}
          onPress={handleRefresh}
        />
      </TouchableOpacity>
    );
  }

  // Compact mode - just show status dot
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={[styles.dot, styles.onlineDot]} />
      </View>
    );
  }

  // Full online status with last sync
  if (showLastSync) {
    return (
      <TouchableOpacity
        style={[styles.container, styles.onlineContainer]}
        onPress={handleRefresh}
      >
        <View style={styles.statusRow}>
          <View style={[styles.dot, styles.onlineDot]} />
          <Text style={styles.onlineText}>Online</Text>
        </View>
        <Text style={styles.lastSyncText}>Last sync: {lastSyncText}</Text>
      </TouchableOpacity>
    );
  }

  // Default - no visible indicator when online and data is fresh
  return null;
}

// =============================================================================
// Offline Banner Component
// =============================================================================

interface OfflineBannerProps {
  visible?: boolean;
}

export function OfflineBanner({ visible }: OfflineBannerProps): React.JSX.Element | null {
  const { isOnline, pendingActions } = useOfflineSync();

  if (isOnline && !visible) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.bannerContent}>
        <Text style={styles.bannerIcon}>📴</Text>
        <View style={styles.bannerTextContainer}>
          <Text style={styles.bannerTitle}>You're Offline</Text>
          <Text style={styles.bannerSubtitle}>
            {pendingActions > 0
              ? `${pendingActions} action${pendingActions !== 1 ? 's' : ''} will sync when online`
              : 'Some features may be limited'}
          </Text>
        </View>
      </View>
    </View>
  );
}

// =============================================================================
// Sync Button Component
// =============================================================================

interface SyncButtonProps {
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

export function SyncButton({ size = 'medium', showLabel = false }: SyncButtonProps): React.JSX.Element {
  const { isSyncing, isOnline, triggerSync } = useOfflineSync();

  const iconSize = size === 'small' ? 18 : size === 'large' ? 28 : 22;

  return (
    <TouchableOpacity
      style={styles.syncButton}
      onPress={() => triggerSync()}
      disabled={isSyncing || !isOnline}
    >
      {isSyncing ? (
        <ActivityIndicator size={size === 'small' ? 'small' : 'small'} color={BRAND_COLOR} />
      ) : (
        <IconButton
          icon="sync"
          iconColor={isOnline ? BRAND_COLOR : 'rgba(255, 255, 255, 0.3)'}
          size={iconSize}
        />
      )}
      {showLabel && (
        <Text
          style={[
            styles.syncButtonLabel,
            !isOnline && styles.syncButtonLabelDisabled,
          ]}
        >
          {isSyncing ? 'Syncing...' : 'Sync'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 4,
  },
  offlineContainer: {
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
  },
  syncingContainer: {
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
  },
  staleContainer: {
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
  },
  onlineContainer: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  compactContainer: {
    padding: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  offlineDot: {
    backgroundColor: '#F44336',
  },
  staleDot: {
    backgroundColor: '#FF9800',
  },
  onlineDot: {
    backgroundColor: '#4CAF50',
  },
  offlineText: {
    color: '#F44336',
    fontSize: 13,
    fontWeight: '600',
  },
  syncingText: {
    color: BRAND_COLOR,
    fontSize: 13,
    fontWeight: '500',
  },
  staleText: {
    color: '#FF9800',
    fontSize: 13,
  },
  onlineText: {
    color: '#4CAF50',
    fontSize: 13,
  },
  pendingText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    marginTop: 2,
    marginLeft: 16,
  },
  lastSyncText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
  },
  banner: {
    backgroundColor: 'rgba(244, 67, 54, 0.9)',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bannerSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncButtonLabel: {
    color: BRAND_COLOR,
    fontSize: 14,
    marginLeft: 4,
  },
  syncButtonLabelDisabled: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
});
