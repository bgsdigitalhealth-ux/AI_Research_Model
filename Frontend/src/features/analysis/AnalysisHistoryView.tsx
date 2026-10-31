import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { StatusState } from '@/components/shared/StatusState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalysisRuns } from '@/hooks/useAnalysis';
import {
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ArrowLeft,
  Search,
  Filter,
  Play,
} from 'lucide-react';

export function AnalysisHistoryView() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const {
    data: runs,
    isLoading,
    isError,
    error,
    refetch,
  } = useAnalysisRuns();

  const filteredRuns = runs?.filter((r) => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesSearch =
      r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.methodName && r.methodName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.studyTitle && r.studyTitle.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.datasetSnapshotName && r.datasetSnapshotName.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <PageContainer
      title="Analysis Execution Audit Trail"
      description="Immutable historical log of all computational runs, model specifications, and execution results."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Analysis', path: '/analysis' },
        { label: 'Audit History', isCurrent: true },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/analysis')} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            <span>Workbench</span>
          </Button>
          <Button
            size="sm"
            onClick={() => navigate('/analysis/new')}
            className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>New Analysis Run</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search run ID, method, study..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <span>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="running">Running</option>
                <option value="queued">Queued</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          <span className="text-xs text-slate-500">
            Total Logged: {filteredRuns?.length ?? 0}
          </span>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : isError ? (
          <StatusState
            type="unavailable"
            title="Audit Trail Offline"
            description={
              error instanceof Error
                ? error.message
                : 'Unable to query execution history records from /analysis/runs.'
            }
            endpoint="/analysis/runs"
            actionLabel="Retry Audit Query"
            onAction={() => refetch()}
          />
        ) : !runs || runs.length === 0 ? (
          <StatusState
            type="empty"
            title="No Statistical Executions Recorded"
            description="No analytical compute pipelines have been executed yet for this project."
            actionLabel="Launch First Analysis"
            onAction={() => navigate('/analysis/new')}
          />
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Run ID</th>
                    <th className="px-4 py-3">Method &amp; Specification</th>
                    <th className="px-4 py-3">Dataset Snapshot</th>
                    <th className="px-4 py-3">Queued At</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Executed By</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredRuns && filteredRuns.length > 0 ? (
                    filteredRuns.map((run) => (
                      <tr key={run.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-medium text-slate-900">{run.id}</td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-900 block">{run.methodName || run.methodId}</span>
                          <span className="text-[11px] text-slate-500">
                            Y: {run.config.dependentVariable || 'N/A'} | X: {run.config.independentVariables.join(', ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {run.datasetSnapshotName || run.datasetSnapshotId}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(run.queuedAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">
                          {run.durationSeconds != null ? `${Number(run.durationSeconds).toFixed(1)}s` : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {run.executedBy?.name || 'Researcher'}
                        </td>
                        <td className="px-4 py-3">
                          {run.status === 'completed' && (
                            <Badge variant="success" className="gap-1 text-[10px]">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Completed</span>
                            </Badge>
                          )}
                          {run.status === 'running' && (
                            <Badge variant="outline" className="gap-1 text-[10px] text-blue-600 border-blue-300 bg-blue-50">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Running ({run.progressPercent}%)</span>
                            </Badge>
                          )}
                          {run.status === 'queued' && (
                            <Badge variant="secondary" className="gap-1 text-[10px]">
                              <Clock className="h-3 w-3" />
                              <span>Queued</span>
                            </Badge>
                          )}
                          {run.status === 'failed' && (
                            <Badge variant="destructive" className="gap-1 text-[10px]">
                              <XCircle className="h-3 w-3" />
                              <span>Failed</span>
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {run.status === 'completed' ? (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => navigate(`/analysis/${run.id}/results`)}
                            >
                              Results
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => navigate(`/analysis/${run.id}/status`)}
                            >
                              Status
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                        No execution records match your filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

