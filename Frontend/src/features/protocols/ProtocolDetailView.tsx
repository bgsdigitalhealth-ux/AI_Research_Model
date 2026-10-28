import { useParams, Link, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { useProtocolDetail, useTriggerExtraction } from '@/hooks/useProtocols';
import { StatusState } from '@/components/shared/StatusState';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import {
  FileText,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Sliders,
  History,
  Download,
  Calendar,
  User,
  Shield,
  Layers,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2
} from 'lucide-react';

function formatFileSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProtocolDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: protocol, isLoading, isUnavailable, isError, errorDetail, refetch } = useProtocolDetail(id || '');
  const triggerExtractionMutation = useTriggerExtraction(id || '');

  const handleTriggerExtraction = async () => {
    try {
      await triggerExtractionMutation.mutateAsync();
      toast({
        title: 'AI Extraction Triggered',
        description: 'Protocol document is being processed for study parameters.',
        variant: 'success',
      });
      navigate(`/protocols/${id}/verify`);
    } catch (err: unknown) {
      toast({
        title: 'Extraction Request Failed',
        description: (err as { message?: string })?.message || 'Could not start AI extraction job.',
        variant: 'destructive',
      });
    }
  };

  return (
    <PageContainer
      title={protocol?.title || 'Protocol Overview'}
      description={`Protocol Version: v${protocol?.version || '1.0'} · Document Repository`}
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Protocols', path: '/protocols' },
        { label: protocol?.title || 'Protocol Details', isCurrent: true },
      ]}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/protocols">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              <span>Protocols List</span>
            </Button>
          </Link>

          <Link to={`/protocols/${id}/verify`}>
            <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
              <Sparkles className="h-4 w-4" />
              <span>Verification Workspace</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      }
    >
      {isUnavailable ? (
        <StatusState
          type="unavailable"
          title="Protocol Endpoint Unavailable"
          description={`Backend endpoint (/protocols/${id}) is not responding.`}
          endpoint={`/protocols/${id}`}
          action={{
            label: 'Retry Fetching Protocol',
            onClick: () => refetch(),
          }}
        />
      ) : isError ? (
        <StatusState
          type="error"
          title="Error Loading Protocol"
          description={errorDetail?.message || 'Protocol document metadata could not be retrieved.'}
          action={{
            label: 'Retry',
            onClick: () => refetch(),
          }}
        />
      ) : isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-96 lg:col-span-2 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
        </div>
      ) : !protocol ? (
        <StatusState
          type="empty"
          title="Protocol Not Found"
          description={`No protocol record exists for ID ${id}.`}
        />
      ) : (
        <div className="space-y-6">
          {/* Top Quick Actions Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link to={`/protocols/${id}/verify`} className="block">
              <Card className="hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer h-full">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">AI Extraction & Verification</h4>
                    <p className="text-[11px] text-slate-500">Review parameters & source citations</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to={`/protocols/${id}/study-configuration`} className="block">
              <Card className="hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer h-full">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
                    <Sliders className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Methods & Analysis Plan</h4>
                    <p className="text-[11px] text-slate-500">Configure statistical parameters</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to={`/protocols/${id}/versions`} className="block">
              <Card className="hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer h-full">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-slate-100 text-slate-700">
                    <History className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Version History & Audit</h4>
                    <p className="text-[11px] text-slate-500">Track amendments and revisions</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Main 2-Column Layout: Document Preview & Metadata Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Document Preview Pane */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="border-slate-200 shadow-sm overflow-hidden flex flex-col h-[650px]">
                <CardHeader className="py-3.5 px-5 bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Document Preview
                    </CardTitle>
                    {protocol.fileName && (
                      <span className="text-xs font-mono text-slate-500 truncate max-w-xs">
                        ({protocol.fileName})
                      </span>
                    )}
                  </div>

                  {protocol.fileUrl && (
                    <a
                      href={protocol.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download</span>
                    </a>
                  )}
                </CardHeader>

                <CardContent className="p-0 flex-1 bg-slate-100 relative">
                  {protocol.fileUrl ? (
                    <iframe
                      src={protocol.fileUrl}
                      title="Protocol Document Preview"
                      className="w-full h-full border-0"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-3">
                      <div className="p-4 rounded-full bg-white shadow-xs text-slate-400">
                        <FileText className="h-8 w-8" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-800">
                          Inline Document Viewer Unavailable
                        </h4>
                        <p className="text-xs text-slate-500 max-w-sm">
                          The backend did not provide a direct document stream URL (`fileUrl`) for inline rendering.
                        </p>
                      </div>
                      {protocol.fileName && (
                        <p className="font-mono text-xs text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                          {protocol.fileName} ({formatFileSize(protocol.fileSizeBytes)})
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right 1 Col: Metadata & Status Panel */}
            <div className="space-y-6">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="py-3.5 px-5 border-b border-slate-100">
                  <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Protocol Metadata
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-5 space-y-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Review Status</span>
                    <div>
                      <Badge variant="default" className="capitalize">
                        {protocol.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">AI Extraction Status</span>
                    <div>
                      <Badge
                        variant={
                          protocol.extractionStatus === 'completed'
                            ? 'success'
                            : protocol.extractionStatus === 'processing'
                            ? 'info'
                            : 'secondary'
                        }
                        className="capitalize"
                      >
                        {protocol.extractionStatus?.replace('_', ' ') || 'Not Started'}
                      </Badge>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <Layers className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-semibold">Version</p>
                        <p className="font-bold text-slate-800">v{protocol.version}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <Shield className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-semibold">IRB / Ethics Protocol</p>
                        <p className="font-bold text-slate-800">{protocol.irbApprovalNumber || 'Pending IRB Approval'}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <Calendar className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-semibold">Uploaded Date</p>
                        <p className="font-semibold text-slate-800">{formatDate(protocol.uploadedAt)}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <User className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-semibold">Uploaded By</p>
                        <p className="font-semibold text-slate-800">{protocol.uploadedBy || 'Investigator'}</p>
                      </div>
                    </div>
                  </div>

                  {/* AI Extraction Trigger Action */}
                  <div className="pt-4 border-t border-slate-100 space-y-2">
                    <Button
                      onClick={handleTriggerExtraction}
                      disabled={triggerExtractionMutation.isPending || protocol.extractionStatus === 'processing'}
                      className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                      size="sm"
                    >
                      {triggerExtractionMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Starting Extraction...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span>
                            {protocol.extractionStatus === 'completed'
                              ? 'Re-run AI Extraction'
                              : 'Run AI Extraction'}
                          </span>
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

