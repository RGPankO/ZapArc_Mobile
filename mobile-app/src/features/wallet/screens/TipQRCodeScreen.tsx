// Tip QR Code Screen
// Display QR code for tip request with sharing options

import React, { useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  Share,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import RNFS from 'react-native-fs';
import { Text, IconButton, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { decodeTipRequest } from './TipCreatorScreen';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { getGradientColors, getPrimaryTextColor, getSecondaryTextColor, BRAND_COLOR } from '../../../utils/theme-helpers';
import { useFeedback } from '../components/FeedbackComponents';

// =============================================================================
// Component
// =============================================================================

export function TipQRCodeScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ encoded: string }>();
  const qrRef = useRef<any>(null);
  const { themeMode } = useAppTheme();
  const { showSuccess, showError } = useFeedback();

  // Theme colors
  const gradientColors = getGradientColors(themeMode);
  const primaryText = getPrimaryTextColor(themeMode);
  const secondaryText = getSecondaryTextColor(themeMode);

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
  const handleCopy = useCallback(async () => {
    if (!params.encoded) return;

    await Clipboard.setStringAsync(params.encoded);
    showSuccess('Copied to clipboard!');
  }, [params.encoded, showSuccess]);

  // Handle save QR image
  const handleSaveQR = useCallback(async () => {
    if (!qrRef.current) {
      showError('QR code not ready');
      return;
    }

    try {
      // Get QR code as base64 data URL
      qrRef.current.toDataURL(async (dataURL: string) => {
        try {
          const fileName = `tip-qr-${Date.now()}.png`;
          const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

          // Write base64 image to cache
          await RNFS.writeFile(filePath, dataURL, 'base64');

          // Check if sharing is available and share the file
          const isAvailable = await Sharing.isAvailableAsync();
          if (isAvailable) {
            await Sharing.shareAsync(`file://${filePath}`, {
              mimeType: 'image/png',
              dialogTitle: 'Save QR Code',
            });
            showSuccess('QR code ready to save!');
          } else {
            // On Android, try to save directly to Downloads
            if (Platform.OS === 'android') {
              const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
              );
              if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                const downloadPath = `${RNFS.DownloadDirectoryPath}/${fileName}`;
                await RNFS.copyFile(filePath, downloadPath);
                showSuccess('QR code saved to Downloads!');
              } else {
                showError('Storage permission denied');
              }
            } else {
              showError('Sharing not available on this device');
            }
          }

          // Clean up cache file
          await RNFS.unlink(filePath).catch(() => {});
        } catch (error) {
          console.error('Save QR failed:', error);
          showError('Failed to save QR code');
        }
      });
    } catch (error) {
      console.error('Save QR failed:', error);
      showError('Failed to save QR code');
    }
  }, [showSuccess, showError]);

  // Error state
  if (!tipRequest || !params.encoded) {
    return (
      <LinearGradient
        colors={gradientColors}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>❌</Text>
            <Text style={[styles.errorTitle, { color: primaryText }]}>Invalid Tip Request</Text>
            <Text style={[styles.errorText, { color: secondaryText }]}>
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
      colors={gradientColors}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="close"
            iconColor={primaryText}
            size={24}
            onPress={() => router.back()}
          />
          <Text style={[styles.headerTitle, { color: primaryText }]}>Tip QR Code</Text>
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
                  iconColor={BRAND_COLOR}
                  size={24}
                />
              </View>
              <Text style={styles.actionLabel}>Copy</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <View style={styles.actionIcon}>
                <IconButton
                  icon="share-variant"
                  iconColor={BRAND_COLOR}
                  size={24}
                />
              </View>
              <Text style={styles.actionLabel}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleSaveQR}>
              <View style={styles.actionIcon}>
                <IconButton
                  icon="download"
                  iconColor={BRAND_COLOR}
                  size={24}
                />
              </View>
              <Text style={styles.actionLabel}>Save</Text>
            </TouchableOpacity>
          </View>

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
    backgroundColor: BRAND_COLOR,
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
    backgroundColor: 'rgba(247, 147, 26, 0.2)',
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
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(247, 147, 26, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
});
