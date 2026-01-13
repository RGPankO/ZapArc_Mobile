// Tip QR Code Screen
// Display QR code for tip request with sharing options

import React, { useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  Share,
  TouchableOpacity,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Text, IconButton, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { decodeTipRequest } from './TipCreatorScreen';

// =============================================================================
// Component
// =============================================================================

export function TipQRCodeScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ encoded: string }>();
  const qrRef = useRef<any>(null);

  // Parse the tip request
  const tipRequest = useMemo(() => {
    if (!params.encoded) return null;
    return decodeTipRequest(params.encoded);
  }, [params.encoded]);

  // Handle share
  const handleShare = useCallback(async () => {
    if (!params.encoded) return;

    try {
      await Share.share({
        message: `⚡ Send me a tip via Lightning!\n\n${params.encoded}\n\nPowered by Zap Arc`,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  }, [params.encoded]);

  // Handle copy
  const handleCopy = useCallback(() => {
    if (!params.encoded) return;

    Clipboard.setString(params.encoded);
  }, [params.encoded]);

  // Handle save QR image
  const handleSaveQR = useCallback(() => {
    // TODO: Implement QR code image saving with react-native-view-shot
    Alert.alert('Coming Soon', 'QR code saving will be available soon');
  }, []);

  // Handle social share (with platform selection)
  const handleSocialShare = useCallback(
    async (platform: 'twitter' | 'nostr' | 'telegram' | 'whatsapp') => {
      if (!params.encoded) return;

      let message = '';
      const tipCode = params.encoded;

      switch (platform) {
        case 'twitter':
          message = `⚡ Support me with a Lightning tip!\n\n${tipCode}\n\n#Bitcoin #Lightning #ZapArc`;
          break;
        case 'nostr':
          message = `⚡ Send me a tip via Lightning!\n\n${tipCode}`;
          break;
        case 'telegram':
        case 'whatsapp':
          message = `⚡ Hey! You can send me a Lightning tip:\n\n${tipCode}`;
          break;
      }

      try {
        await Share.share({ message });
      } catch (error) {
        console.error('Share failed:', error);
      }
    },
    [params.encoded]
  );

  // Error state
  if (!tipRequest || !params.encoded) {
    return (
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>❌</Text>
            <Text style={styles.errorTitle}>Invalid Tip Request</Text>
            <Text style={styles.errorText}>
              The tip request data is invalid or missing.
            </Text>
            <Button
              mode="contained"
              onPress={() => router.back()}
              style={styles.backButton}
              labelStyle={styles.backButtonLabel}
            >
              Go Back
            </Button>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="close"
            iconColor="#FFFFFF"
            size={24}
            onPress={() => router.back()}
          />
          <Text style={styles.headerTitle}>Tip QR Code</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* QR Code */}
        <View style={styles.qrContainer}>
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>⚡ Scan to Tip</Text>
            
            <View style={styles.qrCodeWrapper}>
              <QRCode
                value={params.encoded}
                size={220}
                color="#1a1a2e"
                backgroundColor="#FFFFFF"
                getRef={(ref) => (qrRef.current = ref)}
              />
            </View>
            
            {/* Amounts Display */}
            <View style={styles.amountsContainer}>
              <Text style={styles.amountsLabel}>Available amounts:</Text>
              <View style={styles.amountChips}>
                {tipRequest.amounts.map((amount, index) => (
                  <View key={index} style={styles.amountChip}>
                    <Text style={styles.amountChipText}>
                      {amount.toLocaleString()} sats
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            
            {/* Address Display */}
            <View style={styles.addressContainer}>
              <Text style={styles.addressLabel}>To:</Text>
              <Text style={styles.addressText} numberOfLines={1}>
                {tipRequest.address}
              </Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {/* Primary Actions */}
          <View style={styles.primaryActions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleCopy}>
              <View style={styles.actionIcon}>
                <IconButton
                  icon="content-copy"
                  iconColor="#FFC107"
                  size={24}
                />
              </View>
              <Text style={styles.actionLabel}>Copy</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <View style={styles.actionIcon}>
                <IconButton
                  icon="share-variant"
                  iconColor="#FFC107"
                  size={24}
                />
              </View>
              <Text style={styles.actionLabel}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleSaveQR}>
              <View style={styles.actionIcon}>
                <IconButton
                  icon="download"
                  iconColor="#FFC107"
                  size={24}
                />
              </View>
              <Text style={styles.actionLabel}>Save</Text>
            </TouchableOpacity>
          </View>

          {/* Social Share Buttons */}
          <View style={styles.socialSection}>
            <Text style={styles.socialTitle}>Share on:</Text>
            <View style={styles.socialButtons}>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => handleSocialShare('twitter')}
              >
                <Text style={styles.socialButtonText}>𝕏</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => handleSocialShare('nostr')}
              >
                <Text style={styles.socialButtonText}>🦩</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => handleSocialShare('telegram')}
              >
                <Text style={styles.socialButtonText}>✈️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => handleSocialShare('whatsapp')}
              >
                <Text style={styles.socialButtonText}>💬</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Create New Button */}
        <View style={styles.bottomAction}>
          <Button
            mode="text"
            onPress={() => router.back()}
            labelStyle={styles.newTipButtonLabel}
          >
            Create New Tip Request
          </Button>
        </View>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 48,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#FFC107',
  },
  backButtonLabel: {
    color: '#1a1a2e',
  },
  qrContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  qrTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 16,
  },
  qrCodeWrapper: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  amountsContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  amountsLabel: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.5)',
    marginBottom: 8,
  },
  amountChips: {
    flexDirection: 'row',
    gap: 8,
  },
  amountChip: {
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  amountChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  addressContainer: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressLabel: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.5)',
    marginRight: 4,
  },
  addressText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a2e',
    maxWidth: 200,
  },
  actionsContainer: {
    padding: 24,
  },
  primaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginBottom: 24,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  socialSection: {
    alignItems: 'center',
  },
  socialTitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 12,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  socialButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialButtonText: {
    fontSize: 20,
  },
  bottomAction: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  newTipButtonLabel: {
    color: '#FFC107',
  },
});
