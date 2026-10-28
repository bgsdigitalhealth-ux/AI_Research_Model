import { useQuery } from '@tanstack/react-query';
import { configApi, ProductConfig } from '@/api/configApi';

export function useProductConfig() {
  const envAiEnabled = import.meta.env.VITE_ENABLE_AI_ASSISTANT === 'true';

  const query = useQuery<ProductConfig>({
    queryKey: ['config', 'product'],
    queryFn: configApi.getConfig,
    retry: false,
    staleTime: 10 * 60 * 1000,
  });

  // Feature is enabled only if explicitly configured in backend config OR via environment variable
  const isAiAssistantEnabled = query.data?.features?.aiAssistant ?? envAiEnabled;

  return {
    config: query.data,
    isAiAssistantEnabled,
    isLoading: query.isLoading,
  };
}

