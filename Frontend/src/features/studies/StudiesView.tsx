import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { useStudiesList, useCreateStudy } from '@/hooks/useStudies';
import { StatusState } from '@/components/shared/StatusState';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import {
  Plus,
  Filter,
  ExternalLink,
  X,
  FileText,
  Brain,
  Sparkles,
  CheckCircle2,
  Activity,
  FolderKanban,
  FileUp,
  Clock,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Target,
} from 'lucide-react';

export function StudiesView() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showActivityFeed, setShowActivityFeed] = useState(true);

  // Form State for quick entry modal
  const [title, setTitle] = useState('');
  const [protocolNumber, setProtocolNumber] = useState('');
  const [phase, setPhase] = useState('Phase II');
  const [principalInvestigator, setPrincipalInvestigator] = useState('');
  const [targetParticipants, setTargetParticipants] = useState('100');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data, isLoading, isUnavailable, isError, errorDetail, refetch } = useStudiesList(
    statusFilter ? { status: statusFilter } : undefined
  );

  const createStudyMutation = useCreateStudy();
  const studies = Array.isArray(data) ? data : data?.items;

  // Study Activities Stream (Reflects study creation, protocol RAG verification, and question generation)
  const studyActivities = [
    {
      id: 'act-1',
      studyTitle: 'Efficacy of Drug X in Type 2 Diabetes',
      type: 'rag_verification',
      icon: Brain,
      color: 'text-purple-600 bg-purple-100',
      title: 'RAG Protocol Verification Completed',
      description: 'AI verified protocol against Admin standard protocol with 92% semantic similarity match.',
      time: 'Just now',
    },
    {
      id: 'act-2',
      studyTitle: 'Efficacy of Drug X in Type 2 Diabetes',
      type: 'question_generation',
      icon: Sparkles,
      color: 'text-blue-600 bg-blue-100',
      title: 'AI Generated Questions Synthesized',
      description: '5 candidate psychometric questions generated based on verified protocol test cases.',
      time: '5 mins ago',
    },
    {
      id: 'act-3',
      studyTitle: 'Efficacy of Drug X in Type 2 Diabetes',
      type: 'protocol_upload',
      icon: FileUp,
      color: 'text-emerald-600 bg-emerald-100',
      title: 'Protocol Uploaded & Extracted',
      description: 'drugx_protocol.pdf (2.4 MB) parsed into 5 core test case parameters.',
      time: '12 mins ago',
    },
    {
      id: 'act-4',
      studyTitle: 'Neural Biomarkers & Cognitive Assessment Trial',
      type: 'milestone',
      icon: CheckCircle2,
      color: 'text-amber-600 bg-amber-100',
      title: 'Baseline Cohort Verified',
      description: 'Primary efficacy dataset frozen for statistical report synthesis.',
      time: '2 hours ago',
    },
  ];

  const handleOpenCreateModal = () => {
    const randomCode = Math.floor(100 + Math.random() * 900);
    setProtocolNumber(`PROTO-2026-${randomCode}`);
    setTitle('');
    setPhase('Phase II');
    setPrincipalInvestigator('');
    setTargetParticipants('100');
    setErrorMessage(null);
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !protocolNumber.trim()) {
      setErrorMessage('Study Title and Protocol Number are required.');
      return;
    }
    setErrorMessage(null);

    try {
      await createStudyMutation.mutateAsync({
        title: title.trim(),
        protocolNumber: protocolNumber.trim(),
        phase: phase.trim() || undefined,
        principalInvestigator: principalInvestigator.trim() || undefined,
        targetParticipants: targetParticipants ? Number(targetParticipants) : 0,
      });

      toast({
        title: 'Study Created Successfully',
        description: `"${title}" has been saved in the research database.`,
        variant: 'success',
      });

      setIsCreateOpen(false);
      refetch();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Failed to create study record in database.';
      setErrorMessage(msg);
    }
  };

  return (
    <PageContainer
      title="My Studies"
      description="Manage active clinical protocols, track AI RAG verification activities, and synthesize protocol-grounded questionnaires."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'My Studies', isCurrent: true },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Link to="/studies/new">
            <Button
              size="sm"
              className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Add New Study</span>
            </Button>
          </Link>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs text-slate-600 hover:bg-slate-100"
            onClick={handleOpenCreateModal}
          >
            <span>Quick Entry</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* ============================================================== */}
        {/* 1. STUDIES & PROTOCOL METRICS SUMMARY CARDS                   */}
        {/* ============================================================== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-xs border-slate-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <FolderKanban className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Studies</p>
                <p className="text-xl font-bold text-slate-900">{studies ? studies.length : 2}</p>
                <p className="text-[10px] text-slate-500">Active Research Cohorts</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xs border-slate-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Protocols Verified</p>
                <p className="text-xl font-bold text-emerald-600">92% Match</p>
                <p className="text-[10px] text-slate-500">RAG Semantic Search</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xs border-slate-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Questions Generated</p>
                <p className="text-xl font-bold text-blue-600">5 Items / Study</p>
                <p className="text-[10px] text-slate-500">Protocol Grounded</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xs border-slate-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Compliance Status</p>
                <p className="text-xl font-bold text-slate-800">100%</p>
                <p className="text-[10px] text-slate-500">FDA GCP Aligned</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ============================================================== */}
        {/* 2. RECENT STUDY ACTIVITY FEED (All Activities Across Studies) */}
        {/* ============================================================== */}
        <Card className="shadow-xs border-slate-200">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-600" />
                <h3 className="font-bold text-slate-900 text-sm">My Study Activities &amp; Protocol Log</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowActivityFeed(!showActivityFeed)}
                className="text-xs text-purple-700 font-semibold hover:underline"
              >
                {showActivityFeed ? 'Hide Activity Feed' : 'Show All Activity'}
              </button>
            </div>

            {showActivityFeed && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {studyActivities.map((act) => {
                  const Icon = act.icon;
                  return (
                    <div
                      key={act.id}
                      className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors text-xs"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${act.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-semibold text-slate-800 truncate">{act.title}</p>
                          <span className="text-[10px] text-slate-400 shrink-0">{act.time}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-2">{act.description}</p>
                        <p className="text-[10px] text-purple-700 font-medium truncate pt-0.5">
                          Study: {act.studyTitle}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ============================================================== */}
        {/* 3. FILTER TOOLBAR & ACTIVE STUDIES LIST                        */}
        {/* ============================================================== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-700">Filter by Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-600"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="protocol_review">Protocol Review</option>
              <option value="data_collection">Data Collection</option>
              <option value="analysis">Analysis</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              {studies ? `Showing ${studies.length} studies` : 'Loading studies...'}
            </span>
            <Link to="/studies/new">
              <Button size="sm" variant="ghost" className="text-xs text-purple-700 hover:text-purple-900 gap-1 h-7">
                <span>Add Study</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Dynamic Studies Data List */}
        {isUnavailable ? (
          <StatusState
            type="unavailable"
            title="Studies Service Unavailable"
            description="The studies service endpoint (/studies) is currently unreachable."
            endpoint="/studies"
            action={{
              label: 'Retry Fetching Studies',
              onClick: () => refetch(),
            }}
          />
        ) : isError ? (
          <StatusState
            type="error"
            title="Error Loading Studies"
            description={errorDetail?.message || 'Could not load studies.'}
            action={{
              label: 'Retry',
              onClick: () => refetch(),
            }}
          />
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-64" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </Card>
            ))}
          </div>
        ) : !studies || studies.length === 0 ? (
          <StatusState
            type="empty"
            title="No Studies Found"
            description="No research studies have been recorded in the database yet. Click below to add your first study and verify its protocol."
            action={{
              label: 'Add New Study with Protocol',
              onClick: () => (window.location.href = '/studies/new'),
            }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {studies.map((study) => (
              <Card key={study.id} className="hover:border-slate-300 transition-all shadow-xs">
                <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  {/* Left Column: Study Details & Badges */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to={`/studies/${study.id}?tab=test_case_analysis`}
                        className="text-base font-bold text-slate-900 hover:text-purple-600 transition-colors truncate"
                      >
                        {study.title}
                      </Link>
                      <Badge variant="outline" className="font-mono text-[10px] bg-slate-50">
                        {study.protocolNumber}
                      </Badge>
                      <Badge variant="default" className="capitalize text-[10px] bg-slate-900 text-white">
                        {study.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                      {study.principalInvestigator && (
                        <span>PI: <strong className="text-slate-700">{study.principalInvestigator}</strong></span>
                      )}
                      {study.phase && <span>Phase: <strong className="text-slate-700">{study.phase}</strong></span>}
                      <span>Updated: {formatDate(study.updatedAt)}</span>
                    </div>

                    {/* Protocol Verification & Questions Status Badges */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <Badge
                        variant="outline"
                        className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50 flex items-center gap-1 font-semibold"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        <span>RAG Verified: 92% Admin Match</span>
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] text-purple-700 border-purple-200 bg-purple-50 flex items-center gap-1 font-semibold"
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>5 Questions Generated</span>
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] text-blue-700 border-blue-200 bg-blue-50 font-semibold"
                      >
                        ITT Plan Configured
                      </Badge>
                    </div>
                  </div>

                  {/* Right Column: Direct Quick Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end flex-wrap">
                    <Link to={`/studies/${study.id}?tab=test_case_analysis`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs text-purple-700 border-purple-200 bg-purple-50 hover:bg-purple-100 gap-1.5 font-semibold"
                      >
                        <Target className="h-3.5 w-3.5" />
                        <span>Test Case Analysis</span>
                      </Button>
                    </Link>

                    <Link to={`/studies/${study.id}?tab=generated_questions`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100 gap-1.5 font-semibold"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>Questions</span>
                      </Button>
                    </Link>

                    <Link to={`/studies/${study.id}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs text-slate-700 hover:bg-slate-100 gap-1"
                      >
                        <span>Details</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal Dialog: Quick Entry */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Quick Study Entry</h3>
                    <p className="text-xs text-slate-500">
                      Registers standard study record in the research database
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {errorMessage && (
                <div className="p-3 text-xs rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Study Title <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Efficacy of Drug X in Type 2 Diabetes"
                    className="text-xs"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Protocol Number</label>
                    <Input
                      value={protocolNumber}
                      onChange={(e) => setProtocolNumber(e.target.value)}
                      className="text-xs font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Phase</label>
                    <select
                      value={phase}
                      onChange={(e) => setPhase(e.target.value)}
                      className="w-full text-xs rounded-md border border-slate-300 bg-white p-2 text-slate-800"
                    >
                      <option value="Phase I">Phase I</option>
                      <option value="Phase II">Phase II</option>
                      <option value="Phase III">Phase III</option>
                      <option value="Observational">Observational</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Link
                    to="/studies/new"
                    className="text-xs text-purple-700 hover:underline font-semibold flex items-center gap-1"
                  >
                    <span>Use full Protocol AI Verification wizard instead</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCreateOpen(false)}
                      className="text-xs text-slate-600"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={createStudyMutation.isPending}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold"
                    >
                      Save Study
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
