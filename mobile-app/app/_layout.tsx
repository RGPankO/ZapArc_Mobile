import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../src/lib/queryClient';
import { initializeDeepLinking } from '../src/utils/deepLinking';
import { storageService } from '../src/services';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { LanguageProvider } from '../src/contexts/LanguageContext';
import { FeedbackProvider } from '../src/features/wallet/components/FeedbackComponents';

export default function RootLayout(): React.JSX.Element {
  useEffect(() => {
    // Initialize deep linking when the app starts
    initializeDeepLinking();

    // ONE-TIME: Wipe corrupted wallets from broken encryption migration
    // TODO: Remove this after Bob's device is clean
    (async () => {
      try {
        await storageService.deleteAllWallets();
        console.log('🧹 [CLEANUP] All corrupted wallet data wiped');
      } catch (e) {
        console.warn('🧹 [CLEANUP] Wipe failed:', e);
      }
    })();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ThemeProvider>
          <FeedbackProvider>
            {/* Status bar with light content (white text/icons) for dark theme */}
            <StatusBar style="light" translucent backgroundColor="transparent" />
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen
                name="index"
                options={{
                  animation: 'none',
                  gestureEnabled: false
                }}
              />
              <Stack.Screen
                name="wallet"
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="auth"
                options={{
                  animation: 'none',
                  gestureEnabled: false
                }}
              />
              <Stack.Screen name="(main)" options={{ headerShown: false }} />
            </Stack>
          </FeedbackProvider>
        </ThemeProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
