import React from 'react';
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, HelperText, Divider } from 'react-native-paper';
import { StyledTextInput } from '../../../components';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useRegister } from '../../../hooks';
import GoogleSignInButton from '../../../components/GoogleSignInButton';

interface RegisterFormData {
  nickname: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const schema = yup.object({
  nickname: yup
    .string()
    .required('Nickname is required')
    .min(2, 'Nickname must be at least 2 characters'),
  email: yup
    .string()
    .required('Email is required')
    .email('Please enter a valid email address'),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
    .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .matches(/\d/, 'Password must contain at least one number'),
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password')], 'Passwords must match'),
});

export function RegisterScreen(): React.JSX.Element {
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const register = useRegister();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: yupResolver(schema),
    mode: 'onBlur',
  });

  const onSubmit = (data: RegisterFormData): void => {
    register.mutate(
      { nickname: data.nickname, email: data.email, password: data.password },
      {
        onSuccess: () => {
          Alert.alert(
            'Registration Successful',
            'Please check your email to verify your account.',
            [{ text: 'OK', onPress: (): void => router.push('/auth/email-verification') }]
          );
        },
        onError: (error) => {
          console.log('Registration error:', error);
          Alert.alert('Registration Failed', error.message || 'Please try again later.');
        },
      }
    );
  };

  const handleLoginPress = (): void => {
    router.push('/auth/login');
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
              Create Account
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Join us and start your journey
            </Text>

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
                name="nickname"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={styles.inputContainer}>
                    <StyledTextInput
                      label="Nickname"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={!!errors.nickname}
                      style={styles.input}
                      mode="outlined"
                    />
                    <HelperText type="error" visible={!!errors.nickname}>
                      {errors.nickname?.message}
                    </HelperText>
                  </View>
                )}
              />

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

              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={styles.inputContainer}>
                    <StyledTextInput
                      label="Confirm Password"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={!!errors.confirmPassword}
                      style={styles.input}
                      mode="outlined"
                      secureTextEntry={!showConfirmPassword}
                      right={
                        <TextInput.Icon
                          icon={showConfirmPassword ? 'eye-off' : 'eye'}
                          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        />
                      }
                    />
                    <HelperText type="error" visible={!!errors.confirmPassword}>
                      {errors.confirmPassword?.message}
                    </HelperText>
                  </View>
                )}
              />

              <Button
                mode="contained"
                onPress={handleSubmit(onSubmit)}
                loading={register.isPending}
                disabled={register.isPending}
                style={styles.submitButton}
                contentStyle={styles.buttonContent}
              >
                Create Account
              </Button>

              <View style={styles.loginContainer}>
                <Text variant="bodyMedium">Already have an account? </Text>
                <Button
                  mode="text"
                  onPress={handleLoginPress}
                  compact
                  style={styles.loginButton}
                >
                  Login
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
  form: {
    marginTop: 16,
  },
  inputContainer: {
    marginBottom: 8,
  },
  input: {
  },
  submitButton: {
    marginTop: 24,
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  loginButton: {
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
