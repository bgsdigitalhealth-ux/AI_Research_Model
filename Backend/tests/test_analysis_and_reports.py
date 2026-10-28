import io
import uuid
import pytest
from httpx import AsyncClient

from app.models.user import User


def get_error_message(res) -> str:
    data = res.json()
    return str(data.get("message") or data.get("detail") or "").lower()


async def setup_study_with_cohort_data(client: AsyncClient, headers: dict) -> tuple[str, str]:
    """
    Creates a study, publishes a questionnaire, and enrolls 10 participants with
    standardized clinical measurements (AGE, SMOKER, BP_SYSTOLIC).
    """
    unique_suffix = uuid.uuid4().hex[:6]
    # 1. Study
    s_res = await client.post(
        "/api/v1/studies",
        json={
            "title": f"Hypertension Cohort Study {unique_suffix}",
            "protocolNumber": f"HTN-2026-{unique_suffix}",
            "targetParticipants": 20,
        },
        headers=headers,
    )
    assert s_res.status_code == 201, s_res.text
    study_id = s_res.json()["id"]

    # 2. Questionnaire
    q_payload = {
        "title": "Cardiovascular Baseline Survey",
        "description": "Baseline cardiovascular measurements",
        "studyId": study_id,
        "questions": [
            {
                "id": "q_age",
                "variableName": "AGE",
                "type": "integer",
                "text": "Age in years",
                "order": 1,
                "validation": {"required": True, "min": 18, "max": 100},
            },
            {
                "id": "q_smoker",
                "variableName": "SMOKER",
                "type": "single_choice",
                "text": "Smoking Status",
                "order": 2,
                "choices": [
                    {"code": "YES", "label": "Smoker"},
                    {"code": "NO", "label": "Non-Smoker"},
                ],
                "validation": {"required": True},
            },
            {
                "id": "q_bp",
                "variableName": "BP_SYSTOLIC",
                "type": "decimal",
                "text": "Systolic Blood Pressure (mmHg)",
                "order": 3,
                "validation": {"required": True, "min": 80, "max": 240},
            },
            {
                "id": "q_chol",
                "variableName": "CHOLESTEROL",
                "type": "decimal",
                "text": "Total Cholesterol (mg/dL)",
                "order": 4,
                "validation": {"required": True, "min": 100, "max": 400},
            },
        ],
    }
    q_res = await client.post("/api/v1/questionnaires", json=q_payload, headers=headers)
    assert q_res.status_code == 201, q_res.text
    q_id = q_res.json()["id"]

    # Approve & Publish
    await client.post(f"/api/v1/questionnaires/{q_id}/approve", json={"approvalNotes": "Approved"}, headers=headers)
    await client.post(f"/api/v1/questionnaires/{q_id}/publish", json={"publicationNotes": "Published"}, headers=headers)

    # 3. Submit responses for 10 participants
    # Known test distribution:
    # 5 Non-smokers (lower BP), 5 Smokers (higher BP)
    cohort_data = [
        {"age": 30, "smoker": "NO", "bp": 115.0, "chol": 170.0},
        {"age": 35, "smoker": "NO", "bp": 118.0, "chol": 180.0},
        {"age": 40, "smoker": "NO", "bp": 120.0, "chol": 190.0},
        {"age": 45, "smoker": "NO", "bp": 122.0, "chol": 195.0},
        {"age": 50, "smoker": "NO", "bp": 125.0, "chol": 200.0},
        {"age": 52, "smoker": "YES", "bp": 138.0, "chol": 220.0},
        {"age": 55, "smoker": "YES", "bp": 142.0, "chol": 230.0},
        {"age": 60, "smoker": "YES", "bp": 145.0, "chol": 240.0},
        {"age": 65, "smoker": "YES", "bp": 150.0, "chol": 250.0},
        {"age": 70, "smoker": "YES", "bp": 155.0, "chol": 260.0},
    ]

    for idx, p in enumerate(cohort_data):
        part_code = f"PT-HTN-{idx+1:03d}"
        sub_payload = {
            "submissionId": str(uuid.uuid4()),
            "questionnaireId": q_id,
            "questionnaireVersion": "1.0",
            "participantIdentifier": part_code,
            "consentRecord": {
                "questionnaireId": q_id,
                "questionnaireVersion": "1.0",
                "participantIdentifier": part_code,
                "agreedToParticipate": True,
                "agreedToDataStorage": True,
            },
            "answers": {
                "AGE": p["age"],
                "SMOKER": p["smoker"],
                "BP_SYSTOLIC": p["bp"],
                "CHOLESTEROL": p["chol"],
            },
        }
        r = await client.post(f"/api/v1/surveys/{q_id}/submit", json=sub_payload, headers=headers)
        assert r.status_code == 200, r.text

    return study_id, q_id


@pytest.mark.asyncio
async def test_dataset_snapshot_creation_and_checksum(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_id, q_id = await setup_study_with_cohort_data(client, headers)

    # 1. Create Snapshot
    snap_payload = {
        "studyId": study_id,
        "name": "Hypertension Baseline Frozen Cohort",
        "description": "Frozen snapshot after 10-patient intake completion",
        "questionnaireId": q_id,
    }
    res = await client.post("/api/v1/analysis/datasets", json=snap_payload, headers=headers)
    assert res.status_code == 201, res.text
    snap = res.json()
    assert snap["studyId"] == study_id
    assert snap["name"] == "Hypertension Baseline Frozen Cohort"
    assert snap["recordCount"] == 10
    assert snap["variableCount"] >= 4
    assert snap["isFrozen"] is True
    snap_id = snap["id"]

    # 2. Retrieve Variable Dictionary
    res_vars = await client.get(f"/api/v1/analysis/datasets/{snap_id}/variables", headers=headers)
    assert res_vars.status_code == 200, res_vars.text
    variables = res_vars.json()
    assert len(variables) >= 4
    var_map = {v["name"]: v for v in variables}
    assert "AGE" in var_map
    assert var_map["AGE"]["dataType"] == "numeric"
    assert var_map["AGE"]["missingCount"] == 0
    assert "SMOKER" in var_map
    assert var_map["SMOKER"]["dataType"] == "categorical"

    # 3. Retrieve Data Quality Report
    res_q = await client.get(f"/api/v1/analysis/datasets/{snap_id}/quality", headers=headers)
    assert res_q.status_code == 200, res_q.text
    dq = res_q.json()
    assert dq["totalRecords"] == 10
    assert dq["completeCasesCount"] == 10
    assert dq["completeCasesPercentage"] == 100.0


@pytest.mark.asyncio
async def test_descriptive_statistics_calculation(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_id, q_id = await setup_study_with_cohort_data(client, headers)

    # Freeze snapshot
    s_res = await client.post(
        "/api/v1/analysis/datasets",
        json={"studyId": study_id, "name": "Cohort Snapshot", "questionnaireId": q_id},
        headers=headers,
    )
    snap_id = s_res.json()["id"]

    # Run descriptive summary on AGE (values: 30, 35, 40, 45, 50, 52, 55, 60, 65, 70)
    # True Mean: 50.2, True Median: 51.0
    run_payload = {
        "studyId": study_id,
        "datasetSnapshotId": snap_id,
        "methodId": "descriptive_summary",
        "dependentVariable": "AGE",
        "independentVariables": [],
        "confidenceLevel": 95.0,
        "handleMissing": "complete_case",
    }
    run_res = await client.post("/api/v1/analysis/runs", json=run_payload, headers=headers)
    assert run_res.status_code == 201, run_res.text
    run_data = run_res.json()
    assert run_data["status"] == "completed"
    assert run_data["progressPercent"] == 100
    run_id = run_data["id"]

    # Fetch statistical results
    res_data = await client.get(f"/api/v1/analysis/runs/{run_id}/results", headers=headers)
    assert res_data.status_code == 200, res_data.text
    result = res_data.json()
    assert result["sampleSize"] == 10
    assert result["excludedCount"] == 0
    assert result["testStatistic"]["name"] == "Mean"
    assert pytest.approx(result["testStatistic"]["value"], 0.1) == 50.2

    # Verify confidence interval for mean
    ci = result["confidenceInterval"]
    assert ci["level"] == 95.0
    assert ci["lower"] < 50.2 < ci["upper"]

    # Verify AI factual explanation
    exp = result["aiExplanation"]
    assert exp is not None
    assert "AGE" in exp["summary"]
    assert exp["verifiedAgainstProtocol"] is True


@pytest.mark.asyncio
async def test_independent_t_test_and_cohens_d(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_id, q_id = await setup_study_with_cohort_data(client, headers)

    s_res = await client.post(
        "/api/v1/analysis/datasets",
        json={"studyId": study_id, "name": "T-Test Snapshot", "questionnaireId": q_id},
        headers=headers,
    )
    snap_id = s_res.json()["id"]

    # Compare BP_SYSTOLIC between NO (mean: 120.0) and YES (mean: 146.0)
    run_payload = {
        "studyId": study_id,
        "datasetSnapshotId": snap_id,
        "methodId": "independent_t_test",
        "dependentVariable": "BP_SYSTOLIC",
        "independentVariables": ["SMOKER"],
        "confidenceLevel": 95.0,
        "handleMissing": "complete_case",
    }
    run_res = await client.post("/api/v1/analysis/runs", json=run_payload, headers=headers)
    assert run_res.status_code == 201, run_res.text
    run_id = run_res.json()["id"]

    res_data = await client.get(f"/api/v1/analysis/runs/{run_id}/results", headers=headers)
    assert res_data.status_code == 200, res_data.text
    result = res_data.json()
    assert result["sampleSize"] == 10
    assert result["testStatistic"]["name"] == "t"
    # The groups have clearly distinct BP (120 vs 146), so t should be negative and p < 0.01
    assert result["pValue"] < 0.05
    assert result["effectSize"]["name"] == "Cohen's d"
    assert abs(result["effectSize"]["value"]) > 0.8  # Large effect size
    assert result["effectSize"]["interpretation"] == "large"

    # Verify difference estimates table
    est_table = result["estimatesTable"]
    diff_est = next(e for e in est_table if "Difference" in e["parameter"])
    assert diff_est["significant"] is True


@pytest.mark.asyncio
async def test_bivariate_pearson_correlation(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_id, q_id = await setup_study_with_cohort_data(client, headers)

    s_res = await client.post(
        "/api/v1/analysis/datasets",
        json={"studyId": study_id, "name": "Correlation Snapshot", "questionnaireId": q_id},
        headers=headers,
    )
    snap_id = s_res.json()["id"]

    # Correlate AGE with BP_SYSTOLIC (strongly positive linear association)
    run_payload = {
        "studyId": study_id,
        "datasetSnapshotId": snap_id,
        "methodId": "correlation_pearson",
        "dependentVariable": "BP_SYSTOLIC",
        "independentVariables": ["AGE"],
        "confidenceLevel": 95.0,
        "handleMissing": "complete_case",
    }
    run_res = await client.post("/api/v1/analysis/runs", json=run_payload, headers=headers)
    assert run_res.status_code == 201, run_res.text
    run_id = run_res.json()["id"]

    res_data = await client.get(f"/api/v1/analysis/runs/{run_id}/results", headers=headers)
    assert res_data.status_code == 200, res_data.text
    result = res_data.json()
    assert result["sampleSize"] == 10
    r_val = result["testStatistic"]["value"]
    assert 0.8 <= r_val <= 1.0  # Strong positive correlation
    assert result["pValue"] < 0.01

    # Verify scatter plot data points are included
    assert result["scatterPlotData"] is not None
    assert len(result["scatterPlotData"]) == 10


@pytest.mark.asyncio
async def test_multivariable_linear_regression(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_id, q_id = await setup_study_with_cohort_data(client, headers)

    s_res = await client.post(
        "/api/v1/analysis/datasets",
        json={"studyId": study_id, "name": "Regression Snapshot", "questionnaireId": q_id},
        headers=headers,
    )
    snap_id = s_res.json()["id"]

    # Model: BP_SYSTOLIC ~ AGE + CHOLESTEROL
    run_payload = {
        "studyId": study_id,
        "datasetSnapshotId": snap_id,
        "methodId": "linear_regression",
        "dependentVariable": "BP_SYSTOLIC",
        "independentVariables": ["AGE"],
        "covariates": ["CHOLESTEROL"],
        "confidenceLevel": 95.0,
        "handleMissing": "complete_case",
    }
    run_res = await client.post("/api/v1/analysis/runs", json=run_payload, headers=headers)
    assert run_res.status_code == 201, run_res.text
    run_id = run_res.json()["id"]

    res_data = await client.get(f"/api/v1/analysis/runs/{run_id}/results", headers=headers)
    assert res_data.status_code == 200, res_data.text
    result = res_data.json()
    assert result["sampleSize"] == 10
    assert result["testStatistic"]["name"] == "F-statistic"
    assert result["effectSize"]["name"].startswith("R-squared")
    assert result["effectSize"]["value"] > 0.8

    # Verify coefficients table
    est = result["estimatesTable"]
    param_names = [e["parameter"] for e in est]
    assert "Intercept" in param_names
    assert "AGE" in param_names
    assert "CHOLESTEROL" in param_names


@pytest.mark.asyncio
async def test_statistical_engine_edge_cases_and_assumption_violations(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_id, q_id = await setup_study_with_cohort_data(client, headers)

    s_res = await client.post(
        "/api/v1/analysis/datasets",
        json={"studyId": study_id, "name": "Edge Case Snapshot", "questionnaireId": q_id},
        headers=headers,
    )
    snap_id = s_res.json()["id"]

    # 1. Invalid variable name -> Rejection
    res_inv_var = await client.post(
        "/api/v1/analysis/runs",
        json={
            "studyId": study_id,
            "datasetSnapshotId": snap_id,
            "methodId": "descriptive_summary",
            "dependentVariable": "NON_EXISTENT_VAR",
        },
        headers=headers,
    )
    assert res_inv_var.status_code == 400
    assert "not found" in get_error_message(res_inv_var)

    # 2. T-test with missing grouping variable -> Rejection
    res_no_grp = await client.post(
        "/api/v1/analysis/runs",
        json={
            "studyId": study_id,
            "datasetSnapshotId": snap_id,
            "methodId": "independent_t_test",
            "dependentVariable": "BP_SYSTOLIC",
            "independentVariables": [],
        },
        headers=headers,
    )
    assert res_no_grp.status_code == 400


@pytest.mark.asyncio
async def test_research_report_drafting_and_updating(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_id, q_id = await setup_study_with_cohort_data(client, headers)

    # 1. Draft Report
    report_payload = {
        "studyId": study_id,
        "title": "Clinical Study Report: Hypertension Pilot",
        "type": "csr",
        "summaryExecutive": "Phase II cardiovascular trial baseline findings",
        "sections": [
            {
                "id": "sec_intro",
                "title": "1.0 Introduction & Objectives",
                "content": "Evaluation of ambulatory blood pressure and cholesterol in adult cohorts.",
            },
            {
                "id": "sec_methods",
                "title": "2.0 Statistical Methods",
                "content": "Normality assessed via Shapiro-Wilk; two-sample Welch t-tests applied for group comparisons.",
            },
        ],
    }
    res_create = await client.post("/api/v1/reports", json=report_payload, headers=headers)
    assert res_create.status_code == 201, res_create.text
    rep = res_create.json()
    assert rep["title"] == report_payload["title"]
    assert rep["status"] == "draft"
    assert len(rep["sections"]) == 2
    rep_id = rep["id"]

    # 2. Update Report
    update_payload = {
        "status": "under_review",
        "summaryExecutive": "Updated executive summary with primary endpoint confirmation.",
    }
    res_up = await client.put(f"/api/v1/reports/{rep_id}", json=update_payload, headers=headers)
    assert res_up.status_code == 200, res_up.text
    assert res_up.json()["status"] == "under_review"
    assert "Updated executive summary" in res_up.json()["summaryExecutive"]


@pytest.mark.asyncio
async def test_multi_format_exports_and_downloads(
    client: AsyncClient, pi_user: User, auth_headers
):
    headers = auth_headers(pi_user, "principal_investigator")
    study_id, q_id = await setup_study_with_cohort_data(client, headers)

    s_res = await client.post(
        "/api/v1/analysis/datasets",
        json={"studyId": study_id, "name": "Export Test Snapshot", "questionnaireId": q_id},
        headers=headers,
    )
    snap_id = s_res.json()["id"]

    formats_to_test = ["csv", "xlsx", "docx", "pdf"]

    for fmt in formats_to_test:
        export_payload = {
            "studyId": study_id,
            "format": fmt,
            "type": "raw_dataset",
            "datasetSnapshotId": snap_id,
            "includeCodebook": True,
            "deIdentifyData": True,
            "maskDirectIdentifiers": True,
        }
        res_job = await client.post("/api/v1/exports/jobs", json=export_payload, headers=headers)
        assert res_job.status_code == 201, res_job.text
        job = res_job.json()
        assert job["format"] == fmt
        assert job["status"] == "ready"
        assert job["fileSizeBytes"] > 0
        job_id = job["id"]

        # Download file
        res_dl = await client.get(f"/api/v1/exports/jobs/{job_id}/download", headers=headers)
        assert res_dl.status_code == 200, res_dl.text
        assert len(res_dl.content) > 0

        # Check format signatures
        if fmt == "pdf":
            assert res_dl.content.startswith(b"%PDF")
        elif fmt == "docx":
            assert b"PK" in res_dl.content[:4]  # Zip format header for docx
        elif fmt == "xlsx":
            assert b"PK" in res_dl.content[:4]  # Zip format header for xlsx
        elif fmt == "csv":
            text = res_dl.content.decode("utf-8")
            assert "AGE" in text
            assert "BP_SYSTOLIC" in text
            # De-identified participant code format
            assert "PT-" in text


@pytest.mark.asyncio
async def test_cross_study_isolation_enforcement(
    client: AsyncClient, pi_user: User, researcher_user: User, auth_headers
):
    # PI creates study A
    pi_headers = auth_headers(pi_user, "principal_investigator")
    study_id, q_id = await setup_study_with_cohort_data(client, pi_headers)

    s_res = await client.post(
        "/api/v1/analysis/datasets",
        json={"studyId": study_id, "name": "Private Study Snapshot", "questionnaireId": q_id},
        headers=pi_headers,
    )
    snap_id = s_res.json()["id"]

    # Other researcher (not a member of Study A) attempts accessing snapshot -> Forbidden
    other_headers = auth_headers(researcher_user, "researcher")
    res_forbidden = await client.get(f"/api/v1/analysis/datasets/{snap_id}", headers=other_headers)
    assert res_forbidden.status_code in (403, 404)

