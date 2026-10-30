export interface Collaborator {
  id: string;
  userId?: string;
  studyId?: string;
  studyTitle?: string;
  fullName: string;
  email: string;
  roleName: string;
  institution?: string;
  department?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CollaboratorMetrics {
  totalCollaborators: number;
  activeInvestigators: number;
  participatingInstitutions: number;
  activeStudies: number;
}

export interface CollaboratorInvitePayload {
  fullName: string;
  email: string;
  roleName: string;
  studyId?: string;
  institution?: string;
  department?: string;
}

