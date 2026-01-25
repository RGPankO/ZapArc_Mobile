import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';
import { BannerAd } from '../features/ads';
import { apiClient } from '../lib/apiClient';
import { AdType } from '../types';

// Mock the apiClient
jest.mock('../lib/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Helper to render with a fresh QueryClient for each test
const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  
  return render(
    <QueryClientProvider client={queryClient}>
      <PaperProvider>{ui}</PaperProvider>
    </QueryClientProvider>
  );
};

describe('BannerAd', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state initially', async () => {
    // Make the API call hang to show loading state
    mockApiClient.get.mockImplementation(
      () => new Promise((resolve) => global.setTimeout(() => resolve({ user: { premiumStatus: 'FREE' } }), 1000))
    );

    const { getByText } = renderWithClient(<BannerAd />);

    expect(getByText('Loading ad...')).toBeTruthy();
  });

  it('should render ad when loaded successfully', async () => {
    const mockAdConfig = {
      id: '1',
      adType: AdType.BANNER,
      adNetworkId: 'test-network',
      displayFrequency: 1,
    };

    // First call: shouldShowAds (user profile)
    mockApiClient.get.mockResolvedValueOnce({
      user: { premiumStatus: 'FREE' },
    });
    // Second call: ad config
    mockApiClient.get.mockResolvedValueOnce(mockAdConfig);
    // Analytics tracking
    mockApiClient.post.mockResolvedValue({ success: true });

    const { getByText } = renderWithClient(<BannerAd />);

    await waitFor(() => {
      expect(getByText('Advertisement')).toBeTruthy();
      expect(getByText('Sample Banner Ad - Network: test-network')).toBeTruthy();
    });
  });

  it('should not render when user should not see ads (premium user)', async () => {
    mockApiClient.get.mockResolvedValueOnce({
      user: { premiumStatus: 'PREMIUM_LIFETIME' },
    });

    const { queryByText } = renderWithClient(<BannerAd />);

    await waitFor(() => {
      expect(queryByText('Advertisement')).toBeNull();
      expect(queryByText('Loading ad...')).toBeNull();
    });
  });

  it('should call onAdLoaded callback when ad loads successfully', async () => {
    const onAdLoaded = jest.fn();
    const mockAdConfig = {
      id: '1',
      adType: AdType.BANNER,
      adNetworkId: 'test-network',
      displayFrequency: 1,
    };

    mockApiClient.get.mockResolvedValueOnce({
      user: { premiumStatus: 'FREE' },
    });
    mockApiClient.get.mockResolvedValueOnce(mockAdConfig);
    mockApiClient.post.mockResolvedValue({ success: true });

    renderWithClient(<BannerAd onAdLoaded={onAdLoaded} />);

    await waitFor(() => {
      expect(onAdLoaded).toHaveBeenCalled();
    });
  });

  it('should track impression when ad is displayed', async () => {
    const mockAdConfig = {
      id: '1',
      adType: AdType.BANNER,
      adNetworkId: 'test-network',
      displayFrequency: 1,
    };

    mockApiClient.get.mockResolvedValueOnce({
      user: { premiumStatus: 'FREE' },
    });
    mockApiClient.get.mockResolvedValueOnce(mockAdConfig);
    mockApiClient.post.mockResolvedValue({ success: true });

    renderWithClient(<BannerAd />);

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/ads/track',
        expect.objectContaining({
          adType: AdType.BANNER,
          action: 'IMPRESSION',
          adNetworkId: 'test-network',
        }),
        expect.any(Object)
      );
    });
  });

  it('should track click when ad is pressed', async () => {
    const mockAdConfig = {
      id: '1',
      adType: AdType.BANNER,
      adNetworkId: 'test-network',
      displayFrequency: 1,
    };

    mockApiClient.get.mockResolvedValueOnce({
      user: { premiumStatus: 'FREE' },
    });
    mockApiClient.get.mockResolvedValueOnce(mockAdConfig);
    mockApiClient.post.mockResolvedValue({ success: true });

    const { getByText } = renderWithClient(<BannerAd />);

    await waitFor(() => {
      expect(getByText('Tap to learn more')).toBeTruthy();
    });

    // Clear previous calls (impression tracking)
    mockApiClient.post.mockClear();

    fireEvent.press(getByText('Tap to learn more'));

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/ads/track',
        expect.objectContaining({
          adType: AdType.BANNER,
          action: 'CLICK',
          adNetworkId: 'test-network',
        }),
        expect.any(Object)
      );
    });
  });

  it('should use sample ad when API fails', async () => {
    mockApiClient.get.mockResolvedValueOnce({
      user: { premiumStatus: 'FREE' },
    });
    mockApiClient.get.mockRejectedValueOnce(new Error('Network error'));
    mockApiClient.post.mockResolvedValue({ success: true });

    const { getByText } = renderWithClient(<BannerAd />);

    await waitFor(() => {
      expect(getByText('Sample Banner Ad - Network: sample-network-banner')).toBeTruthy();
    });
  });
});
