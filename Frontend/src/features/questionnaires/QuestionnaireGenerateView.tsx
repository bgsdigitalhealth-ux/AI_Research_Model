import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
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
  Loader2,
  FileUp,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  CheckCircle2,
  ArrowRight,
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

  // Mode: 'topic' (synthesize from aims & criteria) | 'file' (upload questions)
  const [activeTab, setActiveTab] = useState<'topic' | 'file'>('topic');

  // Study selection state (dynamic or chosen)
  const [selectedStudyId, setSelectedStudyId] = useState<string>('');
  const [studyTitle, setStudyTitle] = useState('');

  // Topic parameters state
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

  // Topic submit (Triggers backend Pinecone RAG semantic search & question synthesis)
  const handleTopicSubmit = async (e: React.FormEvent) => {
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
        studyId: selectedStudyId || undefined,
        studyTitle: studyTitle.trim() || 'Clinical Assessment',
        researchAims,
        targetPopulation,
        outcomes,
        instrumentType,
        suggestedQuestionCount: suggestedCount,
      });

      toast({
        title: 'Candidate Questionnaire Synthesized',
        description: `Instrument "${generated.title}" created with ${generated.questions.length} questions.`,
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

  // File submit
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
          <div className="flex border-b border-slate-200 bg-slate-50/80 p-1 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('topic')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold rounded-lg transition-all',
                activeTab === 'topic'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
              )}
            >
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span>Research Topic &amp; Aims</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold rounded-lg transition-all',
                activeTab === 'file'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
              )}
            >
              <FileUp className="h-4 w-4 text-indigo-600" />
              <span>Upload Question File</span>
            </button>
          </div>

          <CardContent className="p-6 space-y-4">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-50 text-red-800 border border-red-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">Operation Notice</p>
                  <p>{errorMessage}</p>
                </div>
              </div>
            )}

            {/* TAB 1: SYNTHESIZE FROM RESEARCH TOPIC & AIMS */}
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
                    placeholder="e.g. Longitudinal Quality of Life Assessment in Post-Surgical Oncology"
                    value={studyTitle}
                    onChange={(e) => setStudyTitle(e.target.value)}
                    disabled={isPending}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800">
                    Research Aims &amp; Specific Question Objectives *
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Describe your research aims or specific questionnaire requirements. For example:&#10;'Assess medication adherence, side-effect tolerability, short-term memory lapses, and daytime fatigue in chemotherapy survivors.'"
                    value={researchAims}
                    onChange={(e) => setResearchAims(e.target.value)}
                    disabled={isPending}
                    className="w-full rounded-lg border border-slate-300 p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-800">
                      Target Clinical Outcomes (One per line) *
                    </label>
                    <span className="text-[11px] text-slate-400">Primary &amp; secondary endpoints</span>
                  </div>
                  <textarea
                    rows={3}
                    required
                    placeholder="Physical Fatigue Burden&#10;Emotional Wellbeing&#10;Cognitive Executive Function&#10;Sleep Disturbance"
                    value={outcomesText}
                    onChange={(e) => setOutcomesText(e.target.value)}
                    disabled={isPending}
                    className="w-full rounded-lg border border-slate-300 p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-sans"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-800">
                      Target Population (Optional)
                    </label>
                    <Input
                      placeholder="e.g. Adult outpatients, Geriatric cohort, Post-op"
                      value={targetPopulation}
                      onChange={(e) => setTargetPopulation(e.target.value)}
                      disabled={isPending}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-800">
                      Instrument Classification
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
                      <option value="Diagnostic">Diagnostic Inventory</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800">
                    Desired Question Count
                  </label>
                  <select
                    value={suggestedCount}
                    onChange={(e) => setSuggestedCount(Number(e.target.value))}
                    className="w-full sm:w-48 rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                    disabled={isPending}
                  >
                    <option value={5}>5 Questions (Short Screener)</option>
                    <option value={10}>10 Questions (Standard Instrument)</option>
                    <option value={15}>15 Questions (Comprehensive)</option>
                    <option value={20}>20 Questions (Extended Battery)</option>
                  </select>
                </div>

                {/* Submit Action */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                  <Button
                    type="submit"
                    disabled={isPending || !outcomesText.trim()}
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
                  >
                    {generateMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Synthesizing Questionnaire...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>Generate Questionnaire</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}

            {/* TAB 2: UPLOAD QUESTIONS FILE */}
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
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white"
                  >
                    <option value="">-- Dynamic: Auto-link or Create from File Name --</option>
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
                    placeholder="Leave blank to use filename or document header"
                    value={fileTitle}
                    onChange={(e) => setFileTitle(e.target.value)}
                    disabled={isPending}
                    className="text-xs"
                  />
                </div>

                {/* Drag & Drop File Upload Box */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-800 block">
                    Upload Questions File (PDF, Image, Excel, Word) *
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp,.xlsx,.xls,.docx,.csv"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                        if (!fileTitle) {
                          const base = e.target.files[0].name.replace(/\.[^/.]+$/, '');
                          setFileTitle(base.replace(/[-_]/g, ' '));
                        }
                      }
                    }}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                      selectedFile
                        ? 'border-indigo-300 bg-indigo-50/30'
                        : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/10'
                    )}
                  >
                    {selectedFile ? (
                      <div className="space-y-2">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
                          {getFileCategoryIcon(selectedFile.name)}
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-900">{selectedFile.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {getFileCategoryLabel(selectedFile.name)} •{' '}
                            {(selectedFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            fileInputRef.current?.click();
                          }}
                          className="h-7 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50 mt-1"
                        >
                          Change Selected File
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <FileUp className="h-6 w-6 text-indigo-600" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-slate-800">
                            Click to browse or drag and drop your questions document
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Supported: PDF documents, Image scans (PNG/JPG), Excel workbooks (XLSX/CSV), Word documents (DOCX)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                  <Button
                    type="submit"
                    disabled={isPending || !selectedFile}
                    className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs"
                  >
                    {uploadFileMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Extracting Questions into Template...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Extract Questions into Template</span>
                        <ArrowRight className="h-3.5 w-3.5" />
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
