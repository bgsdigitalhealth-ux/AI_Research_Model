import { StatisticalEstimate } from '@/types/analysis';
import { Badge } from '@/components/ui/badge';

interface EstimatesTableProps {
  estimates: StatisticalEstimate[];
  title?: string;
  notes?: string;
}

export function EstimatesTable({
  estimates,
  title = 'Model Parameter Estimates & Hypothesis Testing',
  notes,
}: EstimatesTableProps) {
  if (!estimates || estimates.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        No parameter coefficients or estimates returned by the calculation engine.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        {notes && <p className="text-xs text-slate-500 mt-0.5">{notes}</p>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Parameter / Predictor</th>
              <th className="px-4 py-3 text-right">Estimate ($\beta$ / Diff)</th>
              <th className="px-4 py-3 text-right">Std. Error</th>
              <th className="px-4 py-3 text-right">Test Statistic</th>
              <th className="px-4 py-3 text-right">df</th>
              <th className="px-4 py-3 text-right">p-value</th>
              <th className="px-4 py-3 text-right">95% CI [Lower, Upper]</th>
              <th className="px-4 py-3 text-center">Inference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {estimates.map((row, idx) => {
              const pValFormatted =
                row.pValue < 0.001 ? '< 0.001' : row.pValue.toFixed(3);
              const dfFormatted =
                Array.isArray(row.degreesOfFreedom)
                  ? row.degreesOfFreedom.join(', ')
                  : row.degreesOfFreedom !== undefined
                  ? String(row.degreesOfFreedom)
                  : '—';

              return (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.parameter}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-800">
                    {row.estimate > 0 ? `+${row.estimate.toFixed(4)}` : row.estimate.toFixed(4)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600">
                    {row.stdError.toFixed(4)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-800">
                    <span className="text-slate-400 text-[10px] mr-1">{row.statisticName} =</span>
                    {row.statistic.toFixed(3)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-500">{dfFormatted}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium">
                    <span
                      className={
                        row.pValue < 0.05
                          ? 'font-bold text-emerald-600'
                          : 'text-slate-600'
                      }
                    >
                      {pValFormatted}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600">
                    [{row.ciLower.toFixed(3)}, {row.ciUpper.toFixed(3)}]
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.significant ? (
                      <Badge variant="success" className="text-[10px] uppercase">
                        Significant (p &lt; .05)
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        Not Significant
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

