import math
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
import scipy
import scipy.stats as stats
import statsmodels
import statsmodels.api as sm
from app.core.exceptions import InvalidInputError


def get_statistical_runtime_versions() -> Dict[str, str]:
    return {
        "pandas": str(pd.__version__),
        "scipy": str(scipy.__version__),
        "statsmodels": str(statsmodels.__version__),
        "numpy": str(np.__version__),
    }


class StatisticalEngine:
    """
    Isolated, independently validated statistical execution runtime.
    Performs deterministic calculations using verified numerical libraries (SciPy, pandas, statsmodels).
    Separated from AI generation.
    """

    @classmethod
    def execute(
        cls,
        data: List[Dict[str, Any]],
        method_id: str,
        dependent_var: str,
        independent_vars: Optional[List[str]] = None,
        covariates: Optional[List[str]] = None,
        confidence_level: float = 95.0,
        handle_missing: str = "complete_case",
        test_options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        df = pd.DataFrame(data)
        if df.empty:
            raise InvalidInputError("Dataset is empty. Cannot perform statistical computation.")

        independent_vars = independent_vars or []
        covariates = covariates or []
        test_options = test_options or {}

        # Verify dependent variable exists
        if dependent_var not in df.columns:
            raise InvalidInputError(f"Dependent variable '{dependent_var}' not found in dataset columns.")

        # Dispatch to supported methods
        if method_id == "descriptive_summary":
            return cls._calculate_descriptive_summary(df, dependent_var, confidence_level)
        elif method_id in ("independent_t_test", "mann_whitney_u"):
            if not independent_vars:
                raise InvalidInputError(f"Method '{method_id}' requires an independent grouping variable.")
            return cls._calculate_independent_comparison(
                df, dependent_var, independent_vars[0], confidence_level, test_options
            )
        elif method_id in ("chi_square", "fisher_exact"):
            if not independent_vars:
                raise InvalidInputError(f"Method '{method_id}' requires an independent categorical variable.")
            return cls._calculate_contingency(df, dependent_var, independent_vars[0], confidence_level)
        elif method_id in ("correlation_pearson", "correlation_spearman"):
            if not independent_vars:
                raise InvalidInputError(f"Correlation requires a second variable.")
            return cls._calculate_correlation(df, dependent_var, independent_vars[0], confidence_level, method_id)
        elif method_id == "one_way_anova":
            if not independent_vars:
                raise InvalidInputError("One-way ANOVA requires an independent grouping variable.")
            return cls._calculate_one_way_anova(df, dependent_var, independent_vars[0], confidence_level)
        elif method_id == "linear_regression":
            if not independent_vars:
                raise InvalidInputError("Linear regression requires at least one independent predictor variable.")
            return cls._calculate_linear_regression(
                df, dependent_var, independent_vars, covariates, confidence_level
            )
        else:
            raise InvalidInputError(f"Unsupported analysis method: '{method_id}'.")

    # =========================================================================
    # 1. DESCRIPTIVE SUMMARY
    # =========================================================================
    @classmethod
    def _calculate_descriptive_summary(
        cls, df: pd.DataFrame, var_name: str, confidence_level: float
    ) -> Dict[str, Any]:
        series = df[var_name]
        total_count = len(series)
        valid_series = series.dropna()
        sample_size = len(valid_series)
        excluded_count = total_count - sample_size

        if sample_size == 0:
            raise InvalidInputError(f"Variable '{var_name}' has 0 non-missing values.")

        warnings: List[Dict[str, Any]] = []
        if excluded_count > 0:
            pct_missing = (excluded_count / total_count) * 100
            if pct_missing > 20:
                warnings.append({
                    "assumption": "Missing Data",
                    "severity": "warning",
                    "message": f"Variable '{var_name}' has {pct_missing:.1f}% missingness.",
                    "recommendation": "Examine missingness mechanism (MCAR vs MAR) and consider sensitivity analysis.",
                })

        # Numeric pathway
        numeric_series = pd.to_numeric(valid_series, errors="coerce").dropna()
        if len(numeric_series) >= (sample_size * 0.8) and len(numeric_series) > 1:
            vals = numeric_series.to_numpy(dtype=float)
            n = len(vals)
            mean_val = float(np.mean(vals))
            sd_val = float(np.std(vals, ddof=1)) if n > 1 else 0.0
            median_val = float(np.median(vals))
            q1_val = float(np.percentile(vals, 25))
            q3_val = float(np.percentile(vals, 75))
            min_val = float(np.min(vals))
            max_val = float(np.max(vals))

            # Confidence interval for mean using Student's t
            alpha = (100.0 - confidence_level) / 100.0
            if n > 1 and sd_val > 0:
                sem = sd_val / math.sqrt(n)
                t_crit = stats.t.ppf(1.0 - alpha / 2.0, df=n - 1)
                ci_lower = float(mean_val - t_crit * sem)
                ci_upper = float(mean_val + t_crit * sem)
            else:
                ci_lower = mean_val
                ci_upper = mean_val

            # Distribution histogram
            counts, bin_edges = np.histogram(vals, bins=min(10, max(3, n // 2)))
            dist_data = []
            for i in range(len(counts)):
                dist_data.append({
                    "bucket": f"[{bin_edges[i]:.1f}, {bin_edges[i+1]:.1f})",
                    "observedCount": int(counts[i]),
                    "frequency": float(counts[i] / n),
                })

            estimates = [
                {"parameter": "Mean", "estimate": mean_val, "stdError": float(sd_val / math.sqrt(n)) if n > 0 else 0.0, "statistic": mean_val, "statisticName": "Mean", "degreesOfFreedom": n - 1, "pValue": 0.0, "ciLower": ci_lower, "ciUpper": ci_upper, "significant": False},
                {"parameter": "Median", "estimate": median_val, "stdError": 0.0, "statistic": median_val, "statisticName": "Median", "pValue": 0.0, "ciLower": q1_val, "ciUpper": q3_val, "significant": False},
                {"parameter": "Std Deviation", "estimate": sd_val, "stdError": 0.0, "statistic": sd_val, "statisticName": "SD", "pValue": 0.0, "ciLower": min_val, "ciUpper": max_val, "significant": False},
            ]

            return {
                "sample_size": sample_size,
                "excluded_count": excluded_count,
                "missingness_handled": "complete_case",
                "degrees_of_freedom": n - 1,
                "test_statistic": {"name": "Mean", "value": mean_val},
                "p_value": None,
                "confidence_interval": {"level": confidence_level, "lower": ci_lower, "upper": ci_upper},
                "estimates_table": estimates,
                "assumption_warnings": warnings,
                "distribution_data": dist_data,
            }

        # Categorical pathway
        cat_counts = valid_series.astype(str).value_counts()
        dist_data = [
            {"bucket": str(cat), "observedCount": int(cnt), "frequency": float(cnt / sample_size)}
            for cat, cnt in cat_counts.items()
        ]
        estimates = [
            {"parameter": f"Category: {cat}", "estimate": float(cnt), "stdError": 0.0, "statistic": float(cnt / sample_size), "statisticName": "Proportion", "pValue": 0.0, "ciLower": 0.0, "ciUpper": 1.0, "significant": False}
            for cat, cnt in cat_counts.items()
        ]

        return {
            "sample_size": sample_size,
            "excluded_count": excluded_count,
            "missingness_handled": "complete_case",
            "degrees_of_freedom": len(cat_counts) - 1,
            "test_statistic": {"name": "Categories", "value": float(len(cat_counts))},
            "p_value": None,
            "confidence_interval": None,
            "estimates_table": estimates,
            "assumption_warnings": warnings,
            "distribution_data": dist_data,
        }

    # =========================================================================
    # 2. INDEPENDENT SAMPLES COMPARISON (T-TEST & MANN-WHITNEY U)
    # =========================================================================
    @classmethod
    def _calculate_independent_comparison(
        cls,
        df: pd.DataFrame,
        dep_var: str,
        group_var: str,
        confidence_level: float,
        test_options: Dict[str, Any],
    ) -> Dict[str, Any]:
        sub = df[[dep_var, group_var]].dropna()
        sub[dep_var] = pd.to_numeric(sub[dep_var], errors="coerce")
        sub = sub.dropna()

        groups = list(sub[group_var].unique())
        if len(groups) < 2:
            raise InvalidInputError(
                f"Grouping variable '{group_var}' must have at least 2 distinct groups with valid data. Found: {groups}"
            )
        # Take the first 2 groups
        g1_name, g2_name = str(groups[0]), str(groups[1])
        g1_vals = sub[sub[group_var] == groups[0]][dep_var].to_numpy(dtype=float)
        g2_vals = sub[sub[group_var] == groups[1]][dep_var].to_numpy(dtype=float)

        n1, n2 = len(g1_vals), len(g2_vals)
        if n1 < 2 or n2 < 2:
            raise InvalidInputError(
                f"Sample size too small for two-sample comparison: Group '{g1_name}' has n={n1}, Group '{g2_name}' has n={n2}."
            )

        warnings: List[Dict[str, Any]] = []

        # 1. Levene's test for equality of variance
        lev_stat, lev_p = stats.levene(g1_vals, g2_vals)
        equal_var = bool(lev_p > 0.05)
        if not equal_var:
            warnings.append({
                "assumption": "Homogeneity of Variance (Levene)",
                "testUsed": "Levene's Test",
                "testStatistic": float(lev_stat),
                "pValue": float(lev_p),
                "severity": "violation",
                "message": f"Variance heterogeneity detected (Levene p={lev_p:.4f} < 0.05). Welch's t-test applied.",
                "recommendation": "Use Welch's t-statistic which does not assume equal variances.",
            })

        # 2. Normality check (Shapiro-Wilk)
        if 3 <= n1 <= 5000:
            sh_stat1, sh_p1 = stats.shapiro(g1_vals)
            if sh_p1 < 0.05:
                warnings.append({
                    "assumption": f"Normality in Group {g1_name}",
                    "testUsed": "Shapiro-Wilk",
                    "testStatistic": float(sh_stat1),
                    "pValue": float(sh_p1),
                    "severity": "warning",
                    "message": f"Normality violated for '{g1_name}' (p={sh_p1:.4f}).",
                    "recommendation": "Cross-check against non-parametric Mann-Whitney U test.",
                })

        # Compute independent t-test
        t_res = stats.ttest_ind(g1_vals, g2_vals, equal_var=equal_var)
        t_stat = float(t_res.statistic)
        p_val = float(t_res.pvalue)
        df_deg = float(t_res.df) if hasattr(t_res, "df") else float(n1 + n2 - 2)

        # Compute Mann-Whitney U for non-parametric reference
        u_res = stats.mannwhitneyu(g1_vals, g2_vals, alternative="two-sided")
        u_stat = float(u_res.statistic)
        u_p = float(u_res.pvalue)

        # Group stats
        m1, s1 = float(np.mean(g1_vals)), float(np.std(g1_vals, ddof=1)) if n1 > 1 else 0.0
        m2, s2 = float(np.mean(g2_vals)), float(np.std(g2_vals, ddof=1)) if n2 > 1 else 0.0
        diff = m1 - m2

        # Standard error of difference
        if equal_var:
            s_pooled = math.sqrt(((n1 - 1) * s1**2 + (n2 - 1) * s2**2) / (n1 + n2 - 2))
            se_diff = s_pooled * math.sqrt(1 / n1 + 1 / n2)
            cohen_d = float(diff / s_pooled) if s_pooled > 0 else 0.0
        else:
            se_diff = math.sqrt((s1**2 / n1) + (s2**2 / n2))
            s_pooled = math.sqrt((s1**2 + s2**2) / 2.0)
            cohen_d = float(diff / s_pooled) if s_pooled > 0 else 0.0

        # Confidence interval for difference in means
        alpha = (100.0 - confidence_level) / 100.0
        t_crit = stats.t.ppf(1.0 - alpha / 2.0, df=df_deg)
        ci_lower = float(diff - t_crit * se_diff)
        ci_upper = float(diff + t_crit * se_diff)

        estimates = [
            {"parameter": f"Mean ({g1_name})", "estimate": m1, "stdError": float(s1 / math.sqrt(n1)), "statistic": m1, "statisticName": "Mean", "degreesOfFreedom": n1 - 1, "pValue": 0.0, "ciLower": m1 - t_crit * (s1 / math.sqrt(n1)), "ciUpper": m1 + t_crit * (s1 / math.sqrt(n1)), "significant": False},
            {"parameter": f"Mean ({g2_name})", "estimate": m2, "stdError": float(s2 / math.sqrt(n2)), "statistic": m2, "statisticName": "Mean", "degreesOfFreedom": n2 - 1, "pValue": 0.0, "ciLower": m2 - t_crit * (s2 / math.sqrt(n2)), "ciUpper": m2 + t_crit * (s2 / math.sqrt(n2)), "significant": False},
            {"parameter": f"Mean Difference ({g1_name} - {g2_name})", "estimate": diff, "stdError": se_diff, "statistic": t_stat, "statisticName": "t", "degreesOfFreedom": df_deg, "pValue": p_val, "ciLower": ci_lower, "ciUpper": ci_upper, "significant": bool(p_val < 0.05)},
            {"parameter": "Mann-Whitney U", "estimate": u_stat, "stdError": 0.0, "statistic": u_stat, "statisticName": "U", "degreesOfFreedom": None, "pValue": u_p, "ciLower": 0.0, "ciUpper": 0.0, "significant": bool(u_p < 0.05)},
        ]

        effect_interp = "negligible"
        abs_d = abs(cohen_d)
        if abs_d >= 0.8:
            effect_interp = "large"
        elif abs_d >= 0.5:
            effect_interp = "medium"
        elif abs_d >= 0.2:
            effect_interp = "small"

        return {
            "sample_size": n1 + n2,
            "excluded_count": len(df) - (n1 + n2),
            "missingness_handled": "complete_case",
            "degrees_of_freedom": df_deg,
            "test_statistic": {"name": "t", "value": t_stat},
            "p_value": p_val,
            "effect_size": {"name": "Cohen's d", "value": cohen_d, "interpretation": effect_interp},
            "confidence_interval": {"level": confidence_level, "lower": ci_lower, "upper": ci_upper},
            "estimates_table": estimates,
            "assumption_warnings": warnings,
        }

    # =========================================================================
    # 3. CHI-SQUARE AND FISHER'S EXACT TEST
    # =========================================================================
    @classmethod
    def _calculate_contingency(
        cls, df: pd.DataFrame, var1: str, var2: str, confidence_level: float
    ) -> Dict[str, Any]:
        sub = df[[var1, var2]].dropna()
        n = len(sub)
        if n < 5:
            raise InvalidInputError(f"Insufficient observations (n={n}) for cross-tabulation.")

        table = pd.crosstab(sub[var1], sub[var2])
        if table.shape[0] < 2 or table.shape[1] < 2:
            raise InvalidInputError("Cross-tabulation table must have at least 2 rows and 2 columns.")

        chi2_res = stats.chi2_contingency(table)
        chi2_stat = float(chi2_res.statistic)
        p_val = float(chi2_res.pvalue)
        df_deg = int(chi2_res.dof)
        expected = chi2_res.expected_freq

        warnings: List[Dict[str, Any]] = []
        low_expected_cells = int(np.sum(expected < 5))
        total_cells = int(expected.size)
        low_exp_pct = (low_expected_cells / total_cells) * 100.0

        if low_exp_pct > 20:
            warnings.append({
                "assumption": "Expected Cell Frequencies",
                "severity": "warning",
                "message": f"{low_exp_pct:.1f}% of cells have expected frequency < 5.",
                "recommendation": "Use Fisher's exact test or combine sparse categories.",
            })

        # Cramér's V effect size
        min_dim = min(table.shape[0] - 1, table.shape[1] - 1)
        cramers_v = math.sqrt(chi2_stat / (n * min_dim)) if min_dim > 0 and n > 0 else 0.0

        estimates = []
        # If 2x2, compute Fisher's exact test
        if table.shape == (2, 2):
            fisher_stat, fisher_p = stats.fisher_exact(table)
            estimates.append({
                "parameter": "Fisher's Exact Odds Ratio",
                "estimate": float(fisher_stat),
                "stdError": 0.0,
                "statistic": float(fisher_stat),
                "statisticName": "OR",
                "degreesOfFreedom": None,
                "pValue": float(fisher_p),
                "ciLower": 0.0,
                "ciUpper": 0.0,
                "significant": bool(fisher_p < 0.05),
            })

        estimates.append({
            "parameter": "Pearson Chi-Square",
            "estimate": chi2_stat,
            "stdError": 0.0,
            "statistic": chi2_stat,
            "statisticName": "Chi2",
            "degreesOfFreedom": df_deg,
            "pValue": p_val,
            "ciLower": 0.0,
            "ciUpper": 0.0,
            "significant": bool(p_val < 0.05),
        })

        return {
            "sample_size": n,
            "excluded_count": len(df) - n,
            "missingness_handled": "complete_case",
            "degrees_of_freedom": df_deg,
            "test_statistic": {"name": "Chi-Square", "value": chi2_stat},
            "p_value": p_val,
            "effect_size": {"name": "Cramér's V", "value": float(cramers_v), "interpretation": "Association strength"},
            "confidence_interval": None,
            "estimates_table": estimates,
            "assumption_warnings": warnings,
        }

    # =========================================================================
    # 4. PEARSON AND SPEARMAN CORRELATION
    # =========================================================================
    @classmethod
    def _calculate_correlation(
        cls, df: pd.DataFrame, var1: str, var2: str, confidence_level: float, method_id: str
    ) -> Dict[str, Any]:
        sub = df[[var1, var2]].dropna()
        sub[var1] = pd.to_numeric(sub[var1], errors="coerce")
        sub[var2] = pd.to_numeric(sub[var2], errors="coerce")
        sub = sub.dropna()

        n = len(sub)
        if n < 4:
            raise InvalidInputError(f"At least 4 complete pairs required for correlation analysis. Found n={n}.")

        x = sub[var1].to_numpy(dtype=float)
        y = sub[var2].to_numpy(dtype=float)

        warnings: List[Dict[str, Any]] = []

        if method_id == "correlation_spearman":
            res = stats.spearmanr(x, y)
            r_val = float(res.statistic)
            p_val = float(res.pvalue)
            stat_name = "Spearman rho"
            ci_lower, ci_upper = r_val, r_val
        else:
            res = stats.pearsonr(x, y)
            r_val = float(res.statistic)
            p_val = float(res.pvalue)
            stat_name = "Pearson r"

            # Fisher z-transformation 95% CI
            if n > 3 and abs(r_val) < 1.0:
                z = np.arctanh(r_val)
                se_z = 1.0 / math.sqrt(n - 3)
                z_crit = 1.95996
                ci_lower = float(np.tanh(z - z_crit * se_z))
                ci_upper = float(np.tanh(z + z_crit * se_z))
            else:
                ci_lower, ci_upper = r_val, r_val

        # Linear trend line for scatter plot data
        slope, intercept = np.polyfit(x, y, 1) if n >= 2 else (0.0, 0.0)
        scatter_data = [
            {"x": float(xi), "y": float(yi), "predicted": float(slope * xi + intercept)}
            for xi, yi in zip(x[:100], y[:100])  # Cap scatter points at 100 for responsive frontend rendering
        ]

        estimates = [{
            "parameter": stat_name,
            "estimate": r_val,
            "stdError": float(math.sqrt((1 - r_val**2) / (n - 2))) if n > 2 and abs(r_val) < 1.0 else 0.0,
            "statistic": r_val,
            "statisticName": stat_name,
            "degreesOfFreedom": n - 2,
            "pValue": p_val,
            "ciLower": ci_lower,
            "ciUpper": ci_upper,
            "significant": bool(p_val < 0.05),
        }]

        return {
            "sample_size": n,
            "excluded_count": len(df) - n,
            "missingness_handled": "complete_case",
            "degrees_of_freedom": n - 2,
            "test_statistic": {"name": stat_name, "value": r_val},
            "p_value": p_val,
            "effect_size": {"name": "Correlation (r)", "value": r_val, "interpretation": f"{abs(r_val):.2f}"},
            "confidence_interval": {"level": confidence_level, "lower": ci_lower, "upper": ci_upper},
            "estimates_table": estimates,
            "assumption_warnings": warnings,
            "scatter_plot_data": scatter_data,
        }

    # =========================================================================
    # 5. ONE-WAY ANOVA
    # =========================================================================
    @classmethod
    def _calculate_one_way_anova(
        cls, df: pd.DataFrame, dep_var: str, group_var: str, confidence_level: float
    ) -> Dict[str, Any]:
        sub = df[[dep_var, group_var]].dropna()
        sub[dep_var] = pd.to_numeric(sub[dep_var], errors="coerce")
        sub = sub.dropna()

        groups = [sub[sub[group_var] == g][dep_var].to_numpy(dtype=float) for g in sub[group_var].unique()]
        if len(groups) < 2:
            raise InvalidInputError("One-way ANOVA requires at least 2 distinct groups.")

        f_stat, p_val = stats.f_oneway(*groups)
        total_n = sum(len(g) for g in groups)
        k = len(groups)
        df_between = k - 1
        df_within = total_n - k

        # Eta-squared
        all_vals = np.concatenate(groups)
        ss_total = np.sum((all_vals - np.mean(all_vals))**2)
        ss_between = sum(len(g) * (np.mean(g) - np.mean(all_vals))**2 for g in groups)
        eta_sq = float(ss_between / ss_total) if ss_total > 0 else 0.0

        estimates = [{
            "parameter": "Between Groups",
            "estimate": float(f_stat),
            "stdError": 0.0,
            "statistic": float(f_stat),
            "statisticName": "F",
            "degreesOfFreedom": [df_between, df_within],
            "pValue": float(p_val),
            "ciLower": 0.0,
            "ciUpper": 0.0,
            "significant": bool(p_val < 0.05),
        }]

        return {
            "sample_size": total_n,
            "excluded_count": len(df) - total_n,
            "missingness_handled": "complete_case",
            "degrees_of_freedom": [df_between, df_within],
            "test_statistic": {"name": "F", "value": float(f_stat)},
            "p_value": float(p_val),
            "effect_size": {"name": "Eta-Squared (η²)", "value": eta_sq, "interpretation": f"{eta_sq:.3f}"},
            "confidence_interval": None,
            "estimates_table": estimates,
            "assumption_warnings": [],
        }

    # =========================================================================
    # 6. LINEAR REGRESSION (OLS)
    # =========================================================================
    @classmethod
    def _calculate_linear_regression(
        cls,
        df: pd.DataFrame,
        dep_var: str,
        indep_vars: List[str],
        covariates: List[str],
        confidence_level: float,
    ) -> Dict[str, Any]:
        all_cols = [dep_var] + indep_vars + covariates
        sub = df[all_cols].dropna()
        for col in all_cols:
            sub[col] = pd.to_numeric(sub[col], errors="coerce")
        sub = sub.dropna()

        n = len(sub)
        p = len(indep_vars) + len(covariates)
        if n <= p + 1:
            raise InvalidInputError(
                f"Insufficient sample size (n={n}) for {p} regression predictors. Must have n > {p + 1}."
            )

        y = sub[dep_var].to_numpy(dtype=float)
        X = sub[indep_vars + covariates].to_numpy(dtype=float)
        X_with_const = sm.add_constant(X)

        model = sm.OLS(y, X_with_const).fit()

        alpha = (100.0 - confidence_level) / 100.0
        ci_matrix = model.conf_int(alpha=alpha)

        param_names = ["Intercept"] + indep_vars + covariates
        estimates = []
        for i, name in enumerate(param_names):
            estimates.append({
                "parameter": name,
                "estimate": float(model.params[i]),
                "stdError": float(model.bse[i]),
                "statistic": float(model.tvalues[i]),
                "statisticName": "t",
                "degreesOfFreedom": float(model.df_resid),
                "pValue": float(model.pvalues[i]),
                "ciLower": float(ci_matrix[i, 0]),
                "ciUpper": float(ci_matrix[i, 1]),
                "significant": bool(model.pvalues[i] < 0.05),
            })

        # Scatter plot for single predictor
        scatter_data = []
        if len(indep_vars) == 1 and not covariates:
            x_vals = sub[indep_vars[0]].to_numpy(dtype=float)
            y_pred = model.predict(X_with_const)
            for xi, yi, ypi in zip(x_vals[:100], y[:100], y_pred[:100]):
                scatter_data.append({"x": float(xi), "y": float(yi), "predicted": float(ypi)})

        return {
            "sample_size": n,
            "excluded_count": len(df) - n,
            "missingness_handled": "complete_case",
            "degrees_of_freedom": float(model.df_resid),
            "test_statistic": {"name": "F-statistic", "value": float(model.fvalue)},
            "p_value": float(model.f_pvalue),
            "effect_size": {"name": "R-squared (R²)", "value": float(model.rsquared), "interpretation": f"Adj R² = {model.rsquared_adj:.3f}"},
            "confidence_interval": None,
            "estimates_table": estimates,
            "assumption_warnings": [],
            "scatter_plot_data": scatter_data if scatter_data else None,
        }

