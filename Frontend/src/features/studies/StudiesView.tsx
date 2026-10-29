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
  Loader2, 
  AlertCircle,
  FileText
} from 'lucide-react';

export function StudiesView() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form State for creating a new study
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
      description="Manage active clinical protocols, observational trials, and multi-center study initiatives."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'My Studies', isCurrent: true },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleOpenCreateModal}
          >
            <Plus className="h-4 w-4" />
            <span>New Study</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-700">Filter by Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="protocol_review">Protocol Review</option>
              <option value="active">Active</option>
              <option value="data_collection">Data Collection</option>
              <option value="analysis">Analysis</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          
          <div className="text-xs text-slate-500">
            {studies ? `Showing ${studies.length} studies` : ''}
          </div>
        </div>

        {/* Dynamic Studies Data List */}
        {isUnavailable ? (
          <StatusState
            type="unavailable"
            title="Studies Service Unavailable"
            description="The studies service endpoint (`/studies`) is currently unreachable."
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
            {[1, 2, 3, 4].map((i) => (
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
            description="No research studies have been recorded in the database yet."
            action={{
              label: 'Create First Study',
              onClick: handleOpenCreateModal,
            }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {studies.map((study) => (
              <Card key={study.id} className="hover:border-slate-300 transition-all">
                <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/studies/${study.id}`}
                        className="text-base font-bold text-slate-900 hover:text-blue-600 transition-colors"
                      >
                        {study.title}
                      </Link>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {study.protocolNumber}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                      {study.principalInvestigator && (
                        <span>PI: <strong>{study.principalInvestigator}</strong></span>
                      )}
                      {study.phase && <span>Phase: {study.phase}</span>}
                      <span>Updated: {formatDate(study.updatedAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                    <Badge variant="default" className="capitalize">
                      {study.status.replace('_', ' ')}
                    </Badge>
                    <Link
                      to={`/studies/${study.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      <span>Study Details</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal Dialog: Create New Research Study */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Create New Research Study</h3>
                    <p className="text-xs text-slate-500">
                      Registers study protocol dynamically with the backend database
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
                <div className="p-3 text-xs rounded-lg bg-red-50 text-red-700 border border-red-200 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Study Title *</label>
                  <Input
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Longitudinal Cognitive Biomarkers in Mild Neurocognitive Disorder"
                    disabled={createStudyMutation.isPending}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Protocol / IRB Number *</label>
                    <Input
                      required
                      value={protocolNumber}
                      onChange={(e) => setProtocolNumber(e.target.value)}
                      placeholder="e.g. PROTO-2026-001"
                      disabled={createStudyMutation.isPending}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Study Phase</label>
                    <Input
                      value={phase}
                      onChange={(e) => setPhase(e.target.value)}
                      placeholder="e.g. Phase II, Observational"
                      disabled={createStudyMutation.isPending}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Principal Investigator</label>
                    <Input
                      value={principalInvestigator}
                      onChange={(e) => setPrincipalInvestigator(e.target.value)}
                      placeholder="e.g. Dr. Jane Smith"
                      disabled={createStudyMutation.isPending}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Target Cohort Size</label>
                    <Input
                      type="number"
                      min={0}
                      value={targetParticipants}
                      onChange={(e) => setTargetParticipants(e.target.value)}
                      placeholder="e.g. 150"
                      disabled={createStudyMutation.isPending}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                    disabled={createStudyMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createStudyMutation.isPending}
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {createStudyMutation.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    <span>{createStudyMutation.isPending ? 'Creating Study...' : 'Register Study'}</span>
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
