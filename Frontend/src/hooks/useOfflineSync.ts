import { useState, useEffect, useCallback } from 'react';
import { offlineDb } from '@/lib/indexedDb';
import { dataCollectionApi } from '@/api/dataCollectionApi';
import {
  QueuedSubmission,
  CachedOfflineQuestionnaire,
  SubmissionSyncStatus,
} from '@/types/dataCollection';
import { Questionnaire } from '@/types/questionnaire';
import { useToast } from '@/components/ui/use-toast';

export function useOfflineSync() {
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [queuedSubmissions, setQueuedSubmissions] = useState<QueuedSubmission[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncResult, setLastSyncResult] = useState<{
    syncedCount: number;
    failedCount: number;
    conflictCount: number;
  } | null>(null);

  // Load submissions from IndexedDB
  const reloadQueue = useCallback(async () => {
    try {
      const items = await offlineDb.getQueuedSubmissions();
      // Sort newest first
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setQueuedSubmissions(items);
    } catch {
      // IndexedDB load fallback
    }
  }, []);

  // Listen for browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: 'Network Connected',
        description: 'Connection restored. Offline queue ready for synchronization.',
        variant: 'success',
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: 'Working in Offline Mode',
        description: 'Responses will be securely preserved in local IndexedDB.',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    reloadQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast, reloadQueue]);

  // Synchronise a single queued submission
  const syncSubmission = async (submission: QueuedSubmission): Promise<boolean> => {
    try {
      await offlineDb.updateSubmission(submission.id, {
        status: 'synchronizing',
        lastAttemptAt: new Date().toISOString(),
      });

      const ack = await dataCollectionApi.submitResponse(submission);

      // Server confirmed receipt safely!
      await offlineDb.updateSubmission(submission.id, {
        status: 'synchronized',
        serverAcknowledgement: ack,
        errorMessage: undefined,
      });

      return true;
    } catch (err: unknown) {
      const errorMsg = (err as { message?: string })?.message || 'Network transfer failed.';
      const status = (err as { status?: number })?.status;

      // Incompatible version conflict detection
      if (status === 409) {
        await offlineDb.updateSubmission(submission.id, {
          status: 'conflict',
          attempts: submission.attempts + 1,
          errorMessage: 'Conflict: Server published questionnaire version differs from local survey version.',
          conflictDetails: {
            serverVersion: 'Updated on server',
            localVersion: submission.questionnaireVersion,
            message: 'Schema mismatch. Review required before merging.',
          },
        });
      } else {
        await offlineDb.updateSubmission(submission.id, {
          status: 'failed',
          attempts: submission.attempts + 1,
          errorMessage: errorMsg,
        });
      }
      return false;
    }
  };

  // Synchronise all pending or failed submissions
  const triggerSync = async () => {
    if (!isOnline) {
      toast({
        title: 'Device Offline',
        description: 'Cannot synchronise while disconnected from network.',
        variant: 'destructive',
      });
      return;
    }

    const queue = await offlineDb.getQueuedSubmissions();
    const itemsToSync = queue.filter(
      (s) => s.status === 'pending' || s.status === 'failed'
    );

    if (itemsToSync.length === 0) {
      toast({
        title: 'Queue Up to Date',
        description: 'No pending local submissions to synchronise.',
      });
      return;
    }

    setIsSyncing(true);
    let synced = 0;
    let failed = 0;
    let conflicts = 0;

    for (const item of itemsToSync) {
      const success = await syncSubmission(item);
      if (success) {
        synced++;
      } else {
        const refreshed = await offlineDb.getQueuedSubmissions();
        const current = refreshed.find((r) => r.id === item.id);
        if (current?.status === 'conflict') {
          conflicts++;
        } else {
          failed++;
        }
      }
    }

    setIsSyncing(false);
    await reloadQueue();

    setLastSyncResult({ syncedCount: synced, failedCount: failed, conflictCount: conflicts });

    if (synced > 0 && failed === 0 && conflicts === 0) {
      toast({
        title: 'Synchronization Complete',
        description: `Successfully uploaded ${synced} submission(s) to server.`,
        variant: 'success',
      });
    } else {
      toast({
        title: 'Sync Batch Finished',
        description: `${synced} uploaded, ${failed} failed, ${conflicts} conflict(s).`,
        variant: failed > 0 ? 'destructive' : 'default',
      });
    }
  };

  // Cache an authorized published questionnaire definition locally for offline use
  const cacheSurveyOffline = async (
    questionnaire: Questionnaire,
    userId = 'current_user',
    userRole = 'researcher'
  ): Promise<void> => {
    const cachedItem: CachedOfflineQuestionnaire = {
      id: questionnaire.id,
      questionnaire,
      version: questionnaire.version,
      cachedAt: new Date().toISOString(),
      cachedByUserId: userId,
      authorizedRole: userRole,
    };
    await offlineDb.saveCachedQuestionnaire(cachedItem);
  };

  // Remove questionnaire from offline cache
  const removeCachedSurvey = async (questionnaireId: string): Promise<void> => {
    await offlineDb.removeCachedQuestionnaire(questionnaireId);
  };

  // Remove a synchronized submission from local storage
  const deleteSyncedSubmission = async (id: string): Promise<void> => {
    await offlineDb.removeSubmission(id);
    await reloadQueue();
  };

  const pendingCount = queuedSubmissions.filter((s) => s.status === 'pending').length;
  const failedCount = queuedSubmissions.filter((s) => s.status === 'failed').length;
  const synchronizedCount = queuedSubmissions.filter((s) => s.status === 'synchronized').length;
  const conflictCount = queuedSubmissions.filter((s) => s.status === 'conflict').length;

  return {
    isOnline,
    queuedSubmissions,
    isSyncing,
    pendingCount,
    failedCount,
    synchronizedCount,
    conflictCount,
    lastSyncResult,
    triggerSync,
    syncSubmission,
    cacheSurveyOffline,
    removeCachedSurvey,
    deleteSyncedSubmission,
    reloadQueue,
  };
}

