import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dataCollectionApi } from '@/api/dataCollectionApi';
import { Link, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { usePublishedSurveys } from '@/hooks/useDataCollection';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { offlineDb } from '@/lib/indexedDb';
import { StatusState } from '@/components/shared/StatusState';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import {
  Database,
  Wifi,
  WifiOff,
  RefreshCw,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  HardDrive,
  BarChart2,
  Shield,
  Layers,
  Trash2,
  Lock,
  Folder,
  FolderOpen,
  FolderCheck,
  FileSpreadsheet,
  FileText,
  User,
  Mail,
  Building,
  BookOpen,
  ChevronRight,
  ChevronDown,
  Search,
  Eye,
  Download,
  X,
  Award,
} from 'lucide-react';
import { CachedOfflineQuestionnaire } from '@/types/dataCollection';

interface StoredSubmission {
  id: string;
  confirmationId: string;
  templateId: string;
  questionnaireId: string;
  userName: string;
  userEmail: string;
  department: string;
  researchTopic: string;
  syncSource: string;
  status: string;
  submittedAt: string;
  totalQuestions: number;
  earnedScore?: number;
  maxScore?: number;
  percentage?: number;
  benchmarkLevel?: string;
  answers: any[];
}

interface UserFolder {
  folderName: string;
  userEmail: string;
  department: string;
  researchTopic: string;
  submissions: StoredSubmission[];
  latestSubmittedAt: string;
}

export function DataCollectionView() {
  const navigate = useNavigate();
  const { isOnline, pendingCount, failedCount, synchronizedCount, conflictCount, isSyncing, triggerSync } =
    useOfflineSync();

  const { data: publishedSurveys, isLoading, isUnavailable, isError, errorDetail, refetch } =
    usePublishedSurveys();

  const [cachedSurveys, setCachedSurveys] = useState<CachedOfflineQuestionnaire[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [viewingSubmission, setViewingSubmission] = useState<StoredSubmission | null>(null);
  const [viewTab, setViewTab] = useState<'folders' | 'table'>('folders');

  const loadCached = async () => {
    try {
      const items = await offlineDb.getCachedQuestionnaires();
      setCachedSurveys(items);
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    loadCached();
  }, []);

  const { data: responsesList, isLoading: loadingResponses, refetch: refetchResponses } = useQuery({
    queryKey: ['data-collection', 'responses'],
    queryFn: () => dataCollectionApi.getResponses({ limit: 100 }),
    refetchInterval: 10000,
  });

  // Organize raw submissions into User Folders (Folder name = User Name)
  const userFolders: UserFolder[] = useMemo(() => {
    if (!responsesList || !Array.isArray(responsesList)) return [];

    const folderMap: Record<string, UserFolder> = {};

    responsesList.forEach((resp: any) => {
      const answersArr = resp.answers || [];

      // Extract __user_details__ if stored in answers
      const userMetaAns = answersArr.find(
        (a: any) =>
          a.question_id === '__user_details__' ||
          a.questionId === '__user_details__' ||
          a.variable_name === '__user_details__' ||
          a.variableName === '__user_details__'
      );

      const userMeta = userMetaAns?.raw_value || userMetaAns?.rawValue || {};
      const userName = (
        userMeta.userName ||
        userMeta.name ||
        resp.participant_identifier ||
        resp.participantIdentifier ||
        'Anonymous User'
      ).trim();

      const userEmail = userMeta.email || userMeta.userEmail || '';
      const department = userMeta.department || 'Clinical Research';
      const researchTopic = userMeta.researchTopic || 'Research Instrument';
      const templateId =
        userMeta.templateId ||
        (resp.questionnaire_id
          ? `TMPL-${String(resp.questionnaire_id).replace(/-/g, '').slice(0, 8).toUpperCase()}`
          : 'TMPL-001');

      const confirmationId = resp.confirmation_id || resp.confirmationId || resp.id?.slice(0, 8);
      const submittedAt = resp.server_received_at || resp.client_submitted_at || new Date().toISOString();

      // Filter out meta answers for regular questions display
      const regularAnswers = answersArr.filter(
        (a: any) =>
          a.question_id !== '__user_details__' &&
          a.questionId !== '__user_details__' &&
          a.variable_name !== '__user_details__' &&
          a.variableName !== '__user_details__'
      );

      const submission: StoredSubmission = {
        id: resp.id,
        confirmationId,
        templateId,
        questionnaireId: resp.questionnaire_id || resp.questionnaireId || '',
        userName,
        userEmail,
        department,
        researchTopic,
        syncSource: resp.sync_source || resp.syncSource || 'online',
        status: resp.status || 'completed',
        submittedAt,
        totalQuestions: regularAnswers.length,
        earnedScore: userMeta.earnedScore,
        maxScore: userMeta.maxPossible || userMeta.maxScore,
        percentage: userMeta.percentage,
        benchmarkLevel: userMeta.benchmarkLevel,
        answers: regularAnswers,
      };

      if (!folderMap[userName]) {
        folderMap[userName] = {
          folderName: userName,
          userEmail,
          department,
          researchTopic,
          submissions: [],
          latestSubmittedAt: submittedAt,
        };
      }

      folderMap[userName].submissions.push(submission);
      if (new Date(submittedAt) > new Date(folderMap[userName].latestSubmittedAt)) {
        folderMap[userName].latestSubmittedAt = submittedAt;
      }
    });

    return Object.values(folderMap).sort(
      (a, b) => new Date(b.latestSubmittedAt).getTime() - new Date(a.latestSubmittedAt).getTime()
    );
  }, [responsesList]);

  // Filter folders by search query
  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return userFolders;
    const q = searchQuery.toLowerCase();
    return userFolders.filter(
      (f) =>
        f.folderName.toLowerCase().includes(q) ||
        f.department.toLowerCase().includes(q) ||
        f.researchTopic.toLowerCase().includes(q) ||
        f.userEmail.toLowerCase().includes(q)
    );
  }, [userFolders, searchQuery]);

  const activeFolder = useMemo(() => {
    if (!selectedFolder) return null;
    return userFolders.find((f) => f.folderName === selectedFolder) || null;
  }, [userFolders, selectedFolder]);

  // Export specific stored question set to Excel
  const handleExportSubmissionExcel = async (sub: StoredSubmission) => {
    try {
      const XLSX = await import('xlsx');
      const rows: any[][] = [];

      rows.push([`${sub.researchTopic.toUpperCase()} - STORED QUESTION SET`, '', '', '', '']);
      rows.push([`Template Unique ID: ${sub.templateId}`, '', '', '', '']);
      rows.push([`User Name: ${sub.userName} | Email: ${sub.userEmail || 'N/A'}`, '', '', '', '']);
      rows.push([`Department: ${sub.department} | Confirmation ID: ${sub.confirmationId}`, '', '', '', '']);
      rows.push([`Submitted: ${formatDate(sub.submittedAt)}`, '', '', '', '']);

      if (sub.earnedScore !== undefined && sub.maxScore !== undefined) {
        rows.push([
          `Total Score: ${sub.earnedScore} / ${sub.maxScore} (${sub.percentage?.toFixed(1)}%) | Level: ${sub.benchmarkLevel || 'N/A'}`,
          '',
          '',
          '',
          '',
        ]);
      }

      rows.push(['']);
      rows.push(['No.', 'Question / Variable', 'Response Choice', 'Score', 'Remarks']);

      const matchedQ = (publishedSurveys || []).find(
        (s) => s.id === sub.questionnaireId || s.title.toLowerCase() === sub.researchTopic.toLowerCase()
      );

      sub.answers.forEach((ans, idx) => {
        let chosenLabel = '';
        let scoreVal: any = '';
        let remark = '';

        const raw = ans.raw_value !== undefined ? ans.raw_value : ans.rawValue;
        if (typeof raw === 'object' && raw !== null) {
          chosenLabel = raw.choice || raw.code || JSON.stringify(raw);
          remark = raw.remark || '';
        } else if (raw !== undefined && raw !== null) {
          chosenLabel = String(raw);
        }

        const qDef = matchedQ?.questions?.find(
          (q) => q.id === (ans.question_id || ans.questionId) || q.variableName === (ans.variable_name || ans.variableName)
        );

        const questionText = qDef?.text || ans.variable_name || ans.variableName || `Question ${idx + 1}`;
        if (qDef?.choices) {
          const matchedChoice = qDef.choices.find(
            (c) =>
              String(c.code).toLowerCase() === String(chosenLabel).toLowerCase() ||
              String(c.label).toLowerCase() === String(chosenLabel).toLowerCase()
          );
          if (matchedChoice) {
            chosenLabel = matchedChoice.label;
            scoreVal = matchedChoice.score !== undefined ? matchedChoice.score : '';
          }
        }

        rows.push([idx + 1, questionText, chosenLabel, scoreVal, remark]);
      });

      let totalSelectedScore = 0;
      sub.answers.forEach((ans) => {
        const raw = ans.raw_value !== undefined ? ans.raw_value : ans.rawValue;
        let cLabel = '';
        if (typeof raw === 'object' && raw !== null) {
          cLabel = raw.choice || raw.code || '';
        } else if (raw !== undefined && raw !== null) {
          cLabel = String(raw);
        }
        const qD = matchedQ?.questions?.find(
          (q) => q.id === (ans.question_id || ans.questionId) || q.variableName === (ans.variable_name || ans.variableName)
        );
        const mC = qD?.choices?.find(
          (c) =>
            String(c.code).toLowerCase() === String(cLabel).toLowerCase() ||
            String(c.label).toLowerCase() === String(cLabel).toLowerCase()
        );
        if (mC && typeof mC.score === 'number') {
          totalSelectedScore += mC.score;
        }
      });

      const finalTotal = sub.earnedScore !== undefined ? sub.earnedScore : totalSelectedScore;
      rows.push(['']);
      rows.push(['', 'TOTAL SCORE', '', finalTotal, '']);
      if (sub.benchmarkLevel) {
        rows.push(['', 'BENCHMARK MATURITY LEVEL', '', sub.benchmarkLevel, '']);
      }

      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      worksheet['!cols'] = [{ wch: 8 }, { wch: 45 }, { wch: 35 }, { wch: 12 }, { wch: 45 }];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Stored Question Set');

      const safeName = sub.userName.replace(/[^a-zA-Z0-9_-]/g, '_');
      XLSX.writeFile(workbook, `${safeName}_Question_Set_${sub.confirmationId}.xlsx`);
    } catch (e) {
      console.error('Excel export failed', e);
    }
  };

  const totalUnsynced = pendingCount + failedCount;

  return (
    <PageContainer
      title="Field Data Collection & Question Set Storage"
      description="Collect participant survey responses in field environments with automatic user folder storage and server synchronization."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Data Collection', isCurrent: true },
      ]}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/data-collection/monitoring">
            <Button variant="outline" size="sm" className="gap-1.5">
              <BarChart2 className="h-4 w-4 text-blue-600" />
              <span>Monitoring Dashboard</span>
            </Button>
          </Link>

          <Link to="/data-collection/queue">
            <Button
              variant={totalUnsynced > 0 ? 'default' : 'outline'}
              size="sm"
              className="gap-1.5"
            >
              <Database className="h-4 w-4" />
              <span>Offline Queue ({totalUnsynced})</span>
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Network & Offline Status Banner */}
        <div
          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
            isOnline
              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
              : 'bg-amber-50/70 border-amber-300 text-amber-950'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-lg ${
                isOnline ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white animate-pulse'
              }`}
            >
              {isOnline ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold">
                  {isOnline ? 'System Online (Supabase Database Connected)' : 'System in Offline Mode'}
                </h4>
                <Badge variant={isOnline ? 'success' : 'warning'} className="text-[10px]">
                  {isOnline ? 'Connected' : 'Local Storage Active'}
                </Badge>
              </div>
              <p className="text-xs opacity-90 mt-0.5">
                {isOnline
                  ? 'All question sets are saved into user folders in Supabase PostgreSQL.'
                  : 'No internet connection. Responses are validated locally and queued in IndexedDB.'}
              </p>
            </div>
          </div>

          {isOnline && totalUnsynced > 0 && (
            <Button
              size="sm"
              onClick={triggerSync}
              disabled={isSyncing}
              className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Synchronizing...' : `Sync Queue (${totalUnsynced})`}</span>
            </Button>
          )}
        </div>

        {/* Sync Queue Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">User Folders</span>
              <p className="text-2xl font-bold text-blue-700">{userFolders.length}</p>
              <p className="text-[11px] text-slate-500">Folders named by user name</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Question Sets</span>
              <p className="text-2xl font-bold text-emerald-700">
                {responsesList ? responsesList.length : 0}
              </p>
              <p className="text-[11px] text-slate-500">Stored submissions</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Pending Upload</span>
              <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
              <p className="text-[11px] text-slate-500">Stored in local queue</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Synced to Database</span>
              <p className="text-2xl font-bold text-slate-900">{synchronizedCount}</p>
              <p className="text-[11px] text-slate-500">Verified server syncs</p>
            </CardContent>
          </Card>
        </div>

        {/* =========================================================================
            USER FOLDERS SYSTEM (FOLDER NAME = USER NAME)
        ========================================================================= */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Folder className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-base font-bold text-slate-900">
                  User Question Set Folders
                </CardTitle>
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-300">
                  {userFolders.length} User Folders
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Each submission automatically creates a folder named after the user. Click any folder to inspect its complete question sets.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Tab Selector */}
              <div className="flex items-center p-1 rounded-lg bg-slate-100 border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setViewTab('folders')}
                  className={`px-3 py-1 rounded font-semibold transition-all ${
                    viewTab === 'folders'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📁 Folders View
                </button>
                <button
                  type="button"
                  onClick={() => setViewTab('table')}
                  className={`px-3 py-1 rounded font-semibold transition-all ${
                    viewTab === 'table'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📋 Audit Table
                </button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchResponses()}
                className="text-xs gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Refresh</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Search Input */}
            <div className="flex items-center gap-2 max-w-md">
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search folder by user name, department, or topic..."
                  className="pl-9 text-xs"
                />
              </div>
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-slate-500"
                >
                  Clear
                </Button>
              )}
            </div>

            {loadingResponses ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-36 rounded-xl" />
                ))}
              </div>
            ) : filteredFolders.length === 0 ? (
              <div className="text-center py-10 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 space-y-3">
                <Folder className="h-10 w-10 text-amber-400 mx-auto" />
                <h4 className="text-sm font-semibold text-slate-700">No User Folders Created Yet</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  When a user fills out a questionnaire template with their <strong>User Name</strong>, <strong>Department</strong>, and <strong>Research Topic</strong> and clicks Submit, their personal folder will be automatically created here.
                </p>
                <Link to="/questionnaires">
                  <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs">
                    <span>Go to Questionnaires</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            ) : viewTab === 'folders' ? (
              /* ================= FOLDERS GRID VIEW ================= */
              <div className="space-y-6">
                {/* Active Folder Breadcrumb Navigation if opened */}
                {activeFolder && (
                  <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 flex items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-5 w-5 text-amber-500" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">
                            Folder: 📁 {activeFolder.folderName}
                          </h4>
                          <Badge variant="outline" className="text-[10px] bg-white border-blue-300 text-blue-800">
                            {activeFolder.submissions.length} Question Set(s)
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600">
                          {activeFolder.department} • {activeFolder.userEmail || 'No email provided'}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedFolder(null)}
                      className="text-xs bg-white text-slate-700"
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      <span>Close Folder</span>
                    </Button>
                  </div>
                )}

                {/* If a folder is selected, show its contents */}
                {activeFolder ? (
                  <div className="space-y-4">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Stored Question Sets in "{activeFolder.folderName}"
                    </h5>
                    <div className="grid grid-cols-1 gap-3">
                      {activeFolder.submissions.map((sub, sIdx) => (
                        <div
                          key={sub.id}
                          className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                {sub.templateId}
                              </span>
                              <span className="text-[11px] font-mono text-slate-500">
                                ACK: {sub.confirmationId}
                              </span>
                              {sub.earnedScore !== undefined && sub.maxScore !== undefined && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-purple-50 text-purple-800 border-purple-200"
                                >
                                  Score: {sub.earnedScore}/{sub.maxScore} ({sub.percentage?.toFixed(1)}%) • {sub.benchmarkLevel}
                                </Badge>
                              )}
                            </div>

                            <p className="text-sm font-semibold text-slate-900">
                              {sub.researchTopic}
                            </p>

                            <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                              <span>Department: {sub.department}</span>
                              <span>•</span>
                              <span>{sub.totalQuestions} Questions Stored</span>
                              <span>•</span>
                              <span>Submitted: {formatDate(sub.submittedAt)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setViewingSubmission(sub)}
                              className="text-xs gap-1.5 border-blue-300 text-blue-800 bg-blue-50/50 hover:bg-blue-100"
                            >
                              <Eye className="h-3.5 w-3.5 text-blue-600" />
                              <span>View Question Set</span>
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleExportSubmissionExcel(sub)}
                              className="text-xs gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                            >
                              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Export Excel</span>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Grid of All User Folders */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredFolders.map((folder) => {
                      const isFolderSelected = selectedFolder === folder.folderName;

                      return (
                        <div
                          key={folder.folderName}
                          onClick={() => setSelectedFolder(folder.folderName)}
                          className={`p-5 rounded-xl border text-left cursor-pointer transition-all space-y-3 ${
                            isFolderSelected
                              ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-500/20 shadow-md'
                              : 'border-slate-200 bg-white hover:border-amber-400 hover:shadow-md'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg shadow-xs">
                                <Folder className="h-6 w-6" />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600">
                                  📁 {folder.folderName}
                                </h4>
                                <span className="text-[11px] text-slate-500">
                                  {folder.submissions.length} Question Set{folder.submissions.length > 1 ? 's' : ''} Stored
                                </span>
                              </div>
                            </div>

                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          </div>

                          <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
                            <div className="flex items-center justify-between text-slate-600">
                              <span className="text-slate-400 text-[11px]">Department:</span>
                              <span className="font-medium truncate max-w-[150px]">{folder.department}</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-600">
                              <span className="text-slate-400 text-[11px]">Topic:</span>
                              <span className="font-medium truncate max-w-[150px]">{folder.researchTopic}</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-600">
                              <span className="text-slate-400 text-[11px]">Last Updated:</span>
                              <span className="text-slate-500">{formatDate(folder.latestSubmittedAt)}</span>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            className="w-full text-xs font-semibold gap-1.5 bg-slate-100 text-slate-800 hover:bg-blue-600 hover:text-white transition-colors"
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                            <span>Open Folder</span>
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* ================= AUDIT TABLE VIEW ================= */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/80">
                      <th className="py-2.5 px-3 font-semibold">User Folder Name</th>
                      <th className="py-2.5 px-3 font-semibold">Template ID</th>
                      <th className="py-2.5 px-3 font-semibold">Confirmation ID</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold">Answers Count</th>
                      <th className="py-2.5 px-3 font-semibold">Sync Source</th>
                      <th className="py-2.5 px-3 font-semibold">Submitted At</th>
                      <th className="py-2.5 px-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(responsesList || []).map((resp: any) => {
                      const answersArr = resp.answers || [];
                      const userMetaAns = answersArr.find(
                        (a: any) =>
                          a.question_id === '__user_details__' ||
                          a.questionId === '__user_details__' ||
                          a.variable_name === '__user_details__'
                      );
                      const userMeta = userMetaAns?.raw_value || userMetaAns?.rawValue || {};
                      const uName =
                        userMeta.userName ||
                        userMeta.name ||
                        resp.participant_identifier ||
                        resp.participantIdentifier ||
                        'Anonymous';

                      const templateId =
                        userMeta.templateId ||
                        (resp.questionnaire_id
                          ? `TMPL-${String(resp.questionnaire_id).replace(/-/g, '').slice(0, 8).toUpperCase()}`
                          : 'TMPL-001');

                      const regularAnswers = answersArr.filter(
                        (a: any) =>
                          a.question_id !== '__user_details__' &&
                          a.questionId !== '__user_details__'
                      );

                      const sub: StoredSubmission = {
                        id: resp.id,
                        confirmationId: resp.confirmation_id || resp.confirmationId || resp.id?.slice(0, 8),
                        templateId,
                        questionnaireId: resp.questionnaire_id || resp.questionnaireId || '',
                        userName: uName,
                        userEmail: userMeta.email || '',
                        department: userMeta.department || 'Clinical Research',
                        researchTopic: userMeta.researchTopic || 'Research Instrument',
                        syncSource: resp.sync_source || 'online',
                        status: resp.status || 'completed',
                        submittedAt: resp.server_received_at || new Date().toISOString(),
                        totalQuestions: regularAnswers.length,
                        earnedScore: userMeta.earnedScore,
                        maxScore: userMeta.maxPossible,
                        percentage: userMeta.percentage,
                        benchmarkLevel: userMeta.benchmarkLevel,
                        answers: regularAnswers,
                      };

                      return (
                        <tr key={resp.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-3 font-semibold text-blue-700 flex items-center gap-1.5">
                            <Folder className="h-3.5 w-3.5 text-amber-500" />
                            <span>📁 {uName}</span>
                          </td>
                          <td className="py-3 px-3 font-mono font-medium text-slate-800">
                            {templateId}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600">
                            {sub.confirmationId}
                          </td>
                          <td className="py-3 px-3">
                            <Badge
                              variant={resp.status === 'completed' ? 'success' : 'outline'}
                              className="text-[10px] uppercase font-semibold"
                            >
                              {resp.status || 'completed'}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {regularAnswers.length} questions recorded
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              {resp.sync_source || 'online'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                            {resp.server_received_at ? formatDate(resp.server_received_at) : 'Just now'}
                          </td>
                          <td className="py-3 px-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setViewingSubmission(sub)}
                              className="text-[11px] gap-1 px-2 py-1 h-7 border-blue-200 text-blue-700"
                            >
                              <Eye className="h-3 w-3" />
                              <span>View</span>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* =========================================================================
            QUESTION SET DETAILS MODAL / DIALOG
        ========================================================================= */}
        {viewingSubmission && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Stored Question Set: {viewingSubmission.researchTopic}
                    </h3>
                    <p className="text-xs text-slate-500">
                      User Folder: <strong>📁 {viewingSubmission.userName}</strong> • Template ID: <code>{viewingSubmission.templateId}</code>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setViewingSubmission(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
                {/* User & Meta Overview Card */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">User Name</span>
                    <span className="font-semibold text-slate-900">{viewingSubmission.userName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Department</span>
                    <span className="font-semibold text-slate-900">{viewingSubmission.department}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Confirmation ID</span>
                    <span className="font-mono text-slate-800">{viewingSubmission.confirmationId}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Submitted At</span>
                    <span className="text-slate-700">{formatDate(viewingSubmission.submittedAt)}</span>
                  </div>
                </div>

                {/* Score Banner if available */}
                {viewingSubmission.earnedScore !== undefined && viewingSubmission.maxScore !== undefined && (
                  <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200 text-purple-950 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Assessment Score</span>
                      <p className="text-xl font-bold text-purple-900">
                        {viewingSubmission.earnedScore} / {viewingSubmission.maxScore} ({viewingSubmission.percentage?.toFixed(1)}%)
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs bg-white text-purple-800 border-purple-300 font-semibold py-1 px-3">
                      {viewingSubmission.benchmarkLevel}
                    </Badge>
                  </div>
                )}

                {/* Stored Questions List */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-800 text-sm">
                    Questions & Participant Responses ({viewingSubmission.answers.length} items)
                  </h4>

                  <div className="space-y-3">
                    {(() => {
                      const matchedQ = (publishedSurveys || []).find(
                        (s) => s.id === viewingSubmission.questionnaireId || s.title.toLowerCase() === viewingSubmission.researchTopic.toLowerCase()
                      );

                      return viewingSubmission.answers.map((ans, idx) => {
                        const raw = ans.raw_value !== undefined ? ans.raw_value : ans.rawValue;
                        let choiceCode = '';
                        let remarkText = '';

                        if (typeof raw === 'object' && raw !== null) {
                          choiceCode = raw.choice || raw.code || JSON.stringify(raw);
                          remarkText = raw.remark || '';
                        } else if (raw !== undefined && raw !== null) {
                          choiceCode = String(raw);
                        }

                        const qDef = matchedQ?.questions?.find(
                          (q) => q.id === (ans.question_id || ans.questionId) || q.variableName === (ans.variable_name || ans.variableName)
                        );

                        let choiceLabel = choiceCode;
                        let choiceScore: any = undefined;

                        if (qDef?.choices) {
                          const matchedChoice = qDef.choices.find(
                            (c) =>
                              String(c.code).toLowerCase() === String(choiceCode).toLowerCase() ||
                              String(c.label).toLowerCase() === String(choiceCode).toLowerCase()
                          );
                          if (matchedChoice) {
                            choiceLabel = matchedChoice.label;
                            choiceScore = matchedChoice.score;
                          }
                        }

                        return (
                          <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5 shadow-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-blue-700 font-mono text-xs">
                                #{idx + 1} {qDef?.variableName || ans.variable_name || ans.variableName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ID: {ans.question_id || ans.questionId}
                              </span>
                            </div>

                            {/* Full Question Prompt Text */}
                            <p className="text-xs font-semibold text-slate-900 leading-snug">
                              {qDef?.text || `Question ${idx + 1}`}
                            </p>

                            {/* Selected Option & Score Badge */}
                            <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100 flex items-center justify-between gap-2">
                              <div className="space-y-0.5">
                                <span className="text-[10px] uppercase font-bold text-blue-700 block">
                                  Selected Response Option:
                                </span>
                                <span className="text-xs font-semibold text-slate-900">
                                  {choiceLabel || '(No response recorded)'}
                                </span>
                              </div>
                              {choiceScore !== undefined && (
                                <span className="text-xs font-mono font-bold bg-blue-600 text-white px-2.5 py-1 rounded-md shadow-xs">
                                  Score: {choiceScore}
                                </span>
                              )}
                            </div>

                            {/* Dynamic Remark */}
                            {remarkText && (
                              <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200 text-amber-950 text-xs">
                                <span className="font-bold text-[10px] uppercase tracking-wider block text-amber-800">
                                  Dynamic Remark:
                                </span>
                                <p className="mt-0.5 text-amber-900 font-medium leading-relaxed">{remarkText}</p>
                              </div>
                            )}

                            {/* Explanation Rationale */}
                            {qDef?.explanation && (
                              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs">
                                <span className="font-bold text-[10px] uppercase tracking-wider block text-slate-500">
                                  Concept Explanation:
                                </span>
                                <p className="mt-0.5 text-slate-600 leading-relaxed">{qDef.explanation}</p>
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingSubmission(null)}
                  className="text-xs"
                >
                  Close
                </Button>

                <Button
                  size="sm"
                  onClick={() => handleExportSubmissionExcel(viewingSubmission)}
                  className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Download Excel Report (.xlsx)</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Local Security & Data Retention Advisory */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
          <div className="flex items-center gap-2 text-slate-800 font-bold">
            <Shield className="h-4 w-4 text-blue-600" />
            <span>Folder Organization & Supabase Persistence Notice</span>
          </div>
          <p className="leading-relaxed">
            Every submitted question set is classified under the participant's <strong>User Name Folder</strong> in Supabase PostgreSQL. Submissions store complete answers, 6-level maturity scores, and dynamic research remarks with unique confirmation codes for clinical integrity.
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
