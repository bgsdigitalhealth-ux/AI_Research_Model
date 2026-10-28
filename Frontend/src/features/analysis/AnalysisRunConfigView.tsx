import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { StatusState } from '@/components/shared/StatusState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useDatasets, useDatasetVariables, useSupportedMethods, useRunAnalysis } from '@/hooks/useAnalysis';
import { AnalysisMethodType, MissingDataHandlingMethod } from '@/types/analysis';
import {
  Play,
  Database,
  Sliders,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  HelpCircle,
  ArrowLeft,
  Loader2,
} from 'lucide-react';

export function AnalysisRunConfigView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialDatasetId = searchParams.get('datasetId') || '';
  const initialMethodId = (searchParams.get('methodId') as AnalysisMethodType) || 'linear_regression';

  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(initialDatasetId);
  const [selectedMethodId, setSelectedMethodId] = useState<AnalysisMethodType>(initialMethodId);
  const [dependentVar, setDependentVar] = useState<string>('');
  const [independentVars, setIndependentVars] = useState<string[]>([]);
  const [covariates, setCovariates] = useState<string[]>([]);
  const [stratifyBy, setStratifyBy] = useState<string>('');
  const [confidenceLevel, setConfidenceLevel] = useState<number>(95);
  const [handleMissing, setHandleMissing] = useState<MissingDataHandlingMethod>('complete_case');
  const [formError, setFormError] = useState<string | null>(null);

  const {
    data: datasets,
    isLoading: isDatasetsLoading,
    isError: isDatasetsError,
    error: datasetsError,
    refetch: refetchDatasets,
  } = useDatasets();

  // If no dataset selected yet and datasets exist, preselect first
  useEffect(() => {
    if (!selectedDatasetId && datasets && datasets.length > 0) {
      setSelectedDatasetId(datasets[0].id);
    }
  }, [datasets, selectedDatasetId]);

  const {
    data: variables,
    isLoading: isVarsLoading,
    isError: isVarsError,
    refetch: refetchVars,
  } = useDatasetVariables(selectedDatasetId);

  const {
    data: methods,
    isLoading: isMethodsLoading,
    isError: isMethodsError,
    refetch: refetchMethods,
  } = useSupportedMethods();

  const runAnalysisMutation = useRunAnalysis();

  const selectedDataset = datasets?.find((d) => d.id === selectedDatasetId);
  const selectedMethod = methods?.find((m) => m.id === selectedMethodId);

  const handleToggleIndependent = (varName: string) => {
    if (independentVars.includes(varName)) {
      setIndependentVars(independentVars.filter((v) => v !== varName));
    } else {
      setIndependentVars([...independentVars, varName]);
    }
  };

  const handleToggleCovariate = (varName: string) => {
    if (covariates.includes(varName)) {
      setCovariates(covariates.filter((v) => v !== varName));
    } else {
      setCovariates([...covariates, varName]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedDatasetId) {
      setFormError('Please select a frozen dataset snapshot.');
      return;
    }

    if (!selectedMethodId) {
      setFormError('Please select a statistical analysis method.');
      return;
    }

    if (!dependentVar && selectedMethodId !== 'descriptive_summary') {
      setFormError('Please select a primary dependent variable (outcome).');
      return;
    }

    if (independentVars.length === 0 && selectedMethodId !== 'descriptive_summary') {
      setFormError('Please select at least one independent variable (predictor).');
      return;
    }

    try {
      const res = await runAnalysisMutation.mutateAsync({
        studyId: selectedDataset?.studyId || 'study-default',
        datasetSnapshotId: selectedDatasetId,
        methodId: selectedMethodId,
        dependentVariable: dependentVar,
        independentVariables: independentVars,
        covariates: covariates.length > 0 ? covariates : undefined,
        stratifyBy: stratifyBy || undefined,
        confidenceLevel,
        handleMissing,
      });

      if (res.status === 'completed') {
        navigate(`/analysis/${res.id}/results`);
      } else {
        navigate(`/analysis/${res.id}/status`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Execution failed';
      setFormError(`Failed to trigger analysis run: ${msg}`);
    }
  };

  return (
    <PageContainer
      title="Configure Statistical Analysis"
      description="Map study variables, select validated analytical methods prespecified in the SAP, and dispatch compute jobs."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Analysis', path: '/analysis' },
        { label: 'Configure Run', isCurrent: true },
      ]}
      actions={
        <Button variant="outline" size="sm" onClick={() => navigate('/analysis')} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Workbench</span>
        </Button>
      }
    >
      <div className="space-y-6">
        {isDatasetsError ? (
          <StatusState
            type="unavailable"
            title="Analysis Engine Offline"
            description="Unable to connect to dataset snapshot services (/analysis/datasets)."
            endpoint="/analysis/datasets"
            actionLabel="Retry Connection"
            onAction={() => refetchDatasets()}
          />
        ) : isDatasetsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !datasets || datasets.length === 0 ? (
          <StatusState
            type="empty"
            title="No Datasets Available"
            description="You must have at least one frozen dataset snapshot before you can configure a statistical analysis run."
            actionLabel="View Data Collection"
            onAction={() => navigate('/data-collection')}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. Dataset Snapshot & Version Selection */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
                <Database className="h-4 w-4 text-blue-600" />
                <span>1. Select Frozen Dataset Snapshot</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Dataset Snapshot
                  </label>
                  <select
                    value={selectedDatasetId}
                    onChange={(e) => setSelectedDatasetId(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  >
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.recordCount} rows, {d.variableCount} vars, Schema {d.questionnaireVersion})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedDataset && (
                  <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600 flex flex-col justify-center">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-800">Snapshot Provenance:</span>
                      <Badge variant="outline" className="text-[10px]">
                        Frozen {new Date(selectedDataset.snapshotDate).toLocaleDateString()}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Immutable lock applied. Questionnaire schema: {selectedDataset.questionnaireVersion}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Statistical Method Selection */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
                <FileCheck2 className="h-4 w-4 text-blue-600" />
                <span>2. Statistical Method (SAP Concordance)</span>
              </h3>

              {isMethodsLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : isMethodsError ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  Methods catalog unavailable.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {methods?.map((m) => {
                      const isSelected = selectedMethodId === m.id;
                      return (
                        <div
                          key={m.id}
                          onClick={() => setSelectedMethodId(m.id)}
                          className={`cursor-pointer rounded-md border p-3 transition-colors ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-600'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-slate-900">{m.name}</span>
                            {m.isApprovedInSap && (
                              <Badge variant="success" className="text-[9px] px-1 py-0">
                                SAP Approved
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-2">{m.description}</p>
                          <div className="mt-2 text-[10px] text-slate-400">
                            Category: {m.category}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedMethod && (
                    <div className="mt-3 rounded-md bg-blue-50/50 p-3 text-xs text-blue-900 border border-blue-100">
                      <div className="font-semibold">{selectedMethod.name} Diagnostic Requirements:</div>
                      <div className="mt-1 text-[11px] text-blue-800">
                        Assumptions automatically evaluated: {selectedMethod.assumptionsTested.join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. Variable Mapping */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
                <Sliders className="h-4 w-4 text-blue-600" />
                <span>3. Variable Mapping from Dictionary</span>
              </h3>

              {isVarsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : isVarsError ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  Failed to load variable dictionary for this dataset.
                </div>
              ) : !variables || variables.length === 0 ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 text-center">
                  No variables found in this dataset snapshot.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Dependent Variable */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Primary Outcome / Dependent Variable ($Y$)
                    </label>
                    <select
                      value={dependentVar}
                      onChange={(e) => setDependentVar(e.target.value)}
                      className="w-full md:w-96 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                    >
                      <option value="">-- Select primary outcome variable --</option>
                      {variables.map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name} — {v.label} ({v.dataType})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Independent Variables */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Independent Variables / Predictors / Treatment Arms ($X$)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 border border-slate-200 rounded-md bg-slate-50">
                      {variables.map((v) => {
                        const checked = independentVars.includes(v.name);
                        return (
                          <label
                            key={v.name}
                            className={`flex items-center gap-2 p-1.5 rounded text-xs cursor-pointer ${
                              checked ? 'bg-blue-100/70 font-medium' : 'hover:bg-white'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleIndependent(v.name)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="truncate" title={v.label}>
                              {v.name} <span className="text-[10px] text-slate-500">({v.dataType})</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Covariates / Confounders */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Covariates &amp; Adjustments (Optional)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-2 border border-slate-200 rounded-md bg-slate-50">
                      {variables.map((v) => {
                        const checked = covariates.includes(v.name);
                        return (
                          <label
                            key={v.name}
                            className={`flex items-center gap-2 p-1.5 rounded text-xs cursor-pointer ${
                              checked ? 'bg-indigo-100/70 font-medium' : 'hover:bg-white'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleCovariate(v.name)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="truncate" title={v.label}>
                              {v.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Stratification Variable */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Stratification / Subgroup Factor (Optional)
                    </label>
                    <select
                      value={stratifyBy}
                      onChange={(e) => setStratifyBy(e.target.value)}
                      className="w-full md:w-80 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                    >
                      <option value="">-- No subgroup stratification --</option>
                      {variables
                        .filter((v) => v.dataType === 'categorical' || v.dataType === 'binary')
                        .map((v) => (
                          <option key={v.name} value={v.name}>
                            {v.name} — {v.label}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Execution Parameters */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
                <Sliders className="h-4 w-4 text-blue-600" />
                <span>4. Statistical Parameters &amp; Missingness Handling</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Confidence Interval Level ($\alpha$)
                  </label>
                  <select
                    value={confidenceLevel}
                    onChange={(e) => setConfidenceLevel(Number(e.target.value))}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  >
                    <option value={90}>90% (Two-sided $\alpha = 0.10$)</option>
                    <option value={95}>95% Standard (Two-sided $\alpha = 0.05$)</option>
                    <option value={99}>99% Rigorous (Two-sided $\alpha = 0.01$)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Missing Data Handling Strategy
                  </label>
                  <select
                    value={handleMissing}
                    onChange={(e) => setHandleMissing(e.target.value as MissingDataHandlingMethod)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  >
                    <option value="complete_case">Complete Case Analysis (Listwise deletion)</option>
                    <option value="multiple_imputation">Multiple Imputation (MICE, 20 datasets)</option>
                    <option value="fiml">Full Information Maximum Likelihood (FIML)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Form Error Alert */}
            {formError && (
              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            {/* Submit Bar */}
            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate('/analysis')}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                size="sm"
                disabled={runAnalysisMutation.isPending}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {runAnalysisMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Submitting Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    <span>Execute Statistical Analysis</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </PageContainer>
  );
}

