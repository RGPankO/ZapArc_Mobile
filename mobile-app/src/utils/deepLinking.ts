import { Linking } from 'react-native';
import { router } from 'expo-router';

export interface DeepLinkParams {
  token?: string;
  [key: string]: string | undefined;
}

/**
 * Parse URL parameters from a deep link
 */
export function parseDeepLinkParams(url: string): DeepLinkParams {
  try {
    const urlObj = new URL(url);
    const params: DeepLinkParams = {};

    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    return params;
  } catch (error) {
    console.error('Error parsing deep link params:', error);
    return {};
  }
}

/**
 * Handle deep link navigation
 */
export function handleDeepLink(url: string): boolean {
  try {
    if (__DEV__) {
      console.log('Handling deep link');
    }

    const urlObj = new URL(url);
    const path = urlObj.pathname;
    const params = parseDeepLinkParams(url);

    switch (path) {
      case '/verify-email':
        if (params.token) {
          if (__DEV__) {
            console.log('Navigating to email verification [token:***]');
          }
          router.push({
            pathname: '/auth/verify-email',
            params: { token: params.token }
          });
          return true;
        }
        break;

      case '/reset-password':
        if (params.token) {
          if (__DEV__) {
            console.log('Navigating to password reset [token:***]');
          }
          router.push({
            pathname: '/auth/reset-password',
            params: { token: params.token }
          });
          return true;
        }
        break;

      default:
        if (__DEV__) {
          console.log('Unknown deep link path:', path);
        }
        // Navigate to home screen for unknown paths
        router.push('/');
        return true;
    }

    return false;
  } catch (error) {
    console.error('Error handling deep link:', error);
    return false;
  }
}

/**
 * Initialize deep link handling
 */
export function initializeDeepLinking(): void {
  // Handle deep links when app is already running
  Linking.addEventListener('url', (event) => {
    if (__DEV__) {
      console.log('Deep link received while app running');
    }
    handleDeepLink(event.url);
  });

  // Handle deep links when app is launched from closed state
  Linking.getInitialURL().then((url) => {
    if (url) {
      if (__DEV__) {
        console.log('Deep link received on app launch');
      }
      // Add a small delay to ensure the app is fully loaded
      setTimeout(() => {
        handleDeepLink(url);
      }, 1000);
    }
  }).catch((error) => {
    console.error('Error getting initial deep link URL:', error);
  });
}

/**
 * Check if a URL is a valid deep link for this app
 */
export function isValidDeepLink(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'mobile-app:';
  } catch {
    return false;
  }
}
