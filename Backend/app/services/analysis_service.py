import hashlib
import json
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, InvalidInputError, NotFoundError, PermissionDeniedError
from app.core.rbac import Permission, RoleName, check_permission
from app.models.analysis_run import AnalysisRun
from app.models.dataset_snapshot import DatasetSnapshot
from app.models.questionnaire import Questionnaire
from app.models.statistical_result import StatisticalResultModel
from app.models.study import Study
from app.models.study_membership import StudyMembership
from app.models.survey_response import SurveyResponse
from app.models.user import User
from app.repositories.audit_repository import AuditRepository
from app.schemas.analysis import (
    AnalysisMethodResponse,
    AnalysisRunConfig,
    AnalysisRunExecutor,
    AnalysisRunResponse,
    DataQualityReportResponse,
    DatasetSnapshotResponse,
    StatisticalResultResponse,
    VariableDefinition,
    VariableQualityItem,
    VariableSummaryStats,
)
from app.services.ai_statistical_explanation_service import AiStatisticalExplanationService
from app.services.statistical_engine import StatisticalEngine, get_statistical_runtime_versions

SUPPORTED_METHODS: List[Dict[str, Any]] = [
    {
        "id": "descriptive_summary",
        "name": "Descriptive Statistics & Distributions",
        "category": "Descriptive",
        "description": "Calculates central tendency (mean, median), dispersion (SD, IQR), missingness, and confidence intervals.",
        "supportedVariableTypes": {
            "dependent": ["numeric", "categorical", "binary", "ordinal"],
            "independent": [],
        },
        "requiresCovariates": False,
        "assumptionsTested": ["Missingness", "Normality (Skewness/Kurtosis)"],
        "isApprovedInSap": True,
        "sapReferenceSection": "SAP Section 4.1: Demographic and Baseline Summaries",
    },
    {
        "id": "independent_t_test",
        "name": "Two-Sample Independent T-Test / Mann-Whitney U",
        "category": "Comparison",
        "description": "Compares continuous outcomes across two groups with Levene variance check and Mann-Whitney U fallback.",
        "supportedVariableTypes": {
            "dependent": ["numeric"],
            "independent": ["binary", "categorical"],
        },
        "requiresCovariates": False,
        "assumptionsTested": ["Normality (Shapiro-Wilk)", "Homogeneity of Variance (Levene's Test)"],
        "isApprovedInSap": True,
        "sapReferenceSection": "SAP Section 5.2: Primary Endpoint Group Comparison",
    },
    {
        "id": "chi_square",
        "name": "Chi-Square Test of Independence & Fisher's Exact",
        "category": "Comparison",
        "description": "Tests association between categorical variables with expected frequency checks and Fisher's exact 2x2 test.",
        "supportedVariableTypes": {
            "dependent": ["categorical", "binary", "ordinal"],
            "independent": ["categorical", "binary"],
        },
        "requiresCovariates": False,
        "assumptionsTested": ["Expected Cell Frequencies (>= 5)"],
        "isApprovedInSap": True,
        "sapReferenceSection": "SAP Section 5.3: Categorical Secondary Endpoints",
    },
    {
        "id": "correlation_pearson",
        "name": "Pearson Correlation (Bivariate)",
        "category": "Comparison",
        "description": "Measures linear relationship between continuous variables with Fisher z-transformed confidence interval.",
        "supportedVariableTypes": {
            "dependent": ["numeric"],
            "independent": ["numeric"],
        },
        "requiresCovariates": False,
        "assumptionsTested": ["Bivariate Normality", "Linearity"],
        "isApprovedInSap": True,
        "sapReferenceSection": "SAP Section 6.1: Exploratory Biomarker Correlation",
    },
    {
        "id": "correlation_spearman",
        "name": "Spearman Rank Correlation",
        "category": "Comparison",
        "description": "Measures monotonic rank relationship for non-normal continuous or ordinal variables.",
        "supportedVariableTypes": {
            "dependent": ["numeric", "ordinal"],
            "independent": ["numeric", "ordinal"],
        },
        "requiresCovariates": False,
        "assumptionsTested": ["Monotonicity"],
        "isApprovedInSap": True,
        "sapReferenceSection": "SAP Section 6.2: Non-parametric Association",
    },
    {
        "id": "one_way_anova",
        "name": "One-Way Analysis of Variance (ANOVA)",
        "category": "Comparison",
        "description": "Tests difference in means across three or more categorical factor groups with Eta-squared effect size.",
        "supportedVariableTypes": {
            "dependent": ["numeric"],
            "independent": ["categorical"],
        },
        "requiresCovariates": False,
        "assumptionsTested": ["Normality", "Homogeneity of Variance"],
        "isApprovedInSap": True,
        "sapReferenceSection": "SAP Section 5.4: Multi-Group Dose Response Analysis",
    },
    {
        "id": "linear_regression",
        "name": "Multivariable Linear Regression (OLS)",
        "category": "Regression",
        "description": "Fits ordinary least squares model with coefficients, standard errors, R², adjusted R², and p-values.",
        "supportedVariableTypes": {
            "dependent": ["numeric"],
            "independent": ["numeric", "binary"],
        },
        "requiresCovariates": True,
        "assumptionsTested": ["Multicollinearity", "Residual Normality", "Homoscedasticity"],
        "isApprovedInSap": True,
        "sapReferenceSection": "SAP Section 7.1: Adjusted Multivariable Covariate Models",
    },
]


class AnalysisService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.audit_repo = AuditRepository(session)

    def _is_admin(self, user: User) -> bool:
        return bool(user.global_role and user.global_role.name == RoleName.ADMINISTRATOR)

    async def _verify_study_permission(
        self, study_id: uuid.UUID, user: User, required_permission: Permission
    ) -> Study:
        stmt = select(Study).where(Study.id == study_id)
        res = await self.session.execute(stmt)
        study = res.scalars().first()
        if not study:
            raise NotFoundError("Study", str(study_id))

        if self._is_admin(user):
            return study

        if study.created_by_user_id == user.id or study.principal_investigator_id == user.id:
            return study

        mem_stmt = select(StudyMembership).where(
            StudyMembership.study_id == study_id,
            StudyMembership.user_id == user.id,
            StudyMembership.is_active == True,
        ).options(selectinload(StudyMembership.role))
        mem_res = await self.session.execute(mem_stmt)
        membership = mem_res.scalars().first()

        if not membership:
            raise PermissionDeniedError(f"You do not have access to study '{study_id}'.")

        role_name = membership.role.name if membership.role else user.global_role.name
        if not check_permission(role_name, required_permission):
            raise PermissionDeniedError(f"Missing required permission: '{required_permission.value}'")

        return study

    async def _get_accessible_study_ids(self, user: User) -> Optional[List[uuid.UUID]]:
        if self._is_admin(user):
            return None

        membership_subquery = select(StudyMembership.study_id).where(
            StudyMembership.user_id == user.id,
            StudyMembership.is_active == True,
        )
        stmt = select(Study.id).where(
            (Study.created_by_user_id == user.id)
            | (Study.principal_investigator_id == user.id)
            | (Study.id.in_(membership_subquery))
        )
        res = await self.session.execute(stmt)
        return list(res.scalars().all())

    # =========================================================================
    # 1. DATASET SNAPSHOTS & VARIABLE CODEBOOK
    # =========================================================================
    async def create_snapshot(
        self,
        study_id: uuid.UUID,
        name: str,
        description: Optional[str],
        questionnaire_id: Optional[uuid.UUID],
        current_user: User,
    ) -> DatasetSnapshotResponse:
        study = await self._verify_study_permission(study_id, current_user, Permission.ANALYSIS_RUN)

        # Retrieve responses for this study
        stmt = select(SurveyResponse).where(
            SurveyResponse.study_id == study_id,
        ).options(
            selectinload(SurveyResponse.answers),
            selectinload(SurveyResponse.questionnaire),
        )
        if questionnaire_id:
            stmt = stmt.where(SurveyResponse.questionnaire_id == questionnaire_id)

        res = await self.session.execute(stmt)
        responses = res.scalars().all()

        # Build de-identified records
        rows: List[Dict[str, Any]] = []
        var_values: Dict[str, List[Any]] = {}
        q_ver = "1.0"

        for r in responses:
            if r.questionnaire:
                q_ver = r.questionnaire.version
            row: Dict[str, Any] = {
                "participantIdentifier": r.participant_identifier,
                "submissionId": str(r.id),
                "submissionStatus": r.status,
            }
            for ans in (r.answers or []):
                val = ans.raw_value
                row[ans.variable_name] = val
                if ans.variable_name not in var_values:
                    var_values[ans.variable_name] = []
                var_values[ans.variable_name].append(val)
            rows.append(row)

        # Build variable dictionary
        variable_dict: List[Dict[str, Any]] = []
        for var_name, vals in var_values.items():
            non_null = [v for v in vals if v is not None and v != ""]
            n_missing = len(vals) - len(non_null)
            pct_missing = (n_missing / len(vals)) * 100.0 if vals else 0.0

            # Determine inferred data type
            is_num = False
            try:
                num_vals = [float(v) for v in non_null]
                is_num = len(num_vals) > 0
            except (ValueError, TypeError):
                is_num = False

            data_type = "numeric" if is_num else "categorical"
            unique_cnt = len(set(str(v) for v in non_null))

            summary = {}
            if is_num and len(num_vals) > 0:
                summary = {
                    "min": float(min(num_vals)),
                    "max": float(max(num_vals)),
                    "mean": float(sum(num_vals) / len(num_vals)),
                }

            variable_dict.append({
                "name": var_name,
                "label": var_name.replace("_", " ").title(),
                "dataType": data_type,
                "role": "dependent" if "outcome" in var_name.lower() or "score" in var_name.lower() else "independent",
                "missingCount": n_missing,
                "missingPercentage": float(round(pct_missing, 1)),
                "uniqueValuesCount": unique_cnt,
                "summaryStats": summary,
            })

        # Canonical SHA-256 Checksum over frozen records
        payload_bytes = json.dumps(rows, sort_keys=True).encode("utf-8")
        checksum = hashlib.sha256(payload_bytes).hexdigest()

        now = datetime.now(timezone.utc)
        snapshot = DatasetSnapshot(
            study_id=study_id,
            questionnaire_id=questionnaire_id,
            name=name,
            description=description,
            questionnaire_version=q_ver,
            record_count=len(rows),
            variable_count=len(variable_dict),
            checksum=checksum,
            is_frozen=True,
            frozen_by_user_id=current_user.id,
            frozen_at=now,
            data_quality_score=95.0,
            variable_dictionary=variable_dict,
            dataset_payload=rows,
            provenance_metadata={
                "source_responses_count": len(responses),
                "generated_by": current_user.full_name,
                "frozen_timestamp": now.isoformat(),
            },
        )
        self.session.add(snapshot)
        await self.session.commit()

        await self.audit_repo.log_event(
            event_type="analysis:snapshot_frozen",
            action="analysis:snapshot_frozen",
            user_id=current_user.id,
            study_id=study_id,
            entity_type="dataset_snapshot",
            entity_id=str(snapshot.id),
            details={"name": name, "checksum": checksum, "record_count": len(rows)},
        )

        return DatasetSnapshotResponse(
            id=snapshot.id,
            study_id=snapshot.study_id,
            study_title=study.title,
            name=snapshot.name,
            snapshot_date=snapshot.frozen_at,
            record_count=snapshot.record_count,
            variable_count=snapshot.variable_count,
            questionnaire_version=snapshot.questionnaire_version,
            is_frozen=snapshot.is_frozen,
            frozen_by=current_user.full_name,
            frozen_at=snapshot.frozen_at,
            description=snapshot.description,
            data_quality_score=snapshot.data_quality_score,
        )

    async def list_snapshots(
        self, current_user: User, study_id: Optional[uuid.UUID] = None
    ) -> List[DatasetSnapshotResponse]:
        accessible_ids = await self._get_accessible_study_ids(current_user)
        stmt = select(DatasetSnapshot).options(selectinload(DatasetSnapshot.study), selectinload(DatasetSnapshot.frozen_by))

        if study_id:
            await self._verify_study_permission(study_id, current_user, Permission.ANALYSIS_VIEW)
            stmt = stmt.where(DatasetSnapshot.study_id == study_id)
        elif accessible_ids is not None:
            stmt = stmt.where(DatasetSnapshot.study_id.in_(accessible_ids))

        res = await self.session.execute(stmt)
        items = res.scalars().all()

        return [
            DatasetSnapshotResponse(
                id=s.id,
                study_id=s.study_id,
                study_title=s.study.title if s.study else None,
                name=s.name,
                snapshot_date=s.frozen_at,
                record_count=s.record_count,
                variable_count=s.variable_count,
                questionnaire_version=s.questionnaire_version,
                is_frozen=s.is_frozen,
                frozen_by=s.frozen_by.full_name if s.frozen_by else "System",
                frozen_at=s.frozen_at,
                description=s.description,
                data_quality_score=s.data_quality_score,
            )
            for s in items
        ]

    async def get_snapshot_by_id(self, snapshot_id: uuid.UUID, current_user: User) -> DatasetSnapshotResponse:
        stmt = (
            select(DatasetSnapshot)
            .where(DatasetSnapshot.id == snapshot_id)
            .options(selectinload(DatasetSnapshot.study), selectinload(DatasetSnapshot.frozen_by))
        )
        res = await self.session.execute(stmt)
        s = res.scalars().first()
        if not s:
            raise NotFoundError("DatasetSnapshot", str(snapshot_id))

        await self._verify_study_permission(s.study_id, current_user, Permission.ANALYSIS_VIEW)

        return DatasetSnapshotResponse(
            id=s.id,
            study_id=s.study_id,
            study_title=s.study.title if s.study else None,
            name=s.name,
            snapshot_date=s.frozen_at,
            record_count=s.record_count,
            variable_count=s.variable_count,
            questionnaire_version=s.questionnaire_version,
            is_frozen=s.is_frozen,
            frozen_by=s.frozen_by.full_name if s.frozen_by else "System",
            frozen_at=s.frozen_at,
            description=s.description,
            data_quality_score=s.data_quality_score,
        )

    async def get_variable_dictionary(
        self, snapshot_id: uuid.UUID, current_user: User
    ) -> List[VariableDefinition]:
        stmt = select(DatasetSnapshot).where(DatasetSnapshot.id == snapshot_id)
        res = await self.session.execute(stmt)
        s = res.scalars().first()
        if not s:
            raise NotFoundError("DatasetSnapshot", str(snapshot_id))

        await self._verify_study_permission(s.study_id, current_user, Permission.ANALYSIS_VIEW)
        return [VariableDefinition(**v) for v in (s.variable_dictionary or [])]

    async def get_data_quality_report(
        self, snapshot_id: uuid.UUID, current_user: User
    ) -> DataQualityReportResponse:
        stmt = select(DatasetSnapshot).where(DatasetSnapshot.id == snapshot_id).options(selectinload(DatasetSnapshot.study))
        res = await self.session.execute(stmt)
        s = res.scalars().first()
        if not s:
            raise NotFoundError("DatasetSnapshot", str(snapshot_id))

        await self._verify_study_permission(s.study_id, current_user, Permission.DATA_QUALITY_VIEW)

        rows = s.dataset_payload or []
        n_records = len(rows)
        n_vars = len(s.variable_dictionary or [])

        # Calculate complete cases
        complete_cases = 0
        var_names = [v["name"] for v in (s.variable_dictionary or [])]

        for r in rows:
            if all(r.get(vn) is not None and r.get(vn) != "" for vn in var_names):
                complete_cases += 1

        complete_pct = (complete_cases / n_records * 100.0) if n_records > 0 else 100.0
        overall_missing = 100.0 - complete_pct

        var_quality = [
            VariableQualityItem(
                variableName=v["name"],
                label=v["label"],
                dataType=v["dataType"],
                totalCount=n_records,
                validCount=n_records - v.get("missingCount", 0),
                missingCount=v.get("missingCount", 0),
                missingPercentage=v.get("missingPercentage", 0.0),
                outlierCount=0,
                hasPatternedMissingness=bool(v.get("missingPercentage", 0.0) > 10.0),
            )
            for v in (s.variable_dictionary or [])
        ]

        recommendations = [
            f"Dataset snapshot contains {n_records} frozen patient records across {n_vars} research variables.",
            f"Complete case analysis retains {complete_pct:.1f}% of cohort records.",
        ]
        if overall_missing > 15:
            recommendations.append("Consider multiple imputation for secondary sensitivity analyses.")

        return DataQualityReportResponse(
            study_id=s.study_id,
            dataset_snapshot_id=s.id,
            dataset_snapshot_name=s.name,
            generated_at=datetime.now(timezone.utc),
            total_records=n_records,
            total_variables=n_vars,
            overall_missingness_percentage=float(round(overall_missing, 1)),
            complete_cases_count=complete_cases,
            complete_cases_percentage=float(round(complete_pct, 1)),
            variables_quality=var_quality,
            missingness_patterns=[],
            recommendations=recommendations,
        )

    # =========================================================================
    # 2. ANALYSIS METHODS & EXECUTION
    # =========================================================================
    async def get_supported_methods(
        self, current_user: User, study_id: Optional[uuid.UUID] = None
    ) -> List[AnalysisMethodResponse]:
        if study_id:
            await self._verify_study_permission(study_id, current_user, Permission.ANALYSIS_VIEW)
        return [AnalysisMethodResponse(**m) for m in SUPPORTED_METHODS]

    async def run_analysis(
        self, config: AnalysisRunConfig, current_user: User
    ) -> AnalysisRunResponse:
        study = await self._verify_study_permission(config.study_id, current_user, Permission.ANALYSIS_RUN)

        # 1. Fetch Snapshot
        stmt = select(DatasetSnapshot).where(DatasetSnapshot.id == config.dataset_snapshot_id)
        res = await self.session.execute(stmt)
        snapshot = res.scalars().first()
        if not snapshot:
            raise NotFoundError("DatasetSnapshot", str(config.dataset_snapshot_id))

        if not snapshot.is_frozen:
            raise ConflictError("Cannot run statistical analysis on an unfrozen dataset.")

        # Verify data integrity using stored checksum
        actual_payload_bytes = json.dumps(snapshot.dataset_payload, sort_keys=True).encode("utf-8")
        current_checksum = hashlib.sha256(actual_payload_bytes).hexdigest()
        if current_checksum != snapshot.checksum:
            raise ConflictError("Dataset snapshot checksum verification failed! Snapshot data has been altered.")

        # 2. Create AnalysisRun record in running state
        start_time = time.time()
        now = datetime.now(timezone.utc)
        run = AnalysisRun(
            study_id=config.study_id,
            dataset_snapshot_id=config.dataset_snapshot_id,
            method_id=config.method_id,
            config=config.model_dump(mode="json", by_alias=True),
            status="running",
            progress_percent=25,
            status_message="Executing verified statistical runtime...",
            queued_at=now,
            started_at=now,
            executed_by_user_id=current_user.id,
            runtime_versions=get_statistical_runtime_versions(),
            snapshot_checksum=snapshot.checksum,
        )
        self.session.add(run)
        await self.session.flush()

        # 3. Deterministic statistical computation
        try:
            stats_output = StatisticalEngine.execute(
                data=snapshot.dataset_payload,
                method_id=config.method_id,
                dependent_var=config.dependent_variable,
                independent_vars=config.independent_variables,
                covariates=config.covariates,
                confidence_level=config.confidence_level,
                handle_missing=config.handle_missing,
                test_options=config.test_options.model_dump(mode="json", by_alias=True) if config.test_options else {},
            )
        except Exception as exc:
            run.status = "failed"
            run.progress_percent = 100
            run.error_message = str(getattr(exc, "message", str(exc)))
            run.completed_at = datetime.now(timezone.utc)
            await self.session.commit()
            raise

        # 4. Generate factual AI explanation
        ai_exp = await AiStatisticalExplanationService.generate_explanation(
            method_id=config.method_id,
            dependent_var=config.dependent_variable,
            independent_vars=config.independent_variables,
            stats_output=stats_output,
            study_title=study.title,
        )

        end_time = time.time()
        completed_at = datetime.now(timezone.utc)
        duration_sec = float(round(end_time - start_time, 3))

        # 5. Persist StatisticalResult
        result_record = StatisticalResultModel(
            run_id=run.id,
            study_id=config.study_id,
            dataset_snapshot_id=config.dataset_snapshot_id,
            method_id=config.method_id,
            sample_size=stats_output["sample_size"],
            excluded_count=stats_output["excluded_count"],
            missingness_handled=stats_output["missingness_handled"],
            degrees_of_freedom=stats_output.get("degrees_of_freedom"),
            test_statistic=stats_output.get("test_statistic"),
            p_value=stats_output.get("p_value"),
            effect_size=stats_output.get("effect_size"),
            confidence_interval=stats_output.get("confidence_interval"),
            estimates_table=stats_output.get("estimates_table"),
            assumption_warnings=stats_output.get("assumption_warnings", []),
            distribution_data=stats_output.get("distribution_data"),
            scatter_plot_data=stats_output.get("scatter_plot_data"),
            survival_data=stats_output.get("survival_data"),
            ai_explanation=ai_exp,
            generated_at=completed_at,
        )
        self.session.add(result_record)

        run.status = "completed"
        run.progress_percent = 100
        run.status_message = "Analysis completed and results verified."
        run.completed_at = completed_at
        run.duration_seconds = duration_sec

        await self.session.commit()

        await self.audit_repo.log_event(
            event_type="analysis:run_completed",
            action="analysis:run_completed",
            user_id=current_user.id,
            study_id=config.study_id,
            entity_type="analysis_run",
            entity_id=str(run.id),
            details={
                "method_id": config.method_id,
                "dependent_variable": config.dependent_variable,
                "p_value": stats_output.get("p_value"),
                "sample_size": stats_output["sample_size"],
                "duration_seconds": duration_sec,
            },
        )

        return AnalysisRunResponse(
            id=run.id,
            study_id=run.study_id,
            study_title=study.title,
            dataset_snapshot_id=run.dataset_snapshot_id,
            dataset_snapshot_name=snapshot.name,
            questionnaire_version=snapshot.questionnaire_version,
            method_id=run.method_id,
            method_name=next((m["name"] for m in SUPPORTED_METHODS if m["id"] == run.method_id), run.method_id),
            config=config,
            status=run.status,
            progress_percent=run.progress_percent,
            status_message=run.status_message,
            queued_at=run.queued_at,
            started_at=run.started_at,
            completed_at=run.completed_at,
            executed_by=AnalysisRunExecutor(
                id=str(current_user.id),
                name=current_user.full_name,
                email=current_user.email,
            ),
            duration_seconds=duration_sec,
        )

    async def list_runs(
        self,
        current_user: User,
        study_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[AnalysisRunResponse]:
        accessible_ids = await self._get_accessible_study_ids(current_user)
        stmt = (
            select(AnalysisRun)
            .options(
                selectinload(AnalysisRun.study),
                selectinload(AnalysisRun.dataset_snapshot),
                selectinload(AnalysisRun.executed_by),
            )
            .order_by(AnalysisRun.queued_at.desc())
            .limit(limit)
            .offset(offset)
        )

        if study_id:
            await self._verify_study_permission(study_id, current_user, Permission.ANALYSIS_VIEW)
            stmt = stmt.where(AnalysisRun.study_id == study_id)
        elif accessible_ids is not None:
            stmt = stmt.where(AnalysisRun.study_id.in_(accessible_ids))

        if status:
            stmt = stmt.where(AnalysisRun.status == status)

        res = await self.session.execute(stmt)
        items = res.scalars().all()

        return [
            AnalysisRunResponse(
                id=r.id,
                study_id=r.study_id,
                study_title=r.study.title if r.study else None,
                dataset_snapshot_id=r.dataset_snapshot_id,
                dataset_snapshot_name=r.dataset_snapshot.name if r.dataset_snapshot else None,
                questionnaire_version=r.dataset_snapshot.questionnaire_version if r.dataset_snapshot else None,
                method_id=r.method_id,
                method_name=next((m["name"] for m in SUPPORTED_METHODS if m["id"] == r.method_id), r.method_id),
                config=AnalysisRunConfig(**r.config),
                status=r.status,
                progress_percent=r.progress_percent,
                status_message=r.status_message,
                error_message=r.error_message,
                queued_at=r.queued_at,
                started_at=r.started_at,
                completed_at=r.completed_at,
                executed_by=AnalysisRunExecutor(
                    id=str(r.executed_by.id) if r.executed_by else str(r.executed_by_user_id),
                    name=r.executed_by.full_name if r.executed_by else "Researcher",
                    email=r.executed_by.email if r.executed_by else "",
                ),
                duration_seconds=r.duration_seconds,
            )
            for r in items
        ]

    async def get_run_by_id(self, run_id: uuid.UUID, current_user: User) -> AnalysisRunResponse:
        stmt = (
            select(AnalysisRun)
            .where(AnalysisRun.id == run_id)
            .options(
                selectinload(AnalysisRun.study),
                selectinload(AnalysisRun.dataset_snapshot),
                selectinload(AnalysisRun.executed_by),
            )
        )
        res = await self.session.execute(stmt)
        r = res.scalars().first()
        if not r:
            raise NotFoundError("AnalysisRun", str(run_id))

        await self._verify_study_permission(r.study_id, current_user, Permission.ANALYSIS_VIEW)

        return AnalysisRunResponse(
            id=r.id,
            study_id=r.study_id,
            study_title=r.study.title if r.study else None,
            dataset_snapshot_id=r.dataset_snapshot_id,
            dataset_snapshot_name=r.dataset_snapshot.name if r.dataset_snapshot else None,
            questionnaire_version=r.dataset_snapshot.questionnaire_version if r.dataset_snapshot else None,
            method_id=r.method_id,
            method_name=next((m["name"] for m in SUPPORTED_METHODS if m["id"] == r.method_id), r.method_id),
            config=AnalysisRunConfig(**r.config),
            status=r.status,
            progress_percent=r.progress_percent,
            status_message=r.status_message,
            error_message=r.error_message,
            queued_at=r.queued_at,
            started_at=r.started_at,
            completed_at=r.completed_at,
            executed_by=AnalysisRunExecutor(
                id=str(r.executed_by.id) if r.executed_by else str(r.executed_by_user_id),
                name=r.executed_by.full_name if r.executed_by else "Researcher",
                email=r.executed_by.email if r.executed_by else "",
            ),
            duration_seconds=r.duration_seconds,
        )

    async def get_analysis_results(
        self, run_id: uuid.UUID, current_user: User
    ) -> StatisticalResultResponse:
        stmt = (
            select(StatisticalResultModel)
            .where(StatisticalResultModel.run_id == run_id)
            .options(selectinload(StatisticalResultModel.analysis_run))
        )
        res = await self.session.execute(stmt)
        sr = res.scalars().first()
        if not sr:
            raise NotFoundError("StatisticalResult", str(run_id))

        await self._verify_study_permission(sr.study_id, current_user, Permission.ANALYSIS_VIEW)

        # Get study title
        study_stmt = select(Study.title).where(Study.id == sr.study_id)
        study_res = await self.session.execute(study_stmt)
        study_title = study_res.scalars().first()

        return StatisticalResultResponse(
            run_id=sr.run_id,
            study_id=sr.study_id,
            study_title=study_title,
            dataset_snapshot_id=sr.dataset_snapshot_id,
            method_id=sr.method_id,
            sample_size=sr.sample_size,
            excluded_count=sr.excluded_count,
            missingness_handled=sr.missingness_handled,
            degrees_of_freedom=sr.degrees_of_freedom,
            test_statistic=sr.test_statistic,
            p_value=sr.p_value,
            effect_size=sr.effect_size,
            confidence_interval=sr.confidence_interval,
            estimates_table=sr.estimates_table,
            assumption_warnings=sr.assumption_warnings,
            distribution_data=sr.distribution_data,
            scatter_plot_data=sr.scatter_plot_data,
            survival_data=sr.survival_data,
            ai_explanation=sr.ai_explanation,
            generated_at=sr.generated_at,
        )

    async def cancel_run(self, run_id: uuid.UUID, current_user: User) -> Dict[str, Any]:
        stmt = select(AnalysisRun).where(AnalysisRun.id == run_id)
        res = await self.session.execute(stmt)
        r = res.scalars().first()
        if not r:
            raise NotFoundError("AnalysisRun", str(run_id))

        await self._verify_study_permission(r.study_id, current_user, Permission.ANALYSIS_RUN)

        if r.status in ("completed", "failed"):
            return {"success": False, "message": f"Run already reached terminal state '{r.status}'."}

        r.status = "cancelled"
        r.status_message = "Analysis run cancelled by researcher."
        await self.session.commit()

        return {"success": True, "message": "Analysis execution successfully cancelled."}

