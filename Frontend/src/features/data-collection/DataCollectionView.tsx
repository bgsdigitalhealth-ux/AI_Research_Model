import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dataCollectionApi } from '@/api/dataCollectionApi';
import { Link, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { usePublishedSurveys } from '@/hooks/useDataCollection';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { offlineDb } from '@/lib/indexedDb';
import { StatusState } from '@/components/shared/StatusState';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import {
  Database,
  Wifi,
  WifiOff,
  RefreshCw,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  HardDrive,
  BarChart2,
  Shield,
  Layers,
  Trash2,
  Lock
} from 'lucide-react';
import { CachedOfflineQuestionnaire } from '@/types/dataCollection';

export function DataCollectionView() {
  const navigate = useNavigate();
  const { isOnline, pendingCount, failedCount, synchronizedCount, conflictCount, isSyncing, triggerSync } =
    useOfflineSync();

  const { data: publishedSurveys, isLoading, isUnavailable, isError, errorDetail, refetch } =
    usePublishedSurveys();

  const [cachedSurveys, setCachedSurveys] = useState<CachedOfflineQuestionnaire[]>([]);

  const loadCached = async () => {
    try {
      const items = await offlineDb.getCachedQuestionnaires();
      setCachedSurveys(items);
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    loadCached();
  }, []);

  const { data: responsesList, isLoading: loadingResponses, refetch: refetchResponses } = useQuery({
    queryKey: ['data-collection', 'responses'],
    queryFn: () => dataCollectionApi.getResponses({ limit: 50 }),
    refetchInterval: 10000,
  });

  const totalUnsynced = pendingCount + failedCount;

  return (
    <PageContainer
      title="Field Data Collection & Offline Sync"
      description="Collect participant survey responses in field environments with automatic IndexedDB offline persistence and server synchronization."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Data Collection', isCurrent: true },
      ]}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/data-collection/monitoring">
            <Button variant="outline" size="sm" className="gap-1.5">
              <BarChart2 className="h-4 w-4 text-blue-600" />
              <span>Monitoring Dashboard</span>
            </Button>
          </Link>

          <Link to="/data-collection/queue">
            <Button
              variant={totalUnsynced > 0 ? 'default' : 'outline'}
              size="sm"
              className="gap-1.5"
            >
              <Database className="h-4 w-4" />
              <span>Offline Queue ({totalUnsynced})</span>
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Network & Offline Status Banner */}
        <div
          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
            isOnline
              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
              : 'bg-amber-50/70 border-amber-300 text-amber-950'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-lg ${
                isOnline ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white animate-pulse'
              }`}
            >
              {isOnline ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold">
                  {isOnline ? 'System Online (Direct API Connected)' : 'System in Offline Mode'}
                </h4>
                <Badge variant={isOnline ? 'success' : 'warning'} className="text-[10px]">
                  {isOnline ? 'Connected' : 'Local Storage Active'}
                </Badge>
              </div>
              <p className="text-xs opacity-90 mt-0.5">
                {isOnline
                  ? 'Responses can be submitted directly or synchronized from local queue.'
                  : 'No internet connection. Responses are validated locally and queued in IndexedDB.'}
              </p>
            </div>
          </div>

          {isOnline && totalUnsynced > 0 && (
            <Button
              size="sm"
              onClick={triggerSync}
              disabled={isSyncing}
              className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Synchronizing...' : `Sync Queue (${totalUnsynced})`}</span>
            </Button>
          )}
        </div>

        {/* Sync Queue Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Pending Upload</span>
              <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
              <p className="text-[11px] text-slate-500">Stored in local queue</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Failed Retries</span>
              <p className="text-2xl font-bold text-rose-600">{failedCount}</p>
              <p className="text-[11px] text-slate-500">Available for manual retry</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Synchronized</span>
              <p className="text-2xl font-bold text-emerald-600">{synchronizedCount}</p>
              <p className="text-[11px] text-slate-500">Server acknowledged</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Cached Offline</span>
              <p className="text-2xl font-bold text-blue-600">{cachedSurveys.length}</p>
              <p className="text-[11px] text-slate-500">Survey definitions stored</p>
            </CardContent>
          </Card>
        </div>

        {/* Published Surveys Available for Intake */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Authorized Published Surveys
              </CardTitle>
              <p className="text-xs text-slate-500">
                Ready for participant informed consent and data intake
              </p>
            </div>
            <Link to="/data-collection/surveys">
              <Button variant="ghost" size="sm" className="text-xs text-blue-600 gap-1">
                <span>View All Published</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>

          <CardContent className="p-6">
            {isUnavailable && cachedSurveys.length === 0 ? (
              <StatusState
                type="unavailable"
                title="Data Collection Service Offline"
                description="The data collection endpoint (/data-collection/published-surveys) is unavailable, and no published surveys are cached offline on this device."
                endpoint="/data-collection/published-surveys"
                action={{
                  label: 'Retry Fetching Surveys',
                  onClick: () => refetch(),
                }}
              />
            ) : isError && cachedSurveys.length === 0 ? (
              <StatusState
                type="error"
                title="Failed to Load Published Surveys"
                description={errorDetail?.message || 'Error occurred while loading survey instruments.'}
                action={{
                  label: 'Retry',
                  onClick: () => refetch(),
                }}
              />
            ) : isLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : !publishedSurveys || publishedSurveys.length === 0 ? (
              <StatusState
                type="empty"
                title="No Published Surveys Available"
                description="There are no published, locked questionnaires available for field participant intake. Publish a validated questionnaire from the builder first."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {publishedSurveys.slice(0, 4).map((survey) => {
                  const isCached = cachedSurveys.some((c) => c.id === survey.id);

                  return (
                    <div
                      key={survey.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-3 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-slate-900 leading-snug">
                            {survey.title}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Badge variant="outline" className="font-mono text-[10px]">
                              v{survey.version}
                            </Badge>
                            <span>{survey.questions?.length || 0} Questions</span>
                            {isCached && (
                              <Badge variant="success" className="text-[10px] gap-1">
                                <HardDrive className="h-3 w-3" />
                                <span>Cached Offline</span>
                              </Badge>
                            )}
                          </div>
                        </div>

                        <Link to={`/surveys/${survey.id}/consent`}>
                          <Button size="sm" className="text-xs gap-1.5">
                            <span>Start Intake</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>

                      {survey.description && (
                        <p className="text-xs text-slate-600 line-clamp-2">
                          {survey.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submitted Questionnaire Responses in Supabase Data Collection */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-slate-900">
                  Recorded Participant Submissions
                </CardTitle>
                <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                  {responsesList ? `${responsesList.length} In Database` : 'Syncing'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Authoritative research responses collected and stored in Supabase PostgreSQL
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchResponses()}
              className="text-xs gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh Records</span>
            </Button>
          </CardHeader>

          <CardContent className="p-6">
            {loadingResponses ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
            ) : !responsesList || responsesList.length === 0 ? (
              <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 space-y-2">
                <Database className="h-8 w-8 text-slate-400 mx-auto" />
                <h4 className="text-sm font-semibold text-slate-700">No Responses Submitted Yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Submit a questionnaire from the Preview simulation or field survey intake to view live recorded answers and scores here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/80">
                      <th className="py-2.5 px-3 font-semibold">Confirmation ID</th>
                      <th className="py-2.5 px-3 font-semibold">Participant Code</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold">Answers Count</th>
                      <th className="py-2.5 px-3 font-semibold">Sync Source</th>
                      <th className="py-2.5 px-3 font-semibold">Submitted At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {responsesList.map((resp: any) => (
                      <tr key={resp.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3 font-mono font-medium text-slate-900">
                          {resp.confirmation_id || resp.confirmationId || resp.id?.slice(0, 8)}
                        </td>
                        <td className="py-3 px-3 font-medium text-blue-700">
                          {resp.participant_identifier || resp.participantIdentifier || 'Anonymous'}
                        </td>
                        <td className="py-3 px-3">
                          <Badge
                            variant={resp.status === 'completed' ? 'success' : 'outline'}
                            className="text-[10px] uppercase font-semibold tracking-wider"
                          >
                            {resp.status || 'completed'}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {resp.answers ? resp.answers.length : '-'} answers recorded
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {resp.sync_source || 'online'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                          {resp.server_received_at ? formatDate(resp.server_received_at) : 'Just now'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Local Security & Data Retention Advisory */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
          <div className="flex items-center gap-2 text-slate-800 font-bold">
            <Shield className="h-4 w-4 text-blue-600" />
            <span>Local Storage & Compliance Notice</span>
          </div>
          <p className="leading-relaxed">
            Local survey drafts and queued submissions are preserved using the browser's <strong>IndexedDB</strong> store to safeguard research data during field connectivity drops. 
            IndexedDB storage is isolated to this origin but depends on host device security. Ensure you synchronise all pending submissions before device handoff or clearing browser data.
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
