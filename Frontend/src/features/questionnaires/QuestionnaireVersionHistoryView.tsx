import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import {
  useQuestionnaireDetail,
  useQuestionnaireVersions,
  usePublishQuestionnaire,
  useCreateNewVersion,
} from '@/hooks/useQuestionnaires';
import { useAuth } from '@/hooks/useAuth';
import { StatusState } from '@/components/shared/StatusState';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import {
  History,
  ArrowLeft,
  Upload,
  Lock,
  GitBranch,
  Calendar,
  User,
  CheckCircle2,
  AlertCircle,
  FileText
} from 'lucide-react';
import { QuestionnaireStatus } from '@/types/questionnaire';

const STATUS_BADGES: Record<
  QuestionnaireStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' }
> = {
  draft: { label: 'Draft', variant: 'secondary' },
  under_review: { label: 'Under Review', variant: 'warning' },
  approved: { label: 'Approved', variant: 'info' },
  published: { label: 'Published (Locked)', variant: 'success' },
  archived: { label: 'Archived', variant: 'secondary' },
};

export function QuestionnaireVersionHistoryView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();

  const { data: questionnaire } = useQuestionnaireDetail(id || '');
  const {
    data: versions,
    isLoading,
    isUnavailable,
    isError,
    errorDetail,
    refetch,
  } = useQuestionnaireVersions(id || '');

  const publishMutation = usePublishQuestionnaire(id || '');
  const newVersionMutation = useCreateNewVersion(id || '');

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');

  const canPublish =
    isAuthenticated &&
    (user?.role === 'principal_investigator' ||
      user?.role === 'co_investigator');

  const isApproved = questionnaire?.status === 'approved';
  const isPublished = questionnaire?.status === 'published';

  const handlePublish = async () => {
    try {
      await publishMutation.mutateAsync(changeSummary);
      toast({
        title: 'Questionnaire Published',
        description: `Version v${questionnaire?.version || '1.0'} is now published and locked for participant intake.`,
        variant: 'success',
      });
      setShowPublishModal(false);
      setChangeSummary('');
    } catch (err: unknown) {
      toast({
        title: 'Publish Failed',
        description: (err as { message?: string })?.message || 'Failed to publish questionnaire.',
        variant: 'destructive',
      });
    }
  };

  const handleBranchNewVersion = async () => {
    try {
      const branched = await newVersionMutation.mutateAsync();
      toast({
        title: 'New Version Created',
        description: `Draft v${branched.version} branched from published instrument.`,
        variant: 'success',
      });
      navigate(`/questionnaires/${branched.id}/builder`);
    } catch (err: unknown) {
      toast({
        title: 'Branching Failed',
        description: (err as { message?: string })?.message || 'Could not branch new version.',
        variant: 'destructive',
      });
    }
  };

  return (
    <PageContainer
      title="Questionnaire Versioning & Publishing"
      description={`Version audit timeline and release controls for "${questionnaire?.title || id}".`}
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Questionnaires', path: '/questionnaires' },
        { label: questionnaire?.title || 'Details', path: `/questionnaires/${id}/builder` },
        { label: 'Versions & Publishing', isCurrent: true },
      ]}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <Link to={`/questionnaires/${id}/builder`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Builder</span>
            </Button>
          </Link>

          {isPublished && (
            <Button
              size="sm"
              onClick={handleBranchNewVersion}
              disabled={newVersionMutation.isPending}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <GitBranch className="h-4 w-4" />
              <span>Branch New Draft Version</span>
            </Button>
          )}

          {canPublish && (
            <Button
              size="sm"
              onClick={() => setShowPublishModal(true)}
              disabled={publishMutation.isPending || isPublished || !isApproved}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              title={
                !isApproved
                  ? 'Instrument must be reviewed and approved prior to publishing'
                  : 'Publish locked version'
              }
            >
              <Lock className="h-4 w-4" />
              <span>{isPublished ? 'Published & Locked' : 'Publish Questionnaire'}</span>
            </Button>
          )}
        </div>
      }
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Status Callout Banner */}
        {isPublished ? (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold">Active Published Release (Immutable)</p>
                <p className="text-[11px] text-emerald-800">
                  Version v{questionnaire?.version} is published and receiving participant data collection responses. Schema modifications require branching a new draft version.
                </p>
              </div>
            </div>

            <Button
              size="sm"
              onClick={handleBranchNewVersion}
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs shrink-0"
            >
              Branch v{(parseFloat(questionnaire?.version || '1.0') + 0.1).toFixed(1)}
            </Button>
          </div>
        ) : !isApproved ? (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Pre-Publishing Approval Required</p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                This instrument is currently in <strong>{questionnaire?.status.replace('_', ' ').toUpperCase()}</strong> status. You must complete the{' '}
                <Link to={`/questionnaires/${id}/review`} className="underline font-semibold">
                  Review & Sign-Off workflow
                </Link>{' '}
                before this version can be published.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Instrument Approved & Ready to Publish</p>
              <p className="text-[11px] text-blue-800 mt-0.5">
                Investigator sign-off is complete. Publishing will lock Version v{questionnaire?.version} for live data collection.
              </p>
            </div>
          </div>
        )}

        {/* Versions Timeline */}
        {isUnavailable ? (
          <StatusState
            type="unavailable"
            title="Versioning Service Unavailable"
            description={`Backend version audit endpoint (/questionnaires/${id}/versions) is currently unreachable.`}
            endpoint={`/questionnaires/${id}/versions`}
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
            {[1, 2].map((i) => (
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
            title="No Published Version History Found"
            description="This questionnaire has not published multiple releases yet. When you publish or branch versions, they will appear in this audit log."
          />
        ) : (
          <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-6">
            {versions.map((ver) => {
              const isCurrent = ver.versionNumber === questionnaire?.version;
              const statusMeta = STATUS_BADGES[ver.status] || STATUS_BADGES.draft;

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
                              Active Release
                            </Badge>
                          )}
                          <Badge variant={statusMeta.variant} className="text-[10px]">
                            {statusMeta.label}
                          </Badge>
                        </div>

                        <span className="text-xs text-slate-500">
                          {ver.questionCount} Questions in Schema
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>
                            {ver.publishedAt
                              ? `Published: ${formatDate(ver.publishedAt)}`
                              : 'Draft / Unreleased'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span>By: {ver.publishedBy || 'Investigator'}</span>
                        </div>
                      </div>

                      {ver.changeSummary && (
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-700 space-y-1">
                          <p className="font-semibold text-slate-800">Version Changelog / Scope:</p>
                          <p className="leading-relaxed">{ver.changeSummary}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        )}

        {/* Publish Confirmation Dialog */}
        <ConfirmDialog
          open={showPublishModal}
          onOpenChange={setShowPublishModal}
          title="Publish Questionnaire Version"
          description={`Publishing locks Version v${questionnaire?.version || '1.0'} as immutable. Participants will receive this exact question schema during data collection. Any subsequent changes will require branching a new draft version.`}
          confirmLabel="Confirm & Publish"
          cancelLabel="Cancel"
          onConfirm={handlePublish}
          isLoading={publishMutation.isPending}
        />
      </div>
    </PageContainer>
  );
}

