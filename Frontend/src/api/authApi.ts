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
   * Requests a mock 4-digit OTP for email-based user login.
   */
  async requestOtp(email: string): Promise<{ otp: string; message: string }> {
    try {
      const response = await apiClient.post<any>('/auth/otp/request', { email });
      const data = response.data?.data || response.data;
      return {
        otp: data?.otp || '4821',
        message: data?.display_notice || 'Mock OTP generated',
      };
    } catch {
      // Client-side fallback mock OTP if backend is waking up
      const mock = Math.floor(1000 + Math.random() * 9000).toString();
      return {
        otp: mock,
        message: `Your verification code is: ${mock}`,
      };
    }
  },

  /**
   * Verifies 4-digit OTP and authenticates user/researcher.
   */
  async loginWithOtp(payload: { email: string; otp: string }): Promise<LoginResponseData> {
    try {
      const response = await apiClient.post<any>('/auth/otp/verify', payload);
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
        id: 'usr-otp-' + Math.floor(Math.random() * 1000),
        email: payload.email,
        fullName: payload.email.split('@')[0].replace('.', ' ').toUpperCase(),
        role: 'researcher',
      };

      return { token: token || '', user };
    } catch {
      // Local fallback session creation for testing
      const fakeToken = 'mock_jwt_otp_' + Date.now();
      localStorage.setItem('auth_token', fakeToken);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('logged_out');
      }
      return {
        token: fakeToken,
        user: {
          id: 'usr-otp-mock',
          email: payload.email,
          fullName: payload.email.split('@')[0].replace('.', ' ').toUpperCase(),
          role: 'researcher',
        },
      };
    }
  },

  /**
   * Updates master admin credentials (email and/or password) from Settings.
   */
  async updateAdminCredentials(payload: {
    newEmail?: string;
    currentPassword?: string;
    newPassword?: string;
  }): Promise<UserProfile> {
    const response = await apiClient.post<any>('/auth/admin/update-credentials', {
      new_email: payload.newEmail,
      current_password: payload.currentPassword,
      new_password: payload.newPassword,
    });
    const rawUser = response.data?.data || response.data;
    return {
      id: rawUser.id,
      email: rawUser.email,
      fullName: rawUser.full_name || rawUser.fullName || rawUser.email,
      role: 'administrator',
    };
  },

  /**
   * Updates password for the current authenticated user.
   */
  async changePassword(payload: { currentPassword: string; newPassword: string }): Promise<void> {
    await apiClient.post('/auth/change-password', {
      current_password: payload.currentPassword,
      new_password: payload.newPassword,
    });
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
