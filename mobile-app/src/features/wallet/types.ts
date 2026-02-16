// Wallet feature type definitions
// Adapted from zap-arc browser extension for React Native

// =============================================================================
// Encrypted Data Types
// =============================================================================

/**
 * Encrypted data structure for storing sensitive information
 */
export interface EncryptedData {
  data: number[]; // Encrypted bytes
  iv: number[]; // IV (12 bytes for GCM)
  salt?: number[]; // Optional per-wallet salt (v3+); undefined for legacy payloads
  timestamp: number; // Encryption timestamp
  version?: number; // 1 = old XOR, 2 = AES-GCM static salt, 3 = AES-GCM per-wallet salt
}

// =============================================================================
// Sub-Wallet Types
// =============================================================================

/**
 * Sub-wallet entry within a master key
 * Mnemonic is derived by modifying the master key's 11th word
 */
export interface SubWalletEntry {
  index: number; // Sub-wallet index (0-19), determines 11th word offset
  nickname: string; // User-friendly name (e.g., "Sub-Wallet 1", "Savings")
  createdAt: number; // Timestamp of sub-wallet creation
  lastUsedAt: number; // Timestamp of last usage
  archivedAt?: number; // Timestamp when sub-wallet was archived (undefined = active)
  hasActivity?: boolean; // True if this sub-wallet has transactions or balance
  hasTransactionHistory?: boolean; // Tracks if wallet has any transactions (for creation logic)
}

// =============================================================================
// Master Key Types
// =============================================================================

/**
 * Metadata for a master key (for UI display without decryption)
 */
export interface MasterKeyMetadata {
  id: string;
  nickname: string;
  createdAt: number;
  lastUsedAt: number;
  subWalletCount: number;
  isExpanded: boolean;
  archivedAt?: number; // Timestamp when wallet was archived (only set for archived wallets)
}

/**
 * Master key entry with encrypted mnemonic and sub-wallets
 */
export interface MasterKeyEntry {
  id: string;
  nickname: string;
  encryptedMnemonic: EncryptedData;
  subWallets: SubWalletEntry[];
  archivedSubWallets: SubWalletEntry[]; // Separate array for archived sub-wallets
  createdAt: number;
  lastUsedAt: number;
  isExpanded: boolean;
  archivedAt?: number; // Timestamp when master key was archived (undefined = active)
  canCreateSubWallets: boolean; // True if last sub-wallet has transaction history
}

// =============================================================================
// Multi-Wallet Storage Types
// =============================================================================

/**
 * Multi-wallet storage structure
 */
export interface MultiWalletStorage {
  masterKeys: MasterKeyEntry[];
  activeMasterKeyId: string;
  activeSubWalletIndex: number;
  version: number;
}

/**
 * Combined metadata for active wallet identification
 */
export interface ActiveWalletInfo {
  masterKeyId: string;
  masterKeyNickname: string;
  subWalletIndex: number;
  subWalletNickname: string;
}

// =============================================================================
// Wallet Data Types
// =============================================================================

/**
 * Core wallet data (decrypted state)
 */
export interface WalletData {
  mnemonic: string;
  balance: number;
  lnurl?: string;
  lightningAddress?: string;
  transactions: Transaction[];
}

/**
 * Wallet metadata for UI display (no sensitive data)
 */
export interface WalletMetadata {
  id: string;
  nickname: string;
  createdAt: number;
  lastUsedAt: number;
  colorTag?: string;
}

// =============================================================================
// Transaction Types
// =============================================================================

/**
 * Lightning Network transaction
 */
export interface Transaction {
  id: string;
  type: 'send' | 'receive';
  amount: number;
  description?: string;
  timestamp: number;
  status: 'pending' | 'completed' | 'failed';
  paymentHash?: string;
  preimage?: string;
  feeSats?: number;
  destination?: string;
}

/**
 * Payment result from Breez SDK
 */
export interface PaymentResult {
  success: boolean;
  paymentHash?: string;
  preimage?: string;
  amountSats?: number;
  feeSats?: number;
  error?: string;
}

/**
 * Detailed payment information
 */
export interface PaymentDetails {
  paymentHash: string;
  preimage?: string;
  amount: number;
  feeSats: number;
  timestamp: number;
  status: 'pending' | 'completed' | 'failed';
  description?: string;
  destination?: string;
  bolt11?: string;
}

// =============================================================================
// Discovery Types (for sub-wallet scanning)
// =============================================================================

/**
 * Result of sub-wallet discovery scan
 */
export interface DiscoveryResult {
  index: number; // Sub-wallet index (0-19)
  balance: number; // Balance in sats
  isAlreadyAdded: boolean; // Whether this index is already in subWallets array
}

/**
 * Progress update during sub-wallet discovery
 */
export interface DiscoveryProgress {
  currentIndex: number; // Currently scanning index
  totalToScan: number; // Total indices to scan (20)
  results: DiscoveryResult[];
}

// =============================================================================
// Wallet Selection Types (for auth flow)
// =============================================================================

/**
 * Information about a selected wallet for authentication
 */
export interface WalletSelectionInfo {
  masterKeyId: string;
  masterKeyNickname: string;
  subWalletIndex: number;
  subWalletNickname: string;
}

/**
 * Hierarchical wallet structure for UI display
 */
export interface WalletHierarchy {
  masterKey: MasterKeyMetadata;
  subWallets: SubWalletEntry[];
  isExpanded: boolean;
}

// =============================================================================
// Constants
// =============================================================================

export const WALLET_CONSTANTS = {
  MAX_MASTER_KEYS: 10,
  MAX_SUB_WALLETS: 20,
  BIP39_WORDLIST_SIZE: 2048,
  STORAGE_VERSION: 1,
  DEFAULT_AUTO_LOCK_TIMEOUT: 900, // 15 minutes in seconds
} as const;
