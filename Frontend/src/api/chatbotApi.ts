import apiClient from '@/lib/axios';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  intent?: string;
  routedAgent?: string;
  agentTrace?: Array<{
    step: number;
    agent: string;
    action: string;
    timestamp?: string;
  }>;
  citations?: Array<{
    citation_index: number;
    document_title: string;
    source: string;
    section: string;
    similarity_score: number;
    snippet: string;
    type?: string;
  }>;
  followUpSuggestions?: string[];
  confidenceScore?: number;
  targetEntities?: string[];
}

export interface ChatbotQueryPayload {
  message: string;
  study_id?: string | null;
  history?: Array<{ role: string; content: string }>;
  attached_snippet?: string | null;
}

export interface ChatbotQueryResponse {
  response: string;
  intent: string;
  routed_agent: string;
  agent_trace: Array<{
    step: number;
    agent: string;
    action: string;
    timestamp?: string;
  }>;
  citations: Array<{
    citation_index: number;
    document_title: string;
    source: string;
    section: string;
    similarity_score: number;
    snippet: string;
    type?: string;
  }>;
  follow_up_suggestions: string[];
  confidence_score: number;
  target_entities: string[];
}

export interface ChatbotStatusResponse {
  pinecone: {
    configured: boolean;
    index_name: string;
    namespace: string;
    status: string;
  };
  huggingface?: {
    configured: boolean;
    model: string;
    embedding_model: string;
    status: string;
  };
  langgraph: {
    available: boolean;
    architecture: string;
    agents: string[];
  };
  llm: {
    provider: string;
    huggingface_embeddings: string;
    reasoning_mode: string;
    status: string;
  };
  architecture?: {
    data_sources: string[];
    ingestion_layer: string[];
    rag_engine: string[];
    llm_layer: string[];
    tech_stack: string[];
  };
  features: string[];
}

export const chatbotApi = {
  async query(payload: ChatbotQueryPayload): Promise<ChatbotQueryResponse> {
    const response = await apiClient.post<{ data: ChatbotQueryResponse }>('/chatbot/query', payload);
    return response.data.data;
  },

  async getStatus(): Promise<ChatbotStatusResponse> {
    const response = await apiClient.get<{ data: ChatbotStatusResponse }>('/chatbot/status');
    return response.data.data;
  },

  async configureHuggingFace(apiKey: string, model?: string): Promise<any> {
    const response = await apiClient.post<{ data: any }>('/chatbot/configure-huggingface', {
      api_key: apiKey,
      model,
    });
    return response.data.data;
  },

  async uploadSnippet(file?: File, snippetText?: string): Promise<{ fileName: string; snippet: string; characterCount: number }> {
    const formData = new FormData();
    if (file) formData.append('file', file);
    if (snippetText) formData.append('snippet_text', snippetText);

    const response = await apiClient.post<{ data: { fileName: string; snippet: string; characterCount: number } }>(
      '/chatbot/upload-snippet',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data.data;
  },
};

