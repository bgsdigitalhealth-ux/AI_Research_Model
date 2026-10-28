import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const API_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT) || 15000;

export interface ApiErrorDetail {
  message: string;
  code?: string;
  status?: number;
  endpoint?: string;
  isUnavailable?: boolean;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request interceptor to attach authentication token if available
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for consistent error extraction
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; detail?: string; error?: string }>) => {
    const status = error.response?.status;
    const url = error.config?.url;

    let errorMessage = 'An unexpected error occurred.';
    let isUnavailable = false;

    if (!error.response) {
      // Network error, backend server down or connection refused
      isUnavailable = true;
      errorMessage = `Cannot connect to server at ${API_BASE_URL}. The backend service is currently unreachable.`;
    } else if (status === 404) {
      isUnavailable = true;
      errorMessage = `Endpoint '${url}' was not found on the backend service.`;
    } else if (status === 401) {
      errorMessage = 'Session expired or unauthenticated. Please log in.';
    } else if (status === 403) {
      errorMessage = 'Access denied. You do not have permissions for this resource.';
    } else if (status && status >= 500) {
      isUnavailable = true;
      errorMessage = `Backend server error (${status}). Please check backend logs.`;
    } else if (error.response?.data) {
      errorMessage =
        error.response.data.message ||
        error.response.data.detail ||
        error.response.data.error ||
        error.message;
    }

    const apiError: ApiErrorDetail = {
      message: errorMessage,
      code: error.code,
      status,
      endpoint: url,
      isUnavailable,
    };

    return Promise.reject(apiError);
  }
);

export default apiClient;

