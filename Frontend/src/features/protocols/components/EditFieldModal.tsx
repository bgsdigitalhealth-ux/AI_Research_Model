import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Sparkles, Check, AlertCircle } from 'lucide-react';

interface EditFieldModalProps {
  open: boolean;
  onClose: () => void;
  fieldLabel: string;
  originalAiValue: unknown;
  currentValue?: unknown;
  onSave: (verifiedValue: string, notes: string) => Promise<void> | void;
  isLoading?: boolean;
}

export function EditFieldModal({
  open,
  onClose,
  fieldLabel,
  originalAiValue,
  currentValue,
  onSave,
  isLoading = false,
}: EditFieldModalProps) {
  const rawVal = currentValue ?? originalAiValue;
  const initialText = Array.isArray(rawVal)
    ? (rawVal as unknown[]).map(String).join('\n')
    : String(rawVal ?? '');

  const [value, setValue] = useState(initialText);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      setError('Verified value cannot be empty. If rejecting, use the Reject action instead.');
      return;
    }
    setError(null);
    try {
      await onSave(value, notes);
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to save field edit.');
    }
  };

  const aiDisplayString = Array.isArray(originalAiValue)
    ? originalAiValue.join('\n')
    : String(originalAiValue ?? 'None');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Edit Research Parameter</h3>
            <p className="text-xs text-slate-500">{fieldLabel}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 text-xs rounded-lg bg-red-50 text-red-700 border border-red-200 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Read-Only AI Suggestion for Provenance */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase">
              <Sparkles className="h-3 w-3 text-blue-500" />
              <span>Original AI Suggestion (Preserved)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 max-h-24 overflow-y-auto font-mono whitespace-pre-wrap">
              {aiDisplayString}
            </div>
          </div>

          {/* Editable Researcher Field */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-800">
              Researcher Verified Value *
            </label>
            <textarea
              rows={4}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent font-sans"
              placeholder="Enter verified protocol specification..."
              required
            />
          </div>

          {/* Audit / Reviewer Notes */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Reviewer Notes (Optional audit reason)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="e.g. Corrected sample size per amended protocol statistical section 5.1"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isLoading} className="gap-1.5">
              <Check className="h-4 w-4" />
              <span>{isLoading ? 'Saving...' : 'Apply Verification'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

