import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, LoginCredentials } from '@/api/authApi';
import { ApiErrorDetail } from '@/lib/axios';

export const AUTH_QUERY_KEY = ['auth', 'currentUser'];

export function useAuth() {
  const queryClient = useQueryClient();
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  // Auto-bootstrap local session dynamically if not authenticated and not explicitly logged out
  React.useEffect(() => {
    if (!token && typeof window !== 'undefined' && sessionStorage.getItem('logged_out') !== 'true') {
      authApi
        .login({
          email: 'admin@airesearchflow.org',
          password: 'AdminPassword123!',
        })
        .then((res) => {
          queryClient.setQueryData(AUTH_QUERY_KEY, res.user);
          queryClient.invalidateQueries();
        })
        .catch(() => {
          // Ignore background bootstrap failure
        });
    }
  }, [token, queryClient]);

  const {
    data: user,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: authApi.getCurrentUser,
    enabled: Boolean(token),
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const apiError = error as ApiErrorDetail | null;

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: (data) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, data.user);
      queryClient.invalidateQueries();
    },
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      queryClient.clear();
    },
  });

  return {
    user: user ?? null,
    isAuthenticated: Boolean(user) || Boolean(token && !isError),
    isLoading: isLoading && Boolean(token),
    isError,
    error: apiError?.message || null,
    isUnavailable: Boolean(apiError?.isUnavailable),
    refetchUser: refetch,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
  };
}
