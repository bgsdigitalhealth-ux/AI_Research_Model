import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useGenerateAiQuestionnaire } from '@/hooks/useQuestionnaires';
import { useToast } from '@/components/ui/use-toast';
import {
  Sparkles,
  ArrowLeft,
  AlertCircle,
  ShieldAlert,
  Loader2,
  Info,
  CheckCircle2
} from 'lucide-react';

export function QuestionnaireGenerateView() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const generateMutation = useGenerateAiQuestionnaire();

  const [studyTitle, setStudyTitle] = useState('');
  const [researchAims, setResearchAims] = useState('');
  const [targetPopulation, setTargetPopulation] = useState('');
  const [outcomesText, setOutcomesText] = useState('');
  const [instrumentType, setInstrumentType] = useState<'PRO' | 'ClinicianAdministered' | 'Screener' | 'Diagnostic'>('PRO');
  const [suggestedCount, setSuggestedCount] = useState<number>(10);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const outcomes = outcomesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (outcomes.length === 0) {
      setErrorMessage('Please specify at least one target clinical or behavioral outcome to measure.');
      return;
    }

    try {
      const generated = await generateMutation.mutateAsync({
        studyTitle,
        researchAims,
        targetPopulation,
        outcomes,
        instrumentType,
        suggestedQuestionCount: suggestedCount,
      });

      toast({
        title: 'Candidate Questionnaire Synthesized',
        description: `Instrument "${generated.title}" created in Draft status.`,
        variant: 'success',
      });

      navigate(`/questionnaires/${generated.id}/builder`);
    } catch (err: unknown) {
      const errorMsg =
        (err as { message?: string })?.message ||
        'Backend AI questionnaire generation endpoint (/questionnaires/generate) is currently unavailable.';
      setErrorMessage(errorMsg);
    }
  };

  return (
    <PageContainer
      title="AI Questionnaire Generation Workspace"
      description="Synthesize candidate clinical questions, PRO items, and Likert scales mapped to research aims."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Questionnaires', path: '/questionnaires' },
        { label: 'AI Generator', isCurrent: true },
      ]}
      actions={
        <Link to="/questionnaires">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            <span>Cancel</span>
          </Button>
        </Link>
      }
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Scientific Integrity Disclosure */}
        <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Scientific & Regulatory Disclosure</p>
            <p className="text-[11px] leading-relaxed text-amber-800">
              AI-generated questionnaire items are categorized as <strong>Candidate Draft Items</strong>. Automated synthesis does <strong>NOT</strong> confer psychometric reliability, construct validity, or standardized clinical calibration without formal clinical trial validation and authorized researcher sign-off.
            </p>
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="p-6 border-b border-slate-100 flex flex-row items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Instrument Synthesis Parameters
              </CardTitle>
              <p className="text-xs text-slate-500">
                Invokes the backend AI model endpoint (`POST /api/questionnaires/generate`)
              </p>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-4">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-50 text-red-800 border border-red-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">Generation Failed</p>
                  <p>{errorMessage}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-800">
                  Study Title or Clinical Area *
                </label>
                <Input
                  required
                  value={studyTitle}
                  onChange={(e) => setStudyTitle(e.target.value)}
                  placeholder="e.g. Longitudinal Quality of Life Assessment in Post-Surgical Oncology"
                  disabled={generateMutation.isPending}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-800">
                  Target Research Population *
                </label>
                <Input
                  required
                  value={targetPopulation}
                  onChange={(e) => setTargetPopulation(e.target.value)}
                  placeholder="e.g. Adult patients (ages 18-65) undergoing outpatient physical rehabilitation"
                  disabled={generateMutation.isPending}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-800">
                  Research Aims & Protocol Objectives *
                </label>
                <textarea
                  rows={3}
                  required
                  value={researchAims}
                  onChange={(e) => setResearchAims(e.target.value)}
                  placeholder="Specify primary research questions, hypotheses, or theoretical domains to evaluate..."
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-sans"
                  disabled={generateMutation.isPending}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-800">
                  Target Clinical Outcomes / Variables to Measure (One per line) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={outcomesText}
                  onChange={(e) => setOutcomesText(e.target.value)}
                  placeholder="e.g.&#10;Functional mobility score&#10;Self-reported pain intensity&#10;Treatment satisfaction"
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-sans"
                  disabled={generateMutation.isPending}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800">
                    Instrument Type Classification
                  </label>
                  <select
                    value={instrumentType}
                    onChange={(e) =>
                      setInstrumentType(
                        e.target.value as 'PRO' | 'ClinicianAdministered' | 'Screener' | 'Diagnostic'
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                    disabled={generateMutation.isPending}
                  >
                    <option value="PRO">Patient-Reported Outcome (PRO)</option>
                    <option value="ClinicianAdministered">Clinician-Administered CRF</option>
                    <option value="Screener">Eligibility Screener</option>
                    <option value="Diagnostic">Diagnostic Symptom Inventory</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800">
                    Suggested Question Item Count
                  </label>
                  <Input
                    type="number"
                    min={3}
                    max={50}
                    value={suggestedCount}
                    onChange={(e) => setSuggestedCount(Number(e.target.value))}
                    disabled={generateMutation.isPending}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Link to="/questionnaires">
                  <Button type="button" variant="outline" size="sm" disabled={generateMutation.isPending}>
                    Cancel
                  </Button>
                </Link>

                <Button
                  type="submit"
                  size="sm"
                  disabled={generateMutation.isPending}
                  className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Synthesizing Questionnaire with AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Generate Questionnaire Draft</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

