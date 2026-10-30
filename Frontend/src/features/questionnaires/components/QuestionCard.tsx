import React from 'react';
import { QuestionItem, QuestionType } from '@/types/questionnaire';
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Copy,
  GitBranch,
  Sparkles,
  Lightbulb,
  MessageSquare,
  Folder,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuestionCardProps {
  question: QuestionItem;
  index: number;
  totalQuestions: number;
  isSelected: boolean;
  isPublished: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const TYPE_BADGE_VARIANTS: Record<QuestionType, { label: string; color: string }> = {
  short_text: { label: 'Short Text', color: 'bg-slate-100 text-slate-800' },
  long_text: { label: 'Long Text', color: 'bg-slate-100 text-slate-800' },
  integer: { label: 'Integer', color: 'bg-blue-50 text-blue-800' },
  decimal: { label: 'Decimal', color: 'bg-blue-50 text-blue-800' },
  date: { label: 'Date', color: 'bg-emerald-50 text-emerald-800' },
  time: { label: 'Time', color: 'bg-emerald-50 text-emerald-800' },
  datetime: { label: 'Date/Time', color: 'bg-emerald-50 text-emerald-800' },
  single_choice: { label: 'Single Choice (Radio)', color: 'bg-indigo-50 text-indigo-800' },
  multiple_choice: { label: 'Multiple Choice', color: 'bg-purple-50 text-purple-800' },
  rating_5: { label: '5-Pt Rating', color: 'bg-amber-50 text-amber-800' },
  likert_5: { label: '5-Pt Likert', color: 'bg-amber-50 text-amber-800' },
  section_heading: { label: 'Heading', color: 'bg-slate-200 text-slate-900 font-bold' },
};

export function QuestionCard({
  question,
  index,
  totalQuestions,
  isSelected,
  isPublished,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
}: QuestionCardProps) {
  const typeMeta = TYPE_BADGE_VARIANTS[question.type] || {
    label: question.type,
    color: 'bg-slate-100 text-slate-800',
  };

  const isHeading = question.type === 'section_heading';

  return (
    <div
      onClick={onSelect}
      className={cn(
        'p-4 rounded-xl border transition-all cursor-pointer space-y-3.5 relative',
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/15 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300 shadow-xs'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left Indicator & Reorder Arrows */}
        <div className="flex items-center gap-2">
          {!isPublished && (
            <div
              className="flex flex-col gap-0.5 text-slate-400"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                disabled={index === 0}
                onClick={onMoveUp}
                aria-label={`Move question ${question.variableName} up`}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={index === totalQuestions - 1}
                onClick={onMoveDown}
                aria-label={`Move question ${question.variableName} down`}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded">
                #{index + 1} {question.variableName}
              </span>

              {question.type !== 'single_choice' && (
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', typeMeta.color)}>
                  {typeMeta.label}
                </span>
              )}

              {/* Mandatory Template Field Badge */}
              {!isHeading && (
                <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60">
                  * Mandatory: Question & Options
                </span>
              )}



              {question.remark && (
                <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60 flex items-center gap-1">
                  <MessageSquare className="h-2.5 w-2.5 text-amber-600" />
                  <span>Remark</span>
                </span>
              )}

              {question.conditionalLogic?.rules.length ? (
                <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  <span>Conditional</span>
                </span>
              ) : null}

              {question.isAiGenerated && (
                <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  <span>AI Template</span>
                </span>
              )}
            </div>

            {/* Template Field 1: Question or Section Header */}
            {isHeading ? (
              <div className="flex items-center gap-2.5 py-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs shrink-0">
                  <Folder className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      Section Header
                    </span>
                    <span className="text-xs font-mono text-slate-500">#{index + 1}</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 pt-0.5">
                    {question.text || 'Untitled Section'}
                  </h4>
                  {question.explanation && (
                    <p className="text-xs text-slate-500">{question.explanation}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-600 text-white text-[11px] font-bold shadow-xs shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wide flex items-center gap-1">
                    Question <span className="text-rose-500 font-bold">*</span>
                  </span>
                </div>
                <p className="text-xs text-slate-900 leading-relaxed font-semibold pl-7">
                  {question.text || <span className="text-slate-400 italic">Untitled question</span>}
                </p>
              </div>
            )}


          </div>
        </div>

        {/* Right Action Icons */}
        {!isPublished && (
          <div
            className="flex items-center gap-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onDuplicate}
              aria-label="Duplicate question"
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100"
              title="Duplicate"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete question"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Template Field 2: Options (Mandatory) with Radio Buttons in a, b, c format */}
      {question.choices && question.choices.length > 0 && !isHeading && (
        <div className="pt-2 border-t border-slate-100 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide flex items-center gap-1">
              Response Options <span className="text-rose-500 font-bold">*</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Mandatory</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {question.choices.map((opt, i) => {
              const letter = String.fromCharCode(97 + i); // a, b, c, d
              let label = opt.label;
              if (!label.toLowerCase().startsWith(`${letter})`)) {
                const clean = label.replace(/^[0-9a-zA-Z][\.\)\-]\s*/, '');
                label = `${letter}) ${clean}`;
              }
              return (
                <div
                  key={opt.id || i}
                  className="flex items-center gap-2 p-1.5 px-2.5 rounded-lg border border-slate-200 bg-slate-50/70 text-xs text-slate-800"
                >
                  <input
                    type="radio"
                    readOnly
                    checked={false}
                    name={`preview_radio_${question.id}`}
                    className="h-3.5 w-3.5 text-blue-600 border-slate-300 focus:ring-blue-500 cursor-default"
                  />
                  <span className="font-medium text-[11px] flex-1">{label}</span>

                </div>
              );
            })}
          </div>
        </div>
      )}



      {/* Template Field 4: Remark (Optional) */}
      {question.remark && (
        <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80 text-amber-950 text-xs space-y-0.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase text-amber-800 tracking-wider">
              <MessageSquare className="h-3 w-3 text-amber-600" />
              <span>Remark</span>
            </div>
            <span className="text-[10px] text-amber-600/80 font-medium">Optional</span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-900 pt-0.5">
            {question.remark}
          </p>
        </div>
      )}
    </div>
  );
}
