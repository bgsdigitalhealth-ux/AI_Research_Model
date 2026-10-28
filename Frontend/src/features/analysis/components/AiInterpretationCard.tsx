import { AiStatisticalExplanation } from '@/types/analysis';
import { Sparkles, ShieldCheck, AlertCircle, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AiInterpretationCardProps {
  explanation?: AiStatisticalExplanation;
}

export function AiInterpretationCard({ explanation }: AiInterpretationCardProps) {
  if (!explanation) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
        AI interpretation narrative has not been synthesized for this run or is currently disabled.
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border-2 border-indigo-100 bg-linear-to-b from-indigo-50/40 to-white p-5 shadow-xs">
      {/* Top Banner separating AI from verified math */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-white shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">
              AI Statistical &amp; Clinical Interpretation
            </h4>
            <p className="text-[11px] text-slate-500">
              Automated synthesis based on approved statistical analysis plan and verified outputs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {explanation.verifiedAgainstProtocol && (
            <Badge variant="outline" className="gap-1 border-indigo-200 bg-indigo-50 text-indigo-700">
              <ShieldCheck className="h-3 w-3" />
              <span>Concordant with Protocol SAP</span>
            </Badge>
          )}
          <Badge variant="secondary" className="text-[10px] uppercase font-mono">
            AI Advisory
          </Badge>
        </div>
      </div>

      {/* Notice Banner */}
      <div className="mb-4 flex items-center gap-2 rounded-md bg-indigo-100/60 px-3 py-2 text-xs text-indigo-900">
        <AlertCircle className="h-4 w-4 shrink-0 text-indigo-600" />
        <span>
          <strong>Scientific Disclaimer:</strong> This narrative is an AI-generated synthesis to assist researcher review.
          Authoritative study conclusions must rely strictly on the verified mathematical parameters and prespecified SAP.
        </span>
      </div>

      <div className="space-y-4 text-xs text-slate-700">
        {/* Executive Synthesis */}
        <div>
          <h5 className="font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
            Executive Statistical Summary
          </h5>
          <p className="leading-relaxed bg-white/80 p-3 rounded-md border border-slate-200/80">
            {explanation.summary}
          </p>
        </div>

        {/* Clinical / Domain Interpretation */}
        <div>
          <h5 className="font-semibold text-slate-900 mb-1">Clinical &amp; Practical Relevance</h5>
          <p className="leading-relaxed bg-white/80 p-3 rounded-md border border-slate-200/80">
            {explanation.clinicalInterpretation}
          </p>
        </div>

        {/* Plain Language Interpretation */}
        <div>
          <h5 className="font-semibold text-slate-900 mb-1">Lay / Non-Technical Explanation</h5>
          <p className="leading-relaxed bg-white/80 p-3 rounded-md border border-slate-200/80">
            {explanation.plainLanguageSummary}
          </p>
        </div>

        {/* Limitations & Caveats */}
        {explanation.limitations && explanation.limitations.length > 0 && (
          <div>
            <h5 className="font-semibold text-slate-900 mb-1">Methodological Limitations &amp; Caveats</h5>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              {explanation.limitations.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Confidence Note */}
        {explanation.confidenceNote && (
          <div className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-100">
            Note: {explanation.confidenceNote}
          </div>
        )}
      </div>
    </div>
  );
}

