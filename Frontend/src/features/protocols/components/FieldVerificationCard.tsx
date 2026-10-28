import React, { useState } from 'react';
import { ExtractedField, ExtractedFieldStatus } from '@/types/protocol';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EditFieldModal } from './EditFieldModal';
import { FlagFieldModal } from './FlagFieldModal';
import { 
  Check, 
  Edit3, 
  X, 
  Flag, 
  Sparkles, 
  AlertCircle, 
  HelpCircle,
  FileSearch,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FieldVerificationCardProps {
  field: ExtractedField<unknown>;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateStatus: (
    fieldKey: string,
    status: ExtractedFieldStatus,
    verifiedValue?: unknown,
    reviewerNotes?: string,
    flagReason?: string
  ) => Promise<void> | void;
  isLoading?: boolean;
}

const STATUS_BADGE_VARIANTS: Record<ExtractedFieldStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' | 'outline' }> = {
  unreviewed: { label: 'Unreviewed', variant: 'warning' },
  accepted: { label: 'Verified', variant: 'success' },
  edited: { label: 'Researcher Edited', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  flagged: { label: 'Flagged', variant: 'secondary' },
};

export function FieldVerificationCard({
  field,
  isSelected,
  onSelect,
  onUpdateStatus,
  isLoading = false,
}: FieldVerificationCardProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);

  const statusMeta = STATUS_BADGE_VARIANTS[field.status] || STATUS_BADGE_VARIANTS.unreviewed;

  const handleAccept = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateStatus(field.key, 'accepted', field.verifiedValue ?? field.aiValue);
  };

  const handleReject = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateStatus(field.key, 'rejected');
  };

  const handleSaveEdit = async (verifiedValue: string, notes: string) => {
    await onUpdateStatus(field.key, 'edited', verifiedValue, notes);
  };

  const handleSaveFlag = async (reason: string) => {
    await onUpdateStatus(field.key, 'flagged', undefined, undefined, reason);
  };

  const renderValueContent = () => {
    if (field.isMissing) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-amber-700 italic">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Information not located in protocol</span>
        </div>
      );
    }

    const effectiveValue = field.status === 'edited' && field.verifiedValue !== undefined
      ? field.verifiedValue
      : field.aiValue;

    if (Array.isArray(effectiveValue)) {
      if (effectiveValue.length === 0) {
        return <span className="text-xs text-slate-400 italic">None specified</span>;
      }
      return (
        <ul className="list-disc list-inside space-y-1 text-xs text-slate-800">
          {effectiveValue.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {String(item)}
            </li>
          ))}
        </ul>
      );
    }

    return (
      <p className="text-xs text-slate-800 leading-relaxed font-normal whitespace-pre-wrap">
        {String(effectiveValue || '—')}
      </p>
    );
  };

  return (
    <>
      <div
        onClick={onSelect}
        className={cn(
          'p-4 rounded-xl border bg-white transition-all cursor-pointer space-y-3 relative',
          isSelected
            ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
            : 'border-slate-200 hover:border-slate-300 shadow-xs'
        )}
      >
        {/* Card Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-bold text-slate-900">{field.label}</h4>
              <Badge variant={statusMeta.variant} className="text-[10px] py-0 px-2">
                {statusMeta.label}
              </Badge>

              {field.uncertainty && (
                <Badge
                  variant={
                    field.uncertainty === 'high' ? 'destructive' : field.uncertainty === 'medium' ? 'warning' : 'outline'
                  }
                  className="text-[10px] py-0"
                >
                  {field.uncertainty} Uncertainty
                </Badge>
              )}

              {/* Confidence score badge ONLY when returned by API */}
              {field.confidenceScore !== undefined && (
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  {Math.round(field.confidenceScore * 100)}% Match
                </span>
              )}
            </div>
            {field.evidence?.pageNumber !== undefined && (
              <span className="text-[10px] text-blue-600 font-medium inline-flex items-center gap-1">
                <FileSearch className="h-3 w-3" />
                Evidence linked (p. {field.evidence.pageNumber})
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              size="sm"
              variant={field.status === 'accepted' ? 'default' : 'outline'}
              className={cn(
                'h-7 px-2 text-xs gap-1',
                field.status === 'accepted' && 'bg-emerald-600 hover:bg-emerald-700 text-white'
              )}
              title="Accept extracted field"
              disabled={isLoading}
              onClick={handleAccept}
            >
              <Check className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Accept</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant={field.status === 'edited' ? 'default' : 'outline'}
              className="h-7 px-2 text-xs gap-1"
              title="Edit value with researcher revision"
              disabled={isLoading}
              onClick={(e) => {
                e.stopPropagation();
                setShowEditModal(true);
              }}
            >
              <Edit3 className="h-3.5 w-3.5 text-blue-600" />
              <span className="hidden sm:inline">Edit</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant={field.status === 'flagged' ? 'default' : 'outline'}
              className={cn(
                'h-7 px-2 text-xs gap-1',
                field.status === 'flagged' && 'bg-purple-600 hover:bg-purple-700 text-white'
              )}
              title="Flag parameter for investigator review"
              disabled={isLoading}
              onClick={(e) => {
                e.stopPropagation();
                setShowFlagModal(true);
              }}
            >
              <Flag className="h-3.5 w-3.5 text-purple-600" />
              <span className="hidden sm:inline">Flag</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant={field.status === 'rejected' ? 'destructive' : 'outline'}
              className="h-7 px-2 text-xs"
              title="Reject extraction suggestion"
              disabled={isLoading}
              onClick={handleReject}
            >
              <X className="h-3.5 w-3.5 text-red-600" />
            </Button>
          </div>
        </div>

        {/* Value Box */}
        <div
          className={cn(
            'p-3 rounded-lg border text-xs',
            field.status === 'edited'
              ? 'bg-blue-50/40 border-blue-200'
              : field.status === 'accepted'
              ? 'bg-emerald-50/30 border-emerald-200'
              : field.status === 'rejected'
              ? 'bg-red-50/30 border-red-200 line-through text-slate-400'
              : 'bg-slate-50 border-slate-100'
          )}
        >
          {field.status === 'edited' && (
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-700 uppercase mb-1.5">
              <CheckCircle2 className="h-3 w-3" />
              <span>Researcher Verified Replacement</span>
            </div>
          )}

          {field.status === 'unreviewed' && (
            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 uppercase mb-1">
              <Sparkles className="h-3 w-3 text-blue-500" />
              <span>AI Suggested Field</span>
            </div>
          )}

          {renderValueContent()}
        </div>

        {/* Flag Reason if present */}
        {field.status === 'flagged' && field.flagReason && (
          <div className="p-2.5 rounded-lg bg-purple-50 text-purple-900 border border-purple-200 text-xs flex items-start gap-2">
            <Flag className="h-3.5 w-3.5 text-purple-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Review Flag: </span>
              <span>{field.flagReason}</span>
            </div>
          </div>
        )}

        {/* Reviewer Note if edited */}
        {field.status === 'edited' && field.reviewerNotes && (
          <div className="text-[11px] text-slate-500 italic px-1">
            Note: {field.reviewerNotes}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <EditFieldModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        fieldLabel={field.label}
        originalAiValue={field.aiValue}
        currentValue={field.verifiedValue}
        onSave={handleSaveEdit}
        isLoading={isLoading}
      />

      {/* Flag Modal */}
      <FlagFieldModal
        open={showFlagModal}
        onClose={() => setShowFlagModal(false)}
        fieldLabel={field.label}
        onFlag={handleSaveFlag}
        isLoading={isLoading}
      />
    </>
  );
}

