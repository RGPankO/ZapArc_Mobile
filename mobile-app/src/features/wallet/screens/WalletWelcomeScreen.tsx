// Wallet Welcome/Onboarding Screen
// First launch screen for setting up the Lightning wallet

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Alert, TextInput as RNTextInput } from 'react-native';
import { Button, Text, Portal, Dialog } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallet } from '../../../hooks/useWallet';

// Lightning bolt icon placeholder - in production, use actual asset
const LIGHTNING_ICON = '⚡';

export function WalletWelcomeScreen(): React.JSX.Element {
  const { activeMasterKey, addSubWallet, canAddSubWallet } = useWallet();
  
  // State for Add Sub-Wallet modal
  const [showAddSubWalletModal, setShowAddSubWalletModal] = useState(false);
  const [subWalletName, setSubWalletName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleCreateWallet = (): void => {
    router.push('/wallet/create');
  };

  const handleImportWallet = (): void => {
    router.push('/wallet/import');
  };

  const handleAddSubWallet = useCallback(() => {
    if (!activeMasterKey) return;
    
    // Calculate next sub-wallet index
    const nextIndex = activeMasterKey.subWallets.length;
    setSubWalletName(`Sub-Wallet ${nextIndex + 1}`);
    setShowAddSubWalletModal(true);
  }, [activeMasterKey]);

  const handleConfirmAddSubWallet = useCallback(async () => {
    if (!activeMasterKey || !subWalletName.trim()) return;

    try {
      setIsAdding(true);
      const nickname = subWalletName.trim() || undefined;
      await addSubWallet(activeMasterKey.id, nickname);
      setShowAddSubWalletModal(false);
      Alert.alert('Success', 'Sub-wallet created successfully');
      router.replace('/wallet/home');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add sub-wallet';
      Alert.alert('Error', message);
    } finally {
      setIsAdding(false);
    }
  }, [activeMasterKey, subWalletName, addSubWallet]);

  const canAdd = activeMasterKey && canAddSubWallet(activeMasterKey.id);

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.iconContainer}>
              <Text style={styles.lightningIcon}>{LIGHTNING_ICON}</Text>
            </View>
            
            <Text style={styles.title}>
              {activeMasterKey ? 'Set Up Your Wallet' : 'Zap Arc'}
            </Text>
            <Text style={styles.subtitle}>
              {activeMasterKey 
                ? 'Choose how you want to set up your wallet'
                : 'Your Lightning Network Wallet'}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <Button
              mode="contained"
              onPress={handleCreateWallet}
              style={styles.createButton}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
            >
              Create New Wallet
            </Button>

            <Button
              mode="outlined"
              onPress={handleImportWallet}
              style={styles.importButton}
              contentStyle={styles.buttonContent}
              labelStyle={styles.importButtonLabel}
            >
              Import Existing Wallet
            </Button>

            {/* Add Sub-Wallet Button - only show if logged in */}
            {activeMasterKey && (
              <Button
                mode="outlined"
                onPress={handleAddSubWallet}
                disabled={!canAdd}
                style={[
                  styles.addSubWalletButton,
                  !canAdd && styles.addSubWalletButtonDisabled,
                ]}
                contentStyle={styles.buttonContent}
                labelStyle={[
                  styles.addSubWalletButtonLabel,
                  !canAdd && styles.addSubWalletButtonLabelDisabled,
                ]}
              >
                Add Sub-Wallet
              </Button>
            )}
            
            {activeMasterKey && (
              <Text style={styles.currentWalletHint}>
                Current wallet: {activeMasterKey.nickname}
              </Text>
            )}
          </View>

          {/* Back Button */}
          {activeMasterKey && (
            <Button
              mode="text"
              onPress={() => router.back()}
              style={styles.backButton}
              labelStyle={styles.backButtonLabel}
            >
              Back
            </Button>
          )}

          {/* Footer - only show if not logged in */}
          {!activeMasterKey && (
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                By continuing, you agree to our Terms of Service
              </Text>
            </View>
          )}
        </View>

        {/* Add Sub-Wallet Modal */}
        <Portal>
          <Dialog
            visible={showAddSubWalletModal}
            onDismiss={() => setShowAddSubWalletModal(false)}
            style={styles.dialog}
          >
            <Dialog.Title style={styles.dialogTitle}>
              Name Your Sub-Wallet
            </Dialog.Title>
            <Dialog.Content>
              <Text style={styles.dialogText}>
                Create a new sub-wallet under "{activeMasterKey?.nickname}"
              </Text>
              
              <RNTextInput
                style={styles.nameInput}
                value={subWalletName}
                onChangeText={setSubWalletName}
                placeholder="Sub-Wallet name"
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                autoFocus
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                onPress={() => setShowAddSubWalletModal(false)}
                labelStyle={styles.cancelButtonLabel}
              >
                Cancel
              </Button>
              <Button
                onPress={handleConfirmAddSubWallet}
                disabled={!subWalletName.trim() || isAdding}
                loading={isAdding}
                labelStyle={styles.primaryButtonLabel}
              >
                Create
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingVertical: 32,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 40,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#FFC107',
  },
  lightningIcon: {
    fontSize: 48,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  featuresContainer: {
    marginVertical: 40,
    gap: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
  },
  featureIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  buttonContainer: {
    gap: 16,
  },
  createButton: {
    borderRadius: 12,
    backgroundColor: '#FFC107',
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  importButton: {
    borderRadius: 12,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1,
  },
  importButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
  },
  addSubWalletButton: {
    borderRadius: 12,
    borderColor: '#FFC107',
    borderWidth: 1,
  },
  addSubWalletButtonDisabled: {
    borderColor: 'rgba(255, 255, 255, 0.2)',
    opacity: 0.5,
  },
  addSubWalletButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFC107',
  },
  addSubWalletButtonLabelDisabled: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
  currentWalletHint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    marginTop: 8,
  },
  backButton: {
    marginTop: 16,
  },
  backButtonLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  dialog: {
    backgroundColor: '#1a1a2e',
  },
  dialogTitle: {
    color: '#FFFFFF',
  },
  dialogText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginBottom: 16,
  },
  nameInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
  },
  cancelButtonLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  primaryButtonLabel: {
    color: '#FFC107',
  },
});
