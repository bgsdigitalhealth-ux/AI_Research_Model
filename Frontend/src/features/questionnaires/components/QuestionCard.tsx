import React from 'react';
import { QuestionItem, QuestionType } from '@/types/questionnaire';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Copy,
  GitBranch,
  Sparkles,
  HelpCircle,
  Hash
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
  single_choice: { label: 'Single Choice', color: 'bg-indigo-50 text-indigo-800' },
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
        'p-4 rounded-xl border transition-all cursor-pointer space-y-3 relative',
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

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                #{index + 1} {question.variableName}
              </span>

              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', typeMeta.color)}>
                {typeMeta.label}
              </span>

              {question.validation.required && (
                <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                  * Required
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
                  <span>AI Draft</span>
                </span>
              )}
            </div>

            <p className={cn(
              'text-xs text-slate-900 leading-relaxed font-medium',
              isHeading && 'text-sm font-bold text-slate-900'
            )}>
              {question.text || <span className="text-slate-400 italic">Untitled question</span>}
            </p>

            {question.description && (
              <p className="text-[11px] text-slate-500 italic">
                {question.description}
              </p>
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

      {/* Choices Preview if Choice Type */}
      {question.choices && question.choices.length > 0 && !isHeading && (
        <div className="pt-2 border-t border-slate-100 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Options:</span>
          {question.choices.slice(0, 5).map((opt) => (
            <span
              key={opt.id}
              className="text-[10px] text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md"
            >
              {opt.label} ({opt.code})
            </span>
          ))}
          {question.choices.length > 5 && (
            <span className="text-[10px] text-slate-400">
              +{question.choices.length - 5} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

