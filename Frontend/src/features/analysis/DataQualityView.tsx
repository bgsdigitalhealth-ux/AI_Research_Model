import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { StatusState } from '@/components/shared/StatusState';
import { MetricCard } from '@/components/shared/MetricCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useDatasets, useDataQualityReport } from '@/hooks/useAnalysis';
import {
  BarChart2,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Search,
  Database,
  Layers,
  HelpCircle,
  TrendingDown,
} from 'lucide-react';

export function DataQualityView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlDatasetId = searchParams.get('datasetId') || '';

  const {
    data: datasets,
    isLoading: isDatasetsLoading,
    isError: isDatasetsError,
    refetch: refetchDatasets,
  } = useDatasets();

  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(urlDatasetId);

  useEffect(() => {
    if (!selectedDatasetId && datasets && datasets.length > 0) {
      setSelectedDatasetId(datasets[0].id);
    }
  }, [datasets, selectedDatasetId]);

  const {
    data: qualityReport,
    isLoading: isQualityLoading,
    isError: isQualityError,
    error: qualityError,
    refetch: refetchQuality,
  } = useDataQualityReport(selectedDatasetId);

  const [filterText, setFilterText] = useState('');

  const filteredVars = qualityReport?.variablesQuality.filter(
    (v) =>
      v.variableName.toLowerCase().includes(filterText.toLowerCase()) ||
      v.label.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <PageContainer
      title="Data Quality &amp; Missingness Diagnostics"
      description="Inspect dataset completeness, variable distributions, missingness patterns (MCAR/MAR), and outlier flags."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Analysis', path: '/analysis' },
        { label: 'Data Quality', isCurrent: true },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/analysis')} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            <span>Analysis Workbench</span>
          </Button>
          {selectedDatasetId && (
            <Button
              size="sm"
              onClick={() => navigate(`/analysis/new?datasetId=${selectedDatasetId}`)}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <span>Analyze This Dataset</span>
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Dataset Snapshot Selector */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-semibold text-slate-800">Active Dataset Snapshot:</span>
            </div>

            {isDatasetsLoading ? (
              <Skeleton className="h-8 w-64" />
            ) : isDatasetsError || !datasets || datasets.length === 0 ? (
              <span className="text-xs text-slate-500">No snapshots available</span>
            ) : (
              <select
                value={selectedDatasetId}
                onChange={(e) => {
                  setSelectedDatasetId(e.target.value);
                  setSearchParams({ datasetId: e.target.value });
                }}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.recordCount} records, frozen {new Date(d.snapshotDate).toLocaleDateString()})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Quality Content */}
        {isQualityLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        ) : isQualityError ? (
          <StatusState
            type="unavailable"
            title="Data Quality Diagnostics Offline"
            description={
              qualityError instanceof Error
                ? qualityError.message
                : `Quality diagnostics service (/analysis/datasets/${selectedDatasetId}/quality) is currently unreachable.`
            }
            endpoint={`/analysis/datasets/${selectedDatasetId}/quality`}
            actionLabel="Retry Diagnostics"
            onAction={() => refetchQuality()}
          />
        ) : !qualityReport ? (
          <StatusState
            type="empty"
            title="No Quality Diagnostics Found"
            description="No completeness or missingness metrics have been generated for this snapshot."
          />
        ) : (
          <div className="space-y-6">
            {/* Metric Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Total Records"
                value={qualityReport.totalRecords.toLocaleString()}
                icon={Database}
                description="Sample row count"
              />
              <MetricCard
                title="Variables Tracked"
                value={qualityReport.totalVariables}
                icon={Layers}
                description="Columns in schema"
              />
              <MetricCard
                title="Complete Cases"
                value={`${qualityReport.completeCasesPercentage.toFixed(1)}%`}
                icon={CheckCircle2}
                description={`${qualityReport.completeCasesCount} rows without missingness`}
              />
              <MetricCard
                title="Overall Missingness"
                value={`${qualityReport.overallMissingnessPercentage.toFixed(1)}%`}
                icon={TrendingDown}
                description="Missing cells across dataset"
              />
            </div>

            {/* Recommendations / Imputation Advice */}
            {qualityReport.recommendations && qualityReport.recommendations.length > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 text-xs text-blue-900 shadow-xs">
                <div className="flex items-center gap-2 font-semibold mb-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  <span>Methodological Recommendations for Analysis Plan:</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-blue-800">
                  {qualityReport.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Variable Quality Table */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Variable-Level Completeness &amp; Quality Breakdown
                  </h3>
                  <p className="text-xs text-slate-500">
                    Missing percentage, valid case proportion, and outlier counts
                  </p>
                </div>

                <div className="w-64">
                  <input
                    type="text"
                    placeholder="Search variable name or label..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Variable</th>
                      <th className="px-4 py-3">Data Type</th>
                      <th className="px-4 py-3 text-right">Valid Count</th>
                      <th className="px-4 py-3 text-right">Missing Count</th>
                      <th className="px-4 py-3">Completeness Bar</th>
                      <th className="px-4 py-3 text-right">Outliers</th>
                      <th className="px-4 py-3">Pattern Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredVars && filteredVars.length > 0 ? (
                      filteredVars.map((v) => {
                        const completeness = 100 - v.missingPercentage;
                        const isSevere = v.missingPercentage > 20;

                        return (
                          <tr key={v.variableName} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <span className="font-mono font-medium text-slate-900 block">{v.variableName}</span>
                              <span className="text-[11px] text-slate-500">{v.label}</span>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="font-mono text-[10px]">
                                {v.dataType}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-800">
                              {v.validCount.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              <span className={isSevere ? 'font-semibold text-red-600' : 'text-slate-600'}>
                                {v.missingCount} ({v.missingPercentage.toFixed(1)}%)
                              </span>
                            </td>
                            <td className="px-4 py-3 w-40">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                                  <div
                                    className={`h-full ${
                                      completeness > 90
                                        ? 'bg-emerald-500'
                                        : completeness > 70
                                        ? 'bg-amber-500'
                                        : 'bg-red-500'
                                    }`}
                                    style={{ width: `${completeness}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {completeness.toFixed(0)}%
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-600">
                              {v.outlierCount !== undefined ? v.outlierCount : '—'}
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-[11px]">
                              {v.patternNotes || (v.hasPatternedMissingness ? 'Patterned missingness detected' : 'MCAR')}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                          No variables match your search filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Missingness Mechanisms (MCAR / MAR) */}
            {qualityReport.missingnessPatterns && qualityReport.missingnessPatterns.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">
                  Missingness Mechanism &amp; Co-occurrence Patterns
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {qualityReport.missingnessPatterns.map((pat) => (
                    <div key={pat.patternId} className="rounded-md border border-slate-200 bg-slate-50 p-4 text-xs">
                      <div className="flex items-center justify-between font-semibold text-slate-800 mb-1">
                        <span>Pattern: {pat.patternId}</span>
                        <Badge variant="outline" className="text-[10px]">
                          Candidate: {pat.mechanismCandidate || 'MAR'}
                        </Badge>
                      </div>
                      <p className="text-slate-600 mb-2">
                        Affects {pat.affectedRecords} records ({pat.percentage.toFixed(1)}% of cohort)
                      </p>
                      <div className="text-[11px] text-slate-500">
                        Associated variables: <span className="font-mono">{pat.variableNames.join(', ')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

