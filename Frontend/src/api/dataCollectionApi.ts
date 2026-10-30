import apiClient from '@/lib/axios';
import { Questionnaire } from '@/types/questionnaire';
import {
  ConsentWordingPayload,
  ConsentRecord,
  CollectionMonitoringMetrics,
  QueuedSubmission,
} from '@/types/dataCollection';

export interface ServerSyncAcknowledgement {
  confirmationId: string;
  receivedAt: string;
  statusCode: number;
}

export interface SyncBatchResult {
  successful: Array<{ submissionId: string; confirmationId: string; receivedAt: string }>;
  conflicts: Array<{ submissionId: string; serverVersion: string; localVersion: string; message: string }>;
  failed: Array<{ submissionId: string; errorMessage: string }>;
}

export const dataCollectionApi = {
  /**
   * Retrieves list of published questionnaires ready for field participant intake.
   */
  async getPublishedSurveys(): Promise<Questionnaire[]> {
    const response = await apiClient.get<Questionnaire[]>('/data-collection/published-surveys');
    return response.data;
  },

  /**
   * Retrieves approved participant information sheet and consent text.
   */
  async getSurveyConsent(questionnaireId: string): Promise<ConsentWordingPayload> {
    const response = await apiClient.get<ConsentWordingPayload>(`/surveys/${questionnaireId}/consent`);
    return response.data;
  },

  /**
   * Records explicit participant informed consent.
   */
  async submitConsent(payload: ConsentRecord): Promise<{ consentId: string; confirmationCode: string }> {
    const response = await apiClient.post<{ consentId: string; confirmationCode: string }>(
      `/surveys/${payload.questionnaireId}/consent`,
      payload
    );
    return response.data;
  },

  /**
   * Submits a single survey response online.
   * Uses submissionId (UUID) as idempotency key to prevent duplicates on retries.
   */
  async submitResponse(submission: QueuedSubmission): Promise<ServerSyncAcknowledgement> {
    const response = await apiClient.post<ServerSyncAcknowledgement>(
      `/surveys/${submission.questionnaireId}/submit`,
      {
        submissionId: submission.id, // Idempotency key
        questionnaireId: submission.questionnaireId,
        questionnaireVersion: submission.questionnaireVersion,
        participantIdentifier: submission.participantIdentifier,
        answers: submission.answers,
        consentRecord: submission.consentRecord,
        submittedAt: submission.createdAt,
      }
    );
    return response.data;
  },

  /**
   * Synchronises an array of queued offline submissions to the backend.
   */
  async syncBatch(submissions: QueuedSubmission[]): Promise<SyncBatchResult> {
    const response = await apiClient.post<SyncBatchResult>('/data-collection/sync', {
      submissions: submissions.map((s) => ({
        submissionId: s.id,
        questionnaireId: s.questionnaireId,
        questionnaireVersion: s.questionnaireVersion,
        participantIdentifier: s.participantIdentifier,
        answers: s.answers,
        consentRecord: s.consentRecord,
        submittedAt: s.createdAt,
      })),
    });
    return response.data;
  },

  /**
   * Retrieves collection monitoring metrics.
   */
  async getMonitoringMetrics(): Promise<CollectionMonitoringMetrics> {
    const response = await apiClient.get<CollectionMonitoringMetrics>('/data-collection/monitoring');
    return response.data;
  },

  /**
   * Retrieves submitted survey responses from backend data collection.
   */
  async getResponses(params?: {
    studyId?: string;
    questionnaireId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const response = await apiClient.get<any[]>('/data-collection/responses', { params });
    return response.data;
  },
};

