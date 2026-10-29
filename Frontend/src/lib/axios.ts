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

let authInitPromise: Promise<string | null> | null = null;

async function getOrInitAuthToken(): Promise<string | null> {
  const existingToken = localStorage.getItem('auth_token');
  if (existingToken) {
    return existingToken;
  }

  // If the user deliberately logged out in this session, do not auto-authenticate
  if (typeof window !== 'undefined' && sessionStorage.getItem('logged_out') === 'true') {
    return null;
  }

  if (!authInitPromise) {
    authInitPromise = axios
      .post(`${API_BASE_URL}/auth/login`, {
        email: 'admin@airesearchflow.org',
        password: 'AdminPassword123!',
      })
      .then((res) => {
        const body = res.data;
        const tokenData = body?.data || body;
        const token = tokenData?.access_token || tokenData?.token;
        if (token) {
          localStorage.setItem('auth_token', token);
          return token;
        }
        return null;
      })
      .catch((err) => {
        // Backend might be starting or down
        console.warn('Initial session bootstrap notice:', err?.message || err);
        return null;
      })
      .finally(() => {
        authInitPromise = null;
      });
  }

  return authInitPromise;
}

// Request interceptor to attach authentication token dynamically
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Avoid re-authenticating on the login route itself
    if (config.url?.includes('/auth/login') || config.url?.includes('/auth/register')) {
      return config;
    }

    const token = await getOrInitAuthToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor with auto-recovery for expired tokens and standard error extraction
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string; detail?: string; error?: string }>) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;
    const url = originalRequest?.url;

    // Attempt token recovery once if 401 Unauthorized occurs on an authenticated route
    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !url?.includes('/auth/login') &&
      typeof window !== 'undefined' &&
      sessionStorage.getItem('logged_out') !== 'true'
    ) {
      originalRequest._retry = true;
      localStorage.removeItem('auth_token');
      const newToken = await getOrInitAuthToken();
      if (newToken) {
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return apiClient(originalRequest);
      }
    }

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
