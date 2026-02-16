import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { useGoogleLogin } from './useAuth';

// Required for web OAuth to complete properly
WebBrowser.maybeCompleteAuthSession();

export interface GoogleSignInError {
  code: string;
  message: string;
}

/**
 * Hook to handle Google Sign-In OAuth flow
 * Uses useIdTokenAuthRequest which returns ID token directly (no code exchange needed)
 * Works on web and mobile platforms
 */
export function useGoogleSignIn() {
  const queryClient = useQueryClient();
  const googleLogin = useGoogleLogin();

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const expoAuthProxyUri = process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI;

  // useIdTokenAuthRequest returns ID token directly without code exchange
  // On web: uses ResponseType.IdToken
  // On native: uses ResponseType.IdToken (implicit flow)
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId,
    androidClientId,
    iosClientId,
    // Use auth proxy redirect for mobile to avoid exp:// URI issues
    redirectUri: Platform.OS === 'web' ? undefined : expoAuthProxyUri,
  });

  // Log for debugging
  useEffect(() => {
    if (__DEV__) {
      console.log('Google Auth Request ready:', !!request);
      console.log('Platform:', Platform.OS);
      if (request) {
        console.log('Google Auth redirect URI configured');
      }
    }
  }, [request]);

  // Handle the OAuth response
  useEffect(() => {
    const handleResponse = async () => {
      if (response?.type === 'success') {
        // Get ID token from params (implicit flow returns it directly)
        const idToken = response.params?.id_token;

        if (idToken) {
          try {
            if (__DEV__) {
              console.log('Google sign-in success, authenticating with backend');
            }
            await googleLogin.mutateAsync(idToken);
            queryClient.invalidateQueries({ queryKey: ['user'] });
          } catch (error) {
            console.error('Backend auth error:', error);
          }
        } else {
          console.error('No ID token in Google OAuth response');
        }
      }
    };

    handleResponse();
  }, [response]);

  const signIn = async () => {

    if (!request) {
      const error: GoogleSignInError = {
        code: 'NOT_READY',
        message: 'Google Sign-In is not ready yet',
      };
      throw error;
    }

    try {
      const result = await promptAsync();

      if (result.type === 'cancel') {
        const error: GoogleSignInError = {
          code: 'SIGN_IN_CANCELLED',
          message: 'User cancelled the sign-in process',
        };
        throw error;
      }

      if (result.type === 'error') {
        const error: GoogleSignInError = {
          code: 'GOOGLE_SIGN_IN_ERROR',
          message: result.error?.message || 'Authentication failed',
        };
        throw error;
      }

      // Success case is handled by the useEffect above
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        'message' in error
      ) {
        throw error;
      }

      const wrappedError: GoogleSignInError = {
        code: 'GOOGLE_SIGN_IN_ERROR',
        message: (error as Error).message || 'An error occurred during Google Sign-In',
      };
      throw wrappedError;
    }
  };

  return {
    signIn,
    isReady: !!request,
    isLoading: googleLogin.isPending,
    error: googleLogin.error,
  };
}
