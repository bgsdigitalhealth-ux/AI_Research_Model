import apiClient from '@/lib/axios';
import { UserProfile } from '@/types/auth';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponseData {
  token: string;
  user: UserProfile;
}

export const authApi = {
  /**
   * Fetches the authenticated user profile.
   * Extracts data from the backend's StandardResponse.
   */
  async getCurrentUser(): Promise<UserProfile> {
    const response = await apiClient.get<any>('/auth/me');
    const rawUser = response.data?.data || response.data;
    if (!rawUser || (!rawUser.id && !rawUser.email)) {
      throw new Error('User profile not found');
    }
    return {
      id: rawUser.id,
      email: rawUser.email,
      fullName: rawUser.full_name || rawUser.fullName || rawUser.email,
      role: (rawUser.global_role?.name || rawUser.role || 'researcher').toLowerCase(),
      institution: rawUser.organization?.name || rawUser.institution,
      department: rawUser.department,
      avatarUrl: rawUser.avatar_url || rawUser.avatarUrl,
      createdAt: rawUser.created_at || rawUser.createdAt,
    };
  },

  /**
   * Submits credentials to authenticating backend endpoint.
   * Handles backend TokenResponse format and extracts access_token.
   */
  async login(credentials: LoginCredentials): Promise<LoginResponseData> {
    const response = await apiClient.post<any>('/auth/login', credentials);
    const body = response.data;
    const tokenData = body?.data || body;
    const token = tokenData?.access_token || tokenData?.token;
    const rawUser = tokenData?.user;

    if (token) {
      localStorage.setItem('auth_token', token);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('logged_out');
      }
    }

    const user: UserProfile = rawUser ? {
      id: rawUser.id,
      email: rawUser.email,
      fullName: rawUser.full_name || rawUser.fullName || rawUser.email,
      role: (rawUser.global_role?.name || rawUser.role || 'researcher').toLowerCase(),
      institution: rawUser.organization?.name || rawUser.institution,
      department: rawUser.department,
      avatarUrl: rawUser.avatar_url || rawUser.avatarUrl,
      createdAt: rawUser.created_at || rawUser.createdAt,
    } : {
      id: 'current-user',
      email: credentials.email,
      fullName: credentials.email.split('@')[0],
      role: 'administrator',
    };

    return { token: token || '', user };
  },

  /**
   * Logs out user and destroys backend session.
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore network errors during logout
    } finally {
      localStorage.removeItem('auth_token');
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('logged_out', 'true');
      }
    }
  },
};
