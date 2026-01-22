// LNURL utilities for Lightning Network operations
// Handles LNURL parsing, validation, and Lightning address conversion

// =============================================================================
// Types
// =============================================================================

export interface LnurlPayData {
  callback: string;
  maxSendable: number; // in millisatoshis
  minSendable: number; // in millisatoshis
  metadata: string;
  tag: string;
  commentAllowed?: number;
}

export interface LnurlPayResponse {
  pr: string; // bolt11 invoice
  successAction?: {
    tag: string;
    message?: string;
    url?: string;
  };
}

export interface TipRequestData {
  lnurl: string;
  suggestedAmounts: [number, number, number];
  isValid: boolean;
  error?: string;
}

export interface ParsedLnurl {
  type: 'pay' | 'withdraw' | 'auth' | 'unknown';
  data?: LnurlPayData;
  error?: string;
}

// =============================================================================
// Lightning Address Utilities
// =============================================================================

/**
 * Converts Lightning address to LNURL endpoint URL, or returns input unchanged if already LNURL.
 * Lightning address format: user@domain → https://domain/.well-known/lnurlp/user
 *
 * @param input - Lightning address (user@domain) or LNURL string
 * @returns LNURL endpoint URL or original input
 */
export function convertToLnurlEndpoint(input: string): string {
  const trimmed = input.trim();

  // Lightning address format: user@domain (but not if it starts with lnurl)
  if (trimmed.includes('@') && !trimmed.toLowerCase().startsWith('lnurl')) {
    const parts = trimmed.split('@');
    if (parts.length === 2) {
      const [username, domain] = parts;
      if (username && domain && domain.includes('.')) {
        return `https://${domain}/.well-known/lnurlp/${username}`;
      }
    }
  }

  return trimmed;
}

/**
 * Validates if input is a valid Lightning address format.
 *
 * @param input - String to validate
 * @returns true if valid Lightning address format (user@domain.tld)
 */
export function isLightningAddress(input: string): boolean {
  const trimmed = input.trim();

  // Must contain @ but not start with lnurl
  if (!trimmed.includes('@') || trimmed.toLowerCase().startsWith('lnurl')) {
    return false;
  }

  const parts = trimmed.split('@');
  if (parts.length !== 2) {
    return false;
  }

  const [username, domain] = parts;

  // Username must be non-empty and alphanumeric (with dots, dashes, underscores)
  if (!username || !/^[a-zA-Z0-9._-]+$/.test(username)) {
    return false;
  }

  // Domain must contain at least one dot and be valid
  if (!domain || !domain.includes('.') || !/^[a-zA-Z0-9.-]+$/.test(domain)) {
    return false;
  }

  return true;
}

/**
 * Validates if a Lightning Address resolves correctly by fetching its LNURL pay endpoint.
 * This checks if the address actually exists and can receive payments.
 *
 * @param address - Lightning address (user@domain.tld)
 * @returns Object with isValid flag and optional error message
 */
export async function validateLightningAddressResolves(
  address: string
): Promise<{ isValid: boolean; error?: string }> {
  if (!isLightningAddress(address)) {
    return { isValid: false, error: 'Invalid Lightning Address format' };
  }

  const [username, domain] = address.trim().split('@');
  const lnurlEndpoint = `https://${domain}/.well-known/lnurlp/${username}`;

  try {
    const controller = new AbortController();
    const timeoutId = global.setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(lnurlEndpoint, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    global.clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return { isValid: false, error: 'Lightning Address not found' };
      }
      return { isValid: false, error: `Server error: ${response.status}` };
    }

    const data = await response.json();

    // Verify it's a pay request
    if (data.tag !== 'payRequest') {
      return { isValid: false, error: 'Address does not support payments' };
    }

    // Verify required fields exist
    if (!data.callback || !data.minSendable || !data.maxSendable) {
      return { isValid: false, error: 'Invalid LNURL pay response' };
    }

    return { isValid: true };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return { isValid: false, error: 'Request timed out - check the domain' };
      }
      if (error.message.includes('Network request failed')) {
        return { isValid: false, error: 'Domain not found - check the address' };
      }
    }
    return { isValid: false, error: 'Failed to verify address' };
  }
}

/**
 * Parse Lightning address into components
 *
 * @param address - Lightning address (user@domain)
 * @returns Object with username and domain, or null if invalid
 */
export function parseLightningAddress(
  address: string
): { username: string; domain: string } | null {
  if (!isLightningAddress(address)) {
    return null;
  }

  const [username, domain] = address.trim().split('@');
  return { username, domain };
}

// =============================================================================
// LNURL Validation
// =============================================================================

/**
 * Validate LNURL format (bech32 encoded string starting with 'lnurl')
 *
 * @param lnurl - LNURL string to validate
 * @returns true if valid LNURL format
 */
export function isValidLnurlFormat(lnurl: string): boolean {
  try {
    const trimmed = lnurl.trim().toLowerCase();

    // LNURL should start with 'lnurl'
    if (!trimmed.startsWith('lnurl')) {
      return false;
    }

    // Basic length check (LNURL should be reasonably long)
    if (trimmed.length < 20) {
      return false;
    }

    // Check for valid bech32 characters (alphanumeric, excluding 1, b, i, o)
    // After 'lnurl1' prefix, the rest should be valid bech32
    const afterPrefix = trimmed.substring(6); // After 'lnurl1'
    if (!/^[023456789acdefghjklmnpqrstuvwxyz]+$/.test(afterPrefix)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Check if input is a valid LNURL or Lightning address
 *
 * @param input - String to validate
 * @returns true if valid LNURL or Lightning address
 */
export function isValidLnurlOrAddress(input: string): boolean {
  return isValidLnurlFormat(input) || isLightningAddress(input);
}

// =============================================================================
// LNURL Extraction
// =============================================================================

/**
 * Extract LNURL or Lightning address from various formats
 * Handles: lightning: URIs, direct LNURL, Lightning addresses, etc.
 *
 * @param input - Input string (QR code content, URI, etc.)
 * @returns Extracted LNURL/address or null if not found
 */
export function extractLnurl(input: string): string | null {
  try {
    let cleaned = input.trim();

    // Handle lightning: URI scheme
    if (cleaned.toLowerCase().startsWith('lightning:')) {
      cleaned = cleaned.substring(10);
    }

    // Handle LNURL: URI scheme
    if (cleaned.toLowerCase().startsWith('lnurl:')) {
      cleaned = cleaned.substring(6);
    }

    // Handle Lightning address (user@domain)
    if (isLightningAddress(cleaned)) {
      return cleaned;
    }

    // Handle direct LNURL (case insensitive)
    if (cleaned.toLowerCase().startsWith('lnurl')) {
      return cleaned.toLowerCase();
    }

    return null;
  } catch {
    return null;
  }
}

// =============================================================================
// Tip Request Parsing and Generation
// =============================================================================

/**
 * Parse tip request string and extract LNURL and amounts
 * Format: [lntip:lnurl:<lnurl>:<amount1>:<amount2>:<amount3>]
 *
 * @param tipString - Tip request string
 * @returns Parsed tip request data
 */
export function parseTipRequest(tipString: string): TipRequestData {
  try {
    // Match the standardized tip format
    const tipRegex = /\[lntip:lnurl:([^:]+):(\d+):(\d+):(\d+)\]/;
    const match = tipString.match(tipRegex);

    if (!match) {
      return {
        lnurl: '',
        suggestedAmounts: [0, 0, 0],
        isValid: false,
        error: 'Invalid tip request format',
      };
    }

    const [, lnurl, amount1, amount2, amount3] = match;
    const suggestedAmounts: [number, number, number] = [
      parseInt(amount1, 10),
      parseInt(amount2, 10),
      parseInt(amount3, 10),
    ];

    // Validate LNURL format
    if (!isValidLnurlFormat(lnurl) && !isLightningAddress(lnurl)) {
      return {
        lnurl,
        suggestedAmounts,
        isValid: false,
        error: 'Invalid LNURL or Lightning address format',
      };
    }

    // Validate amounts
    if (suggestedAmounts.some((amount) => amount <= 0 || !Number.isInteger(amount))) {
      return {
        lnurl,
        suggestedAmounts,
        isValid: false,
        error: 'Invalid suggested amounts',
      };
    }

    return {
      lnurl,
      suggestedAmounts,
      isValid: true,
    };
  } catch {
    return {
      lnurl: '',
      suggestedAmounts: [0, 0, 0],
      isValid: false,
      error: 'Failed to parse tip request',
    };
  }
}

/**
 * Generate standardized tip request string
 * Format: [lntip:lnurl:<lnurl>:<amount1>:<amount2>:<amount3>]
 *
 * @param lnurl - LNURL or Lightning address
 * @param amounts - Three suggested amounts in satoshis
 * @returns Formatted tip request string
 */
export function generateTipRequest(
  lnurl: string,
  amounts: [number, number, number]
): string {
  // Validate inputs
  if (!isValidLnurlFormat(lnurl) && !isLightningAddress(lnurl)) {
    throw new Error('Invalid LNURL or Lightning address format');
  }

  if (amounts.some((amount) => amount <= 0 || !Number.isInteger(amount))) {
    throw new Error('Invalid amounts - must be positive integers');
  }

  // Validate max amount (100M sats = 1 BTC)
  const MAX_AMOUNT = 100_000_000;
  if (amounts.some((amount) => amount > MAX_AMOUNT)) {
    throw new Error(`Amounts must not exceed ${MAX_AMOUNT} sats`);
  }

  // Generate standardized format
  return `[lntip:lnurl:${lnurl}:${amounts[0]}:${amounts[1]}:${amounts[2]}]`;
}

/**
 * Validate tip amounts
 *
 * @param amounts - Three amounts to validate
 * @returns Object with isValid flag and optional error message
 */
export function validateTipAmounts(
  amounts: [number, number, number]
): { isValid: boolean; error?: string } {
  const MAX_AMOUNT = 100_000_000; // 1 BTC in sats
  const MIN_AMOUNT = 1;

  // Check if all are positive integers
  if (amounts.some((a) => !Number.isInteger(a) || a < MIN_AMOUNT)) {
    return {
      isValid: false,
      error: 'All amounts must be positive integers',
    };
  }

  // Check max amount
  if (amounts.some((a) => a > MAX_AMOUNT)) {
    return {
      isValid: false,
      error: `Amounts must not exceed ${MAX_AMOUNT.toLocaleString()} sats (1 BTC)`,
    };
  }

  // Check for unique amounts
  const uniqueAmounts = new Set(amounts);
  if (uniqueAmounts.size !== 3) {
    return {
      isValid: false,
      error: 'All three amounts must be unique',
    };
  }

  return { isValid: true };
}

// =============================================================================
// Default Values
// =============================================================================

export const DEFAULT_TIP_AMOUNTS: [number, number, number] = [100, 500, 1000];
