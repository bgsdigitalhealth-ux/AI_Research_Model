import React, { useState, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
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
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type GenerationMode = 'topic_only' | 'topic_file' | 'extract_file';

export function QuestionnaireGenerateView() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as GenerationMode) || 'topic_only';

  const generateMutation = useGenerateAiQuestionnaire();
  const uploadFileMutation = useUploadQuestionsFile();

  // Studies query for dynamic study selection
  const { data: studiesData } = useStudiesList({ limit: 100 });
  const studies: Study[] = Array.isArray(studiesData) ? studiesData : studiesData?.items || [];

  // Active Tab: 3 Distinct Options
  // 1. 'topic_only': AI generates Question: user gives only topic and description
  // 2. 'topic_file': User gives topic, description, and PDF or image reference
  // 3. 'extract_file': User gives questions in PDF/image format to extract into template
  const [activeTab, setActiveTab] = useState<GenerationMode>(initialTab);

  // Common Study Selection State
  const [selectedStudyId, setSelectedStudyId] = useState<string>('');
  const [studyTitle, setStudyTitle] = useState('');

  // Option 1 & 2: Topic & Description Parameters
  const [researchAims, setResearchAims] = useState('');
  const [targetPopulation, setTargetPopulation] = useState('');
  const [outcomesText, setOutcomesText] = useState('');
  const [instrumentType, setInstrumentType] = useState<
    'PRO' | 'ClinicianAdministered' | 'Screener' | 'Diagnostic'
  >('PRO');
  const [suggestedCount, setSuggestedCount] = useState<number>(10);

  // Option 2 & 3: File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const refFileInputRef = useRef<HTMLInputElement | null>(null);

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
    if (lower.match(/\.(png|jpg|jpeg|webp|bmp)$/)) return 'Image Document';
    if (lower.match(/\.(xlsx|xls|csv)$/)) return 'Spreadsheet';
    if (lower.endsWith('.docx')) return 'Word Document';
    return 'PDF Document';
  };

  // Option 1: AI generates from Topic & Description Only
  const handleTopicOnlySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!studyTitle.trim()) {
      setErrorMessage('Please specify a study title or clinical topic.');
      return;
    }

    const aims = researchAims.trim() || studyTitle.trim();
    const outcomes = outcomesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const generated = await generateMutation.mutateAsync({
        studyId: selectedStudyId || undefined,
        studyTitle: studyTitle.trim(),
        researchAims: aims,
        targetPopulation: targetPopulation.trim() || 'Clinical Study Cohort',
        outcomes: outcomes.length > 0 ? outcomes : [studyTitle.trim()],
        instrumentType,
        suggestedQuestionCount: suggestedCount,
      });

      toast({
        title: 'Questions Synthesized Successfully',
        description: `Instrument "${generated.title}" created with ${generated.questions.length} questions in template format.`,
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

  // Option 2: Topic & Description + Reference PDF / Image
  const handleTopicFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!studyTitle.trim()) {
      setErrorMessage('Please provide a study topic or clinical area title.');
      return;
    }

    if (!selectedFile) {
      setErrorMessage('Please upload a reference PDF or image to guide question generation.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', studyTitle.trim());
      if (researchAims.trim()) {
        formData.append('description', researchAims.trim());
      }
      if (selectedStudyId) {
        formData.append('studyId', selectedStudyId);
      }

      const generated = await uploadFileMutation.mutateAsync(formData);

      toast({
        title: 'Questions Generated from Topic & Reference File',
        description: `Instrument "${generated.title}" created with ${generated.questions.length} questions in template format.`,
        variant: 'success',
      });

      navigate(`/questionnaires/${generated.id}/builder`);
    } catch (err: unknown) {
      const errorMsg =
        (err as { message?: string })?.message ||
        'Backend question extraction endpoint (/questionnaires/upload-file) is currently unavailable.';
      setErrorMessage(errorMsg);
    }
  };

  // Option 3: Extract from Questions File (PDF / Image / Excel / Word)
  const handleExtractFileSubmit = async (e: React.FormEvent) => {
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
        'Backend question extraction endpoint (/questionnaires/upload-file) is currently unavailable.';
      setErrorMessage(errorMsg);
    }
  };

  const isPending = generateMutation.isPending || uploadFileMutation.isPending;

  return (
    <PageContainer
      title="Questionnaire Generation Workspace"
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
          {/* Three Options Navigation Tabs */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-b border-slate-200 bg-slate-50/80 p-1.5 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('topic_only');
                setErrorMessage(null);
              }}
              className={cn(
                'flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold rounded-lg transition-all text-center',
                activeTab === 'topic_only'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
              )}
            >
              <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
              <div className="text-left">
                <span className="block leading-tight">1. Topic &amp; Description</span>
                <span className="text-[10px] font-normal text-slate-500">AI generates questions</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('topic_file');
                setErrorMessage(null);
              }}
              className={cn(
                'flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold rounded-lg transition-all text-center',
                activeTab === 'topic_file'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
              )}
            >
              <FileText className="h-4 w-4 text-indigo-600 shrink-0" />
              <div className="text-left">
                <span className="block leading-tight">2. Topic + PDF / Image</span>
                <span className="text-[10px] font-normal text-slate-500">Topic + reference file</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('extract_file');
                setErrorMessage(null);
              }}
              className={cn(
                'flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold rounded-lg transition-all text-center',
                activeTab === 'extract_file'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
              )}
            >
              <FileUp className="h-4 w-4 text-emerald-600 shrink-0" />
              <div className="text-left">
                <span className="block leading-tight">3. Questions PDF / Image</span>
                <span className="text-[10px] font-normal text-slate-500">Extract from questions sheet</span>
              </div>
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

            {/* ============================================================== */}
            {/* OPTION 1: AI WILL GENERATE QUESTION FROM TOPIC & DESCRIPTION   */}
            {/* ============================================================== */}
            {activeTab === 'topic_only' && (
              <form onSubmit={handleTopicOnlySubmit} className="space-y-4">


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
                    Study Title or Clinical Topic *
                  </label>
                  <Input
                    required
                    placeholder="e.g. Enhancing Accuracy and Reducing Hallucinations in Retrieval-Augmented Generation"
                    value={studyTitle}
                    onChange={(e) => setStudyTitle(e.target.value)}
                    disabled={isPending}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800">
                    Topic Description &amp; Specific Question Objectives *
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Enter detailed description, research aims, or clinical requirements. For example:&#10;'Evaluate retrieval relevance precision, document ground truth alignment, hallucination reduction in LLM generation, and hybrid search effectiveness.'"
                    value={researchAims}
                    onChange={(e) => setResearchAims(e.target.value)}
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
                      placeholder="e.g. Clinical research cohort, Adult outpatients"
                      value={targetPopulation}
                      onChange={(e) => setTargetPopulation(e.target.value)}
                      disabled={isPending}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-800">
                      Desired Question Count
                    </label>
                    <select
                      value={suggestedCount}
                      onChange={(e) => setSuggestedCount(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                      disabled={isPending}
                    >
                      <option value={5}>5 Questions (Short Screener)</option>
                      <option value={10}>10 Questions (Standard Instrument)</option>
                      <option value={15}>15 Questions (Comprehensive)</option>
                      <option value={20}>20 Questions (Extended Battery)</option>
                    </select>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                  <Button
                    type="submit"
                    disabled={isPending || !studyTitle.trim() || !researchAims.trim()}
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
                        <span>Generate Questions from Topic &amp; Description</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}

            {/* ============================================================== */}
            {/* OPTION 2: USER GIVES TOPIC, DESCRIPTION + PDF OR IMAGE         */}
            {/* ============================================================== */}
            {activeTab === 'topic_file' && (
              <form onSubmit={handleTopicFileSubmit} className="space-y-4">


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
                    Study Title or Clinical Topic *
                  </label>
                  <Input
                    required
                    placeholder="e.g. Cognitive Fatigue & Decision Resilience Protocol"
                    value={studyTitle}
                    onChange={(e) => setStudyTitle(e.target.value)}
                    disabled={isPending}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800">
                    Topic Description &amp; Specific Objectives
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe specific themes, focus areas, or instructions to combine with the uploaded document/image..."
                    value={researchAims}
                    onChange={(e) => setResearchAims(e.target.value)}
                    disabled={isPending}
                    className="w-full rounded-lg border border-slate-300 p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-sans"
                  />
                </div>

                {/* Reference File Upload */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-800 block">
                    Upload Reference Document or Image (PDF, PNG, JPG, Word) *
                  </label>
                  <input
                    type="file"
                    ref={refFileInputRef}
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.docx"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  <div
                    onClick={() => refFileInputRef.current?.click()}
                    className={cn(
                      'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
                      selectedFile
                        ? 'border-indigo-300 bg-indigo-50/30'
                        : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/10'
                    )}
                  >
                    {selectedFile ? (
                      <div className="space-y-2">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
                          {getFileCategoryIcon(selectedFile.name)}
                        </div>
                        <div className="space-y-0.5">
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
                            refFileInputRef.current?.click();
                          }}
                          className="h-7 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50 mt-1"
                        >
                          Change Reference File
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <FileText className="h-5 w-5 text-indigo-600" />
                        </div>
                        <p className="text-xs font-semibold text-slate-800">
                          Click to browse or drop reference PDF or image
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Supports research protocols (PDF), architecture diagrams (PNG/JPG), or study briefs (DOCX)
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                  <Button
                    type="submit"
                    disabled={isPending || !studyTitle.trim() || !selectedFile}
                    className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs"
                  >
                    {uploadFileMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Synthesizing from Topic &amp; File...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Generate Questions from Topic + File</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}

            {/* ============================================================== */}
            {/* OPTION 3: USER GIVES QUESTIONS IN PDF / IMAGE FORMAT           */}
            {/* ============================================================== */}
            {activeTab === 'extract_file' && (
              <form onSubmit={handleExtractFileSubmit} className="space-y-5">


                {/* Target Study Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800">
                    Target Research Study
                  </label>
                  <select
                    value={selectedStudyId}
                    onChange={(e) => handleStudyChange(e.target.value)}
                    disabled={isPending}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
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
                        ? 'border-emerald-300 bg-emerald-50/30'
                        : 'border-slate-300 hover:border-emerald-400 bg-slate-50/50 hover:bg-emerald-50/10'
                    )}
                  >
                    {selectedFile ? (
                      <div className="space-y-2">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
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
                          className="h-7 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 mt-1"
                        >
                          Change Selected File
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <FileUp className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-slate-800">
                            Click to browse or drag and drop your questions document
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Supported: PDF questionnaires, scanned question images (PNG/JPG), Excel question banks (XLSX/CSV), Word documents (DOCX)
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
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
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
