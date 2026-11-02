# =============================================================================
# Isolated Clinical R Statistical Execution Engine Container
# AI Research Flow - Regulatory GCP Compliant Runtime
# =============================================================================

FROM r-base:latest

LABEL maintainer="AI Research Flow Team"
LABEL description="Isolated containerized R computational runtime for verifiable clinical statistics"

# Install system dependencies required for R networking/JSON libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    && rm -rf /var/lib/apt/lists/*

# Install required clinical statistical packages
RUN R -e "install.packages(c('jsonlite', 'MASS', 'survival'), repos='https://cloud.r-project.org/')"

WORKDIR /scripts
COPY run_analysis.R /scripts/run_analysis.R

# Run as non-root user for security compliance
RUN useradd -m -u 1000 ruser && chown -R ruser:ruser /scripts
USER ruser

ENTRYPOINT ["Rscript", "/scripts/run_analysis.R"]
