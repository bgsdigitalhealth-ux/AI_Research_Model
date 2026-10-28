import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Flag, AlertTriangle } from 'lucide-react';

interface FlagFieldModalProps {
  open: boolean;
  onClose: () => void;
  fieldLabel: string;
  onFlag: (reason: string) => Promise<void> | void;
  isLoading?: boolean;
}

export function FlagFieldModal({
  open,
  onClose,
  fieldLabel,
  onFlag,
  isLoading = false,
}: FlagFieldModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason for flagging this extracted parameter.');
      return;
    }
    setError(null);
    try {
      await onFlag(reason);
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to flag field.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-purple-50 text-purple-700">
              <Flag className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Flag Parameter for Review</h3>
              <p className="text-xs text-slate-500">{fieldLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 text-xs rounded-lg bg-red-50 text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-800">
              Reason for Flagging *
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              placeholder="e.g. Ambiguous definition in section 3.1; requires clarification with principal investigator."
              required
            />
          </div>

          <div className="p-3 rounded-lg bg-purple-50/60 border border-purple-100 flex items-start gap-2 text-xs text-purple-900">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-purple-600" />
            <p className="leading-relaxed">
              Flagging alerts collaborating investigators that this parameter requires formal clarification before study protocol sign-off.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading}
              className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
            >
              <Flag className="h-3.5 w-3.5" />
              <span>{isLoading ? 'Flagging...' : 'Submit Flag'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

