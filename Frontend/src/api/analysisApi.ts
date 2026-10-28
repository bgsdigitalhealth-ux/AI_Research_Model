import apiClient from '@/lib/axios';
import {
  DatasetSnapshot,
  VariableDefinition,
  AnalysisMethod,
  AnalysisRunConfig,
  AnalysisRun,
  StatisticalResult,
  DataQualityReport,
} from '@/types/analysis';

export const analysisApi = {
  /**
   * Retrieves available datasets and frozen snapshots from the backend.
   */
  async getDatasets(studyId?: string): Promise<DatasetSnapshot[]> {
    const response = await apiClient.get<DatasetSnapshot[]>('/analysis/datasets', {
      params: studyId ? { studyId } : undefined,
    });
    return response.data;
  },

  /**
   * Retrieves specific dataset snapshot metadata.
   */
  async getDatasetById(id: string): Promise<DatasetSnapshot> {
    const response = await apiClient.get<DatasetSnapshot>(`/analysis/datasets/${id}`);
    return response.data;
  },

  /**
   * Retrieves actual variable dictionary with distributions and data types for a dataset.
   */
  async getDatasetVariables(datasetId: string): Promise<VariableDefinition[]> {
    const response = await apiClient.get<VariableDefinition[]>(`/analysis/datasets/${datasetId}/variables`);
    return response.data;
  },

  /**
   * Retrieves supported analysis methods validated against backend capabilities and study SAP.
   */
  async getSupportedMethods(studyId?: string): Promise<AnalysisMethod[]> {
    const response = await apiClient.get<AnalysisMethod[]>('/analysis/methods', {
      params: studyId ? { studyId } : undefined,
    });
    return response.data;
  },

  /**
   * Submits a new statistical analysis run to the backend engine.
   */
  async runAnalysis(config: AnalysisRunConfig): Promise<AnalysisRun> {
    const response = await apiClient.post<AnalysisRun>('/analysis/runs', config);
    return response.data;
  },

  /**
   * Retrieves audit log / list of previous analytical runs.
   */
  async getAnalysisRuns(params?: { studyId?: string; status?: string }): Promise<AnalysisRun[]> {
    const response = await apiClient.get<AnalysisRun[]>('/analysis/runs', { params });
    return response.data;
  },

  /**
   * Retrieves single execution status and progress.
   */
  async getAnalysisRunById(id: string): Promise<AnalysisRun> {
    const response = await apiClient.get<AnalysisRun>(`/analysis/runs/${id}`);
    return response.data;
  },

  /**
   * Retrieves authoritative statistical results, estimates, warnings, and AI interpretation.
   */
  async getAnalysisResults(runId: string): Promise<StatisticalResult> {
    const response = await apiClient.get<StatisticalResult>(`/analysis/runs/${runId}/results`);
    return response.data;
  },

  /**
   * Cancels an ongoing analysis execution run.
   */
  async cancelAnalysisRun(runId: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post<{ success: boolean; message: string }>(`/analysis/runs/${runId}/cancel`);
    return response.data;
  },

  /**
   * Retrieves data quality and missingness report for a dataset snapshot.
   */
  async getDataQualityReport(datasetId: string): Promise<DataQualityReport> {
    const response = await apiClient.get<DataQualityReport>(`/analysis/datasets/${datasetId}/quality`);
    return response.data;
  },
};

