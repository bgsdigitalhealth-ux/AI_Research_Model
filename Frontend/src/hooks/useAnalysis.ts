import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { analysisApi } from '@/api/analysisApi';
import { AnalysisRunConfig } from '@/types/analysis';

export function useDatasets(studyId?: string) {
  return useQuery({
    queryKey: ['analysis', 'datasets', studyId],
    queryFn: () => analysisApi.getDatasets(studyId),
    retry: 1,
  });
}

export function useDataset(id?: string) {
  return useQuery({
    queryKey: ['analysis', 'dataset', id],
    queryFn: () => {
      if (!id) throw new Error('Dataset ID is required');
      return analysisApi.getDatasetById(id);
    },
    enabled: Boolean(id),
    retry: 1,
  });
}

export function useDatasetVariables(datasetId?: string) {
  return useQuery({
    queryKey: ['analysis', 'variables', datasetId],
    queryFn: () => {
      if (!datasetId) throw new Error('Dataset ID is required');
      return analysisApi.getDatasetVariables(datasetId);
    },
    enabled: Boolean(datasetId),
    retry: 1,
  });
}

export function useSupportedMethods(studyId?: string) {
  return useQuery({
    queryKey: ['analysis', 'methods', studyId],
    queryFn: () => analysisApi.getSupportedMethods(studyId),
    retry: 1,
  });
}

export function useAnalysisRuns(params?: { studyId?: string; status?: string }) {
  return useQuery({
    queryKey: ['analysis', 'runs', params],
    queryFn: () => analysisApi.getAnalysisRuns(params),
    retry: 1,
  });
}

export function useAnalysisRun(id?: string, pollInterval?: number) {
  return useQuery({
    queryKey: ['analysis', 'run', id],
    queryFn: () => {
      if (!id) throw new Error('Run ID is required');
      return analysisApi.getAnalysisRunById(id);
    },
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === 'running' || data.status === 'queued')) {
        return pollInterval || 3000;
      }
      return false;
    },
    retry: 1,
  });
}

export function useAnalysisResults(runId?: string) {
  return useQuery({
    queryKey: ['analysis', 'results', runId],
    queryFn: () => {
      if (!runId) throw new Error('Run ID is required');
      return analysisApi.getAnalysisResults(runId);
    },
    enabled: Boolean(runId),
    retry: 1,
  });
}

export function useDataQualityReport(datasetId?: string) {
  return useQuery({
    queryKey: ['analysis', 'data-quality', datasetId],
    queryFn: () => {
      if (!datasetId) throw new Error('Dataset ID is required');
      return analysisApi.getDataQualityReport(datasetId);
    },
    enabled: Boolean(datasetId),
    retry: 1,
  });
}

export function useRunAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: AnalysisRunConfig) => analysisApi.runAnalysis(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analysis', 'runs'] });
    },
  });
}

export function useCancelAnalysisRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => analysisApi.cancelAnalysisRun(runId),
    onSuccess: (_, runId) => {
      queryClient.invalidateQueries({ queryKey: ['analysis', 'run', runId] });
      queryClient.invalidateQueries({ queryKey: ['analysis', 'runs'] });
    },
  });
}


export function useAnalysisRuntime() {
  return useQuery({
    queryKey: ['analysis', 'runtime'],
    queryFn: () => analysisApi.getAnalysisRuntime(),
    staleTime: 60000,
  });
}
