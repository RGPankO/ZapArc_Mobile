import { NetworkConfig } from './network';

const parsePins = (raw: string | undefined): string[] => {
  if (!raw) return [];
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
};

const getApiHostname = (): string | null => {
  try {
    const url = new URL(NetworkConfig.getApiBaseUrl());
    return url.hostname || null;
  } catch {
    return null;
  }
};

const apiHost = getApiHostname();

export const SecurityConfig = {
  pinningEnabled:
    process.env.EXPO_PUBLIC_API_PINNING_ENABLED === 'true' && !!apiHost,
  pinnedDomains: apiHost
    ? {
        [apiHost]: {
          includeSubdomains: true,
          publicKeyHashes: parsePins(process.env.EXPO_PUBLIC_API_PINNED_KEYS),
        },
      }
    : {},
};

export const hasPinningMaterial = (): boolean => {
  if (!SecurityConfig.pinningEnabled) return false;
  const domains = Object.values(SecurityConfig.pinnedDomains);
  return domains.some((domain) => domain.publicKeyHashes.length > 0);
};
