import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/api/notificationsApi';
import { ApiErrorDetail } from '@/lib/axios';

export const NOTIFICATIONS_QUERY_KEY = ['notifications'] as const;

export function useNotifications() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: notificationsApi.getNotifications,
    retry: 1,
    staleTime: 30 * 1000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: notificationsApi.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });

  const error = query.error as ApiErrorDetail | null;

  return {
    ...query,
    errorDetail: error,
    isUnavailable: Boolean(error?.isUnavailable),
    markAsRead: markAsReadMutation.mutate,
  };
}

