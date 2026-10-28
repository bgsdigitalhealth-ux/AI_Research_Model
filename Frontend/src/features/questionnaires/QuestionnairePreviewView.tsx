import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { useQuestionnaireDetail } from '@/hooks/useQuestionnaires';
import { StatusState } from '@/components/shared/StatusState';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  Send
} from 'lucide-react';
import { cn } from '@/lib/utils';

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

export function QuestionnairePreviewView() {
  const { id } = useParams<{ id: string }>();
  const { data: questionnaire, isLoading, isUnavailable, isError, errorDetail, refetch } =
    useQuestionnaireDetail(id || '');

  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submittedSuccessfully, setSubmittedSuccessfully] = useState(false);

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
    // Clear validation error when modified
    if (validationErrors[questionId]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  const handleReset = () => {
    setResponses({});
    setValidationErrors({});
    setSubmittedSuccessfully(false);
  };

  const handleSubmitPreview = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    questions.forEach((q) => {
      // Only validate if question is visible
      if (!isQuestionVisible(q)) return;
      if (q.type === 'section_heading') return;

      const val = responses[q.id];

      // Required check
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

      // Min/Max numeric
      if (['integer', 'decimal', 'rating_5'].includes(q.type) && val !== undefined && val !== '') {
        const num = Number(val);
        if (q.validation.min !== undefined && num < q.validation.min) {
          errors[q.id] = `Value cannot be less than ${q.validation.min}.`;
        }
        if (q.validation.max !== undefined && num > q.validation.max) {
          errors[q.id] = `Value cannot be greater than ${q.validation.max}.`;
        }
      }

      // Min/Max length text
      if (['short_text', 'long_text'].includes(q.type) && typeof val === 'string' && val) {
        if (q.validation.minLength !== undefined && val.length < q.validation.minLength) {
          errors[q.id] = `Must be at least ${q.validation.minLength} characters.`;
        }
        if (q.validation.maxLength !== undefined && val.length > q.validation.maxLength) {
          errors[q.id] = `Cannot exceed ${q.validation.maxLength} characters.`;
        }
      }
    });

    setValidationErrors(errors);

    if (Object.keys(errors).length === 0) {
      setSubmittedSuccessfully(true);
    } else {
      setSubmittedSuccessfully(false);
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
            className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
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

      case 'date':
        return (
          <input
            type="date"
            value={String(val ?? '')}
            onChange={(e) => handleResponseChange(q.id, e.target.value)}
            className="w-48 rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        );

      case 'time':
        return (
          <input
            type="time"
            value={String(val ?? '')}
            onChange={(e) => handleResponseChange(q.id, e.target.value)}
            className="w-40 rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        );

      case 'datetime':
        return (
          <input
            type="datetime-local"
            value={String(val ?? '')}
            onChange={(e) => handleResponseChange(q.id, e.target.value)}
            className="w-56 rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        );

      case 'single_choice':
        return (
          <div className="space-y-2">
            {(q.choices || []).map((choice) => (
              <label
                key={choice.id}
                className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer text-xs text-slate-800"
              >
                <input
                  type="radio"
                  name={`q_${q.id}`}
                  checked={val === choice.code}
                  onChange={() => handleResponseChange(q.id, choice.code)}
                  className="h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                />
                <span className="font-medium">{choice.label}</span>
              </label>
            ))}
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
      description={`Simulation of participant-facing UI with real-time conditional skip logic & input validation.`}
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

          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Answers</span>
          </Button>

          <Link to={`/questionnaires/${id}/builder`}>
            <Button size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Builder</span>
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
          /* Participant Simulation Container */
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
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Preview Submission Successful</p>
                    <p className="text-[11px] leading-relaxed">
                      All required questions and validation rules passed. In production mode, responses are encrypted and submitted to the data collection pipeline.
                    </p>
                  </div>
                </div>
              )}

              {Object.keys(validationErrors).length > 0 && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Form Validation Incomplete</p>
                    <p className="text-[11px]">
                      Please resolve {Object.keys(validationErrors).length} required or out-of-range response(s) highlighted below.
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
                        <CardContent className="p-5 space-y-3">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-900 block leading-snug">
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

                          <div className="pt-1">{renderQuestionInput(q)}</div>

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

                {/* Submit Test in Preview */}
                <div className="flex justify-end pt-2">
                  <Button type="submit" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                    <Send className="h-4 w-4" />
                    <span>Test Submit Response</span>
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

