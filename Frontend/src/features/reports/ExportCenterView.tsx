import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { StatusState } from '@/components/shared/StatusState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useExportJobs, useRequestExport } from '@/hooks/useReports';
import { useDatasets, useAnalysisRuns } from '@/hooks/useAnalysis';
import { reportsApi } from '@/api/reportsApi';
import { ExportFormat, ExportType } from '@/types/reports';
import {
  FileDown,
  ShieldCheck,
  Lock,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  Download,
  CheckSquare,
} from 'lucide-react';

export function ExportCenterView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRunId = searchParams.get('analysisRunId') || '';
  const initialReportId = searchParams.get('reportId') || '';

  const [exportType, setExportType] = useState<ExportType>(
    initialReportId ? 'formal_report' : initialRunId ? 'curated_analysis' : 'raw_dataset'
  );
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [selectedRunId, setSelectedRunId] = useState<string>(initialRunId);
  const [includeCodebook, setIncludeCodebook] = useState<boolean>(true);
  const [deIdentifyConfirmed, setDeIdentifyConfirmed] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null);

  const {
    data: jobs,
    isLoading: isJobsLoading,
    isError: isJobsError,
    error: jobsError,
    refetch: refetchJobs,
  } = useExportJobs();

  const { data: datasets } = useDatasets();
  const { data: runs } = useAnalysisRuns();

  const requestExportMutation = useRequestExport();

  const handleExportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!deIdentifyConfirmed) {
      setFormError('Study governance requires confirmation that exported datasets will be de-identified and stripped of direct participant identifiers.');
      return;
    }

    try {
      await requestExportMutation.mutateAsync({
        studyId: 'study-active',
        format: selectedFormat,
        type: exportType,
        datasetSnapshotId: selectedDatasetId || undefined,
        analysisRunId: selectedRunId || undefined,
        reportId: initialReportId || undefined,
        includeCodebook,
        deIdentifyData: true,
        maskDirectIdentifiers: true,
      });
      // Refresh jobs list
      refetchJobs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export request failed';
      setFormError(`Export rejected by governance policy: ${msg}`);
    }
  };

  const handleDownload = async (jobId: string, fileName?: string) => {
    try {
      setDownloadingJobId(jobId);
      const blob = await reportsApi.downloadExport(jobId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || `export_${jobId}.${selectedFormat}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      alert(`Download Error: ${msg}`);
    } finally {
      setDownloadingJobId(null);
    }
  };

  return (
    <PageContainer
      title="Research Data &amp; Reports Export Centre"
      description="Generate governance-compliant export packages in CSV, XLSX, PDF, and DOCX formats with mandatory de-identification."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Reports', path: '/reports' },
        { label: 'Export Centre', isCurrent: true },
      ]}
      actions={
        <Button variant="outline" size="sm" onClick={() => navigate('/reports')} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          <span>Reports Library</span>
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Governance Notice Banner */}
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 shadow-xs">
          <ShieldCheck className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold text-blue-950">
              IRB &amp; Data Governance Security Policy
            </h4>
            <p className="text-blue-800 leading-relaxed">
              In accordance with research ethics protocols, HIPAA Safe Harbor, and GDPR guidelines, all data exported
              from this system is automatically scrubbed of direct identifiers (names, phone numbers, email addresses,
              and physical street locations). Only approved variables prespecified in the protocol data dictionary may be extracted.
            </p>
          </div>
        </div>

        {/* Export Configuration Form */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <FileDown className="h-4 w-4 text-blue-600" />
            <span>Configure Export Package</span>
          </h3>

          <form onSubmit={handleExportSubmit} className="space-y-5">
            {/* Package Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                1. Select Package Content Type
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    type: 'raw_dataset',
                    title: 'Frozen Raw Dataset',
                    desc: 'Microdata records with variable headers',
                  },
                  {
                    type: 'curated_analysis',
                    title: 'Statistical Results',
                    desc: 'Estimates, p-values, CIs & diagnostics',
                  },
                  {
                    type: 'formal_report',
                    title: 'Formal Study Report',
                    desc: 'Compiled CSR or manuscript narrative',
                  },
                  {
                    type: 'variable_codebook',
                    title: 'Variable Codebook',
                    desc: 'Data dictionary, definitions & scales',
                  },
                ].map((item) => {
                  const isSelected = exportType === item.type;
                  return (
                    <div
                      key={item.type}
                      onClick={() => setExportType(item.type as ExportType)}
                      className={`cursor-pointer rounded-md border p-3 text-xs transition-colors ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-semibold text-slate-900">{item.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Target Data Source Selection */}
            {exportType === 'raw_dataset' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Select Frozen Dataset Snapshot
                </label>
                <select
                  value={selectedDatasetId}
                  onChange={(e) => setSelectedDatasetId(e.target.value)}
                  className="w-full sm:w-96 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                >
                  <option value="">-- Choose Dataset Snapshot --</option>
                  {datasets?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.recordCount} rows, frozen {new Date(d.snapshotDate).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {exportType === 'curated_analysis' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Select Completed Analysis Run
                </label>
                <select
                  value={selectedRunId}
                  onChange={(e) => setSelectedRunId(e.target.value)}
                  className="w-full sm:w-96 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                >
                  <option value="">-- Choose Analysis Run --</option>
                  {runs
                    ?.filter((r) => r.status === 'completed')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        Run {r.id}: {r.methodName || r.methodId} ({new Date(r.queuedAt).toLocaleDateString()})
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* File Format Options */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                2. Select Export Format (Supported by Backend Engine)
              </label>
              <div className="flex flex-wrap gap-3">
                {[
                  { format: 'csv', label: 'CSV (Comma Separated)', icon: FileSpreadsheet, badge: 'Standard' },
                  { format: 'xlsx', label: 'Excel (XLSX Workbook)', icon: FileSpreadsheet, badge: 'Formatted' },
                  { format: 'pdf', label: 'PDF Document', icon: FileText, badge: 'Paginated' },
                  { format: 'docx', label: 'Word (DOCX Manuscript)', icon: FileText, badge: 'Editable' },
                ].map((item) => {
                  const isSelected = selectedFormat === item.format;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.format}
                      type="button"
                      onClick={() => setSelectedFormat(item.format as ExportFormat)}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase">
                        {item.badge}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Compliance Checkboxes */}
            <div className="space-y-2 rounded-md bg-slate-50 p-4 text-xs text-slate-700 border border-slate-200">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCodebook}
                  onChange={(e) => setIncludeCodebook(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="font-semibold text-slate-900">Include Variable Codebook &amp; Data Dictionary</span>
                  <p className="text-[11px] text-slate-500">
                    Appends schema definitions, measurement scales, and valid numeric ranges to the package.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer pt-2 border-t border-slate-200">
                <input
                  type="checkbox"
                  checked={deIdentifyConfirmed}
                  onChange={(e) => setDeIdentifyConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="font-semibold text-slate-900">
                    Governance Confirmation: Strict De-identification &amp; Pseudonymization Enforced
                  </span>
                  <p className="text-[11px] text-slate-500">
                    I verify that no personal identifying information (PII) will be released, and that all data
                    governance rules specified in the approved research protocol are observed.
                  </p>
                </div>
              </label>
            </div>

            {/* Error Message */}
            {formError && (
              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-end border-t border-slate-100 pt-3">
              <Button
                type="submit"
                size="sm"
                disabled={requestExportMutation.isPending || !deIdentifyConfirmed}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {requestExportMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Submitting Export Job...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4" />
                    <span>Generate &amp; Request Package</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* Export Queue & Download Center */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Export Job Queue &amp; Ready Downloads
              </h3>
              <p className="text-xs text-slate-500">
                Package processing status, download expiration windows, and audit records
              </p>
            </div>
            <Button variant="ghost" size="xs" onClick={() => refetchJobs()}>
              Refresh Queue
            </Button>
          </div>

          {isJobsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : isJobsError ? (
            <StatusState
              type="unavailable"
              title="Export Engine Offline"
              description={
                jobsError instanceof Error
                  ? jobsError.message
                  : 'Unable to connect to the export service (/exports/jobs).'
              }
              endpoint="/exports/jobs"
              actionLabel="Retry Queue"
              onAction={() => refetchJobs()}
            />
          ) : !jobs || jobs.length === 0 ? (
            <StatusState
              type="empty"
              title="No Export Jobs Requested"
              description="Configure an export above to package raw microdata, statistical outputs, or formal manuscripts."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Job ID</th>
                    <th className="px-4 py-3">Content Type</th>
                    <th className="px-4 py-3">Format</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">File Size</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-medium text-slate-900">{job.id}</td>
                      <td className="px-4 py-3 capitalize text-slate-800">
                        {job.type.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-mono uppercase text-[10px]">
                          {job.format}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(job.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {job.fileSizeBytes ? `${(job.fileSizeBytes / 1024).toFixed(1)} KB` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {job.status === 'ready' && (
                          <Badge variant="success" className="gap-1 text-[10px]">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Ready</span>
                          </Badge>
                        )}
                        {job.status === 'processing' && (
                          <Badge variant="outline" className="gap-1 text-[10px] text-blue-600 border-blue-300 bg-blue-50">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Generating ({job.progressPercent}%)</span>
                          </Badge>
                        )}
                        {job.status === 'failed' && (
                          <Badge variant="destructive" className="gap-1 text-[10px]">
                            <XCircle className="h-3 w-3" />
                            <span>Failed</span>
                          </Badge>
                        )}
                        {job.status === 'expired' && (
                          <Badge variant="secondary" className="gap-1 text-[10px]">
                            <Clock className="h-3 w-3" />
                            <span>Expired</span>
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {job.status === 'ready' && (
                          <Button
                            size="xs"
                            onClick={() => handleDownload(job.id, job.fileName)}
                            disabled={downloadingJobId === job.id}
                            className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            {downloadingJobId === job.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Download className="h-3 w-3" />
                            )}
                            <span>Download</span>
                          </Button>
                        )}
                        {job.status === 'failed' && job.errorMessage && (
                          <span className="text-[11px] text-red-600 font-medium">
                            {job.errorMessage}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

