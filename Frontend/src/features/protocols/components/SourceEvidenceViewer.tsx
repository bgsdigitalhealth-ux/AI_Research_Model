import { ExtractionSourceEvidence } from '@/types/protocol';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Bookmark, Quote, Info } from 'lucide-react';

interface SourceEvidenceViewerProps {
  selectedFieldLabel?: string;
  evidence?: ExtractionSourceEvidence;
  uncertainty?: 'high' | 'medium' | 'low';
  isMissing?: boolean;
}

export function SourceEvidenceViewer({
  selectedFieldLabel,
  evidence,
  uncertainty,
  isMissing,
}: SourceEvidenceViewerProps) {
  return (
    <Card className="h-full border-slate-200 shadow-sm flex flex-col bg-slate-50/50">
      <CardHeader className="py-3.5 px-4 bg-white border-b border-slate-100 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-600" />
          <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Source Evidence Viewer
          </CardTitle>
        </div>
        {evidence?.pageNumber !== undefined && (
          <Badge variant="outline" className="text-[10px] bg-slate-50">
            Page {evidence.pageNumber}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="p-4 flex-1 overflow-y-auto space-y-4">
        {selectedFieldLabel ? (
          <div className="space-y-1 pb-3 border-b border-slate-200/80">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Selected Target Field
            </span>
            <p className="text-sm font-bold text-slate-900">{selectedFieldLabel}</p>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-100 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-900">
              Select any extracted field on the right to view its linked document provenance, citation location, and source text snippet.
            </p>
          </div>
        )}

        {isMissing ? (
          <div className="p-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/50 text-center space-y-2">
            <Info className="h-5 w-5 text-amber-600 mx-auto" />
            <p className="text-xs font-semibold text-amber-900">Information Missing in Protocol</p>
            <p className="text-[11px] text-amber-700">
              The AI extraction pipeline found no explicit mention of this parameter in the uploaded document.
            </p>
          </div>
        ) : evidence ? (
          <div className="space-y-3">
            {/* Citation Metadata */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase font-medium">Document Location</span>
                <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Bookmark className="h-3.5 w-3.5 text-blue-600" />
                  {evidence.pageNumber !== undefined ? `Page ${evidence.pageNumber}` : 'Page N/A'}
                  {evidence.paragraphNumber !== undefined && ` · Para ${evidence.paragraphNumber}`}
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase font-medium">Protocol Section</span>
                <p className="font-semibold text-slate-800 truncate" title={evidence.sectionTitle}>
                  {evidence.sectionTitle || 'Unlabeled Section'}
                </p>
              </div>
            </div>

            {/* Quoted Source Text */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Quote className="h-3.5 w-3.5 text-slate-400" />
                  Source Text Evidence
                </span>
                {uncertainty && (
                  <Badge
                    variant={
                      uncertainty === 'high' ? 'destructive' : uncertainty === 'medium' ? 'warning' : 'info'
                    }
                    className="text-[10px] capitalize"
                  >
                    {uncertainty} Uncertainty
                  </Badge>
                )}
              </div>

              <div className="rounded-xl border border-blue-200/80 bg-white p-3.5 text-xs text-slate-700 leading-relaxed font-serif shadow-xs">
                "{evidence.sourceTextSnippet}"
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            No source citation data returned for this item.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

