import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, screen, cleanup } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SendScreen from '../send';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaProvider: ({ children }: any) => React.createElement(View, null, children),
    SafeAreaView: ({ children }: any) => React.createElement(View, null, children),
  };
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const { Text, TextInput, TouchableOpacity, View } = require('react-native');

  const Button = ({ children, onPress, testID }: any) =>
    React.createElement(TouchableOpacity, { onPress, testID }, React.createElement(Text, null, children));

  const Menu = ({ anchor, children }: any) =>
    React.createElement(View, null, anchor, children);

  Menu.Item = ({ title, onPress }: any) =>
    React.createElement(TouchableOpacity, { onPress }, React.createElement(Text, null, title));

  return {
    PaperProvider: ({ children }: any) => React.createElement(View, null, children),
    Text,
    Button,
    TextInput,
    Menu,
    IconButton: ({ onPress }: any) => React.createElement(TouchableOpacity, { onPress }),
  };
});

const mockParsePaymentRequest = jest.fn();
const mockPrepareSendPayment = jest.fn();
const mockSendOnchainPayment = jest.fn();
const mockSendPayment = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    navigate: jest.fn(),
  },
}));

jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../../src/contexts/ThemeContext', () => ({
  useAppTheme: () => ({ themeMode: 'light' }),
}));

jest.mock('../../../src/hooks/useWallet', () => ({
  useWallet: () => ({
    balance: 500000,
    refreshBalance: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('../../../src/hooks/useCurrency', () => ({
  useCurrency: () => ({
    secondaryFiatCurrency: 'usd',
    convertToSats: (value: number) => Math.round(value),
    formatSatsWithFiat: (sats: number) => ({ satsDisplay: `${sats} sats`, fiatDisplay: '$1.00' }),
    rates: { usd: 100000, eur: 100000 },
    isLoadingRates: false,
  }),
}));

jest.mock('../../../src/hooks/useLightningAddress', () => ({
  useLightningAddress: () => ({ addressInfo: null }),
}));

jest.mock('../../../src/features/addressBook/hooks/useContacts', () => ({
  useContacts: () => ({ contacts: [] }),
}));

jest.mock('../../../src/features/addressBook/components/ContactSelectionModal', () => ({
  ContactSelectionModal: () => null,
}));

jest.mock('../../../src/components', () => {
  const React = require('react');
  const { TextInput } = require('react-native');
  return {
    StyledTextInput: ({ value, onChangeText }: { value: string; onChangeText: (v: string) => void }) => (
      React.createElement(TextInput, { testID: 'amount-input', value, onChangeText })
    ),
  };
});

jest.mock('../../../src/services/breezSparkService', () => ({
  BreezSparkService: {
    parsePaymentRequest: (...args: unknown[]) => mockParsePaymentRequest(...args),
    prepareSendPayment: (...args: unknown[]) => mockPrepareSendPayment(...args),
    sendOnchainPayment: (...args: unknown[]) => mockSendOnchainPayment(...args),
    sendPayment: (...args: unknown[]) => mockSendPayment(...args),
  },
}));

const renderScreen = () =>
  render(
    <SafeAreaProvider>
      <PaperProvider>
        <SendScreen />
      </PaperProvider>
    </SafeAreaProvider>
  );

describe('SendScreen on-chain flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    mockParsePaymentRequest.mockResolvedValue({ type: 'bitcoinAddress', isValid: true });
    mockPrepareSendPayment.mockResolvedValue({
      paymentMethod: {
        tag: 'BitcoinAddress',
        inner: {
          feeQuote: {
            speedFast: { feeSats: 30, estimatedConfirmationTime: '10' },
            speedMedium: { feeSats: 20, estimatedConfirmationTime: '30' },
            speedSlow: { feeSats: 10, estimatedConfirmationTime: '60' },
          },
        },
      },
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    cleanup();
  });

  it('detects on-chain addresses (mainnet + testnet) and shows badge', async () => {
    renderScreen();

    fireEvent.changeText(screen.getByPlaceholderText('Invoice or address...'), '1BoatSLRHtKNngkdXEeobR76b53LETtpyT');
    expect(screen.getByText(/On-chain/i)).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText('Invoice or address...'), 'tb1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh');
    jest.advanceTimersByTime(600);

    await waitFor(() => {
      expect(mockParsePaymentRequest).toHaveBeenCalled();
      expect(screen.getByText(/On-chain/i)).toBeTruthy();
    });
  });

  it('shows on-chain preview with fee + speed selector and updates fee by speed', async () => {
    renderScreen();

    fireEvent.changeText(screen.getByPlaceholderText('Invoice or address...'), 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh');
    fireEvent.changeText(screen.getByTestId('amount-input'), '1000');
    fireEvent.press(screen.getByText('Preview Payment'));

    await waitFor(() => {
      expect(screen.getByText('Confirmation Speed')).toBeTruthy();
      expect(screen.getByText('Fast')).toBeTruthy();
      expect(screen.getByText('Medium')).toBeTruthy();
      expect(screen.getByText('Slow')).toBeTruthy();
      expect(screen.getByText('Network Fee:')).toBeTruthy();
      expect(screen.getAllByText('20 sats').length).toBeGreaterThan(0);
    });

    fireEvent.press(screen.getByText('Fast'));

    await waitFor(() => {
      expect(screen.getAllByText('30 sats').length).toBeGreaterThan(0);
      expect(screen.getByText('1,030 sats')).toBeTruthy();
    });
  });

  it('rejects invalid and empty amount edge cases', async () => {
    mockParsePaymentRequest.mockResolvedValueOnce({ type: 'unknown', isValid: false });
    renderScreen();

    fireEvent.changeText(screen.getByPlaceholderText('Invoice or address...'), 'not-a-payment-request');
    fireEvent.press(screen.getByText('Preview Payment'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Invalid Payment Request',
        expect.stringContaining('valid Lightning invoice')
      );
    });

    mockParsePaymentRequest.mockResolvedValue({ type: 'bitcoinAddress', isValid: true });
    fireEvent.changeText(screen.getByPlaceholderText('Invoice or address...'), 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh');
    fireEvent.changeText(screen.getByTestId('amount-input'), '');
    fireEvent.press(screen.getByText('Preview Payment'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a valid amount');
    });
  });

  it('handles fee estimation/prepare failures', async () => {
    mockPrepareSendPayment.mockRejectedValueOnce(new Error('fee quote unavailable'));

    renderScreen();
    fireEvent.changeText(screen.getByPlaceholderText('Invoice or address...'), 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh');
    fireEvent.changeText(screen.getByTestId('amount-input'), '1000');
    fireEvent.press(screen.getByText('Preview Payment'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Payment Error', 'fee quote unavailable');
    });
  });
});
