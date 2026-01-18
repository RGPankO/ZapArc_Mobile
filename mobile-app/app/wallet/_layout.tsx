import { Stack } from 'expo-router';

export default function WalletLayout(): React.JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen 
        name="welcome" 
        options={{
          gestureEnabled: false,
        }}
      />
      <Stack.Screen 
        name="unlock" 
        options={{
          gestureEnabled: false,
        }}
      />
      <Stack.Screen name="create" />
      <Stack.Screen name="import" />
      <Stack.Screen name="pin" />
      <Stack.Screen 
        name="selection" 
        options={{
          gestureEnabled: false,
        }}
      />
      <Stack.Screen 
        name="home" 
        options={{
          // Prevent back navigation to welcome/create screens
          gestureEnabled: false,
        }}
      />
      <Stack.Screen name="scan" />
      <Stack.Screen name="history" />
      <Stack.Screen name="manage" />
      <Stack.Screen name="tip/create" />
      <Stack.Screen name="tip/qr" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="archived" />
    </Stack>
  );
}
