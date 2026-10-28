import { useQuery } from '@tanstack/react-query';
import { dataCollectionApi } from '@/api/dataCollectionApi';
import { offlineDb } from '@/lib/indexedDb';
import { ApiErrorDetail } from '@/lib/axios';

export const DATA_COLLECTION_KEYS = {
  publishedSurveys: ['data-collection', 'published-surveys'] as const,
  consent: (id: string) => ['data-collection', 'consent', id] as const,
  monitoring: ['data-collection', 'monitoring'] as const,
};

export function usePublishedSurveys() {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const query = useQuery({
    queryKey: DATA_COLLECTION_KEYS.publishedSurveys,
    queryFn: async () => {
      if (!isOnline) {
        // Retrieve offline cached published questionnaires from IndexedDB
        const cached = await offlineDb.getCachedQuestionnaires();
        return cached.map((c) => c.questionnaire);
      }
      try {
        return await dataCollectionApi.getPublishedSurveys();
      } catch (err) {
        // Fallback to local cache if network call fails
        const cached = await offlineDb.getCachedQuestionnaires();
        if (cached.length > 0) {
          return cached.map((c) => c.questionnaire);
        }
        throw err;
      }
    },
    retry: 1,
  });

  const error = query.error as ApiErrorDetail | null;

  return {
    ...query,
    errorDetail: error,
    isUnavailable: Boolean(error?.isUnavailable),
  };
}

export function useSurveyConsent(questionnaireId: string) {
  const query = useQuery({
    queryKey: DATA_COLLECTION_KEYS.consent(questionnaireId),
    queryFn: () => dataCollectionApi.getSurveyConsent(questionnaireId),
    enabled: Boolean(questionnaireId),
    retry: 1,
  });

  const error = query.error as ApiErrorDetail | null;

  return {
    ...query,
    errorDetail: error,
    isUnavailable: Boolean(error?.isUnavailable),
  };
}

export function useCollectionMonitoring() {
  const query = useQuery({
    queryKey: DATA_COLLECTION_KEYS.monitoring,
    queryFn: dataCollectionApi.getMonitoringMetrics,
    retry: 1,
  });

  const error = query.error as ApiErrorDetail | null;

  return {
    ...query,
    errorDetail: error,
    isUnavailable: Boolean(error?.isUnavailable),
  };
}

