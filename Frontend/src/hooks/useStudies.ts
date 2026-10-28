import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studiesApi, CreateStudyPayload } from '@/api/studiesApi';
import { ApiErrorDetail } from '@/lib/axios';

export const STUDIES_KEYS = {
  all: ['studies'] as const,
  list: (params?: Record<string, unknown>) => ['studies', 'list', params] as const,
  detail: (id: string) => ['studies', 'detail', id] as const,
};

export function useStudiesList(params?: { page?: number; limit?: number; status?: string }) {
  const query = useQuery({
    queryKey: STUDIES_KEYS.list(params),
    queryFn: () => studiesApi.getStudies(params),
    retry: 1,
  });

  const error = query.error as ApiErrorDetail | null;

  return {
    ...query,
    errorDetail: error,
    isUnavailable: Boolean(error?.isUnavailable),
  };
}

export function useStudyDetail(id: string) {
  const query = useQuery({
    queryKey: STUDIES_KEYS.detail(id),
    queryFn: () => studiesApi.getStudyById(id),
    enabled: Boolean(id),
    retry: 1,
  });

  const error = query.error as ApiErrorDetail | null;

  return {
    ...query,
    errorDetail: error,
    isUnavailable: Boolean(error?.isUnavailable),
  };
}

export function useCreateStudy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateStudyPayload) => studiesApi.createStudy(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STUDIES_KEYS.all });
    },
  });
}

