import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, HelperText, Divider } from 'react-native-paper';
import { StyledTextInput } from '../../../components';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useLogin, useResendVerification } from '../../../hooks';
import GoogleSignInButton from '../../../components/GoogleSignInButton';

const RESEND_COOLDOWN_SECONDS = 60;

interface LoginFormData {
  email: string;
  password: string;
}

const schema = yup.object({
  email: yup
    .string()
    .required('Email is required')
    .email('Please enter a valid email address'),
  password: yup
    .string()
    .required('Password is required'),
});

export function LoginScreen(): React.JSX.Element {
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showVerificationResend, setShowVerificationResend] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSuccess, setResendSuccess] = useState(false);
  const unverifiedEmailRef = useRef<string>('');

  const login = useLogin();
  const resendVerification = useResendVerification();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: yupResolver(schema),
    mode: 'onBlur',
  });

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = global.setTimeout((): void => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return (): void => global.clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResendVerification = (): void => {
    if (resendCooldown > 0 || !unverifiedEmailRef.current) return;

    setResendSuccess(false);
    resendVerification.mutate(unverifiedEmailRef.current, {
      onSuccess: () => {
        setResendSuccess(true);
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
      },
      onError: (error) => {
        setLoginError(error.message || 'Failed to resend verification email');
      },
    });
  };

  const onSubmit = (data: LoginFormData): void => {
    setLoginError(null);
    setShowVerificationResend(false);
    setResendSuccess(false);

    login.mutate(data, {
      onSuccess: () => {
        router.replace('/');
      },
      onError: (error) => {
        if (error.message?.toLowerCase().includes('verify your email')) {
          unverifiedEmailRef.current = data.email;
          setShowVerificationResend(true);
          setLoginError('Please verify your email address before logging in.');
        } else {
          setLoginError(error.message || 'Invalid email or password. Please try again.');
        }
      },
    });
  };

  const handleRegisterPress = (): void => {
    router.push('/auth/register');
  };

  const handleForgotPassword = (): void => {
    Alert.alert(
      'Forgot Password',
      'Password reset functionality will be implemented in a future update.',
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.content}>
          <Text variant="headlineMedium" style={styles.title}>
            Welcome Back
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Sign in to your account
          </Text>

          {loginError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{loginError}</Text>
            </View>
          )}

          {showVerificationResend && (
            <View style={styles.verificationContainer}>
              {resendSuccess ? (
                <View style={styles.successContainer}>
                  <Text style={styles.successText}>
                    Verification email sent! Please check your inbox.
                  </Text>
                </View>
              ) : null}
              <Button
                mode="outlined"
                onPress={handleResendVerification}
                loading={resendVerification.isPending}
                disabled={resendVerification.isPending || resendCooldown > 0}
                style={styles.resendButton}
              >
                {resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : 'Resend Verification Email'}
              </Button>
            </View>
          )}

          <View style={styles.form}>
            <GoogleSignInButton
              mode="contained"
              style={styles.googleButton}
            />

            <View style={styles.dividerContainer}>
              <Divider style={styles.divider} />
              <Text style={styles.dividerText}>or</Text>
              <Divider style={styles.divider} />
            </View>

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputContainer}>
                  <StyledTextInput
                    label="Email"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={!!errors.email}
                    style={styles.input}
                    mode="outlined"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <HelperText type="error" visible={!!errors.email}>
                    {errors.email?.message}
                  </HelperText>
                </View>
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputContainer}>
                  <StyledTextInput
                    label="Password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={!!errors.password}
                    style={styles.input}
                    mode="outlined"
                    secureTextEntry={!showPassword}
                    right={
                      <TextInput.Icon
                        icon={showPassword ? 'eye-off' : 'eye'}
                        onPress={() => setShowPassword(!showPassword)}
                      />
                    }
                  />
                  <HelperText type="error" visible={!!errors.password}>
                    {errors.password?.message}
                  </HelperText>
                </View>
              )}
            />

            <Button
              mode="text"
              onPress={handleForgotPassword}
              style={styles.forgotButton}
              compact
            >
              Forgot Password?
            </Button>

            <Button
              mode="contained"
              onPress={handleSubmit(onSubmit)}
              loading={login.isPending}
              disabled={login.isPending}
              style={styles.submitButton}
              contentStyle={styles.buttonContent}
            >
              Login
            </Button>

            <View style={styles.registerContainer}>
              <Text variant="bodyMedium">Don't have an account? </Text>
              <Button
                mode="text"
                onPress={handleRegisterPress}
                compact
                style={styles.registerButton}
              >
                Register
              </Button>
            </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 32,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
  verificationContainer: {
    marginBottom: 16,
  },
  successContainer: {
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  successText: {
    color: '#2e7d32',
    fontSize: 14,
  },
  resendButton: {
    borderColor: '#1976d2',
  },
  form: {
    marginTop: 16,
  },
  inputContainer: {
    marginBottom: 8,
  },
  input: {
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginBottom: 16,
  },
  submitButton: {
    marginTop: 8,
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  registerButton: {
    marginLeft: -8,
  },
  googleButton: {
    marginBottom: 16,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#666',
    fontSize: 14,
  },
});
