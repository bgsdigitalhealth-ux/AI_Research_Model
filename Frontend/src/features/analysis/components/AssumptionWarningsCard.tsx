import { AssumptionWarning } from '@/types/analysis';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

interface AssumptionWarningsCardProps {
  warnings: AssumptionWarning[];
}

export function AssumptionWarningsCard({ warnings }: AssumptionWarningsCardProps) {
  if (!warnings || warnings.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-2 text-emerald-700">
          <CheckCircle2 className="h-5 w-5" />
          <h4 className="text-sm font-semibold">Model Statistical Assumptions</h4>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          All pre-specified model diagnostic assumptions (normality of residuals, homoscedasticity, collinearity)
          were satisfied by the dataset distribution.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900">
          Model Diagnostic &amp; Assumption Verifications
        </h4>
        <span className="text-xs text-slate-500">{warnings.length} assumption checks evaluated</span>
      </div>

      <div className="space-y-3">
        {warnings.map((item, idx) => {
          const isViolation = item.severity === 'violation';
          const isWarning = item.severity === 'warning';

          return (
            <div
              key={idx}
              className={`flex items-start gap-3 rounded-md border p-3 text-xs ${
                isViolation
                  ? 'border-red-200 bg-red-50 text-red-900'
                  : isWarning
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-blue-200 bg-blue-50 text-blue-900'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isViolation ? (
                  <XCircle className="h-4 w-4 text-red-600" />
                ) : isWarning ? (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                ) : (
                  <Info className="h-4 w-4 text-blue-600" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between font-semibold">
                  <span>{item.assumption}</span>
                  {item.testUsed && (
                    <span className="text-[11px] font-normal opacity-80">
                      Test: {item.testUsed}
                      {item.pValue != null && ` (p = ${Number(item.pValue).toFixed(3)})`}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs opacity-90">{item.message}</p>
                {item.recommendation && (
                  <div className="mt-1.5 rounded bg-white/70 px-2 py-1 font-medium text-[11px]">
                    <span className="font-semibold">Recommended Remedy:</span> {item.recommendation}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

