import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { StatusState } from '@/components/shared/StatusState';
import { MetricCard } from '@/components/shared/MetricCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useDatasets, useSupportedMethods, useAnalysisRuns, useAnalysisRuntime } from '@/hooks/useAnalysis';
import {
  Play,
  Database,
  BarChart2,
  History,
  FileCheck2,
  Lock,
  ArrowRight,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';

export function AnalysisWorkbenchView() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'datasets' | 'methods' | 'recent_runs'>('datasets');

  const {
    data: datasets,
    isLoading: isDatasetsLoading,
    isError: isDatasetsError,
    error: datasetsError,
    refetch: refetchDatasets,
  } = useDatasets();

  const {
    data: methods,
    isLoading: isMethodsLoading,
    isError: isMethodsError,
    refetch: refetchMethods,
  } = useSupportedMethods();

  const {
    data: runs,
    isLoading: isRunsLoading,
    isError: isRunsError,
    refetch: refetchRuns,
  } = useAnalysisRuns();

  const { data: runtime } = useAnalysisRuntime();

  const totalDatasets = datasets?.length ?? 0;
  const totalApprovedMethods = methods?.filter((m) => m.isApprovedInSap).length ?? 0;
  const totalRuns = runs?.length ?? 0;
  const completedRuns = runs?.filter((r) => r.status === 'completed').length ?? 0;

  return (
    <PageContainer
      title="Statistical Analysis Workbench"
      description="Select frozen dataset snapshots, configure prespecified statistical tests, execute analytical pipelines, and inspect verified outputs."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Analysis', isCurrent: true },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/analysis/data-quality')}
            className="gap-1.5"
          >
            <BarChart2 className="h-4 w-4" />
            <span>Data Quality</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/analysis/history')}
            className="gap-1.5"
          >
            <History className="h-4 w-4" />
            <span>Audit History</span>
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
        {/* Top Summary Metrics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Frozen Snapshots"
            value={totalDatasets}
            icon={Database}
            description="Immutable datasets ready for analysis"
            loading={isDatasetsLoading}
          />
          <MetricCard
            title="SAP Approved Methods"
            value={totalApprovedMethods}
            icon={FileCheck2}
            description="Prespecified in protocol"
            loading={isMethodsLoading}
          />
          <MetricCard
            title="Total Executions"
            value={totalRuns}
            icon={History}
            description="Audit-logged analytical runs"
            loading={isRunsLoading}
          />
          <MetricCard
            title="Verified Completed"
            value={completedRuns}
            icon={CheckCircle2}
            description="Available for report synthesis"
            loading={isRunsLoading}
          />
        </div>

        {/* Isolated Docker R Container Runtime Status */}
        <div className="rounded-lg border border-slate-200 bg-linear-to-r from-blue-50/60 via-slate-50/40 to-white p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold font-mono text-base shadow-xs">
              R
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-slate-900">
                  {runtime?.engine || 'Docker Containerized R Runtime (GCP Compliant)'}
                </h4>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {runtime?.docker_status || 'Active (Docker Desktop)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Image: <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded text-[11px]">researchflow-r-engine:latest</code> | Runtime: <span className="font-medium text-slate-700">R 4.6.2 (Diversified Portfolio)</span> | Sandbox: <span className="text-slate-600">Isolated WSL2 Container (--network none)</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 shrink-0">
            <Badge variant="outline" className="text-[11px] font-mono">stats (base)</Badge>
            <Badge variant="outline" className="text-[11px] font-mono">jsonlite (2.0)</Badge>
            <Badge variant="outline" className="text-[11px] font-mono">survival (3.8)</Badge>
            <Badge variant="outline" className="text-[11px] font-mono">MASS (7.3)</Badge>
          </div>
        </div>

        {/* Workbench Tab Navigation */}
        <div className="border-b border-slate-200">
          <nav className="flex space-x-6" aria-label="Workbench Sections">
            <button
              onClick={() => setActiveTab('datasets')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'datasets'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Dataset Snapshots ({totalDatasets})
            </button>
            <button
              onClick={() => setActiveTab('methods')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'methods'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Supported SAP Methods ({methods?.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab('recent_runs')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'recent_runs'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Recent Analytical Runs ({totalRuns})
            </button>
          </nav>
        </div>

        {/* Tab 1: Dataset Snapshots */}
        {activeTab === 'datasets' && (
          <div>
            {isDatasetsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : isDatasetsError ? (
              <StatusState
                type="unavailable"
                title="Statistical Datasets Service Offline"
                description={
                  datasetsError instanceof Error
                    ? datasetsError.message
                    : 'The backend service managing frozen research datasets (/analysis/datasets) is currently unreachable.'
                }
                endpoint="/analysis/datasets"
                actionLabel="Retry Connection"
                onAction={() => refetchDatasets()}
              />
            ) : !datasets || datasets.length === 0 ? (
              <StatusState
                type="empty"
                title="No Frozen Dataset Snapshots"
                description="Before statistical testing can be initiated, data collection records must be frozen into an immutable research snapshot."
                actionLabel="Go to Data Collection"
                onAction={() => navigate('/data-collection')}
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {datasets.map((dataset) => (
                  <div
                    key={dataset.id}
                    className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition-colors"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-slate-900">{dataset.name}</h3>
                            {dataset.isFrozen && (
                              <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-blue-700">
                                <Lock className="h-3 w-3" />
                                <span>Frozen</span>
                              </Badge>
                            )}
                          </div>
                          {dataset.studyTitle && (
                            <p className="text-xs text-slate-500 mt-0.5">{dataset.studyTitle}</p>
                          )}
                        </div>
                        {dataset.dataQualityScore !== undefined && (
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-semibold text-slate-400 block">Quality</span>
                            <span className="text-sm font-bold text-emerald-600">{dataset.dataQualityScore}%</span>
                          </div>
                        )}
                      </div>

                      {dataset.description && (
                        <p className="mt-2 text-xs text-slate-600 line-clamp-2">{dataset.description}</p>
                      )}

                      <div className="mt-4 grid grid-cols-3 gap-2 rounded-md bg-slate-50 p-2.5 text-xs text-slate-600">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Records</span>
                          <span className="font-semibold text-slate-800">{dataset.recordCount.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Variables</span>
                          <span className="font-semibold text-slate-800">{dataset.variableCount}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Schema Ver.</span>
                          <span className="font-mono text-slate-800">{dataset.questionnaireVersion}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="text-[11px] text-slate-400">
                        Snapshot: {new Date(dataset.snapshotDate).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => navigate(`/analysis/data-quality?datasetId=${dataset.id}`)}
                        >
                          Quality Details
                        </Button>
                        <Button
                          size="xs"
                          className="gap-1"
                          onClick={() => navigate(`/analysis/new?datasetId=${dataset.id}`)}
                        >
                          <span>Analyze</span>
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Supported Methods */}
        {activeTab === 'methods' && (
          <div>
            {isMethodsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : isMethodsError ? (
              <StatusState
                type="unavailable"
                title="Statistical Capabilities API Unavailable"
                description="Unable to load approved statistical methods from the engine (/analysis/methods)."
                endpoint="/analysis/methods"
                actionLabel="Retry"
                onAction={() => refetchMethods()}
              />
            ) : !methods || methods.length === 0 ? (
              <StatusState
                type="empty"
                title="No Statistical Methods Registered"
                description="The backend statistical pipeline has not registered any analytical modules."
              />
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Analysis Method</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">SAP Prespecified</th>
                        <th className="px-4 py-3">Assumptions Tested</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {methods.map((method) => (
                        <tr key={method.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-900 block">{method.name}</span>
                            <span className="text-[11px] text-slate-500 line-clamp-1">{method.description}</span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="text-[10px]">
                              {method.category}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {method.isApprovedInSap ? (
                              <Badge variant="success" className="text-[10px] gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Approved in SAP</span>
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-slate-500">
                                Post-hoc Exploratory
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-[11px]">
                            {method.assumptionsTested.join(', ') || 'None'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => navigate(`/analysis/new?methodId=${method.id}`)}
                            >
                              Configure
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Recent Analytical Runs */}
        {activeTab === 'recent_runs' && (
          <div>
            {isRunsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : isRunsError ? (
              <StatusState
                type="unavailable"
                title="Analysis Audit Log Unavailable"
                description="Failed to load historical execution records from (/analysis/runs)."
                endpoint="/analysis/runs"
                actionLabel="Retry"
                onAction={() => refetchRuns()}
              />
            ) : !runs || runs.length === 0 ? (
              <StatusState
                type="empty"
                title="No Analysis Executions Yet"
                description="No statistical testing jobs have been executed for this study."
                actionLabel="Launch First Analysis"
                onAction={() => navigate('/analysis/new')}
              />
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Run ID</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Dataset Snapshot</th>
                      <th className="px-4 py-3">Executed At</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {runs.map((run) => (
                      <tr key={run.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-medium text-slate-900">{run.id}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{run.methodName || run.methodId}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {run.datasetSnapshotName || run.datasetSnapshotId}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(run.queuedAt).toLocaleString()}
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
                              View Results
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => navigate(`/analysis/${run.id}/status`)}
                            >
                              Inspect Status
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

