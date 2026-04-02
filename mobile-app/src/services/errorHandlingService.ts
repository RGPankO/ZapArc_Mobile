// Error Handling Service
// Centralized error handling with retry logic and user feedback

import { Alert, type AlertButton } from 'react-native';

// =============================================================================
// Types
// =============================================================================

export enum ErrorType {
  NETWORK = 'network',
  WALLET = 'wallet',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  PERMISSION = 'permission',
  STORAGE = 'storage',
  UNKNOWN = 'unknown',
}

export interface AppError {
  type: ErrorType;
  code: string;
  message: string;
  details?: unknown;
  retryable: boolean;
  timestamp: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export type ErrorHandler = (error: AppError) => void | Promise<void>;
export type ErrorTransformer = (error: unknown) => AppError;

// =============================================================================
// Default Retry Configuration
// =============================================================================

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

// =============================================================================
// Error Classification
// =============================================================================

export function classifyError(error: unknown): AppError {
  const timestamp = Date.now();

  // Network errors
  if (error instanceof TypeError && error.message.includes('Network')) {
    return {
      type: ErrorType.NETWORK,
      code: 'NETWORK_ERROR',
      message: 'Unable to connect to the server. Please check your internet connection.',
      details: error,
      retryable: true,
      timestamp,
    };
  }

  // Fetch errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network related
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('fetch') ||
      message.includes('connection')
    ) {
      return {
        type: ErrorType.NETWORK,
        code: 'CONNECTION_ERROR',
        message: 'Connection failed. Please try again.',
        details: error,
        retryable: true,
        timestamp,
      };
    }

    // Authentication errors
    if (
      message.includes('unauthorized') ||
      message.includes('authentication') ||
      message.includes('invalid pin') ||
      message.includes('session expired')
    ) {
      return {
        type: ErrorType.AUTHENTICATION,
        code: 'AUTH_ERROR',
        message: 'Authentication failed. Please try again.',
        details: error,
        retryable: false,
        timestamp,
      };
    }

    // Wallet errors
    if (
      message.includes('insufficient') ||
      message.includes('balance') ||
      message.includes('invoice') ||
      message.includes('payment')
    ) {
      return {
        type: ErrorType.WALLET,
        code: 'WALLET_ERROR',
        message: error.message,
        details: error,
        retryable: false,
        timestamp,
      };
    }

    // Validation errors
    if (
      message.includes('invalid') ||
      message.includes('validation') ||
      message.includes('required')
    ) {
      return {
        type: ErrorType.VALIDATION,
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: error,
        retryable: false,
        timestamp,
      };
    }
  }

  // HTTP response errors (from axios or fetch)
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { status?: number; data?: { message?: string } } }).response;
    const status = response?.status;
    const message = response?.data?.message || 'An error occurred';

    if (status === 401 || status === 403) {
      return {
        type: ErrorType.AUTHENTICATION,
        code: `HTTP_${status}`,
        message: 'Session expired. Please unlock your wallet again.',
        details: error,
        retryable: false,
        timestamp,
      };
    }

    if (status && status >= 500) {
      return {
        type: ErrorType.NETWORK,
        code: `HTTP_${status}`,
        message: 'Server error. Please try again later.',
        details: error,
        retryable: true,
        timestamp,
      };
    }

    if (status === 400 || status === 422) {
      return {
        type: ErrorType.VALIDATION,
        code: `HTTP_${status}`,
        message,
        details: error,
        retryable: false,
        timestamp,
      };
    }
  }

  // Default unknown error
  return {
    type: ErrorType.UNKNOWN,
    code: 'UNKNOWN_ERROR',
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
    details: error,
    retryable: true,
    timestamp,
  };
}

// =============================================================================
// Error Handling Service Class
// =============================================================================

class ErrorHandlingService {
  private errorHandlers: Map<ErrorType, ErrorHandler[]> = new Map();
  private globalHandlers: ErrorHandler[] = [];
  private errorLog: AppError[] = [];
  private maxLogSize: number = 100;

  // ========================================
  // Error Registration
  // ========================================

  registerHandler(type: ErrorType, handler: ErrorHandler): () => void {
    const handlers = this.errorHandlers.get(type) || [];
    handlers.push(handler);
    this.errorHandlers.set(type, handlers);

    return () => {
      const idx = handlers.indexOf(handler);
      if (idx > -1) handlers.splice(idx, 1);
    };
  }

  registerGlobalHandler(handler: ErrorHandler): () => void {
    this.globalHandlers.push(handler);

    return () => {
      const idx = this.globalHandlers.indexOf(handler);
      if (idx > -1) this.globalHandlers.splice(idx, 1);
    };
  }

  // ========================================
  // Error Handling
  // ========================================

  async handleError(error: unknown): Promise<AppError> {
    const appError = classifyError(error);
    
    // Log error
    this.logError(appError);

    // Call type-specific handlers
    const typeHandlers = this.errorHandlers.get(appError.type) || [];
    for (const handler of typeHandlers) {
      await handler(appError);
    }

    // Call global handlers
    for (const handler of this.globalHandlers) {
      await handler(appError);
    }

    return appError;
  }

  private logError(error: AppError): void {
    console.error(`❌ [Error] ${error.type}:${error.code}`, error.message);
    
    this.errorLog.unshift(error);
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.pop();
    }
  }

  getErrorLog(): AppError[] {
    return [...this.errorLog];
  }

  clearErrorLog(): void {
    this.errorLog = [];
  }

  // ========================================
  // Retry Logic
  // ========================================

  async withRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError: unknown;
    let delay = retryConfig.baseDelayMs;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const appError = classifyError(error);

        // Don't retry non-retryable errors
        if (!appError.retryable) {
          throw error;
        }

        // Log retry attempt
        if (attempt < retryConfig.maxRetries) {
          console.log(`🔄 [Error] Retry attempt ${attempt + 1}/${retryConfig.maxRetries} after ${delay}ms`);
          await this.delay(delay);
          delay = Math.min(delay * retryConfig.backoffMultiplier, retryConfig.maxDelayMs);
        }
      }
    }

    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => global.setTimeout(resolve, ms));
  }

  // ========================================
  // User Alerts
  // ========================================

  showErrorAlert(
    error: AppError,
    options: {
      onRetry?: () => void;
      onDismiss?: () => void;
    } = {}
  ): void {
    const buttons: AlertButton[] = [];

    if (error.retryable && options.onRetry) {
      buttons.push({
        text: 'Retry',
        onPress: options.onRetry,
      });
    }

    buttons.push({
      text: 'OK',
      onPress: options.onDismiss,
      style: 'cancel',
    });

    Alert.alert(
      this.getErrorTitle(error.type),
      error.message,
      buttons
    );
  }

  private getErrorTitle(type: ErrorType): string {
    switch (type) {
      case ErrorType.NETWORK:
        return 'Connection Error';
      case ErrorType.WALLET:
        return 'Wallet Error';
      case ErrorType.VALIDATION:
        return 'Validation Error';
      case ErrorType.AUTHENTICATION:
        return 'Authentication Error';
      case ErrorType.PERMISSION:
        return 'Permission Denied';
      case ErrorType.STORAGE:
        return 'Storage Error';
      default:
        return 'Error';
    }
  }

  // ========================================
  // Quick Error Helpers
  // ========================================

  showNetworkError(onRetry?: () => void): void {
    this.showErrorAlert(
      {
        type: ErrorType.NETWORK,
        code: 'NETWORK_QUICK',
        message: 'Unable to connect. Please check your internet connection.',
        retryable: true,
        timestamp: Date.now(),
      },
      { onRetry }
    );
  }

  showValidationError(message: string): void {
    this.showErrorAlert({
      type: ErrorType.VALIDATION,
      code: 'VALIDATION_QUICK',
      message,
      retryable: false,
      timestamp: Date.now(),
    });
  }

  showWalletError(message: string, onRetry?: () => void): void {
    this.showErrorAlert(
      {
        type: ErrorType.WALLET,
        code: 'WALLET_QUICK',
        message,
        retryable: !!onRetry,
        timestamp: Date.now(),
      },
      { onRetry }
    );
  }
}

// =============================================================================
// Export Singleton
// =============================================================================

export const errorHandlingService = new ErrorHandlingService();
