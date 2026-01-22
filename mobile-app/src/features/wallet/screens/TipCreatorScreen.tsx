// Tip Creator Screen
// Create tip requests with configurable amounts and Lightning address

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  Text,
  IconButton,
  Button,
  Divider,
} from 'react-native-paper';
import { StyledTextInput } from '../../../components';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettings } from '../../../hooks/useSettings';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { getGradientColors, getPrimaryTextColor, getSecondaryTextColor, BRAND_COLOR } from '../../../utils/theme-helpers';

// =============================================================================
// Types
// =============================================================================

interface TipAmount {
  label: string;
  value: number;
}

interface TipRequest {
  lnurl?: string;
  address?: string;
  amounts: number[];
  encoded: string;
}

// Default tip amounts in sats
const DEFAULT_TIP_AMOUNTS: TipAmount[] = [
  { label: '⚡ Small', value: 100 },
  { label: '💰 Medium', value: 500 },
  { label: '🎁 Large', value: 1000 },
];

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Encode a tip request into the standard format
 * Format: [lntip:lnurl:address:amt1:amt2:amt3]
 */
export function encodeTipRequest(
  address: string,
  amounts: number[],
  lnurl?: string
): string {
  const amt1 = amounts[0] || 100;
  const amt2 = amounts[1] || 500;
  const amt3 = amounts[2] || 1000;
  
  const lnurlPart = lnurl || '';
  return `[lntip:${lnurlPart}:${address}:${amt1}:${amt2}:${amt3}]`;
}

/**
 * Decode a tip request string
 */
export function decodeTipRequest(encoded: string): TipRequest | null {
  const match = encoded.match(/\[lntip:([^:]*):([^:]+):(\d+):(\d+):(\d+)\]/);
  
  if (!match) return null;
  
  return {
    lnurl: match[1] || undefined,
    address: match[2],
    amounts: [parseInt(match[3]), parseInt(match[4]), parseInt(match[5])],
    encoded,
  };
}

// =============================================================================
// Component
// =============================================================================

export function TipCreatorScreen(): React.JSX.Element {
  const { settings } = useSettings();
  const { themeMode } = useAppTheme();

  // Theme colors
  const gradientColors = getGradientColors(themeMode);
  const primaryText = getPrimaryTextColor(themeMode);
  const secondaryText = getSecondaryTextColor(themeMode);

  // State
  const [address, setAddress] = useState('');
  const [lnurl, setLnurl] = useState('');
  const [useCustomLnurl, setUseCustomLnurl] = useState(false);
  const [amounts, setAmounts] = useState<number[]>([100, 500, 1000]);
  const [customAmountIndex, setCustomAmountIndex] = useState<number | null>(null);
  const [customAmountValue, setCustomAmountValue] = useState('');
  const [previewVisible, setPreviewVisible] = useState(false);

  // Load settings on mount
  useEffect(() => {
    if (settings?.defaultPostingAmounts) {
      setAmounts([...settings.defaultPostingAmounts]);
    }
    if (settings?.customLNURL) {
      setLnurl(settings.customLNURL);
      setUseCustomLnurl(true);
    }
    if (settings?.customLightningAddress) {
      setAddress(settings.customLightningAddress);
    }
  }, [settings]);

  // Generate tip request
  const tipRequest = useMemo((): TipRequest | null => {
    if (!address) return null;
    
    const encoded = encodeTipRequest(address, amounts, useCustomLnurl ? lnurl : undefined);
    
    return {
      lnurl: useCustomLnurl ? lnurl : undefined,
      address,
      amounts,
      encoded,
    };
  }, [address, amounts, lnurl, useCustomLnurl]);

  // Handle amount change
  const handleAmountChange = useCallback((index: number, value: number) => {
    setAmounts((prev) => {
      const newAmounts = [...prev];
      newAmounts[index] = value;
      return newAmounts;
    });
  }, []);

  // Handle custom amount input
  const handleCustomAmountSubmit = useCallback(() => {
    if (customAmountIndex === null) return;
    
    const value = parseInt(customAmountValue);
    if (isNaN(value) || value <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive number');
      return;
    }
    
    if (value > 100_000_000) {
      Alert.alert('Amount Too Large', 'Maximum amount is 100,000,000 sats (1 BTC)');
      return;
    }
    
    handleAmountChange(customAmountIndex, value);
    setCustomAmountIndex(null);
    setCustomAmountValue('');
  }, [customAmountIndex, customAmountValue, handleAmountChange]);

  // Handle share
  const handleShare = useCallback(async () => {
    if (!tipRequest) return;

    try {
      await Share.share({
        message: `⚡ Send me a tip via Lightning!\n\n${tipRequest.encoded}\n\nPowered by Zap Arc`,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  }, [tipRequest]);

  // Handle copy
  const handleCopy = useCallback(() => {
    if (!tipRequest) return;

    Clipboard.setString(tipRequest.encoded);
  }, [tipRequest]);

  // Navigate to QR display
  const handleShowQR = useCallback(() => {
    if (!tipRequest) return;
    
    router.push({
      pathname: '/wallet/tip/qr',
      params: { encoded: tipRequest.encoded },
    });
  }, [tipRequest]);

  // Preset amount buttons
  const presetAmounts = [50, 100, 250, 500, 1000, 2500, 5000, 10000];

  // ========================================
  // Render
  // ========================================

  return (
    <LinearGradient
      colors={gradientColors}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            iconColor={primaryText}
            size={24}
            onPress={() => router.back()}
          />
          <Text style={[styles.headerTitle, { color: primaryText }]}>Create Tip Request</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Lightning Address */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: primaryText }]}>Lightning Address</Text>
            <StyledTextInput
              mode="outlined"
              value={address}
              onChangeText={setAddress}
              placeholder="you@wallet.com"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Custom LNURL (optional) */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setUseCustomLnurl(!useCustomLnurl)}
            >
              <View
                style={[
                  styles.checkbox,
                  useCustomLnurl && styles.checkboxChecked,
                ]}
              >
                {useCustomLnurl && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={[styles.toggleLabel, { color: secondaryText }]}>Use Custom LNURL</Text>
            </TouchableOpacity>
            
            {useCustomLnurl && (
              <StyledTextInput
                mode="outlined"
                value={lnurl}
                onChangeText={setLnurl}
                placeholder="LNURL..."
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}
          </View>

          <Divider style={styles.divider} />

          {/* Tip Amounts */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tip Amounts</Text>
            <Text style={styles.sectionSubtitle}>
              Configure 3 amounts for your tip request
            </Text>

            {amounts.map((amount, index) => (
              <View key={index} style={styles.amountRow}>
                <View style={styles.amountLabel}>
                  <Text style={styles.amountLabelText}>
                    {DEFAULT_TIP_AMOUNTS[index]?.label || `Amount ${index + 1}`}
                  </Text>
                </View>
                
                <TouchableOpacity
                  style={styles.amountValue}
                  onPress={() => {
                    setCustomAmountIndex(index);
                    setCustomAmountValue(amount.toString());
                  }}
                >
                  <Text style={styles.amountValueText}>
                    {amount.toLocaleString()} sats
                  </Text>
                  <IconButton
                    icon="pencil"
                    iconColor="rgba(255, 255, 255, 0.5)"
                    size={16}
                  />
                </TouchableOpacity>
              </View>
            ))}

            {/* Custom Amount Input Modal */}
            {customAmountIndex !== null && (
              <View style={styles.customAmountModal}>
                <Text style={styles.customAmountTitle}>
                  Enter Custom Amount
                </Text>
                <StyledTextInput
                  mode="outlined"
                  value={customAmountValue}
                  onChangeText={setCustomAmountValue}
                  keyboardType="numeric"
                  placeholder="Amount in sats"
                  style={styles.customAmountInput}
                  autoFocus
                />
                
                {/* Preset buttons */}
                <View style={styles.presetContainer}>
                  {presetAmounts.map((preset) => (
                    <TouchableOpacity
                      key={preset}
                      style={styles.presetButton}
                      onPress={() => setCustomAmountValue(preset.toString())}
                    >
                      <Text style={styles.presetButtonText}>{preset}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                <View style={styles.customAmountButtons}>
                  <Button
                    mode="outlined"
                    onPress={() => {
                      setCustomAmountIndex(null);
                      setCustomAmountValue('');
                    }}
                    style={styles.cancelButton}
                    labelStyle={styles.cancelButtonLabel}
                  >
                    Cancel
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleCustomAmountSubmit}
                    style={styles.confirmButton}
                    labelStyle={styles.confirmButtonLabel}
                  >
                    Set Amount
                  </Button>
                </View>
              </View>
            )}
          </View>

          <Divider style={styles.divider} />

          {/* Preview */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setPreviewVisible(!previewVisible)}
            >
              <Text style={styles.sectionTitle}>Preview</Text>
              <IconButton
                icon={previewVisible ? 'chevron-up' : 'chevron-down'}
                iconColor="rgba(255, 255, 255, 0.5)"
                size={24}
              />
            </TouchableOpacity>

            {previewVisible && tipRequest && (
              <View style={styles.previewContainer}>
                <Text style={styles.previewCode}>{tipRequest.encoded}</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            mode="contained"
            onPress={handleShowQR}
            disabled={!tipRequest}
            icon="qrcode"
            style={styles.primaryButton}
            contentStyle={styles.buttonContent}
            labelStyle={styles.primaryButtonLabel}
          >
            Show QR Code
          </Button>

          <View style={styles.secondaryButtons}>
            <Button
              mode="outlined"
              onPress={handleCopy}
              disabled={!tipRequest}
              icon="content-copy"
              style={styles.secondaryButton}
              labelStyle={styles.secondaryButtonLabel}
            >
              Copy
            </Button>
            <Button
              mode="outlined"
              onPress={handleShare}
              disabled={!tipRequest}
              icon="share-variant"
              style={styles.secondaryButton}
              labelStyle={styles.secondaryButtonLabel}
            >
              Share
            </Button>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 16,
  },
  input: {
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: BRAND_COLOR,
    borderColor: BRAND_COLOR,
  },
  checkmark: {
    color: '#1a1a2e',
    fontWeight: 'bold',
    fontSize: 14,
  },
  toggleLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  divider: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 16,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  amountLabel: {
    flex: 1,
  },
  amountLabelText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  amountValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountValueText: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_COLOR,
  },
  customAmountModal: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  customAmountTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  customAmountInput: {
    marginBottom: 12,
  },
  presetContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  presetButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
  },
  customAmountButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cancelButtonLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: BRAND_COLOR,
  },
  confirmButtonLabel: {
    color: '#1a1a2e',
  },
  previewContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  previewCode: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: BRAND_COLOR,
    textAlign: 'center',
  },
  actionButtons: {
    padding: 16,
    paddingBottom: 24,
  },
  primaryButton: {
    backgroundColor: BRAND_COLOR,
    borderRadius: 12,
    marginBottom: 12,
  },
  buttonContent: {
    paddingVertical: 6,
  },
  primaryButtonLabel: {
    color: '#1a1a2e',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
  },
  secondaryButtonLabel: {
    color: '#FFFFFF',
  },
});
