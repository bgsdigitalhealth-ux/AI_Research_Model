import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { usePublishedSurveys } from '@/hooks/useDataCollection';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { offlineDb } from '@/lib/indexedDb';
import { StatusState } from '@/components/shared/StatusState';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import {
  FileCheck,
  HardDrive,
  ArrowRight,
  ArrowLeft,
  Check,
  Search,
  Wifi,
  WifiOff,
  Layers,
  Trash2
} from 'lucide-react';
import { CachedOfflineQuestionnaire } from '@/types/dataCollection';
import { Questionnaire } from '@/types/questionnaire';

export function PublishedSurveysView() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isOnline, cacheSurveyOffline, removeCachedSurvey } = useOfflineSync();
  const { data: surveys, isLoading, isUnavailable, isError, errorDetail, refetch } = usePublishedSurveys();

  const [cachedIds, setCachedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const loadCachedStatus = async () => {
    try {
      const items = await offlineDb.getCachedQuestionnaires();
      setCachedIds(items.map((i) => i.id));
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    loadCachedStatus();
  }, []);

  const handleToggleCache = async (survey: Questionnaire) => {
    const isCurrentlyCached = cachedIds.includes(survey.id);
    if (isCurrentlyCached) {
      await removeCachedSurvey(survey.id);
      setCachedIds((prev) => prev.filter((id) => id !== survey.id));
      toast({
        title: 'Offline Cache Removed',
        description: `Survey "${survey.title}" removed from offline storage.`,
      });
    } else {
      await cacheSurveyOffline(survey);
      setCachedIds((prev) => [...prev, survey.id]);
      toast({
        title: 'Survey Cached for Offline Use',
        description: `Definition and validation schema for "${survey.title}" stored locally.`,
        variant: 'success',
      });
    }
  };

  const filtered = surveys?.filter((s) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return s.title.toLowerCase().includes(term) || s.studyTitle?.toLowerCase().includes(term);
  });

  return (
    <PageContainer
      title="Published Survey Access"
      description="Authorized questionnaires configured and locked for participant intake. Cache surveys for offline field data collection."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Data Collection', path: '/data-collection' },
        { label: 'Published Surveys', isCurrent: true },
      ]}
      actions={
        <Link to="/data-collection">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            <span>Data Collection Hub</span>
          </Button>
        </Link>
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
              placeholder="Search published surveys..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Offline Caching Status:</span>
            <Badge variant="outline" className="font-mono text-[11px]">
              {cachedIds.length} Available Offline
            </Badge>
          </div>
        </div>

        {/* Dynamic List */}
        {isUnavailable && cachedIds.length === 0 ? (
          <StatusState
            type="unavailable"
            title="Published Surveys Service Unavailable"
            description="The server endpoint (/data-collection/published-surveys) is disconnected, and no surveys have been cached offline."
            endpoint="/data-collection/published-surveys"
            action={{
              label: 'Retry Fetching Surveys',
              onClick: () => refetch(),
            }}
          />
        ) : isError && cachedIds.length === 0 ? (
          <StatusState
            type="error"
            title="Error Loading Published Surveys"
            description={errorDetail?.message || 'Could not retrieve published surveys.'}
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
            title="No Published Surveys"
            description={
              searchTerm
                ? 'No surveys match your search term.'
                : 'No published questionnaires found for clinical intake. Approve and publish a questionnaire from the builder first.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filtered.map((survey) => {
              const isCached = cachedIds.includes(survey.id);

              return (
                <Card key={survey.id} className="hover:border-slate-300 transition-all shadow-xs">
                  <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-bold text-slate-900">{survey.title}</h4>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          v{survey.version}
                        </Badge>
                        <Badge variant="success" className="text-[10px]">
                          Published (Locked)
                        </Badge>
                        {isCached && (
                          <Badge variant="secondary" className="text-[10px] gap-1 bg-blue-50 text-blue-700 border-blue-200">
                            <HardDrive className="h-3 w-3" />
                            <span>Saved Offline</span>
                          </Badge>
                        )}
                      </div>

                      {survey.description && (
                        <p className="text-xs text-slate-600 max-w-2xl line-clamp-2">
                          {survey.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-slate-500 pt-0.5 flex-wrap">
                        <span>
                          <strong>{survey.questions?.length || 0}</strong> Questions
                        </span>
                        {survey.studyTitle && <span>Study: <strong>{survey.studyTitle}</strong></span>}
                        <span>Published: {formatDate(survey.publishedAt || survey.updatedAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 justify-between md:justify-end">
                      {/* Offline Cache Toggle */}
                      <Button
                        type="button"
                        variant={isCached ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => handleToggleCache(survey)}
                        className="text-xs gap-1.5"
                      >
                        {isCached ? (
                          <>
                            <Trash2 className="h-3.5 w-3.5 text-slate-400" />
                            <span>Remove Cache</span>
                          </>
                        ) : (
                          <>
                            <HardDrive className="h-3.5 w-3.5 text-blue-600" />
                            <span>Cache Offline</span>
                          </>
                        )}
                      </Button>

                      {/* Start Intake Session */}
                      <Link to={`/surveys/${survey.id}/consent`}>
                        <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                          <span>Start Intake</span>
                          <ArrowRight className="h-4 w-4" />
                        </Button>
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

