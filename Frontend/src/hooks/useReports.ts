import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsApi } from '@/api/reportsApi';
import { ResearchReport, ExportOptions } from '@/types/reports';

export function useReports(params?: { studyId?: string; type?: string; status?: string }) {
  return useQuery({
    queryKey: ['reports', params],
    queryFn: () => reportsApi.getReports(params),
    retry: 1,
  });
}

export function useReport(id?: string, analysisRunId?: string | null) {
  return useQuery({
    queryKey: ['report', id, analysisRunId],
    queryFn: () => {
      if (!id) throw new Error('Report ID is required');
      if (id === 'new') {
        const query = analysisRunId ? `?analysisRunId=${analysisRunId}` : '';
        return reportsApi.getReportById(`new${query}`);
      }
      return reportsApi.getReportById(id);
    },
    enabled: Boolean(id),
    retry: 1,
  });
}

export function useCreateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<ResearchReport>) => reportsApi.createReport(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useUpdateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ResearchReport> }) =>
      reportsApi.updateReport(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['report', id] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useExportJobs(params?: { studyId?: string; format?: string }) {
  return useQuery({
    queryKey: ['exports', 'jobs', params],
    queryFn: () => reportsApi.getExportJobs(params),
    retry: 1,
  });
}

export function useExportJob(id?: string, pollInterval?: number) {
  return useQuery({
    queryKey: ['exports', 'job', id],
    queryFn: () => {
      if (!id) throw new Error('Job ID is required');
      return reportsApi.getExportJobById(id);
    },
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === 'pending' || data.status === 'processing')) {
        return pollInterval || 2500;
      }
      return false;
    },
    retry: 1,
  });
}

export function useRequestExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options: ExportOptions) => reportsApi.requestExport(options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exports', 'jobs'] });
    },
  });
}

