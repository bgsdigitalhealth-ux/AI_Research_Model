export type ReportType = 'csr' | 'manuscript' | 'interim_summary' | 'saf_report' | 'consort_flow';

export type ReportStatus = 'draft' | 'under_review' | 'approved' | 'archived';

export interface ReportSection {
  id: string;
  title: string;
  content: string;
  linkedAnalysisRunId?: string;
  tablesCount?: number;
  figuresCount?: number;
  isAiDrafted?: boolean;
  reviewedBy?: string;
}

export interface ResearchReport {
  id: string;
  studyId: string;
  studyTitle: string;
  title: string;
  type: ReportType;
  version: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
  sections: ReportSection[];
  approvedAnalysisRunIds: string[];
  protocolVersion: string;
  datasetSnapshotId: string;
  summaryExecutive?: string;
}

export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'docx';

export type ExportType = 'raw_dataset' | 'curated_analysis' | 'formal_report' | 'variable_codebook';

export type ExportJobStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'expired';

export interface ExportOptions {
  studyId: string;
  format: ExportFormat;
  type: ExportType;
  datasetSnapshotId?: string;
  analysisRunId?: string;
  reportId?: string;
  includeCodebook: boolean;
  deIdentifyData: boolean;
  maskDirectIdentifiers: boolean;
  variableFilter?: string[];
}

export interface ExportJob {
  id: string;
  studyId: string;
  studyTitle?: string;
  format: ExportFormat;
  type: ExportType;
  status: ExportJobStatus;
  progressPercent: number;
  fileName?: string;
  fileSizeBytes?: number;
  fileUrl?: string;
  createdAt: string;
  completedAt?: string;
  expiresAt?: string;
  errorMessage?: string;
  requestedBy: {
    id: string;
    name: string;
    email: string;
  };
  deIdentifiedConfirmed: boolean;
  governanceNotice?: string;
}

