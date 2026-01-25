// TODO: This test file needs to be rewritten to work with the new react-query hook-based architecture.
// The old tests were coupled to a paymentService that no longer exists.
// The new PremiumScreen uses usePaymentPlans, usePaymentStatus, useProcessSubscription, useProcessPurchase hooks.

import React from 'react';
import { render, waitFor, screen, cleanup } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';
import { PremiumScreen, PaymentPlan } from '../features/payments';
import { PremiumStatus } from '../types';
import { apiClient } from '../lib/apiClient';

// Mock expo-router
jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
  },
}));

// Mock apiClient
jest.mock('../lib/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Create wrapper with QueryClient and PaperProvider
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <PaperProvider>{children}</PaperProvider>
    </QueryClientProvider>
  );
};

describe('PremiumScreen', () => {
  const mockPlans: PaymentPlan[] = [
    {
      id: 'subscription',
      type: 'subscription',
      price: 9.99,
      currency: 'USD',
      duration: 'monthly',
      features: ['Ad-free experience', 'Premium features', 'Priority support'],
    },
    {
      id: 'lifetime',
      type: 'one-time',
      price: 49.99,
      currency: 'USD',
      duration: 'lifetime',
      features: ['Ad-free experience', 'Lifetime access', 'Priority support'],
    },
  ];

  const mockFreeStatus = {
    hasPremium: false,
    premiumStatus: PremiumStatus.FREE,
    activePayments: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    cleanup();
  });

  it('should render loading state initially', () => {
    // Make API calls hang to show loading state
    mockApiClient.get.mockImplementation(() => new Promise(() => {}));

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <PremiumScreen />
      </Wrapper>
    );

    expect(screen.getByText('Loading premium options...')).toBeTruthy();
  });

  it('should render payment plans for free users', async () => {
    mockApiClient.get.mockImplementation((url: string) => {
      if (url.includes('/payments/plans')) {
        return Promise.resolve(mockPlans);
      }
      if (url.includes('/payments/user/status')) {
        return Promise.resolve(mockFreeStatus);
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <PremiumScreen />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Premium Plans')).toBeTruthy();
      expect(screen.getByText('Monthly Premium')).toBeTruthy();
      expect(screen.getByText('Lifetime Premium')).toBeTruthy();
    });
  });
});
