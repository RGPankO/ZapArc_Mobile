import { useQuery, useMutation } from '@tanstack/react-query';
import { useCallback } from 'react';
import { apiClient } from '../../../lib/apiClient';
import { AdConfig, AdAnalyticsData, AdType, AdAction } from '../types';

// Shorter timeout for ad requests (2 seconds)
const AD_TIMEOUT = 2000;

// Sample ad configs for when backend is unavailable
const SAMPLE_ADS: Record<AdType, AdConfig> = {
  [AdType.BANNER]: {
    id: 'sample-banner-001',
    adType: AdType.BANNER,
    adNetworkId: 'sample-network-banner',
    displayFrequency: 1,
  },
  [AdType.INTERSTITIAL]: {
    id: 'sample-interstitial-001',
    adType: AdType.INTERSTITIAL,
    adNetworkId: 'sample-network-interstitial',
    displayFrequency: 1,
  },
};

/**
 * Hook to fetch an ad for serving
 */
export function useAd(adType: AdType, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['ads', 'serve', adType],
    queryFn: async () => {
      try {
        // apiClient response interceptor already extracts .data, so we cast the result
        const adConfig = (await apiClient.get(`/ads/serve/${adType}`, {
          timeout: AD_TIMEOUT,
        })) as AdConfig | null;
        return adConfig || SAMPLE_ADS[adType];
      } catch {
        // Return sample ad when backend is unavailable
        return SAMPLE_ADS[adType];
      }
    },
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook to track ad analytics
 */
export function useTrackAdAnalytics() {
  return useMutation({
    mutationFn: (data: AdAnalyticsData) =>
      apiClient.post('/ads/track', data, { timeout: AD_TIMEOUT }),
    // Don't throw on error - analytics tracking shouldn't break the app
    onError: (error) => {
      console.error('Failed to track ad analytics:', error);
    },
  });
}

/**
 * Hook to check if user should see ads based on premium status
 */
export function useShouldShowAds() {
  return useQuery({
    queryKey: ['ads', 'shouldShow'],
    queryFn: async () => {
      try {
        const result = await apiClient.get<{ user: { premiumStatus: string; premiumExpiry?: string } }>(
          '/users/profile',
          { timeout: AD_TIMEOUT }
        );
        const user = (result as unknown as { user: { premiumStatus: string; premiumExpiry?: string } }).user;

        if (user.premiumStatus === 'PREMIUM_LIFETIME') {
          return false;
        }

        if (user.premiumStatus === 'PREMIUM_SUBSCRIPTION') {
          if (user.premiumExpiry && new Date(user.premiumExpiry) > new Date()) {
            return false;
          }
        }

        return true;
      } catch {
        // Default to showing ads if there's an error
        return true;
      }
    },
  });
}

export interface AdDisplayState {
  isLoading: boolean;
  adConfig: AdConfig | null;
  error: string | null;
  shouldShow: boolean;
}

/**
 * Hook to manage ad display state with tracking
 * Replaces the adManager service
 */
export function useAdManager(adType: AdType) {
  const { data: shouldShowAds, isLoading: checkingPremium } = useShouldShowAds();
  const { data: adConfig, isLoading: loadingAd, error: adError } = useAd(adType, {
    enabled: !!shouldShowAds,
  });
  const { mutate: trackMutate } = useTrackAdAnalytics();

  const state: AdDisplayState = {
    isLoading: checkingPremium || (!!shouldShowAds && loadingAd),
    adConfig: adConfig || null,
    error: adError?.message || null,
    shouldShow: !!shouldShowAds && !!adConfig,
  };

  const trackImpression = useCallback(() => {
    if (adConfig) {
      trackMutate({
        adType: adConfig.adType,
        action: AdAction.IMPRESSION,
        adNetworkId: adConfig.adNetworkId,
      });
    }
  }, [adConfig, trackMutate]);

  const trackClick = useCallback(() => {
    if (adConfig) {
      trackMutate({
        adType: adConfig.adType,
        action: AdAction.CLICK,
        adNetworkId: adConfig.adNetworkId,
      });
    }
  }, [adConfig, trackMutate]);

  const trackClose = useCallback(() => {
    if (adConfig) {
      trackMutate({
        adType: adConfig.adType,
        action: AdAction.CLOSE,
        adNetworkId: adConfig.adNetworkId,
      });
    }
  }, [adConfig, trackMutate]);

  const trackError = useCallback(
    (errorMessage: string) => {
      console.error('Ad error:', errorMessage);
      if (adConfig) {
        trackMutate({
          adType: adConfig.adType,
          action: AdAction.ERROR,
          adNetworkId: adConfig.adNetworkId,
        });
      }
    },
    [adConfig, trackMutate]
  );

  return {
    ...state,
    trackImpression,
    trackClick,
    trackClose,
    trackError,
  };
}
