export type ProtocolReviewStatus = 
  | 'draft' 
  | 'under_review' 
  | 'approved' 
  | 'revision_requested' 
  | 'rejected';

export type ProtocolExtractionStatus = 
  | 'not_started' 
  | 'queued' 
  | 'processing' 
  | 'completed' 
  | 'failed';

export interface Protocol {
  id: string;
  studyId?: string;
  studyTitle?: string;
  title: string;
  version: string;
  status: ProtocolReviewStatus;
  fileUrl?: string;
  fileName?: string;
  fileSizeBytes?: number;
  fileType?: string;
  uploadedAt: string;
  uploadedBy?: string;
  irbApprovalNumber?: string;
  approvalDate?: string;
  extractionStatus?: ProtocolExtractionStatus;
  extractionCompletedAt?: string;
  summaryNotes?: string;
}

export interface ExtractionSourceEvidence {
  pageNumber?: number;
  paragraphNumber?: number;
  sectionTitle?: string;
  sourceTextSnippet: string;
  boundingCoordinates?: { x: number; y: number; width: number; height: number };
}

export type ExtractedFieldStatus = 
  | 'unreviewed' 
  | 'accepted' 
  | 'edited' 
  | 'rejected' 
  | 'flagged';

export interface ExtractedField<T = string> {
  key: string;
  label: string;
  aiValue: T;
  verifiedValue?: T;
  status: ExtractedFieldStatus;
  uncertainty?: 'high' | 'medium' | 'low';
  isMissing?: boolean;
  confidenceScore?: number; // Only provided when backend returns it; never simulated
  evidence?: ExtractionSourceEvidence;
  reviewerNotes?: string;
  flagReason?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface ProtocolExtractionFields {
  studyTitle: ExtractedField<string>;
  researchAims: ExtractedField<string[] | string>;
  studyDesign: ExtractedField<string>;
  targetPopulation: ExtractedField<string>;
  inclusionCriteria: ExtractedField<string[]>;
  exclusionCriteria: ExtractedField<string[]>;
  samplingMethod: ExtractedField<string>;
  sampleSize: ExtractedField<string | number>;
  primaryOutcomes: ExtractedField<string[] | string>;
  secondaryOutcomes: ExtractedField<string[] | string>;
  variablesAndInstruments: ExtractedField<string[] | string>;
  dataCollectionMethods: ExtractedField<string[] | string>;
  statisticalAnalysisPlan: ExtractedField<string>;
}

export interface ProtocolExtractionData {
  id: string;
  protocolId: string;
  status: ProtocolExtractionStatus;
  errorMessage?: string;
  modelMetadata?: {
    modelName?: string;
    extractedAt?: string;
    processingDurationSeconds?: number;
  };
  fields: ProtocolExtractionFields;
  isFullyVerified?: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface StudyMethodAnalysisConfiguration {
  protocolId: string;
  studyType: string;
  randomizationMethod?: string;
  allocationRatio?: string;
  blindingType: 'double_blind' | 'single_blind' | 'open_label' | 'triple_blind';
  numberOfArms: number;
  primaryHypothesis: string;
  significanceAlpha: number;
  powerThreshold: number;
  plannedStatisticalTest: string;
  missingDataStrategy: 'complete_case' | 'multiple_imputation' | 'last_observation_carried_forward' | 'mixed_effects_model';
  subgroupAnalyses?: string;
  interimAnalysesPlanned?: boolean;
  updatedAt?: string;
  configuredBy?: string;
}

export interface ProtocolVersionItem {
  id: string;
  protocolId: string;
  versionNumber: string;
  fileName: string;
  fileSizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
  changesSummary?: string;
  status: ProtocolReviewStatus;
  downloadUrl?: string;
}
