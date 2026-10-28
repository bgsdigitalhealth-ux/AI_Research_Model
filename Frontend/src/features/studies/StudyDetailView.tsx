import { useParams, Link } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { useStudyDetail } from '@/hooks/useStudies';
import { StatusState } from '@/components/shared/StatusState';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import { ArrowLeft, FileText, Users, Calendar, Activity } from 'lucide-react';

export function StudyDetailView() {
  const { id } = useParams<{ id: string }>();
  const { data: study, isLoading, isUnavailable, isError, errorDetail, refetch } = useStudyDetail(id || '');

  return (
    <PageContainer
      title={study?.title || 'Study Details'}
      description={`Protocol ID: ${study?.protocolNumber || id || '—'}`}
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'My Studies', path: '/studies' },
        { label: study?.title || 'Details', isCurrent: true },
      ]}
      actions={
        <Link to="/studies">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Studies</span>
          </Button>
        </Link>
      }
    >
      {isUnavailable ? (
        <StatusState
          type="unavailable"
          title="Study Detail Endpoint Unavailable"
          description={`Backend endpoint (/studies/${id}) is currently unreachable.`}
          endpoint={`/studies/${id}`}
          action={{
            label: 'Retry Loading Study',
            onClick: () => refetch(),
          }}
        />
      ) : isError ? (
        <StatusState
          type="error"
          title="Failed to Load Study"
          description={errorDetail?.message || 'Study record could not be retrieved.'}
          action={{
            label: 'Retry',
            onClick: () => refetch(),
          }}
        />
      ) : isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        </div>
      ) : !study ? (
        <StatusState
          type="empty"
          title="Study Not Found"
          description={`No record found matching identifier ${id}.`}
        />
      ) : (
        <div className="space-y-6">
          {/* Study Overview Header */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900">{study.title}</h2>
                    <Badge variant="default" className="capitalize">
                      {study.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-1">
                    Protocol #{study.protocolNumber}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-600">
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50">
                  <Activity className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase">Phase</p>
                    <p className="font-semibold text-slate-800">{study.phase || 'Not Specified'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50">
                  <Users className="h-4 w-4 text-emerald-600" />
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase">Participants</p>
                    <p className="font-semibold text-slate-800">
                      {study.enrolledParticipants ?? 0} enrolled / {study.targetParticipants ?? '—'} target
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50">
                  <FileText className="h-4 w-4 text-indigo-600" />
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase">Principal Investigator</p>
                    <p className="font-semibold text-slate-800">{study.principalInvestigator || 'Unassigned'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50">
                  <Calendar className="h-4 w-4 text-amber-600" />
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase">Last Updated</p>
                    <p className="font-semibold text-slate-800">{formatDate(study.updatedAt)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}

