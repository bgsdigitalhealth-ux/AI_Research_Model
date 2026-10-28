import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import ConfigDict, Field
from app.schemas.common import BaseSchema

VariableDataType = Literal["numeric", "categorical", "binary", "ordinal", "datetime", "text"]
VariableRole = Literal["independent", "dependent", "covariate", "identifier", "weight", "stratification"]

AnalysisMethodType = Literal[
    "descriptive_summary",
    "independent_t_test",
    "paired_t_test",
    "one_way_anova",
    "ancova",
    "chi_square",
    "linear_regression",
    "logistic_regression",
    "cox_proportional_hazards",
    "linear_mixed_effects",
    "correlation_pearson",
    "correlation_spearman",
]

MissingDataHandlingMethod = Literal["complete_case", "multiple_imputation", "fiml", "mean_substitution"]
AnalysisExecutionStatus = Literal["queued", "running", "completed", "failed", "cancelled"]


class VariableCategoryStat(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    value: str
    count: int
    percentage: float


class VariableSummaryStats(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    min: Optional[float] = None
    max: Optional[float] = None
    mean: Optional[float] = None
    median: Optional[float] = None
    sd: Optional[float] = None
    q1: Optional[float] = None
    q3: Optional[float] = None
    mode: Optional[Union[str, float]] = None
    categories: Optional[List[VariableCategoryStat]] = None


class VariableDefinition(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    label: str
    data_type: VariableDataType = Field(..., alias="dataType")
    role: VariableRole
    missing_count: int = Field(0, alias="missingCount")
    missing_percentage: float = Field(0.0, alias="missingPercentage")
    unique_values_count: int = Field(0, alias="uniqueValuesCount")
    summary_stats: Optional[VariableSummaryStats] = Field(None, alias="summaryStats")
    question_code: Optional[str] = Field(None, alias="questionCode")
    unit: Optional[str] = None


class DatasetSnapshotCreateRequest(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    study_id: uuid.UUID = Field(..., alias="studyId")
    name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    questionnaire_id: Optional[uuid.UUID] = Field(None, alias="questionnaireId")


class DatasetSnapshotResponse(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    study_id: uuid.UUID = Field(..., alias="studyId")
    study_title: Optional[str] = Field(None, alias="studyTitle")
    name: str
    snapshot_date: datetime = Field(..., alias="snapshotDate")
    record_count: int = Field(..., alias="recordCount")
    variable_count: int = Field(..., alias="variableCount")
    questionnaire_version: str = Field(..., alias="questionnaireVersion")
    is_frozen: bool = Field(True, alias="isFrozen")
    frozen_by: Optional[str] = Field(None, alias="frozenBy")
    frozen_at: Optional[datetime] = Field(None, alias="frozenAt")
    description: Optional[str] = None
    data_quality_score: Optional[float] = Field(None, alias="dataQualityScore")


class AnalysisMethodSupportedTypes(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    dependent: List[VariableDataType] = Field(default_factory=list)
    independent: List[VariableDataType] = Field(default_factory=list)


class AnalysisMethodResponse(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    category: Literal["Descriptive", "Comparison", "Regression", "Survival", "Advanced"]
    description: str
    supported_variable_types: AnalysisMethodSupportedTypes = Field(..., alias="supportedVariableTypes")
    requires_covariates: Optional[bool] = Field(False, alias="requiresCovariates")
    assumptions_tested: List[str] = Field(default_factory=list, alias="assumptionsTested")
    is_approved_in_sap: bool = Field(True, alias="isApprovedInSap")
    sap_reference_section: Optional[str] = Field(None, alias="sapReferenceSection")


class TestOptions(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    alternative_hypothesis: Optional[Literal["two_sided", "greater", "less"]] = Field(
        "two_sided", alias="alternativeHypothesis"
    )
    equal_variances_assumed: Optional[bool] = Field(True, alias="equalVariancesAssumed")
    reference_group: Optional[str] = Field(None, alias="referenceGroup")


class AnalysisRunConfig(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    study_id: uuid.UUID = Field(..., alias="studyId")
    dataset_snapshot_id: uuid.UUID = Field(..., alias="datasetSnapshotId")
    method_id: str = Field(..., alias="methodId")
    dependent_variable: str = Field(..., alias="dependentVariable")
    independent_variables: List[str] = Field(default_factory=list, alias="independentVariables")
    covariates: Optional[List[str]] = Field(default_factory=list)
    stratify_by: Optional[str] = Field(None, alias="stratifyBy")
    confidence_level: float = Field(95.0, ge=50.0, le=99.9, alias="confidenceLevel")
    handle_missing: MissingDataHandlingMethod = Field("complete_case", alias="handleMissing")
    test_options: Optional[TestOptions] = Field(default_factory=TestOptions, alias="testOptions")


class AnalysisRunExecutor(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    email: str


class AnalysisRunResponse(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    study_id: uuid.UUID = Field(..., alias="studyId")
    study_title: Optional[str] = Field(None, alias="studyTitle")
    dataset_snapshot_id: uuid.UUID = Field(..., alias="datasetSnapshotId")
    dataset_snapshot_name: Optional[str] = Field(None, alias="datasetSnapshotName")
    questionnaire_version: Optional[str] = Field(None, alias="questionnaireVersion")
    method_id: str = Field(..., alias="methodId")
    method_name: Optional[str] = Field(None, alias="methodName")
    config: AnalysisRunConfig
    status: AnalysisExecutionStatus
    progress_percent: int = Field(0, alias="progressPercent")
    status_message: Optional[str] = Field(None, alias="statusMessage")
    error_message: Optional[str] = Field(None, alias="errorMessage")
    queued_at: datetime = Field(..., alias="queuedAt")
    started_at: Optional[datetime] = Field(None, alias="startedAt")
    completed_at: Optional[datetime] = Field(None, alias="completedAt")
    executed_by: AnalysisRunExecutor = Field(..., alias="executedBy")
    duration_seconds: Optional[float] = Field(None, alias="durationSeconds")


class StatisticalEstimate(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    parameter: str
    estimate: float
    std_error: float = Field(..., alias="stdError")
    statistic: float
    statistic_name: str = Field(..., alias="statisticName")
    degrees_of_freedom: Optional[Union[float, List[float]]] = Field(None, alias="degreesOfFreedom")
    p_value: float = Field(..., alias="pValue")
    ci_lower: float = Field(..., alias="ciLower")
    ci_upper: float = Field(..., alias="ciUpper")
    significant: bool


class AssumptionWarning(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    assumption: str
    test_used: Optional[str] = Field(None, alias="testUsed")
    test_statistic: Optional[float] = Field(None, alias="testStatistic")
    p_value: Optional[float] = Field(None, alias="pValue")
    severity: Literal["warning", "violation", "info"]
    message: str
    recommendation: Optional[str] = None


class DistributionDataPoint(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    bucket: str
    observed_count: int = Field(..., alias="observedCount")
    expected_count: Optional[float] = Field(None, alias="expectedCount")
    frequency: Optional[float] = None
    group: Optional[str] = None


class ScatterPlotDataPoint(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    x: float
    y: float
    predicted: Optional[float] = None
    residual: Optional[float] = None
    group: Optional[str] = None


class SurvivalDataPoint(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    time: float
    survival_prob: float = Field(..., alias="survivalProb")
    ci_lower: Optional[float] = Field(None, alias="ciLower")
    ci_upper: Optional[float] = Field(None, alias="ciUpper")
    group: str
    at_risk: int = Field(..., alias="atRisk")
    events: int


class AiStatisticalExplanation(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    summary: str
    clinical_interpretation: str = Field(..., alias="clinicalInterpretation")
    limitations: List[str] = Field(default_factory=list)
    plain_language_summary: str = Field(..., alias="plainLanguageSummary")
    confidence_note: str = Field(..., alias="confidenceNote")
    verified_against_protocol: bool = Field(True, alias="verifiedAgainstProtocol")
    generated_at: datetime = Field(..., alias="generatedAt")


class TestStatisticObj(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    value: float


class EffectSizeObj(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    value: float
    ci_lower: Optional[float] = Field(None, alias="ciLower")
    ci_upper: Optional[float] = Field(None, alias="ciUpper")
    interpretation: Optional[str] = None


class ConfidenceIntervalObj(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    level: float
    lower: float
    upper: float


class StatisticalResultResponse(BaseSchema):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    run_id: uuid.UUID = Field(..., alias="runId")
    study_id: uuid.UUID = Field(..., alias="studyId")
    study_title: Optional[str] = Field(None, alias="studyTitle")
    dataset_snapshot_id: uuid.UUID = Field(..., alias="datasetSnapshotId")
    method_id: str = Field(..., alias="methodId")
    sample_size: int = Field(..., alias="sampleSize")
    excluded_count: int = Field(0, alias="excludedCount")
    missingness_handled: MissingDataHandlingMethod = Field(..., alias="missingnessHandled")
    degrees_of_freedom: Optional[Union[float, List[float]]] = Field(None, alias="degreesOfFreedom")
    test_statistic: Optional[TestStatisticObj] = Field(None, alias="testStatistic")
    p_value: Optional[float] = Field(None, alias="pValue")
    effect_size: Optional[EffectSizeObj] = Field(None, alias="effectSize")
    confidence_interval: Optional[ConfidenceIntervalObj] = Field(None, alias="confidenceInterval")
    estimates_table: Optional[List[StatisticalEstimate]] = Field(None, alias="estimatesTable")
    assumption_warnings: List[AssumptionWarning] = Field(default_factory=list, alias="assumptionWarnings")
    distribution_data: Optional[List[DistributionDataPoint]] = Field(None, alias="distributionData")
    scatter_plot_data: Optional[List[ScatterPlotDataPoint]] = Field(None, alias="scatterPlotData")
    survival_data: Optional[List[SurvivalDataPoint]] = Field(None, alias="survivalData")
    ai_explanation: Optional[AiStatisticalExplanation] = Field(None, alias="aiExplanation")
    generated_at: datetime = Field(..., alias="generatedAt")


class VariableQualityItem(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    variable_name: str = Field(..., alias="variableName")
    label: str
    data_type: VariableDataType = Field(..., alias="dataType")
    total_count: int = Field(..., alias="totalCount")
    valid_count: int = Field(..., alias="validCount")
    missing_count: int = Field(..., alias="missingCount")
    missing_percentage: float = Field(..., alias="missingPercentage")
    outlier_count: Optional[int] = Field(0, alias="outlierCount")
    has_patterned_missingness: Optional[bool] = Field(False, alias="hasPatternedMissingness")
    pattern_notes: Optional[str] = Field(None, alias="patternNotes")


class MissingnessPattern(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    pattern_id: str = Field(..., alias="patternId")
    variable_names: List[str] = Field(default_factory=list, alias="variableNames")
    affected_records: int = Field(..., alias="affectedRecords")
    percentage: float
    mechanism_candidate: Optional[Literal["MCAR", "MAR", "MNAR"]] = Field(None, alias="mechanismCandidate")


class DataQualityReportResponse(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    study_id: uuid.UUID = Field(..., alias="studyId")
    dataset_snapshot_id: uuid.UUID = Field(..., alias="datasetSnapshotId")
    dataset_snapshot_name: Optional[str] = Field(None, alias="datasetSnapshotName")
    generated_at: datetime = Field(..., alias="generatedAt")
    total_records: int = Field(..., alias="totalRecords")
    total_variables: int = Field(..., alias="totalVariables")
    overall_missingness_percentage: float = Field(..., alias="overallMissingnessPercentage")
    complete_cases_count: int = Field(..., alias="completeCasesCount")
    complete_cases_percentage: float = Field(..., alias="completeCasesPercentage")
    variables_quality: List[VariableQualityItem] = Field(default_factory=list, alias="variablesQuality")
    missingness_patterns: Optional[List[MissingnessPattern]] = Field(default_factory=list, alias="missingnessPatterns")
    recommendations: List[str] = Field(default_factory=list)

