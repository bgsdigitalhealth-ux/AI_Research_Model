import React, { useState } from 'react';
import {
  QuestionItem,
  QuestionType,
  QuestionnaireSection,
  ChoiceOption,
  ConditionalLogic,
} from '@/types/questionnaire';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConditionalLogicModal } from './ConditionalLogicModal';
import {
  Settings,
  Plus,
  Trash2,
  GitBranch,
  CheckCircle2,
  ListPlus,
  Sparkles,
  HelpCircle,
  Lock,
  Lightbulb,
  MessageSquare,
} from 'lucide-react';

interface QuestionSettingsPanelProps {
  question: QuestionItem | null;
  sections: QuestionnaireSection[];
  allPrecedingQuestions: QuestionItem[];
  isPublished: boolean;
  onUpdateQuestion: (updated: QuestionItem) => void;
  onClose?: () => void;
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  short_text: 'Short Text',
  long_text: 'Long Text / Narrative',
  integer: 'Whole Number (Integer)',
  decimal: 'Decimal Number',
  date: 'Date Picker',
  time: 'Time Picker',
  datetime: 'Date & Time',
  single_choice: 'Single Choice (Radio)',
  multiple_choice: 'Multiple Choice (Checkboxes)',
  rating_5: '5-Point Numerical Rating',
  likert_5: '5-Point Agreement Likert Scale',
  section_heading: 'Section Heading / Break',
};

export function QuestionSettingsPanel({
  question,
  sections,
  allPrecedingQuestions,
  isPublished,
  onUpdateQuestion,
  onClose,
}: QuestionSettingsPanelProps) {
  const [showLogicModal, setShowLogicModal] = useState(false);

  if (!question) {
    return (
      <Card className="h-full border-slate-200 shadow-sm flex flex-col justify-center items-center p-8 text-center bg-slate-50/50">
        <Settings className="h-8 w-8 text-slate-300 mb-2" />
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          No Question Selected
        </h4>
        <p className="text-xs text-slate-400 max-w-xs mt-1">
          Select any question card in the builder to configure its validation rules, variable code, choices, and skip logic.
        </p>
      </Card>
    );
  }

  const isChoiceType = [
    'single_choice',
    'multiple_choice',
    'rating_5',
    'likert_5',
  ].includes(question.type);

  const isNumericType = ['integer', 'decimal', 'rating_5'].includes(question.type);
  const isTextType = ['short_text', 'long_text'].includes(question.type);

  const handleUpdate = (patch: Partial<QuestionItem>) => {
    if (isPublished) return;
    onUpdateQuestion({ ...question, ...patch });
  };

  const handleValidationUpdate = (patch: Partial<QuestionItem['validation']>) => {
    if (isPublished) return;
    onUpdateQuestion({
      ...question,
      validation: { ...question.validation, ...patch },
    });
  };

  const handleAddChoice = () => {
    if (isPublished) return;
    const currentChoices = question.choices || [];
    const nextIdx = currentChoices.length + 1;
    const letter = String.fromCharCode(96 + nextIdx);
    const newChoice: ChoiceOption = {
      id: `opt_${Date.now()}_${nextIdx}`,
      code: letter,
      label: `${letter}) Option ${nextIdx}`,
      score: nextIdx,
    };
    handleUpdate({ choices: [...currentChoices, newChoice] });
  };

  const handleUpdateChoice = (id: string, patch: Partial<ChoiceOption>) => {
    if (isPublished) return;
    const updated = (question.choices || []).map((c) =>
      c.id === id ? { ...c, ...patch } : c
    );
    handleUpdate({ choices: updated });
  };

  const handleRemoveChoice = (id: string) => {
    if (isPublished) return;
    const filtered = (question.choices || []).filter((c) => c.id !== id);
    handleUpdate({ choices: filtered });
  };

  const handleFormatChoicesABC = () => {
    if (isPublished || !question.choices) return;
    const formatted = question.choices.map((c, i) => {
      const letter = String.fromCharCode(97 + i);
      let lbl = c.label;
      if (!lbl.toLowerCase().startsWith(`${letter})`)) {
        const clean = lbl.replace(/^[0-9a-zA-Z][\.\)\-]\s*/, '');
        lbl = `${letter}) ${clean}`;
      }
      return { ...c, code: letter, label: lbl };
    });
    handleUpdate({ choices: formatted });
  };

  const handlePopulateMaturityRubric = () => {
    if (isPublished) return;
    const maturityDefaults: ChoiceOption[] = [
      { id: 'mat_1', code: 'a', label: 'a) 1. Not available', score: 0 },
      { id: 'mat_2', code: 'b', label: 'b) 2. Initial', score: 2 },
      { id: 'mat_3', code: 'c', label: 'c) 3. Partially implemented', score: 4 },
      { id: 'mat_4', code: 'd', label: 'd) 4. Implemented', score: 6 },
      { id: 'mat_5', code: 'e', label: 'e) 5. Consistently implemented', score: 8 },
      { id: 'mat_6', code: 'f', label: 'f) 6. Mature / exemplary', score: 10 },
    ];
    handleUpdate({ choices: maturityDefaults, type: 'single_choice' });
  };

  const handlePopulateLikert = () => {
    if (isPublished) return;
    const likertDefaults: ChoiceOption[] = [
      { id: 'likert_1', code: 'a', label: 'a) Strongly Disagree', score: 1 },
      { id: 'likert_2', code: 'b', label: 'b) Disagree', score: 2 },
      { id: 'likert_3', code: 'c', label: 'c) Neutral / Undecided', score: 3 },
      { id: 'likert_4', code: 'd', label: 'd) Agree', score: 4 },
      { id: 'likert_5', code: 'e', label: 'e) Strongly Agree', score: 5 },
    ];
    handleUpdate({ choices: likertDefaults });
  };

  const handlePopulateYesNo = () => {
    if (isPublished) return;
    const yesNoDefaults: ChoiceOption[] = [
      { id: 'opt_yes', code: 'a', label: 'a) Yes', score: 1 },
      { id: 'opt_no', code: 'b', label: 'b) No', score: 0 },
    ];
    handleUpdate({ choices: yesNoDefaults });
  };

  return (
    <Card className="h-full border-slate-200 shadow-sm flex flex-col bg-white overflow-hidden">
      <CardHeader className="py-3.5 px-4 bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-blue-600" />
          <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Question Configuration
          </CardTitle>
        </div>
        {isPublished && (
          <Badge variant="destructive" className="text-[10px] gap-1">
            <Lock className="h-3 w-3" />
            <span>Published (Read-Only)</span>
          </Badge>
        )}
      </CardHeader>

      <CardContent className="p-4 flex-1 overflow-y-auto space-y-5 text-xs">
        {/* Variable Identifier & Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-700">
              Variable Code (Data Name) *
            </label>
            <Input
              value={question.variableName}
              disabled={isPublished}
              onChange={(e) =>
                handleUpdate({
                  variableName: e.target.value.toUpperCase().replace(/\s+/g, '_'),
                })
              }
              placeholder="e.g. PHQ9_Q1"
              className="font-mono text-xs uppercase"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-700">
              Question Type *
            </label>
            <select
              value={question.type}
              disabled={isPublished}
              onChange={(e) =>
                handleUpdate({ type: e.target.value as QuestionType })
              }
              className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
            >
              {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
                <option key={t} value={t}>
                  {QUESTION_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Template Field 1: Question Prompt Text or Section Title (Mandatory) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-slate-700">
              {question.type === 'section_heading' ? 'Section Title' : 'Question Prompt Text'} <span className="text-rose-500 font-bold">*</span>
            </label>
            <span className="text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded font-semibold">
              Mandatory
            </span>
          </div>
          <textarea
            rows={2}
            value={question.text}
            disabled={isPublished}
            onChange={(e) => handleUpdate({ text: e.target.value })}
            placeholder={
              question.type === 'section_heading'
                ? 'e.g. Section 2: Clinical Assessment & Governance'
                : 'Enter the question or instruction presented to the research subject...'
            }
            className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-sans"
          />
        </div>

        {question.type === 'section_heading' && (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-700">
              Section Guidance / Instructions (Optional)
            </label>
            <textarea
              rows={2}
              value={question.explanation || ''}
              disabled={isPublished}
              onChange={(e) => handleUpdate({ explanation: e.target.value })}
              placeholder="Directions or guidance displayed to participants for this section..."
              className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-sans"
            />
          </div>
        )}



        {/* Template Field 4: Remark (Optional) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-amber-600" />
              <span>Remark</span>
            </label>
            <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium border border-amber-200/50">
              Optional
            </span>
          </div>
          <textarea
            rows={2}
            value={question.remark || ''}
            disabled={isPublished}
            onChange={(e) => handleUpdate({ remark: e.target.value })}
            placeholder="Add research remarks, reviewer notes, scoring hints, or observations..."
            className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-sans"
          />
        </div>



        {/* Section Assignment */}
        {sections.length > 0 && (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-700">
              Section Organization
            </label>
            <select
              value={question.sectionId || ''}
              disabled={isPublished}
              onChange={(e) => handleUpdate({ sectionId: e.target.value || undefined })}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
            >
              <option value="">No Section (Default)</option>
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  Section: {sec.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Validation Rules Card */}
        {question.type !== 'section_heading' && (
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 text-xs">
              Response Validation & Constraints
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Question & Options Mandatory</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="req-check"
              checked={Boolean(question.validation.required)}
              disabled={isPublished}
              onChange={(e) => handleValidationUpdate({ required: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="req-check" className="font-medium text-slate-800 cursor-pointer">
              Mandatory / Required Field (Must be answered)
            </label>
          </div>

          {isNumericType && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-semibold uppercase">Min Value</label>
                <Input
                  type="number"
                  value={question.validation.min ?? ''}
                  disabled={isPublished}
                  onChange={(e) =>
                    handleValidationUpdate({
                      min: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                  placeholder="e.g. 0"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-semibold uppercase">Max Value</label>
                <Input
                  type="number"
                  value={question.validation.max ?? ''}
                  disabled={isPublished}
                  onChange={(e) =>
                    handleValidationUpdate({
                      max: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                  placeholder="e.g. 100"
                />
              </div>
            </div>
          )}

          {isTextType && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-semibold uppercase">Min Characters</label>
                <Input
                  type="number"
                  value={question.validation.minLength ?? ''}
                  disabled={isPublished}
                  onChange={(e) =>
                    handleValidationUpdate({
                      minLength: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                  placeholder="e.g. 2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-semibold uppercase">Max Characters</label>
                <Input
                  type="number"
                  value={question.validation.maxLength ?? ''}
                  disabled={isPublished}
                  onChange={(e) =>
                    handleValidationUpdate({
                      maxLength: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                  placeholder="e.g. 500"
                />
              </div>
            </div>
          )}
        </div>
        )}

        {/* Template Field 2: Response Choices Manager (Mandatory for Choice types) */}
        {isChoiceType && (
          <div className="space-y-2.5 pt-1">
            <div className="space-y-2 pb-2 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-800 text-xs">
                    Response Options ({question.choices?.length || 0}) <span className="text-rose-500 font-bold">*</span>
                  </span>
                  <span className="text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded font-semibold border border-rose-200/50">
                    Mandatory
                  </span>
                </div>
                {!isPublished && (
                  <button
                    type="button"
                    onClick={handleFormatChoicesABC}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                    title="Format options with a, b, c labels"
                  >
                    Format a, b, c
                  </button>
                )}
              </div>

              {!isPublished && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-medium">Quick Presets:</span>
                  <button
                    type="button"
                    onClick={handlePopulateMaturityRubric}
                    className="text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 transition-colors"
                    title="Populate 6-option maturity levels with scores 0, 2, 4, 6, 8, 10"
                  >
                    + 6-Level Maturity (0-10)
                  </button>
                  <button
                    type="button"
                    onClick={handlePopulateLikert}
                    className="text-[10px] font-semibold text-blue-700 hover:bg-blue-100 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 transition-colors"
                  >
                    + Likert 5
                  </button>
                  <button
                    type="button"
                    onClick={handlePopulateYesNo}
                    className="text-[10px] font-semibold text-slate-700 hover:bg-slate-100 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 transition-colors"
                  >
                    + Yes/No
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {(question.choices || []).map((choice) => (
                <div
                  key={choice.id}
                  className="p-2 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={choice.code}
                    disabled={isPublished}
                    onChange={(e) =>
                      handleUpdateChoice(choice.id, {
                        code: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                      })
                    }
                    placeholder="CODE"
                    className="w-14 rounded border border-slate-300 bg-white px-1.5 py-1 text-[11px] font-mono lowercase text-center"
                    title="Coded variable value stored in dataset (a, b, c...)"
                  />

                  <input
                    type="text"
                    value={choice.label}
                    disabled={isPublished}
                    onChange={(e) =>
                      handleUpdateChoice(choice.id, { label: e.target.value })
                    }
                    placeholder="Participant choice label (e.g. a) Option)"
                    className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  />



                  {!isPublished && (
                    <button
                      type="button"
                      onClick={() => handleRemoveChoice(choice.id)}
                      className="text-slate-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {!isPublished && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddChoice}
                className="w-full text-xs gap-1 border-dashed"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Choice Option</span>
              </Button>
            )}
          </div>
        )}

        {/* Conditional Skip Logic Trigger */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="font-semibold text-slate-800">Conditional Skip Logic</span>
            <p className="text-[11px] text-slate-400">
              {question.conditionalLogic?.rules.length
                ? `${question.conditionalLogic.rules.length} active condition(s)`
                : 'No display conditions defined'}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPublished}
            onClick={() => setShowLogicModal(true)}
            className="text-xs gap-1.5"
          >
            <GitBranch className="h-3.5 w-3.5 text-blue-600" />
            <span>Configure Logic</span>
          </Button>
        </div>
      </CardContent>

      {/* Conditional Logic Modal */}
      <ConditionalLogicModal
        open={showLogicModal}
        onClose={() => setShowLogicModal(false)}
        question={question}
        allPrecedingQuestions={allPrecedingQuestions}
        onSaveLogic={(logic) => handleUpdate({ conditionalLogic: logic })}
      />
    </Card>
  );
}
