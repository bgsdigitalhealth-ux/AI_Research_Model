import { useState } from 'react';
import {
  QuestionItem,
  ConditionalLogic,
  ConditionalRule,
  LogicOperator,
} from '@/types/questionnaire';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Trash2, GitBranch, AlertCircle } from 'lucide-react';

interface ConditionalLogicModalProps {
  open: boolean;
  onClose: () => void;
  question: QuestionItem;
  allPrecedingQuestions: QuestionItem[];
  onSaveLogic: (logic?: ConditionalLogic) => void;
}

const OPERATOR_LABELS: Record<LogicOperator, string> = {
  equals: 'Equals (==)',
  not_equals: 'Does not equal (!=)',
  contains: 'Contains',
  greater_than: 'Greater than (>)',
  less_than: 'Less than (<)',
  is_empty: 'Is empty / unanswered',
  is_not_empty: 'Is answered / filled',
};

export function ConditionalLogicModal({
  open,
  onClose,
  question,
  allPrecedingQuestions,
  onSaveLogic,
}: ConditionalLogicModalProps) {
  const existingLogic = question.conditionalLogic;

  const [enabled, setEnabled] = useState(Boolean(existingLogic && existingLogic.rules.length > 0));
  const [action, setAction] = useState<'show' | 'hide'>(existingLogic?.action || 'show');
  const [match, setMatch] = useState<'all' | 'any'>(existingLogic?.match || 'all');
  const [rules, setRules] = useState<ConditionalRule[]>(
    existingLogic?.rules && existingLogic.rules.length > 0
      ? existingLogic.rules
      : [
          {
            targetQuestionId: allPrecedingQuestions[0]?.id || '',
            operator: 'equals',
            value: '',
          },
        ]
  );

  if (!open) return null;

  const handleAddRule = () => {
    setRules((prev) => [
      ...prev,
      {
        targetQuestionId: allPrecedingQuestions[0]?.id || '',
        operator: 'equals',
        value: '',
      },
    ]);
  };

  const handleRemoveRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateRule = (index: number, patch: Partial<ConditionalRule>) => {
    setRules((prev) =>
      prev.map((rule, i) => (i === index ? { ...rule, ...patch } : rule))
    );
  };

  const handleSave = () => {
    if (!enabled || rules.length === 0) {
      onSaveLogic(undefined);
    } else {
      onSaveLogic({
        action,
        match,
        rules: rules.filter((r) => Boolean(r.targetQuestionId)),
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
              <GitBranch className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Conditional Visibility & Skip Logic
              </h3>
              <p className="text-xs text-slate-500">
                Rule configuration for variable <span className="font-mono font-semibold text-slate-700">{question.variableName}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {allPrecedingQuestions.length === 0 ? (
          <div className="p-6 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">No Preceding Questions</p>
              <p className="mt-1">
                Conditional logic triggers based on participant answers to prior questions in the questionnaire. This question is currently positioned first.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-800">
                Enable Conditional Display Rule
              </span>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            {enabled && (
              <div className="space-y-4 pt-1">
                {/* Rule Directive: Action + Match */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium text-slate-700">Action:</span>
                  <select
                    value={action}
                    onChange={(e) => setAction(e.target.value as 'show' | 'hide')}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="show">SHOW this question</option>
                    <option value="hide">HIDE this question</option>
                  </select>

                  <span className="font-medium text-slate-700">when</span>
                  <select
                    value={match}
                    onChange={(e) => setMatch(e.target.value as 'all' | 'any')}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="all">ALL of the following rules match</option>
                    <option value="any">ANY of the following rules match</option>
                  </select>
                </div>

                {/* Rules List */}
                <div className="space-y-3">
                  {rules.map((rule, idx) => {
                    const targetQ = allPrecedingQuestions.find(
                      (q) => q.id === rule.targetQuestionId
                    );
                    const targetChoices = targetQ?.choices || [];

                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-600">Rule #{idx + 1}</span>
                          {rules.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveRule(idx)}
                              className="text-red-500 hover:text-red-700"
                              title="Delete rule"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {/* Target Question */}
                          <div>
                            <label className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">
                              When Question:
                            </label>
                            <select
                              value={rule.targetQuestionId}
                              onChange={(e) =>
                                handleUpdateRule(idx, { targetQuestionId: e.target.value })
                              }
                              className="w-full rounded-lg border border-slate-300 bg-white p-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-blue-600"
                            >
                              {allPrecedingQuestions.map((q) => (
                                <option key={q.id} value={q.id}>
                                  {q.variableName} ({q.text.slice(0, 30)}...)
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Operator */}
                          <div>
                            <label className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">
                              Operator:
                            </label>
                            <select
                              value={rule.operator}
                              onChange={(e) =>
                                handleUpdateRule(idx, {
                                  operator: e.target.value as LogicOperator,
                                })
                              }
                              className="w-full rounded-lg border border-slate-300 bg-white p-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-blue-600"
                            >
                              {(Object.keys(OPERATOR_LABELS) as LogicOperator[]).map((op) => (
                                <option key={op} value={op}>
                                  {OPERATOR_LABELS[op]}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Value */}
                          <div>
                            <label className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">
                              Comparison Value:
                            </label>
                            {rule.operator === 'is_empty' || rule.operator === 'is_not_empty' ? (
                              <input
                                disabled
                                value="N/A (State check)"
                                className="w-full rounded-lg border border-slate-200 bg-slate-100 p-1.5 text-xs text-slate-400 cursor-not-allowed"
                              />
                            ) : targetChoices.length > 0 ? (
                              <select
                                value={String(rule.value ?? '')}
                                onChange={(e) =>
                                  handleUpdateRule(idx, { value: e.target.value })
                                }
                                className="w-full rounded-lg border border-slate-300 bg-white p-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-blue-600"
                              >
                                <option value="">Select choice code...</option>
                                {targetChoices.map((choice) => (
                                  <option key={choice.id} value={choice.code}>
                                    {choice.label} ({choice.code})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={String(rule.value ?? '')}
                                onChange={(e) =>
                                  handleUpdateRule(idx, { value: e.target.value })
                                }
                                placeholder="Value..."
                                className="w-full rounded-lg border border-slate-300 bg-white p-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-blue-600"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddRule}
                  className="gap-1 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Another Condition</span>
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSave}>
            Apply Logic
          </Button>
        </div>
      </div>
    </div>
  );
}

