import { useDashboardMetrics } from '@/hooks/useDashboard';
import { MetricCard } from '@/components/shared/MetricCard';
import { 
  Users, 
  UserCheck, 
  ClipboardCheck, 
  Clock, 
  TrendingUp, 
  RotateCcw 
} from 'lucide-react';
import { StatusState } from '@/components/shared/StatusState';

export function MetricsGrid() {
  const { data: metrics, isLoading, isUnavailable, isError, errorDetail, refetch } = useDashboardMetrics();

  if (isUnavailable) {
    return (
      <StatusState
        type="unavailable"
        title="Metrics Service Unavailable"
        description="The backend metrics endpoint (`/dashboard/metrics`) is not responding or not implemented."
        endpoint="/dashboard/metrics"
        action={{
          label: 'Retry Fetching Metrics',
          onClick: () => refetch(),
        }}
      />
    );
  }

  if (isError) {
    return (
      <StatusState
        type="error"
        title="Error Loading Metrics"
        description={errorDetail?.message || 'Failed to retrieve aggregate metrics from backend.'}
        action={{
          label: 'Retry',
          onClick: () => refetch(),
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Research & Participant Metrics
        </h3>
        {metrics?.lastUpdated && (
          <span className="text-[11px] text-slate-400">
            Updated: {new Date(metrics.lastUpdated).toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Enrolled Participants */}
        <MetricCard
          title="Total Enrolled"
          value={metrics?.totalParticipants}
          subtitle="Registered study subjects"
          icon={Users}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-50"
          isLoading={isLoading}
          onRetry={() => refetch()}
        />

        {/* Metric 2: Active Participants */}
        <MetricCard
          title="Active Participants"
          value={metrics?.activeParticipants}
          subtitle="Currently active in protocols"
          icon={UserCheck}
          iconColor="text-emerald-600"
          iconBgColor="bg-emerald-50"
          isLoading={isLoading}
          onRetry={() => refetch()}
        />

        {/* Metric 3: Questionnaires Completed */}
        <MetricCard
          title="Questionnaires Completed"
          value={metrics?.questionnairesCompleted}
          subtitle="Validated survey submissions"
          icon={ClipboardCheck}
          iconColor="text-indigo-600"
          iconBgColor="bg-indigo-50"
          isLoading={isLoading}
          onRetry={() => refetch()}
        />

        {/* Metric 4: Questionnaires Pending / Completion Rate */}
        <MetricCard
          title="Pending Responses"
          value={metrics?.questionnairesPending}
          subtitle={
            metrics?.dataCollectionRate !== undefined
              ? `${metrics.dataCollectionRate}% completion rate`
              : 'Awaiting subject completion'
          }
          icon={metrics?.dataCollectionRate !== undefined ? TrendingUp : Clock}
          iconColor="text-amber-600"
          iconBgColor="bg-amber-50"
          isLoading={isLoading}
          onRetry={() => refetch()}
        />
      </div>
    </div>
  );
}

