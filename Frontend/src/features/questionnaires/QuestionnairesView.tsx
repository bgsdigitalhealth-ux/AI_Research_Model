import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { useQuestionnairesList, useDeleteQuestionnaire } from '@/hooks/useQuestionnaires';
import { questionnairesApi } from '@/api/questionnairesApi';
import { useToast } from '@/components/ui/use-toast';
import { StatusState } from '@/components/shared/StatusState';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import {
  ClipboardList,
  Plus,
  Sparkles,
  Search,
  Eye,
  Sliders,
  ShieldCheck,
  History,
  Lock,
  ArrowRight,
  CheckCircle2,
  FileText,
  Folder,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Questionnaire, QuestionnaireStatus } from '@/types/questionnaire';

const STATUS_BADGES: Record<
  QuestionnaireStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' }
> = {
  draft: { label: 'Draft', variant: 'secondary' },
  under_review: { label: 'Under Review', variant: 'warning' },
  approved: { label: 'Approved', variant: 'info' },
  published: { label: 'Published (Locked)', variant: 'success' },
  archived: { label: 'Archived', variant: 'secondary' },
};

export function QuestionnairesView() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [questionnaireToDelete, setQuestionnaireToDelete] = useState<Questionnaire | null>(null);

  const deleteMutation = useDeleteQuestionnaire();

  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const {
    data: questionnaires,
    isLoading,
    isUnavailable,
    isError,
    errorDetail,
    refetch,
  } = useQuestionnairesList(statusFilter ? { status: statusFilter } : undefined);

  const filtered = questionnaires?.filter((q) => {
    if (statusFilter && q.status !== statusFilter) return false;
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      q.title.toLowerCase().includes(term) ||
      q.studyTitle?.toLowerCase().includes(term) ||
      q.description?.toLowerCase().includes(term)
    );
  });

  const handleStatusChange = async (id: string, newStatus: QuestionnaireStatus) => {
    try {
      setUpdatingStatusId(id);
      await questionnairesApi.updateQuestionnaire(id, { status: newStatus });
      toast({
        title: 'Status Updated',
        description: `Questionnaire status changed to "${(STATUS_BADGES[newStatus]?.label || newStatus).toUpperCase()}".`,
        variant: 'success',
      });
      refetch();
    } catch (err: any) {
      toast({
        title: 'Status Update Failed',
        description: err?.message || 'Failed to update questionnaire status.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!questionnaireToDelete) return;
    try {
      await deleteMutation.mutateAsync(questionnaireToDelete.id);
      toast({
        title: 'Questionnaire Deleted',
        description: `"${questionnaireToDelete.title}" has been permanently deleted.`,
        variant: 'success',
      });
      setQuestionnaireToDelete(null);
      refetch();
    } catch (err: any) {
      toast({
        title: 'Delete Failed',
        description: err?.message || 'Failed to delete questionnaire.',
        variant: 'destructive',
      });
    }
  };

  return (
    <PageContainer
      title="Questionnaires & Survey Instruments"
      description="Design patient-reported outcomes (PRO), validated psychological scales, clinical assessment forms, and electronic CRFs."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Questionnaires', isCurrent: true },
      ]}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/data-collection')}
            className="gap-1.5 border-amber-200 text-amber-800 hover:bg-amber-50/60 shadow-xs"
          >
            <Folder className="h-4 w-4 text-amber-600" />
            <span>User Folders</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/questionnaires/generate')}
            className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50/50 shadow-xs"
          >
            <Sparkles className="h-4 w-4 text-blue-600" />
            <span>AI Generate Questionnaire</span>
          </Button>

          <Button
            size="sm"
            onClick={() => navigate('/questionnaires/new')}
            className="gap-1.5 shadow-xs bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4" />
            <span>New Questionnaire</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by instrument title, study, or variable..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Lifecycle Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Dynamic Data States */}
        {isUnavailable ? (
          <StatusState
            type="unavailable"
            title="Questionnaires Service Unavailable"
            description="The backend questionnaires service (`/questionnaires`) is currently not responding."
            endpoint="/questionnaires"
            action={{
              label: 'Retry Fetching Questionnaires',
              onClick: () => refetch(),
            }}
          />
        ) : isError ? (
          <StatusState
            type="error"
            title="Failed to Load Questionnaires"
            description={errorDetail?.message || 'Error occurred while loading questionnaire instruments.'}
            action={{
              label: 'Retry',
              onClick: () => refetch(),
            }}
          />
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-5">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-64" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </Card>
            ))}
          </div>
        ) : !filtered || filtered.length === 0 ? (
          <StatusState
            type="empty"
            title="No Questionnaires Found"
            description={
              searchTerm
                ? 'No questionnaires match your search query.'
                : 'No questionnaire instruments exist in the database. Use the builder or AI generation workspace to create one.'
            }
            action={
              !searchTerm
                ? {
                    label: 'Create First Questionnaire',
                    onClick: () => navigate('/questionnaires/new'),
                  }
                : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filtered.map((item) => {
              const statusMeta = STATUS_BADGES[item.status] || STATUS_BADGES.draft;
              const isPublished = item.status === 'published';

              return (
                <Card key={item.id} className="hover:border-slate-300 transition-all shadow-xs">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to={`/questionnaires/${item.id}/builder`}
                            className="text-base font-bold text-slate-900 hover:text-blue-600 transition-colors"
                          >
                            {item.title}
                          </Link>
                          <code className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-mono font-bold">
                            {`TMPL-${item.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`}
                          </code>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            v{item.version}
                          </Badge>
                          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 shadow-2xs">
                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Status:</span>
                            <select
                              value={item.status}
                              disabled={updatingStatusId === item.id}
                              onChange={(e) => handleStatusChange(item.id, e.target.value as QuestionnaireStatus)}
                              className="text-[11px] font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer py-0.5"
                              title="Update questionnaire lifecycle status"
                            >
                              <option value="draft">Draft</option>
                              <option value="under_review">Under Review</option>
                              <option value="approved">Approved</option>
                              <option value="published">Published</option>
                              <option value="archived">Archived</option>
                            </select>
                          </div>

                          {item.isAiGenerated && (
                            <Badge variant="secondary" className="text-[10px] gap-1 text-blue-700 bg-blue-50 border-blue-200">
                              <Sparkles className="h-3 w-3" />
                              <span>AI Candidate Draft</span>
                            </Badge>
                          )}
                        </div>

                        {item.description && (
                          <p className="text-xs text-slate-600 max-w-2xl line-clamp-2">
                            {item.description}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 flex-wrap">
                          <span>
                            <strong>{item.questions?.length || 0}</strong> Questions
                          </span>
                          <span>
                            <strong>{item.sections?.length || 0}</strong> Sections
                          </span>
                          {item.studyTitle && (
                            <span>Study: <strong>{item.studyTitle}</strong></span>
                          )}
                          <span>Updated: {formatDate(item.updatedAt)}</span>
                        </div>
                      </div>

                      {/* Primary Action Buttons: Open Builder & Delete */}
                      <div className="shrink-0 flex items-center gap-2">
                        <Link to={`/questionnaires/${item.id}/builder`}>
                          <Button size="sm" className="gap-1.5 w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white">
                            <span>{isPublished ? 'View Schema (Locked)' : 'Open Builder'}</span>
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setQuestionnaireToDelete(item)}
                          disabled={deleteMutation.isPending}
                          className="gap-1.5 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300"
                          title="Delete this questionnaire"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Delete</span>
                        </Button>
                      </div>
                    </div>

                    {/* Secondary Navigation Strip */}
                    <div className="flex items-center gap-3 pt-3 border-t border-slate-100 text-xs flex-wrap">
                      <Link
                        to={`/questionnaires/${item.id}/preview`}
                        className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-600 font-medium"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Participant Preview</span>
                      </Link>

                      <span className="text-slate-300">•</span>

                      <Link
                        to={`/questionnaires/${item.id}/review`}
                        className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-600 font-medium"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Review & Sign-Off</span>
                      </Link>

                      <span className="text-slate-300">•</span>

                      <Link
                        to={`/questionnaires/${item.id}/versions`}
                        className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-600 font-medium"
                      >
                        <History className="h-3.5 w-3.5" />
                        <span>Version History & Publish</span>
                      </Link>

                      <span className="text-slate-300">•</span>

                      <button
                        type="button"
                        onClick={() => setQuestionnaireToDelete(item)}
                        className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 font-medium"
                        title="Delete useless questionnaire"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {questionnaireToDelete && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Delete Questionnaire?</h3>
                  <p className="text-xs text-slate-500">This action permanently deletes this questionnaire.</p>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <p className="font-semibold text-xs text-slate-900">{questionnaireToDelete.title}</p>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span>Version: v{questionnaireToDelete.version}</span>
                  <span>•</span>
                  <span>{questionnaireToDelete.questions?.length || 0} Questions</span>
                  <span>•</span>
                  <span className="font-mono text-blue-700">
                    TMPL-{questionnaireToDelete.id.replace(/-/g, '').slice(0, 8).toUpperCase()}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to delete this questionnaire? All associated questions and revisions will be permanently removed.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQuestionnaireToDelete(null)}
                  disabled={deleteMutation.isPending}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirmDelete}
                  disabled={deleteMutation.isPending}
                  className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
                >
                  {deleteMutation.isPending ? (
                    <>
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete Questionnaire</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
