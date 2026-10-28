export type StudyStatus = 
  | 'draft'
  | 'protocol_review'
  | 'active'
  | 'data_collection'
  | 'analysis'
  | 'completed'
  | 'archived';

export type StudyPhase = 
  | 'Phase I'
  | 'Phase II'
  | 'Phase III'
  | 'Phase IV'
  | 'Observational'
  | 'Pilot'
  | 'Translational';

export interface Study {
  id: string;
  title: string;
  protocolNumber: string;
  status: StudyStatus;
  phase?: StudyPhase | string;
  principalInvestigator?: string;
  targetParticipants?: number;
  enrolledParticipants?: number;
  startDate?: string;
  endDate?: string;
  updatedAt: string;
  createdAt: string;
  completionPercentage?: number;
}

export interface StudyStatusCount {
  status: StudyStatus;
  label: string;
  count: number;
  color?: string;
}

export interface StudyStatusSummary {
  total: number;
  byStatus: StudyStatusCount[];
}

export type WorkflowStepStatus = 'completed' | 'in_progress' | 'pending' | 'blocked';

export interface WorkflowProgressStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  status: WorkflowStepStatus;
  estimatedCompletion?: string;
  assignedRole?: string;
}

export interface DashboardMetrics {
  totalStudies: number;
  activeStudies: number;
  totalParticipants: number;
  activeParticipants: number;
  questionnairesCompleted: number;
  questionnairesPending: number;
  dataCollectionRate?: number;
  lastUpdated?: string;
}

