import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collaboratorsApi } from '@/api/collaboratorsApi';
import { CollaboratorInvitePayload } from '@/types/collaborator';
import { ApiErrorDetail } from '@/lib/axios';

export const COLLABORATORS_KEYS = {
  all: ['collaborators'] as const,
  metrics: () => ['collaborators', 'metrics'] as const,
  list: (params?: Record<string, unknown>) => ['collaborators', 'list', params] as const,
};

export function useCollaboratorMetrics() {
  const query = useQuery({
    queryKey: COLLABORATORS_KEYS.metrics(),
    queryFn: () => collaboratorsApi.getMetrics(),
    retry: 1,
  });

  const error = query.error as ApiErrorDetail | null;

  return {
    ...query,
    errorDetail: error,
    isUnavailable: Boolean(error?.isUnavailable),
  };
}

export function useCollaboratorsList(params?: {
  studyId?: string;
  role?: string;
  search?: string;
}) {
  const query = useQuery({
    queryKey: COLLABORATORS_KEYS.list(params),
    queryFn: () => collaboratorsApi.getCollaborators(params),
    retry: 1,
  });

  const error = query.error as ApiErrorDetail | null;

  return {
    ...query,
    errorDetail: error,
    isUnavailable: Boolean(error?.isUnavailable),
  };
}

export function useInviteCollaborator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CollaboratorInvitePayload) =>
      collaboratorsApi.inviteCollaborator(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COLLABORATORS_KEYS.all });
    },
  });
}

export function useRemoveCollaborator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => collaboratorsApi.removeCollaborator(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COLLABORATORS_KEYS.all });
    },
  });
}

