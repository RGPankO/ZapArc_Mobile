import React from 'react';
import { render } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { ThemeProvider } from '../contexts/ThemeContext';
import SettingsScreen from '../../app/(main)/settings';

// Mock the hooks
jest.mock('../hooks', () => ({
  useChangePassword: jest.fn().mockReturnValue({
    mutate: jest.fn(),
    isPending: false,
  }),
  useDeleteAccount: jest.fn().mockReturnValue({
    mutate: jest.fn(),
    isPending: false,
  }),
  useSettings: jest.fn().mockReturnValue({
    settings: {
      notificationsEnabled: true,
    },
    setNotificationsEnabled: jest.fn(),
  }),
}));

jest.mock('../features/profile/hooks', () => ({
  useLogout: jest.fn().mockReturnValue({
    mutate: jest.fn(),
    isPending: false,
  }),
}));

// Mock the context
jest.mock('../contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }: any) => children,
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

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      <PaperProvider>
        {component}
      </PaperProvider>
    </ThemeProvider>
  );
};

describe('SettingsScreen', () => {
  it('renders without crashing', () => {
    const { getByText } = renderWithProvider(<SettingsScreen />);
    expect(getByText('Settings')).toBeTruthy();
  });

  it('shows app preferences section', () => {
    const { getByText } = renderWithProvider(<SettingsScreen />);
    expect(getByText('App Preferences')).toBeTruthy();
    expect(getByText('Push Notifications')).toBeTruthy();
    expect(getByText('Dark Mode')).toBeTruthy();
    expect(getByText('Auto Sync')).toBeTruthy();
  });

  it('shows account security section', () => {
    const { getByText } = renderWithProvider(<SettingsScreen />);
    expect(getByText('Account Security')).toBeTruthy();
    expect(getByText('Change Password')).toBeTruthy();
  });

  it('shows account actions section', () => {
    const { getByText } = renderWithProvider(<SettingsScreen />);
    expect(getByText('Account Actions')).toBeTruthy();
    expect(getByText('Logout')).toBeTruthy();
    expect(getByText('Delete Account')).toBeTruthy();
  });
});