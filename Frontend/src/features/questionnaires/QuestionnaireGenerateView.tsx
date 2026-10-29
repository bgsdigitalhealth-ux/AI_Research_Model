import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useGenerateAiQuestionnaire,
  useUploadQuestionsFile,
} from '@/hooks/useQuestionnaires';
import { useStudiesList } from '@/hooks/useStudies';
import { Study } from '@/types/study';
import { useToast } from '@/components/ui/use-toast';
import {
  Sparkles,
  ArrowLeft,
  AlertCircle,
  ShieldAlert,
  Loader2,
  FileUp,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  CheckCircle2,
  Lightbulb,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function QuestionnaireGenerateView() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const generateMutation = useGenerateAiQuestionnaire();
  const uploadFileMutation = useUploadQuestionsFile();

  // Studies query for dynamic study selection
  const { data: studiesData } = useStudiesList({ limit: 100 });
  const studies: Study[] = Array.isArray(studiesData) ? studiesData : studiesData?.items || [];

  // Mode: 'file' (upload questions from device) or 'topic' (synthesize from aims)
  const [activeTab, setActiveTab] = useState<'file' | 'topic'>('file');

  // Study selection state (dynamic or chosen)
  const [selectedStudyId, setSelectedStudyId] = useState<string>('');

  // Topic parameters state
  const [studyTitle, setStudyTitle] = useState('');
  const [researchAims, setResearchAims] = useState('');
  const [targetPopulation, setTargetPopulation] = useState('');
  const [outcomesText, setOutcomesText] = useState('');
  const [instrumentType, setInstrumentType] = useState<
    'PRO' | 'ClinicianAdministered' | 'Screener' | 'Diagnostic'
  >('PRO');
  const [suggestedCount, setSuggestedCount] = useState<number>(10);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStudyChange = (studyId: string) => {
    setSelectedStudyId(studyId);
    if (studyId) {
      const match = studies.find((s) => s.id === studyId);
      if (match && !studyTitle) {
        setStudyTitle(match.title);
      }
    }
  };

  const getFileCategoryIcon = (fileName: string) => {
    const lower = fileName.toLowerCase();
    if (lower.match(/\.(png|jpg|jpeg|webp|bmp)$/)) {
      return <ImageIcon className="h-6 w-6 text-purple-600" />;
    }
    if (lower.match(/\.(xlsx|xls|csv)$/)) {
      return <FileSpreadsheet className="h-6 w-6 text-emerald-600" />;
    }
    return <FileText className="h-6 w-6 text-blue-600" />;
  };

  const getFileCategoryLabel = (fileName: string) => {
    const lower = fileName.toLowerCase();
    if (lower.match(/\.(png|jpg|jpeg|webp|bmp)$/)) return 'Image Question Bank';
    if (lower.match(/\.(xlsx|xls|csv)$/)) return 'Spreadsheet Questions';
    if (lower.endsWith('.docx')) return 'Word Document';
    return 'PDF Document';
  };

  const handleTopicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const outcomes = outcomesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (outcomes.length === 0) {
      setErrorMessage(
        'Please specify at least one target clinical or behavioral outcome to measure.'
      );
      return;
    }

    try {
      const generated = await generateMutation.mutateAsync({
        studyId: selectedStudyId || undefined,
        studyTitle: studyTitle.trim(),
        researchAims,
        targetPopulation,
        outcomes,
        instrumentType,
        suggestedQuestionCount: suggestedCount,
      });

      toast({
        title: 'Candidate Questionnaire Synthesized',
        description: `Instrument "${generated.title}" created in Draft status in Supabase.`,
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

  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedFile) {
      setErrorMessage('Please select a file containing questions (PDF, Image, Excel, or Word).');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (fileTitle.trim()) {
        formData.append('title', fileTitle.trim());
      }
      if (selectedStudyId) {
        formData.append('studyId', selectedStudyId);
      }

      const generated = await uploadFileMutation.mutateAsync(formData);

      toast({
        title: 'Questions Extracted Successfully',
        description: `Instrument "${generated.title}" created with ${generated.questions.length} questions in template format.`,
        variant: 'success',
      });

      navigate(`/questionnaires/${generated.id}/builder`);
    } catch (err: unknown) {
      const errorMsg =
        (err as { message?: string })?.message ||
        'Backend AI question extraction endpoint (/questionnaires/upload-file) is currently unavailable.';
      setErrorMessage(errorMsg);
    }
  };

  const isPending = generateMutation.isPending || uploadFileMutation.isPending;

  return (
    <PageContainer
      title="AI Questionnaire Generation Workspace"
      description="Synthesize candidate clinical questions, upload question files (PDF, Image, Excel), and format into the standard template."
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
              AI-generated and extracted questionnaire items are categorized as{' '}
              <strong>Candidate Draft Items</strong>. Automated synthesis and extraction does{' '}
              <strong>NOT</strong> confer psychometric reliability, construct validity, or
              standardized clinical calibration without formal clinical trial validation and
              authorized researcher sign-off.
            </p>
          </div>
        </div>

        {/* Template Format Specifications Banner */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <p className="font-bold text-slate-900">Standard Questionnaire Template Format</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1">
            <div className="p-2 rounded-lg bg-white border border-slate-200">
              <span className="font-bold text-slate-900 block">1. Question</span>
              <span className="text-rose-600 font-semibold">* Mandatory</span>
            </div>
            <div className="p-2 rounded-lg bg-white border border-slate-200">
              <span className="font-bold text-slate-900 block">2. Options</span>
              <span className="text-rose-600 font-semibold">* Mandatory (Radio a,b,c)</span>
            </div>
            <div className="p-2 rounded-lg bg-white border border-slate-200">
              <span className="font-bold text-slate-900 block">3. Remark</span>
              <span className="text-amber-700 font-medium">Optional</span>
            </div>
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm overflow-hidden">
          {/* Method Selection Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50/80 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold rounded-lg transition-all',
                activeTab === 'file'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
              )}
            >
              <FileUp className="h-4 w-4 text-blue-600" />
              <span>Upload Questions (PDF, Image, Excel)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('topic')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold rounded-lg transition-all',
                activeTab === 'topic'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
              )}
            >
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span>Synthesize from Research Topic</span>
            </button>
          </div>

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

            {/* TAB 1: UPLOAD QUESTIONS FILE (PDF, IMAGE, EXCEL, DOCX) */}
            {activeTab === 'file' && (
              <form onSubmit={handleFileSubmit} className="space-y-5">
                {/* Target Study Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800">
                    Target Research Study
                  </label>
                  <select
                    value={selectedStudyId}
                    onChange={(e) => handleStudyChange(e.target.value)}
                    disabled={isPending}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    <option value="">-- Dynamic: Auto-link or Create from Title/File --</option>
                    {studies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} {s.protocolNumber ? `(${s.protocolNumber})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800">
                    Questionnaire Title (Optional)
                  </label>
                  <Input
                    value={fileTitle}
                    onChange={(e) => setFileTitle(e.target.value)}
                    placeholder="Leave blank to auto-detect from file header, or enter custom title"
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800">
                    Select Questions File (PDF, Image, Excel, CSV, Word) *
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      'p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center space-y-2',
                      selectedFile
                        ? 'border-blue-400 bg-blue-50/30'
                        : 'border-slate-300 hover:border-slate-400 bg-slate-50/40'
                    )}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp,.xlsx,.xls,.csv,.docx"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setSelectedFile(file);
                      }}
                    />
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                      {selectedFile ? getFileCategoryIcon(selectedFile.name) : <FileUp className="h-6 w-6" />}
                    </div>
                    {selectedFile ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-center gap-2">
                          <p className="font-bold text-sm text-blue-900">{selectedFile.name}</p>
                          <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">
                            {getFileCategoryLabel(selectedFile.name)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {(selectedFile.size / 1024).toFixed(1)} KB · Ready for OpenAI GPT-4o extraction
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                          }}
                          className="text-[11px] text-red-600 hover:underline pt-1"
                        >
                          Change file
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="font-semibold text-xs text-slate-700">
                          Click to select a file containing questions
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Supports <strong>PDF</strong>, <strong>Images</strong> (PNG, JPG), <strong>Excel / CSV</strong> spreadsheets, and <strong>DOCX</strong>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <Link to="/questionnaires">
                    <Button type="button" variant="outline" size="sm" disabled={isPending}>
                      Cancel
                    </Button>
                  </Link>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={isPending || !selectedFile}
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Extracting Questions with OpenAI...</span>
                      </>
                    ) : (
                      <>
                        <FileUp className="h-4 w-4" />
                        <span>Extract & Generate Template</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}

            {/* TAB 2: SYNTHESIZE FROM RESEARCH TOPIC */}
            {activeTab === 'topic' && (
              <form onSubmit={handleTopicSubmit} className="space-y-4">
                {/* Target Study Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800">
                    Target Research Study
                  </label>
                  <select
                    value={selectedStudyId}
                    onChange={(e) => handleStudyChange(e.target.value)}
                    disabled={isPending}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    <option value="">-- Dynamic: Auto-link or Create from Title Below --</option>
                    {studies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} {s.protocolNumber ? `(${s.protocolNumber})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800">
                    Study Title or Clinical Area *
                  </label>
                  <Input
                    required
                    value={studyTitle}
                    onChange={(e) => setStudyTitle(e.target.value)}
                    placeholder="e.g. Longitudinal Quality of Life Assessment in Post-Surgical Oncology"
                    disabled={isPending}
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
                    disabled={isPending}
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
                    disabled={isPending}
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
                    disabled={isPending}
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
                          e.target.value as
                            | 'PRO'
                            | 'ClinicianAdministered'
                            | 'Screener'
                            | 'Diagnostic'
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                      disabled={isPending}
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
                      disabled={isPending}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <Link to="/questionnaires">
                    <Button type="button" variant="outline" size="sm" disabled={isPending}>
                      Cancel
                    </Button>
                  </Link>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={isPending}
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isPending ? (
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
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
