import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { useProtocolsList } from '@/hooks/useProtocols';
import { StatusState } from '@/components/shared/StatusState';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import { 
  Upload, 
  Search, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  History, 
  Sliders, 
  ArrowRight,
  ExternalLink 
} from 'lucide-react';
import { ProtocolReviewStatus, ProtocolExtractionStatus } from '@/types/protocol';

const REVIEW_STATUS_BADGES: Record<ProtocolReviewStatus, 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info'> = {
  draft: 'secondary',
  under_review: 'warning',
  approved: 'success',
  revision_requested: 'destructive',
  rejected: 'destructive',
};

const EXTRACTION_STATUS_BADGES: Record<ProtocolExtractionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' }> = {
  not_started: { label: 'Not Extracted', variant: 'secondary' },
  queued: { label: 'Extraction Queued', variant: 'warning' },
  processing: { label: 'Extracting...', variant: 'info' },
  completed: { label: 'Extracted', variant: 'success' },
  failed: { label: 'Extraction Failed', variant: 'destructive' },
};

function formatFileSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProtocolsView() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: protocols, isLoading, isUnavailable, isError, errorDetail, refetch } = useProtocolsList(
    statusFilter ? { status: statusFilter } : undefined
  );

  const filteredProtocols = protocols?.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.title.toLowerCase().includes(term) ||
      p.fileName?.toLowerCase().includes(term) ||
      p.studyTitle?.toLowerCase().includes(term) ||
      p.irbApprovalNumber?.toLowerCase().includes(term)
    );
  });

  return (
    <PageContainer
      title="Research Protocols"
      description="Repository of clinical trial protocols, IRB documents, AI parameter extractions, and statistical configuration."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Protocols', isCurrent: true },
      ]}
      actions={
        <Button size="sm" onClick={() => navigate('/protocols/upload')} className="gap-1.5 shadow-xs">
          <Upload className="h-4 w-4" />
          <span>Upload Protocol</span>
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by protocol title, IRB number, or file name..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Review Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">All Review Statuses</option>
              <option value="draft">Draft</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="revision_requested">Revision Requested</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* Dynamic Data States */}
        {isUnavailable ? (
          <StatusState
            type="unavailable"
            title="Protocols Endpoint Unavailable"
            description="The backend protocols service (`/protocols`) is currently not responding."
            endpoint="/protocols"
            action={{
              label: 'Retry Loading Protocols',
              onClick: () => refetch(),
            }}
          />
        ) : isError ? (
          <StatusState
            type="error"
            title="Failed to Load Protocols"
            description={errorDetail?.message || 'Error occurred while loading protocol documents.'}
            action={{
              label: 'Retry',
              onClick: () => refetch(),
            }}
          />
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-5">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-64" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </Card>
            ))}
          </div>
        ) : !filteredProtocols || filteredProtocols.length === 0 ? (
          <StatusState
            type="empty"
            title="No Protocols Found"
            description={
              searchTerm
                ? 'No protocols match your search query.'
                : 'No research protocols have been uploaded yet. Upload a PDF or DOCX file to begin extraction.'
            }
            action={
              !searchTerm
                ? {
                    label: 'Upload First Protocol',
                    onClick: () => navigate('/protocols/upload'),
                  }
                : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredProtocols.map((protocol) => {
              const extractionMeta = protocol.extractionStatus
                ? EXTRACTION_STATUS_BADGES[protocol.extractionStatus]
                : EXTRACTION_STATUS_BADGES.not_started;

              return (
                <Card key={protocol.id} className="hover:border-slate-300 transition-all shadow-xs">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to={`/protocols/${protocol.id}`}
                            className="text-base font-bold text-slate-900 hover:text-blue-600 transition-colors"
                          >
                            {protocol.title}
                          </Link>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            v{protocol.version}
                          </Badge>
                          <Badge variant={REVIEW_STATUS_BADGES[protocol.status] || 'secondary'} className="capitalize">
                            {protocol.status.replace('_', ' ')}
                          </Badge>
                          <Badge variant={extractionMeta.variant} className="text-[10px]">
                            {extractionMeta.label}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                          {protocol.fileName && (
                            <span className="flex items-center gap-1">
                              <FileText className="h-3.5 w-3.5 text-slate-400" />
                              <span className="font-mono">{protocol.fileName}</span>
                              <span className="text-slate-400">({formatFileSize(protocol.fileSizeBytes)})</span>
                            </span>
                          )}
                          {protocol.irbApprovalNumber && (
                            <span>IRB: <strong>{protocol.irbApprovalNumber}</strong></span>
                          )}
                          <span>Uploaded: {formatDate(protocol.uploadedAt)}</span>
                          {protocol.uploadedBy && <span>By: {protocol.uploadedBy}</span>}
                        </div>
                      </div>

                      {/* Primary Navigation to Verification Workspace */}
                      <div className="shrink-0">
                        <Link to={`/protocols/${protocol.id}/verify`}>
                          <Button size="sm" className="gap-1.5 w-full md:w-auto">
                            <span>Verify Extraction</span>
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {/* Secondary Navigation Strip */}
                    <div className="flex items-center gap-3 pt-3 border-t border-slate-100 text-xs flex-wrap">
                      <Link
                        to={`/protocols/${protocol.id}`}
                        className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-600 font-medium"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>Document Preview & Metadata</span>
                      </Link>

                      <span className="text-slate-300">•</span>

                      <Link
                        to={`/protocols/${protocol.id}/study-configuration`}
                        className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-600 font-medium"
                      >
                        <Sliders className="h-3.5 w-3.5" />
                        <span>Methods & Analysis Configuration</span>
                      </Link>

                      <span className="text-slate-300">•</span>

                      <Link
                        to={`/protocols/${protocol.id}/versions`}
                        className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-600 font-medium"
                      >
                        <History className="h-3.5 w-3.5" />
                        <span>Version History</span>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
