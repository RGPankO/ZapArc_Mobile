import React from 'react';
import { render, waitFor, fireEvent, cleanup, act, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';
import { InterstitialAd } from '../features/ads';
import { apiClient } from '../lib/apiClient';
import { AdType } from '../features/ads/types';
import { ThemeProvider } from '../contexts/ThemeContext';

// Increase Jest timeout even more for real delays
jest.setTimeout(90000);

// Mock the apiClient
jest.mock('../lib/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// Mock expo-navigation-bar
jest.mock('expo-navigation-bar', () => ({
  setBackgroundColorAsync: jest.fn().mockResolvedValue(undefined),
  setButtonStyleAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

/**
 * Helper to render with a fresh QueryClient for each test
 */
const renderWithClient = (ui: React.ReactElement): any => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
  
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <PaperProvider>{ui}</PaperProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('InterstitialAd', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useRealTimers();
  });

  afterEach(() => {
    cleanup();
  });

  it('should show close button after video completes', async () => {
    const onClose = jest.fn();

    mockApiClient.get.mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/users/profile')) {
        return Promise.resolve({ user: { premiumStatus: 'FREE' } });
      }
      if (typeof url === 'string' && url.includes('/ads/serve')) {
        return Promise.resolve({
          id: '1',
          adType: AdType.INTERSTITIAL,
          adNetworkId: 'test-network',
          displayFrequency: 1,
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
    
    mockApiClient.post.mockResolvedValue({ success: true });

    renderWithClient(
      <InterstitialAd visible={true} onClose={onClose} />
    );

    // Wait for the ad to load
    await waitFor(() => {
      expect(screen.getByText('Sample Video Advertisement')).toBeTruthy();
    }, { timeout: 10000 });

    // Wait for 5.5 seconds for the real timer in the component to finish
    await act(async () => {
      await new Promise(r => global.setTimeout(r, 5500));
    });

    // The close button should now be visible
    await waitFor(() => {
      expect(screen.queryByText('✕')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('should track close when close button is pressed', async () => {
    const onClose = jest.fn();

    mockApiClient.get.mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/users/profile')) {
        return Promise.resolve({ user: { premiumStatus: 'FREE' } });
      }
      if (typeof url === 'string' && url.includes('/ads/serve')) {
        return Promise.resolve({
          id: '1',
          adType: AdType.INTERSTITIAL,
          adNetworkId: 'test-network',
          displayFrequency: 1,
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    mockApiClient.post.mockResolvedValue({ success: true });

    renderWithClient(
      <InterstitialAd visible={true} onClose={onClose} />
    );

    await waitFor(() => {
      expect(screen.getByText('Sample Video Advertisement')).toBeTruthy();
    }, { timeout: 10000 });

    // Wait for 5.5 seconds
    await act(async () => {
      await new Promise(r => global.setTimeout(r, 5500));
    });

    const closeBtn = await screen.findByText('✕');
    mockApiClient.post.mockClear();

    await act(async () => {
      fireEvent.press(closeBtn);
    });

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/ads/track',
        expect.objectContaining({
          action: 'CLOSE',
          adNetworkId: 'test-network',
        }),
        expect.any(Object)
      );
    }, { timeout: 5000 });

    expect(onClose).toHaveBeenCalled();
  });
  
  // Keep the rest of the tests (they already use real timers and are fast)
  it('should not render when not visible', async () => {
    const onClose = jest.fn();
    renderWithClient(
      <InterstitialAd visible={false} onClose={onClose} />
    );
    expect(screen.queryByText('Loading advertisement...')).toBeNull();
  });

  it('should render loading state when visible', async () => {
    const onClose = jest.fn();
    mockApiClient.get.mockImplementation(() => new Promise(() => {}));
    renderWithClient(
      <InterstitialAd visible={true} onClose={onClose} />
    );
    expect(screen.getByText('Loading advertisement...')).toBeTruthy();
  });

  it('should close immediately for premium users', async () => {
    const onClose = jest.fn();
    mockApiClient.get.mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/users/profile')) {
        return Promise.resolve({ user: { premiumStatus: 'PREMIUM_LIFETIME' } });
      }
      return Promise.resolve({ id: '1', adType: AdType.INTERSTITIAL, adNetworkId: 'test', displayFrequency: 1 });
    });
    renderWithClient(<InterstitialAd visible={true} onClose={onClose} />);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('should track click when ad is pressed', async () => {
    const onClose = jest.fn();
    mockApiClient.get.mockResolvedValue({ id: '1', adType: AdType.INTERSTITIAL, adNetworkId: 'test-network', displayFrequency: 1 });
    mockApiClient.post.mockResolvedValue({ success: true });
    renderWithClient(<InterstitialAd visible={true} onClose={onClose} />);
    const learnMore = await screen.findByText('Tap to learn more');
    mockApiClient.post.mockClear();
    fireEvent.press(learnMore);
    await waitFor(() => expect(mockApiClient.post).toHaveBeenCalledWith('/ads/track', expect.objectContaining({ action: 'CLICK' }), expect.any(Object)));
  });

  it('should use sample ad when API fails', async () => {
    const onClose = jest.fn();
    mockApiClient.get.mockRejectedValue(new Error('Network error'));
    renderWithClient(<InterstitialAd visible={true} onClose={onClose} />);
    await waitFor(() => expect(screen.getByText('Network: sample-network-interstitial')).toBeTruthy());
  });
});
