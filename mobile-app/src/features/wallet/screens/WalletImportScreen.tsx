// Wallet Import Screen
// Import existing wallet using 12 or 24-word mnemonic phrase

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Button, Text, ProgressBar } from 'react-native-paper';
import { StyledTextInput } from '../../../components';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  validateMnemonicForImport,
  normalizeMnemonic,
  getWordCount,
  generateMasterKeyNickname,
} from '../../../utils/mnemonic';
import * as Notifications from 'expo-notifications';
import { useWallet } from '../../../hooks/useWallet';
import { useSettings } from '../../../hooks/useSettings';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { getGradientColors, getPrimaryTextColor, getSecondaryTextColor, BRAND_COLOR } from '../../../utils/theme-helpers';

// =============================================================================
// Types
// =============================================================================

type ImportStep = 'input' | 'pin' | 'complete';

// =============================================================================
// Component
// =============================================================================

export function WalletImportScreen(): React.JSX.Element {
  const { importMasterKey, masterKeys } = useWallet();
  const { updateSettings } = useSettings();
  const { themeMode } = useAppTheme();

  // Theme colors
  const gradientColors = getGradientColors(themeMode);
  const primaryText = getPrimaryTextColor(themeMode);
  const secondaryText = getSecondaryTextColor(themeMode);

  // State
  const [currentStep, setCurrentStep] = useState<ImportStep>('input');
  const [mnemonic, setMnemonic] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [walletName, setWalletName] = useState(generateMasterKeyNickname(masterKeys.length + 1));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Progress calculation
  const progress = useMemo(() => {
    const steps: ImportStep[] = ['input', 'pin', 'complete'];
    return (steps.indexOf(currentStep) + 1) / steps.length;
  }, [currentStep]);

  // Mnemonic validation
  const mnemonicValidation = useMemo(() => {
    return validateMnemonicForImport(mnemonic);
  }, [mnemonic]);

  const wordCount = useMemo(() => {
    return getWordCount(mnemonic);
  }, [mnemonic]);

  // Handle wallet name update when masterKeys load (if name hasn't been changed yet)
  const nameChangedRef = useRef(false);
  useEffect(() => {
    if (!nameChangedRef.current && masterKeys.length > 0) {
      setWalletName(generateMasterKeyNickname(masterKeys.length + 1));
    }
  }, [masterKeys.length]);

  // PIN validation
  const pinValid = useMemo(() => {
    return pin.length >= 6 && pin === confirmPin;
  }, [pin, confirmPin]);

  // ========================================
  // Step 1: Mnemonic Input
  // ========================================

  const handleValidateMnemonic = useCallback(() => {
    setError(null);

    if (!mnemonicValidation.isValid) {
      setError(mnemonicValidation.error || 'Invalid recovery phrase');
      return;
    }

    setCurrentStep('pin');
  }, [mnemonicValidation]);

  // ========================================
  // Step 2: PIN Setup
  // ========================================

  const handleImportWallet = useCallback(async () => {
    if (!pinValid) {
      setError('PINs do not match or are too short');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const normalizedMnemonic = normalizeMnemonic(mnemonic);
      await importMasterKey(normalizedMnemonic, pin, walletName.trim() || undefined);
      setCurrentStep('complete');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import wallet';
      
      // Check for duplicate wallet error
      if (message.toLowerCase().includes('already')) {
        setError('This wallet has already been imported');
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [pinValid, pin, mnemonic, importMasterKey]);

  // ========================================
  // Step 3: Complete
  // ========================================

  const handleComplete = useCallback(async () => {
    // Ask for notification permission on wallet setup
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          await updateSettings({ notificationsEnabled: true, notifyPaymentReceived: true });
          console.log('✅ [WalletImport] Notification permission granted');
        }
      }
    } catch (err) {
      console.warn('⚠️ [WalletImport] Failed to request notification permission:', err);
    }
    router.replace('/wallet/home');
  }, [updateSettings]);

  // ========================================
  // Render Steps
  // ========================================

  const renderInputStep = () => (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.stepTitle, { color: primaryText }]}>Import Wallet</Text>
      <Text style={[styles.stepDescription, { color: secondaryText }]}>
        Enter your 12 or 24-word recovery phrase. Words should be separated by spaces.
      </Text>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <StyledTextInput
        mode="outlined"
        label="Recovery Phrase"
        value={mnemonic}
        onChangeText={(text) => {
          setMnemonic(text);
          setError(null);
        }}
        placeholder="word1 word2 word3..."
        style={styles.mnemonicInput}
        multiline
        numberOfLines={4}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* Word Count Indicator */}
      <View style={styles.wordCountContainer}>
        <Text
          style={[
            styles.wordCount,
            wordCount === 12 || wordCount === 24
              ? styles.wordCountValid
              : wordCount > 0
              ? styles.wordCountInvalid
              : null,
          ]}
        >
          {wordCount} / {wordCount > 12 ? 24 : 12} words
        </Text>
        {mnemonicValidation.isValid && (
          <Text style={styles.validIndicator}>✓ Valid phrase</Text>
        )}
      </View>

      {/* Tips */}
      <View style={styles.tipsContainer}>
        <Text style={styles.tipsTitle}>Tips:</Text>
        <Text style={styles.tipText}>• Enter words separated by spaces</Text>
        <Text style={styles.tipText}>• Words are case-insensitive</Text>
        <Text style={styles.tipText}>• Make sure to spell each word correctly</Text>
      </View>

      <Button
        mode="contained"
        onPress={handleValidateMnemonic}
        disabled={!mnemonic.trim()}
        style={styles.primaryButton}
        contentStyle={styles.buttonContent}
        labelStyle={styles.buttonLabel}
      >
        Continue
      </Button>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => router.back()}
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderPinStep = () => (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.stepTitle, { color: primaryText }]}>Set Your PIN</Text>
      <Text style={[styles.stepDescription, { color: secondaryText }]}>
        Create a 6-digit PIN to secure your wallet. You'll use this PIN to
        unlock the wallet.
      </Text>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.pinInputs}>
        <StyledTextInput
          mode="outlined"
          label="Wallet Name"
          value={walletName}
          onChangeText={(text: string) => {
            setWalletName(text);
            nameChangedRef.current = true;
          }}
          style={styles.pinInput}
        />

        <StyledTextInput
          mode="outlined"
          label="Enter 6-digit PIN"
          value={pin}
          onChangeText={(text) => {
            setPin(text.replace(/[^0-9]/g, ''));
            if (text.length === 6) {
              Keyboard.dismiss();
            }
          }}
          secureTextEntry
          keyboardType="numeric"
          maxLength={6}
          style={styles.pinInput}
        />
        {pin.length > 0 && pin.length < 6 && (
          <Text style={styles.pinHint}>{6 - pin.length} more digit{6 - pin.length !== 1 ? 's' : ''} needed</Text>
        )}

        <StyledTextInput
          mode="outlined"
          label="Confirm 6-digit PIN"
          value={confirmPin}
          onChangeText={(text) => {
            setConfirmPin(text.replace(/[^0-9]/g, ''));
            if (text.length === 6) {
              Keyboard.dismiss();
            }
          }}
          secureTextEntry
          keyboardType="numeric"
          maxLength={6}
          style={styles.pinInput}
        />
      </View>

      {pin.length > 0 && pin.length < 6 && confirmPin.length === 0 && (
        <Text style={styles.pinMismatch}>PIN must be exactly 6 digits</Text>
      )}
      {pin.length >= 6 && confirmPin.length >= 6 && pin !== confirmPin && (
        <Text style={styles.pinMismatch}>PINs do not match</Text>
      )}

      <Button
        mode="contained"
        onPress={handleImportWallet}
        disabled={!pinValid || isLoading}
        loading={isLoading}
        style={styles.primaryButton}
        contentStyle={styles.buttonContent}
        labelStyle={styles.buttonLabel}
      >
        Import Wallet
      </Button>
    </ScrollView>
  );

  const renderCompleteStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.successIcon}>
        <Text style={styles.successEmoji}>✅</Text>
      </View>

      <Text style={[styles.stepTitle, { color: primaryText }]}>Wallet Imported!</Text>
      <Text style={[styles.stepDescription, { color: secondaryText }]}>
        Your wallet has been successfully imported. You can now access your
        funds via the Lightning Network.
      </Text>

      <Button
        mode="contained"
        onPress={handleComplete}
        style={styles.primaryButton}
        contentStyle={styles.buttonContent}
        labelStyle={styles.buttonLabel}
      >
        Get Started
      </Button>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'input':
        return renderInputStep();
      case 'pin':
        return renderPinStep();
      case 'complete':
        return renderCompleteStep();
      default:
        return renderInputStep();
    }
  };

  return (
    <LinearGradient
      colors={gradientColors}
      style={styles.gradient}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <SafeAreaView style={styles.container}>
          {/* Progress Bar */}
          {currentStep !== 'complete' && (
            <View style={styles.progressContainer}>
              <ProgressBar
                progress={progress}
                color={BRAND_COLOR}
                style={styles.progressBar}
              />
              <Text style={styles.progressText}>
                Step {['input', 'pin'].indexOf(currentStep) + 1} of 2
              </Text>
            </View>
          )}

          {/* Content */}
          {renderCurrentStep()}

          {/* Back Button */}
          {currentStep === 'pin' && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setCurrentStep('input')}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          )}
        </SafeAreaView>
      </TouchableWithoutFeedback>
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
  progressContainer: {
    padding: 16,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  stepContent: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  stepDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  errorBox: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.3)',
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    textAlign: 'center',
  },
  mnemonicInput: {
    marginBottom: 12,
    minHeight: 100,
  },
  wordCountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  wordCount: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  wordCountValid: {
    color: '#4CAF50',
  },
  wordCountInvalid: {
    color: '#FF9800',
  },
  validIndicator: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  tipsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  tipsTitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  tipText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    marginBottom: 4,
  },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: BRAND_COLOR,
    marginTop: 16,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  cancelButton: {
    alignSelf: 'center',
    marginTop: 24,
    padding: 12,
  },
  cancelButtonText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
  },
  pinInputs: {
    gap: 16,
    marginBottom: 24,
  },
  pinInput: {
  },
  pinHint: {
    color: '#FF9800',
    fontSize: 12,
    marginTop: -4,
    marginBottom: 4,
    marginLeft: 4,
  },
  pinMismatch: {
    color: '#F44336',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  successIcon: {
    alignSelf: 'center',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successEmoji: {
    fontSize: 48,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 16,
    padding: 8,
  },
  backButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
});
