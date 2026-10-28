import apiClient from '@/lib/axios';
import { ResearchReport, ExportJob, ExportOptions } from '@/types/reports';

export const reportsApi = {
  /**
   * Retrieves compiled research reports and manuscripts.
   */
  async getReports(params?: { studyId?: string; type?: string; status?: string }): Promise<ResearchReport[]> {
    const response = await apiClient.get<ResearchReport[]>('/reports', { params });
    return response.data;
  },

  /**
   * Retrieves single report structure and preview sections.
   */
  async getReportById(id: string): Promise<ResearchReport> {
    const response = await apiClient.get<ResearchReport>(`/reports/${id}`);
    return response.data;
  },

  /**
   * Creates or drafts a new report compiling analysis runs and protocol metadata.
   */
  async createReport(payload: Partial<ResearchReport>): Promise<ResearchReport> {
    const response = await apiClient.post<ResearchReport>('/reports', payload);
    return response.data;
  },

  /**
   * Updates an existing report draft.
   */
  async updateReport(id: string, payload: Partial<ResearchReport>): Promise<ResearchReport> {
    const response = await apiClient.put<ResearchReport>(`/reports/${id}`, payload);
    return response.data;
  },

  /**
   * Retrieves all export jobs and governance audit logs.
   */
  async getExportJobs(params?: { studyId?: string; format?: string }): Promise<ExportJob[]> {
    const response = await apiClient.get<ExportJob[]>('/exports/jobs', { params });
    return response.data;
  },

  /**
   * Requests a new data or report export package (CSV, XLSX, PDF, DOCX).
   */
  async requestExport(options: ExportOptions): Promise<ExportJob> {
    const response = await apiClient.post<ExportJob>('/exports/jobs', options);
    return response.data;
  },

  /**
   * Retrieves the current processing status of an export job.
   */
  async getExportJobById(id: string): Promise<ExportJob> {
    const response = await apiClient.get<ExportJob>(`/exports/jobs/${id}`);
    return response.data;
  },

  /**
   * Initiates download of the ready export package.
   */
  async downloadExport(jobId: string): Promise<Blob> {
    const response = await apiClient.get(`/exports/jobs/${jobId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

