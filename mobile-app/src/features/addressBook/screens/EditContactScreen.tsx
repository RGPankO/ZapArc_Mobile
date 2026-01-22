/**
 * EditContactScreen
 * Form for editing or deleting an existing contact
 */

import React, { useState, useCallback, useEffect } from 'react';
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
  Dialog,
  Portal,
  ActivityIndicator,
} from 'react-native-paper';
import { StyledTextInput } from '../../../components';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../../../contexts/ThemeContext';
import {
  getGradientColors,
  getPrimaryTextColor,
  getSecondaryTextColor,
} from '../../../utils/theme-helpers';
import { Contact, VALIDATION_LIMITS } from '../types';
import { useContacts } from '../hooks/useContacts';
import { getContactById } from '../services/contactService';
import {
  validateName,
  validateLightningAddress,
  validateNotes,
} from '../services/contactValidator';
import { ContactValidationError } from '../services/contactService';

export function EditContactScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { themeMode } = useAppTheme();
  const { updateContact, deleteContact } = useContacts();

  const gradientColors = getGradientColors(themeMode);
  const primaryTextColor = getPrimaryTextColor(themeMode);
  const secondaryTextColor = getSecondaryTextColor(themeMode);

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [lightningAddress, setLightningAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const [nameError, setNameError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);

  useEffect(() => {
    async function loadContact() {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const loadedContact = await getContactById(id);
        if (loadedContact) {
          setContact(loadedContact);
          setName(loadedContact.name);
          setLightningAddress(loadedContact.lightningAddress);
          setNotes(loadedContact.notes || '');
        }
      } catch (err) {
        console.error('❌ EditContact: Failed to load contact', err);
        setSnackbarMessage('Failed to load contact');
        setSnackbarVisible(true);
      } finally {
        setLoading(false);
      }
    }

    loadContact();
  }, [id]);

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
    if (!contact || !validateForm()) return;

    setSaving(true);
    try {
      await updateContact({
        id: contact.id,
        name: name.trim(),
        lightningAddress: lightningAddress.trim(),
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch (err) {
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
  }, [contact, validateForm, updateContact, name, lightningAddress, notes]);

  const handleDelete = useCallback(async () => {
    if (!contact) return;

    setDeleting(true);
    setDeleteDialogVisible(false);
    try {
      await deleteContact(contact.id);
      router.back();
    } catch (err) {
      setSnackbarMessage('Failed to delete contact. Please try again.');
      setSnackbarVisible(true);
    } finally {
      setDeleting(false);
    }
  }, [contact, deleteContact]);

  if (loading) {
    return (
      <LinearGradient colors={gradientColors} style={styles.gradient}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <IconButton
              icon="arrow-left"
              iconColor={primaryTextColor}
              size={24}
              onPress={() => router.back()}
            />
            <Text style={[styles.headerTitle, { color: primaryTextColor }]}>
              Edit Contact
            </Text>
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFC107" />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!contact) {
    return (
      <LinearGradient colors={gradientColors} style={styles.gradient}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <IconButton
              icon="arrow-left"
              iconColor={primaryTextColor}
              size={24}
              onPress={() => router.back()}
            />
            <Text style={[styles.headerTitle, { color: primaryTextColor }]}>
              Edit Contact
            </Text>
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: primaryTextColor }]}>
              Contact not found
            </Text>
            <Button
              mode="outlined"
              onPress={() => router.back()}
              textColor={primaryTextColor}
              style={styles.backButton}
            >
              Go Back
            </Button>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

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
              icon="arrow-left"
              iconColor={primaryTextColor}
              size={24}
              onPress={() => router.back()}
            />
            <Text style={[styles.headerTitle, { color: primaryTextColor }]}>
              Edit Contact
            </Text>
            <Button
              mode="text"
              onPress={handleSave}
              loading={saving}
              disabled={saving || deleting}
              textColor="#FFC107"
            >
              Save
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

            {/* Delete Button */}
            <View style={styles.deleteContainer}>
              <Button
                mode="outlined"
                onPress={() => setDeleteDialogVisible(true)}
                loading={deleting}
                disabled={saving || deleting}
                textColor="#FF5252"
                style={styles.deleteButton}
                icon="delete"
              >
                Delete Contact
              </Button>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Delete Confirmation Dialog */}
        <Portal>
          <Dialog
            visible={deleteDialogVisible}
            onDismiss={() => setDeleteDialogVisible(false)}
            style={styles.dialog}
          >
            <Dialog.Title style={styles.dialogTitle}>Delete Contact</Dialog.Title>
            <Dialog.Content>
              <Text style={styles.dialogContent}>
                Are you sure you want to delete "{contact.name}"? This action
                cannot be undone.
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                onPress={() => setDeleteDialogVisible(false)}
                textColor={secondaryTextColor}
              >
                Cancel
              </Button>
              <Button onPress={handleDelete} textColor="#FF5252">
                Delete
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

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
  headerSpacer: {
    width: 48,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    marginBottom: 16,
  },
  backButton: {
    borderColor: 'rgba(255, 255, 255, 0.3)',
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
  deleteContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  deleteButton: {
    borderColor: '#FF5252',
  },
  dialog: {
    backgroundColor: '#1a1a2e',
  },
  dialogTitle: {
    color: '#FFFFFF',
  },
  dialogContent: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
});
