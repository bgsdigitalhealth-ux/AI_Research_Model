import apiClient from '@/lib/axios';
import { UserProfile } from '@/types/auth';

export const authApi = {
  /**
   * Fetches the authenticated user profile.
   * Only returns data if a real backend authentication session exists.
   */
  async getCurrentUser(): Promise<UserProfile> {
    const response = await apiClient.get<UserProfile>('/auth/me');
    return response.data;
  },

  /**
   * Submits credentials to authenticating backend endpoint.
   */
  async login(credentials: { email: string; password: string }): Promise<{ token: string; user: UserProfile }> {
    const response = await apiClient.post<{ token: string; user: UserProfile }>('/auth/login', credentials);
    if (response.data?.token) {
      localStorage.setItem('auth_token', response.data.token);
    }
    return response.data;
  },

  /**
   * Logs out user and destroys backend session.
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      localStorage.removeItem('auth_token');
    }
  },
};

