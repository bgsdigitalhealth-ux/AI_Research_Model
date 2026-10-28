import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/authApi';
import { ApiErrorDetail } from '@/lib/axios';

export const AUTH_QUERY_KEY = ['auth', 'currentUser'];

export function useAuth() {
  const queryClient = useQueryClient();
  const token = localStorage.getItem('auth_token');

  const {
    data: user,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: authApi.getCurrentUser,
    // Only attempt if a token is present to avoid spurious calls when not logged in
    enabled: Boolean(token),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const apiError = error as ApiErrorDetail | null;

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, data.user);
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
    isAuthenticated: Boolean(user),
    isLoading,
    isError,
    error: apiError?.message || null,
    isUnavailable: Boolean(apiError?.isUnavailable),
    refetchUser: refetch,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
  };
}

