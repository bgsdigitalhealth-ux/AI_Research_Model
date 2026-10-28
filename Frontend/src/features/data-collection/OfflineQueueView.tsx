import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import {
  Database,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  RotateCcw,
  Eye,
  X,
  AlertTriangle,
  Lock,
  Wifi,
  WifiOff
} from 'lucide-react';
import { QueuedSubmission, SubmissionSyncStatus } from '@/types/dataCollection';

const STATUS_BADGES: Record<
  SubmissionSyncStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' }
> = {
  pending: { label: 'Pending Upload', variant: 'warning' },
  synchronizing: { label: 'Uploading...', variant: 'info' },
  synchronized: { label: 'Synchronized', variant: 'success' },
  failed: { label: 'Upload Failed', variant: 'destructive' },
  conflict: { label: 'Version Conflict', variant: 'secondary' },
};

export function OfflineQueueView() {
  const {
    isOnline,
    queuedSubmissions,
    isSyncing,
    pendingCount,
    failedCount,
    synchronizedCount,
    conflictCount,
    triggerSync,
    syncSubmission,
    deleteSyncedSubmission,
  } = useOfflineSync();

  const [inspectSubmission, setInspectSubmission] = useState<QueuedSubmission | null>(null);

  return (
    <PageContainer
      title="Offline Submission Queue"
      description="Local IndexedDB submission cache. Responses are preserved and uploaded idempotently using cryptographic UUIDs."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Data Collection', path: '/data-collection' },
        { label: 'Offline Queue', isCurrent: true },
      ]}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/data-collection">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
          </Link>

          <Button
            size="sm"
            onClick={triggerSync}
            disabled={!isOnline || isSyncing || (pendingCount === 0 && failedCount === 0)}
            className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Synchronizing...' : 'Sync All Pending'}</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Status Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Pending</span>
              <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
              <p className="text-[11px] text-slate-500">Awaiting connection</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Failed Retries</span>
              <p className="text-2xl font-bold text-rose-600">{failedCount}</p>
              <p className="text-[11px] text-slate-500">Requires retry</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Version Conflicts</span>
              <p className="text-2xl font-bold text-purple-600">{conflictCount}</p>
              <p className="text-[11px] text-slate-500">Review schema</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Server Confirmed</span>
              <p className="text-2xl font-bold text-emerald-600">{synchronizedCount}</p>
              <p className="text-[11px] text-slate-500">Receipt acknowledged</p>
            </CardContent>
          </Card>
        </div>

        {/* Submissions List */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-600" />
              <CardTitle className="text-sm font-bold text-slate-900">
                Queued Records in IndexedDB ({queuedSubmissions.length})
              </CardTitle>
            </div>
            {!isOnline && (
              <Badge variant="warning" className="text-[10px] gap-1">
                <WifiOff className="h-3 w-3" />
                <span>Offline: Uploads paused</span>
              </Badge>
            )}
          </CardHeader>

          <CardContent className="p-0">
            {queuedSubmissions.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-700">Queue is Empty</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  There are no pending local survey records stored in IndexedDB.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-5">Submission UUID / Subject</th>
                      <th className="py-3 px-4">Survey & Version</th>
                      <th className="py-3 px-4">Queued Time</th>
                      <th className="py-3 px-4">Status & Attempts</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {queuedSubmissions.map((sub) => {
                      const statusMeta = STATUS_BADGES[sub.status] || STATUS_BADGES.pending;

                      return (
                        <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-5">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{sub.participantIdentifier}</span>
                            </div>
                            <div className="font-mono text-[10px] text-slate-400 truncate max-w-[220px]">
                              Key: {sub.id}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-800 line-clamp-1">
                              {sub.questionnaireTitle}
                            </div>
                            <Badge variant="outline" className="font-mono text-[10px]">
                              v{sub.questionnaireVersion}
                            </Badge>
                          </td>

                          <td className="py-3.5 px-4 text-slate-500">
                            {formatDate(sub.createdAt)}
                          </td>

                          <td className="py-3.5 px-4 space-y-1">
                            <Badge variant={statusMeta.variant} className="text-[10px]">
                              {statusMeta.label}
                            </Badge>
                            {sub.attempts > 0 && (
                              <div className="text-[10px] text-slate-400">
                                Attempts: {sub.attempts}
                              </div>
                            )}
                            {sub.errorMessage && (
                              <p className="text-[10px] text-rose-600 line-clamp-1" title={sub.errorMessage}>
                                {sub.errorMessage}
                              </p>
                            )}
                          </td>

                          <td className="py-3.5 px-5 text-right space-x-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setInspectSubmission(sub)}
                              className="text-xs text-slate-600 hover:text-blue-600 h-7 px-2"
                              title="Inspect answers & consent"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              <span>View</span>
                            </Button>

                            {sub.status !== 'synchronized' && (
                              <Button
                                type="button"
                                size="sm"
                                disabled={!isOnline || isSyncing}
                                onClick={() => syncSubmission(sub)}
                                className="text-xs h-7 px-2"
                                title="Retry synchronization"
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                <span>Retry</span>
                              </Button>
                            )}

                            {sub.status === 'synchronized' && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteSyncedSubmission(sub.id)}
                                className="text-xs text-slate-400 hover:text-red-600 h-7 px-2"
                                title="Safely remove acknowledged record from local storage"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal: Inspect Submission Data */}
        {inspectSubmission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Queued Submission Inspection</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Subject: {inspectSubmission.participantIdentifier} (v{inspectSubmission.questionnaireVersion})
                  </p>
                </div>
                <button
                  onClick={() => setInspectSubmission(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Conflict details callout if conflict */}
              {inspectSubmission.status === 'conflict' && inspectSubmission.conflictDetails && (
                <div className="p-3 rounded-lg bg-purple-50 text-purple-900 border border-purple-200 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="h-4 w-4 text-purple-700" />
                    <span>Incompatible Version Conflict</span>
                  </div>
                  <p>{inspectSubmission.conflictDetails.message}</p>
                  <p className="text-[11px] font-mono text-purple-800">
                    Local: v{inspectSubmission.conflictDetails.localVersion} vs Server: {inspectSubmission.conflictDetails.serverVersion}
                  </p>
                </div>
              )}

              {/* Answers Dump */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">
                  Captured Survey Answers
                </span>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {JSON.stringify(inspectSubmission.answers, null, 2)}
                </div>
              </div>

              {/* Consent Information */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs space-y-1">
                <span className="font-semibold text-slate-800">Consent Verification:</span>
                <p className="text-slate-600">
                  Consent Record ID: <span className="font-mono">{inspectSubmission.consentRecord.id}</span>
                </p>
                <p className="text-slate-600">
                  Timestamp: {formatDate(inspectSubmission.consentRecord.consentedAt)}
                </p>
              </div>

              <div className="flex justify-end pt-2 border-t">
                <Button size="sm" variant="outline" onClick={() => setInspectSubmission(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

