import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { questionnairesApi } from '@/api/questionnairesApi';
import { ApiErrorDetail } from '@/lib/axios';
import {
  Questionnaire,
  AiGenerateQuestionnairePayload,
} from '@/types/questionnaire';

export const QUESTIONNAIRE_KEYS = {
  all: ['questionnaires'] as const,
  list: (params?: Record<string, unknown>) => ['questionnaires', 'list', params] as const,
  detail: (id: string) => ['questionnaires', 'detail', id] as const,
  versions: (id: string) => ['questionnaires', 'versions', id] as const,
  mappings: (id: string) => ['questionnaires', 'mappings', id] as const,
};

export function useQuestionnairesList(params?: { status?: string; search?: string; studyId?: string }) {
  const query = useQuery({
    queryKey: QUESTIONNAIRE_KEYS.list(params),
    queryFn: () => questionnairesApi.getQuestionnaires(params),
    retry: 1,
  });

  const error = query.error as ApiErrorDetail | null;

  return {
    ...query,
    errorDetail: error,
    isUnavailable: Boolean(error?.isUnavailable),
  };
}

export function useQuestionnaireDetail(id: string) {
  const query = useQuery({
    queryKey: QUESTIONNAIRE_KEYS.detail(id),
    queryFn: () => questionnairesApi.getQuestionnaireById(id),
    enabled: Boolean(id) && id !== 'new',
    retry: 1,
  });

  const error = query.error as ApiErrorDetail | null;

  return {
    ...query,
    errorDetail: error,
    isUnavailable: Boolean(error?.isUnavailable),
  };
}

export function useQuestionnaireVersions(id: string) {
  const query = useQuery({
    queryKey: QUESTIONNAIRE_KEYS.versions(id),
    queryFn: () => questionnairesApi.getQuestionnaireVersions(id),
    enabled: Boolean(id) && id !== 'new',
    retry: 1,
  });

  const error = query.error as ApiErrorDetail | null;

  return {
    ...query,
    errorDetail: error,
    isUnavailable: Boolean(error?.isUnavailable),
  };
}

export function useQuestionnaireMappings(id: string) {
  const query = useQuery({
    queryKey: QUESTIONNAIRE_KEYS.mappings(id),
    queryFn: () => questionnairesApi.getQuestionnaireMappings(id),
    enabled: Boolean(id) && id !== 'new',
    retry: 1,
  });

  const error = query.error as ApiErrorDetail | null;

  return {
    ...query,
    errorDetail: error,
    isUnavailable: Boolean(error?.isUnavailable),
  };
}

export function useCreateQuestionnaire() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Partial<Questionnaire>) => questionnairesApi.createQuestionnaire(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUESTIONNAIRE_KEYS.all });
    },
  });
}

export function useUpdateQuestionnaire(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Partial<Questionnaire>) => questionnairesApi.updateQuestionnaire(id, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUESTIONNAIRE_KEYS.detail(id), updated);
      queryClient.invalidateQueries({ queryKey: QUESTIONNAIRE_KEYS.all });
    },
  });
}

export function useDeleteQuestionnaire() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => questionnairesApi.deleteQuestionnaire(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUESTIONNAIRE_KEYS.all });
    },
  });
}

export function useGenerateAiQuestionnaire() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AiGenerateQuestionnairePayload) =>
      questionnairesApi.generateAiQuestionnaire(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUESTIONNAIRE_KEYS.all });
    },
  });
}

export function useSubmitForReview(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => questionnairesApi.submitForReview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUESTIONNAIRE_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: QUESTIONNAIRE_KEYS.all });
    },
  });
}

export function useApproveQuestionnaire(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notes?: string) => questionnairesApi.approveQuestionnaire(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUESTIONNAIRE_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: QUESTIONNAIRE_KEYS.all });
    },
  });
}

export function usePublishQuestionnaire(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (changeSummary?: string) => questionnairesApi.publishQuestionnaire(id, changeSummary),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUESTIONNAIRE_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: QUESTIONNAIRE_KEYS.all });
    },
  });
}

export function useCreateNewVersion(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => questionnairesApi.createNewVersion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUESTIONNAIRE_KEYS.all });
    },
  });
}

