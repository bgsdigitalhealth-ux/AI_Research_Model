import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { protocolsApi } from '@/api/protocolsApi';
import { ApiErrorDetail } from '@/lib/axios';
import {
  ExtractedFieldStatus,
  StudyMethodAnalysisConfiguration,
} from '@/types/protocol';

export const PROTOCOL_KEYS = {
  all: ['protocols'] as const,
  list: (params?: Record<string, unknown>) => ['protocols', 'list', params] as const,
  detail: (id: string) => ['protocols', 'detail', id] as const,
  extraction: (id: string) => ['protocols', 'extraction', id] as const,
  configuration: (id: string) => ['protocols', 'configuration', id] as const,
  versions: (id: string) => ['protocols', 'versions', id] as const,
};

export function useProtocolsList(params?: { status?: string; search?: string }) {
  const query = useQuery({
    queryKey: PROTOCOL_KEYS.list(params),
    queryFn: () => protocolsApi.getProtocols(params),
    retry: 1,
  });

  const error = query.error as ApiErrorDetail | null;

  return {
    ...query,
    errorDetail: error,
    isUnavailable: Boolean(error?.isUnavailable),
  };
}

export function useProtocolDetail(id: string) {
  const query = useQuery({
    queryKey: PROTOCOL_KEYS.detail(id),
    queryFn: () => protocolsApi.getProtocolById(id),
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

export function useProtocolExtraction(protocolId: string) {
  const query = useQuery({
    queryKey: PROTOCOL_KEYS.extraction(protocolId),
    queryFn: () => protocolsApi.getExtraction(protocolId),
    enabled: Boolean(protocolId),
    retry: 1,
    // Only poll while backend reports that extraction is actively queued or processing
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'processing' || status === 'queued') {
        return 3000;
      }
      return false;
    },
  });

  const error = query.error as ApiErrorDetail | null;

  return {
    ...query,
    errorDetail: error,
    isUnavailable: Boolean(error?.isUnavailable),
  };
}

export function useTriggerExtraction(protocolId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => protocolsApi.triggerExtraction(protocolId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROTOCOL_KEYS.extraction(protocolId) });
      queryClient.invalidateQueries({ queryKey: PROTOCOL_KEYS.detail(protocolId) });
    },
  });
}

export function useUpdateFieldVerification(protocolId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      fieldKey,
      status,
      verifiedValue,
      reviewerNotes,
      flagReason,
    }: {
      fieldKey: string;
      status: ExtractedFieldStatus;
      verifiedValue?: unknown;
      reviewerNotes?: string;
      flagReason?: string;
    }) =>
      protocolsApi.updateFieldVerification(protocolId, fieldKey, {
        status,
        verifiedValue,
        reviewerNotes,
        flagReason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROTOCOL_KEYS.extraction(protocolId) });
    },
  });
}

export function useApproveProtocolExtraction(protocolId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { notes?: string }) =>
      protocolsApi.approveProtocolExtraction(protocolId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROTOCOL_KEYS.extraction(protocolId) });
      queryClient.invalidateQueries({ queryKey: PROTOCOL_KEYS.detail(protocolId) });
      queryClient.invalidateQueries({ queryKey: PROTOCOL_KEYS.all });
    },
  });
}

export function useStudyConfiguration(protocolId: string) {
  const query = useQuery({
    queryKey: PROTOCOL_KEYS.configuration(protocolId),
    queryFn: () => protocolsApi.getStudyConfiguration(protocolId),
    enabled: Boolean(protocolId),
    retry: 1,
  });

  const error = query.error as ApiErrorDetail | null;

  return {
    ...query,
    errorDetail: error,
    isUnavailable: Boolean(error?.isUnavailable),
  };
}

export function useSaveStudyConfiguration(protocolId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: Partial<StudyMethodAnalysisConfiguration>) =>
      protocolsApi.saveStudyConfiguration(protocolId, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROTOCOL_KEYS.configuration(protocolId) });
    },
  });
}

export function useProtocolVersions(protocolId: string) {
  const query = useQuery({
    queryKey: PROTOCOL_KEYS.versions(protocolId),
    queryFn: () => protocolsApi.getProtocolVersions(protocolId),
    enabled: Boolean(protocolId),
    retry: 1,
  });

  const error = query.error as ApiErrorDetail | null;

  return {
    ...query,
    errorDetail: error,
    isUnavailable: Boolean(error?.isUnavailable),
  };
}

