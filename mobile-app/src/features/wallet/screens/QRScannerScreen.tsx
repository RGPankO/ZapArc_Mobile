// QR Scanner Screen
// Camera-based QR scanning for Lightning invoices, LNURL, and addresses

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Keyboard,
  Alert,
} from 'react-native';
import { Text, IconButton, Button, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import type { LNURLType } from '../../../utils/lnurl';

// =============================================================================
// Types
// =============================================================================

type ScanMode = 'camera' | 'manual';

interface ParsedQRData {
  type: 'invoice' | 'lnurl' | 'address' | 'unknown';
  value: string;
  amount?: number;
  description?: string;
}

// =============================================================================
// Component
// =============================================================================

export function QRScannerScreen(): React.JSX.Element {
  // State
  const [permission, requestPermission] = useCameraPermissions();
  const [scanMode, setScanMode] = useState<ScanMode>('camera');
  const [manualInput, setManualInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [scanned, setScanned] = useState(false);

  // ========================================
  // QR Code Parsing
  // ========================================

  const parseQRData = useCallback((data: string): ParsedQRData => {
    const trimmed = data.trim().toLowerCase();

    // Lightning Invoice (bolt11)
    if (trimmed.startsWith('lightning:') || trimmed.startsWith('lnbc') || trimmed.startsWith('lntb')) {
      const invoice = trimmed.startsWith('lightning:')
        ? trimmed.replace('lightning:', '')
        : trimmed;
      return { type: 'invoice', value: invoice };
    }

    // LNURL
    if (trimmed.startsWith('lnurl')) {
      return { type: 'lnurl', value: trimmed };
    }

    // Lightning Address (user@domain format)
    if (trimmed.includes('@') && trimmed.includes('.')) {
      return { type: 'address', value: trimmed };
    }

    // Bitcoin on-chain (not supported but detect)
    if (trimmed.startsWith('bitcoin:') || trimmed.startsWith('bc1') || trimmed.startsWith('1') || trimmed.startsWith('3')) {
      return { type: 'unknown', value: data };
    }

    return { type: 'unknown', value: data };
  }, []);

  // ========================================
  // Handle Scanned Data
  // ========================================

  const handleScannedData = useCallback(
    async (data: string) => {
      if (isProcessing || scanned) return;

      setScanned(true);
      setIsProcessing(true);

      try {
        const parsed = parseQRData(data);

        switch (parsed.type) {
          case 'invoice':
            // Navigate to payment screen with invoice
            router.push({
              pathname: '/wallet/send',
              params: { invoice: parsed.value },
            });
            break;

          case 'lnurl':
            // Navigate to LNURL handler
            router.push({
              pathname: '/wallet/lnurl',
              params: { lnurl: parsed.value },
            });
            break;

          case 'address':
            // Navigate to send with lightning address
            router.push({
              pathname: '/wallet/send',
              params: { address: parsed.value },
            });
            break;

          case 'unknown':
            Alert.alert(
              'Unknown QR Code',
              'This QR code is not a valid Lightning invoice, LNURL, or Lightning address.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    setScanned(false);
                    setIsProcessing(false);
                  },
                },
              ]
            );
            break;
        }
      } catch (error) {
        console.error('Error processing QR code:', error);
        Alert.alert('Error', 'Failed to process QR code');
        setScanned(false);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, scanned, parseQRData]
  );

  // ========================================
  // Camera Barcode Handler
  // ========================================

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (result.data && !scanned) {
        handleScannedData(result.data);
      }
    },
    [handleScannedData, scanned]
  );

  // ========================================
  // Manual Input Handler
  // ========================================

  const handleManualSubmit = useCallback(() => {
    Keyboard.dismiss();
    if (manualInput.trim()) {
      handleScannedData(manualInput.trim());
    }
  }, [manualInput, handleScannedData]);

  // ========================================
  // Permission Request
  // ========================================

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FFC107" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <View style={styles.permissionContent}>
          <Text style={styles.permissionIcon}>📷</Text>
          <Text style={styles.permissionTitle}>Camera Permission</Text>
          <Text style={styles.permissionText}>
            We need camera access to scan QR codes for Lightning payments.
          </Text>
          <Button
            mode="contained"
            onPress={requestPermission}
            style={styles.permissionButton}
            labelStyle={styles.permissionButtonLabel}
          >
            Grant Permission
          </Button>
          <Button
            mode="text"
            onPress={() => setScanMode('manual')}
            labelStyle={styles.manualEntryLink}
          >
            Enter code manually instead
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // ========================================
  // Render
  // ========================================

  return (
    <View style={styles.container}>
      {/* Header */}
      <SafeAreaView style={styles.header} edges={['top']}>
        <IconButton
          icon="close"
          iconColor="#FFFFFF"
          size={24}
          onPress={() => router.back()}
          style={styles.closeButton}
        />
        <Text style={styles.headerTitle}>Scan QR Code</Text>
        <View style={styles.headerSpacer} />
      </SafeAreaView>

      {/* Camera or Manual Input */}
      {scanMode === 'camera' ? (
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            enableTorch={flashEnabled}
          >
            {/* Scan Frame Overlay */}
            <View style={styles.overlay}>
              <View style={styles.overlayTop} />
              <View style={styles.overlayMiddle}>
                <View style={styles.overlaySide} />
                <View style={styles.scanFrame}>
                  {/* Corner decorations */}
                  <View style={[styles.corner, styles.cornerTopLeft]} />
                  <View style={[styles.corner, styles.cornerTopRight]} />
                  <View style={[styles.corner, styles.cornerBottomLeft]} />
                  <View style={[styles.corner, styles.cornerBottomRight]} />
                  {/* Crosshair for easy aiming */}
                  <View style={styles.crosshairHorizontal} />
                  <View style={styles.crosshairVertical} />
                </View>
                <View style={styles.overlaySide} />
              </View>
              <View style={styles.overlayBottom}>
                <Text style={styles.scanHint}>
                  Point your camera at a Lightning QR code
                </Text>
              </View>
            </View>

            {/* Processing Indicator */}
            {isProcessing && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color="#FFC107" />
                <Text style={styles.processingText}>Processing...</Text>
              </View>
            )}
          </CameraView>
        </View>
      ) : (
        <View style={styles.manualInputContainer}>
          <Text style={styles.manualInputTitle}>Enter Payment Code</Text>
          <Text style={styles.manualInputSubtitle}>
            Paste a Lightning invoice, LNURL, or Lightning address
          </Text>

          <TextInput
            style={styles.manualInput}
            value={manualInput}
            onChangeText={setManualInput}
            placeholder="lnbc... or LNURL... or user@domain.com"
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            multiline
            numberOfLines={4}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Button
            mode="contained"
            onPress={handleManualSubmit}
            disabled={!manualInput.trim() || isProcessing}
            loading={isProcessing}
            style={styles.submitButton}
            labelStyle={styles.submitButtonLabel}
          >
            Continue
          </Button>
        </View>
      )}

      {/* Bottom Actions */}
      <SafeAreaView style={styles.bottomActions} edges={['bottom']}>
        {scanMode === 'camera' && (
          <View style={styles.cameraActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setFlashEnabled(!flashEnabled)}
            >
              <IconButton
                icon={flashEnabled ? 'flashlight' : 'flashlight-off'}
                iconColor="#FFFFFF"
                size={24}
              />
              <Text style={styles.actionButtonText}>
                {flashEnabled ? 'Flash On' : 'Flash Off'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setScanMode('manual')}
            >
              <IconButton icon="keyboard" iconColor="#FFFFFF" size={24} />
              <Text style={styles.actionButtonText}>Enter Manually</Text>
            </TouchableOpacity>

            {scanned && (
              <TouchableOpacity
                style={styles.rescanButton}
                onPress={() => setScanned(false)}
              >
                <Text style={styles.rescanButtonText}>Scan Again</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {scanMode === 'manual' && (
          <TouchableOpacity
            style={styles.switchModeButton}
            onPress={() => setScanMode('camera')}
          >
            <IconButton icon="camera" iconColor="#FFC107" size={20} />
            <Text style={styles.switchModeText}>Use Camera Instead</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  permissionContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#FFC107',
    borderRadius: 12,
    paddingHorizontal: 32,
  },
  permissionButtonLabel: {
    color: '#1a1a2e',
    fontWeight: '600',
  },
  manualEntryLink: {
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  closeButton: {
    margin: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 48,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  overlayMiddle: {
    flexDirection: 'row',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  scanFrame: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#FFC107',
    borderWidth: 3,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  crosshairHorizontal: {
    position: 'absolute',
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255, 193, 7, 0.8)',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -1,
  },
  crosshairVertical: {
    position: 'absolute',
    width: 2,
    height: 40,
    backgroundColor: 'rgba(255, 193, 7, 0.8)',
    top: '50%',
    left: '50%',
    marginLeft: -1,
    marginTop: -20,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    paddingTop: 32,
  },
  scanHint: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
  },
  manualInputContainer: {
    flex: 1,
    padding: 24,
    paddingTop: 100,
    backgroundColor: '#1a1a2e',
  },
  manualInputTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  manualInputSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 24,
  },
  manualInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  submitButton: {
    backgroundColor: '#FFC107',
    borderRadius: 12,
  },
  submitButtonLabel: {
    color: '#1a1a2e',
    fontWeight: '600',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingTop: 16,
  },
  cameraActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    paddingBottom: 16,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  rescanButton: {
    alignItems: 'center',
    padding: 8,
  },
  rescanButtonText: {
    color: '#FFC107',
    fontSize: 14,
    fontWeight: '600',
  },
  switchModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  switchModeText: {
    color: '#FFC107',
    fontSize: 16,
  },
});
