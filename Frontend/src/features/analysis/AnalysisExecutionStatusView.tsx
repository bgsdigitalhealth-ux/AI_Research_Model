import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { StatusState } from '@/components/shared/StatusState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalysisRun, useCancelAnalysisRun } from '@/hooks/useAnalysis';
import {
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  StopCircle,
  ArrowRight,
  ArrowLeft,
  FileText,
  AlertCircle,
} from 'lucide-react';

export function AnalysisExecutionStatusView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: run,
    isLoading,
    isError,
    error,
    refetch,
  } = useAnalysisRun(id, 2500);

  const cancelMutation = useCancelAnalysisRun();

  useEffect(() => {
    if (run?.status === 'completed') {
      const timer = setTimeout(() => {
        navigate(`/analysis/${id}/results`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [run?.status, id, navigate]);

  const handleCancel = async () => {
    if (!id) return;
    await cancelMutation.mutateAsync(id);
  };

  return (
    <PageContainer
      title="Analysis Pipeline Execution Status"
      description="Real-time monitoring of backend statistical engine computation and model fitting."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Analysis', path: '/analysis' },
        { label: `Run ${id}`, isCurrent: true },
      ]}
      actions={
        <Button variant="outline" size="sm" onClick={() => navigate('/analysis')} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Workbench</span>
        </Button>
      }
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : isError ? (
          <StatusState
            type="unavailable"
            title="Unable to Retrieve Run Status"
            description={
              error instanceof Error
                ? error.message
                : `Failed to query run status from /analysis/runs/${id}.`
            }
            endpoint={`/analysis/runs/${id}`}
            actionLabel="Retry"
            onAction={() => refetch()}
          />
        ) : !run ? (
          <StatusState
            type="empty"
            title="Analysis Run Not Found"
            description={`No analytical execution job exists with ID "${id}".`}
            actionLabel="Return to Workbench"
            onAction={() => navigate('/analysis')}
          />
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-xs">
            {/* Header info */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="font-mono text-xs text-slate-400">Run ID: {run.id}</span>
                <h3 className="text-base font-semibold text-slate-900 mt-0.5">
                  {run.methodName || run.methodId}
                </h3>
              </div>

              <div>
                {run.status === 'completed' && (
                  <Badge variant="success" className="gap-1 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Completed</span>
                  </Badge>
                )}
                {run.status === 'running' && (
                  <Badge variant="outline" className="gap-1 text-xs border-blue-300 bg-blue-50 text-blue-700">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Executing ({run.progressPercent}%)</span>
                  </Badge>
                )}
                {run.status === 'queued' && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Queued</span>
                  </Badge>
                )}
                {run.status === 'failed' && (
                  <Badge variant="destructive" className="gap-1 text-xs">
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Failed</span>
                  </Badge>
                )}
                {run.status === 'cancelled' && (
                  <Badge variant="outline" className="gap-1 text-xs text-slate-600">
                    <StopCircle className="h-3.5 w-3.5" />
                    <span>Cancelled</span>
                  </Badge>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="py-6">
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-700">
                <span>{run.statusMessage || 'Calculating test statistics...'}</span>
                <span>{run.progressPercent}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full transition-all duration-500 ease-out ${
                    run.status === 'failed'
                      ? 'bg-red-500'
                      : run.status === 'completed'
                      ? 'bg-emerald-500'
                      : 'bg-blue-600'
                  }`}
                  style={{ width: `${Math.max(run.progressPercent, 5)}%` }}
                />
              </div>
            </div>

            {/* Error Display if Failed */}
            {run.status === 'failed' && run.errorMessage && (
              <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-xs text-red-900">
                <div className="flex items-center gap-2 font-semibold mb-1">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span>Execution Terminated with Error</span>
                </div>
                <p className="font-mono text-[11px] bg-red-100/60 p-2 rounded mt-1">
                  {run.errorMessage}
                </p>
              </div>
            )}

            {/* Run Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-md bg-slate-50 p-4 text-xs text-slate-600">
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Dataset</span>
                <span className="font-medium text-slate-800">{run.datasetSnapshotName || run.datasetSnapshotId}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Dependent Var</span>
                <span className="font-mono font-medium text-slate-800">{run.config.dependentVariable || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Confidence Level</span>
                <span className="font-medium text-slate-800">{run.config.confidenceLevel}%</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Missing Method</span>
                <span className="capitalize text-slate-800">{run.config.handleMissing.replace('_', ' ')}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              <div>
                {(run.status === 'running' || run.status === 'queued') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={cancelMutation.isPending}
                    className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  >
                    <StopCircle className="h-4 w-4" />
                    <span>Cancel Pipeline</span>
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {run.status === 'completed' && (
                  <Button
                    size="sm"
                    onClick={() => navigate(`/analysis/${run.id}/results`)}
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <span>Inspect Results</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}

                {run.status === 'failed' && (
                  <Button
                    size="sm"
                    onClick={() => navigate(`/analysis/new?datasetId=${run.datasetSnapshotId}&methodId=${run.methodId}`)}
                    className="gap-1.5"
                  >
                    <span>Reconfigure &amp; Retry</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

