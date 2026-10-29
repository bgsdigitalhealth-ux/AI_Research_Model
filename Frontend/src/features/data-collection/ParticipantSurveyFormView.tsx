import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { useQuestionnaireDetail } from '@/hooks/useQuestionnaires';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { offlineDb } from '@/lib/indexedDb';
import { dataCollectionApi } from '@/api/dataCollectionApi';
import { questionnairesApi } from '@/api/questionnairesApi';
import { StatusState } from '@/components/shared/StatusState';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import {
  Questionnaire,
  QuestionItem,
  ConditionalRule,
} from '@/types/questionnaire';
import {
  ConsentRecord,
  LocalSurveyDraft,
  QueuedSubmission,
} from '@/types/dataCollection';
import {
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff,
  Save,
  Send,
  ArrowLeft,
  Database,
  Lock,
  Loader2,
  HardDrive,
  FileSpreadsheet,
  MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function ParticipantSurveyFormView() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isOnline, syncSubmission } = useOfflineSync();

  const participantId = searchParams.get('subj') || '';
  const consentId = searchParams.get('consent') || '';

  // Survey data state (online or offline cache)
  const [survey, setSurvey] = useState<Questionnaire | null>(null);
  const [consentRecord, setConsentRecord] = useState<ConsentRecord | null>(null);
  const [isLoadingSchema, setIsLoadingSchema] = useState(true);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [lastDraftSaved, setLastDraftSaved] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionCompleted, setSubmissionCompleted] = useState<QueuedSubmission | null>(null);

  const draftKey = `${id}_${participantId}`;

  // Dynamic Score Calculation & Maturity Benchmark (Image 2)
  const scoreStats = React.useMemo(() => {
    let earned = 0;
    let maxPossible = 0;
    let answeredCount = 0;
    const questions = survey?.questions || [];

    questions.forEach((q) => {
      if (q.type === 'section_heading') return;
      const val = responses[q.id];
      let questionMax = 0;

      if (q.choices && q.choices.length > 0) {
        q.choices.forEach((c, idx) => {
          const fallback = q.choices!.length === 6 ? idx * 2 : idx + 1;
          const sc = c.score !== undefined ? c.score : fallback;
          if (sc > questionMax) questionMax = sc;

          if (val !== undefined && String(val).toLowerCase() === String(c.code).toLowerCase()) {
            earned += sc;
            answeredCount += 1;
          }
        });
      } else {
        questionMax = 10;
        if (val !== undefined && val !== '') answeredCount += 1;
      }

      maxPossible += (questionMax > 0 ? questionMax : 10);
    });

    const percentage = maxPossible > 0 ? (earned / maxPossible) * 100 : 0;
    let benchmarkLevel = 'Not available (Score 0)';

    if (percentage >= 90) benchmarkLevel = 'Mature / exemplary (Score 10)';
    else if (percentage >= 70) benchmarkLevel = 'Consistently implemented (Score 8)';
    else if (percentage >= 50) benchmarkLevel = 'Implemented (Score 6)';
    else if (percentage >= 30) benchmarkLevel = 'Partially implemented (Score 4)';
    else if (percentage >= 10) benchmarkLevel = 'Initial (Score 2)';

    return { earned, maxPossible, answeredCount, percentage, benchmarkLevel };
  }, [survey, responses]);

  const handleExportExcel = async () => {
    if (!survey) return;
    try {
      setIsExporting(true);
      try {
        const blob = await questionnairesApi.exportResponsesExcel(survey.id, {
          responses,
          remarks,
          participantId,
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${survey.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${participantId}_Score_Report.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        toast({ title: 'Excel Export Completed', variant: 'success' });
        return;
      } catch (err) {
        console.warn('Backend export failed, falling back to client-side XLSX generation', err);
      }

      const XLSX = await import('xlsx');
      const rows: any[][] = [];
      rows.push([`${survey.title.toUpperCase()} - PARTICIPANT ASSESSMENT REPORT`]);
      rows.push([`Subject: ${participantId} | Date: ${new Date().toISOString()}`]);
      rows.push(['']);
      rows.push(['No.', 'Question', 'Response (select one)', 'Score', 'Remarks']);

      let qIdx = 0;
      (survey.questions || []).forEach((q) => {
        if (q.type === 'section_heading') return;
        qIdx += 1;
        const val = responses[q.id];
        let chosenLabel = '(No response selected)';
        let chosenScore = 0;

        if (q.choices && q.choices.length > 0) {
          q.choices.forEach((c, idx) => {
            const fallback = q.choices!.length === 6 ? idx * 2 : idx + 1;
            const sc = c.score !== undefined ? c.score : fallback;
            if (val !== undefined && String(val).toLowerCase() === String(c.code).toLowerCase()) {
              chosenLabel = c.label;
              chosenScore = sc;
            }
          });
        }

        const userRemark = remarks[q.id] || q.remark || '';
        rows.push([qIdx, q.text, chosenLabel, chosenScore, userRemark]);
      });

      rows.push(['']);
      rows.push(['TOTAL SCORE', '', '', scoreStats.earned, `Earned ${scoreStats.earned} out of ${scoreStats.maxPossible} maximum points`]);
      rows.push(['PERCENTAGE ACHIEVED', '', '', `${scoreStats.percentage.toFixed(1)}%`, '']);
      rows.push(['OVERALL MATURITY LEVEL', '', '', scoreStats.benchmarkLevel, 'Standardized 6-Level Maturity Framework Benchmark']);

      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      worksheet['!cols'] = [{ wch: 8 }, { wch: 52 }, { wch: 30 }, { wch: 16 }, { wch: 38 }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Score Report');
      XLSX.writeFile(workbook, `${survey.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${participantId}_Score_Report.xlsx`);
      toast({ title: 'Excel Export Completed', variant: 'success' });
    } catch (e: unknown) {
      toast({ title: 'Export Failed', description: (e as Error)?.message, variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };


  // 1. Verify consent and load survey schema (Online or Offline IndexedDB)
  useEffect(() => {
    async function initSurvey() {
      setIsLoadingSchema(true);

      // Verify consent in IndexedDB
      if (!consentId || !participantId) {
        navigate(`/surveys/${id}/consent`, { replace: true });
        return;
      }

      const consent = await offlineDb.getConsentRecord(consentId);
      if (!consent || !consent.agreedToParticipate) {
        toast({
          title: 'Consent Required',
          description: 'Informed consent must be recorded before opening survey.',
          variant: 'destructive',
        });
        navigate(`/surveys/${id}/consent`, { replace: true });
        return;
      }
      setConsentRecord(consent);

      // Load survey schema: check offline cache first or online API
      let loadedSurvey: Questionnaire | null = null;
      try {
        const cached = await offlineDb.getCachedQuestionnaireById(id || '');
        if (cached) {
          loadedSurvey = cached.questionnaire;
        }
      } catch {
        // cache read fallback
      }

      if (!loadedSurvey && isOnline && id) {
        try {
          const res = await dataCollectionApi.getPublishedSurveys();
          loadedSurvey = res.find((s) => s.id === id) || null;
        } catch {
          // api fallback
        }
      }

      setSurvey(loadedSurvey);

      // 2. Load existing in-progress local draft from IndexedDB
      if (loadedSurvey) {
        try {
          const draft = await offlineDb.getLocalDraft(draftKey);
          if (draft && draft.answers) {
            setResponses(draft.answers);
            setLastDraftSaved(draft.lastSavedAt);
          }
        } catch {
          // draft read fallback
        }
      }

      setIsLoadingSchema(false);
    }

    initSurvey();
  }, [id, participantId, consentId, isOnline, draftKey, navigate, toast]);

  // Conditional Logic Evaluator
  const evaluateRule = (rule: ConditionalRule, userResponses: Record<string, unknown>): boolean => {
    const rawVal = userResponses[rule.targetQuestionId];
    const targetVal = rule.value;

    switch (rule.operator) {
      case 'is_empty':
        return rawVal === undefined || rawVal === null || rawVal === '' || (Array.isArray(rawVal) && rawVal.length === 0);
      case 'is_not_empty':
        return rawVal !== undefined && rawVal !== null && rawVal !== '' && (!Array.isArray(rawVal) || rawVal.length > 0);
      case 'equals':
        return Array.isArray(rawVal) ? rawVal.includes(targetVal) : String(rawVal ?? '') === String(targetVal ?? '');
      case 'not_equals':
        return Array.isArray(rawVal) ? !rawVal.includes(targetVal) : String(rawVal ?? '') !== String(targetVal ?? '');
      case 'contains':
        return Array.isArray(rawVal) ? rawVal.includes(targetVal) : String(rawVal ?? '').toLowerCase().includes(String(targetVal ?? '').toLowerCase());
      case 'greater_than':
        return Number(rawVal) > Number(targetVal);
      case 'less_than':
        return Number(rawVal) < Number(targetVal);
      default:
        return true;
    }
  };

  const isQuestionVisible = (q: QuestionItem): boolean => {
    if (!q.conditionalLogic || !q.conditionalLogic.rules.length) return true;
    const { action, match, rules } = q.conditionalLogic;
    const evaluated = rules.map((r) => evaluateRule(r, responses));
    const matched = match === 'all' ? evaluated.every(Boolean) : evaluated.some(Boolean);
    return action === 'show' ? matched : !matched;
  };

  // Auto-save local draft on input changes to IndexedDB
  const handleAnswerChange = async (questionId: string, val: unknown) => {
    const nextResponses = { ...responses, [questionId]: val };
    setResponses(nextResponses);

    if (validationErrors[questionId]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }

    // Persist draft to IndexedDB
    try {
      const now = new Date().toISOString();
      const draft: LocalSurveyDraft = {
        id: draftKey,
        questionnaireId: id || '',
        questionnaireVersion: survey?.version || '1.0',
        participantIdentifier: participantId,
        answers: nextResponses,
        lastSavedAt: now,
        completionPercentage: 0,
      };
      await offlineDb.saveLocalDraft(draft);
      setLastDraftSaved(now);
    } catch {
      // IndexedDB write fallback
    }
  };

  // Submit survey responses
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!survey || !consentRecord) return;

    // Validate responses against survey schema
    const errors: Record<string, string> = {};
    const visibleQuestions = survey.questions.filter(isQuestionVisible);

    visibleQuestions.forEach((q) => {
      if (q.type === 'section_heading') return;
      const val = responses[q.id];

      // Required check
      if (q.validation.required) {
        if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
          errors[q.id] = q.validation.customErrorMessage || 'This question requires an answer.';
          return;
        }
      }

      // Min/Max numeric
      if (['integer', 'decimal', 'rating_5'].includes(q.type) && val !== undefined && val !== '') {
        const num = Number(val);
        if (q.validation.min !== undefined && num < q.validation.min) {
          errors[q.id] = `Cannot be less than ${q.validation.min}.`;
        }
        if (q.validation.max !== undefined && num > q.validation.max) {
          errors[q.id] = `Cannot be greater than ${q.validation.max}.`;
        }
      }
    });

    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast({
        title: 'Validation Incomplete',
        description: `Please answer ${Object.keys(errors).length} mandatory field(s).`,
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    // Generate stable UUID idempotency key
    const submissionId = crypto.randomUUID();
    const submission: QueuedSubmission = {
      id: submissionId,
      questionnaireId: survey.id,
      questionnaireTitle: survey.title,
      questionnaireVersion: survey.version,
      studyId: survey.studyId,
      participantIdentifier: participantId,
      answers: responses,
      consentRecord,
      status: 'pending',
      createdAt: new Date().toISOString(),
      attempts: 0,
    };

    try {
      // 1. Enqueue in IndexedDB
      await offlineDb.enqueueSubmission(submission);

      // 2. Clean up in-progress draft
      await offlineDb.deleteLocalDraft(draftKey);

      // 3. Attempt immediate synchronization if online
      if (isOnline) {
        const success = await syncSubmission(submission);
        if (success) {
          submission.status = 'synchronized';
          toast({
            title: 'Survey Submitted & Confirmed',
            description: 'Responses successfully acknowledged by research server.',
            variant: 'success',
          });
        } else {
          submission.status = 'failed';
          toast({
            title: 'Saved to Offline Queue',
            description: 'Server upload failed; submission preserved in local queue.',
          });
        }
      } else {
        toast({
          title: 'Preserved in Offline Queue',
          description: 'Responses stored in IndexedDB. Will sync when reconnected.',
        });
      }

      setSubmissionCompleted(submission);
    } catch (err: unknown) {
      toast({
        title: 'Storage Error',
        description: (err as { message?: string })?.message || 'Could not queue local submission.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQuestionInput = (q: QuestionItem) => {
    const val = responses[q.id];

    switch (q.type) {
      case 'short_text':
        return (
          <input
            type="text"
            value={String(val ?? '')}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            placeholder="Type answer..."
            className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        );

      case 'long_text':
        return (
          <textarea
            rows={3}
            value={String(val ?? '')}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            placeholder="Type response..."
            className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-sans"
          />
        );

      case 'integer':
      case 'decimal':
        return (
          <input
            type="number"
            step={q.type === 'decimal' ? '0.01' : '1'}
            value={String(val ?? '')}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            className="w-48 rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={String(val ?? '')}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            className="w-48 rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        );

      case 'time':
        return (
          <input
            type="time"
            value={String(val ?? '')}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            className="w-40 rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        );

      case 'single_choice':
        return (
          <div className="space-y-2">
            {(q.choices || []).map((choice) => {
              const isSelected = val === choice.code;
              return (
                <label
                  key={choice.id}
                  className={cn(
                    "flex items-center justify-between gap-3 p-2.5 rounded-lg border cursor-pointer text-xs transition-all",
                    isSelected
                      ? "border-blue-500 bg-blue-50/50 text-blue-950 ring-1 ring-blue-500/20"
                      : "border-slate-200 bg-white hover:bg-slate-50 text-slate-800"
                  )}
                >
                  <div className="flex items-center gap-2.5 flex-1">
                    <input
                      type="radio"
                      name={`survey_q_${q.id}`}
                      checked={isSelected}
                      onChange={() => handleAnswerChange(q.id, choice.code)}
                      className="h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    <span className="font-medium text-[11px]">{choice.label}</span>
                  </div>

                </label>
              );
            })}
          </div>
        );

      case 'multiple_choice':
        const checkedList = Array.isArray(val) ? (val as string[]) : [];
        return (
          <div className="space-y-2">
            {(q.choices || []).map((choice) => {
              const isChecked = checkedList.includes(choice.code);
              return (
                <label
                  key={choice.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer text-xs text-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...checkedList, choice.code]
                        : checkedList.filter((c) => c !== choice.code);
                      handleAnswerChange(q.id, next);
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium">{choice.label}</span>
                </label>
              );
            })}
          </div>
        );

      case 'rating_5':
      case 'likert_5':
        const choices =
          q.choices && q.choices.length > 0
            ? q.choices
            : [
                { id: '1', code: '1', label: '1 - Low', score: 1 },
                { id: '2', code: '2', label: '2', score: 2 },
                { id: '3', code: '3', label: '3 - Neutral', score: 3 },
                { id: '4', code: '4', label: '4', score: 4 },
                { id: '5', code: '5', label: '5 - High', score: 5 },
              ];

        return (
          <div className="flex flex-wrap items-center gap-2">
            {choices.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleAnswerChange(q.id, c.code)}
                className={cn(
                  'px-3.5 py-2.5 rounded-lg border text-xs font-semibold transition-all',
                  val === c.code
                    ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  // Completion Confirmation Screen
  if (submissionCompleted) {
    const isSynced = submissionCompleted.status === 'synchronized';

    return (
      <PageContainer
        title="Participant Survey Submission Completed"
        description={`Record for participant ${participantId} registered.`}
      >
        <div className="max-w-xl mx-auto py-8">
          <Card className="border-slate-200 shadow-sm text-center p-8 space-y-4">
            <div
              className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
                isSynced ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
              }`}
            >
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">
                {isSynced ? 'Response Confirmed by Server' : 'Response Preserved in Local Queue'}
              </h3>
              <p className="text-xs text-slate-600">
                {isSynced
                  ? 'Server acknowledgement successfully logged. This survey record is officially archived.'
                  : 'Your device is operating offline or network synchronization is pending. Responses are safely stored in IndexedDB.'}
              </p>
            </div>

            {/* Submission Audit Metadata */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2 font-mono">
              <div>
                <span className="text-slate-400">Submission Idempotency Key:</span>
                <p className="text-slate-900 font-bold break-all">{submissionCompleted.id}</p>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="text-slate-400">Participant:</span>
                <span className="font-bold text-slate-800">{submissionCompleted.participantIdentifier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Questionnaire Version:</span>
                <span className="text-slate-800">v{submissionCompleted.questionnaireVersion}</span>
              </div>
              {submissionCompleted.serverAcknowledgement && (
                <div className="flex justify-between border-t border-slate-200 pt-1.5 text-emerald-700">
                  <span>Server Receipt Confirmation:</span>
                  <span className="font-bold">{submissionCompleted.serverAcknowledgement.confirmationId}</span>
                </div>
              )}
            </div>

            <div className="flex justify-center gap-3 pt-3">
              <Link to="/data-collection/queue">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Database className="h-4 w-4" />
                  <span>View Offline Queue</span>
                </Button>
              </Link>

              <Button
                type="button"
                size="sm"
                onClick={handleExportExcel}
                disabled={isExporting}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Export Score-Wise Excel (.xlsx)</span>
              </Button>
              <Link to="/data-collection">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <span>Finish & Return Hub</span>
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={survey?.title || 'Participant Survey'}
      description={`Subject ID: ${participantId} · Version: v${survey?.version || '1.0'}`}
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Data Collection', path: '/data-collection' },
        { label: survey?.title || 'Survey', isCurrent: true },
      ]}
      actions={
        <div className="flex items-center gap-2">
          {/* Real-time Draft Saving Status */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Save className="h-3.5 w-3.5 text-emerald-600" />
            <span>
              {lastDraftSaved
                ? `Draft saved locally: ${new Date(lastDraftSaved).toLocaleTimeString()}`
                : 'Auto-saving draft locally'}
            </span>
          </div>
        </div>
      }
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {isLoadingSchema ? (
          <div className="space-y-4">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        ) : !survey ? (
          <StatusState
            type="unavailable"
            title="Survey Definition Unavailable"
            description="The requested survey schema could not be loaded from the network and is not cached offline on this device. Cache the survey while online first."
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Header info */}
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardContent className="p-6 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                    Subject: {participantId}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    v{survey.version}
                  </Badge>
                </div>
                <h2 className="text-xl font-bold text-slate-900">{survey.title}</h2>
                {survey.description && (
                  <p className="text-xs text-slate-600 leading-relaxed">{survey.description}</p>
                )}
              </CardContent>
            </Card>

            {/* Questions list */}
            <div className="space-y-4">
              {survey.questions.map((q) => {
                const visible = isQuestionVisible(q);
                if (!visible) return null;

                const isHeading = q.type === 'section_heading';
                const hasError = Boolean(validationErrors[q.id]);

                if (isHeading) {
                  return (
                    <div key={q.id} className="pt-4 pb-1 border-b border-slate-200">
                      <h3 className="text-base font-bold text-slate-900">{q.text}</h3>
                      {q.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{q.description}</p>
                      )}
                    </div>
                  );
                }

                return (
                  <Card
                    key={q.id}
                    className={cn(
                      'border bg-white shadow-xs transition-all',
                      hasError ? 'border-red-300 ring-2 ring-red-500/20' : 'border-slate-200'
                    )}
                  >
                    <CardContent className="p-5 space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-900 block leading-snug">
                          <span>{q.text}</span>
                          {q.validation.required && (
                            <span className="text-red-500 ml-1 font-bold">*</span>
                          )}
                        </label>
                        {q.description && (
                          <p className="text-[11px] text-slate-500 italic">{q.description}</p>
                        )}
                      </div>

                      <div className="pt-1">{renderQuestionInput(q)}</div>

                      {/* Dynamic User Remark & Explanation Field */}
                      <div className="pt-2 border-t border-slate-100 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                            <span>Remarks & Explanation</span>
                          </label>
                          <span className="text-[10px] text-slate-400 font-medium">Dynamic Field</span>
                        </div>
                        <textarea
                          rows={2}
                          value={remarks[q.id] || ''}
                          onChange={(e) => setRemarks(prev => ({ ...prev, [q.id]: e.target.value }))}
                          placeholder="Provide observations, evidence, remarks or explanation for this score..."
                          className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-slate-50/40"
                        />
                      </div>

                      {hasError && (
                        <p className="text-[11px] font-semibold text-red-600 flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          <span>{validationErrors[q.id]}</span>
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Submit button */}
            <div className="flex justify-end gap-3 pt-3">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Submitting Response...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Submit Completed Survey</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </PageContainer>
  );
}

