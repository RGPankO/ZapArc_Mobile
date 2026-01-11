import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../src/lib/queryClient';
import { initializeDeepLinking } from '../src/utils/deepLinking';
import { ThemeProvider } from '../src/contexts/ThemeContext';

export default function RootLayout(): React.JSX.Element {
  useEffect(() => {
    // Initialize deep linking when the app starts
    initializeDeepLinking();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
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
      </ThemeProvider>
    </QueryClientProvider>
  );
}
