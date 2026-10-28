import apiClient from '@/lib/axios';
import {
  Questionnaire,
  QuestionnaireMetrics,
  AiGenerateQuestionnairePayload,
  QuestionnaireVersionItem,
  ObjectiveOutcomeMapping,
} from '@/types/questionnaire';

export const questionnairesApi = {
  /**
   * Retrieves aggregate questionnaire metrics.
   */
  async getMetrics(): Promise<QuestionnaireMetrics> {
    const response = await apiClient.get<QuestionnaireMetrics>('/questionnaires/metrics');
    return response.data;
  },

  /**
   * Retrieves list of questionnaires dynamically from the backend.
   */
  async getQuestionnaires(params?: { status?: string; search?: string; studyId?: string }): Promise<Questionnaire[]> {
    const response = await apiClient.get<Questionnaire[]>('/questionnaires', { params });
    return response.data;
  },

  /**
   * Retrieves single questionnaire schema and question list by ID.
   */
  async getQuestionnaireById(id: string): Promise<Questionnaire> {
    const response = await apiClient.get<Questionnaire>(`/questionnaires/${id}`);
    return response.data;
  },

  /**
   * Creates a new blank or researcher-defined questionnaire draft.
   */
  async createQuestionnaire(payload: Partial<Questionnaire>): Promise<Questionnaire> {
    const response = await apiClient.post<Questionnaire>('/questionnaires', payload);
    return response.data;
  },

  /**
   * Updates questionnaire draft schema, sections, and questions.
   */
  async updateQuestionnaire(id: string, payload: Partial<Questionnaire>): Promise<Questionnaire> {
    const response = await apiClient.put<Questionnaire>(`/questionnaires/${id}`, payload);
    return response.data;
  },

  /**
   * Deletes a draft questionnaire.
   */
  async deleteQuestionnaire(id: string): Promise<void> {
    await apiClient.delete(`/questionnaires/${id}`);
  },

  /**
   * Invokes backend AI generation endpoint to synthesize a candidate questionnaire.
   * Result is returned as a draft requiring researcher review and verification.
   */
  async generateAiQuestionnaire(payload: AiGenerateQuestionnairePayload): Promise<Questionnaire> {
    const response = await apiClient.post<Questionnaire>('/questionnaires/generate', payload);
    return response.data;
  },

  /**
   * Submits questionnaire draft for peer or investigator review.
   */
  async submitForReview(id: string): Promise<Questionnaire> {
    const response = await apiClient.post<Questionnaire>(`/questionnaires/${id}/submit-review`);
    return response.data;
  },

  /**
   * Approves questionnaire metadata and structure.
   */
  async approveQuestionnaire(id: string, notes?: string): Promise<Questionnaire> {
    const response = await apiClient.post<Questionnaire>(`/questionnaires/${id}/approve`, { notes });
    return response.data;
  },

  /**
   * Publishes approved questionnaire, locking this version as immutable.
   */
  async publishQuestionnaire(id: string, changeSummary?: string): Promise<Questionnaire> {
    const response = await apiClient.post<Questionnaire>(`/questionnaires/${id}/publish`, { changeSummary });
    return response.data;
  },

  /**
   * Branches a published questionnaire into a new editable draft version (e.g. v1.0 -> v1.1 or v2.0).
   */
  async createNewVersion(id: string): Promise<Questionnaire> {
    const response = await apiClient.post<Questionnaire>(`/questionnaires/${id}/new-version`);
    return response.data;
  },

  /**
   * Retrieves audit version history for a questionnaire.
   */
  async getQuestionnaireVersions(id: string): Promise<QuestionnaireVersionItem[]> {
    const response = await apiClient.get<QuestionnaireVersionItem[]>(`/questionnaires/${id}/versions`);
    return response.data;
  },

  /**
   * Retrieves objective-to-outcome-to-question coverage mapping data.
   */
  async getQuestionnaireMappings(id: string): Promise<ObjectiveOutcomeMapping[]> {
    const response = await apiClient.get<ObjectiveOutcomeMapping[]>(`/questionnaires/${id}/mappings`);
    return response.data;
  },
};
