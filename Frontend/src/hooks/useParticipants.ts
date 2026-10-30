import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { participantsApi } from '@/api/participantsApi';
import { ApiErrorDetail } from '@/lib/axios';

export const PARTICIPANTS_KEYS = {
  all: ['participants'] as const,
  metrics: () => ['participants', 'metrics'] as const,
  list: (params?: Record<string, unknown>) => ['participants', 'list', params] as const,
};

export function useParticipantMetrics() {
  const query = useQuery({
    queryKey: PARTICIPANTS_KEYS.metrics(),
    queryFn: () => participantsApi.getMetrics(),
    retry: 1,
  });

  const error = query.error as ApiErrorDetail | null;

  return {
    ...query,
    errorDetail: error,
    isUnavailable: Boolean(error?.isUnavailable),
  };
}

export function useParticipantsList(params?: {
  studyId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const query = useQuery({
    queryKey: PARTICIPANTS_KEYS.list(params),
    queryFn: () => participantsApi.getParticipants(params),
    retry: 1,
  });

  const error = query.error as ApiErrorDetail | null;

  return {
    ...query,
    errorDetail: error,
    isUnavailable: Boolean(error?.isUnavailable),
  };
}

export function useEnrollParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      studyId: string;
      identifierCode: string;
      cohort?: string;
      siteLocation?: string;
      externalMrn?: string;
      contactEmail?: string;
      contactPhone?: string;
    }) => participantsApi.enrollParticipant(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PARTICIPANTS_KEYS.all });
    },
  });
}

export function useWithdrawParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ participantId, reason }: { participantId: string; reason: string }) =>
      participantsApi.withdrawParticipant(participantId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PARTICIPANTS_KEYS.all });
    },
  });
}

