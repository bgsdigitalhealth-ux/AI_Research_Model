import { useMutation, useQuery } from '@tanstack/react-query';
import { chatbotApi, ChatbotQueryPayload, ChatbotQueryResponse, ChatbotStatusResponse } from '@/api/chatbotApi';

export const CHATBOT_KEYS = {
  all: ['chatbot'] as const,
  status: () => [...CHATBOT_KEYS.all, 'status'] as const,
};

export function useChatbotStatus() {
  return useQuery<ChatbotStatusResponse>({
    queryKey: CHATBOT_KEYS.status(),
    queryFn: () => chatbotApi.getStatus(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useChatbotQuery() {
  return useMutation<ChatbotQueryResponse, Error, ChatbotQueryPayload>({
    mutationFn: (payload: ChatbotQueryPayload) => chatbotApi.query(payload),
  });
}
