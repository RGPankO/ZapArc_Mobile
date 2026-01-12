// Wallet Welcome/Onboarding Screen
// First launch screen for setting up the Lightning wallet

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Alert, TextInput as RNTextInput } from 'react-native';
import { Button, Text, Portal, Dialog } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallet } from '../../../hooks/useWallet';
import { useLanguage } from '../../../hooks/useLanguage';
import { useAppTheme } from '../../../contexts/ThemeContext';
import {
  getGradientColors,
  getPrimaryTextColor,
  getSecondaryTextColor,
  BRAND_COLOR,
} from '../../../utils/theme-helpers';

// Lightning bolt icon placeholder - in production, use actual asset
const LIGHTNING_ICON = '⚡';

export function WalletWelcomeScreen(): React.JSX.Element {
  const { activeMasterKey, addSubWallet, getAddSubWalletDisabledReason } = useWallet();
  const { t } = useLanguage();
  const { themeMode, theme } = useAppTheme();

  // Get theme colors
  const gradientColors = getGradientColors(themeMode);
  const primaryText = getPrimaryTextColor(themeMode);
  const secondaryText = getSecondaryTextColor(themeMode);
  const dialogBg = theme.colors.surface;

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
    // Main wallet is index 0. First sub-wallet should be index 1 and named "Sub-Wallet 1"
    const nextIndex = activeMasterKey.subWallets.length;
    setSubWalletName(`Sub-Wallet ${nextIndex}`);
    setShowAddSubWalletModal(true);
  }, [activeMasterKey]);

  const handleConfirmAddSubWallet = useCallback(async () => {
    if (!activeMasterKey || !subWalletName.trim()) return;

    try {
      setIsAdding(true);
      const nickname = subWalletName.trim() || undefined;
      await addSubWallet(activeMasterKey.id, nickname);
      setShowAddSubWalletModal(false);
      Alert.alert(t('common.success'), t('onboarding.subWalletCreated'));
      router.replace('/wallet/home');
    } catch (err) {
      const message = err instanceof Error ? err.message : t('onboarding.subWalletFailed');
      Alert.alert(t('common.error'), message);
    } finally {
      setIsAdding(false);
    }
  }, [activeMasterKey, subWalletName, addSubWallet]);

  const disabledReason = activeMasterKey ? getAddSubWalletDisabledReason(activeMasterKey.id) : null;
  const canAdd = activeMasterKey && !disabledReason;

  return (
    <LinearGradient
      colors={gradientColors}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={[styles.iconContainer, { borderColor: BRAND_COLOR }]}>
              <Text style={styles.lightningIcon}>{LIGHTNING_ICON}</Text>
            </View>
            
            <Text style={[styles.title, { color: primaryText }]}>
              {activeMasterKey ? t('onboarding.setupWallet') : 'Zap Arc'}
            </Text>
            <Text style={[styles.subtitle, { color: secondaryText }]}>
              {activeMasterKey
                ? t('onboarding.chooseSetup')
                : t('onboarding.subtitle')}
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
              {t('onboarding.createNew')}
            </Button>

            <Button
              mode="outlined"
              onPress={handleImportWallet}
              style={[styles.importButton, { borderColor: secondaryText }]}
              contentStyle={styles.buttonContent}
              labelStyle={[styles.importButtonLabel, { color: primaryText }]}
            >
              {t('onboarding.importExisting')}
            </Button>

            {/* Add Sub-Wallet Button - only show if logged in */}
            {activeMasterKey && (
              <Button
                mode="outlined"
                onPress={handleAddSubWallet}
                disabled={!canAdd}
                style={[
                  styles.addSubWalletButton,
                  { borderColor: canAdd ? BRAND_COLOR : secondaryText },
                  !canAdd && styles.addSubWalletButtonDisabled,
                ]}
                contentStyle={styles.buttonContent}
                labelStyle={[
                  styles.addSubWalletButtonLabel,
                  { color: canAdd ? BRAND_COLOR : secondaryText },
                  !canAdd && styles.addSubWalletButtonLabelDisabled,
                ]}
              >
                {t('onboarding.addSubWallet')}
              </Button>
            )}

            {activeMasterKey && (
              <View>
                {!canAdd && (
                  <Text style={[styles.currentWalletHint, { color: secondaryText, marginBottom: 8 }]}>
                    {disabledReason}
                  </Text>
                )}
                <Text style={[styles.currentWalletHint, { color: secondaryText }]}>
                  {t('onboarding.currentWallet', { name: activeMasterKey.nickname })}
                </Text>
              </View>
            )}
          </View>

          {/* Back Button */}
          {activeMasterKey && (
            <Button
              mode="text"
              onPress={() => router.back()}
              style={styles.backButton}
              labelStyle={[styles.backButtonLabel, { color: secondaryText }]}
            >
              {t('common.back')}
            </Button>
          )}

          {/* Footer - only show if not logged in */}
          {!activeMasterKey && (
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: secondaryText }]}>
                {t('onboarding.termsAgreement')}
              </Text>
            </View>
          )}
        </View>

        {/* Add Sub-Wallet Modal */}
        <Portal>
          <Dialog
            visible={showAddSubWalletModal}
            onDismiss={() => setShowAddSubWalletModal(false)}
            style={[styles.dialog, { backgroundColor: dialogBg }]}
          >
            <Dialog.Title style={[styles.dialogTitle, { color: primaryText }]}>
              {t('onboarding.nameSubWallet')}
            </Dialog.Title>
            <Dialog.Content>
              <Text style={[styles.dialogText, { color: secondaryText }]}>
                {t('onboarding.createSubWalletUnder', { name: activeMasterKey?.nickname || '' })}
              </Text>

              <RNTextInput
                style={[styles.nameInput, { color: primaryText }]}
                value={subWalletName}
                onChangeText={setSubWalletName}
                placeholder={t('onboarding.subWalletName')}
                placeholderTextColor={secondaryText}
                autoFocus
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                onPress={() => setShowAddSubWalletModal(false)}
                labelStyle={[styles.cancelButtonLabel, { color: secondaryText }]}
              >
                {t('common.cancel')}
              </Button>
              <Button
                onPress={handleConfirmAddSubWallet}
                disabled={!subWalletName.trim() || isAdding}
                loading={isAdding}
              >
                {t('onboarding.create')}
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
  },
  lightningIcon: {
    fontSize: 48,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
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
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
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
    borderWidth: 1,
  },
  importButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
  },
  addSubWalletButton: {
    borderRadius: 12,
    borderWidth: 1,
  },
  addSubWalletButtonDisabled: {
    opacity: 0.5,
  },
  addSubWalletButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  addSubWalletButtonLabelDisabled: {},
  currentWalletHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  backButton: {
    marginTop: 16,
  },
  backButtonLabel: {},
  dialog: {},
  dialogTitle: {},
  dialogText: {
    fontSize: 14,
    marginBottom: 16,
  },
  nameInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  cancelButtonLabel: {},
  primaryButtonLabel: {},
});
