/**
 * AddContactScreen
 * Form for adding a new contact to the address book
 */

import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  Button,
  IconButton,
  HelperText,
  Snackbar,
} from 'react-native-paper';
import { StyledTextInput } from '../../../components';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAppTheme } from '../../../contexts/ThemeContext';
import {
  getGradientColors,
  getPrimaryTextColor,
  getSecondaryTextColor,
} from '../../../utils/theme-helpers';
import { validateLightningAddressResolves } from '../../../utils';
import { VALIDATION_LIMITS } from '../types';
import { useContacts } from '../hooks/useContacts';
import {
  validateName,
  validateLightningAddress,
  validateNotes,
} from '../services/contactValidator';
import { ContactValidationError } from '../services/contactService';

export function AddContactScreen(): React.JSX.Element {
  const { themeMode } = useAppTheme();
  const { createContact } = useContacts();

  const gradientColors = getGradientColors(themeMode);
  const primaryTextColor = getPrimaryTextColor(themeMode);
  const secondaryTextColor = getSecondaryTextColor(themeMode);

  const [name, setName] = useState('');
  const [lightningAddress, setLightningAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const [nameError, setNameError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);

  const validateForm = useCallback((): boolean => {
    let isValid = true;

    const nameResult = validateName(name);
    if (!nameResult.isValid) {
      setNameError(nameResult.errors[0]?.message || 'Invalid name');
      isValid = false;
    } else {
      setNameError(null);
    }

    const addressResult = validateLightningAddress(lightningAddress);
    if (!addressResult.isValid) {
      setAddressError(addressResult.errors[0]?.message || 'Invalid address');
      isValid = false;
    } else {
      setAddressError(null);
    }

    if (notes.trim()) {
      const notesResult = validateNotes(notes);
      if (!notesResult.isValid) {
        setNotesError(notesResult.errors[0]?.message || 'Invalid notes');
        isValid = false;
      } else {
        setNotesError(null);
      }
    } else {
      setNotesError(null);
    }

    return isValid;
  }, [name, lightningAddress, notes]);

  const handleSave = useCallback(async () => {
    if (!validateForm()) return;

    setSaving(true);
    setVerifying(true);
    
    try {
      // Verify the Lightning Address resolves correctly
      const verifyResult = await validateLightningAddressResolves(lightningAddress.trim());
      setVerifying(false);
      
      if (!verifyResult.isValid) {
        setAddressError(verifyResult.error || 'Lightning Address could not be verified');
        setSaving(false);
        return;
      }

      await createContact({
        name: name.trim(),
        lightningAddress: lightningAddress.trim(),
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch (err) {
      setVerifying(false);
      if (err instanceof ContactValidationError) {
        const addressErrors = err.validation.errors.filter(
          (e) => e.field === 'lightningAddress'
        );
        if (addressErrors.length > 0) {
          setAddressError(addressErrors[0].message);
        } else {
          setSnackbarMessage(err.message);
          setSnackbarVisible(true);
        }
      } else {
        setSnackbarMessage('Failed to save contact. Please try again.');
        setSnackbarVisible(true);
      }
    } finally {
      setSaving(false);
    }
  }, [validateForm, createContact, name, lightningAddress, notes]);

  return (
    <LinearGradient colors={gradientColors} style={styles.gradient}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <IconButton
              icon="close"
              iconColor={primaryTextColor}
              size={24}
              onPress={() => router.back()}
            />
            <Text style={[styles.headerTitle, { color: primaryTextColor }]}>
              Add Contact
            </Text>
            <Button
              mode="text"
              onPress={handleSave}
              loading={saving}
              disabled={saving}
              textColor="#FFC107"
            >
              {verifying ? 'Verifying...' : 'Save'}
            </Button>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Name Input */}
            <View style={styles.inputContainer}>
              <StyledTextInput
                label="Name"
                value={name}
                onChangeText={setName}
                error={!!nameError}
                maxLength={VALIDATION_LIMITS.NAME_MAX_LENGTH}
              />
              <HelperText type="error" visible={!!nameError}>
                {nameError}
              </HelperText>
            </View>

            {/* Lightning Address Input */}
            <View style={styles.inputContainer}>
              <StyledTextInput
                label="Lightning Address"
                value={lightningAddress}
                onChangeText={setLightningAddress}
                error={!!addressError}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="user@domain.com"
              />
              <HelperText type="error" visible={!!addressError}>
                {addressError}
              </HelperText>
            </View>

            {/* Notes Input */}
            <View style={styles.inputContainer}>
              <StyledTextInput
                label="Notes (optional)"
                value={notes}
                onChangeText={setNotes}
                error={!!notesError}
                multiline
                numberOfLines={3}
                maxLength={VALIDATION_LIMITS.NOTES_MAX_LENGTH}
                style={styles.notesInput}
              />
              <HelperText type="error" visible={!!notesError}>
                {notesError}
              </HelperText>
              <Text style={[styles.charCount, { color: secondaryTextColor }]}>
                {notes.length}/{VALIDATION_LIMITS.NOTES_MAX_LENGTH}
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={3000}
          action={{
            label: 'OK',
            onPress: () => setSnackbarVisible(false),
          }}
        >
          {snackbarMessage}
        </Snackbar>
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
  keyboardView: {
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  inputContainer: {
    marginBottom: 8,
  },
  notesInput: {
    minHeight: 100,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    marginTop: -16,
    marginRight: 8,
  },
});
