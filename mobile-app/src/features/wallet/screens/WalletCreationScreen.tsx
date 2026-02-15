// Wallet Creation Screen
// Multi-step wallet creation: Generate → Backup → Verify → PIN

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
  BackHandler,
  Keyboard,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button, Text, ProgressBar } from 'react-native-paper';
import { StyledTextInput } from '../../../components';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import {
  generateAndValidateMnemonic,
  generateMasterKeyNickname,
  validateMnemonic,
} from '../../../utils/mnemonic';
import { useWallet } from '../../../hooks/useWallet';
import { useSettings } from '../../../hooks/useSettings';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { getGradientColors, BRAND_COLOR } from '../../../utils/theme-helpers';

// =============================================================================
// Types
// =============================================================================

type CreationStep = 'generate' | 'backup' | 'verify' | 'pin' | 'complete';

interface MnemonicWord {
  index: number;
  word: string;
}

// =============================================================================
// Component
// =============================================================================

export function WalletCreationScreen(): React.JSX.Element {
  const { createMasterKey, masterKeys } = useWallet();
  const { updateSettings } = useSettings();
  const { themeMode } = useAppTheme();

  // Theme colors
  const gradientColors = getGradientColors(themeMode);

  // State
  const [currentStep, setCurrentStep] = useState<CreationStep>('generate');
  const [mnemonic, setMnemonic] = useState<string>('');
  const [mnemonicWords, setMnemonicWords] = useState<MnemonicWord[]>([]);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  // Verification state
  const [shuffledWords, setShuffledWords] = useState<string[]>([]);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [walletName, setWalletName] = useState(generateMasterKeyNickname(masterKeys.length + 1));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMnemonic, setShowMnemonic] = useState(false);

  // Handle wallet name update when masterKeys load (if name hasn't been changed yet)
  const nameChangedRef = useRef(false);
  useEffect(() => {
    if (!nameChangedRef.current && masterKeys.length > 0) {
      setWalletName(generateMasterKeyNickname(masterKeys.length + 1));
    }
  }, [masterKeys.length]);

  // Progress calculation
  const progress = useMemo(() => {
    const steps: CreationStep[] = ['generate', 'backup', 'verify', 'pin', 'complete'];
    return (steps.indexOf(currentStep) + 1) / steps.length;
  }, [currentStep]);

  // Handle go back to previous step
  const handleGoBack = useCallback(() => {
    const steps: CreationStep[] = ['generate', 'backup', 'verify', 'pin'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  }, [currentStep]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    Alert.alert(
      'Cancel Wallet Creation',
      'Are you sure you want to cancel? Your progress will be lost.',
      [
        { text: 'Continue', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => router.back(),
        },
      ]
    );
  }, []);

  // Handle Android hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (currentStep === 'complete') {
        // On complete step, allow normal navigation
        return false;
      }
      
      if (currentStep === 'generate') {
        // On first step, show cancel confirmation
        handleCancel();
        return true; // Prevent default back behavior
      }
      
      // On other steps, go to previous step
      handleGoBack();
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, [currentStep, handleCancel, handleGoBack]);

  // ========================================
  // Step 1: Generate Mnemonic
  // ========================================

  const handleGenerateMnemonic = useCallback(() => {
    const MAX_DISPLAY_VALIDATION_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_DISPLAY_VALIDATION_RETRIES; attempt++) {
      const newMnemonic = generateAndValidateMnemonic();
      const splitWords = newMnemonic.split(' ');
      const joinedMnemonic = splitWords.join(' ');
      const has12Words = splitWords.length === 12;
      const joinedValid = validateMnemonic(joinedMnemonic);

      if (has12Words && joinedValid) {
        if (__DEV__) {
          console.log('✅ [WalletCreation] Display mnemonic validation passed', {
            attempt,
          });
        }

        setMnemonic(newMnemonic);

        const words = splitWords.map((word, index) => ({
          index: index + 1,
          word,
        }));
        setMnemonicWords(words);

        // Shuffle words for verification step
        const wordList = words.map((w) => w.word);
        const shuffled = [...wordList].sort(() => Math.random() - 0.5);
        setShuffledWords(shuffled);

        setCurrentStep('backup');
        return;
      }

      console.error('❌ [WalletCreation] Display mnemonic validation failed, regenerating', {
        attempt,
        has12Words,
        joinedValid,
      });

      Alert.alert(
        'Recovery Phrase Error',
        'There was a problem preparing your recovery phrase. We will regenerate it now.'
      );
    }

    Alert.alert(
      'Recovery Phrase Error',
      'Failed to generate a valid recovery phrase. Please try again.'
    );
  }, []);

  // ========================================
  // Step 2: Backup Confirmation
  // ========================================

  const handleConfirmBackup = useCallback(() => {
    if (!backupConfirmed) {
      Alert.alert(
        'Confirm Backup',
        'Have you written down your recovery phrase? You will not be able to recover your wallet without it.',
        [
          { text: 'Not Yet', style: 'cancel' },
          {
            text: 'Yes, I Saved It',
            onPress: () => {
              setBackupConfirmed(true);
              setCurrentStep('verify');
            },
          },
        ]
      );
      return;
    }
    setCurrentStep('verify');
  }, [backupConfirmed]);

  // ========================================
  // Step 3: Verify Mnemonic
  // ========================================

  // Check if verification is correct
  const verificationCorrect = useMemo(() => {
    const originalWords = mnemonic.split(' ');
    
    if (pasteMode) {
      // Paste mode: compare pasted text with mnemonic
      const pastedWords = pasteText.trim().toLowerCase().split(/\s+/);
      if (pastedWords.length !== 12) return false;
      return pastedWords.every((word, i) => word === originalWords[i].toLowerCase());
    } else {
      // Chip selection mode: compare selected order with mnemonic
      if (selectedWords.length !== 12) return false;
      return selectedWords.every((word, i) => word === originalWords[i]);
    }
  }, [mnemonic, selectedWords, pasteMode, pasteText]);

  // Handle word chip selection
  const handleSelectWord = useCallback((word: string) => {
    setSelectedWords(prev => [...prev, word]);
    setShuffledWords(prev => {
      const index = prev.indexOf(word);
      const newWords = [...prev];
      newWords.splice(index, 1);
      return newWords;
    });
    setError(null);
  }, []);

  // Handle removing a selected word
  const handleRemoveWord = useCallback((index: number) => {
    const word = selectedWords[index];
    setSelectedWords(prev => {
      const newWords = [...prev];
      newWords.splice(index, 1);
      return newWords;
    });
    setShuffledWords(prev => [...prev, word].sort(() => Math.random() - 0.5));
  }, [selectedWords]);

  // Reset verification
  const handleResetVerification = useCallback(() => {
    const originalWords = mnemonic.split(' ');
    setShuffledWords([...originalWords].sort(() => Math.random() - 0.5));
    setSelectedWords([]);
    setPasteText('');
    setError(null);
  }, [mnemonic]);

  const handleVerify = useCallback(() => {
    if (!verificationCorrect) {
      setError('The words are not in the correct order. Please try again.');
      return;
    }
    setError(null);
    setCurrentStep('pin');
  }, [verificationCorrect]);

  // ========================================
  // Step 4: PIN Setup
  // ========================================

  const pinValid = useMemo(() => {
    return pin.length >= 6 && pin === confirmPin;
  }, [pin, confirmPin]);

  const handleCreateWallet = useCallback(async () => {
    if (!pinValid) {
      setError('PINs do not match or are too short');
      return;
    }

    if (!mnemonic) {
      setError('Recovery phrase not generated. Please go back and generate it again.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Use custom name or default to "Main Wallet"
      const nickname = walletName.trim() || undefined;
      await createMasterKey(pin, nickname, mnemonic);
      setCurrentStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create wallet');
    } finally {
      setIsLoading(false);
    }
  }, [pinValid, pin, walletName, mnemonic, createMasterKey]);

  // ========================================
  // Step 5: Complete
  // ========================================

  const handleComplete = useCallback(async () => {
    // Ask for notification permission on first wallet creation
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          await updateSettings({ notificationsEnabled: true, notifyPaymentReceived: true });
          console.log('✅ [WalletCreation] Notification permission granted');
        }
      }
    } catch (err) {
      console.warn('⚠️ [WalletCreation] Failed to request notification permission:', err);
    }
    router.replace('/wallet/home');
  }, [updateSettings]);

  // Copy mnemonic to clipboard
  const handleCopyMnemonic = useCallback(async () => {
    if (!mnemonic) return;

    Alert.alert(
      'Security Warning',
      'Copying your recovery phrase to the clipboard is risky. Only do this if you understand the risks.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Copy',
          style: 'destructive',
          onPress: async () => {
            await Clipboard.setStringAsync(mnemonic);
            // Android shows a native clipboard notification
          },
        },
      ]
    );
  }, [mnemonic]);

  // ========================================
  // Render Steps
  // ========================================

  const renderGenerateStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Create Your Wallet</Text>
      <Text style={styles.stepDescription}>
        We'll generate a unique 12-word recovery phrase for your wallet.
        This phrase is the only way to recover your wallet if you lose access.
      </Text>

      <View style={styles.warningBox}>
        <Text style={styles.warningIcon}>⚠️</Text>
        <Text style={styles.warningText}>
          Never share your recovery phrase with anyone. Anyone with this phrase
          can access your funds.
        </Text>
      </View>

      <Button
        mode="contained"
        onPress={handleGenerateMnemonic}
        style={styles.primaryButton}
        contentStyle={styles.buttonContent}
        labelStyle={styles.buttonLabel}
      >
        Generate Recovery Phrase
      </Button>

      <Button
        mode="text"
        onPress={() => router.replace('/wallet/import')}
        style={styles.secondaryButton}
        contentStyle={styles.buttonContent}
        labelStyle={styles.secondaryButtonLabel}
      >
        Import existing wallet instead
      </Button>
    </View>
  );

  const renderBackupStep = () => (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.stepTitle}>Backup Your Phrase</Text>
      <Text style={styles.stepDescription}>
        Write down these 12 words in order. Store them in a safe place.
      </Text>

      {/* Show/Hide Toggle */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => setShowMnemonic(!showMnemonic)}
        >
          <Text style={styles.toggleButtonText}>
            {showMnemonic ? '🙈 Hide' : '👁️ Show'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toggleButton}
          onPress={handleCopyMnemonic}
        >
          <Text style={styles.toggleButtonText}>📋 Copy</Text>
        </TouchableOpacity>
      </View>

      {/* Mnemonic Grid */}
      <View style={styles.mnemonicGrid}>
        {mnemonicWords.map((item) => (
          <View key={item.index} style={styles.wordContainer}>
            <Text style={styles.wordIndex}>{item.index}</Text>
            <Text style={styles.wordText}>
              {showMnemonic ? item.word : '••••••'}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.checkboxRow, backupConfirmed && styles.checkboxChecked]}
        onPress={() => setBackupConfirmed(!backupConfirmed)}
      >
        <View style={styles.checkbox}>
          {backupConfirmed && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.checkboxLabel}>
          I have written down my recovery phrase
        </Text>
      </TouchableOpacity>

      <Button
        mode="contained"
        onPress={handleConfirmBackup}
        disabled={!backupConfirmed}
        style={styles.primaryButton}
        contentStyle={styles.buttonContent}
        labelStyle={styles.buttonLabel}
      >
        Continue
      </Button>
    </ScrollView>
  );

  const renderVerifyStep = () => (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.stepTitle}>Verify Your Phrase</Text>
      <Text style={styles.stepDescription}>
        {pasteMode 
          ? 'Paste your 12-word recovery phrase below.'
          : 'Tap the words in the correct order to verify your backup.'}
      </Text>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Toggle between modes */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeButton, !pasteMode && styles.modeButtonActive]}
          onPress={() => setPasteMode(false)}
        >
          <Text style={[styles.modeButtonText, !pasteMode && styles.modeButtonTextActive]}>
            Tap Words
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, pasteMode && styles.modeButtonActive]}
          onPress={() => setPasteMode(true)}
        >
          <Text style={[styles.modeButtonText, pasteMode && styles.modeButtonTextActive]}>
            Paste Phrase
          </Text>
        </TouchableOpacity>
      </View>

      {pasteMode ? (
        /* Paste mode */
        <View style={styles.pasteContainer}>
          <StyledTextInput
            mode="outlined"
            value={pasteText}
            onChangeText={(text: string) => {
              setPasteText(text);
              setError(null);
            }}
            placeholder="Paste your 12 words here..."
            style={styles.pasteInput}
            multiline
            numberOfLines={4}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      ) : (
        /* Chip selection mode */
        <>
          {/* Selected words box */}
          <View style={styles.selectedWordsContainer}>
            <Text style={styles.selectedWordsLabel}>
              Selected ({selectedWords.length}/12)
            </Text>
            <View style={styles.selectedWordsBox}>
              {selectedWords.length === 0 ? (
                <Text style={styles.selectedWordsPlaceholder}>
                  Tap words below to select them in order
                </Text>
              ) : (
                <View style={styles.selectedWordsList}>
                  {selectedWords.map((word, index) => (
                    <TouchableOpacity
                      key={`selected-${index}`}
                      style={styles.selectedWordChip}
                      onPress={() => handleRemoveWord(index)}
                    >
                      <Text style={styles.selectedWordNumber}>{index + 1}</Text>
                      <Text style={styles.selectedWordText}>{word}</Text>
                      <Text style={styles.selectedWordRemove}>×</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Available words (shuffled) */}
          <View style={styles.availableWordsContainer}>
            <Text style={styles.availableWordsLabel}>Available words:</Text>
            <View style={styles.wordChipGrid}>
              {shuffledWords.map((word, index) => (
                <TouchableOpacity
                  key={`available-${index}-${word}`}
                  style={styles.wordChip}
                  onPress={() => handleSelectWord(word)}
                >
                  <Text style={styles.wordChipText}>{word}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Reset button */}
          {selectedWords.length > 0 && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleResetVerification}
            >
              <Text style={styles.resetButtonText}>↺ Reset Selection</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      <Button
        mode="contained"
        onPress={handleVerify}
        disabled={pasteMode ? pasteText.trim().split(/\s+/).length !== 12 : selectedWords.length !== 12}
        style={styles.primaryButton}
        contentStyle={styles.buttonContent}
        labelStyle={styles.buttonLabel}
      >
        Verify
      </Button>
    </ScrollView>
  );

  const renderPinStep = () => (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.stepTitle}>Set Your PIN</Text>
      <Text style={styles.stepDescription}>
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
        onPress={handleCreateWallet}
        disabled={!pinValid || isLoading}
        loading={isLoading}
        style={styles.primaryButton}
        contentStyle={styles.buttonContent}
        labelStyle={styles.buttonLabel}
      >
        Create Wallet
      </Button>
    </ScrollView>
  );

  const renderCompleteStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.successIcon}>
        <Text style={styles.successEmoji}>🎉</Text>
      </View>

      <Text style={styles.stepTitle}>Wallet Created!</Text>
      <Text style={styles.stepDescription}>
        Your wallet is ready to use. You can now send and receive Bitcoin
        via the Lightning Network.
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
      case 'generate':
        return renderGenerateStep();
      case 'backup':
        return renderBackupStep();
      case 'verify':
        return renderVerifyStep();
      case 'pin':
        return renderPinStep();
      case 'complete':
        return renderCompleteStep();
      default:
        return renderGenerateStep();
    }
  };

  return (
    <LinearGradient
      colors={gradientColors}
      style={styles.gradient}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <SafeAreaView style={styles.container}>
          {/* Header with navigation */}
          <View style={styles.header}>
            {currentStep === 'generate' ? (
              <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
                <Text style={styles.headerButtonText}>Cancel</Text>
              </TouchableOpacity>
            ) : currentStep !== 'complete' ? (
              <TouchableOpacity onPress={handleGoBack} style={styles.headerButton}>
                <Text style={styles.headerButtonText}>← Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.headerButton} />
            )}

            <View style={styles.headerSpacer} />
          </View>

          {/* Progress Bar */}
          {currentStep !== 'complete' && (
            <View style={styles.progressContainer}>
              <ProgressBar
                progress={progress}
                color={BRAND_COLOR}
                style={styles.progressBar}
              />
              <Text style={styles.progressText}>
                Step {['generate', 'backup', 'verify', 'pin'].indexOf(currentStep) + 1} of 4
              </Text>
            </View>
          )}

          {/* Content */}
          {renderCurrentStep()}

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerButton: {
    padding: 8,
    minWidth: 70,
  },
  headerButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
  headerSpacer: {
    flex: 1,
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  warningBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(247, 147, 26, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(247, 147, 26, 0.3)',
  },
  warningIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: BRAND_COLOR,
    lineHeight: 20,
  },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: BRAND_COLOR,
    marginTop: 24,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  secondaryButton: {
    marginTop: 12,
    borderRadius: 12,
  },
  secondaryButtonLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
  },
  toggleButton: {
    padding: 12,
    backgroundColor: 'rgba(247, 147, 26, 0.1)',
    borderRadius: 8,
  },
  toggleButtonText: {
    color: BRAND_COLOR,
    fontSize: 14,
    fontWeight: '600',
  },
  mnemonicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  wordContainer: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordIndex: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginRight: 8,
    minWidth: 20,
  },
  wordText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 16,
  },
  checkboxChecked: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  checkboxLabel: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
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
  verificationInputs: {
    gap: 16,
    marginBottom: 24,
  },
  verificationRow: {
    gap: 8,
  },
  verificationLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  verificationInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeButtonActive: {
    backgroundColor: BRAND_COLOR,
  },
  modeButtonText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: '#1a1a2e',
  },
  pasteContainer: {
    marginBottom: 24,
  },
  pasteInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 120,
  },
  selectedWordsContainer: {
    marginBottom: 24,
  },
  selectedWordsLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  selectedWordsBox: {
    backgroundColor: 'rgba(247, 147, 26, 0.1)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(247, 147, 26, 0.3)',
    borderStyle: 'dashed',
    padding: 12,
    minHeight: 120,
  },
  selectedWordsPlaceholder: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 32,
  },
  selectedWordsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedWordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND_COLOR,
    borderRadius: 20,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 10,
    gap: 4,
  },
  selectedWordNumber: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    color: '#1a1a2e',
    fontSize: 10,
    fontWeight: 'bold',
    width: 18,
    height: 18,
    borderRadius: 9,
    textAlign: 'center',
    lineHeight: 18,
  },
  selectedWordText: {
    color: '#1a1a2e',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedWordRemove: {
    color: 'rgba(0, 0, 0, 0.5)',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  availableWordsContainer: {
    marginBottom: 16,
  },
  availableWordsLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  wordChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  wordChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  wordChipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  resetButton: {
    alignSelf: 'center',
    padding: 12,
    marginBottom: 8,
  },
  resetButtonText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 24,
  },
  nameInput: {
    marginBottom: 24,
  },
  modalButton: {
    borderRadius: 12,
  },
});
