import apiClient from '@/lib/axios';
import { Study } from '@/types/study';
import { PaginatedResponse } from '@/types/api';

export interface CreateStudyPayload {
  title: string;
  protocolNumber: string;
  phase?: string;
  principalInvestigator?: string;
  targetParticipants?: number;
}

export const studiesApi = {
  async getStudies(params?: { page?: number; limit?: number; status?: string }): Promise<PaginatedResponse<Study> | Study[]> {
    const response = await apiClient.get<PaginatedResponse<Study> | Study[]>('/studies', { params });
    return response.data;
  },

  async getStudyById(id: string): Promise<Study> {
    const response = await apiClient.get<Study>(`/studies/${id}`);
    return response.data;
  },

  async createStudy(payload: CreateStudyPayload): Promise<Study> {
    const response = await apiClient.post<Study>('/studies', payload);
    return response.data;
  },
};

