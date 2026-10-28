import apiClient from '@/lib/axios';
import { 
  DashboardMetrics, 
  StudyStatusSummary, 
  Study, 
  WorkflowProgressStep 
} from '@/types/study';

export const dashboardApi = {
  /**
   * Fetches aggregate research dashboard metrics.
   * Does NOT fabricate default values.
   */
  async getMetrics(): Promise<DashboardMetrics> {
    const response = await apiClient.get<DashboardMetrics>('/dashboard/metrics');
    return response.data;
  },

  /**
   * Fetches the breakdown count of studies grouped by their status.
   */
  async getStudyStatusSummary(): Promise<StudyStatusSummary> {
    const response = await apiClient.get<StudyStatusSummary>('/dashboard/study-status-summary');
    return response.data;
  },

  /**
   * Fetches recent studies list for the current investigator/user.
   */
  async getRecentStudies(limit = 5): Promise<Study[]> {
    const response = await apiClient.get<Study[]>('/dashboard/recent-studies', {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Fetches current research workflow milestone progress.
   */
  async getWorkflowProgress(): Promise<WorkflowProgressStep[]> {
    const response = await apiClient.get<WorkflowProgressStep[]>('/dashboard/workflow-progress');
    return response.data;
  },
};

