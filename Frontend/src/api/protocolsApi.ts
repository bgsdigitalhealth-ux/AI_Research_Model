import apiClient from '@/lib/axios';
import {
  Protocol,
  ProtocolExtractionData,
  ExtractedField,
  ExtractedFieldStatus,
  StudyMethodAnalysisConfiguration,
  ProtocolVersionItem,
  ProtocolExtractionStatus,
} from '@/types/protocol';

export interface UploadProtocolOptions {
  onProgress?: (progressEvent: { loaded: number; total?: number; percentage: number }) => void;
  signal?: AbortSignal;
}


export interface ProtocolRagVerifyPayload {
  study_title: string;
  description: string;
  protocol_type?: string;
  protocol_text?: string;
  file_name?: string;
  file_size_bytes?: number;
}

export interface VerificationCheckItem {
  section: string;
  status: 'Matched' | 'Partially Matched' | 'Missing';
  icon: 'check' | 'warning';
  message: string;
}

export interface ProtocolIssueItem {
  section: string;
  issue: string;
  severity: 'warning' | 'danger';
  suggestion: string;
}

export interface TestCaseAnalysisData {
  objective: string;
  methodology: string;
  study_design: string;
  population: string;
  endpoints: {
    primary: string;
    secondary: string;
  };
  analysis_plan: string;
}

export interface ProtocolGeneratedQuestion {
  id: string;
  text: string;
  choices: Array<{ code: string; label: string; score: number }>;
  explanation?: string;
  remark?: string;
}

export interface ProtocolRagVerifyResponse {
  similarity_match: {
    percentage: number;
    label: string;
    matched_admin_protocol: string;
    matched_admin_protocol_id: string;
    disease_area?: string;
  };
  verification_summary: VerificationCheckItem[];
  issues: ProtocolIssueItem[];
  test_case_analysis: TestCaseAnalysisData;
  generated_questions: ProtocolGeneratedQuestion[];
}

export interface CompleteStudyFlowPayload {
  study_title: string;
  description: string;
  protocol_type?: string;
  file_name?: string;
  file_size_bytes?: number;
  test_case_analysis?: Partial<TestCaseAnalysisData>;
  generated_questions?: ProtocolGeneratedQuestion[];
}

export interface CompleteStudyFlowResponse {
  success: boolean;
  study_id: string;
  protocol_id: string;
  questionnaire_id?: string;
  study_title: string;
  protocol_number: string;
  message: string;
}

export const protocolsApi = {
  /**
   * Retrieves list of protocols dynamically from backend.
   */
  async getProtocols(params?: { status?: string; search?: string }): Promise<Protocol[]> {
    const response = await apiClient.get<Protocol[]>('/protocols', { params });
    return response.data;
  },

  /**
   * Retrieves single protocol metadata by ID.
   */
  async getProtocolById(id: string): Promise<Protocol> {
    const response = await apiClient.get<Protocol>(`/protocols/${id}`);
    return response.data;
  },

  /**
   * Uploads a research protocol file (PDF or DOCX) to the backend.
   * Tracks real network progress via Axios onUploadProgress.
   */
  async uploadProtocol(
    formData: FormData,
    options?: UploadProtocolOptions
  ): Promise<Protocol> {
    const response = await apiClient.post<Protocol>('/protocols/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      signal: options?.signal,
      onUploadProgress: (progressEvent) => {
        if (options?.onProgress && progressEvent.total) {
          const percentage = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          options.onProgress({
            loaded: progressEvent.loaded,
            total: progressEvent.total,
            percentage,
          });
        }
      },
    });
    return response.data;
  },

  /**
   * Retrieves AI extraction status and extracted fields.
   */
  async getExtraction(protocolId: string): Promise<ProtocolExtractionData> {
    const response = await apiClient.get<ProtocolExtractionData>(`/protocols/${protocolId}/extraction`);
    return response.data;
  },

  /**
   * Triggers an AI extraction job on the server for the uploaded protocol.
   */
  async triggerExtraction(protocolId: string): Promise<{ status: ProtocolExtractionStatus; message?: string }> {
    const response = await apiClient.post<{ status: ProtocolExtractionStatus; message?: string }>(
      `/protocols/${protocolId}/extract`
    );
    return response.data;
  },

  /**
   * Updates verification status for a specific extracted field (accept, edit, reject, flag).
   */
  async updateFieldVerification(
    protocolId: string,
    fieldKey: string,
    payload: {
      status: ExtractedFieldStatus;
      verifiedValue?: unknown;
      reviewerNotes?: string;
      flagReason?: string;
    }
  ): Promise<ExtractedField> {
    const response = await apiClient.patch<ExtractedField>(
      `/protocols/${protocolId}/extraction/fields/${fieldKey}`,
      payload
    );
    return response.data;
  },

  /**
   * Finalizes researcher verification and approves protocol metadata.
   */
  async approveProtocolExtraction(
    protocolId: string,
    payload: { notes?: string }
  ): Promise<Protocol> {
    const response = await apiClient.post<Protocol>(
      `/protocols/${protocolId}/approve-extraction`,
      payload
    );
    return response.data;
  },

  /**
   * Retrieves study methods and statistical analysis configuration.
   */
  async getStudyConfiguration(protocolId: string): Promise<StudyMethodAnalysisConfiguration> {
    const response = await apiClient.get<StudyMethodAnalysisConfiguration>(
      `/protocols/${protocolId}/study-configuration`
    );
    return response.data;
  },

  /**
   * Saves or updates study methods and statistical analysis configuration.
   */
  async saveStudyConfiguration(
    protocolId: string,
    config: Partial<StudyMethodAnalysisConfiguration>
  ): Promise<StudyMethodAnalysisConfiguration> {
    const response = await apiClient.put<StudyMethodAnalysisConfiguration>(
      `/protocols/${protocolId}/study-configuration`,
      config
    );
    return response.data;
  },

  /**
   * Retrieves protocol document version audit history.
   */
  async getProtocolVersions(protocolId: string): Promise<ProtocolVersionItem[]> {
    const response = await apiClient.get<ProtocolVersionItem[]>(
      `/protocols/${protocolId}/versions`
    );
    return response.data;
  },
  /**
   * Performs semantic RAG verification against standard Admin protocols.
   */
  async verifyProtocolRag(payload: ProtocolRagVerifyPayload): Promise<ProtocolRagVerifyResponse> {
    const response = await apiClient.post<ProtocolRagVerifyResponse>('/protocols/rag-verify', payload);
    return response.data;
  },

  /**
   * Completes multi-step study creation, protocol linkage, and question generation.
   */
  async completeStudyFlow(payload: CompleteStudyFlowPayload): Promise<CompleteStudyFlowResponse> {
    const response = await apiClient.post<CompleteStudyFlowResponse>('/protocols/complete-study-flow', payload);
    return response.data;
  },
};
