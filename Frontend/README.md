# AI Research Flow — Full Frontend Application (Parts 1, 2, 3, 4 & 5)

Clean, responsive research SaaS frontend interface for clinical protocols, AI extractions, dynamic questionnaire generation, participant preview, offline data intake, statistical analysis workbench, results visualisation, reports, and exports. Built with **React 18**, **TypeScript**, **Vite**, **Tailwind CSS**, **shadcn/ui** patterns, **Radix UI**, **React Hook Form**, **Zod**, **TanStack Query**, **Recharts**, and **IndexedDB**.

---

## 1. Design & UI Specifications
- **Dark Navy Left Sidebar** (`#0b132b` / `#1c2541`): Collapsible on mobile and tablet, persistent on desktop with accessible keyboard focus states and active route indicators.
- **Light Workspace Theme** (`#f8fafc` / `#ffffff`): Crisp contrast, rounded cards (`rounded-xl`), subtle borders (`border-slate-200`), and restrained shadows.
- **Blue Primary Actions** (`#2563eb`): Cohesive visual hierarchy across all call-to-action buttons.
- **Accessible UI States**: Dedicated components for **Loading**, **Unavailable** (disconnected backend warning with endpoint name and retry), **Error**, and **Empty** states.
- **Source-to-Extracted Field Verification**: Two-pane workspace displaying cited document evidence linked to AI-suggested fields.
- **Dynamic Questionnaire Builder & Preview**: Visual question card reordering, choices inspector, conditional skip logic editor, and real-time client-side preview evaluation.
- **Field Data Collection & Offline Sync Engine**: IndexedDB storage for offline published questionnaire definitions, in-progress local drafts, participant consent records, and an idempotent offline submission queue with background and foreground synchronization.
- **Statistical Analysis Workbench & Results Visualisation**: Rigorous variable mapping from the actual data dictionary, SAP concordance validation, Recharts distributions/scatter/survival curves, parameter estimates table, model diagnostic assumption verifications, and distinct AI clinical interpretation synthesis.
- **Formal Reports & Export Centre**: Clinical Study Reports (CSR), manuscript compilation, Table of Contents navigation, and governance-compliant export packages in CSV, XLSX, PDF, and DOCX formats with mandatory de-identification.

---

## 2. Directory Structure

```
Frontend/
├── .env.example                     # Environment variable blueprint
├── .env                             # Local development environment configuration
├── index.html                       # HTML5 entry with Inter font
├── package.json                     # Dependencies & scripts (recharts, dexie, query, etc.)
├── postcss.config.js                # PostCSS configuration with Tailwind
├── tailwind.config.js               # Tailwind theme, colors & radius tokens
├── tsconfig.json                    # TypeScript compiler configuration (bundler mode)
├── tsconfig.node.json               # Node/Vite TS configuration
├── vite.config.ts                   # Vite configuration with '@/' path alias
├── public/
│   ├── manifest.json                # PWA Web App Manifest
│   └── sw.js                        # Service Worker caching shell & background sync
└── src/
    ├── main.tsx                     # React 18 DOM mount & SW registration
    ├── serviceWorkerRegistration.ts # Service Worker registration helper
    ├── App.tsx                      # QueryClientProvider & BrowserRouter entry
    ├── index.css                    # Tailwind layers, shadcn CSS variables, scrollbars
    ├── api/                         # Real HTTP client services (no fake stats)
    │   ├── analysisApi.ts           # Datasets, variables, methods, run execution, results, quality
    │   ├── authApi.ts               # GET /auth/me, POST /auth/login, POST /auth/logout
    │   ├── configApi.ts             # GET /config (feature flags & product configuration)
    │   ├── dashboardApi.ts          # Aggregate metrics, status summaries, recent studies
    │   ├── dataCollectionApi.ts     # Published surveys, consent, submissions, batch sync & monitoring
    │   ├── notificationsApi.ts      # GET /notifications, PATCH /notifications/:id/read
    │   ├── participantsApi.ts       # GET /participants/metrics
    │   ├── protocolsApi.ts          # Protocol upload, extraction, verification, config & versions
    │   ├── questionnairesApi.ts     # Questionnaire CRUD, AI generation, review, publish, versions
    │   ├── reportsApi.ts            # Compiled reports, manuscripts, export jobs & download
    │   └── studiesApi.ts            # GET /studies, GET /studies/:id, POST /studies
    ├── components/
    │   ├── shared/
    │   │   ├── Breadcrumbs.tsx
    │   │   ├── ConfirmDialog.tsx
    │   │   ├── MetricCard.tsx
    │   │   ├── PageContainer.tsx
    │   │   └── StatusState.tsx
    │   ├── shell/
    │   │   ├── AppShell.tsx
    │   │   ├── NotificationsPopover.tsx
    │   │   ├── Sidebar.tsx
    │   │   ├── TopNavbar.tsx        # Real-time Online/Offline indicator & Sync Queue status
    │   │   └── UserProfile.tsx
    │   └── ui/
    ├── features/                    # Domain views
    │   ├── analysis/                # Part 5: Analysis Dashboard & Results Visualisation
    │   │   ├── components/
    │   │   │   ├── AiInterpretationCard.tsx     # AI clinical synthesis (strictly separated from math)
    │   │   │   ├── AssumptionWarningsCard.tsx   # Model diagnostic checks (normality, collinearity, etc.)
    │   │   │   ├── EstimatesTable.tsx           # Parameter estimates, SE, test statistics, p-values, CIs
    │   │   │   ├── StatisticalCharts.tsx        # Recharts distribution bars, scatter/regression, survival curves
    │   │   │   └── VariableDictionaryTable.tsx  # Interactive variable inspector
    │   │   ├── AnalysisWorkbenchView.tsx        # Screen 1: Frozen snapshots & analytical pipelines
    │   │   ├── AnalysisRunConfigView.tsx        # Screen 2 & 3: Variable selection & method configuration
    │   │   ├── AnalysisExecutionStatusView.tsx  # Screen 4: Real-time execution tracking & cancellation
    │   │   ├── AnalysisResultsView.tsx          # Screen 5: Comprehensive results dashboard with Recharts
    │   │   ├── DataQualityView.tsx              # Screen 6: Missingness summary & MCAR/MAR diagnostics
    │   │   ├── AnalysisHistoryView.tsx          # Screen 7: Historical run audit trail
    │   │   └── AnalysisView.tsx                 # Analysis entry router re-export
    │   ├── auth/AccessDeniedView.tsx
    │   ├── collaborators/CollaboratorsView.tsx
    │   ├── dashboard/
    │   ├── data-collection/         # Part 4: Data Collection & Offline Sync
    │   │   ├── DataCollectionView.tsx           # Screen 1: Field Data Collection Hub
    │   │   ├── PublishedSurveysView.tsx         # Screen 2: Published Survey Access & Offline Caching
    │   │   ├── ParticipantConsentView.tsx       # Screen 3: Information & Informed Consent
    │   │   ├── ParticipantSurveyFormView.tsx    # Screen 4: Survey Form (Online/Offline)
    │   │   ├── OfflineQueueView.tsx             # Screen 5: Offline Submission Queue & Retries
    │   │   └── CollectionMonitoringView.tsx     # Screen 7: Collection Monitoring Dashboard
    │   ├── help/HelpSupportView.tsx
    │   ├── participants/ParticipantsView.tsx
    │   ├── protocols/               # Part 2: Protocols, Extraction & Verification
    │   ├── questionnaires/          # Part 3: Dynamic Questionnaire Builder & Generation
    │   ├── reports/                 # Part 5: Reports & Export Centre
    │   │   ├── ReportsView.tsx                  # Screen 8: Reports library (CSRs, manuscripts)
    │   │   ├── ReportDetailView.tsx             # Screen 8: Structured document preview & TOC
    │   │   └── ExportCenterView.tsx             # Screen 9: Formal export centre (CSV, XLSX, PDF, DOCX)
    │   ├── settings/SettingsView.tsx
    │   ├── shared/NotFoundView.tsx
    │   └── studies/StudiesView.tsx & StudyDetailView.tsx
    ├── hooks/
    │   ├── useAnalysis.ts           # Datasets, variables, methods, run, results, data quality hooks
    │   ├── useAuth.ts
    │   ├── useDashboard.ts
    │   ├── useDataCollection.ts     # Published surveys, consent & monitoring queries
    │   ├── useNotifications.ts
    │   ├── useOfflineSync.ts        # Online/Offline state & IndexedDB queue manager
    │   ├── useProductConfig.ts
    │   ├── useProtocols.ts
    │   ├── useQuestionnaires.ts
    │   ├── useReports.ts            # Reports and export jobs queries & mutations
    │   └── useStudies.ts
    ├── lib/
    │   ├── axios.ts
    │   ├── indexedDb.ts             # IndexedDB wrapper (cached surveys, drafts, queue, consent)
    │   └── utils.ts
    ├── routes/
    │   └── AppRoutes.tsx            # Complete route tree with Part 1–5 routes
    └── types/
        ├── analysis.ts              # DatasetSnapshot, VariableDefinition, Method, Estimates, Warnings
        ├── api.ts
        ├── auth.ts
        ├── dataCollection.ts        # Consent, Draft, Queue, and Monitoring interfaces
        ├── navigation.ts
        ├── participant.ts
        ├── protocol.ts
        ├── questionnaire.ts
        ├── reports.ts               # ResearchReport, ExportJob, ExportOptions
        └── study.ts
```

---

## 3. Environment Variables

Create `.env` using `.env.example`:

```bash
# Backend API Base URL (default points to standard local API port)
VITE_API_BASE_URL=http://localhost:8000/api

# Request Timeout (in milliseconds)
VITE_API_TIMEOUT=15000

# Feature Flags
VITE_ENABLE_AI_ASSISTANT=false

# App Metadata
VITE_APP_NAME="AI Research Flow"
VITE_APP_VERSION="1.0.0"
```

---

## 4. Complete Navigation Routes (Parts 1–5)

| Route | View Component | Description |
|---|---|---|
| `/` or `/dashboard` | `DashboardView` | Dynamic dashboard with metrics, summaries, studies, workflow |
| `/studies` | `StudiesView` | Study repository with status filtering |
| `/studies/:id` | `StudyDetailView` | Deep-dive study metadata and protocol metrics |
| `/protocols` | `ProtocolsView` | Protocol library with dynamic search & filtering |
| `/protocols/upload` | `ProtocolUploadView` | Drag-and-drop upload for PDF & DOCX |
| `/protocols/:id` | `ProtocolDetailView` | Document preview & metadata panel |
| `/protocols/:id/verify` | `ProtocolVerificationView` | Extraction progress & verification workspace |
| `/protocols/:id/study-configuration` | `StudyConfigurationView` | Study methods & statistical analysis plan |
| `/protocols/:id/versions` | `ProtocolVersionHistoryView` | Version history & amendment audit trail |
| `/questionnaires` | `QuestionnairesView` | Questionnaire library & status filters |
| `/questionnaires/generate` | `QuestionnaireGenerateView` | AI questionnaire generation workspace |
| `/questionnaires/new` | `QuestionnaireBuilderView` | Visual editor for new instrument |
| `/questionnaires/:id/builder` | `QuestionnaireBuilderView` | Visual questionnaire builder & settings |
| `/questionnaires/:id/preview` | `QuestionnairePreviewView` | Participant preview with live conditional logic |
| `/questionnaires/:id/review` | `QuestionnaireReviewView` | Review, sign-off & objective coverage mapping |
| `/questionnaires/:id/versions` | `QuestionnaireVersionHistoryView` | Version audit trail & publish locking |
| `/data-collection` | `DataCollectionView` | Field data collection hub & offline stats |
| `/data-collection/surveys` | `PublishedSurveysView` | Published surveys access & offline caching |
| `/surveys/:id/consent` | `ParticipantConsentView` | Participant information & informed consent |
| `/surveys/:id/respond` | `ParticipantSurveyFormView` | Survey response form (online/offline) |
| `/data-collection/queue` | `OfflineQueueView` | IndexedDB submission queue & retries |
| `/data-collection/monitoring` | `CollectionMonitoringView` | Collection intake monitoring dashboard |
| `/analysis` | `AnalysisWorkbenchView` | **Screen 1**: Frozen dataset snapshots, SAP methods & recent runs |
| `/analysis/new` | `AnalysisRunConfigView` | **Screens 2 & 3**: Variable mapping ($Y$, $X$, covariates) & SAP method selection |
| `/analysis/:id/status` | `AnalysisExecutionStatusView` | **Screen 4**: Execution progress monitor & cancellation |
| `/analysis/:id/results` | `AnalysisResultsView` | **Screen 5**: Statistical results dashboard with Recharts ($p$, effect sizes, assumptions, AI interpretation) |
| `/analysis/data-quality` | `DataQualityView` | **Screen 6**: Data quality, completeness, missingness mechanisms (MCAR/MAR) |
| `/analysis/history` | `AnalysisHistoryView` | **Screen 7**: Execution audit trail and run history |
| `/reports` | `ReportsView` | **Screen 8**: Research reports & manuscripts library |
| `/reports/:id` | `ReportDetailView` | **Screen 8**: Structured report preview with TOC & linked runs |
| `/reports/exports` or `/exports` | `ExportCenterView` | **Screen 9**: De-identified package export centre (CSV, XLSX, PDF, DOCX) |
| `/participants` | `ParticipantsView` | Cohort enrollment and retention tracking |
| `/collaborators` | `CollaboratorsView` | Cross-institutional investigator team |
| `/settings` | `SettingsView` | Environment, security, and GCP compliance |
| `/help` | `HelpSupportView` | Operating procedures and technical documentation |
| `/access-denied` | `AccessDeniedView` | 403 Forbidden boundary |
| `*` | `NotFoundView` | 404 Route catch-all |

---

## 5. Part 5 Backend API Contracts & Endpoints

The frontend connects dynamically to the following endpoints once the backend statistical and reporting services are implemented:

### Statistical Analysis Workbench & Execution:
- `GET /api/analysis/datasets` — Retrieves list of available frozen dataset snapshots with record and variable counts
- `GET /api/analysis/datasets/:id` — Retrieves specific snapshot metadata, freeze lock timestamp, and schema version
- `GET /api/analysis/datasets/:id/variables` — Retrieves the actual variable dictionary, data types (`numeric`, `categorical`, `binary`), missing counts, and summary statistics
- `GET /api/analysis/datasets/:id/quality` — Retrieves data quality diagnostics, completeness percentages, outlier counts, and missingness patterns (`MCAR`, `MAR`, `MNAR`)
- `GET /api/analysis/methods` — Retrieves supported analytical methods prespecified in the study Statistical Analysis Plan (SAP)
- `POST /api/analysis/runs` — Dispatches a new statistical computation job with selected independent, dependent, and covariate variables
- `GET /api/analysis/runs` — Retrieves historical execution audit log
- `GET /api/analysis/runs/:id` — Retrieves run execution status, current processing phase, and progress percentage
- `GET /api/analysis/runs/:id/results` — Retrieves authoritative numerical results:
  - Sample size $N$ and excluded cases
  - $p$-values and test statistics ($t$, $F$, $\chi^2$, $Z$)
  - Effect sizes with confidence intervals (Cohen's $d$, odds ratio, hazard ratio, $R^2$)
  - Model diagnostic assumption verifications (normality, homoscedasticity, proportional hazards)
  - Precomputed data arrays for Recharts (distribution bars, scatter coordinates with fitted lines, Kaplan-Meier curves)
  - Distinct AI clinical and statistical interpretation synthesis
- `POST /api/analysis/runs/:id/cancel` — Cancels an ongoing statistical run

### Reports & Manuscripts:
- `GET /api/reports` — Retrieves compiled clinical study reports (CSR), manuscripts, and interim summaries
- `GET /api/reports/:id` — Retrieves structured document sections, Table of Contents, and links to verified analysis runs
- `POST /api/reports` — Compiles a new research report from selected protocol metadata and completed analysis runs
- `PUT /api/reports/:id` — Updates report draft sections or review status

### Export Centre & Governance:
- `GET /api/exports/jobs` — Retrieves list of past export packages and their download expiration status
- `POST /api/exports/jobs` — Requests a new export package (CSV, XLSX, PDF, DOCX) enforcing de-identification confirmation
- `GET /api/exports/jobs/:id` — Checks status and progress of an export packaging job
- `GET /api/exports/jobs/:id/download` — Downloads the generated package file

### Reports & Manuscripts:
- `GET /api/reports` — Retrieves compiled clinical study reports (CSR), manuscripts, and interim summaries
- `GET /api/reports/:id` — Retrieves structured document sections, Table of Contents, and links to verified analysis runs
- `POST /api/reports` — Compiles a new research report from selected protocol metadata and completed analysis runs
- `PUT /api/reports/:id` — Updates report draft sections or review status

### Export Centre & Governance:
- `GET /api/exports/jobs` — Retrieves list of past export packages and their download expiration status
- `POST /api/exports/jobs` — Requests a new export package (CSV, XLSX, PDF, DOCX) enforcing de-identification confirmation
- `GET /api/exports/jobs/:id` — Checks status and progress of an export packaging job
- `GET /api/exports/jobs/:id/download` — Downloads the generated package file

