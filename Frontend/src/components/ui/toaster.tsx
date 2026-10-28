import { useToast } from './use-toast';
import { X, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-h-screen w-full max-w-sm flex-col-reverse gap-2 p-4 pointer-events-none">
      {toasts.map(({ id, title, description, variant, action }) => {
        const isDestructive = variant === 'destructive';
        const isSuccess = variant === 'success';

        return (
          <div
            key={id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg transition-all animate-in slide-in-from-bottom-5',
              isDestructive
                ? 'border-red-200 bg-red-50 text-red-900'
                : isSuccess
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-slate-200 bg-white text-slate-900'
            )}
          >
            <div className="mt-0.5 shrink-0">
              {isDestructive && <AlertCircle className="h-5 w-5 text-red-600" />}
              {isSuccess && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
              {!isDestructive && !isSuccess && (
                <AlertTriangle className="h-5 w-5 text-blue-600" />
              )}
            </div>

            <div className="flex-1 space-y-1">
              {title && <h5 className="text-sm font-semibold">{title}</h5>}
              {description && (
                <p className="text-xs text-slate-600 leading-relaxed">
                  {description}
                </p>
              )}
              {action && <div className="mt-2">{action}</div>}
            </div>

            <button
              onClick={() => dismiss(id)}
              className="text-slate-400 hover:text-slate-600 rounded p-0.5"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

