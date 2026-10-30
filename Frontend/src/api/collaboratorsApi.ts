import apiClient from '@/lib/axios';
import {
  Collaborator,
  CollaboratorMetrics,
  CollaboratorInvitePayload,
} from '@/types/collaborator';

export const collaboratorsApi = {
  async getMetrics(): Promise<CollaboratorMetrics> {
    const response = await apiClient.get<CollaboratorMetrics>('/collaborators/metrics');
    return response.data;
  },

  async getCollaborators(params?: {
    studyId?: string;
    role?: string;
    search?: string;
  }): Promise<Collaborator[]> {
    const response = await apiClient.get<Collaborator[]>('/collaborators', { params });
    return response.data;
  },

  async inviteCollaborator(payload: CollaboratorInvitePayload): Promise<Collaborator> {
    const response = await apiClient.post<Collaborator>('/collaborators', payload);
    return response.data;
  },

  async removeCollaborator(id: string): Promise<void> {
    await apiClient.delete(`/collaborators/${id}`);
  },
};
