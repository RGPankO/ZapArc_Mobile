import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Button, Text, Card } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

export function EmailVerificationScreen(): React.JSX.Element {
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [resendCooldown]);

  const handleResendEmail = async (): Promise<void> => {
    setIsResending(true);

    try {
      // TODO: Implement actual resend verification email API call
      console.log('Resending verification email...');

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      Alert.alert(
        'Email Sent',
        'A new verification email has been sent to your inbox.'
      );

      // Start cooldown
      setResendCooldown(60);
    } catch (error) {
      Alert.alert(
        'Failed to Send Email',
        'Please try again later or contact support if the problem persists.'
      );
    } finally {
      setIsResending(false);
    }
  };

  const handleBackToLogin = (): void => {
    router.push('/auth/login');
  };

  const handleCheckVerification = async (): Promise<void> => {
    try {
      // TODO: Implement actual verification status check API call
      console.log('Checking verification status...');

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      // For demo purposes, show different responses
      const isVerified = Math.random() > 0.5;

      if (isVerified) {
        Alert.alert(
          'Email Verified!',
          'Your email has been successfully verified. You can now log in.',
          [
            {
              text: 'Login',
              onPress: () => router.push('/auth/login'),
            },
          ]
        );
      } else {
        Alert.alert(
          'Not Verified Yet',
          'Your email is not verified yet. Please check your inbox and click the verification link.'
        );
      }
    } catch (error) {
      Alert.alert(
        'Verification Check Failed',
        'Unable to check verification status. Please try again.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Card style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.iconContainer}>
              <MaterialIcons name="email" size={64} color="#2196F3" />
            </View>

            <Text variant="headlineSmall" style={styles.title}>
              Verify Your Email
            </Text>

            <Text variant="bodyMedium" style={styles.description}>
              We've sent a verification link to your email address. Please check your inbox and click the link to verify your account.
            </Text>

            <Text variant="bodySmall" style={styles.note}>
              Don't forget to check your spam folder if you don't see the email in your inbox.
            </Text>

            <View style={styles.buttonContainer}>
              <Button
                mode="contained"
                onPress={handleCheckVerification}
                style={styles.button}
                contentStyle={styles.buttonContent}
              >
                I've Verified My Email
              </Button>

              <Button
                mode="outlined"
                onPress={handleResendEmail}
                loading={isResending}
                disabled={isResending || resendCooldown > 0}
                style={styles.button}
                contentStyle={styles.buttonContent}
              >
                {resendCooldown > 0
                  ? `Resend Email (${resendCooldown}s)`
                  : 'Resend Verification Email'
                }
              </Button>

              <Button
                mode="text"
                onPress={handleBackToLogin}
                style={styles.backButton}
              >
                Back to Login
              </Button>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.helpContainer}>
          <Text variant="bodySmall" style={styles.helpText}>
            Having trouble? Contact support for assistance.
          </Text>
        </View>
      </View>
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
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    elevation: 4,
    borderRadius: 12,
  },
  cardContent: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: 'bold',
  },
  description: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 16,
    lineHeight: 22,
  },
  note: {
    textAlign: 'center',
    color: '#999',
    marginBottom: 32,
    fontStyle: 'italic',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  backButton: {
    marginTop: 8,
  },
  helpContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  helpText: {
    color: '#999',
    textAlign: 'center',
  },
});
