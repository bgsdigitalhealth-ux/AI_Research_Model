export type VariableDataType = 'numeric' | 'categorical' | 'binary' | 'ordinal' | 'datetime' | 'text';

export type VariableRole = 'independent' | 'dependent' | 'covariate' | 'identifier' | 'weight' | 'stratification';

export interface VariableSummaryStats {
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  sd?: number;
  q1?: number;
  q3?: number;
  mode?: string | number;
  categories?: Array<{ value: string; count: number; percentage: number }>;
}

export interface VariableDefinition {
  name: string;
  label: string;
  dataType: VariableDataType;
  role: VariableRole;
  missingCount: number;
  missingPercentage: number;
  uniqueValuesCount: number;
  summaryStats?: VariableSummaryStats;
  questionCode?: string;
  unit?: string;
}

export interface DatasetSnapshot {
  id: string;
  studyId: string;
  studyTitle?: string;
  name: string;
  snapshotDate: string;
  recordCount: number;
  variableCount: number;
  questionnaireVersion: string;
  isFrozen: boolean;
  frozenBy?: string;
  frozenAt?: string;
  description?: string;
  dataQualityScore?: number;
}

export type AnalysisMethodType =
  | 'descriptive_summary'
  | 'independent_t_test'
  | 'paired_t_test'
  | 'one_way_anova'
  | 'ancova'
  | 'chi_square'
  | 'linear_regression'
  | 'logistic_regression'
  | 'cox_proportional_hazards'
  | 'linear_mixed_effects';

export interface AnalysisMethod {
  id: AnalysisMethodType;
  name: string;
  category: 'Descriptive' | 'Comparison' | 'Regression' | 'Survival' | 'Advanced';
  description: string;
  supportedVariableTypes: {
    dependent: VariableDataType[];
    independent: VariableDataType[];
  };
  requiresCovariates?: boolean;
  assumptionsTested: string[];
  isApprovedInSap: boolean;
  sapReferenceSection?: string;
}

export type MissingDataHandlingMethod = 'complete_case' | 'multiple_imputation' | 'fiml' | 'mean_substitution';

export interface AnalysisRunConfig {
  studyId: string;
  datasetSnapshotId: string;
  methodId: AnalysisMethodType;
  dependentVariable: string;
  independentVariables: string[];
  covariates?: string[];
  stratifyBy?: string;
  confidenceLevel: number; // e.g. 95
  handleMissing: MissingDataHandlingMethod;
  testOptions?: {
    alternativeHypothesis?: 'two_sided' | 'greater' | 'less';
    equalVariancesAssumed?: boolean;
    referenceGroup?: string;
  };
}

export type AnalysisExecutionStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AnalysisRun {
  id: string;
  studyId: string;
  studyTitle?: string;
  datasetSnapshotId: string;
  datasetSnapshotName?: string;
  questionnaireVersion?: string;
  methodId: AnalysisMethodType;
  methodName?: string;
  config: AnalysisRunConfig;
  status: AnalysisExecutionStatus;
  progressPercent: number;
  statusMessage?: string;
  errorMessage?: string;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  executedBy: {
    id: string;
    name: string;
    email: string;
  };
  durationSeconds?: number;
}

export interface StatisticalEstimate {
  parameter: string;
  estimate: number;
  stdError: number;
  statistic: number;
  statisticName: string; // e.g. 't', 'F', 'z', 'wald'
  degreesOfFreedom?: number | number[];
  pValue: number;
  ciLower: number;
  ciUpper: number;
  significant: boolean;
}

export interface AssumptionWarning {
  assumption: string;
  testUsed?: string;
  testStatistic?: number;
  pValue?: number;
  severity: 'warning' | 'violation' | 'info';
  message: string;
  recommendation?: string;
}

export interface DistributionDataPoint {
  bucket: string;
  observedCount: number;
  expectedCount?: number;
  frequency?: number;
  group?: string;
}

export interface ScatterPlotDataPoint {
  x: number;
  y: number;
  predicted?: number;
  residual?: number;
  group?: string;
}

export interface SurvivalDataPoint {
  time: number;
  survivalProb: number;
  ciLower?: number;
  ciUpper?: number;
  group: string;
  atRisk: number;
  events: number;
}

export interface AiStatisticalExplanation {
  summary: string;
  clinicalInterpretation: string;
  limitations: string[];
  plainLanguageSummary: string;
  confidenceNote: string;
  verifiedAgainstProtocol: boolean;
  generatedAt: string;
}

export interface StatisticalResult {
  runId: string;
  studyId: string;
  studyTitle?: string;
  datasetSnapshotId: string;
  methodId: AnalysisMethodType;
  sampleSize: number;
  excludedCount: number;
  missingnessHandled: MissingDataHandlingMethod;
  degreesOfFreedom?: number | number[];
  testStatistic?: {
    name: string;
    value: number;
  };
  pValue?: number;
  effectSize?: {
    name: string;
    value: number;
    ciLower?: number;
    ciUpper?: number;
    interpretation?: string;
  };
  confidenceInterval?: {
    level: number;
    lower: number;
    upper: number;
  };
  estimatesTable?: StatisticalEstimate[];
  assumptionWarnings: AssumptionWarning[];
  distributionData?: DistributionDataPoint[];
  scatterPlotData?: ScatterPlotDataPoint[];
  survivalData?: SurvivalDataPoint[];
  aiExplanation?: AiStatisticalExplanation;
  generatedAt: string;
}

export interface VariableQualityItem {
  variableName: string;
  label: string;
  dataType: VariableDataType;
  totalCount: number;
  validCount: number;
  missingCount: number;
  missingPercentage: number;
  outlierCount?: number;
  hasPatternedMissingness?: boolean;
  patternNotes?: string;
}

export interface MissingnessPattern {
  patternId: string;
  variableNames: string[];
  affectedRecords: number;
  percentage: number;
  mechanismCandidate?: 'MCAR' | 'MAR' | 'MNAR';
}

export interface DataQualityReport {
  studyId: string;
  datasetSnapshotId: string;
  datasetSnapshotName?: string;
  generatedAt: string;
  totalRecords: number;
  totalVariables: number;
  overallMissingnessPercentage: number;
  completeCasesCount: number;
  completeCasesPercentage: number;
  variablesQuality: VariableQualityItem[];
  missingnessPatterns?: MissingnessPattern[];
  recommendations: string[];
}
