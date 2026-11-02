import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  useGenerateAiQuestionnaire,
  useUploadQuestionsFile,
  useSemanticSearchQuestions,
  useGenerateFromRequirements,
} from '@/hooks/useQuestionnaires';
import { useStudiesList } from '@/hooks/useStudies';
import { Study } from '@/types/study';
import { SemanticQuestionMatch } from '@/types/questionnaire';
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
  Search,
  Database,
  ArrowRight,
  HelpCircle,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function QuestionnaireGenerateView() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const generateMutation = useGenerateAiQuestionnaire();
  const uploadFileMutation = useUploadQuestionsFile();
  const semanticSearchMutation = useSemanticSearchQuestions();
  const generateRequirementsMutation = useGenerateFromRequirements();

  // Studies query for dynamic study selection
  const { data: studiesData } = useStudiesList({ limit: 100 });
  const studies: Study[] = Array.isArray(studiesData) ? studiesData : studiesData?.items || [];

  // Mode: 'requirements' (Pinecone Semantic RAG) | 'topic' (synthesize from aims) | 'file' (upload questions)
  const [activeTab, setActiveTab] = useState<'requirements' | 'topic' | 'file'>('requirements');

  // Study selection state (dynamic or chosen)
  const [selectedStudyId, setSelectedStudyId] = useState<string>('');
  const [studyTitle, setStudyTitle] = useState('');

  // 1. Semantic Requirements State (Pinecone Vector Search)
  const [userRequirements, setUserRequirements] = useState('');
  const [reqQuestionCount, setReqQuestionCount] = useState<number>(5);
  const [reqPopulation, setReqPopulation] = useState('');
  const [reqInstrumentType, setReqInstrumentType] = useState<
    'PRO' | 'ClinicianAdministered' | 'Screener' | 'Diagnostic'
  >('PRO');
  const [semanticMatches, setSemanticMatches] = useState<SemanticQuestionMatch[]>([]);
  const [isSearchingSemantic, setIsSearchingSemantic] = useState(false);

  // 2. Topic parameters state
  const [researchAims, setResearchAims] = useState('');
  const [targetPopulation, setTargetPopulation] = useState('');
  const [outcomesText, setOutcomesText] = useState('');
  const [instrumentType, setInstrumentType] = useState<
    'PRO' | 'ClinicianAdministered' | 'Screener' | 'Diagnostic'
  >('PRO');
  const [suggestedCount, setSuggestedCount] = useState<number>(10);

  // 3. File upload state
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

  // Preset quick requirement chips
  const REQUIREMENT_PRESETS = [
    {
      label: 'Cognitive Fatigue & Memory in Oncology',
      text: 'Evaluating cancer-related cognitive impairment (chemobrain), short-term memory lapses, and daytime fatigue in chemotherapy survivors.',
    },
    {
      label: 'Medication Adherence & Adverse Signals',
      text: 'Assess medication compliance, intentional dose-skipping, and uncomfortable side effects in patients with chronic cardiovascular illness.',
    },
    {
      label: 'Anxiety, Worry & Sleep Quality',
      text: 'Measure emotional distress, uncontrolled worrying, and non-restorative sleep disturbances during clinical trial participation.',
    },
    {
      label: 'Post-Surgical Pain & Functional Mobility',
      text: 'Evaluate bodily pain intensity, analgesic satisfaction, and interference with physical routine tasks following orthopedic surgery.',
    },
  ];

  // Live Pinecone Semantic Search Preview
  const handlePreviewSemantic = async () => {
    if (!userRequirements.trim()) {
      setErrorMessage('Please enter user requirements before searching Pinecone vectors.');
      return;
    }
    setErrorMessage(null);
    setIsSearchingSemantic(true);
    try {
      const res = await semanticSearchMutation.mutateAsync({
        query: userRequirements.trim(),
        topK: 4,
      });
      setSemanticMatches(res.matches || []);
      if (!res.matches || res.matches.length === 0) {
        toast({
          title: 'Semantic Vector Search Complete',
          description: 'No exact vector matches found; novel items will be synthesized via GPT-4o.',
        });
      }
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        'Pinecone semantic search temporarily unavailable.';
      toast({
        title: 'Semantic Search Notice',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSearchingSemantic(false);
    }
  };

  // Requirements submit: Pinecone Vector Retrieval + GPT-4o
  const handleRequirementsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!userRequirements.trim()) {
      setErrorMessage('Please specify your research requirements or clinical measurement criteria.');
      return;
    }

    try {
      const generated = await generateRequirementsMutation.mutateAsync({
        requirements: userRequirements.trim(),
        studyId: selectedStudyId || undefined,
        studyTitle: studyTitle.trim() || undefined,
        targetPopulation: reqPopulation.trim() || undefined,
        instrumentType: reqInstrumentType,
        questionCount: reqQuestionCount,
      });

      toast({
        title: 'Questionnaire Generated via Pinecone Semantic Search',
        description: `Instrument "${generated.title}" synthesized with ${generated.questions.length} questions.`,
        variant: 'success',
      });

      navigate(`/questionnaires/${generated.id}/builder`);
    } catch (err: unknown) {
      const errorMsg =
        (err as { message?: string })?.message ||
        'Pinecone semantic search and AI question generation endpoint is currently unreachable.';
      setErrorMessage(errorMsg);
    }
  };

  // Topic submit
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

  const isPending =
    generateMutation.isPending ||
    uploadFileMutation.isPending ||
    generateRequirementsMutation.isPending;

  return (
    <PageContainer
      title="AI Questionnaire Generation Workspace"
      description="Synthesize candidate clinical questions using Pinecone semantic vector search, topic parameters, or uploaded question files."
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
            <p className="font-bold">Scientific &amp; Regulatory Disclosure</p>
            <p className="text-[11px] leading-relaxed text-amber-800">
              AI-generated and extracted questionnaire items are categorized as{' '}
              <strong>Candidate Draft Items</strong>. Automated synthesis and vector extraction does{' '}
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
          <div className="flex flex-col sm:flex-row border-b border-slate-200 bg-slate-50/80 p-1 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('requirements')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold rounded-lg transition-all',
                activeTab === 'requirements'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
              )}
            >
              <Database className="h-4 w-4 text-emerald-600" />
              <span>Semantic Search (Pinecone RAG)</span>
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300 font-mono py-0 px-1">
                Vector DB
              </Badge>
            </button>
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

            {/* TAB 1: PINECONE SEMANTIC SEARCH & REQUIREMENTS */}
            {activeTab === 'requirements' && (
              <form onSubmit={handleRequirementsSubmit} className="space-y-5">
                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 text-xs flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-900">Pinecone Vector Semantic Search Engine</span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-200/70 text-emerald-900">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        Connected (1536-dim)
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-800 mt-1">
                      Enter your clinical research requirements in plain language. Pinecone semantic vector similarity retrieves validated measurement exemplars and grounds GPT-4o to synthesize tailored candidate questions.
                    </p>
                  </div>
                </div>

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
                    <option value="">-- Dynamic: Auto-link or Create from Requirements --</option>
                    {studies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} {s.protocolNumber ? `(${s.protocolNumber})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* User Requirements Textarea */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-800">
                      User Requirements &amp; Specific Question Objectives *
                    </label>
                    <span className="text-[11px] text-slate-400">Natural language criteria</span>
                  </div>
                  <textarea
                    rows={4}
                    required
                    value={userRequirements}
                    onChange={(e) => setUserRequirements(e.target.value)}
                    placeholder="Describe your assessment requirements in detail. For example:&#10;'We need to assess medication adherence, intentional missed doses, side-effect tolerability, and subjective symptom burden in elderly type 2 diabetes patients.'"
                    className="w-full rounded-lg border border-slate-300 p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-sans"
                    disabled={isPending}
                  />

                  {/* Quick-fill preset chips */}
                  <div className="pt-1">
                    <span className="text-[11px] text-slate-500 font-medium block mb-1.5">
                      Or click an example clinical scenario:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {REQUIREMENT_PRESETS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setUserRequirements(preset.text)}
                          className="px-2.5 py-1 text-[11px] rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 text-slate-700 transition-colors text-left"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-800">
                      Target Population (Optional)
                    </label>
                    <Input
                      value={reqPopulation}
                      onChange={(e) => setReqPopulation(e.target.value)}
                      placeholder="e.g. Adult outpatients, Geriatric cohort, Post-op"
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-800">
                      Instrument Classification
                    </label>
                    <select
                      value={reqInstrumentType}
                      onChange={(e) =>
                        setReqInstrumentType(
                          e.target.value as
                            | 'PRO'
                            | 'ClinicianAdministered'
                            | 'Screener'
                            | 'Diagnostic'
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
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
                    value={reqQuestionCount}
                    onChange={(e) => setReqQuestionCount(Number(e.target.value))}
                    className="w-full sm:w-48 rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                    disabled={isPending}
                  >
                    <option value={3}>3 Questions (Micro-screener)</option>
                    <option value={5}>5 Questions (Standard)</option>
                    <option value={8}>8 Questions (Comprehensive)</option>
                    <option value={10}>10 Questions (Full scale)</option>
                    <option value={15}>15 Questions (Extended battery)</option>
                  </select>
                </div>

                {/* Semantic Match Preview Section */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Search className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-900">Pinecone Vector Search Preview</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePreviewSemantic}
                      disabled={isSearchingSemantic || isPending || !userRequirements.trim()}
                      className="h-7 text-xs gap-1 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                    >
                      {isSearchingSemantic ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Searching Vectors...</span>
                        </>
                      ) : (
                        <>
                          <Search className="h-3.5 w-3.5" />
                          <span>Preview Similar Questions</span>
                        </>
                      )}
                    </Button>
                  </div>

                  {semanticMatches.length > 0 && (
                    <div className="space-y-2 mt-3">
                      <p className="text-[11px] text-slate-500">
                        Top {semanticMatches.length} validated items retrieved from Pinecone index using cosine vector similarity:
                      </p>
                      <div className="space-y-2 max-h-64 overflow-y-auto p-1">
                        {semanticMatches.map((match) => (
                          <div
                            key={match.id}
                            className="p-3 rounded-lg border border-emerald-200 bg-white shadow-xs space-y-1.5 text-xs text-slate-800"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-200">
                                {match.domain}
                              </Badge>
                              <span className="font-mono text-[10px] font-bold text-emerald-700">
                                {(match.score * 100).toFixed(1)}% Match
                              </span>
                            </div>
                            <p className="font-semibold text-slate-900">{match.text}</p>
                            {match.choices && match.choices.length > 0 && (
                              <div className="flex flex-wrap gap-1 text-[10px] text-slate-500">
                                {match.choices.map((c, i) => (
                                  <span key={i} className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                                    {c.label}
                                  </span>
                                ))}
                              </div>
                            )}
                            {match.explanation && (
                              <p className="text-[10px] text-slate-500 italic">
                                Rationale: {match.explanation}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-[11px] text-slate-400">
                    Embeddings: text-embedding-3-small • Model: GPT-4o
                  </div>

                  <Button
                    type="submit"
                    disabled={isPending || isSearchingSemantic || !userRequirements.trim()}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                  >
                    {generateRequirementsMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Searching Pinecone &amp; Synthesizing Questions...</span>
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4" />
                        <span>Generate with Pinecone Semantic Search</span>
                        <ArrowRight className="h-3.5 w-3.5" />
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
                    Research Aims &amp; Protocol Objectives *
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
                      Target Question Count
                    </label>
                    <select
                      value={suggestedCount}
                      onChange={(e) => setSuggestedCount(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                      disabled={isPending}
                    >
                      <option value={5}>5 Questions (Brief Screening)</option>
                      <option value={10}>10 Questions (Standard Instrument)</option>
                      <option value={15}>15 Questions (Comprehensive Battery)</option>
                      <option value={20}>20 Questions (In-depth Evaluation)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                    <HelpCircle className="h-3.5 w-3.5" />
                    <span>Formatted in standard template (radio a, b, c format)</span>
                  </div>

                  <Button
                    type="submit"
                    disabled={isPending}
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    {generateMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Synthesizing Questionnaire with AI...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>Synthesize Candidate Questionnaire</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}

            {/* TAB 3: UPLOAD QUESTIONS FILE (PDF, IMAGE, EXCEL, DOCX) */}
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
                      <div>
                        <p className="font-bold text-xs text-blue-900">{selectedFile.name}</p>
                        <p className="text-[11px] text-blue-600 mt-0.5">
                          {getFileCategoryLabel(selectedFile.name)} •{' '}
                          {(selectedFile.size / 1024).toFixed(1)} KB (Ready to extract)
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-bold text-xs text-slate-700">
                          Click to browse questions document or image
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Supports PDF, PNG, JPG, Excel (.xlsx, .csv), and Word (.docx)
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Converts all questions into mandatory single_choice radio format</span>
                  </div>

                  <Button
                    type="submit"
                    disabled={isPending || !selectedFile}
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    {uploadFileMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Extracting Questions with OpenAI...</span>
                      </>
                    ) : (
                      <>
                        <FileUp className="h-4 w-4" />
                        <span>Extract &amp; Generate Template</span>
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
