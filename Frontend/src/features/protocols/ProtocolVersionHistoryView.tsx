import { useParams, Link } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { useProtocolDetail, useProtocolVersions } from '@/hooks/useProtocols';
import { StatusState } from '@/components/shared/StatusState';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import {
  History,
  ArrowLeft,
  FileText,
  Download,
  Calendar,
  User,
  GitCommit,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { ProtocolReviewStatus } from '@/types/protocol';

const REVIEW_BADGES: Record<ProtocolReviewStatus, 'default' | 'secondary' | 'destructive' | 'success' | 'warning'> = {
  draft: 'secondary',
  under_review: 'warning',
  approved: 'success',
  revision_requested: 'destructive',
  rejected: 'destructive',
};

function formatBytes(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProtocolVersionHistoryView() {
  const { id } = useParams<{ id: string }>();
  const { data: protocol } = useProtocolDetail(id || '');
  const {
    data: versions,
    isLoading,
    isUnavailable,
    isError,
    errorDetail,
    refetch,
  } = useProtocolVersions(id || '');

  return (
    <PageContainer
      title="Protocol Version History & Audit Trail"
      description={`Revision audit history for protocol "${protocol?.title || id}". Tracks formal amendments, IRB versions, and file replacements.`}
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Protocols', path: '/protocols' },
        { label: protocol?.title || 'Details', path: `/protocols/${id}` },
        { label: 'Version History', isCurrent: true },
      ]}
      actions={
        <Link to={`/protocols/${id}`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Overview</span>
          </Button>
        </Link>
      }
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {isUnavailable ? (
          <StatusState
            type="unavailable"
            title="Version History Endpoint Unavailable"
            description={`Backend version audit endpoint (/protocols/${id}/versions) is unreachable.`}
            endpoint={`/protocols/${id}/versions`}
            action={{
              label: 'Retry Fetching Versions',
              onClick: () => refetch(),
            }}
          />
        ) : isError ? (
          <StatusState
            type="error"
            title="Failed to Load Version History"
            description={errorDetail?.message || 'Could not load version history audit logs.'}
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
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-72" />
                </div>
              </Card>
            ))}
          </div>
        ) : !versions || versions.length === 0 ? (
          <StatusState
            type="empty"
            title="No Version History Found"
            description="Only the initial protocol release exists. Future uploads and amendments will appear in this audit log."
          />
        ) : (
          <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-6">
            {versions.map((ver, index) => {
              const isCurrent = ver.versionNumber === protocol?.version;

              return (
                <div key={ver.id} className="relative space-y-2">
                  {/* Timeline dot */}
                  <div
                    className={`absolute -left-[33px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                      isCurrent
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  />

                  <Card className={`border shadow-xs ${isCurrent ? 'border-blue-300 bg-blue-50/10' : 'border-slate-200'}`}>
                    <CardContent className="p-5 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base text-slate-900">
                            Version {ver.versionNumber}
                          </span>
                          {isCurrent && (
                            <Badge variant="default" className="text-[10px]">
                              Current Active Version
                            </Badge>
                          )}
                          <Badge variant={REVIEW_BADGES[ver.status] || 'secondary'} className="capitalize">
                            {ver.status.replace('_', ' ')}
                          </Badge>
                        </div>

                        {ver.downloadUrl && (
                          <a
                            href={ver.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Download Document</span>
                          </a>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-mono truncate">{ver.fileName}</span>
                          <span className="text-slate-400">({formatBytes(ver.fileSizeBytes)})</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>Uploaded: {formatDate(ver.uploadedAt)}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span>By: {ver.uploadedBy || 'Investigator'}</span>
                        </div>
                      </div>

                      {ver.changesSummary && (
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-700 space-y-1">
                          <p className="font-semibold text-slate-800">Amendment Summary / Rationale:</p>
                          <p className="leading-relaxed">{ver.changesSummary}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

