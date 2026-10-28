import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { useQuestionnairesList } from '@/hooks/useQuestionnaires';
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
  FileText
} from 'lucide-react';
import { QuestionnaireStatus } from '@/types/questionnaire';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const {
    data: questionnaires,
    isLoading,
    isUnavailable,
    isError,
    errorDetail,
    refetch,
  } = useQuestionnairesList(statusFilter ? { status: statusFilter } : undefined);

  const filtered = questionnaires?.filter((q) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      q.title.toLowerCase().includes(term) ||
      q.studyTitle?.toLowerCase().includes(term) ||
      q.description?.toLowerCase().includes(term)
    );
  });

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
            onClick={() => navigate('/questionnaires/generate')}
            className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50/50 shadow-xs"
          >
            <Sparkles className="h-4 w-4 text-blue-600" />
            <span>AI Generate Questionnaire</span>
          </Button>

          <Button
            size="sm"
            onClick={() => navigate('/questionnaires/new')}
            className="gap-1.5 shadow-xs"
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
                          <Badge variant="outline" className="font-mono text-[10px]">
                            v{item.version}
                          </Badge>
                          <Badge variant={statusMeta.variant} className="text-[10px]">
                            {statusMeta.label}
                          </Badge>

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

                      {/* Primary Action Button */}
                      <div className="shrink-0">
                        <Link to={`/questionnaires/${item.id}/builder`}>
                          <Button size="sm" className="gap-1.5 w-full md:w-auto">
                            <span>{isPublished ? 'View Schema (Locked)' : 'Open Builder'}</span>
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
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
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
