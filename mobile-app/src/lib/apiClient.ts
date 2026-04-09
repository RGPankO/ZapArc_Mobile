import axios from 'axios';
import { NetworkConfig } from '../config/network';
import { tokenService } from '../services/tokenService';

const DEBUG = __DEV__; // Only log in development

const baseURL = NetworkConfig.getApiBaseUrl();
if (DEBUG) {
  console.log('[API] Client initialized');
}

export const apiClient = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - adds auth token and logs
apiClient.interceptors.request.use(
  async (config) => {
    const token = await tokenService.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (DEBUG) {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    }
    return config;
  },
  (error) => {
    if (DEBUG) {
      console.log('[API] Request error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Response interceptor - extracts data and handles errors
apiClient.interceptors.response.use(
  (response) => {
    if (DEBUG) {
      console.log(`[API] Response ${response.status} ${response.config?.url || ''}`);
    }
    return response.data?.data ?? response.data;
  },
  (error) => {
    if (DEBUG) {
      console.log('[API] Error:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        url: error.config?.url,
      });
    }
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.error?.message || error.message;
      const code = error.response?.data?.error?.code || 'REQUEST_FAILED';
      return Promise.reject(new ApiError(message, code, error.response?.status || 0));
    }
    return Promise.reject(error);
  }
);

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
