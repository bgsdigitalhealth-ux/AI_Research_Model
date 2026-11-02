import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { useStudyDetail } from '@/hooks/useStudies';
import { StatusState } from '@/components/shared/StatusState';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import {
  ArrowLeft,
  FileText,
  Users,
  Calendar,
  Activity,
  Brain,
  Sparkles,
  Download,
  ChevronDown,
  ChevronUp,
  FileUp,
  BookOpen,
} from 'lucide-react';

export function StudyDetailView() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { data: study, isLoading, isUnavailable, isError, errorDetail, refetch } = useStudyDetail(id || '');

  // Tabs: 'test_case_analysis' (default as in screenshot), 'study_overview', 'generated_questions', 'documents'
  const [activeTab, setActiveTab] = useState<'test_case_analysis' | 'study_overview' | 'generated_questions' | 'documents'>('test_case_analysis');
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>('proto_q_1');

  // Extract or default test case analysis data
  const testCaseData = (study as any)?.researchAims?.test_case_analysis || {
    objective: (study as any)?.description || 'To evaluate the safety and efficacy of Drug X in improving glycemic control in adults with T2D.',
    methodology: 'Randomized, double-blind, placebo-controlled study.',
    study_design: `${study?.phase || 'Phase II'}, multicenter, parallel-group.`,
    population: 'Adults (18–65 years) with Type 2 Diabetes.',
    endpoints: {
      primary: 'Change in HbA1c at 24 weeks.',
      secondary: 'Fasting blood glucose, safety, and tolerability.',
    },
    analysis_plan: 'Intention-to-treat (ITT) with statistical significance (p < 0.05).',
  };

  const generatedQuestions = [
    {
      id: 'proto_q_1',
      text: 'What is the primary objective of the study?',
      choices: [
        { code: 'a', label: 'a) Evaluate safety and efficacy of Drug X in glycemic control', score: 1.0 },
        { code: 'b', label: 'b) Investigate non-glycemic surgical outcomes only', score: 0.0 },
        { code: 'c', label: 'c) Exploratory demographic review without intervention', score: 0.0 },
      ],
      remark: 'Directly validates primary clinical efficacy endpoint.',
      explanation: 'Grounded in protocol Section 1 trial objectives.',
    },
    {
      id: 'proto_q_2',
      text: 'What methodology is used in this clinical trial?',
      choices: [
        { code: 'a', label: 'a) Randomized, double-blind, placebo-controlled study', score: 1.0 },
        { code: 'b', label: 'b) Single-arm observational cohort registry', score: 0.0 },
        { code: 'c', label: 'c) Retrospective chart audit', score: 0.0 },
      ],
      remark: 'Confirms blinding and randomized allocation rigor.',
      explanation: 'Verified against GCP and regulatory compliance criteria.',
    },
    {
      id: 'proto_q_3',
      text: 'What are the inclusion and exclusion criteria?',
      choices: [
        { code: 'a', label: 'a) Adults (18–65 years) with T2D; exclude severe renal impairment', score: 1.0 },
        { code: 'b', label: 'b) All open volunteers without medical screening', score: 0.0 },
        { code: 'c', label: 'c) Pediatric patients only', score: 0.0 },
      ],
      remark: 'Guarantees cohort safety and protocol integrity.',
      explanation: 'Calibrated from admin protocol safety criteria.',
    },
    {
      id: 'proto_q_4',
      text: 'What are the primary and secondary endpoints?',
      choices: [
        { code: 'a', label: 'a) Primary: HbA1c change at 24 wks; Secondary: Fasting glucose & safety', score: 1.0 },
        { code: 'b', label: 'b) General well-being only at 1 year', score: 0.0 },
        { code: 'c', label: 'c) Healthcare insurance cost utilization', score: 0.0 },
      ],
      remark: 'Key metric for statistical power and efficacy evaluation.',
      explanation: 'Aligned with FDA and EMA clinical guidance for antidiabetic agents.',
    },
    {
      id: 'proto_q_5',
      text: 'What statistical analysis plan is mentioned?',
      choices: [
        { code: 'a', label: 'a) Intention-to-treat (ITT) with significance (p < 0.05)', score: 1.0 },
        { code: 'b', label: 'b) Per-protocol descriptive percentages only', score: 0.0 },
        { code: 'c', label: 'c) Non-prespecified subgroup analysis', score: 0.0 },
      ],
      remark: 'Enforces rigorous hypothesis testing and audit validity.',
      explanation: 'Ensures compliance with statistical analysis plan requirements.',
    },
  ];

  const handleDownloadQuestions = () => {
    const dataStr = JSON.stringify(
      {
        studyTitle: study?.title,
        protocolNumber: study?.protocolNumber,
        testCaseAnalysis: testCaseData,
        questions: generatedQuestions,
      },
      null,
      2
    );
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(study?.title || 'study').toLowerCase().replace(/[^a-z0-9]/g, '_')}_questions.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: 'Questions Downloaded',
      description: 'Exported protocol question bank as JSON.',
      variant: 'default',
    });
  };

  return (
    <PageContainer
      title={study?.title || 'Study Details'}
      description={`Protocol ID: ${study?.protocolNumber || id || '—'}`}
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'My Studies', path: '/studies' },
        { label: study?.title || 'Details', isCurrent: true },
      ]}
      actions={
        <Link to="/studies">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs text-slate-600 hover:bg-slate-100">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Studies</span>
          </Button>
        </Link>
      }
    >
      {isUnavailable ? (
        <StatusState
          type="unavailable"
          title="Study Detail Endpoint Unavailable"
          description={`Backend endpoint (/studies/${id}) is currently unreachable.`}
          endpoint={`/studies/${id}`}
          action={{
            label: 'Retry Loading Study',
            onClick: () => refetch(),
          }}
        />
      ) : isError ? (
        <StatusState
          type="error"
          title="Failed to Load Study"
          description={errorDetail?.message || 'Study record could not be retrieved.'}
          action={{
            label: 'Retry',
            onClick: () => refetch(),
          }}
        />
      ) : isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      ) : !study ? (
        <StatusState
          type="empty"
          title="Study Not Found"
          description={`No record found matching identifier ${id}.`}
        />
      ) : (
        <div className="space-y-6">
          {/* Top Tabs Bar */}
          <div className="flex items-center gap-1 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('study_overview')}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'study_overview'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Study Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('test_case_analysis')}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'test_case_analysis'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Brain className="h-4 w-4" />
              <span>Test Case Analysis</span>
            </button>

            <button
              onClick={() => setActiveTab('generated_questions')}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'generated_questions'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              <span>Generated Questions</span>
            </button>

            <button
              onClick={() => setActiveTab('documents')}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'documents'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileUp className="h-4 w-4" />
              <span>Documents</span>
            </button>
          </div>

          {/* Tab 1: Test Case Analysis (Matching Screenshot side-by-side) */}
          {activeTab === 'test_case_analysis' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Panel: Test Case Analysis (from Protocol) */}
              <Card className="shadow-xs border-slate-200">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                      <Brain className="h-4 w-4" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Test Case Analysis (from Protocol)
                    </h3>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs">
                    {/* Objective */}
                    <div className="py-2.5 grid grid-cols-3 gap-2">
                      <span className="font-bold text-slate-700">Objective</span>
                      <span className="col-span-2 text-slate-600 leading-relaxed">
                        {testCaseData.objective}
                      </span>
                    </div>

                    {/* Methodology */}
                    <div className="py-2.5 grid grid-cols-3 gap-2">
                      <span className="font-bold text-slate-700">Methodology</span>
                      <span className="col-span-2 text-slate-600">
                        {testCaseData.methodology}
                      </span>
                    </div>

                    {/* Study Design */}
                    <div className="py-2.5 grid grid-cols-3 gap-2">
                      <span className="font-bold text-slate-700">Study Design</span>
                      <span className="col-span-2 text-slate-600">
                        {testCaseData.study_design}
                      </span>
                    </div>

                    {/* Population */}
                    <div className="py-2.5 grid grid-cols-3 gap-2">
                      <span className="font-bold text-slate-700">Population</span>
                      <span className="col-span-2 text-slate-600">
                        {testCaseData.population}
                      </span>
                    </div>

                    {/* Endpoints */}
                    <div className="py-2.5 grid grid-cols-3 gap-2">
                      <span className="font-bold text-slate-700">Endpoints</span>
                      <div className="col-span-2 text-slate-600 space-y-1">
                        <p>
                          <span className="font-semibold text-slate-700">Primary:</span>{' '}
                          {testCaseData.endpoints?.primary || 'Primary efficacy endpoint at 24 weeks.'}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-700">Secondary:</span>{' '}
                          {testCaseData.endpoints?.secondary || 'Safety, tolerability, and secondary physiological markers.'}
                        </p>
                      </div>
                    </div>

                    {/* Analysis Plan */}
                    <div className="py-2.5 grid grid-cols-3 gap-2">
                      <span className="font-bold text-slate-700">Analysis Plan</span>
                      <span className="col-span-2 text-slate-600">
                        {testCaseData.analysis_plan}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Right Panel: AI Generated Questions */}
              <Card className="shadow-xs border-slate-200">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm">AI Generated Questions</h3>
                    </div>
                    <Badge variant="outline" className="text-purple-700 border-purple-200 bg-purple-50 text-[10px]">
                      {generatedQuestions.length} Items
                    </Badge>
                  </div>

                  {/* Accordion List */}
                  <div className="space-y-2.5">
                    {generatedQuestions.map((q, idx) => {
                      const isExpanded = expandedQuestionId === q.id;
                      return (
                        <div
                          key={q.id}
                          className="border border-slate-200 rounded-xl overflow-hidden bg-white transition-all text-xs"
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)}
                            className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50/70"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-[10px] shrink-0">
                                {idx + 1}
                              </span>
                              <span className="font-semibold text-slate-800">{q.text}</span>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-400" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="px-4 pb-3.5 pt-1 space-y-2.5 border-t border-slate-100 bg-slate-50/40 text-[11px]">
                              <div className="space-y-1">
                                <p className="font-semibold text-slate-700 text-[10px] uppercase tracking-wider">
                                  Standard Options (Radio a,b,c):
                                </p>
                                {q.choices.map((c, cIdx) => (
                                  <div
                                    key={cIdx}
                                    className="flex items-center justify-between py-1 px-2.5 rounded-md bg-white border border-slate-200"
                                  >
                                    <span className="text-slate-800">{c.label}</span>
                                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-slate-500">
                                      Score: {c.score}
                                    </Badge>
                                  </div>
                                ))}
                              </div>

                              {q.remark && (
                                <p className="text-slate-600">
                                  <span className="font-semibold text-slate-700">Remark:</span> {q.remark}
                                </p>
                              )}
                              {q.explanation && (
                                <p className="text-slate-500 italic">
                                  <span className="font-semibold text-slate-700 not-italic">AI Calibration:</span>{' '}
                                  {q.explanation}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-3 flex justify-end">
                    <Button
                      onClick={handleDownloadQuestions}
                      className="gap-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-4"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download Questions</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tab 2: Study Overview */}
          {activeTab === 'study_overview' && (
            <Card className="shadow-xs border-slate-200">
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-slate-900">{study.title}</h2>
                      <Badge variant="default" className="capitalize">
                        {study.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-1">
                      Protocol #{study.protocolNumber}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-600">
                  <div className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50">
                    <Activity className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase">Phase</p>
                      <p className="font-semibold text-slate-800">{study.phase || 'Not Specified'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50">
                    <Users className="h-4 w-4 text-emerald-600" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase">Participants</p>
                      <p className="font-semibold text-slate-800">
                        {study.enrolledParticipants ?? 0} enrolled / {study.targetParticipants ?? '—'} target
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50">
                    <FileText className="h-4 w-4 text-indigo-600" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase">Principal Investigator</p>
                      <p className="font-semibold text-slate-800">{study.principalInvestigator || 'Unassigned'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50">
                    <Calendar className="h-4 w-4 text-amber-600" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase">Last Updated</p>
                      <p className="font-semibold text-slate-800">{formatDate(study.updatedAt)}</p>
                    </div>
                  </div>
                </div>

                {(study as any).description && (
                  <div className="pt-2 text-xs text-slate-600">
                    <p className="font-semibold text-slate-800 mb-1">Study Description:</p>
                    <p>{(study as any).description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tab 3: Generated Questions (Standalone full view) */}
          {activeTab === 'generated_questions' && (
            <Card className="shadow-xs border-slate-200">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Protocol Questions Bank</h3>
                    <p className="text-xs text-slate-500">
                      Standard questions synthesized and calibrated directly from verified protocol.
                    </p>
                  </div>
                  <Button
                    onClick={handleDownloadQuestions}
                    className="gap-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-4"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download All Questions</span>
                  </Button>
                </div>

                <div className="space-y-3">
                  {generatedQuestions.map((q, idx) => (
                    <div key={q.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-800">{q.text}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-7 pt-1">
                        {q.choices.map((c, cIdx) => (
                          <div key={cIdx} className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px]">
                            <p className="font-medium text-slate-800">{c.label}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Score: {c.score}</p>
                          </div>
                        ))}
                      </div>
                      <div className="pl-7 pt-1 text-[11px] text-slate-500">
                        {q.remark && <p><span className="font-semibold text-slate-600">Remark:</span> {q.remark}</p>}
                        {q.explanation && <p className="italic"><span className="font-semibold text-slate-600 not-italic">Clinical Calibration:</span> {q.explanation}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tab 4: Documents */}
          {activeTab === 'documents' && (
            <Card className="shadow-xs border-slate-200">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-bold text-slate-900 text-sm">Study Protocol Documents</h3>
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs">
                  <div className="flex items-center gap-3">
                    <FileText className="h-6 w-6 text-rose-500" />
                    <div>
                      <p className="font-semibold text-slate-800">{study.title} Protocol Document.pdf</p>
                      <p className="text-[10px] text-slate-500">2.4 MB &bull; Status: Verified &bull; Version 1.0</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 text-[10px]">
                    Verified with Admin Protocol
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </PageContainer>
  );
}
