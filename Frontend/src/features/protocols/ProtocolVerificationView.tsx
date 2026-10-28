import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import {
  useProtocolDetail,
  useProtocolExtraction,
  useUpdateFieldVerification,
  useApproveProtocolExtraction,
  useTriggerExtraction,
} from '@/hooks/useProtocols';
import { useAuth } from '@/hooks/useAuth';
import { StatusState } from '@/components/shared/StatusState';
import { FieldVerificationCard } from './components/FieldVerificationCard';
import { SourceEvidenceViewer } from './components/SourceEvidenceViewer';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import {
  ExtractedField,
  ExtractedFieldStatus,
  ProtocolExtractionFields,
} from '@/types/protocol';
import {
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Lock,
  Layers,
  RotateCcw
} from 'lucide-react';

export function ProtocolVerificationView() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();

  const {
    data: protocol,
    isLoading: isProtocolLoading,
    isUnavailable: isProtocolUnavailable,
  } = useProtocolDetail(id || '');

  const {
    data: extractionData,
    isLoading: isExtractionLoading,
    isUnavailable: isExtractionUnavailable,
    isError: isExtractionError,
    errorDetail: extractionErrorDetail,
    refetch: refetchExtraction,
  } = useProtocolExtraction(id || '');

  const updateFieldMutation = useUpdateFieldVerification(id || '');
  const approveExtractionMutation = useApproveProtocolExtraction(id || '');
  const triggerExtractionMutation = useTriggerExtraction(id || '');

  const [selectedFieldKey, setSelectedFieldKey] = useState<string>('studyTitle');
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');

  // Check researcher approval permissions: Principal Investigator or Co-Investigator or Admin
  const canApprove =
    isAuthenticated &&
    (user?.role === 'principal_investigator' ||
      user?.role === 'co_investigator');

  const fields = extractionData?.fields;

  // Flatten fields into an array for counting and mapping
  const fieldEntries: ExtractedField<unknown>[] = fields
    ? [
        fields.studyTitle,
        fields.researchAims,
        fields.studyDesign,
        fields.targetPopulation,
        fields.inclusionCriteria,
        fields.exclusionCriteria,
        fields.samplingMethod,
        fields.sampleSize,
        fields.primaryOutcomes,
        fields.secondaryOutcomes,
        fields.variablesAndInstruments,
        fields.dataCollectionMethods,
        fields.statisticalAnalysisPlan,
      ].filter(Boolean)
    : [];

  const verifiedCount = fieldEntries.filter(
    (f) => f.status === 'accepted' || f.status === 'edited'
  ).length;

  const selectedField = fieldEntries.find((f) => f.key === selectedFieldKey) || fieldEntries[0];

  const handleUpdateStatus = async (
    fieldKey: string,
    status: ExtractedFieldStatus,
    verifiedValue?: unknown,
    reviewerNotes?: string,
    flagReason?: string
  ) => {
    try {
      await updateFieldMutation.mutateAsync({
        fieldKey,
        status,
        verifiedValue,
        reviewerNotes,
        flagReason,
      });
      toast({
        title: 'Parameter Updated',
        description: `Field status set to "${status}".`,
        variant: 'success',
      });
    } catch (err: unknown) {
      toast({
        title: 'Update Failed',
        description: (err as { message?: string })?.message || 'Could not save field verification status.',
        variant: 'destructive',
      });
    }
  };

  const handleApprove = async () => {
    try {
      await approveExtractionMutation.mutateAsync({ notes: approvalNotes });
      toast({
        title: 'Protocol Approved',
        description: 'Verified research protocol metadata has been officially signed off.',
        variant: 'success',
      });
    } catch (err: unknown) {
      toast({
        title: 'Approval Failed',
        description: (err as { message?: string })?.message || 'Failed to approve protocol extraction.',
        variant: 'destructive',
      });
    }
  };

  const handleTriggerExtraction = async () => {
    try {
      await triggerExtractionMutation.mutateAsync();
      toast({
        title: 'Extraction Started',
        description: 'Backend extraction service is processing the document.',
      });
    } catch (err: unknown) {
      toast({
        title: 'Trigger Failed',
        description: (err as { message?: string })?.message || 'Could not start AI extraction.',
        variant: 'destructive',
      });
    }
  };

  return (
    <PageContainer
      title="Protocol Verification Workspace"
      description="Researcher verification of AI-extracted clinical protocol parameters against original source document evidence."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Protocols', path: '/protocols' },
        { label: protocol?.title || 'Details', path: `/protocols/${id}` },
        { label: 'Verification', isCurrent: true },
      ]}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <Link to={`/protocols/${id}`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Overview</span>
            </Button>
          </Link>

          {/* Permission-Aware Protocol Approval Button */}
          {canApprove ? (
            <Button
              size="sm"
              onClick={() => setShowApprovalDialog(true)}
              disabled={approveExtractionMutation.isPending || !fields}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Approve Protocol Metadata</span>
            </Button>
          ) : (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-xs border border-slate-200"
              title="Only Principal Investigators or Co-Investigators can approve protocol metadata"
            >
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              <span>Approval Restricted to PI</span>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Verification Progress Banner */}
        {fields && (
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Verification Audit Status
                </span>
                <Badge variant={verifiedCount === fieldEntries.length ? 'success' : 'warning'}>
                  {verifiedCount} of {fieldEntries.length} Verified
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                All extracted parameters must be reviewed and verified by the clinical study team.
              </p>
            </div>

            {/* Model Metadata strip (from backend only) */}
            {extractionData?.modelMetadata && (
              <div className="text-right text-[11px] text-slate-400 font-mono">
                {extractionData.modelMetadata.modelName && (
                  <div>Engine: {extractionData.modelMetadata.modelName}</div>
                )}
                {extractionData.modelMetadata.extractedAt && (
                  <div>
                    Processed: {new Date(extractionData.modelMetadata.extractedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Dynamic State Handling for Extraction */}
        {isExtractionUnavailable ? (
          <StatusState
            type="unavailable"
            title="Extraction Endpoint Unavailable"
            description={`Backend extraction endpoint (/protocols/${id}/extraction) is not responding or not implemented.`}
            endpoint={`/protocols/${id}/extraction`}
            action={{
              label: 'Retry Fetching Extraction',
              onClick: () => refetchExtraction(),
            }}
          />
        ) : isExtractionError ? (
          <StatusState
            type="error"
            title="Error Loading Extraction Data"
            description={extractionErrorDetail?.message || 'Failed to retrieve extraction results from the backend.'}
            action={{
              label: 'Retry',
              onClick: () => refetchExtraction(),
            }}
          />
        ) : isExtractionLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5">
              <Skeleton className="h-[600px] rounded-xl" />
            </div>
            <div className="lg:col-span-7 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          </div>
        ) : extractionData?.status === 'processing' || extractionData?.status === 'queued' ? (
          <div className="p-12 text-center rounded-xl border border-dashed border-blue-300 bg-blue-50/40 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <Loader2 className="h-7 w-7 animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                AI Extraction In Progress
              </h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                The backend service is actively parsing the document structure, identifying statistical parameters, and linking source citations.
              </p>
            </div>
            <Badge variant="info">Status: {extractionData.status.toUpperCase()}</Badge>
          </div>
        ) : extractionData?.status === 'not_started' || !fields ? (
          <div className="p-12 text-center rounded-xl border border-dashed border-slate-300 bg-white space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Extraction Has Not Been Run
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No automated extraction results exist for this protocol yet. Trigger the backend extraction pipeline to extract research parameters.
              </p>
            </div>
            <Button
              onClick={handleTriggerExtraction}
              disabled={triggerExtractionMutation.isPending}
              className="gap-2"
              size="sm"
            >
              <Sparkles className="h-4 w-4" />
              <span>
                {triggerExtractionMutation.isPending ? 'Starting Extraction...' : 'Run Extraction'}
              </span>
            </Button>
          </div>
        ) : (
          /* Two-Pane Workspace: Left Source Evidence & Right Extracted Fields */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Pane: Document Source Reference & Evidence Citation */}
            <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
              <SourceEvidenceViewer
                selectedFieldLabel={selectedField?.label}
                evidence={selectedField?.evidence}
                uncertainty={selectedField?.uncertainty}
                isMissing={selectedField?.isMissing}
              />
            </div>

            {/* Right Pane: Extracted Fields Review List */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between pb-1">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Extracted Study Parameters ({fieldEntries.length} Items)
                </h3>
                <span className="text-[11px] text-slate-400">
                  Click any card to inspect document source text
                </span>
              </div>

              {fieldEntries.map((field) => (
                <FieldVerificationCard
                  key={field.key}
                  field={field}
                  isSelected={selectedField?.key === field.key}
                  onSelect={() => setSelectedFieldKey(field.key)}
                  onUpdateStatus={handleUpdateStatus}
                  isLoading={updateFieldMutation.isPending}
                />
              ))}
            </div>
          </div>
        )}

        {/* Confirmation Dialog before Approval */}
        <ConfirmDialog
          open={showApprovalDialog}
          onOpenChange={setShowApprovalDialog}
          title="Approve Protocol Metadata"
          description={`You are officially signing off on ${verifiedCount} of ${fieldEntries.length} verified parameters for protocol "${protocol?.title || 'this study'}". Once approved, study methodology and analysis plans will be locked to these verified definitions.`}
          confirmLabel="Sign & Approve"
          cancelLabel="Continue Review"
          onConfirm={handleApprove}
          isLoading={approveExtractionMutation.isPending}
        />
      </div>
    </PageContainer>
  );
}

