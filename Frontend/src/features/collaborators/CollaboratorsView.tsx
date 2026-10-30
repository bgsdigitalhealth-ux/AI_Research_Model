import React, { useState } from 'react';
import { PageContainer } from '@/components/shared/PageContainer';
import {
  useCollaboratorsList,
  useCollaboratorMetrics,
  useInviteCollaborator,
  useRemoveCollaborator,
} from '@/hooks/useCollaborators';
import { useStudiesList } from '@/hooks/useStudies';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { Collaborator } from '@/types/collaborator';
import {
  Users,
  Award,
  Building2,
  FileText,
  Search,
  Filter,
  UserPlus,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  Mail,
  Shield,
  Layers,
} from 'lucide-react';

export function CollaboratorsView() {
  const { toast } = useToast();

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudyId, setSelectedStudyId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');

  // Modals State
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  const [collaboratorToRemove, setCollaboratorToRemove] = useState<Collaborator | null>(null);

  // Invite Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [roleName, setRoleName] = useState('researcher');
  const [studyId, setStudyId] = useState('');
  const [institution, setInstitution] = useState('Clinical AI Research Network');
  const [department, setDepartment] = useState('Clinical Trials Unit');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Queries & Mutations
  const { data: metrics, isLoading: isMetricsLoading } = useCollaboratorMetrics();
  const {
    data: collaboratorsData,
    isLoading: isCollaboratorsLoading,
    refetch: refetchCollaborators,
  } = useCollaboratorsList(
    selectedStudyId || selectedRole || searchQuery
      ? {
          studyId: selectedStudyId || undefined,
          role: selectedRole || undefined,
          search: searchQuery || undefined,
        }
      : undefined
  );

  const { data: studiesData } = useStudiesList();
  const studies = Array.isArray(studiesData) ? studiesData : studiesData?.items || [];

  const inviteMutation = useInviteCollaborator();
  const removeMutation = useRemoveCollaborator();

  const collaborators: Collaborator[] = Array.isArray(collaboratorsData) ? collaboratorsData : [];

  // Filtered by Search Query
  const filteredCollaborators = collaborators.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = c.fullName?.toLowerCase().includes(q);
    const emailMatch = c.email?.toLowerCase().includes(q);
    const roleMatch = c.roleName?.toLowerCase().includes(q);
    const instMatch = c.institution?.toLowerCase().includes(q);
    const studyMatch = c.studyTitle?.toLowerCase().includes(q);
    return nameMatch || emailMatch || roleMatch || instMatch || studyMatch;
  });

  const getRoleBadge = (role: string) => {
    const formatted = role.replace(/_/g, ' ');
    switch (role.toLowerCase()) {
      case 'administrator':
        return <Badge variant="destructive" className="capitalize text-xs">{formatted}</Badge>;
      case 'principal_investigator':
        return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none capitalize text-xs">{formatted}</Badge>;
      case 'researcher':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none capitalize text-xs">{formatted}</Badge>;
      case 'statistician':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none capitalize text-xs">{formatted}</Badge>;
      case 'collector':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none capitalize text-xs">{formatted}</Badge>;
      default:
        return <Badge variant="secondary" className="capitalize text-xs">{formatted}</Badge>;
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  // Open Invite Modal
  const handleOpenInvite = () => {
    setFullName('');
    setEmail('');
    setRoleName('researcher');
    setStudyId(studies.length > 0 ? studies[0].id : '');
    setInstitution('Clinical AI Research Network');
    setDepartment('Clinical Trials Unit');
    setErrorMessage(null);
    setIsInviteOpen(true);
  };

  // Submit Invite Form
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setErrorMessage('Full Name and Email Address are required.');
      return;
    }
    setErrorMessage(null);

    try {
      await inviteMutation.mutateAsync({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        roleName: roleName.trim(),
        studyId: studyId || undefined,
        institution: institution.trim() || undefined,
        department: department.trim() || undefined,
      });

      toast({
        title: 'Collaborator Invited',
        description: `${fullName} has been added to the research team.`,
        variant: 'success',
      });

      setIsInviteOpen(false);
      refetchCollaborators();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail ||
        (err as { message?: string })?.message ||
        'Failed to invite collaborator.';
      setErrorMessage(msg);
    }
  };

  // Open Remove Modal
  const handleOpenRemove = (collaborator: Collaborator) => {
    setCollaboratorToRemove(collaborator);
    setErrorMessage(null);
    setIsRemoveOpen(true);
  };

  // Submit Remove Form
  const handleRemoveSubmit = async () => {
    if (!collaboratorToRemove) return;
    try {
      await removeMutation.mutateAsync(collaboratorToRemove.id);

      toast({
        title: 'Collaborator Removed',
        description: `${collaboratorToRemove.fullName} has been removed from this study assignment.`,
        variant: 'default',
      });

      setIsRemoveOpen(false);
      setCollaboratorToRemove(null);
      refetchCollaborators();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail ||
        (err as { message?: string })?.message ||
        'Failed to remove collaborator.';
      setErrorMessage(msg);
    }
  };

  return (
    <PageContainer
      title="Research Collaborators"
      description="Manage cross-institutional investigators, biostatisticians, data safety monitoring boards (DSMB), and trial monitors."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Collaborators', isCurrent: true },
      ]}
      actions={
        <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleOpenInvite}>
          <UserPlus className="h-4 w-4" />
          <span>Invite Collaborator</span>
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-slate-200/80 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Collaborators</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {isMetricsLoading ? (
                      <Skeleton className="h-7 w-12" />
                    ) : (
                      metrics?.totalCollaborators ?? collaborators.length
                    )}
                  </span>
                  <span className="text-xs text-slate-400">members</span>
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
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Investigators</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {isMetricsLoading ? (
                      <Skeleton className="h-7 w-12" />
                    ) : (
                      metrics?.activeInvestigators ?? collaborators.length
                    )}
                  </span>
                  <span className="text-xs text-slate-400">PIs & Co-Is</span>
                </div>
              </div>
              <div className="h-10 w-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Award className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/80 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Institutions</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {isMetricsLoading ? (
                      <Skeleton className="h-7 w-12" />
                    ) : (
                      metrics?.participatingInstitutions ?? 1
                    )}
                  </span>
                  <span className="text-xs text-slate-400">sites</span>
                </div>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Building2 className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/80 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Studies</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {isMetricsLoading ? (
                      <Skeleton className="h-7 w-12" />
                    ) : (
                      metrics?.activeStudies ?? studies.length
                    )}
                  </span>
                  <span className="text-xs text-slate-400">protocols</span>
                </div>
              </div>
              <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <FileText className="h-5 w-5" />
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
              placeholder="Search by investigator name, email, or institution..."
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
              <option value="">All Studies</option>
              {studies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>

            {/* Role Selector */}
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="h-9 px-2.5 text-xs rounded-md border border-slate-300 bg-white text-slate-700 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Roles</option>
              <option value="principal_investigator">Principal Investigator</option>
              <option value="researcher">Researcher</option>
              <option value="statistician">Statistician</option>
              <option value="collector">Data Collector</option>
              <option value="administrator">Administrator</option>
            </select>

            {(searchQuery || selectedStudyId || selectedRole) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedStudyId('');
                  setSelectedRole('');
                }}
                className="h-9 text-xs text-slate-500 hover:text-slate-800"
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Collaborators Table View */}
        <Card className="border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Collaborator</th>
                  <th className="px-5 py-3.5">Assigned Role</th>
                  <th className="px-5 py-3.5">Study Assignment</th>
                  <th className="px-5 py-3.5">Institution & Department</th>
                  <th className="px-5 py-3.5">Added Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isCollaboratorsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-5 py-4">
                        <Skeleton className="h-6 w-36" />
                      </td>
                      <td className="px-5 py-4">
                        <Skeleton className="h-5 w-24" />
                      </td>
                      <td className="px-5 py-4">
                        <Skeleton className="h-5 w-40" />
                      </td>
                      <td className="px-5 py-4">
                        <Skeleton className="h-5 w-32" />
                      </td>
                      <td className="px-5 py-4">
                        <Skeleton className="h-5 w-20" />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Skeleton className="h-7 w-16 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : filteredCollaborators.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                      <div className="max-w-sm mx-auto flex flex-col items-center">
                        <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                          <Users className="h-6 w-6" />
                        </div>
                        <h4 className="text-base font-semibold text-slate-800">No Collaborators Found</h4>
                        <p className="text-xs text-slate-500 mt-1 mb-4">
                          {searchQuery || selectedStudyId || selectedRole
                            ? 'No research team members match your current filter criteria.'
                            : 'No collaborators or co-investigators have been invited yet.'}
                        </p>
                        <Button
                          size="sm"
                          onClick={handleOpenInvite}
                          className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <UserPlus className="h-4 w-4" />
                          <span>Invite First Collaborator</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCollaborators.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs flex items-center justify-center shrink-0">
                            {getInitials(c.fullName)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 text-sm">{c.fullName}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <Mail className="h-3 w-3 text-slate-400" />
                              <span>{c.email}</span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {getRoleBadge(c.roleName)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-0.5">
                          <p className="text-slate-900 font-medium text-xs truncate max-w-xs">
                            {c.studyTitle || 'Cross-Study Network'}
                          </p>
                          <p className="text-slate-400 text-[11px] flex items-center gap-1">
                            <Layers className="h-3 w-3" />
                            <span>Active Protocol</span>
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-600">
                        <div className="space-y-0.5">
                          <p className="font-medium text-slate-800 flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>{c.institution || 'Clinical AI Research Network'}</span>
                          </p>
                          <p className="text-slate-500 text-[11px] pl-5">{c.department || 'Clinical Trials Unit'}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-600">
                        {c.createdAt ? formatDate(c.createdAt) : 'Recently'}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenRemove(c)}
                          className="h-8 gap-1.5 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remove</span>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Modal: Invite Collaborator */}
        {isInviteOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Invite Collaborator</h3>
                    <p className="text-xs text-slate-500">Grant investigator access to study resources</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {errorMessage && (
                <div className="p-3 text-xs rounded-lg bg-red-50 text-red-700 border border-red-200 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleInviteSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Full Name *</label>
                  <Input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Sarah Jenkins, MD"
                    disabled={inviteMutation.isPending}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Email Address *</label>
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="s.jenkins@hospital-research.org"
                    disabled={inviteMutation.isPending}
                    className="text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Role Designation *</label>
                    <select
                      value={roleName}
                      onChange={(e) => setRoleName(e.target.value)}
                      className="w-full h-9 px-2 text-xs rounded-md border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={inviteMutation.isPending}
                    >
                      <option value="researcher">Researcher</option>
                      <option value="principal_investigator">Principal Investigator</option>
                      <option value="statistician">Statistician</option>
                      <option value="collector">Data Collector</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Study Assignment</label>
                    <select
                      value={studyId}
                      onChange={(e) => setStudyId(e.target.value)}
                      className="w-full h-9 px-2 text-xs rounded-md border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={inviteMutation.isPending}
                    >
                      <option value="">All Studies</option>
                      {studies.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Institution</label>
                  <Input
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="Clinical AI Research Network"
                    disabled={inviteMutation.isPending}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Department</label>
                  <Input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Clinical Trials Unit"
                    disabled={inviteMutation.isPending}
                    className="text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsInviteOpen(false)}
                    disabled={inviteMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={inviteMutation.isPending}
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {inviteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>{inviteMutation.isPending ? 'Inviting...' : 'Send Invitation'}</span>
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Remove Collaborator */}
        {isRemoveOpen && collaboratorToRemove && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                    <Trash2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Remove Collaborator</h3>
                    <p className="text-xs text-slate-500">Revoke team member permissions</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRemoveOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                <p className="text-slate-700">
                  <span className="font-semibold">Collaborator:</span> {collaboratorToRemove.fullName}
                </p>
                <p className="text-slate-500">
                  <span className="font-semibold">Email:</span> {collaboratorToRemove.email}
                </p>
                <p className="text-slate-500">
                  <span className="font-semibold">Study:</span> {collaboratorToRemove.studyTitle || 'Cross-Study Network'}
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 text-xs rounded-lg bg-red-50 text-red-700 border border-red-200 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <p className="text-xs text-slate-600">
                Are you sure you want to remove this collaborator? They will lose access to data collection, protocols,
                and reporting for this study.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRemoveOpen(false)}
                  disabled={removeMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleRemoveSubmit}
                  disabled={removeMutation.isPending}
                  className="gap-2 bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {removeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{removeMutation.isPending ? 'Removing...' : 'Confirm Removal'}</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
