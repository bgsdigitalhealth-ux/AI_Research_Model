import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import {
  useQuestionnaireDetail,
  useCreateQuestionnaire,
  useUpdateQuestionnaire,
  useCreateNewVersion,
  useUploadQuestionsFile,
} from '@/hooks/useQuestionnaires';
import { StatusState } from '@/components/shared/StatusState';
import { QuestionCard } from './components/QuestionCard';
import { QuestionSettingsPanel } from './components/QuestionSettingsPanel';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import {
  Questionnaire,
  QuestionItem,
  QuestionType,
  QuestionnaireSection,
} from '@/types/questionnaire';
import {
  Plus,
  Save,
  Eye,
  ShieldCheck,
  History,
  Lock,
  GitBranch,
  Layers,
  ArrowLeft,
  Loader2,
  FolderPlus,
  AlertCircle,
  FileUp,
  Lightbulb,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

export function QuestionnaireBuilderView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = !id || id === 'new';

  const {
    data: remoteData,
    isLoading,
    isUnavailable,
    isError,
    errorDetail,
    refetch,
  } = useQuestionnaireDetail(id || '');

  const createMutation = useCreateQuestionnaire();
  const updateMutation = useUpdateQuestionnaire(id || '');
  const newVersionMutation = useCreateNewVersion(id || '');
  const uploadPdfMutation = useUploadQuestionsFile();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  // Local builder state
  const [title, setTitle] = useState(isNew ? 'Untitled Clinical Instrument' : '');
  const [description, setDescription] = useState('');
  const [sections, setSections] = useState<QuestionnaireSection[]>([]);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [status, setStatus] = useState<Questionnaire['status']>('draft');
  const [version, setVersion] = useState('1.0');

  // Populate local builder state when data is loaded from API
  useEffect(() => {
    if (remoteData) {
      setTitle(remoteData.title);
      setDescription(remoteData.description || '');
      setSections(remoteData.sections || []);
      setQuestions(remoteData.questions || []);
      setStatus(remoteData.status);
      setVersion(remoteData.version);
      if (remoteData.questions && remoteData.questions.length > 0 && !selectedQuestionId) {
        setSelectedQuestionId(remoteData.questions[0].id);
      }
    }
  }, [remoteData]);

  const isPublished = status === 'published';

  // Handle PDF Upload and AI Extraction into Questionnaire Template
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExts = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.bmp', '.xlsx', '.xls', '.csv', '.docx'];
    const fileName = file.name.toLowerCase();
    const isValid = validExts.some(ext => fileName.endsWith(ext));
    if (!isValid) {
      toast({
        title: 'Unsupported File Format',
        description: 'Please upload a PDF, Image (PNG/JPG), Excel (XLSX/XLS/CSV), or Word document.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsUploadingPdf(true);
      const formData = new FormData();
      formData.append('file', file);
      if (title && title !== 'Untitled Clinical Instrument') {
        formData.append('title', title);
      }
      if (remoteData?.studyId) {
        formData.append('studyId', remoteData.studyId);
      }

      const result = await uploadPdfMutation.mutateAsync(formData);

      toast({
        title: 'Questions Extracted Successfully',
        description: `${result.questions?.length || 0} questions parsed into template format (Question, Options, Remark).`,
        variant: 'success',
      });

      if (isNew) {
        navigate(`/questionnaires/${result.id}/builder`, { replace: true });
      } else {
        setTitle(result.title);
        setDescription(result.description || '');
        setSections(result.sections || []);
        setQuestions(result.questions || []);
        if (result.questions && result.questions.length > 0) {
          setSelectedQuestionId(result.questions[0].id);
        }
        setIsDirty(true);
      }
    } catch (err: unknown) {
      toast({
        title: 'PDF Question Extraction Failed',
        description:
          (err as { message?: string })?.message ||
          'Failed to extract questions from the uploaded PDF. Please verify backend service.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingPdf(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Add a new question item
  const handleAddQuestion = (type: QuestionType = 'single_choice') => {
    if (isPublished) return;
    const nextIdx = questions.length + 1;
    const newQ: QuestionItem = {
      id: `q_${Date.now()}_${nextIdx}`,
      variableName: `Q_${nextIdx}`,
      type,
      text: type === 'section_heading' ? `Section ${sections.length + 1}` : `Question ${nextIdx}`,
      explanation: '',
      remark: '',
      order: nextIdx,
      validation: { required: type !== 'section_heading' },
      choices: [
        'single_choice',
        'multiple_choice',
        'rating_5',
        'likert_5',
      ].includes(type)
        ? [
            { id: 'opt_1', code: 'a', label: 'a) Option 1', score: 1 },
            { id: 'opt_2', code: 'b', label: 'b) Option 2', score: 2 },
            { id: 'opt_3', code: 'c', label: 'c) Option 3', score: 3 },
            { id: 'opt_4', code: 'd', label: 'd) Option 4', score: 4 },
          ]
        : undefined,
    };

    setQuestions((prev) => [...prev, newQ]);
    setSelectedQuestionId(newQ.id);
    setIsDirty(true);
  };

  // Reorder question up
  const handleMoveUp = (index: number) => {
    if (isPublished || index === 0) return;
    const newItems = [...questions];
    const temp = newItems[index - 1];
    newItems[index - 1] = newItems[index];
    newItems[index] = temp;
    newItems.forEach((q, i) => (q.order = i + 1));
    setQuestions(newItems);
    setIsDirty(true);
  };

  // Reorder question down
  const handleMoveDown = (index: number) => {
    if (isPublished || index === questions.length - 1) return;
    const newItems = [...questions];
    const temp = newItems[index + 1];
    newItems[index + 1] = newItems[index];
    newItems[index] = temp;
    newItems.forEach((q, i) => (q.order = i + 1));
    setQuestions(newItems);
    setIsDirty(true);
  };

  // Duplicate question
  const handleDuplicate = (question: QuestionItem) => {
    if (isPublished) return;
    const nextIdx = questions.length + 1;
    const dup: QuestionItem = {
      ...JSON.parse(JSON.stringify(question)),
      id: `q_${Date.now()}_dup`,
      variableName: `${question.variableName}_COPY`,
      text: `${question.text} (Copy)`,
      order: nextIdx,
    };
    setQuestions((prev) => [...prev, dup]);
    setSelectedQuestionId(dup.id);
    setIsDirty(true);
  };

  // Delete question
  const handleDelete = (idToDelete: string) => {
    if (isPublished) return;
    const filtered = questions.filter((q) => q.id !== idToDelete);
    filtered.forEach((q, i) => (q.order = i + 1));
    setQuestions(filtered);
    if (selectedQuestionId === idToDelete) {
      setSelectedQuestionId(filtered[0]?.id || null);
    }
    setIsDirty(true);
  };

  // Update specific question from settings panel
  const handleUpdateQuestion = (updated: QuestionItem) => {
    if (isPublished) return;
    setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
    setIsDirty(true);
  };

  // Add Section grouping
  const handleAddSection = () => {
    if (isPublished) return;
    const nextIdx = sections.length + 1;
    const newSec: QuestionnaireSection = {
      id: `sec_${Date.now()}_${nextIdx}`,
      title: `Section ${nextIdx}: General Assessment`,
      description: 'Participant guidance for this section.',
      order: nextIdx,
    };
    setSections((prev) => [...prev, newSec]);
    setIsDirty(true);
  };

  // Save changes
  const handleSaveDraft = async () => {
    if (isPublished) return;
    try {
      if (isNew) {
        const created = await createMutation.mutateAsync({
          title,
          description,
          sections,
          questions,
          status: 'draft',
          version: '1.0',
        });
        toast({
          title: 'Questionnaire Created',
          description: `Instrument "${created.title}" saved to the backend.`,
          variant: 'success',
        });
        setIsDirty(false);
        navigate(`/questionnaires/${created.id}/builder`, { replace: true });
      } else {
        await updateMutation.mutateAsync({
          title,
          description,
          sections,
          questions,
        });
        toast({
          title: 'Draft Saved',
          description: 'Questionnaire schema updated on server.',
          variant: 'success',
        });
        setIsDirty(false);
      }
    } catch (err: unknown) {
      toast({
        title: 'Save Failed',
        description:
          (err as { message?: string })?.message ||
          'Failed to save questionnaire. Please verify backend endpoint is reachable.',
        variant: 'destructive',
      });
    }
  };

  // Branch new version workflow
  const handleBranchNewVersion = async () => {
    try {
      const branched = await newVersionMutation.mutateAsync();
      toast({
        title: 'New Version Branched',
        description: `Draft version v${branched.version} ready for editing.`,
        variant: 'success',
      });
      navigate(`/questionnaires/${branched.id}/builder`);
    } catch (err: unknown) {
      toast({
        title: 'Version Branch Failed',
        description: (err as { message?: string })?.message || 'Could not create new version.',
        variant: 'destructive',
      });
    }
  };

  const selectedQuestion = questions.find((q) => q.id === selectedQuestionId) || null;
  const selectedQuestionIndex = questions.findIndex((q) => q.id === selectedQuestionId);
  const precedingQuestions =
    selectedQuestionIndex > 0 ? questions.slice(0, selectedQuestionIndex) : [];

  return (
    <PageContainer
      title={title || 'Questionnaire Builder'}
      description={`Version v${version} · ${questions.length} Questions · Dynamic Schema Editor`}
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Questionnaires', path: '/questionnaires' },
        { label: title || 'Builder', isCurrent: true },
      ]}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          {/* Hidden File Input for PDF Questions Upload */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePdfUpload}
            accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp,.xlsx,.xls,.csv,.docx"
            className="hidden"
          />

          <Link to="/questionnaires">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
          </Link>

          {!isPublished && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingPdf}
              className="gap-1.5 border-blue-300 bg-blue-50/60 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
            >
              {isUploadingPdf ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span>Extracting Questions...</span>
                </>
              ) : (
                <>
                  <FileUp className="h-4 w-4 text-blue-600" />
                  <span>Upload Questions (PDF, Image, Excel)</span>
                </>
              )}
            </Button>
          )}

          {!isNew && (
            <>
              <Link to={`/questionnaires/${id}/preview`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Eye className="h-4 w-4 text-slate-500" />
                  <span>Participant Preview</span>
                </Button>
              </Link>

              <Link to={`/questionnaires/${id}/review`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>Review & Sign-Off</span>
                </Button>
              </Link>
            </>
          )}

          {isPublished ? (
            <Button
              size="sm"
              onClick={handleBranchNewVersion}
              disabled={newVersionMutation.isPending}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <GitBranch className="h-4 w-4" />
              <span>Branch New Draft Version</span>
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleSaveDraft}
              disabled={createMutation.isPending || updateMutation.isPending || isUploadingPdf}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>{isDirty ? 'Save Draft *' : 'Save Draft'}</span>
                </>
              )}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* PDF Extraction Loading Banner */}
        {isUploadingPdf && (
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center gap-3 animate-in fade-in">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600 shrink-0" />
            <div className="space-y-0.5">
              <p className="font-bold">Extracting Questions with AI (PDF, Image, Excel)</p>
              <p className="text-[11px] text-blue-700">
                Parsing document into standardized template: <strong>Question</strong> (* Mandatory), <strong>Options</strong> in a, b, c format (* Mandatory), and <strong>Remark</strong> (Optional)...
              </p>
            </div>
          </div>
        )}

        {/* Immutable Published Warning Banner */}
        {isPublished && (
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Lock className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-bold">Published Instrument is Immutable</p>
                <p className="text-[11px] text-amber-800">
                  Version v{version} is locked for active clinical data collection. To edit questions or alter validation rules, branch a new version.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleBranchNewVersion}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs shrink-0"
            >
              Create Version v{(parseFloat(version) + 0.1).toFixed(1)}
            </Button>
          </div>
        )}

        {/* Dynamic Loading / Error State if not new */}
        {!isNew && isUnavailable ? (
          <StatusState
            type="unavailable"
            title="Questionnaire Endpoint Unavailable"
            description={`Backend endpoint (/questionnaires/${id}) could not be reached.`}
            endpoint={`/questionnaires/${id}`}
            action={{
              label: 'Retry Fetching Questionnaire',
              onClick: () => refetch(),
            }}
          />
        ) : !isNew && isError ? (
          <StatusState
            type="error"
            title="Failed to Load Questionnaire"
            description={errorDetail?.message || 'Error occurred while loading instrument schema.'}
            action={{
              label: 'Retry',
              onClick: () => refetch(),
            }}
          />
        ) : !isNew && isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
            </div>
            <div className="lg:col-span-5">
              <Skeleton className="h-96 rounded-xl" />
            </div>
          </div>
        ) : (
          /* Main Visual Editor Layout: Questions Canvas (Left 7) & Settings Panel (Right 5) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Columns: Question Items List & Section Organization */}
            <div className="lg:col-span-7 space-y-4">
              {/* Instrument Header Card */}
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">
                      Instrument Title
                    </label>
                    <Input
                      value={title}
                      disabled={isPublished}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="e.g. Patient Health Questionnaire (PHQ-9)"
                      className="font-bold text-sm sm:text-base text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">
                      Description & Participant Instructions
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      disabled={isPublished}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="General directions displayed to participants at the beginning of the instrument..."
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-sans"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Sections & Questions Canvas Header */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Survey Questions ({questions.length} Items)
                  </h3>
                  <Badge variant="outline" className="text-[10px] text-slate-500 font-medium">
                    Question & Options * Mandatory
                  </Badge>
                </div>

                {!isPublished && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingPdf}
                      className="text-xs gap-1 border-blue-200 bg-blue-50/50 text-blue-700 hover:bg-blue-100"
                    >
                      <FileUp className="h-3.5 w-3.5 text-blue-600" />
                      <span>Upload File</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddSection}
                      className="text-xs gap-1"
                    >
                      <FolderPlus className="h-3.5 w-3.5 text-slate-500" />
                      <span>Add Section</span>
                    </Button>

                    <div className="relative inline-block text-left">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddQuestion(e.target.value as QuestionType);
                            e.target.value = '';
                          }
                        }}
                        defaultValue=""
                        className="h-8 rounded-lg border border-blue-600 bg-blue-600 text-white px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="" disabled>
                          + Add Question Type...
                        </option>
                        <option value="single_choice">Single Choice (Radio - a, b, c)</option>
                        <option value="short_text">Short Text</option>
                        <option value="long_text">Long Text</option>
                        <option value="multiple_choice">Multiple Choice (Checkboxes)</option>
                        <option value="rating_5">5-Point Rating</option>
                        <option value="likert_5">5-Point Likert Scale</option>
                        <option value="integer">Integer Number</option>
                        <option value="decimal">Decimal Number</option>
                        <option value="date">Date</option>
                        <option value="time">Time</option>
                        <option value="datetime">Date & Time</option>
                        <option value="section_heading">Section Break</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Genuine Empty State if no questions */}
              {questions.length === 0 ? (
                <div className="p-10 text-center rounded-xl border border-dashed border-slate-300 bg-white space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <FileUp className="h-7 w-7" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-800">No Questions Added Yet</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                      Upload a PDF containing questions to automatically extract them into the template format, or add items manually using the template editor.
                    </p>
                  </div>

                  {/* Questionnaire Template Structure Overview */}
                  <div className="p-3.5 max-w-lg mx-auto rounded-xl bg-slate-50 border border-slate-200 text-left text-xs space-y-1.5 text-slate-700">
                    <p className="font-bold text-slate-900 text-xs">Questionnaire Template Specifications:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1">
                      <div className="p-2 rounded bg-white border border-slate-200">
                        <span className="font-bold text-slate-800 block">1. Question</span>
                        <span className="text-rose-600 font-semibold">* Mandatory</span>
                        <p className="text-slate-500 text-[10px] mt-0.5">Problem statement or participant prompt.</p>
                      </div>
                      <div className="p-2 rounded bg-white border border-slate-200">
                        <span className="font-bold text-slate-800 block">2. Options</span>
                        <span className="text-rose-600 font-semibold">* Mandatory</span>
                        <p className="text-slate-500 text-[10px] mt-0.5">Single-choice radio buttons.</p>
                      </div>
                      <div className="p-2 rounded bg-white border border-slate-200">
                        <span className="font-bold text-slate-800 block">3. Remark</span>
                        <span className="text-amber-700 font-medium">Optional</span>
                        <p className="text-slate-500 text-[10px] mt-0.5">Participant notes, justification, or observations.</p>
                      </div>
                    </div>
                  </div>

                  {!isPublished && (
                    <div className="flex items-center justify-center gap-3 pt-2">
                      <Button
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingPdf}
                        className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                      >
                        {isUploadingPdf ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Extracting with AI...</span>
                          </>
                        ) : (
                          <>
                            <FileUp className="h-4 w-4" />
                            <span>Upload Questions (PDF, Image, Excel)</span>
                          </>
                        )}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddQuestion('single_choice')}
                        className="gap-1.5"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Add Single Choice Question</span>
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {questions.map((question, index) => (
                    <QuestionCard
                      key={question.id}
                      question={question}
                      index={index}
                      totalQuestions={questions.length}
                      isSelected={selectedQuestionId === question.id}
                      isPublished={isPublished}
                      onSelect={() => setSelectedQuestionId(question.id)}
                      onMoveUp={() => handleMoveUp(index)}
                      onMoveDown={() => handleMoveDown(index)}
                      onDuplicate={() => handleDuplicate(question)}
                      onDelete={() => handleDelete(question.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right 5 Columns: Question Settings & Validation Panel */}
            <div className="lg:col-span-5 lg:sticky lg:top-20">
              <QuestionSettingsPanel
                question={selectedQuestion}
                sections={sections}
                allPrecedingQuestions={precedingQuestions}
                isPublished={isPublished}
                onUpdateQuestion={handleUpdateQuestion}
              />
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
