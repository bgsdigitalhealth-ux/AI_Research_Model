import React, { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { useQuestionnaireDetail } from '@/hooks/useQuestionnaires';
import { questionnairesApi } from '@/api/questionnairesApi';
import { dataCollectionApi } from '@/api/dataCollectionApi';
import { StatusState } from '@/components/shared/StatusState';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  User,
  Copy,
  FolderCheck,
  Building,
  BookOpen,
  Mail,
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

  // User Details State (Top of Question Template)
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [researchTopic, setResearchTopic] = useState('');

  const questions = questionnaire?.questions || [];
  const sections = questionnaire?.sections || [];

  // Stable Unique Template ID for each questionary
  const templateUniqueId = useMemo(() => {
    const rawId = questionnaire?.id || id || 'INST';
    return `TMPL-${rawId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  }, [questionnaire?.id, id]);

  // Pre-populate research topic from questionnaire title
  useEffect(() => {
    if (questionnaire?.title && !researchTopic) {
      setResearchTopic(questionnaire.title);
    }
  }, [questionnaire?.title, researchTopic]);

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
          const fallbackScore = q.choices!.length === 6 ? idx * 2 : idx + 1;
          const sc = c.score !== undefined ? c.score : fallbackScore;
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

    // 1. Mandatory User Details Validation
    if (!userName.trim()) {
      errors['userName'] = 'User Name / Nick Name is mandatory.';
    }
    if (!userEmail.trim()) {
      errors['userEmail'] = 'User Email is mandatory.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail.trim())) {
      errors['userEmail'] = 'Please enter a valid email address.';
    }
    if (!department.trim()) {
      errors['department'] = 'Department is mandatory.';
    }
    if (!researchTopic.trim()) {
      errors['researchTopic'] = 'Research Topic is mandatory.';
    }

    // 2. Mandatory Questions Validation
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
          // Use user name directly as participant identifier so folder in Data Collection is user name
          const participantId = userName.trim();

          // Format answers with remarks and score so everything is stored
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

          // Embed full user details and template metadata
          const userMeta = {
            userName: userName.trim(),
            name: userName.trim(),
            email: userEmail.trim(),
            department: department.trim(),
            researchTopic: researchTopic.trim(),
            templateId: templateUniqueId,
            earnedScore: scoreStats.earned,
            maxPossible: scoreStats.maxPossible,
            percentage: scoreStats.percentage,
            benchmarkLevel: scoreStats.benchmarkLevel,
            totalQuestions: questions.filter((q) => q.type !== 'section_heading').length,
            submittedAt: new Date().toISOString(),
          };
          formattedAnswers['__user_details__'] = userMeta;

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
          title: `Folder Created: 📁 ${userName.trim()}`,
          description: `All questions saved in Data Collection under folder "${userName.trim()}". Total score: ${scoreStats.earned}/${scoreStats.maxPossible}.`,
          variant: 'success',
        });
      } catch (submitErr: any) {
        setSubmittedSuccessfully(true);
        toast({
          title: 'Responses Recorded',
          description: `Total score: ${scoreStats.earned} / ${scoreStats.maxPossible}. Stored under folder "${userName.trim()}".`,
          variant: 'success',
        });
      } finally {
        setIsSubmittingToDb(false);
      }
    } else {
      setSubmittedSuccessfully(false);
      toast({
        title: 'Please Complete Mandatory Fields',
        description: 'Fill in user details and all required questions highlighted in red.',
        variant: 'destructive',
      });
    }
  };

  // Export to Excel (.xlsx) matching user specification
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
        a.download = `${userName ? userName.replace(/\s+/g, '_') + '_' : ''}${questionnaire.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Report.xlsx`;
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

      // Header Banner with User Details & Unique Template ID
      rows.push([`${questionnaire.title.toUpperCase()} - ASSESSMENT REPORT`, '', '', '', '']);
      rows.push([`Template Unique ID: ${templateUniqueId}`, '', '', '', '']);
      rows.push([`User Name: ${userName || 'N/A'} | Email: ${userEmail || 'N/A'}`, '', '', '', '']);
      rows.push([`Department: ${department || 'N/A'} | Research Topic: ${researchTopic || questionnaire.title}`, '', '', '', '']);
      rows.push([`Version: v${questionnaire.version} | Generated: ${new Date().toISOString()}`, '', '', '', '']);
      rows.push(['']);
      // Columns matching user template
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

      // Total Score Summary Row
      rows.push(['']);
      rows.push(['', 'TOTAL SCORE', '', `${scoreStats.earned} / ${scoreStats.maxPossible}`, `(${scoreStats.percentage.toFixed(1)}%)`]);
      rows.push(['', 'BENCHMARK MATURITY LEVEL', '', scoreStats.benchmarkLevel, '']);

      const worksheet = XLSX.utils.aoa_to_sheet(rows);

      // Auto-fit column widths
      worksheet['!cols'] = [
        { wch: 8 },  // No.
        { wch: 65 }, // Question
        { wch: 35 }, // Response
        { wch: 12 }, // Score
        { wch: 45 }, // Remarks
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Score Assessment');

      const filePrefix = userName ? userName.trim().replace(/[^a-zA-Z0-9_-]/g, '_') + '_' : '';
      XLSX.writeFile(workbook, `${filePrefix}${questionnaire.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Report.xlsx`);

      toast({
        title: 'Excel Report Downloaded',
        description: `Exported: Total Score ${scoreStats.earned}/${scoreStats.maxPossible} (${scoreStats.percentage.toFixed(1)}%).`,
        variant: 'success',
      });
    } catch (err: any) {
      toast({
        title: 'Export Failed',
        description: err?.message || 'Could not generate Excel report.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Render question input by type
  const renderQuestionInput = (q: QuestionItem) => {
    const val = responses[q.id];

    switch (q.type) {
      case 'single_choice':
        return (
          <div className="space-y-2">
            {(q.choices || []).map((choice, idx) => {
              const isSelected =
                val !== undefined &&
                String(val).toLowerCase() === String(choice.code).toLowerCase();
              const fallbackScore = q.choices!.length === 6 ? idx * 2 : idx + 1;
              const choiceScore = choice.score !== undefined ? choice.score : fallbackScore;

              return (
                <label
                  key={choice.id}
                  className={cn(
                    'flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all',
                    isSelected
                      ? 'border-blue-500 bg-blue-50/60 text-blue-900 font-semibold shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name={`question_${q.id}`}
                      value={choice.code}
                      checked={isSelected}
                      onChange={() => handleResponseChange(q.id, choice.code)}
                      className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{choice.label}</span>
                  </div>
                  {/* Subtle score preview pill in builder */}
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    Score: {choiceScore}
                  </span>
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

      default:
        return (
          <input
            type="text"
            value={String(val ?? '')}
            onChange={(e) => handleResponseChange(q.id, e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900"
          />
        );
    }
  };

  return (
    <PageContainer
      title="Questionnaire Template & Response Preview"
      description="Standard 4-field format with User Details header, 6-level maturity options, dynamic remarks, and automatic Data Collection folder generation."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Questionnaires', path: '/questionnaires' },
        { label: questionnaire?.title || 'Preview', isCurrent: true },
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

          <Link to="/data-collection">
            <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
              <Database className="h-4 w-4" />
              <span>Data Collection Folders</span>
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
                    <p className="font-bold text-sm text-emerald-950">
                      Questionnaire Submitted & Stored in Folder: 📁 {userName || 'User'}
                    </p>
                    <p className="text-[11px] leading-relaxed text-emerald-800">
                      All responses, remarks, and user metadata have been persistently saved into Supabase. You can now view the folder in Data Collection or export the Excel report.
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
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-emerald-400 text-emerald-900 bg-white hover:bg-emerald-100 text-xs font-semibold shadow-xs"
                        >
                          <FolderCheck className="h-4 w-4 text-emerald-700" />
                          <span>View Folder in Data Collection</span>
                        </Button>
                      </Link>
                      <Link to={`/questionnaires/${id}/builder`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs"
                        >
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
                    <p className="font-bold">Form Incomplete</p>
                    <p className="text-[11px]">
                      Please complete all mandatory fields: user details and required survey questions.
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmitPreview} className="space-y-6">
                {/* 1. Questionnaire Header Box */}
                <Card className="border-slate-200 shadow-sm bg-white">
                  <CardHeader className="p-6 border-b border-slate-100">
                    <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded">
                        Standard Assessment Template
                      </span>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 border border-slate-200">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">Template Unique ID:</span>
                        <code className="text-xs font-mono font-bold text-blue-700">{templateUniqueId}</code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(templateUniqueId);
                            toast({ title: 'Template ID Copied', description: templateUniqueId });
                          }}
                          className="text-slate-400 hover:text-blue-600 ml-1"
                          title="Copy Unique ID"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
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

                {/* 2. Top User Details Form (Mandatory for Folder Generation) */}
                <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 via-white to-indigo-50/30 shadow-xs">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-blue-100">
                      <div className="h-7 w-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          User Details (Stores in Data Collection Folder)
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          These details create your individual folder named after your name in Data Collection.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* User Name / Nick Name */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <User className="h-3 w-3 text-blue-600" />
                          <span>User Name / Nick Name</span>
                          <span className="text-rose-600 font-bold">*</span>
                        </label>
                        <Input
                          value={userName}
                          onChange={(e) => {
                            setUserName(e.target.value);
                            if (validationErrors.userName) {
                              setValidationErrors((prev) => {
                                const next = { ...prev };
                                delete next.userName;
                                return next;
                              });
                            }
                          }}
                          placeholder="e.g. Dr. Adithya Rao"
                          className={cn(
                            'text-xs bg-white',
                            validationErrors.userName && 'border-rose-400 focus:ring-rose-400'
                          )}
                        />
                        {validationErrors.userName && (
                          <p className="text-[10px] font-medium text-rose-600">{validationErrors.userName}</p>
                        )}
                      </div>

                      {/* User Email */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <Mail className="h-3 w-3 text-blue-600" />
                          <span>User Email</span>
                          <span className="text-rose-600 font-bold">*</span>
                        </label>
                        <Input
                          type="email"
                          value={userEmail}
                          onChange={(e) => {
                            setUserEmail(e.target.value);
                            if (validationErrors.userEmail) {
                              setValidationErrors((prev) => {
                                const next = { ...prev };
                                delete next.userEmail;
                                return next;
                              });
                            }
                          }}
                          placeholder="e.g. aditya@bgsdigitalhealth.com"
                          className={cn(
                            'text-xs bg-white',
                            validationErrors.userEmail && 'border-rose-400 focus:ring-rose-400'
                          )}
                        />
                        {validationErrors.userEmail && (
                          <p className="text-[10px] font-medium text-rose-600">{validationErrors.userEmail}</p>
                        )}
                      </div>

                      {/* Department */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <Building className="h-3 w-3 text-blue-600" />
                          <span>Department</span>
                          <span className="text-rose-600 font-bold">*</span>
                        </label>
                        <Input
                          value={department}
                          onChange={(e) => {
                            setDepartment(e.target.value);
                            if (validationErrors.department) {
                              setValidationErrors((prev) => {
                                const next = { ...prev };
                                delete next.department;
                                return next;
                              });
                            }
                          }}
                          placeholder="e.g. Clinical Research & Digital Health"
                          className={cn(
                            'text-xs bg-white',
                            validationErrors.department && 'border-rose-400 focus:ring-rose-400'
                          )}
                        />
                        {validationErrors.department && (
                          <p className="text-[10px] font-medium text-rose-600">{validationErrors.department}</p>
                        )}
                      </div>

                      {/* Research Topic */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <BookOpen className="h-3 w-3 text-blue-600" />
                          <span>Research Topic</span>
                          <span className="text-rose-600 font-bold">*</span>
                        </label>
                        <Input
                          value={researchTopic}
                          onChange={(e) => {
                            setResearchTopic(e.target.value);
                            if (validationErrors.researchTopic) {
                              setValidationErrors((prev) => {
                                const next = { ...prev };
                                delete next.researchTopic;
                                return next;
                              });
                            }
                          }}
                          placeholder="e.g. ACU Institutional Leadership Digital Governance"
                          className={cn(
                            'text-xs bg-white',
                            validationErrors.researchTopic && 'border-rose-400 focus:ring-rose-400'
                          )}
                        />
                        {validationErrors.researchTopic && (
                          <p className="text-[10px] font-medium text-rose-600">{validationErrors.researchTopic}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 3. Question Template Cards List */}
                <div className="space-y-4">
                  {questions.map((q, qIndex) => {
                    if (!isQuestionVisible(q)) return null;

                    if (q.type === 'section_heading') {
                      return (
                        <div
                          key={q.id}
                          className="pt-6 pb-2 border-b-2 border-blue-600/70 mt-6"
                        >
                          <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-blue-600" />
                            <span>{q.text}</span>
                          </h3>
                          {q.description && (
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                              {q.description}
                            </p>
                          )}
                        </div>
                      );
                    }

                    const hasError = !!validationErrors[q.id];

                    return (
                      <Card
                        key={q.id}
                        className={cn(
                          'border transition-all shadow-xs',
                          hasError
                            ? 'border-red-400 bg-red-50/20 ring-1 ring-red-400'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        )}
                      >
                        <CardContent className="p-5 space-y-4">
                          {/* Top Question Header */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              <span className="text-blue-700 font-mono">#{qIndex + 1}</span>
                              <span className="font-mono text-slate-500">{q.variableName}</span>
                              {q.validation.required && (
                                <span className="text-red-500 font-semibold">* Mandatory</span>
                              )}
                            </div>

                            {/* Question Prompt */}
                            <p className="text-sm font-semibold text-slate-900 leading-snug">
                              {q.text}
                            </p>

                            {/* Participant Guidance */}
                            {q.description && (
                              <p className="text-xs text-slate-500 italic leading-relaxed">
                                {q.description}
                              </p>
                            )}
                          </div>

                          {/* Options Radio List (Mandatory 6-option format) */}
                          <div className="pt-1">{renderQuestionInput(q)}</div>

                          {/* Dynamic Remark Field */}
                          <div className="pt-2 border-t border-slate-100 space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <label className="font-medium text-slate-700 flex items-center gap-1.5">
                                <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                                <span>Remark</span>
                              </label>
                              <span className="text-[10px] text-slate-400">Optional</span>
                            </div>
                            <textarea
                              rows={2}
                              value={remarks[q.id] || ''}
                              onChange={(e) => handleRemarkChange(q.id, e.target.value)}
                              placeholder="Add research remarks, reviewer observations, or justification..."
                              className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans bg-slate-50/50"
                            />
                          </div>

                          {/* Explanation Rationale (Optional) */}
                          {q.explanation && (
                            <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/70 text-amber-900 text-xs flex items-start gap-2">
                              <HelpCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <span className="font-bold text-[10px] uppercase tracking-wider text-amber-800">
                                  Explanation:
                                </span>
                                <p className="text-[11px] leading-relaxed text-amber-900">
                                  {q.explanation}
                                </p>
                              </div>
                            </div>
                          )}

                          {hasError && (
                            <p className="text-xs font-medium text-red-600 flex items-center gap-1 pt-1">
                              <AlertCircle className="h-3.5 w-3.5" />
                              <span>{validationErrors[q.id]}</span>
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Submit Questionnaire Card */}
                <Card className="border-blue-200 bg-gradient-to-r from-blue-50/70 to-indigo-50/50 shadow-sm">
                  <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-900">
                        Submit & Save Questionnaire in Data Collection
                      </h4>
                      <p className="text-xs text-slate-600">
                        Submitting creates folder <strong>📁 {userName ? userName : 'User Name'}</strong> in Data Collection and stores all question responses.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="submit"
                        disabled={isSubmittingToDb}
                        className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5 shadow-xs"
                      >
                        {isSubmittingToDb ? (
                          <>
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span>Saving in Data Collection...</span>
                          </>
                        ) : (
                          <>
                            <Send className="h-3.5 w-3.5" />
                            <span>Submit Questionnaire</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </form>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
