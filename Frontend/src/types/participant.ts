export type ParticipantStatus = 'screened' | 'enrolled' | 'active' | 'completed' | 'withdrawn' | 'lost_to_follow_up';

export interface Participant {
  id: string;
  studyId: string;
  studyTitle?: string;
  identifierCode: string;
  enrollmentDate: string;
  status: ParticipantStatus;
  cohort?: string;
  siteLocation?: string;
}

export interface ParticipantMetrics {
  totalScreened: number;
  totalEnrolled: number;
  activeParticipants: number;
  completedParticipants: number;
  retentionRate: number;
}

