// User Feedback Components
// Toast notifications, loading indicators, and confirmation dialogs

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import {
  View,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Text, Button, Portal } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND_COLOR } from '../../../utils/theme-helpers';

// =============================================================================
// Types
// =============================================================================

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ConfirmationOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmStyle?: 'default' | 'destructive';
  icon?: string;
}

interface LoadingOptions {
  message?: string;
  timeout?: number;
}

interface FeedbackContextValue {
  showToast: (type: ToastType, message: string, duration?: number) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
  showLoading: (options?: LoadingOptions) => () => void;
  hideLoading: () => void;
  confirm: (options: ConfirmationOptions) => Promise<boolean>;
}

// =============================================================================
// Context
// =============================================================================

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function useFeedback(): FeedbackContextValue {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return context;
}

// =============================================================================
// Provider Component
// =============================================================================

interface FeedbackProviderProps {
  children: React.ReactNode;
}

export function FeedbackProvider({ children }: FeedbackProviderProps): React.JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | undefined>();
  const [confirmState, setConfirmState] = useState<{
    visible: boolean;
    options: ConfirmationOptions | null;
    resolve: ((value: boolean) => void) | null;
  }>({ visible: false, options: null, resolve: null });

  const insets = useSafeAreaInsets();
  const loadingTimeoutRef = useRef<ReturnType<typeof global.setTimeout>>();

  // ========================================
  // Toast Functions
  // ========================================

  const showToast = useCallback(
    (type: ToastType, message: string, duration: number = 3000) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const toast: Toast = { id, type, message, duration };

      setToasts((prev) => [...prev, toast]);

      // Auto-dismiss
      global.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    []
  );

  const showSuccess = useCallback(
    (message: string) => showToast('success', message),
    [showToast]
  );

  const showError = useCallback(
    (message: string) => showToast('error', message, 4000),
    [showToast]
  );

  const showWarning = useCallback(
    (message: string) => showToast('warning', message),
    [showToast]
  );

  const showInfo = useCallback(
    (message: string) => showToast('info', message),
    [showToast]
  );

  // ========================================
  // Loading Functions
  // ========================================

  const showLoading = useCallback((options: LoadingOptions = {}) => {
    setLoadingMessage(options.message);
    setIsLoading(true);

    // Optional timeout
    if (options.timeout) {
      loadingTimeoutRef.current = global.setTimeout(() => {
        setIsLoading(false);
      }, options.timeout);
    }

    // Return hide function
    return () => {
      setIsLoading(false);
      if (loadingTimeoutRef.current) {
        global.clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  const hideLoading = useCallback(() => {
    setIsLoading(false);
    if (loadingTimeoutRef.current) {
      global.clearTimeout(loadingTimeoutRef.current);
    }
  }, []);

  // ========================================
  // Confirmation Functions
  // ========================================

  const confirm = useCallback(
    (options: ConfirmationOptions): Promise<boolean> => {
      return new Promise((resolve) => {
        setConfirmState({
          visible: true,
          options,
          resolve,
        });
      });
    },
    []
  );

  const handleConfirm = useCallback(() => {
    confirmState.resolve?.(true);
    setConfirmState({ visible: false, options: null, resolve: null });
  }, [confirmState]);

  const handleCancel = useCallback(() => {
    confirmState.resolve?.(false);
    setConfirmState({ visible: false, options: null, resolve: null });
  }, [confirmState]);

  // ========================================
  // Context Value
  // ========================================

  const value: FeedbackContextValue = {
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showLoading,
    hideLoading,
    confirm,
  };

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      {/* Toast Container */}
      <View style={[styles.toastContainer, { bottom: insets.bottom + 80 }]}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </View>

      {/* Loading Modal */}
      <Modal visible={isLoading} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={BRAND_COLOR} />
            {loadingMessage && (
              <Text style={styles.loadingText}>{loadingMessage}</Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        visible={confirmState.visible}
        transparent
        animationType="fade"
        onRequestClose={handleCancel}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmContent}>
            {confirmState.options?.icon && (
              <Text style={styles.confirmIcon}>{confirmState.options.icon}</Text>
            )}
            <Text style={styles.confirmTitle}>
              {confirmState.options?.title}
            </Text>
            <Text style={styles.confirmMessage}>
              {confirmState.options?.message}
            </Text>
            <View style={styles.confirmButtons}>
              <Button
                mode="outlined"
                onPress={handleCancel}
                style={styles.cancelButton}
                labelStyle={styles.cancelButtonLabel}
              >
                {confirmState.options?.cancelText || 'Cancel'}
              </Button>
              <Button
                mode="contained"
                onPress={handleConfirm}
                style={[
                  styles.confirmButton,
                  confirmState.options?.confirmStyle === 'destructive' &&
                    styles.destructiveButton,
                ]}
                labelStyle={styles.confirmButtonLabel}
              >
                {confirmState.options?.confirmText || 'Confirm'}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </FeedbackContext.Provider>
  );
}

// =============================================================================
// Toast Item Component
// =============================================================================

interface ToastItemProps {
  toast: Toast;
}

function ToastItem({ toast }: ToastItemProps): React.JSX.Element {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate in (slide up from bottom)
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Animate out before removal (slide down)
    const hideTimeout = global.setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 100,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }, toast.duration - 300);

    return () => {
      global.clearTimeout(hideTimeout);
    };
  }, [toast.duration, translateY, opacity]);

  const getToastStyle = (): object => {
    switch (toast.type) {
      case 'success':
        return styles.toastSuccess;
      case 'error':
        return styles.toastError;
      case 'warning':
        return styles.toastWarning;
      case 'info':
        return styles.toastInfo;
    }
  };

  const getToastIcon = (): string => {
    switch (toast.type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
    }
  };

  return (
    <Animated.View
      style={[
        styles.toastItem,
        getToastStyle(),
        { transform: [{ translateY }], opacity },
      ]}
    >
      <Text style={styles.toastIcon}>{getToastIcon()}</Text>
      <Text style={styles.toastMessage}>{toast.message}</Text>
    </Animated.View>
  );
}

// =============================================================================
// Standalone Components (for use outside Provider)
// =============================================================================

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({
  visible,
  message,
}: LoadingOverlayProps): React.JSX.Element | null {
  if (!visible) return null;

  return (
    <View style={styles.loadingOverlay}>
      <View style={styles.loadingContent}>
        <ActivityIndicator size="large" color={BRAND_COLOR} />
        {message && <Text style={styles.loadingText}>{message}</Text>}
      </View>
    </View>
  );
}

interface InlineLoadingProps {
  message?: string;
  size?: 'small' | 'large';
}

export function InlineLoading({
  message,
  size = 'small',
}: InlineLoadingProps): React.JSX.Element {
  return (
    <View style={styles.inlineLoading}>
      <ActivityIndicator size={size} color={BRAND_COLOR} />
      {message && <Text style={styles.inlineLoadingText}>{message}</Text>}
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  toastItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    maxWidth: '100%',
  },
  toastSuccess: {
    backgroundColor: '#1E3A1E',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  toastError: {
    backgroundColor: '#3A1E1E',
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  toastWarning: {
    backgroundColor: '#3A331E',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  toastInfo: {
    backgroundColor: '#1E2A3A',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  toastIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  toastMessage: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    backgroundColor: '#1a1a2e',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 140,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  confirmIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  confirmTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmMessage: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
  },
  cancelButtonLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: BRAND_COLOR,
    borderRadius: 12,
  },
  destructiveButton: {
    backgroundColor: '#F44336',
  },
  confirmButtonLabel: {
    color: '#1a1a2e',
    fontWeight: '600',
  },
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  inlineLoadingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginLeft: 12,
  },
});
