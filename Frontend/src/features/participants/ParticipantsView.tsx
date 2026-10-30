import React, { useState } from 'react';
import { PageContainer } from '@/components/shared/PageContainer';
import {
  useParticipantsList,
  useParticipantMetrics,
  useEnrollParticipant,
  useWithdrawParticipant,
} from '@/hooks/useParticipants';
import { useStudiesList } from '@/hooks/useStudies';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { Participant } from '@/types/participant';
import {
  Users,
  UserCheck,
  UserX,
  Activity,
  CheckCircle2,
  Search,
  Filter,
  UserPlus,
  X,
  Loader2,
  AlertCircle,
  Building2,
  Calendar,
  Layers,
} from 'lucide-react';

export function ParticipantsView() {
  const { toast } = useToast();

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudyId, setSelectedStudyId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Modals State
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [participantToWithdraw, setParticipantToWithdraw] = useState<Participant | null>(null);

  // Enroll Form State
  const [enrollStudyId, setEnrollStudyId] = useState('');
  const [enrollIdentifierCode, setEnrollIdentifierCode] = useState('');
  const [enrollCohort, setEnrollCohort] = useState('');
  const [enrollSiteLocation, setEnrollSiteLocation] = useState('');
  const [enrollContactEmail, setEnrollContactEmail] = useState('');
  const [enrollErrorMessage, setEnrollErrorMessage] = useState<string | null>(null);

  // Withdraw Form State
  const [withdrawReasonPreset, setWithdrawReasonPreset] = useState('Voluntary participant withdrawal');
  const [withdrawCustomReason, setWithdrawCustomReason] = useState('');
  const [withdrawErrorMessage, setWithdrawErrorMessage] = useState<string | null>(null);

  // Queries & Mutations
  const { data: metrics, isLoading: isMetricsLoading } = useParticipantMetrics();
  const {
    data: participantsData,
    isLoading: isParticipantsLoading,
    refetch: refetchParticipants,
  } = useParticipantsList(
    selectedStudyId || selectedStatus
      ? {
          studyId: selectedStudyId || undefined,
          status: selectedStatus || undefined,
        }
      : undefined
  );

  const { data: studiesData } = useStudiesList();
  const studies = Array.isArray(studiesData) ? studiesData : studiesData?.items || [];

  const enrollMutation = useEnrollParticipant();
  const withdrawMutation = useWithdrawParticipant();

  const participants: Participant[] = Array.isArray(participantsData) ? participantsData : [];

  // Filtered by Search Query
  const filteredParticipants = participants.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const idMatch = p.identifierCode?.toLowerCase().includes(q);
    const cohortMatch = p.cohort?.toLowerCase().includes(q);
    const siteMatch = p.siteLocation?.toLowerCase().includes(q);
    const studyTitle = studies.find((s) => s.id === p.studyId)?.title.toLowerCase() || '';
    const studyMatch = studyTitle.includes(q);
    return idMatch || cohortMatch || siteMatch || studyMatch;
  });

  const getStudyTitle = (studyId: string) => {
    const found = studies.find((s) => s.id === studyId);
    return found ? found.title : 'General Study Cohort';
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'success';
      case 'enrolled':
        return 'default';
      case 'completed':
        return 'outline';
      case 'withdrawn':
        return 'destructive';
      case 'screened':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  // Open Enroll Modal
  const handleOpenEnroll = () => {
    const randomCode = Math.floor(100 + Math.random() * 900);
    setEnrollIdentifierCode(`PART-2026-${randomCode}`);
    setEnrollStudyId(studies.length > 0 ? studies[0].id : '');
    setEnrollCohort('Cohort A - Primary Arm');
    setEnrollSiteLocation('Main Clinical Center');
    setEnrollContactEmail('');
    setEnrollErrorMessage(null);
    setIsEnrollOpen(true);
  };

  // Submit Enroll Form
  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollStudyId) {
      setEnrollErrorMessage('Please select a target research study.');
      return;
    }
    if (!enrollIdentifierCode.trim()) {
      setEnrollErrorMessage('Participant Identifier Code is required.');
      return;
    }
    setEnrollErrorMessage(null);

    try {
      await enrollMutation.mutateAsync({
        studyId: enrollStudyId,
        identifierCode: enrollIdentifierCode.trim(),
        cohort: enrollCohort.trim() || undefined,
        siteLocation: enrollSiteLocation.trim() || undefined,
        contactEmail: enrollContactEmail.trim() || undefined,
      });

      toast({
        title: 'Subject Enrolled Successfully',
        description: `Subject ${enrollIdentifierCode} has been enrolled in the research study.`,
        variant: 'success',
      });

      setIsEnrollOpen(false);
      refetchParticipants();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail ||
        (err as { message?: string })?.message ||
        'Failed to enroll participant.';
      setEnrollErrorMessage(msg);
    }
  };

  // Open Withdraw Modal
  const handleOpenWithdraw = (participant: Participant) => {
    setParticipantToWithdraw(participant);
    setWithdrawReasonPreset('Voluntary participant withdrawal');
    setWithdrawCustomReason('');
    setWithdrawErrorMessage(null);
    setIsWithdrawOpen(true);
  };

  // Submit Withdraw Form
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participantToWithdraw) return;

    const finalReason = withdrawCustomReason.trim()
      ? `${withdrawReasonPreset}: ${withdrawCustomReason.trim()}`
      : withdrawReasonPreset;

    if (!finalReason.trim() || finalReason.trim().length < 3) {
      setWithdrawErrorMessage('A governance withdrawal justification is required.');
      return;
    }
    setWithdrawErrorMessage(null);

    try {
      await withdrawMutation.mutateAsync({
        participantId: participantToWithdraw.id,
        reason: finalReason,
      });

      toast({
        title: 'Subject Withdrawn',
        description: `Subject ${participantToWithdraw.identifierCode} status has been updated to Withdrawn.`,
        variant: 'default',
      });

      setIsWithdrawOpen(false);
      setParticipantToWithdraw(null);
      refetchParticipants();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail ||
        (err as { message?: string })?.message ||
        'Failed to withdraw participant.';
      setWithdrawErrorMessage(msg);
    }
  };

  return (
    <PageContainer
      title="Study Participants"
      description="Patient cohort enrollment, demographic screening, informed consent records, and retention tracking."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Participants', isCurrent: true },
      ]}
      actions={
        <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleOpenEnroll}>
          <UserPlus className="h-4 w-4" />
          <span>Enroll Subject</span>
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Metrics Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-slate-200/80 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Screened</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {isMetricsLoading ? (
                      <Skeleton className="h-7 w-12" />
                    ) : (
                      metrics?.totalScreened ?? participants.length
                    )}
                  </span>
                  <span className="text-xs text-slate-400">candidates</span>
                </div>
              </div>
              <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/80 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Enrolled</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {isMetricsLoading ? (
                      <Skeleton className="h-7 w-12" />
                    ) : (
                      metrics?.totalEnrolled ?? participants.length
                    )}
                  </span>
                  <span className="text-xs text-slate-400">subjects</span>
                </div>
              </div>
              <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <UserCheck className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/80 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Subjects</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-emerald-600">
                    {isMetricsLoading ? (
                      <Skeleton className="h-7 w-12" />
                    ) : (
                      metrics?.activeParticipants ??
                      participants.filter((p) => p.status !== 'withdrawn').length
                    )}
                  </span>
                  <span className="text-xs text-slate-400">in follow-up</span>
                </div>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Activity className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/80 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Retention Rate</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {isMetricsLoading ? (
                      <Skeleton className="h-7 w-16" />
                    ) : (
                      `${metrics?.retentionRate ?? 100}%`
                    )}
                  </span>
                  <span className="text-xs text-emerald-600 font-medium">GCP compliant</span>
                </div>
              </div>
              <div className="h-10 w-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Subject Code, cohort, or clinical site..."
              className="pl-9 h-9 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <span>Filter:</span>
            </div>

            {/* Study Selector */}
            <select
              value={selectedStudyId}
              onChange={(e) => setSelectedStudyId(e.target.value)}
              className="h-9 px-2.5 text-xs rounded-md border border-slate-300 bg-white text-slate-700 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Research Studies</option>
              {studies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>

            {/* Status Selector */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-9 px-2.5 text-xs rounded-md border border-slate-300 bg-white text-slate-700 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="enrolled">Enrolled</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="withdrawn">Withdrawn</option>
            </select>

            {(searchQuery || selectedStudyId || selectedStatus) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedStudyId('');
                  setSelectedStatus('');
                }}
                className="h-9 text-xs text-slate-500 hover:text-slate-800"
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Participants Table View */}
        <Card className="border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Subject Identifier</th>
                  <th className="px-5 py-3.5">Study & Cohort</th>
                  <th className="px-5 py-3.5">Site Location</th>
                  <th className="px-5 py-3.5">Enrollment Date</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isParticipantsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-5 py-4">
                        <Skeleton className="h-5 w-28" />
                      </td>
                      <td className="px-5 py-4">
                        <Skeleton className="h-5 w-44" />
                      </td>
                      <td className="px-5 py-4">
                        <Skeleton className="h-5 w-32" />
                      </td>
                      <td className="px-5 py-4">
                        <Skeleton className="h-5 w-24" />
                      </td>
                      <td className="px-5 py-4">
                        <Skeleton className="h-5 w-16" />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Skeleton className="h-7 w-20 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : filteredParticipants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                      <div className="max-w-sm mx-auto flex flex-col items-center">
                        <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                          <Users className="h-6 w-6" />
                        </div>
                        <h4 className="text-base font-semibold text-slate-800">No Participants Found</h4>
                        <p className="text-xs text-slate-500 mt-1 mb-4">
                          {searchQuery || selectedStudyId || selectedStatus
                            ? 'No subjects match your current filter parameters.'
                            : 'No participant subjects have been enrolled into research studies yet.'}
                        </p>
                        <Button
                          size="sm"
                          onClick={handleOpenEnroll}
                          className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <UserPlus className="h-4 w-4" />
                          <span>Enroll First Subject</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredParticipants.map((p) => {
                    const isWithdrawn = p.status.toLowerCase() === 'withdrawn';
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4 font-mono font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                            <span>{p.identifierCode}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-0.5">
                            <p className="text-slate-900 font-medium text-xs truncate max-w-xs">
                              {getStudyTitle(p.studyId)}
                            </p>
                            <p className="text-slate-500 text-xs flex items-center gap-1">
                              <Layers className="h-3 w-3 text-slate-400" />
                              <span>{p.cohort || 'Default Cohort'}</span>
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>{p.siteLocation || 'Primary Site'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>{formatDate(p.enrollmentDate)}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant={getStatusBadgeVariant(p.status)} className="capitalize text-xs">
                            {p.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {isWithdrawn ? (
                            <span className="text-xs text-slate-400 italic">Withdrawn</span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenWithdraw(p)}
                              className="h-8 gap-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            >
                              <UserX className="h-3.5 w-3.5" />
                              <span>Withdraw</span>
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Modal: Enroll Subject */}
        {isEnrollOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Enroll New Subject</h3>
                    <p className="text-xs text-slate-500">Register participant into research protocol</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEnrollOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {enrollErrorMessage && (
                <div className="p-3 text-xs rounded-lg bg-red-50 text-red-700 border border-red-200 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{enrollErrorMessage}</span>
                </div>
              )}

              <form onSubmit={handleEnrollSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Research Study *</label>
                  <select
                    required
                    value={enrollStudyId}
                    onChange={(e) => setEnrollStudyId(e.target.value)}
                    className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={enrollMutation.isPending}
                  >
                    <option value="" disabled>
                      Select Study
                    </option>
                    {studies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Subject Identifier Code *</label>
                  <Input
                    required
                    value={enrollIdentifierCode}
                    onChange={(e) => setEnrollIdentifierCode(e.target.value)}
                    placeholder="e.g. PART-2026-101"
                    disabled={enrollMutation.isPending}
                    className="text-xs"
                  />
                  <p className="text-[11px] text-slate-400">Pseudonymised GCP identifier code</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Cohort / Study Arm</label>
                  <Input
                    value={enrollCohort}
                    onChange={(e) => setEnrollCohort(e.target.value)}
                    placeholder="e.g. Cohort A - Digital Biomarkers"
                    disabled={enrollMutation.isPending}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Clinical Site Location</label>
                  <Input
                    value={enrollSiteLocation}
                    onChange={(e) => setEnrollSiteLocation(e.target.value)}
                    placeholder="e.g. Central Clinical Hospital - Site 1"
                    disabled={enrollMutation.isPending}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Contact Email (Optional)</label>
                  <Input
                    type="email"
                    value={enrollContactEmail}
                    onChange={(e) => setEnrollContactEmail(e.target.value)}
                    placeholder="participant@research-cohort.org"
                    disabled={enrollMutation.isPending}
                    className="text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEnrollOpen(false)}
                    disabled={enrollMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={enrollMutation.isPending}
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {enrollMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>{enrollMutation.isPending ? 'Enrolling...' : 'Enroll Subject'}</span>
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Withdraw Subject */}
        {isWithdrawOpen && participantToWithdraw && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                    <UserX className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Withdraw Subject Consent</h3>
                    <p className="text-xs text-slate-500">Record audited participant withdrawal</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWithdrawOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                <p className="text-slate-700">
                  <span className="font-semibold">Subject Identifier:</span> {participantToWithdraw.identifierCode}
                </p>
                <p className="text-slate-500">
                  <span className="font-semibold">Study:</span> {getStudyTitle(participantToWithdraw.studyId)}
                </p>
              </div>

              {withdrawErrorMessage && (
                <div className="p-3 text-xs rounded-lg bg-red-50 text-red-700 border border-red-200 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{withdrawErrorMessage}</span>
                </div>
              )}

              <form onSubmit={handleWithdrawSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Governance Reason *</label>
                  <select
                    value={withdrawReasonPreset}
                    onChange={(e) => setWithdrawReasonPreset(e.target.value)}
                    className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    disabled={withdrawMutation.isPending}
                  >
                    <option value="Voluntary participant withdrawal">Voluntary participant withdrawal</option>
                    <option value="Adverse reaction or clinical event">Adverse reaction or clinical event</option>
                    <option value="Participant lost to follow-up">Participant lost to follow-up</option>
                    <option value="Protocol violation or exclusion criteria">
                      Protocol violation or exclusion criteria
                    </option>
                    <option value="Investigator decision">Investigator decision</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Additional Remarks / Justification</label>
                  <textarea
                    rows={3}
                    value={withdrawCustomReason}
                    onChange={(e) => setWithdrawCustomReason(e.target.value)}
                    placeholder="Provide additional clinical or protocol justification..."
                    disabled={withdrawMutation.isPending}
                    className="w-full p-2.5 text-xs rounded-md border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsWithdrawOpen(false)}
                    disabled={withdrawMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={withdrawMutation.isPending}
                    className="gap-2 bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    {withdrawMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>{withdrawMutation.isPending ? 'Processing...' : 'Confirm Withdrawal'}</span>
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
