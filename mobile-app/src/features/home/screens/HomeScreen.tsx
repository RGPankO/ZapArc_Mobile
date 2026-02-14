import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { InterstitialAd, useInterstitialAd } from '../../ads';
import { useAuth } from '../../../hooks/useAuth';

export function HomeScreen(): React.JSX.Element {
  const interstitialAd = useInterstitialAd();
  const { isAuthenticated, isLoading, checkAuth } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth/welcome');
    }
  }, [isAuthenticated, isLoading]);

  const handleLogout = async (): Promise<void> => {
    try {
      const { tokenService } = await import('../../../services/tokenService');
      await tokenService.clearAuth();
      await checkAuth();
    } catch (error) {
      console.error('Logout error:', error);
      await checkAuth();
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          ZapArc
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Welcome back!
        </Text>

        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={() => router.push('/(main)/profile')}
            style={styles.button}
          >
            My Profile
          </Button>

          <Button
            mode="contained"
            onPress={() => router.push('/(main)/settings')}
            style={styles.button}
          >
            Settings
          </Button>

          <Button
            mode="outlined"
            onPress={interstitialAd.showAd}
            style={styles.button}
          >
            Show Interstitial Ad
          </Button>

          <Button
            mode="outlined"
            onPress={handleLogout}
            style={styles.button}
          >
            Logout
          </Button>
        </View>
      </View>

      <InterstitialAd
        visible={interstitialAd.isVisible}
        onClose={interstitialAd.hideAd}
        onAdLoaded={interstitialAd.onAdLoaded}
        onAdError={interstitialAd.onAdError}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 16,
  },
  buttonContainer: {
    gap: 16,
  },
  button: {
    borderRadius: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
});
