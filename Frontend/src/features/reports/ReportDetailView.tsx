import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { StatusState } from '@/components/shared/StatusState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useReport } from '@/hooks/useReports';
import {
  FileText,
  FileDown,
  ArrowLeft,
  CheckCircle2,
  Clock,
  BookOpen,
  Share2,
  ExternalLink,
  ShieldCheck,
  Send,
} from 'lucide-react';

export function ReportDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeSectionId, setActiveSectionId] = useState<string>('');

  const {
    data: report,
    isLoading,
    isError,
    error,
    refetch,
  } = useReport(id);

  const activeSection =
    report?.sections.find((s) => s.id === activeSectionId) ||
    report?.sections[0];

  return (
    <PageContainer
      title={report?.title || 'Research Report Preview'}
      description="Formal manuscript draft and clinical study report compiled from verified analytical pipelines."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Reports', path: '/reports' },
        { label: report ? `Report ${report.version}` : 'Preview', isCurrent: true },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/reports')} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            <span>Reports Library</span>
          </Button>

          {report && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/reports/exports?reportId=${report.id}`)}
              className="gap-1.5"
            >
              <FileDown className="h-4 w-4" />
              <span>Export Package</span>
            </Button>
          )}

          {report?.status === 'draft' && (
            <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
              <Send className="h-4 w-4" />
              <span>Submit for Review</span>
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <div className="grid grid-cols-12 gap-6">
              <Skeleton className="col-span-4 h-96 w-full" />
              <Skeleton className="col-span-8 h-96 w-full" />
            </div>
          </div>
        ) : isError ? (
          <StatusState
            type="unavailable"
            title="Report Not Accessible"
            description={
              error instanceof Error
                ? error.message
                : `Failed to load compiled report structure from /reports/${id}.`
            }
            endpoint={`/reports/${id}`}
            actionLabel="Retry Loading"
            onAction={() => refetch()}
          />
        ) : !report ? (
          <StatusState
            type="empty"
            title="Report Not Found"
            description={`No compiled research report exists with ID "${id}".`}
            actionLabel="Return to Reports"
            onAction={() => navigate('/reports')}
          />
        ) : (
          <div className="space-y-6">
            {/* Header Document Metadata Banner */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">{report.title}</h2>
                    <Badge variant="outline" className="font-mono text-xs">
                      v{report.version}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Study: <span className="font-semibold text-slate-800">{report.studyTitle}</span> |
                    Protocol Version: <span className="font-mono text-slate-700">{report.protocolVersion}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {report.status === 'approved' && (
                    <Badge variant="success" className="gap-1 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Regulatory Approved</span>
                    </Badge>
                  )}
                  {report.status === 'under_review' && (
                    <Badge variant="secondary" className="gap-1 text-xs bg-amber-50 text-amber-800 border-amber-200">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Review in Progress</span>
                    </Badge>
                  )}
                  {report.status === 'draft' && (
                    <Badge variant="outline" className="text-xs text-slate-600">
                      Draft Working Copy
                    </Badge>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-slate-600">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Report Type</span>
                  <span className="font-semibold text-slate-800 uppercase">{report.type}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Principal Author</span>
                  <span className="text-slate-800">{report.author.name}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Dataset Snapshot</span>
                  <span className="font-mono text-slate-800">{report.datasetSnapshotId}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Linked Analysis Runs</span>
                  <span className="font-semibold text-slate-800">{report.approvedAnalysisRunIds.length} verified runs</span>
                </div>
              </div>
            </div>

            {/* Document Split Layout: Table of Contents & Section Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Table of Contents */}
              <div className="lg:col-span-4 space-y-4">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>Table of Contents</span>
                  </h3>

                  <nav className="space-y-1">
                    {report.sections.map((sec, idx) => {
                      const isCurrent = (activeSection?.id || report.sections[0]?.id) === sec.id;
                      return (
                        <button
                          key={sec.id}
                          onClick={() => setActiveSectionId(sec.id)}
                          className={`w-full text-left rounded-md px-3 py-2 text-xs transition-colors flex items-center justify-between ${
                            isCurrent
                              ? 'bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-600'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span className="truncate">
                            {idx + 1}. {sec.title}
                          </span>
                          {sec.linkedAnalysisRunId && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-200 text-blue-700">
                              Run
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {/* Linked Analysis Runs Box */}
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs text-xs">
                  <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                    <span>Statistical Provenance Audit</span>
                  </h4>
                  <p className="text-slate-500 text-[11px] mb-3">
                    All findings referenced in this document are programmatically linked to verified analysis runs:
                  </p>
                  <div className="space-y-1.5">
                    {report.approvedAnalysisRunIds.map((runId) => (
                      <div
                        key={runId}
                        onClick={() => navigate(`/analysis/${runId}/results`)}
                        className="flex items-center justify-between p-1.5 rounded hover:bg-slate-50 border border-slate-100 cursor-pointer text-[11px]"
                      >
                        <span className="font-mono text-slate-800">{runId}</span>
                        <ExternalLink className="h-3 w-3 text-slate-400" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Active Section Content Preview */}
              <div className="lg:col-span-8">
                {activeSection ? (
                  <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                    <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                      <h3 className="text-base font-semibold text-slate-900">{activeSection.title}</h3>
                      {activeSection.linkedAnalysisRunId && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => navigate(`/analysis/${activeSection.linkedAnalysisRunId}/results`)}
                          className="gap-1 text-blue-600"
                        >
                          <span>Inspect Underlying Model</span>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    <div className="prose prose-slate max-w-none text-xs leading-relaxed text-slate-700 space-y-3 whitespace-pre-wrap">
                      {activeSection.content}
                    </div>

                    {activeSection.isAiDrafted && (
                      <div className="mt-4 rounded-md bg-indigo-50/70 p-3 text-[11px] text-indigo-900 border border-indigo-100">
                        <strong>Drafting Note:</strong> This section text was initially compiled by the AI synthesis engine
                        and requires researcher sign-off before regulatory submission.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500">
                    Select a section from the Table of Contents to preview.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

