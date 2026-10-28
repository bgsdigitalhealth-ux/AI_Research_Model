import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { useStudiesList } from '@/hooks/useStudies';
import { StatusState } from '@/components/shared/StatusState';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import { Plus, Filter, ExternalLink } from 'lucide-react';
import { QuickActionsBar } from '../dashboard/components/QuickActionsBar';

export function StudiesView() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { data, isLoading, isUnavailable, isError, errorDetail, refetch } = useStudiesList(
    statusFilter ? { status: statusFilter } : undefined
  );

  const studies = Array.isArray(data) ? data : data?.items;

  return (
    <PageContainer
      title="My Studies"
      description="Manage active clinical protocols, observational trials, and multi-center study initiatives."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'My Studies', isCurrent: true },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => {
            const btn = document.querySelector('button:has(svg.lucide-plus-circle)') as HTMLButtonElement | null;
            if (btn) btn.click();
          }}>
            <Plus className="h-4 w-4" />
            <span>New Study</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Hidden Quick Actions helper to share modal */}
        <div className="hidden">
          <QuickActionsBar />
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-700">Filter by Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="protocol_review">Protocol Review</option>
              <option value="active">Active</option>
              <option value="data_collection">Data Collection</option>
              <option value="analysis">Analysis</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          
          <div className="text-xs text-slate-500">
            {studies ? `Showing ${studies.length} studies` : ''}
          </div>
        </div>

        {/* Dynamic Studies Data List */}
        {isUnavailable ? (
          <StatusState
            type="unavailable"
            title="Studies Service Unavailable"
            description="The studies service endpoint (`/studies`) is currently unreachable."
            endpoint="/studies"
            action={{
              label: 'Retry Fetching Studies',
              onClick: () => refetch(),
            }}
          />
        ) : isError ? (
          <StatusState
            type="error"
            title="Error Loading Studies"
            description={errorDetail?.message || 'Could not load studies.'}
            action={{
              label: 'Retry',
              onClick: () => refetch(),
            }}
          />
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-64" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </Card>
            ))}
          </div>
        ) : !studies || studies.length === 0 ? (
          <StatusState
            type="empty"
            title="No Studies Found"
            description="No research studies have been recorded in the database yet."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {studies.map((study) => (
              <Card key={study.id} className="hover:border-slate-300 transition-all">
                <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/studies/${study.id}`}
                        className="text-base font-bold text-slate-900 hover:text-blue-600 transition-colors"
                      >
                        {study.title}
                      </Link>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {study.protocolNumber}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                      {study.principalInvestigator && (
                        <span>PI: <strong>{study.principalInvestigator}</strong></span>
                      )}
                      {study.phase && <span>Phase: {study.phase}</span>}
                      <span>Updated: {formatDate(study.updatedAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                    <Badge variant="default" className="capitalize">
                      {study.status.replace('_', ' ')}
                    </Badge>
                    <Link
                      to={`/studies/${study.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      <span>Study Details</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

