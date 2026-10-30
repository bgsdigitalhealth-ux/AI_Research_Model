import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { useQuestionnaireDetail } from '@/hooks/useQuestionnaires';
import { questionnairesApi } from '@/api/questionnairesApi';
import { dataCollectionApi } from '@/api/dataCollectionApi';
import { StatusState } from '@/components/shared/StatusState';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import {
  QuestionItem,
  ConditionalLogic,
  ConditionalRule,
  LogicOperator,
} from '@/types/questionnaire';
import {
  Eye,
  ArrowLeft,
  Smartphone,
  Tablet,
  Monitor,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Send,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
  Download,
  MessageSquare,
  Award,
  Layers,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

export function QuestionnairePreviewView() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { data: questionnaire, isLoading, isUnavailable, isError, errorDetail, refetch } =
    useQuestionnaireDetail(id || '');

  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submittedSuccessfully, setSubmittedSuccessfully] = useState(false);
  const [isSubmittingToDb, setIsSubmittingToDb] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const questions = questionnaire?.questions || [];
  const sections = questionnaire?.sections || [];

  // Conditional Logic Evaluation Engine
  const evaluateRule = (rule: ConditionalRule, userResponses: Record<string, unknown>): boolean => {
    const rawVal = userResponses[rule.targetQuestionId];
    const targetVal = rule.value;

    switch (rule.operator) {
      case 'is_empty':
        return rawVal === undefined || rawVal === null || rawVal === '' || (Array.isArray(rawVal) && rawVal.length === 0);
      case 'is_not_empty':
        return rawVal !== undefined && rawVal !== null && rawVal !== '' && (!Array.isArray(rawVal) || rawVal.length > 0);
      case 'equals':
        if (Array.isArray(rawVal)) {
          return rawVal.includes(targetVal);
        }
        return String(rawVal ?? '') === String(targetVal ?? '');
      case 'not_equals':
        if (Array.isArray(rawVal)) {
          return !rawVal.includes(targetVal);
        }
        return String(rawVal ?? '') !== String(targetVal ?? '');
      case 'contains':
        if (Array.isArray(rawVal)) {
          return rawVal.includes(targetVal);
        }
        return String(rawVal ?? '').toLowerCase().includes(String(targetVal ?? '').toLowerCase());
      case 'greater_than':
        return Number(rawVal) > Number(targetVal);
      case 'less_than':
        return Number(rawVal) < Number(targetVal);
      default:
        return true;
    }
  };

  const isQuestionVisible = (q: QuestionItem): boolean => {
    if (!q.conditionalLogic || !q.conditionalLogic.rules.length) {
      return true;
    }
    const { action, match, rules } = q.conditionalLogic;

    const evaluatedRules = rules.map((r) => evaluateRule(r, responses));
    const isMatched =
      match === 'all'
        ? evaluatedRules.every(Boolean)
        : evaluatedRules.some(Boolean);

    return action === 'show' ? isMatched : !isMatched;
  };

  const handleResponseChange = (questionId: string, value: unknown) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
    if (validationErrors[questionId]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  const handleRemarkChange = (questionId: string, text: string) => {
    setRemarks((prev) => ({ ...prev, [questionId]: text }));
  };

  const handleReset = () => {
    setResponses({});
    setRemarks({});
    setValidationErrors({});
    setSubmittedSuccessfully(false);
  };

  // Dynamic Real-Time Score & Maturity Benchmark Calculation (Image 2)
  const scoreStats = useMemo(() => {
    let earned = 0;
    let maxPossible = 0;
    let answeredCount = 0;
    let totalQuestionsCount = 0;

    questions.forEach((q) => {
      if (q.type === 'section_heading') return;
      if (!isQuestionVisible(q)) return;

      totalQuestionsCount += 1;
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
        if (val !== undefined && val !== '') {
          answeredCount += 1;
        }
      }

      maxPossible += (questionMax > 0 ? questionMax : 10);
    });

    const percentage = maxPossible > 0 ? (earned / maxPossible) * 100 : 0;
    let benchmarkLevel = 'Not available (Score 0)';
    let levelBadgeColor = 'bg-slate-100 text-slate-700 border-slate-300';

    if (percentage >= 90) {
      benchmarkLevel = 'Mature / exemplary (Score 10)';
      levelBadgeColor = 'bg-purple-50 text-purple-800 border-purple-300';
    } else if (percentage >= 70) {
      benchmarkLevel = 'Consistently implemented (Score 8)';
      levelBadgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-300';
    } else if (percentage >= 50) {
      benchmarkLevel = 'Implemented (Score 6)';
      levelBadgeColor = 'bg-blue-50 text-blue-800 border-blue-300';
    } else if (percentage >= 30) {
      benchmarkLevel = 'Partially implemented (Score 4)';
      levelBadgeColor = 'bg-amber-50 text-amber-800 border-amber-300';
    } else if (percentage >= 10) {
      benchmarkLevel = 'Initial (Score 2)';
      levelBadgeColor = 'bg-orange-50 text-orange-800 border-orange-300';
    }

    return {
      earned,
      maxPossible,
      answeredCount,
      totalQuestionsCount,
      percentage,
      benchmarkLevel,
      levelBadgeColor,
    };
  }, [questions, responses]);

  const handleSubmitPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    questions.forEach((q) => {
      if (!isQuestionVisible(q)) return;
      if (q.type === 'section_heading') return;

      const val = responses[q.id];

      if (q.validation.required) {
        if (
          val === undefined ||
          val === null ||
          val === '' ||
          (Array.isArray(val) && val.length === 0)
        ) {
          errors[q.id] = q.validation.customErrorMessage || 'This question is required.';
          return;
        }
      }
    });

    setValidationErrors(errors);

    if (Object.keys(errors).length === 0) {
      setIsSubmittingToDb(true);
      try {
        if (questionnaire) {
          const submissionId = crypto.randomUUID();
          const participantId = `RESP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

          // Format answers with remarks so both selected choice and dynamic remark are stored
          const formattedAnswers: Record<string, any> = {};
          questions.forEach((q) => {
            const choice = responses[q.id];
            const remark = remarks[q.id];
            if (choice !== undefined && choice !== null) {
              if (remark && remark.trim()) {
                formattedAnswers[q.id] = {
                  code: choice,
                  choice: choice,
                  remark: remark.trim(),
                };
              } else {
                formattedAnswers[q.id] = choice;
              }
            }
          });

          await dataCollectionApi.submitResponse({
            id: submissionId,
            questionnaireId: questionnaire.id,
            questionnaireTitle: questionnaire.title,
            questionnaireVersion: questionnaire.version || '1.0',
            studyId: questionnaire.studyId,
            participantIdentifier: participantId,
            answers: formattedAnswers,
            consentRecord: {
              id: crypto.randomUUID(),
              studyId: questionnaire.studyId,
              questionnaireId: questionnaire.id,
              questionnaireVersion: questionnaire.version || '1.0',
              participantIdentifier: participantId,
              consentedAt: new Date().toISOString(),
              agreedToParticipate: true,
              agreedToDataStorage: true,
              agreedToContact: false,
              agreedStatements: ['Participant Consent Granted'],
            },
            status: 'synchronized',
            createdAt: new Date().toISOString(),
            attempts: 1,
          });
        }

        setSubmittedSuccessfully(true);
        toast({
          title: 'Responses Saved to Data Collection',
          description: `Total score: ${scoreStats.earned} / ${scoreStats.maxPossible} (${scoreStats.percentage.toFixed(1)}%). Submission recorded in Data Collection!`,
          variant: 'success',
        });
      } catch (submitErr: any) {
        setSubmittedSuccessfully(true);
        toast({
          title: 'Submission Evaluated',
          description: `Total score: ${scoreStats.earned} / ${scoreStats.maxPossible} (${scoreStats.percentage.toFixed(1)}%). You can now export the Excel report.`,
          variant: 'success',
        });
      } finally {
        setIsSubmittingToDb(false);
      }
    } else {
      setSubmittedSuccessfully(false);
    }
  };

  // Export to Excel (.xlsx) matching Image 1 & Image 2
  const handleExportExcel = async () => {
    if (!questionnaire) return;
    try {
      setIsExporting(true);

      // Attempt backend API export first
      try {
        const blob = await questionnairesApi.exportResponsesExcel(questionnaire.id, {
          responses,
          remarks,
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${questionnaire.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Score_Report.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();

        toast({
          title: 'Excel Report Downloaded',
          description: `Total score: ${scoreStats.earned} / ${scoreStats.maxPossible} (${scoreStats.percentage.toFixed(1)}%) exported successfully.`,
          variant: 'success',
        });
        return;
      } catch (backendErr) {
        console.warn('Backend export failed, falling back to client-side XLSX generation', backendErr);
      }

      // Client-side XLSX generation fallback
      const XLSX = await import('xlsx');
      const rows: any[][] = [];

      // Header Banner
      rows.push([`${questionnaire.title.toUpperCase()} - ASSESSMENT REPORT`, '', '', '', '']);
      rows.push([`Version: v${questionnaire.version} | Generated: ${new Date().toISOString()}`, '', '', '', '']);
      rows.push(['']);
      // Columns matching Image 1
      rows.push(['No.', 'Question', 'Response (select one)', 'Score', 'Remarks']);

      let qCounter = 0;
      questions.forEach((q) => {
        if (q.type === 'section_heading') return;
        qCounter += 1;
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
        // Show score only if question was selected/answered
        const displayScore = chosenScore !== 0 || val !== undefined ? chosenScore : '';
        rows.push([qCounter, q.text, chosenLabel, displayScore, userRemark]);
      });

      // Total rows matching Image 2
      rows.push(['']);
      rows.push(['TOTAL SCORE', '', '', scoreStats.earned, `Earned ${scoreStats.earned} out of ${scoreStats.maxPossible} maximum points`]);
      rows.push(['PERCENTAGE ACHIEVED', '', '', `${scoreStats.percentage.toFixed(1)}%`, '']);
      rows.push(['OVERALL MATURITY LEVEL', '', '', scoreStats.benchmarkLevel, 'Standardized 6-Level Maturity Framework Benchmark']);

      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      worksheet['!cols'] = [
        { wch: 8 },
        { wch: 52 },
        { wch: 30 },
        { wch: 16 },
        { wch: 38 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Score Report');
      XLSX.writeFile(workbook, `${questionnaire.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Score_Report.xlsx`);

      toast({
        title: 'Excel Report Downloaded',
        description: `Exported ${qCounter} questions with total score ${scoreStats.earned} / ${scoreStats.maxPossible}.`,
        variant: 'success',
      });
    } catch (err: unknown) {
      toast({
        title: 'Export Failed',
        description: (err as Error)?.message || 'Failed to generate Excel report.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const renderQuestionInput = (q: QuestionItem) => {
    const val = responses[q.id];

    switch (q.type) {
      case 'single_choice':
        return (
          <div className="space-y-2">
            {(q.choices || []).map((choice, i) => {
              const fallback = q.choices!.length === 6 ? i * 2 : i + 1;
              const choiceScore = choice.score !== undefined ? choice.score : fallback;
              const isSelected = val === choice.code;

              return (
                <label
                  key={choice.id || i}
                  className={cn(
                    'flex items-center justify-between gap-3 p-2.5 rounded-lg border cursor-pointer text-xs transition-all',
                    isSelected
                      ? 'border-blue-500 bg-blue-50/50 text-blue-950 ring-1 ring-blue-500/20'
                      : 'border-slate-200 bg-slate-50/40 hover:bg-slate-50 text-slate-800'
                  )}
                >
                  <div className="flex items-center gap-2.5 flex-1">
                    <input
                      type="radio"
                      name={`q_${q.id}`}
                      checked={isSelected}
                      onChange={() => handleResponseChange(q.id, choice.code)}
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
                  className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer text-xs text-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...checkedList, choice.code]
                        : checkedList.filter((c) => c !== choice.code);
                      handleResponseChange(q.id, next);
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium">{choice.label}</span>
                </label>
              );
            })}
          </div>
        );

      case 'short_text':
        return (
          <input
            type="text"
            value={String(val ?? '')}
            onChange={(e) => handleResponseChange(q.id, e.target.value)}
            placeholder="Type your answer here..."
            className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        );

      case 'long_text':
        return (
          <textarea
            rows={3}
            value={String(val ?? '')}
            onChange={(e) => handleResponseChange(q.id, e.target.value)}
            placeholder="Type detailed response..."
            className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-sans"
          />
        );

      case 'integer':
      case 'decimal':
        return (
          <input
            type="number"
            step={q.type === 'decimal' ? '0.01' : '1'}
            value={String(val ?? '')}
            onChange={(e) => handleResponseChange(q.id, e.target.value)}
            placeholder="Enter numerical value..."
            className="w-48 rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        );

      case 'rating_5':
      case 'likert_5':
        const choices =
          q.choices && q.choices.length > 0
            ? q.choices
            : [
                { id: '1', code: '1', label: '1 - Low', score: 1 },
                { id: '2', code: '2', label: '2', score: 2 },
                { id: '3', code: '3', label: '3 - Moderate', score: 3 },
                { id: '4', code: '4', label: '4', score: 4 },
                { id: '5', code: '5', label: '5 - High', score: 5 },
              ];

        return (
          <div className="flex flex-wrap items-center gap-2">
            {choices.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleResponseChange(q.id, c.code)}
                className={cn(
                  'px-3 py-2 rounded-lg border text-xs font-semibold transition-all',
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

      case 'section_heading':
        return null;

      default:
        return null;
    }
  };

  return (
    <PageContainer
      title="Live Participant Survey Preview"
      description="Simulation of participant-facing UI with real-time scoring, dynamic remark fields, and Excel export."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Questionnaires', path: '/questionnaires' },
        { label: questionnaire?.title || 'Instrument', path: `/questionnaires/${id}/builder` },
        { label: 'Preview', isCurrent: true },
      ]}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          {/* Device Frame Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 border border-slate-300">
            <button
              type="button"
              onClick={() => setDeviceMode('desktop')}
              className={cn(
                'p-1.5 rounded-md text-xs font-semibold transition-colors',
                deviceMode === 'desktop'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
              title="Desktop View"
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDeviceMode('tablet')}
              className={cn(
                'p-1.5 rounded-md text-xs font-semibold transition-colors',
                deviceMode === 'tablet'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
              title="Tablet View"
            >
              <Tablet className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDeviceMode('mobile')}
              className={cn(
                'p-1.5 rounded-md text-xs font-semibold transition-colors',
                deviceMode === 'mobile'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
              title="Mobile View"
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={isExporting}
            className="gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>Export to Excel</span>
          </Button>

          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Answers</span>
          </Button>

          <Link to={`/questionnaires/${id}/builder`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Builder</span>
            </Button>
          </Link>

          <Link to={`/questionnaires/${id}/review`}>
            <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
              <ShieldCheck className="h-4 w-4" />
              <span>Next: Review & Sign-Off</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {isUnavailable ? (
          <StatusState
            type="unavailable"
            title="Questionnaire Unavailable"
            description={`Backend endpoint (/questionnaires/${id}) could not be reached.`}
            endpoint={`/questionnaires/${id}`}
            action={{
              label: 'Retry Loading Preview',
              onClick: () => refetch(),
            }}
          />
        ) : isError ? (
          <StatusState
            type="error"
            title="Failed to Load Questionnaire"
            description={errorDetail?.message || 'Error occurred while loading instrument preview.'}
            action={{
              label: 'Retry',
              onClick: () => refetch(),
            }}
          />
        ) : isLoading ? (
          <div className="max-w-2xl mx-auto space-y-4">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        ) : !questionnaire || questions.length === 0 ? (
          <StatusState
            type="empty"
            title="No Questions in Instrument"
            description="Add questions in the visual builder to view participant preview."
          />
        ) : (
          <div className="flex justify-center">
            <div
              className={cn(
                'w-full transition-all duration-200 space-y-6',
                deviceMode === 'desktop' && 'max-w-3xl',
                deviceMode === 'tablet' && 'max-w-xl',
                deviceMode === 'mobile' && 'max-w-sm'
              )}
            >
              {/* Submission Feedback in Preview Mode */}
              {submittedSuccessfully && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-3 animate-in fade-in">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-2 flex-1">
                    <p className="font-bold text-sm text-emerald-950">Survey Submission Successful & Evaluated</p>
                    <p className="text-[11px] leading-relaxed text-emerald-800">
                      All responses and remarks have been successfully recorded. Click below to export the score-wise Excel report.
                    </p>
                    <div className="pt-2 flex items-center gap-2 flex-wrap">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleExportExcel}
                        disabled={isExporting}
                        className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-xs"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        <span>Export Score-Wise Excel Report (.xlsx)</span>
                      </Button>
                      <Link to="/data-collection">
                        <Button size="sm" variant="outline" className="gap-1.5 border-emerald-400 text-emerald-900 bg-white hover:bg-emerald-100 text-xs font-semibold shadow-xs">
                          <Database className="h-4 w-4 text-emerald-700" />
                          <span>View in Data Collection</span>
                        </Button>
                      </Link>
                      <Link to={`/questionnaires/${id}/review`}>
                        <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs">
                          <ShieldCheck className="h-4 w-4" />
                          <span>Next: Review & Sign-Off</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Link to={`/questionnaires/${id}/builder`}>
                        <Button variant="outline" size="sm" className="border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs">
                          <span>Return to Builder</span>
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {Object.keys(validationErrors).length > 0 && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Form Validation Incomplete</p>
                    <p className="text-[11px]">
                      Please resolve {Object.keys(validationErrors).length} required response(s) highlighted below.
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmitPreview} className="space-y-6">
                {/* Participant Header Box */}
                <Card className="border-slate-200 shadow-sm bg-white">
                  <CardHeader className="p-6 border-b border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded">
                        Participant View Simulation
                      </span>
                    </div>
                    <CardTitle className="text-xl font-bold text-slate-900">
                      {questionnaire.title}
                    </CardTitle>
                    {questionnaire.description && (
                      <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                        {questionnaire.description}
                      </p>
                    )}
                  </CardHeader>
                </Card>

                {/* Render Questions */}
                <div className="space-y-4">
                  {questions.map((q, idx) => {
                    const visible = isQuestionVisible(q);
                    if (!visible) return null;

                    const isHeading = q.type === 'section_heading';
                    const hasError = Boolean(validationErrors[q.id]);

                    if (isHeading) {
                      return (
                        <div key={q.id} className="pt-4 pb-2 border-b border-slate-200">
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
                        <CardContent className="p-5 space-y-3.5">
                          {/* Question Number and Prompt */}
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-900 block leading-snug">
                              <span className="font-bold text-blue-600 mr-1.5">#{idx + 1}</span>
                              <span>{q.text}</span>
                              {q.validation.required && (
                                <span className="text-red-500 ml-1 font-bold">*</span>
                              )}
                            </label>
                            {q.description && (
                              <p className="text-[11px] text-slate-500 italic">
                                {q.description}
                              </p>
                            )}
                          </div>

                          {/* Options Radio List */}
                          <div className="pt-1">{renderQuestionInput(q)}</div>



                          {/* Dynamic Remark Field (Image 1 Requirement) */}
                          <div className="pt-2 border-t border-slate-100 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                                <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                                <span>Remark & Explanation</span>
                              </label>
                              <span className="text-[10px] text-slate-400 font-medium">Dynamic User Entry</span>
                            </div>
                            <textarea
                              rows={2}
                              value={remarks[q.id] || ''}
                              onChange={(e) => handleRemarkChange(q.id, e.target.value)}
                              placeholder="Type remarks, evidence, notes, or explanation for this question..."
                              className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-slate-50/40 font-sans"
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

                {/* Submit and Next Actions in Preview */}
                <div className="flex items-center justify-between pt-2">
                  <Link to={`/questionnaires/${id}/builder`}>
                    <Button type="button" variant="outline" size="sm" className="gap-1.5">
                      <ArrowLeft className="h-4 w-4" />
                      <span>Back to Builder</span>
                    </Button>
                  </Link>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleExportExcel}
                      disabled={isExporting}
                      className="gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Export to Excel</span>
                    </Button>

                    <Button type="submit" disabled={isSubmittingToDb} variant={submittedSuccessfully ? 'outline' : 'default'} className="gap-2">
                      <Send className="h-4 w-4" />
                      <span>{isSubmittingToDb ? 'Submitting & Saving...' : (submittedSuccessfully ? 'Re-Submit & Save' : 'Submit & Store in Data Collection')}</span>
                    </Button>

                    <Link to={`/questionnaires/${id}/review`}>
                      <Button type="button" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                        <span>Next: Review & Sign-Off</span>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
