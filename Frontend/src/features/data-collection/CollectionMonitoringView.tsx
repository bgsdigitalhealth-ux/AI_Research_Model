import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { useCollectionMonitoring } from '@/hooks/useDataCollection';
import { StatusState } from '@/components/shared/StatusState';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart2,
  ArrowLeft,
  Users,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Clock,
  TrendingUp,
  Database
} from 'lucide-react';

export function CollectionMonitoringView() {
  const { data: metrics, isLoading, isUnavailable, isError, errorDetail, refetch } =
    useCollectionMonitoring();

  return (
    <PageContainer
      title="Field Intake Monitoring Dashboard"
      description="Real-time surveillance of study participant response intake, online/offline synchronization rates, and protocol adherence."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Data Collection', path: '/data-collection' },
        { label: 'Monitoring', isCurrent: true },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Link to="/data-collection">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              <span>Data Collection Hub</span>
            </Button>
          </Link>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            className="gap-1.5"
            title="Refresh metrics from server"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {isUnavailable ? (
          <StatusState
            type="unavailable"
            title="Collection Monitoring Service Unavailable"
            description="The monitoring metrics endpoint (/data-collection/monitoring) is currently disconnected on the backend."
            endpoint="/data-collection/monitoring"
            action={{
              label: 'Retry Fetching Monitoring Metrics',
              onClick: () => refetch(),
            }}
          />
        ) : isError ? (
          <StatusState
            type="error"
            title="Failed to Load Collection Metrics"
            description={errorDetail?.message || 'Error occurred while loading monitoring metrics.'}
            action={{
              label: 'Retry',
              onClick: () => refetch(),
            }}
          />
        ) : isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : !metrics ? (
          <StatusState
            type="empty"
            title="No Monitoring Metrics Recorded"
            description="The server returned no active collection metrics for this environment."
          />
        ) : (
          <div className="space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="border-slate-200 shadow-xs">
                <CardContent className="p-5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Target</span>
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{metrics.totalTargetResponses}</p>
                  <p className="text-[11px] text-slate-500">Planned subject cohort</p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-xs">
                <CardContent className="p-5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Direct Online</span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">{metrics.completedOnline}</p>
                  <p className="text-[11px] text-slate-500">Submitted directly via API</p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-xs">
                <CardContent className="p-5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Synced From Offline</span>
                    <Database className="h-4 w-4 text-indigo-600" />
                  </div>
                  <p className="text-2xl font-bold text-indigo-600">{metrics.syncedSuccessfully}</p>
                  <p className="text-[11px] text-slate-500">Acknowledged via queue</p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-xs">
                <CardContent className="p-5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Sync Failures</span>
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                  </div>
                  <p className="text-2xl font-bold text-rose-600">{metrics.syncFailed}</p>
                  <p className="text-[11px] text-slate-500">Awaiting retry / resolve</p>
                </CardContent>
              </Card>
            </div>

            {/* Protocol Adherence Card */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="py-4 px-6 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-900">
                  Intake Adherence & Synchronization Integrity
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Data fidelity verified through server receipt logging
                </p>
              </CardHeader>

              <CardContent className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                    <span className="font-semibold text-slate-700">Active Published Instruments</span>
                    <p className="text-xl font-bold text-slate-900">{metrics.activeSurveysCount}</p>
                    <p className="text-slate-500 text-[11px]">Surveys currently active in the field</p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                    <span className="font-semibold text-slate-700">Pending Field Submissions</span>
                    <p className="text-xl font-bold text-amber-600">{metrics.pendingOfflineQueue}</p>
                    <p className="text-slate-500 text-[11px]">Unsynced responses across field devices</p>
                  </div>
                </div>

                {metrics.lastSyncTimestamp && (
                  <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Last server synchronisation cycle: {new Date(metrics.lastSyncTimestamp).toLocaleString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

