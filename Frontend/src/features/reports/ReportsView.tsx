import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { StatusState } from '@/components/shared/StatusState';
import { MetricCard } from '@/components/shared/MetricCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useReports } from '@/hooks/useReports';
import {
  FileText,
  FilePlus,
  FileDown,
  BookOpen,
  CheckCircle2,
  Clock,
  ArrowRight,
  Search,
  Filter,
  Layers,
} from 'lucide-react';

export function ReportsView() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const {
    data: reports,
    isLoading,
    isError,
    error,
    refetch,
  } = useReports();

  const filteredReports = reports?.filter((r) => {
    const matchesType = typeFilter === 'all' || r.type === typeFilter;
    const matchesSearch =
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.studyTitle.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const totalReports = reports?.length ?? 0;
  const approvedReports = reports?.filter((r) => r.status === 'approved').length ?? 0;

  return (
    <PageContainer
      title="Research Reports &amp; Manuscripts"
      
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Reports', isCurrent: true },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/reports/exports')}
            className="gap-1.5"
          >
            <FileDown className="h-4 w-4" />
            <span>Export Centre</span>
          </Button>

          <Button
            size="sm"
            onClick={() => navigate('/reports/new')}
            className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <FilePlus className="h-4 w-4" />
            <span>Synthesize New Report</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard
            title="Total Reports"
            value={totalReports}
            icon={BookOpen}
            
            loading={isLoading}
          />
          <MetricCard
            title="Regulatory Approved"
            value={approvedReports}
            icon={CheckCircle2}
            
            loading={isLoading}
          />
          <MetricCard
            title="Export Packages"
            value="CSV • XLSX • PDF • DOCX"
            icon={FileDown}
            
          />
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search report title, study..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <span>Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
              >
                <option value="all">All Report Types</option>
                <option value="csr">Clinical Study Report (CSR)</option>
                <option value="manuscript">Manuscript Draft</option>
                <option value="interim_summary">Interim Summary</option>
                <option value="saf_report">Statistical Analysis Finding</option>
              </select>
            </div>
          </div>

          <span className="text-xs text-slate-500">
            Showing {filteredReports?.length ?? 0} reports
          </span>
        </div>

        {/* Reports Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
        ) : isError ? (
          <StatusState
            type="unavailable"
            title="Reports Repository Offline"
            description={
              error instanceof Error
                ? error.message
                : 'Unable to query research reports from (/reports).'
            }
            endpoint="/reports"
            actionLabel="Retry Connection"
            onAction={() => refetch()}
          />
        ) : !reports || reports.length === 0 ? (
          <StatusState
            type="empty"
            title="No Research Reports Compiled"
            description="Generate your first Clinical Study Report or manuscript draft from verified statistical analysis runs."
            actionLabel="Synthesize First Report"
            onAction={() => navigate('/reports/new')}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredReports && filteredReports.length > 0 ? (
              filteredReports.map((report) => (
                <div
                  key={report.id}
                  className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition-colors"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-900">{report.title}</h3>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">
                            v{report.version}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{report.studyTitle}</p>
                      </div>

                      <div>
                        {report.status === 'approved' && (
                          <Badge variant="success" className="gap-1 text-[10px]">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Approved</span>
                          </Badge>
                        )}
                        {report.status === 'under_review' && (
                          <Badge variant="secondary" className="gap-1 text-[10px] text-amber-800 bg-amber-50 border-amber-200">
                            <Clock className="h-3 w-3" />
                            <span>Under Review</span>
                          </Badge>
                        )}
                        {report.status === 'draft' && (
                          <Badge variant="outline" className="text-[10px] text-slate-600">
                            Draft
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-md bg-slate-50 p-2.5 text-xs text-slate-600">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Type</span>
                        <span className="font-semibold text-slate-800 uppercase">{report.type}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Sections</span>
                        <span className="font-semibold text-slate-800">{report.sections.length}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Linked Runs</span>
                        <span className="font-semibold text-slate-800">{report.approvedAnalysisRunIds.length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-[11px] text-slate-400">
                      By {report.author.name} • {new Date(report.updatedAt).toLocaleDateString()}
                    </span>
                    <Button
                      size="xs"
                      onClick={() => navigate(`/reports/${report.id}`)}
                      className="gap-1"
                    >
                      <span>Preview Report</span>
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
                No reports match your search query.
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
