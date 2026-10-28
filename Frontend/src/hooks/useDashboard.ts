import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/dashboardApi';
import { ApiErrorDetail } from '@/lib/axios';

export const DASHBOARD_KEYS = {
  metrics: ['dashboard', 'metrics'] as const,
  statusSummary: ['dashboard', 'status-summary'] as const,
  recentStudies: ['dashboard', 'recent-studies'] as const,
  workflow: ['dashboard', 'workflow-progress'] as const,
};

export function useDashboardMetrics() {
  const query = useQuery({
    queryKey: DASHBOARD_KEYS.metrics,
    queryFn: dashboardApi.getMetrics,
    retry: 1,
    staleTime: 60 * 1000,
  });

  const error = query.error as ApiErrorDetail | null;

  return {
    ...query,
    errorDetail: error,
    isUnavailable: Boolean(error?.isUnavailable),
  };
}

export function useStudyStatusSummary() {
  const query = useQuery({
    queryKey: DASHBOARD_KEYS.statusSummary,
    queryFn: dashboardApi.getStudyStatusSummary,
    retry: 1,
    staleTime: 60 * 1000,
  });

  const error = query.error as ApiErrorDetail | null;

  return {
    ...query,
    errorDetail: error,
    isUnavailable: Boolean(error?.isUnavailable),
  };
}

export function useRecentStudies(limit = 5) {
  const query = useQuery({
    queryKey: [...DASHBOARD_KEYS.recentStudies, limit],
    queryFn: () => dashboardApi.getRecentStudies(limit),
    retry: 1,
    staleTime: 60 * 1000,
  });

  const error = query.error as ApiErrorDetail | null;

  return {
    ...query,
    errorDetail: error,
    isUnavailable: Boolean(error?.isUnavailable),
  };
}

export function useWorkflowProgress() {
  const query = useQuery({
    queryKey: DASHBOARD_KEYS.workflow,
    queryFn: dashboardApi.getWorkflowProgress,
    retry: 1,
    staleTime: 60 * 1000,
  });

  const error = query.error as ApiErrorDetail | null;

  return {
    ...query,
    errorDetail: error,
    isUnavailable: Boolean(error?.isUnavailable),
  };
}

