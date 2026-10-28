import { Questionnaire } from './questionnaire';

export type SubmissionSyncStatus = 
  | 'pending' 
  | 'synchronizing' 
  | 'synchronized' 
  | 'failed' 
  | 'conflict';

export interface ConsentWordingPayload {
  studyId?: string;
  studyTitle?: string;
  questionnaireId: string;
  questionnaireVersion: string;
  ethicsApprovalNumber?: string;
  principalInvestigator?: string;
  institution?: string;
  informationSheetHtml: string;
  consentStatements: string[];
  dataRetentionPolicySummary: string;
  withdrawnPolicySummary: string;
}

export interface ConsentRecord {
  id: string; // UUID
  studyId?: string;
  questionnaireId: string;
  questionnaireVersion: string;
  participantIdentifier: string; // De-identified subject code
  consentedAt: string;
  agreedToParticipate: boolean;
  agreedToDataStorage: boolean;
  agreedToContact: boolean;
  agreedStatements: string[];
}

export interface LocalSurveyDraft {
  id: string; // compound: `${questionnaireId}_${participantIdentifier}`
  questionnaireId: string;
  questionnaireVersion: string;
  participantIdentifier: string;
  answers: Record<string, unknown>;
  lastSavedAt: string;
  completionPercentage: number;
}

export interface QueuedSubmission {
  id: string; // Stable UUID idempotency key (crypto.randomUUID())
  questionnaireId: string;
  questionnaireTitle: string;
  questionnaireVersion: string;
  studyId?: string;
  participantIdentifier: string; // e.g. "SUBJ-9041"
  answers: Record<string, unknown>;
  consentRecord: ConsentRecord;
  status: SubmissionSyncStatus;
  createdAt: string;
  attempts: number;
  lastAttemptAt?: string;
  serverAcknowledgement?: {
    confirmationId: string;
    receivedAt: string;
    statusCode: number;
  };
  errorMessage?: string;
  conflictDetails?: {
    serverVersion: string;
    localVersion: string;
    message: string;
  };
}

export interface CachedOfflineQuestionnaire {
  id: string;
  questionnaire: Questionnaire;
  version: string;
  cachedAt: string;
  cachedByUserId: string;
  authorizedRole: string;
}

export interface CollectionMonitoringMetrics {
  totalTargetResponses: number;
  completedOnline: number;
  pendingOfflineQueue: number;
  syncedSuccessfully: number;
  syncFailed: number;
  activeSurveysCount: number;
  lastSyncTimestamp?: string;
}

