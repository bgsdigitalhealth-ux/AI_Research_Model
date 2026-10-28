import { useStudyStatusSummary } from '@/hooks/useDashboard';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusState } from '@/components/shared/StatusState';
import { 
  FileEdit, 
  Search, 
  Activity, 
  Database, 
  LineChart, 
  CheckCircle2, 
  Archive 
} from 'lucide-react';
import { StudyStatus } from '@/types/study';

const STATUS_ICONS: Record<StudyStatus, { icon: React.ElementType; color: string; bg: string }> = {
  draft: { icon: FileEdit, color: 'text-slate-600', bg: 'bg-slate-100' },
  protocol_review: { icon: Search, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  active: { icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
  data_collection: { icon: Database, color: 'text-amber-600', bg: 'bg-amber-50' },
  analysis: { icon: LineChart, color: 'text-purple-600', bg: 'bg-purple-50' },
  completed: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  archived: { icon: Archive, color: 'text-slate-500', bg: 'bg-slate-50' },
};

export function StudyStatusSummarySection() {
  const { data: summary, isLoading, isUnavailable, isError, errorDetail, refetch } = useStudyStatusSummary();

  if (isUnavailable) {
    return (
      <StatusState
        type="unavailable"
        title="Study Status Summary Unavailable"
        description="Backend endpoint (`/dashboard/study-status-summary`) is currently unreachable."
        endpoint="/dashboard/study-status-summary"
        action={{
          label: 'Retry Fetching Summary',
          onClick: () => refetch(),
        }}
      />
    );
  }

  if (isError) {
    return (
      <StatusState
        type="error"
        title="Error Loading Status Summary"
        description={errorDetail?.message || 'Failed to retrieve study status summary.'}
        action={{
          label: 'Retry',
          onClick: () => refetch(),
        }}
      />
    );
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Study Status Summary</h3>
            <p className="text-xs text-slate-500">Live breakdown across research lifecycles</p>
          </div>
          {summary && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-semibold text-slate-700">
              <span>Total:</span>
              <span className="text-blue-600 font-bold">{summary.total}</span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="p-3 border rounded-lg space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-7 w-10" />
              </div>
            ))}
          </div>
        ) : !summary || !summary.byStatus || summary.byStatus.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No study status breakdown records returned by the backend.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {summary.byStatus.map((item) => {
              const meta = STATUS_ICONS[item.status] || {
                icon: Activity,
                color: 'text-slate-600',
                bg: 'bg-slate-100',
              };
              const Icon = meta.icon;

              return (
                <div
                  key={item.status}
                  className="rounded-lg border border-slate-100 bg-slate-50/50 p-3.5 space-y-2 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600 truncate">
                      {item.label}
                    </span>
                    <div className={`p-1.5 rounded-md ${meta.bg} ${meta.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="text-xl font-bold text-slate-900">
                    {item.count}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

