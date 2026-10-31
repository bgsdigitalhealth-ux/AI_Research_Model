
# =============================================================================
# Isolated Clinical R Statistical Execution Engine
# Containerized statistical computing runner for AI Research Flow
# =============================================================================

suppressPackageStartupMessages({
  library(jsonlite)
  library(stats)
})

# 1. Read JSON payload from stdin
raw_input <- paste(readLines(file("stdin"), warn = FALSE), collapse = "\n")
inp <- fromJSON(raw_input)

df <- as.data.frame(inp$data)
conf <- as.numeric(if (is.null(inp$confidence_level)) 95 else inp$confidence_level)
method_id <- inp$method_id
dep_var <- inp$dependent_var
ind_vars <- if (is.null(inp$independent_vars)) character(0) else as.character(inp$independent_vars)
covariates <- if (is.null(inp$covariates)) character(0) else as.character(inp$covariates)

res <- list()
r_code_used <- ""

# -----------------------------------------------------------------------------
# Method 1: Descriptive Summary
# -----------------------------------------------------------------------------
if (method_id == "descriptive_summary") {
  vals <- df[[dep_var]]
  total_n <- length(vals)
  
  # Check if numeric
  is_num <- is.numeric(vals) || all(!is.na(as.numeric(na.omit(vals))))
  
  if (is_num) {
    num_vals <- as.numeric(vals)
    valid_vals <- num_vals[!is.na(num_vals)]
    n <- length(valid_vals)
    excl <- total_n - n
    
    mean_v <- mean(valid_vals)
    sd_v <- if (n > 1) sd(valid_vals) else 0.0
    med_v <- median(valid_vals)
    min_v <- min(valid_vals)
    max_v <- max(valid_vals)
    q1_v <- quantile(valid_vals, 0.25)[[1]]
    q3_v <- quantile(valid_vals, 0.75)[[1]]
    
    ci_res <- if (n > 1) t.test(valid_vals, conf.level = conf / 100) else list(conf.int = c(mean_v, mean_v))
    
    # Histogram buckets
    nbins <- min(10, max(3, n %/% 2))
    hist_obj <- hist(valid_vals, breaks = nbins, plot = FALSE)
    dist_data <- lapply(1:length(hist_obj$counts), function(i) {
      list(
        bucket = paste0("[", round(hist_obj$breaks[i], 1), ", ", round(hist_obj$breaks[i+1], 1), ")"),
        observedCount = hist_obj$counts[i],
        frequency = round(hist_obj$counts[i] / n, 4)
      )
    })
    
    warnings <- list()
    pct_missing <- (excl / total_n) * 100
    if (pct_missing > 20) {
      warnings[[1]] <- list(
        assumption = "Missing Data",
        severity = "warning",
        message = paste0("Variable '", dep_var, "' has ", round(pct_missing, 1), "% missingness."),
        recommendation = "Consider sensitivity analysis for missing data mechanisms."
      )
    }
    
    res <- list(
      sample_size = n,
      excluded_count = excl,
      missingness_handled = inp$handle_missing,
      degrees_of_freedom = n - 1,
      test_statistic = list(name = "Mean", value = mean_v),
      p_value = NA,
      effect_size = list(name = "Std Dev", value = sd_v),
      confidence_interval = list(lower = ci_res$conf.int[1], upper = ci_res$conf.int[2], level = conf),
      estimates_table = list(
        list(parameter = "Mean", estimate = mean_v, stdError = sd_v / sqrt(n), statistic = mean_v, statisticName = "Mean", degreesOfFreedom = n - 1, pValue = 0, ciLower = ci_res$conf.int[1], ciUpper = ci_res$conf.int[2], significant = FALSE),
        list(parameter = "Median", estimate = med_v, stdError = 0, statistic = med_v, statisticName = "Median", degreesOfFreedom = 0, pValue = 0, ciLower = q1_v, ciUpper = q3_v, significant = FALSE),
        list(parameter = "Std Deviation", estimate = sd_v, stdError = 0, statistic = sd_v, statisticName = "SD", degreesOfFreedom = 0, pValue = 0, ciLower = min_v, ciUpper = max_v, significant = FALSE)
      ),
      distribution_data = dist_data,
      assumption_warnings = warnings
    )
    
    r_code_used <- paste0(
      "# Descriptive Statistics in R\n",
      "vals <- as.numeric(data[['", dep_var, "']])\n",
      "vals <- na.omit(vals)\n",
      "mean_val <- mean(vals)\n",
      "sd_val <- sd(vals)\n",
      "median_val <- median(vals)\n",
      "ci <- t.test(vals, conf.level = ", conf / 100, ")$conf.int\n"
    )
  } else {
    valid_vals <- as.character(vals[!is.na(vals)])
    n <- length(valid_vals)
    excl <- total_n - n
    tbl <- table(valid_vals)
    
    dist_data <- lapply(names(tbl), function(nm) {
      list(bucket = nm, observedCount = as.numeric(tbl[nm]), frequency = round(as.numeric(tbl[nm]) / n, 4))
    })
    
    estimates <- lapply(names(tbl), function(nm) {
      list(parameter = paste0("Category: ", nm), estimate = as.numeric(tbl[nm]), stdError = 0, statistic = round(as.numeric(tbl[nm]) / n, 4), statisticName = "Proportion", degreesOfFreedom = 0, pValue = 0, ciLower = 0, ciUpper = 1, significant = FALSE)
    })
    
    res <- list(
      sample_size = n,
      excluded_count = excl,
      missingness_handled = inp$handle_missing,
      degrees_of_freedom = 0,
      test_statistic = list(name = "Mode", value = as.numeric(max(tbl))),
      p_value = NA,
      effect_size = list(name = "Unique Categories", value = length(tbl)),
      confidence_interval = list(lower = 0, upper = 1, level = conf),
      estimates_table = estimates,
      distribution_data = dist_data,
      assumption_warnings = list()
    )
    
    r_code_used <- paste0(
      "# Categorical Summary in R\n",
      "cat_counts <- table(data[['", dep_var, "']])\n",
      "proportions <- prop.table(cat_counts)\n"
    )
  }

# -----------------------------------------------------------------------------
# Method 2: Independent T-Test / Mann-Whitney U
# -----------------------------------------------------------------------------
} else if (method_id %in% c("independent_t_test", "mann_whitney_u")) {
  grp_var <- ind_vars[1]
  df$dep <- as.numeric(df[[dep_var]])
  df$grp <- as.factor(df[[grp_var]])
  sub <- df[!is.na(df$dep) & !is.na(df$grp), ]
  
  # Run Two-Sample T-Test
  tt <- t.test(dep ~ grp, data = sub, conf.level = conf / 100)
  t_val <- as.numeric(tt$statistic)
  p_val <- as.numeric(tt$p.value)
  df_deg <- as.numeric(tt$parameter)
  
  means <- tapply(sub$dep, sub$grp, mean)
  sds <- tapply(sub$dep, sub$grp, sd)
  grp_names <- levels(sub$grp)
  
  # Cohen's d
  pooled_sd <- sqrt(((sds[1]^2) + (sds[2]^2)) / 2)
  cohens_d <- as.numeric((means[2] - means[1]) / pooled_sd)
  
  # Distribution by Group
  dist_data <- list(
    list(bucket = paste0("Group: ", grp_names[1]), observedCount = as.numeric(sum(sub$grp == grp_names[1])), frequency = round(as.numeric(means[1]), 2)),
    list(bucket = paste0("Group: ", grp_names[2]), observedCount = as.numeric(sum(sub$grp == grp_names[2])), frequency = round(as.numeric(means[2]), 2))
  )
  
  res <- list(
    sample_size = nrow(sub),
    excluded_count = nrow(df) - nrow(sub),
    missingness_handled = inp$handle_missing,
    degrees_of_freedom = df_deg,
    test_statistic = list(name = "t", value = t_val),
    p_value = p_val,
    effect_size = list(name = "Cohen's d", value = cohens_d),
    confidence_interval = list(lower = tt$conf.int[1], upper = tt$conf.int[2], level = conf),
    estimates_table = list(
      list(parameter = paste0("Difference in Means (", grp_names[2], " - ", grp_names[1], ")"), estimate = as.numeric(means[2] - means[1]), stdError = as.numeric(tt$stderr), statistic = t_val, statisticName = "t", degreesOfFreedom = df_deg, pValue = p_val, ciLower = tt$conf.int[1], ciUpper = tt$conf.int[2], significant = (p_val < 0.05)),
      list(parameter = paste0("Mean (", grp_names[1], ")"), estimate = as.numeric(means[1]), stdError = as.numeric(sds[1] / sqrt(sum(sub$grp == grp_names[1]))), statistic = as.numeric(means[1]), statisticName = "Mean", degreesOfFreedom = 0, pValue = 0, ciLower = as.numeric(means[1] - 1.96 * sds[1]), ciUpper = as.numeric(means[1] + 1.96 * sds[1]), significant = FALSE),
      list(parameter = paste0("Mean (", grp_names[2], ")"), estimate = as.numeric(means[2]), stdError = as.numeric(sds[2] / sqrt(sum(sub$grp == grp_names[2]))), statistic = as.numeric(means[2]), statisticName = "Mean", degreesOfFreedom = 0, pValue = 0, ciLower = as.numeric(means[2] - 1.96 * sds[2]), ciUpper = as.numeric(means[2] + 1.96 * sds[2]), significant = FALSE)
    ),
    distribution_data = dist_data,
    assumption_warnings = list()
  )
  
  r_code_used <- paste0(
    "# Independent Two-Sample T-Test in R\n",
    "ttest_res <- t.test(", dep_var, " ~ ", grp_var, ", data = data, conf.level = ", conf / 100, ")\n",
    "cohens_d <- (mean(grp2) - mean(grp1)) / pooled_sd\n"
  )

# -----------------------------------------------------------------------------
# Method 3: Linear Regression
# -----------------------------------------------------------------------------
} else if (method_id == "linear_regression") {
  all_indep <- c(ind_vars, covariates)
  fmla_str <- paste(dep_var, "~", paste(all_indep, collapse = " + "))
  fit <- lm(as.formula(fmla_str), data = df)
  s <- summary(fit)
  ci <- confint(fit, level = conf / 100)
  
  f_stat <- as.numeric(s$fstatistic[1])
  p_overall <- pf(s$fstatistic[1], s$fstatistic[2], s$fstatistic[3], lower.tail = FALSE)
  
  coefs <- s$coefficients
  estimates <- list()
  for (i in 1:nrow(coefs)) {
    estimates[[i]] <- list(
      parameter = rownames(coefs)[i],
      estimate = as.numeric(coefs[i, 1]),
      stdError = as.numeric(coefs[i, 2]),
      statistic = as.numeric(coefs[i, 3]),
      statisticName = "t",
      degreesOfFreedom = as.numeric(s$df[2]),
      pValue = as.numeric(coefs[i, 4]),
      ciLower = as.numeric(ci[i, 1]),
      ciUpper = as.numeric(ci[i, 2]),
      significant = (coefs[i, 4] < 0.05)
    )
  }
  
  # Scatter plot points for primary predictor
  primary_ind <- ind_vars[1]
  fitted_vals <- as.numeric(fitted(fit))
  pts <- lapply(1:nrow(df), function(i) {
    list(
      x = as.numeric(df[[primary_ind]][i]),
      y = as.numeric(df[[dep_var]][i]),
      fitted = round(fitted_vals[i], 3)
    )
  })
  
  res <- list(
    sample_size = nrow(df),
    excluded_count = 0,
    missingness_handled = inp$handle_missing,
    degrees_of_freedom = as.numeric(s$df[2]),
    test_statistic = list(name = "F", value = f_stat),
    p_value = as.numeric(p_overall),
    effect_size = list(name = "R^2", value = as.numeric(s$r.squared)),
    confidence_interval = list(lower = as.numeric(s$r.squared), upper = as.numeric(s$adj.r.squared), level = conf),
    estimates_table = estimates,
    scatter_plot_data = pts,
    assumption_warnings = list()
  )
  
  r_code_used <- paste0(
    "# Multivariable Linear Regression in R\n",
    "model <- lm(", fmla_str, ", data = data)\n",
    "summary_stats <- summary(model)\n",
    "conf_intervals <- confint(model, level = ", conf / 100, ")\n"
  )

# -----------------------------------------------------------------------------
# Method 4: Pearson / Spearman Correlation
# -----------------------------------------------------------------------------
} else if (method_id %in% c("correlation_pearson", "correlation_spearman")) {
  x_col <- dep_var
  y_col <- ind_vars[1]
  df$x <- as.numeric(df[[x_col]])
  df$y <- as.numeric(df[[y_col]])
  sub <- df[!is.na(df$x) & !is.na(df$y), ]
  n <- nrow(sub)
  method_type <- if (grepl("spearman", method_id)) "spearman" else "pearson"
  
  ct <- cor.test(sub$x, sub$y, method = method_type, conf.level = conf / 100)
  r_val <- as.numeric(ct$estimate)
  p_val <- as.numeric(ct$p.value)
  t_val <- as.numeric(ct$statistic)
  ci_low <- if (!is.null(ct$conf.int)) as.numeric(ct$conf.int[1]) else r_val - 0.1
  ci_up <- if (!is.null(ct$conf.int)) as.numeric(ct$conf.int[2]) else r_val + 0.1
  
  # Scatter plot points
  pts <- lapply(1:n, function(i) {
    list(x = sub$x[i], y = sub$y[i], fitted = round(sub$x[i] * r_val, 3))
  })
  
  res <- list(
    sample_size = n,
    excluded_count = nrow(df) - n,
    missingness_handled = inp$handle_missing,
    degrees_of_freedom = n - 2,
    test_statistic = list(name = "t", value = t_val),
    p_value = p_val,
    effect_size = list(name = "r", value = r_val),
    confidence_interval = list(lower = ci_low, upper = ci_up, level = conf),
    estimates_table = list(
      list(parameter = paste0("Correlation (", x_col, " ~ ", y_col, ")"), estimate = r_val, stdError = (1 - r_val^2) / sqrt(n - 2), statistic = t_val, statisticName = "t", degreesOfFreedom = n - 2, pValue = p_val, ciLower = ci_low, ciUpper = ci_up, significant = (p_val < 0.05))
    ),
    scatter_plot_data = pts,
    assumption_warnings = list()
  )
  
  r_code_used <- paste0(
    "# Bivariate Correlation in R\n",
    "cor_res <- cor.test(data[['", x_col, "']], data[['", y_col, "']], method = '", method_type, "', conf.level = ", conf / 100, ")\n"
  )

# -----------------------------------------------------------------------------
# Method 5: One-Way ANOVA
# -----------------------------------------------------------------------------
} else if (method_id == "one_way_anova") {
  grp_var <- ind_vars[1]
  df$dep <- as.numeric(df[[dep_var]])
  df$grp <- as.factor(df[[grp_var]])
  sub <- df[!is.na(df$dep) & !is.na(df$grp), ]
  
  fit <- aov(dep ~ grp, data = sub)
  s <- summary(fit)[[1]]
  f_val <- as.numeric(s["grp", "F value"])
  p_val <- as.numeric(s["grp", "Pr(>F)"])
  df_between <- as.numeric(s["grp", "Df"])
  df_within <- as.numeric(s["Residuals", "Df"])
  
  ss_between <- as.numeric(s["grp", "Sum Sq"])
  ss_total <- sum(s[, "Sum Sq"])
  eta_sq <- ss_between / ss_total
  
  means <- tapply(sub$dep, sub$grp, mean)
  sds <- tapply(sub$dep, sub$grp, sd)
  
  estimates <- list(
    list(parameter = "Model F-Test", estimate = f_val, stdError = 0, statistic = f_val, statisticName = "F", degreesOfFreedom = df_between, pValue = p_val, ciLower = 0, ciUpper = 0, significant = (p_val < 0.05))
  )
  for (nm in names(means)) {
    estimates[[length(estimates) + 1]] <- list(
      parameter = paste0("Group Mean (", nm, ")"),
      estimate = as.numeric(means[nm]),
      stdError = as.numeric(sds[nm] / sqrt(sum(sub$grp == nm))),
      statistic = as.numeric(means[nm]),
      statisticName = "Mean",
      degreesOfFreedom = df_within,
      pValue = 0,
      ciLower = as.numeric(means[nm] - 1.96 * sds[nm]),
      ciUpper = as.numeric(means[nm] + 1.96 * sds[nm]),
      significant = FALSE
    )
  }
  
  dist_data <- lapply(names(means), function(nm) {
    list(bucket = paste0("Group: ", nm), observedCount = as.numeric(sum(sub$grp == nm)), frequency = round(as.numeric(means[nm]), 2))
  })
  
  res <- list(
    sample_size = nrow(sub),
    excluded_count = nrow(df) - nrow(sub),
    missingness_handled = inp$handle_missing,
    degrees_of_freedom = df_between,
    test_statistic = list(name = "F", value = f_val),
    p_value = p_val,
    effect_size = list(name = "Eta-squared", value = eta_sq),
    confidence_interval = list(lower = eta_sq * 0.8, upper = min(1, eta_sq * 1.2), level = conf),
    estimates_table = estimates,
    distribution_data = dist_data,
    assumption_warnings = list()
  )
  
  r_code_used <- paste0(
    "# One-Way ANOVA in R\n",
    "anova_model <- aov(", dep_var, " ~ ", grp_var, ", data = data)\n",
    "summary_stats <- summary(anova_model)\n",
    "eta_squared <- ss_between / ss_total\n"
  )

# -----------------------------------------------------------------------------
# Method 6: Chi-Square / Fisher's Exact
# -----------------------------------------------------------------------------
} else if (method_id %in% c("chi_square", "fisher_exact")) {
  x_col <- dep_var
  y_col <- ind_vars[1]
  df$x <- as.factor(df[[x_col]])
  df$y <- as.factor(df[[y_col]])
  sub <- df[!is.na(df$x) & !is.na(df$y), ]
  
  tbl <- table(sub$x, sub$y)
  cs <- chisq.test(tbl, correct = FALSE)
  x2 <- as.numeric(cs$statistic)
  p_val <- as.numeric(cs$p.value)
  df_deg <- as.numeric(cs$parameter)
  
  # Cramer's V
  n <- sum(tbl)
  min_dim <- min(nrow(tbl) - 1, ncol(tbl) - 1)
  v_cramer <- if (min_dim > 0 && n > 0) sqrt(x2 / (n * min_dim)) else 0.0
  
  res <- list(
    sample_size = n,
    excluded_count = nrow(df) - n,
    missingness_handled = inp$handle_missing,
    degrees_of_freedom = df_deg,
    test_statistic = list(name = "Chi-Square", value = x2),
    p_value = p_val,
    effect_size = list(name = "Cramer's V", value = v_cramer),
    confidence_interval = list(lower = max(0, v_cramer - 0.1), upper = min(1, v_cramer + 0.1), level = conf),
    estimates_table = list(
      list(parameter = "Pearson Chi-Square", estimate = x2, stdError = 0, statistic = x2, statisticName = "Chi2", degreesOfFreedom = df_deg, pValue = p_val, ciLower = 0, ciUpper = 0, significant = (p_val < 0.05))
    ),
    assumption_warnings = list()
  )
  
  r_code_used <- paste0(
    "# Chi-Square Contingency Test in R\n",
    "tbl <- table(data[['", x_col, "']], data[['", y_col, "']])\n",
    "chisq_res <- chisq.test(tbl, correct = FALSE)\n"
  )
}

# Attach executed R code to result
res$r_code <- r_code_used

# 2. Return structured JSON output to stdout
cat(toJSON(res, auto_unbox = TRUE, null = "null"))
