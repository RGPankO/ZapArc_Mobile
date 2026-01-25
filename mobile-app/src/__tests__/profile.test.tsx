import React from 'react';
import { render, cleanup } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { ThemeProvider } from '../contexts/ThemeContext';
import ProfileScreen from '../../app/(main)/profile';

// Mock the profile hooks
const mockUseUserProfile = jest.fn();
const mockUseUpdateProfile = jest.fn();
const mockUseLogout = jest.fn();

jest.mock('../features/profile/hooks', () => ({
  useUserProfile: (): any => mockUseUserProfile(),
  useUpdateProfile: (): any => mockUseUpdateProfile(),
  useLogout: (): any => mockUseLogout(),
}));

// Mock useLightningAddress hook
jest.mock('../hooks/useLightningAddress', () => ({
  useLightningAddress: jest.fn().mockReturnValue({
    addressInfo: null,
    isLoading: false,
    error: null,
    isRegistered: false,
    refresh: jest.fn(),
    checkAvailability: jest.fn(),
    register: jest.fn(),
    unregister: jest.fn(),
    validateUsername: jest.fn(),
    clearError: jest.fn(),
  }),
  default: jest.fn(),
}));

// Mock the context
jest.mock('../contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }): React.ReactElement => children as React.ReactElement,
  useAppTheme: jest.fn().mockReturnValue({
    themeMode: 'light',
    toggleTheme: jest.fn(),
  }),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

// Mock ActivityIndicator to avoid lingering animations
jest.mock('react-native-paper', () => {
  const RealModule = jest.requireActual('react-native-paper');
  return {
    ...RealModule,
    ActivityIndicator: (props: any) => <RealModule.Text {...props}>Loading...</RealModule.Text>,
  };
});

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      <PaperProvider>
        {component}
      </PaperProvider>
    </ThemeProvider>
  );
};

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockUseUserProfile.mockReturnValue({
      data: {
        id: '1',
        email: 'test@example.com',
        nickname: 'Test User',
        isVerified: true,
        premiumStatus: 'FREE',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    mockUseUpdateProfile.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    });

    mockUseLogout.mockReturnValue({
      mutate: jest.fn(),
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    cleanup();
  });

  it('renders without crashing', () => {
    const { getByText } = renderWithProvider(<ProfileScreen />);
    expect(getByText('Profile')).toBeTruthy();
  });

  it('shows loading state initially', () => {
    mockUseUserProfile.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = renderWithProvider(<ProfileScreen />);
    expect(getByText('Loading profile...')).toBeTruthy();
  });
});