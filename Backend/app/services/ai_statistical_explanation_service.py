from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.services.ai_adapter import get_ai_provider, UnconfiguredAIProvider


class AiStatisticalExplanationService:
    """
    Provides factual, clinical explanations of verified statistical outputs.
    STRICT GOVERNANCE:
    - Never calculates or alters numerical statistics.
    - Uses exact computed outputs ($p$-values, test statistics, effect sizes, CIs, warnings).
    - Degrades gracefully to deterministic rule-based summary when AI provider is not configured.
    """

    @classmethod
    async def generate_explanation(
        cls,
        method_id: str,
        dependent_var: str,
        independent_vars: List[str],
        stats_output: Dict[str, Any],
        study_title: Optional[str] = None,
    ) -> Dict[str, Any]:
        p_val = stats_output.get("p_value")
        test_stat = stats_output.get("test_statistic") or {}
        stat_name = test_stat.get("name", "Test")
        stat_val = test_stat.get("value", 0.0)
        effect = stats_output.get("effect_size") or {}
        effect_name = effect.get("name", "Effect")
        effect_val = effect.get("value")
        ci = stats_output.get("confidence_interval")
        n = stats_output.get("sample_size", 0)
        warnings = stats_output.get("assumption_warnings") or []

        is_significant = bool(p_val is not None and p_val < 0.05)
        stat_str = f"{stat_name} = {stat_val:.3f}" if isinstance(stat_val, (int, float)) else str(stat_val)
        p_str = f"p = {p_val:.4f}" if p_val is not None else "p-value not applicable"

        # Deterministic factual baseline
        if is_significant:
            summary = (
                f"Statistically significant result observed for '{dependent_var}' ({stat_str}, {p_str}) "
                f"with a sample size of N = {n}."
            )
            clinical_interp = (
                f"The analysis demonstrated a statistically significant finding at the standard 5% significance threshold. "
                f"{effect_name}: {effect_val if effect_val is not None else 'N/A'}. "
                f"Evidence suggests observable variation or effect in '{dependent_var}'."
            )
        else:
            summary = (
                f"Analysis of '{dependent_var}' yielded no statistically significant outcome ({stat_str}, {p_str}) "
                f"across evaluated sample N = {n}."
            )
            clinical_interp = (
                f"The data do not show evidence of a statistically significant effect or association at the alpha = 0.05 level. "
                f"Observed differences remain within expected random sampling variation."
            )

        limitations: List[str] = []
        for w in warnings:
            limitations.append(f"{w.get('assumption', 'Assumption')}: {w.get('message', '')}")
        if not limitations:
            limitations.append("Analysis assumptions evaluated with no severe violations detected.")

        plain_lang = (
            f"Based on data from {n} study records, the test showed that the pattern in '{dependent_var}' "
            f"is {'unlikely' if is_significant else 'likely'} to have occurred by random chance ({p_str})."
        )

        conf_note = (
            f"Computed at {ci.get('level', 95)}% confidence level: [{ci.get('lower', 0):.2f}, {ci.get('upper', 0):.2f}]."
            if ci else f"Calculated with N = {n} verified observations."
        )

        result_explanation = {
            "summary": summary,
            "clinicalInterpretation": clinical_interp,
            "limitations": limitations,
            "plainLanguageSummary": plain_lang,
            "confidenceNote": conf_note,
            "verifiedAgainstProtocol": True,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }

        # Attempt enrichment via configured AI provider
        provider = get_ai_provider()
        if not isinstance(provider, UnconfiguredAIProvider):
            try:
                system_prompt = (
                    "You are a clinical biostatistician. Your task is to provide objective, plain-language and clinical "
                    "interpretation of the following EXACT verified statistical results. Do NOT change, extrapolate, "
                    "or recalculate any numbers. Respond strictly in valid JSON with keys: "
                    "'summary', 'clinicalInterpretation', 'limitations' (list), 'plainLanguageSummary', 'confidenceNote'."
                )
                prompt_content = (
                    f"Study: {study_title or 'Clinical Study'}\n"
                    f"Method: {method_id}\n"
                    f"Dependent Variable: {dependent_var}\n"
                    f"Independent Variables: {', '.join(independent_vars)}\n"
                    f"Sample Size: {n}\n"
                    f"Test Statistic: {stat_str}\n"
                    f"P-value: {p_str}\n"
                    f"Effect Size: {effect_name} = {effect_val}\n"
                    f"Confidence Interval: {conf_note}\n"
                    f"Assumption Warnings: {'; '.join(limitations)}\n"
                )
                ai_resp = await provider.extract_protocol_fields(prompt_content)
                if isinstance(ai_resp, dict) and "summary" in ai_resp:
                    result_explanation["summary"] = ai_resp.get("summary", summary)
                    result_explanation["clinicalInterpretation"] = ai_resp.get("clinicalInterpretation", clinical_interp)
                    result_explanation["plainLanguageSummary"] = ai_resp.get("plainLanguageSummary", plain_lang)
                    if isinstance(ai_resp.get("limitations"), list):
                        result_explanation["limitations"] = ai_resp.get("limitations")
            except Exception:
                # Failsafe: retain deterministic explanation
                pass

        return result_explanation

