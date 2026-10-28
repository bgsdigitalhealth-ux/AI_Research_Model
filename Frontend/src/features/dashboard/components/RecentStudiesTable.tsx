import { useNavigate, Link } from 'react-router-dom';
import { useRecentStudies } from '@/hooks/useDashboard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusState } from '@/components/shared/StatusState';
import { formatDate } from '@/lib/utils';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { StudyStatus } from '@/types/study';

const STATUS_BADGE_VARIANTS: Record<StudyStatus, 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info'> = {
  draft: 'secondary',
  protocol_review: 'warning',
  active: 'default',
  data_collection: 'info',
  analysis: 'warning',
  completed: 'success',
  archived: 'secondary',
};

export function RecentStudiesTable() {
  const navigate = useNavigate();
  const { data: studies, isLoading, isUnavailable, isError, errorDetail, refetch } = useRecentStudies(5);

  if (isUnavailable) {
    return (
      <StatusState
        type="unavailable"
        title="Recent Studies Endpoint Unavailable"
        description="The backend endpoint (`/dashboard/recent-studies`) could not be reached."
        endpoint="/dashboard/recent-studies"
        action={{
          label: 'Retry Loading Studies',
          onClick: () => refetch(),
        }}
      />
    );
  }

  if (isError) {
    return (
      <StatusState
        type="error"
        title="Failed to Load Recent Studies"
        description={errorDetail?.message || 'Error occurred while loading studies.'}
        action={{
          label: 'Retry',
          onClick: () => refetch(),
        }}
      />
    );
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between py-4 px-5">
        <div>
          <CardTitle className="text-base font-bold text-slate-900">Recent Studies</CardTitle>
          <p className="text-xs text-slate-500 mt-0.5">Active and recently updated research protocols</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/studies')}
          className="text-xs gap-1 text-blue-600 hover:text-blue-700"
        >
          <span>View All Studies</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : !studies || studies.length === 0 ? (
          <div className="py-10 px-4 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-700">No Studies Found</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              There are no study records in the database. Create a new study using the quick actions above to begin tracking protocols.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-y border-slate-100">
                <tr>
                  <th scope="col" className="py-3 px-5">Study Title & Protocol</th>
                  <th scope="col" className="py-3 px-4">Phase</th>
                  <th scope="col" className="py-3 px-4">Status</th>
                  <th scope="col" className="py-3 px-4">Enrolled / Target</th>
                  <th scope="col" className="py-3 px-4">Last Updated</th>
                  <th scope="col" className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studies.map((study) => (
                  <tr key={study.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-slate-900 line-clamp-1">
                        {study.title}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400">
                        {study.protocolNumber}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {study.phase || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant={STATUS_BADGE_VARIANTS[study.status] || 'secondary'}>
                        {study.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900">
                        {study.enrolledParticipants ?? 0}
                      </span>
                      <span className="text-slate-400">
                        {' '}/ {study.targetParticipants ?? '—'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {formatDate(study.updatedAt)}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <Link
                        to={`/studies/${study.id}`}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                      >
                        <span>View</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

