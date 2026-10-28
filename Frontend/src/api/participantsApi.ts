import apiClient from '@/lib/axios';
import { ParticipantMetrics } from '@/types/participant';

export const participantsApi = {
  async getMetrics(): Promise<ParticipantMetrics> {
    const response = await apiClient.get<ParticipantMetrics>('/participants/metrics');
    return response.data;
  },
};

