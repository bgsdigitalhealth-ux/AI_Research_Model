import apiClient from '@/lib/axios';

export interface ProductConfig {
  appName: string;
  version: string;
  features: {
    aiAssistant: boolean;
    realTimeNotifications: boolean;
    offlineMode: boolean;
    advancedAnalytics: boolean;
  };
}

export const configApi = {
  /**
   * Fetches the server product configuration & active feature flags.
   */
  async getConfig(): Promise<ProductConfig> {
    const response = await apiClient.get<ProductConfig>('/config');
    return response.data;
  },
};

