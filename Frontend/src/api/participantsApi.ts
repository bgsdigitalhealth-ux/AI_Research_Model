import apiClient from '@/lib/axios';
import { Participant, ParticipantMetrics } from '@/types/participant';

export const participantsApi = {
  async getMetrics(): Promise<ParticipantMetrics> {
    const response = await apiClient.get<ParticipantMetrics>('/participants/metrics');
    return response.data;
  },

  async getParticipants(params?: {
    studyId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<Participant[]> {
    const response = await apiClient.get<Participant[]>('/participants', { params });
    return response.data;
  },

  async enrollParticipant(payload: {
    studyId: string;
    identifierCode: string;
    cohort?: string;
    siteLocation?: string;
    externalMrn?: string;
    contactEmail?: string;
    contactPhone?: string;
  }): Promise<Participant> {
    const response = await apiClient.post<Participant>('/participants', payload);
    return response.data;
  },

  async withdrawParticipant(participantId: string, reason: string): Promise<Participant> {
    const response = await apiClient.post<Participant>(`/participants/${participantId}/withdraw`, {
      reason,
    });
    return response.data;
  },
};
