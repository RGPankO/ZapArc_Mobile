import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../src/lib/queryClient';
import { initializeDeepLinking } from '../src/utils/deepLinking';

// Custom theme to fix TextInput label clipping issue
const customTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    // Ensure label has proper background to prevent clipping
    background: '#1a1a2e',
    surface: '#1a1a2e',
    surfaceVariant: 'rgba(255, 255, 255, 0.05)',
  },
  roundness: 8,
};

export default function RootLayout(): React.JSX.Element {
  useEffect(() => {
    // Initialize deep linking when the app starts
    initializeDeepLinking();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={customTheme}>
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
      </PaperProvider>
    </QueryClientProvider>
  );
}
