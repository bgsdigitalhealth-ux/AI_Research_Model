import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import {
  useQuestionnaireDetail,
  useQuestionnaireMappings,
  useSubmitForReview,
  useApproveQuestionnaire,
} from '@/hooks/useQuestionnaires';
import { useAuth } from '@/hooks/useAuth';
import { StatusState } from '@/components/shared/StatusState';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useToast } from '@/components/ui/use-toast';
import {
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Send,
  Lock,
  GitBranch,
  FileCheck,
  Sparkles,
  Layers,
  History
} from 'lucide-react';

export function QuestionnaireReviewView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();

  const {
    data: questionnaire,
    isLoading: isQLoading,
    isUnavailable: isQUnavailable,
    isError: isQError,
    errorDetail: qErrorDetail,
    refetch: refetchQ,
  } = useQuestionnaireDetail(id || '');

  const {
    data: mappings,
    isLoading: isMappingsLoading,
    isUnavailable: isMappingsUnavailable,
  } = useQuestionnaireMappings(id || '');

  const submitReviewMutation = useSubmitForReview(id || '');
  const approveMutation = useApproveQuestionnaire(id || '');

  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');

  const canApprove =
    isAuthenticated &&
    (user?.role === 'principal_investigator' ||
      user?.role === 'co_investigator');

  const questions = questionnaire?.questions || [];
  const requiredCount = questions.filter((q) => q.validation.required).length;
  const conditionalCount = questions.filter(
    (q) => q.conditionalLogic?.rules.length
  ).length;

  const handleSubmitForReview = async () => {
    try {
      await submitReviewMutation.mutateAsync();
      toast({
        title: 'Submitted for Review',
        description: 'Questionnaire moved to Under Review status.',
        variant: 'success',
      });
    } catch (err: unknown) {
      toast({
        title: 'Submission Failed',
        description: (err as { message?: string })?.message || 'Could not update review status.',
        variant: 'destructive',
      });
    }
  };

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync(approvalNotes);
      toast({
        title: 'Instrument Approved',
        description: 'Questionnaire is officially approved and ready for publishing.',
        variant: 'success',
      });
      navigate(`/questionnaires/${id}/versions`);
    } catch (err: unknown) {
      toast({
        title: 'Approval Failed',
        description: (err as { message?: string })?.message || 'Failed to approve questionnaire.',
        variant: 'destructive',
      });
    }
  };

  return (
    <PageContainer
      title="Questionnaire Instrument Review & Sign-Off"
      description={`Review scientific coverage, psychometric validity status, and investigator sign-off for "${questionnaire?.title || id}".`}
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Questionnaires', path: '/questionnaires' },
        { label: questionnaire?.title || 'Details', path: `/questionnaires/${id}/builder` },
        { label: 'Review', isCurrent: true },
      ]}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <Link to={`/questionnaires/${id}/builder`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Builder</span>
            </Button>
          </Link>

          {questionnaire?.status === 'draft' && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSubmitForReview}
              disabled={submitReviewMutation.isPending}
              className="gap-1.5"
            >
              <Send className="h-4 w-4 text-blue-600" />
              <span>Submit for Peer Review</span>
            </Button>
          )}

          {canApprove ? (
            <Button
              size="sm"
              onClick={() => setShowApprovalModal(true)}
              disabled={
                approveMutation.isPending ||
                questionnaire?.status === 'approved' ||
                questionnaire?.status === 'published'
              }
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>
                {questionnaire?.status === 'approved'
                  ? 'Already Approved'
                  : questionnaire?.status === 'published'
                  ? 'Published'
                  : 'Approve Instrument'}
              </span>
            </Button>
          ) : (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-xs border border-slate-200"
              title="Only Principal Investigators or Co-Investigators can approve questionnaires"
            >
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              <span>Approval Restricted to PI</span>
            </div>
          )}
        </div>
      }
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {isQUnavailable ? (
          <StatusState
            type="unavailable"
            title="Questionnaire Service Unavailable"
            description={`Backend endpoint (/questionnaires/${id}) could not be reached.`}
            endpoint={`/questionnaires/${id}`}
            action={{
              label: 'Retry Fetching Review',
              onClick: () => refetchQ(),
            }}
          />
        ) : isQError ? (
          <StatusState
            type="error"
            title="Failed to Load Questionnaire"
            description={qErrorDetail?.message || 'Could not load instrument for review.'}
            action={{
              label: 'Retry',
              onClick: () => refetchQ(),
            }}
          />
        ) : isQLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : !questionnaire ? (
          <StatusState
            type="empty"
            title="Questionnaire Not Found"
            description={`No questionnaire record exists for ID ${id}.`}
          />
        ) : (
          <div className="space-y-6">
            {/* Scientific Validation & Provenance Notice */}
            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 text-xs flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Instrument Classification & Validation Status</p>
                <p className="text-[11px] leading-relaxed text-blue-800">
                  {questionnaire.isAiGenerated
                    ? 'This instrument was initialized through automated AI questionnaire synthesis. In accordance with clinical trial integrity standards, AI-generated items remain in exploratory draft status until an authorized investigator formally approves them.'
                    : 'This instrument was authored directly by clinical study investigators.'}
                  {questionnaire.scientificValidationClaim
                    ? ` Reference claim: ${questionnaire.scientificValidationClaim}`
                    : ' No unsupported psychometric validity claim has been asserted.'}
                </p>
              </div>
            </div>

            {/* Instrument Pre-flight Overview */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Pre-Flight Readiness Checklist
                  </CardTitle>
                  <p className="text-xs text-slate-500">Structural integrity of survey items</p>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  Status: {questionnaire.status.toUpperCase()}
                </Badge>
              </CardHeader>

              <CardContent className="p-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Questions</span>
                    <p className="text-xl font-bold text-slate-900">{questions.length}</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Mandatory Fields</span>
                    <p className="text-xl font-bold text-rose-600">{requiredCount}</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Section Groups</span>
                    <p className="text-xl font-bold text-slate-900">{questionnaire.sections?.length || 0}</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Conditional Rules</span>
                    <p className="text-xl font-bold text-indigo-600">{conditionalCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Objective-to-Outcome-to-Question Coverage Mappings */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="py-4 px-6 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-900">
                  Objective & Outcome Coverage Mapping
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Dynamically checked against protocol endpoints (`/questionnaires/{id}/mappings`)
                </p>
              </CardHeader>

              <CardContent className="p-6">
                {isMappingsUnavailable ? (
                  <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-lg">
                    Objective-to-outcome mapping service is not configured for this study endpoint.
                  </div>
                ) : !mappings || mappings.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No explicit objective mapping records returned by the backend.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-y border-slate-100">
                        <tr>
                          <th className="py-2.5 px-4">Research Objective</th>
                          <th className="py-2.5 px-4">Target Outcome</th>
                          <th className="py-2.5 px-4">Covered Variables</th>
                          <th className="py-2.5 px-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {mappings.map((m) => (
                          <tr key={m.objectiveId} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 font-semibold text-slate-900">
                              {m.objectiveTitle}
                            </td>
                            <td className="py-3 px-4">{m.outcomeName}</td>
                            <td className="py-3 px-4 font-mono text-[11px]">
                              {m.coveredQuestionIds.length > 0 ? (
                                <span className="text-blue-600">
                                  {m.coveredQuestionIds.join(', ')}
                                </span>
                              ) : (
                                <span className="text-red-500 italic">None linked</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {m.isCovered ? (
                                <Badge variant="success" className="text-[10px]">
                                  Covered
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[10px]">
                                  Missing Coverage
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Confirmation Modal before Approving Questionnaire */}
        <ConfirmDialog
          open={showApprovalModal}
          onOpenChange={setShowApprovalModal}
          title="Approve Questionnaire for Clinical Use"
          description={`You are authorizing instrument "${questionnaire?.title || 'this questionnaire'}" (Version v${questionnaire?.version || '1.0'}) as scientifically sound and ready for publication.`}
          confirmLabel="Sign & Approve"
          cancelLabel="Cancel"
          onConfirm={handleApprove}
          isLoading={approveMutation.isPending}
        />
      </div>
    </PageContainer>
  );
}

