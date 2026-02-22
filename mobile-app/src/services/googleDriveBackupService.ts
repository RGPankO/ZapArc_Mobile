// Google Drive Backup Service
// Handles Google OAuth and Drive API integration for encrypted seed phrase backups
// Uses native Google Sign-In for authentication

import {
  GoogleSignin,
  statusCodes,
  type User,
} from '@react-native-google-signin/google-signin';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  encryptMnemonic,
  decryptMnemonic,
  validateBackupStructure,
  isEncryptionAvailable,
  type EncryptedBackup,
} from './backupEncryption';

// =============================================================================
// Types
// =============================================================================

export interface GoogleUser {
  email: string;
  name?: string;
  picture?: string;
}

export interface BackupMetadata {
  id: string;
  name: string;
  timestamp: number;
  walletName?: string;
  size: number;
  seedFingerprint?: string;
}

interface DriveFile {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
  appProperties?: {
    seedFingerprint?: string;
  };
}

interface DriveListResponse {
  files: DriveFile[];
  nextPageToken?: string;
}

// =============================================================================
// Constants
// =============================================================================

// Google OAuth configuration - loaded from environment variables
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';

// Secure store keys (only for cached user info)
const STORAGE_KEYS = {
  USER_INFO: 'google_drive_user_info',
  BACKUP_FINGERPRINT_PREFIX: 'backup_fingerprint_',
};

// Google Drive API endpoints
const DRIVE_API = {
  FILES: 'https://www.googleapis.com/drive/v3/files',
  UPLOAD: 'https://www.googleapis.com/upload/drive/v3/files',
};

// Scopes needed for Drive file access
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
];

// Folder name visible in Google Drive
const BACKUP_FOLDER_NAME = '⚠️ DO NOT DELETE - ZapArc Backups';

// =============================================================================
// Service Implementation
// =============================================================================

class GoogleDriveBackupService {
  private isConfigured = false;

  // ===========================================================================
  // Initialization
  // ===========================================================================

  /**
   * Check if encryption is available on this device
   */
  isAvailable(): boolean {
    return isEncryptionAvailable();
  }

  /**
   * Initialize the service - configure Google Sign-In
   */
  async initialize(): Promise<void> {
    try {
      const hasRequiredClientId = Platform.OS === 'ios' ? !!GOOGLE_IOS_CLIENT_ID : !!GOOGLE_WEB_CLIENT_ID;
      if (!hasRequiredClientId) {
        console.warn(`⚠️ [GoogleDrive] No ${Platform.OS === 'ios' ? 'iOS' : 'Web'} Client ID configured`);
        return;
      }

      GoogleSignin.configure({
        // On iOS, use iosClientId only — webClientId causes "access blocked" error
        // because Google rejects custom URL scheme redirects for Web client types.
        // On Android, webClientId is needed for server auth code.
        ...(Platform.OS === 'ios'
          ? { iosClientId: GOOGLE_IOS_CLIENT_ID }
          : { webClientId: GOOGLE_WEB_CLIENT_ID }),
        scopes: SCOPES,
        offlineAccess: Platform.OS !== 'ios',
        profileImageSize: 0, // Don't request profile image
      });

      this.isConfigured = true;
      console.log('✅ [GoogleDrive] Service initialized with native Google Sign-In');
    } catch (error) {
      console.error('❌ [GoogleDrive] Initialization failed:', error);
    }
  }

  // ===========================================================================
  // Authentication
  // ===========================================================================

  /**
   * Check if user is connected to Google
   */
  async isConnected(): Promise<boolean> {
    try {
      const currentUser = await GoogleSignin.getCurrentUser();
      return currentUser !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get connected user info
   */
  async getUserInfo(): Promise<GoogleUser | null> {
    try {
      const currentUser = await GoogleSignin.getCurrentUser();
      if (currentUser?.user) {
        const user: GoogleUser = {
          email: currentUser.user.email,
          name: currentUser.user.name || undefined,
          picture: currentUser.user.photo || undefined,
        };
        // Cache user info
        await SecureStore.setItemAsync(STORAGE_KEYS.USER_INFO, JSON.stringify(user));
        return user;
      }

      // Try cached user info
      const cachedUserInfo = await SecureStore.getItemAsync(STORAGE_KEYS.USER_INFO);
      if (cachedUserInfo) {
        return JSON.parse(cachedUserInfo);
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Start Google OAuth sign-in flow using native SDK
   */
  async signIn(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔐 [GoogleDrive] Starting native Google Sign-In...');

      // Check if client ID is configured
      const hasClientId = Platform.OS === 'ios' ? !!GOOGLE_IOS_CLIENT_ID : !!GOOGLE_WEB_CLIENT_ID;
      if (!hasClientId || !this.isConfigured) {
        console.error('❌ [GoogleDrive] Google Client ID not configured');
        return {
          success: false,
          error: 'Google Drive backup is not configured. Please contact support.',
        };
      }

      // Check if Google Play Services are available (Android)
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Sign in
      const userInfo = await GoogleSignin.signIn();

      if (userInfo.data?.user) {
        // Request additional scopes for Drive access
        const hasScopes = await GoogleSignin.hasPlayServices();
        
        // Try to add scopes if needed (for Drive API access)
        try {
          await GoogleSignin.addScopes({ scopes: SCOPES });
        } catch (scopeError) {
          console.warn('⚠️ [GoogleDrive] Could not add scopes:', scopeError);
          // Continue anyway - the initial scopes might be enough
        }

        // Cache user info
        const user: GoogleUser = {
          email: userInfo.data.user.email,
          name: userInfo.data.user.name || undefined,
          picture: userInfo.data.user.photo || undefined,
        };
        await SecureStore.setItemAsync(STORAGE_KEYS.USER_INFO, JSON.stringify(user));

        console.log('✅ [GoogleDrive] Sign-in successful');
        return { success: true };
      }

      return { success: false, error: 'Sign-in failed' };
    } catch (error: any) {
      console.error('❌ [GoogleDrive] Sign-in failed:', error);

      // Handle specific error codes
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        return { success: false, error: 'Sign-in was cancelled' };
      } else if (error.code === statusCodes.IN_PROGRESS) {
        return { success: false, error: 'Sign-in is already in progress' };
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { success: false, error: 'Google Play Services not available' };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sign-in failed',
      };
    }
  }

  /**
   * Sign out and clear stored data
   */
  async signOut(): Promise<void> {
    try {
      console.log('🔐 [GoogleDrive] Signing out...');

      // Sign out from Google
      await GoogleSignin.signOut();

      // Clear cached user info
      await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_INFO);

      console.log('✅ [GoogleDrive] Signed out');
    } catch (error) {
      console.error('❌ [GoogleDrive] Sign-out failed:', error);
      throw error;
    }
  }

  /**
   * Get a valid access token for API calls
   * Native sign-in library handles token refresh automatically
   */
  private async getValidAccessToken(): Promise<string> {
    try {
      // Check if signed in
      const isSignedIn = await GoogleSignin.getCurrentUser();
      if (!isSignedIn) {
        throw new Error('Not authenticated. Please sign in again.');
      }

      // Get tokens - this will automatically refresh if needed
      const tokens = await GoogleSignin.getTokens();
      
      if (!tokens.accessToken) {
        throw new Error('Could not get access token. Please sign in again.');
      }

      return tokens.accessToken;
    } catch (error) {
      console.error('❌ [GoogleDrive] Failed to get access token:', error);
      throw new Error('Not authenticated. Please sign in again.');
    }
  }

  // ===========================================================================
  // Folder Management
  // ===========================================================================

  /**
   * Find or create the ZapArc backup folder in Google Drive
   * Returns the folder ID
   */
  private async getOrCreateBackupFolder(): Promise<string> {
    const accessToken = await this.getValidAccessToken();

    // Search for existing folder
    const query = `name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchResponse = await fetch(
      `${DRIVE_API.FILES}?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (searchResponse.ok) {
      const data = await searchResponse.json();
      if (data.files && data.files.length > 0) {
        console.log(`✅ [GoogleDrive] Found backup folder: ${data.files[0].id}`);
        return data.files[0].id;
      }
    }

    // Create the folder
    console.log('📁 [GoogleDrive] Creating backup folder...');
    const createResponse = await fetch(DRIVE_API.FILES, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: BACKUP_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      console.error('❌ [GoogleDrive] Failed to create folder:', error);
      throw new Error('Failed to create backup folder');
    }

    const folder = await createResponse.json();
    console.log(`✅ [GoogleDrive] Created backup folder: ${folder.id}`);
    return folder.id;
  }

  // ===========================================================================
  // Backup Operations
  // ===========================================================================

  /**
   * Create an encrypted backup and upload to Google Drive
   */
  async createBackup(
    mnemonic: string,
    password: string,
    walletId: string,
    walletName?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('📤 [GoogleDrive] Creating backup...');

      const seedFingerprint = await this.getSeedFingerprint(mnemonic);

      // Encrypt the mnemonic
      const encryptedBackup = await encryptMnemonic(mnemonic, password, walletName);
      encryptedBackup.seedFingerprint = seedFingerprint;

      // Get valid access token and backup folder
      const accessToken = await this.getValidAccessToken();
      const folderId = await this.getOrCreateBackupFolder();

      const existingBackups = await this.listBackups();
      const existingBackup = existingBackups.find(
        (backup) => backup.seedFingerprint === seedFingerprint
      );

      // Create file name — include wallet name for easy identification
      const safeName = (walletName || 'Wallet').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
      const fileName = `zaparc_backup_${safeName}_${Date.now()}.json`;

      // Prepare multipart upload
      // Note: 'parents' is only allowed on create (POST), not update (PATCH)
      const metadata: Record<string, unknown> = {
        name: fileName,
        mimeType: 'application/json',
        description: `ZapArc wallet backup: ${walletName || 'Unknown wallet'}`,
        appProperties: {
          seedFingerprint,
        },
      };
      if (!existingBackup) {
        metadata.parents = [folderId];
      }

      const boundary = 'backup_boundary_' + Date.now();
      const body =
        `--${boundary}\r\n` +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        '\r\n' +
        `--${boundary}\r\n` +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(encryptedBackup) +
        '\r\n' +
        `--${boundary}--`;

      const uploadUrl = existingBackup
        ? `${DRIVE_API.UPLOAD}/${existingBackup.id}?uploadType=multipart`
        : `${DRIVE_API.UPLOAD}?uploadType=multipart`;
      const method = existingBackup ? 'PATCH' : 'POST';

      // Upload to Google Drive
      const response = await fetch(uploadUrl, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: body,
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('❌ [GoogleDrive] Upload failed:', error);
        return { success: false, error: 'Failed to upload backup' };
      }

      await this.saveLocalFingerprint(walletId, seedFingerprint);

      console.log(existingBackup
        ? '✅ [GoogleDrive] Backup updated successfully'
        : '✅ [GoogleDrive] Backup created successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ [GoogleDrive] Create backup failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create backup',
      };
    }
  }

  /**
   * List all backups from Google Drive
   */
  async listBackups(): Promise<BackupMetadata[]> {
    try {
      console.log('📋 [GoogleDrive] Listing backups...');

      const accessToken = await this.getValidAccessToken();
      const folderId = await this.getOrCreateBackupFolder();

      const query = `'${folderId}' in parents and trashed=false`;
      console.log('🔍 [GoogleDrive] List query:', query);
      const params = new URLSearchParams({
        q: query,
        orderBy: 'createdTime desc',
        fields: 'files(id,name,createdTime,size,appProperties)',
        spaces: 'drive',
      });
      const response = await fetch(
        `${DRIVE_API.FILES}?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('❌ [GoogleDrive] List API error:', response.status, errorBody);
        throw new Error('Failed to list backups');
      }

      const data: DriveListResponse = await response.json();

      // Parse metadata from backup files
      const backups: BackupMetadata[] = data.files
        .filter((file) => file.name.startsWith('zaparc_backup_'))
        .map((file) => {
          const timestampMatch = file.name.match(/_(\d+)\.json$/);
          const timestamp = timestampMatch
            ? parseInt(timestampMatch[1], 10)
            : new Date(file.createdTime).getTime();

          // Parse wallet name from filename: zaparc_backup_WalletName_timestamp.json
          let walletName: string | undefined;
          const nameMatch = file.name.match(/^zaparc_backup_(.+?)_\d+\.json$/);
          if (nameMatch && nameMatch[1]) {
            // Convert underscores back to spaces for display
            walletName = nameMatch[1].replace(/_/g, ' ');
          }

          return {
            id: file.id,
            name: file.name,
            timestamp,
            walletName,
            size: parseInt(file.size || '0', 10),
            seedFingerprint: file.appProperties?.seedFingerprint,
          };
        });

      console.log(`✅ [GoogleDrive] Found ${backups.length} backups`);
      return backups;
    } catch (error) {
      console.error('❌ [GoogleDrive] List backups failed:', error);
      throw error;
    }
  }

  /**
   * Download and decrypt a backup
   */
  async restoreBackup(
    backupId: string,
    password: string
  ): Promise<{ success: boolean; mnemonic?: string; error?: string }> {
    try {
      console.log('📥 [GoogleDrive] Restoring backup...');

      const accessToken = await this.getValidAccessToken();

      // Download the file
      const response = await fetch(`${DRIVE_API.FILES}/${backupId}?alt=media`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download backup');
      }

      const backupData = await response.json();

      // Validate backup structure
      if (!validateBackupStructure(backupData)) {
        return { success: false, error: 'Invalid backup file format' };
      }

      // Decrypt the mnemonic
      let mnemonic: string;
      try {
        mnemonic = await decryptMnemonic(backupData, password);
      } catch (decryptError) {
        console.error('❌ [GoogleDrive] Decryption failed:', decryptError);
        return {
          success: false,
          error: 'Incorrect password. Please try again.',
        };
      }

      // Validate the decrypted mnemonic is actually valid BIP39
      const words = mnemonic.trim().split(/\s+/);
      if (![12, 15, 18, 21, 24].includes(words.length) || words.some(w => !/^[a-z]+$/.test(w))) {
        console.error('❌ [GoogleDrive] Decrypted data is not a valid mnemonic');
        return {
          success: false,
          error: 'Incorrect password. Please try again.',
        };
      }

      console.log('✅ [GoogleDrive] Backup restored successfully');
      return { success: true, mnemonic };
    } catch (error) {
      console.error('❌ [GoogleDrive] Restore backup failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to restore backup',
      };
    }
  }

  /**
   * Delete a backup from Google Drive
   */
  async deleteBackup(backupId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🗑️ [GoogleDrive] Deleting backup...');

      const accessToken = await this.getValidAccessToken();

      const response = await fetch(`${DRIVE_API.FILES}/${backupId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok && response.status !== 204) {
        throw new Error('Failed to delete backup');
      }

      console.log('✅ [GoogleDrive] Backup deleted');
      return { success: true };
    } catch (error) {
      console.error('❌ [GoogleDrive] Delete backup failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete backup',
      };
    }
  }

  /**
   * Get the last backup timestamp
   */
  async getLastBackupTimestamp(): Promise<number | null> {
    try {
      const backups = await this.listBackups();
      if (backups.length > 0) {
        return backups[0].timestamp;
      }
      return null;
    } catch {
      return null;
    }
  }

  async getSeedFingerprint(mnemonic: string): Promise<string> {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      mnemonic.trim().toLowerCase()
    );
    return hash.substring(0, 16);
  }

  async saveLocalFingerprint(walletId: string, fingerprint: string): Promise<void> {
    await SecureStore.setItemAsync(`${STORAGE_KEYS.BACKUP_FINGERPRINT_PREFIX}${walletId}`, fingerprint);
  }

  async getLocalFingerprint(walletId: string): Promise<string | null> {
    return await SecureStore.getItemAsync(`${STORAGE_KEYS.BACKUP_FINGERPRINT_PREFIX}${walletId}`);
  }

}


// =============================================================================
// Export Singleton
// =============================================================================

export const googleDriveBackupService = new GoogleDriveBackupService();
