import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { useSurveyConsent } from '@/hooks/useDataCollection';
import { offlineDb } from '@/lib/indexedDb';
import { dataCollectionApi } from '@/api/dataCollectionApi';
import { StatusState } from '@/components/shared/StatusState';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import {
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  FileText,
  User,
  Shield,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { ConsentRecord } from '@/types/dataCollection';

export function ParticipantConsentView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: consentWording, isLoading, isUnavailable, isError, errorDetail, refetch } =
    useSurveyConsent(id || '');

  const [participantId, setParticipantId] = useState('');
  const [agreedInfo, setAgreedInfo] = useState(false);
  const [agreedStorage, setAgreedStorage] = useState(false);
  const [agreedVoluntary, setAgreedVoluntary] = useState(false);
  const [agreedFollowUp, setAgreedFollowUp] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isMandatoryConsentGiven = agreedInfo && agreedStorage && agreedVoluntary;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participantId.trim()) {
      setValidationError('Please specify a valid participant identifier code.');
      return;
    }

    if (!isMandatoryConsentGiven) {
      setValidationError('All mandatory informed consent checkboxes must be explicitly agreed to before proceeding.');
      return;
    }

    setValidationError(null);
    setIsSubmitting(true);

    const consentId = crypto.randomUUID();
    const consentRecord: ConsentRecord = {
      id: consentId,
      questionnaireId: id || '',
      questionnaireVersion: consentWording?.questionnaireVersion || '1.0',
      participantIdentifier: participantId.trim().toUpperCase(),
      consentedAt: new Date().toISOString(),
      agreedToParticipate: true,
      agreedToDataStorage: agreedStorage,
      agreedToContact: agreedFollowUp,
      agreedStatements: [
        'Read and understood participant information sheet',
        'Consented to electronic response storage for research purposes',
        'Acknowledged voluntary participation and right to withdraw',
      ],
    };

    try {
      // 1. Always store locally in IndexedDB first
      await offlineDb.saveConsentRecord(consentRecord);

      // 2. If online, attempt server registration (swallow failure if offline)
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await dataCollectionApi.submitConsent(consentRecord);
        } catch {
          // Will be transmitted alongside submission queue
        }
      }

      toast({
        title: 'Consent Recorded',
        description: `Subject ${consentRecord.participantIdentifier} consent verified.`,
        variant: 'success',
      });

      // Navigate to survey form
      navigate(
        `/surveys/${id}/respond?subj=${encodeURIComponent(consentRecord.participantIdentifier)}&consent=${encodeURIComponent(consentId)}`
      );
    } catch (err: unknown) {
      setValidationError((err as { message?: string })?.message || 'Failed to record consent.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer
      title="Participant Information & Informed Consent"
      description="Regulatory ethical disclosure and participant informed consent verification prior to data intake."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Data Collection', path: '/data-collection' },
        { label: 'Consent Verification', isCurrent: true },
      ]}
      actions={
        <Link to="/data-collection">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            <span>Cancel</span>
          </Button>
        </Link>
      }
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {isUnavailable ? (
          <StatusState
            type="unavailable"
            title="Consent Endpoint Unavailable"
            description={`Backend consent documentation endpoint (/surveys/${id}/consent) is disconnected.`}
            endpoint={`/surveys/${id}/consent`}
            action={{
              label: 'Retry Loading Consent Text',
              onClick: () => refetch(),
            }}
          />
        ) : isError ? (
          <StatusState
            type="error"
            title="Failed to Load Consent Protocol"
            description={errorDetail?.message || 'Could not retrieve approved participant consent wording.'}
            action={{
              label: 'Retry',
              onClick: () => refetch(),
            }}
          />
        ) : isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Participant Identifier Box */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-row items-center gap-2">
                <User className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-sm font-bold text-slate-900">
                  Participant Identifier Code *
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-2">
                <p className="text-xs text-slate-500">
                  Enter the de-identified participant subject code assigned for this study (e.g. SUBJ-1049, COHORT-B-02).
                </p>
                <Input
                  required
                  value={participantId}
                  onChange={(e) => setParticipantId(e.target.value.toUpperCase())}
                  placeholder="e.g. SUBJ-0042"
                  className="font-mono text-sm max-w-sm uppercase"
                />
              </CardContent>
            </Card>

            {/* Approved Participant Information Sheet */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Participant Information Sheet
                  </CardTitle>
                </div>
                {consentWording?.ethicsApprovalNumber && (
                  <Badge variant="outline" className="text-[10px] font-mono">
                    IRB: {consentWording.ethicsApprovalNumber}
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="p-6 space-y-4 text-xs text-slate-700 leading-relaxed max-h-72 overflow-y-auto bg-slate-50/50 rounded-b-xl">
                {consentWording?.informationSheetHtml ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: consentWording.informationSheetHtml }}
                  />
                ) : (
                  <div className="space-y-3">
                    <p>
                      <strong>Study Overview:</strong> You are invited to take part in a research study. Before you decide whether to participate, it is important for you to understand why the research is being done and what it will involve.
                    </p>
                    <p>
                      <strong>Voluntary Participation:</strong> Taking part in this survey is entirely voluntary. You may decline to answer any questions or withdraw from the study at any time without explanation and without affecting any current or future clinical care.
                    </p>
                    <p>
                      <strong>Confidentiality & Data Protection:</strong> All survey responses collected will be de-identified and held in secure research storage in accordance with applicable health information privacy and clinical research data standards.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Explicit Consent Agreements */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-row items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-sm font-bold text-slate-900">
                  Consent Declarations & Agreements
                </CardTitle>
              </CardHeader>

              <CardContent className="p-6 space-y-4 text-xs">
                {validationError && (
                  <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{validationError}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedInfo}
                      onChange={(e) => setAgreedInfo(e.target.checked)}
                      className="h-4 w-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-medium text-slate-800 leading-snug">
                      1. I confirm that I have read and understood the participant information sheet for this study and have had the opportunity to ask questions. *
                    </span>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedStorage}
                      onChange={(e) => setAgreedStorage(e.target.checked)}
                      className="h-4 w-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-medium text-slate-800 leading-snug">
                      2. I understand that my responses will be processed, stored, and analyzed by the study investigators in a de-identified format. *
                    </span>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedVoluntary}
                      onChange={(e) => setAgreedVoluntary(e.target.checked)}
                      className="h-4 w-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-medium text-slate-800 leading-snug">
                      3. I agree to participate in this study and understand that my participation is voluntary and that I may withdraw at any time. *
                    </span>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedFollowUp}
                      onChange={(e) => setAgreedFollowUp(e.target.checked)}
                      className="h-4 w-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-600 leading-snug">
                      4. (Optional) I agree that the research team may contact me for future follow-up assessments relevant to this protocol.
                    </span>
                  </label>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3 pt-2">
              <Link to="/data-collection">
                <Button type="button" variant="outline" size="sm">
                  Cancel
                </Button>
              </Link>

              <Button
                type="submit"
                size="sm"
                disabled={!isMandatoryConsentGiven || !participantId.trim() || isSubmitting}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Confirm Consent & Begin Survey</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        )}
      </div>
    </PageContainer>
  );
}

